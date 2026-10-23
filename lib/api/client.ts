import { mockApiClient } from "./mock/mock-client";
import { MOCK_PRELOADED_CONVERSATIONS } from "./mock/fixtures";
import { 
  EvidenceUploadResponse, 
  CreateConversationRequest, 
  CreateConversationResponse, 
  SSEEvent 
} from "@/types/api";
import { Conversation, Message } from "@/types/chat";
import { EvidencePayload } from "@/types/evidence";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { isConversationalMessage } from "@/lib/utils";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

/**
 * Resolves the backend API base URL with production safety and sanitization.
 * In development, defaults to http://localhost:8000 if NEXT_PUBLIC_API_URL is unset.
 * In production, uses NEXT_PUBLIC_API_URL (configured in Render / Vercel environment).
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() && envUrl !== "undefined" && envUrl !== "null") {
    // Strip trailing slashes to prevent malformed double slashes like //api/chat
    return envUrl.trim().replace(/\/+$/, "");
  }

  // Check if running in browser on production domain with unset NEXT_PUBLIC_API_URL
  if (typeof window !== "undefined") {
    const isLocalhost = 
      window.location.hostname === "localhost" || 
      window.location.hostname === "127.0.0.1";
    if (!isLocalhost) {
      console.warn(
        `[Paylume API] NEXT_PUBLIC_API_URL is not set on production origin (${window.location.origin}). ` +
        `Falling back to http://localhost:8000. Please configure NEXT_PUBLIC_API_URL in your hosting dashboard ` +
        `to point to your deployed Render FastAPI backend.`
      );
    }
  }

  return "http://localhost:8000";
}

const API_URL = getApiBaseUrl();

const STORAGE_KEY = "paylume_conversations_v1";

export interface ChatApiResponse {
  answer: string;
  sources: Array<{
    title: string;
    source: string;
    category?: string;
    url?: string;
    snippet?: string;
  }>;
  security_evidence?: string[];
  metadata: Record<string, any>;
}

export interface SendChatParams {
  question: string;
  url?: string;
  image?: File | Blob;
  conversationHistory?: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
}

function dataUriToBlob(dataUri: string): Blob | null {
  try {
    if (!dataUri || !dataUri.startsWith("data:")) return null;
    const parts = dataUri.split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  } catch {
    return null;
  }
}

export class ApiClient {
  private async getCurrentUserId(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        return session.user.id;
      }
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }

  private sanitizeEvidenceForDb(evidence?: EvidencePayload | null): Record<string, any> {
    if (!evidence) return {};
    // Exclude raw File / Blob object as it cannot be JSON-serialized into Postgres JSONB
    const { rawFile, ...serializable } = evidence;
    return serializable;
  }

  private getLocalConversations(userId?: string | null): Conversation[] {
    if (typeof window === "undefined") return [];
    try {
      if (userId) {
        // Authenticated sessions strictly access their own isolated storage
        const userScoped = localStorage.getItem(`paylume_conversations_${userId}`);
        return userScoped ? JSON.parse(userScoped) : [];
      }
      // Only unauthenticated guest sessions use the unscoped legacy store
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalConversations(convs: Conversation[], userId?: string | null) {
    if (typeof window === "undefined") return;
    try {
      const serialized = JSON.stringify(convs);
      if (userId) {
        // Persist only to the user's isolated storage
        localStorage.setItem(`paylume_conversations_${userId}`, serialized);
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn("Could not persist conversation to localStorage:", e);
    }
  }

  /**
   * Safely migrates existing local conversations for this authenticated user account into Supabase.
   * Uses ignoreDuplicates: true so inserting a migrated conversation never overwrites an existing server record.
   * Preserves existing server messages and evidence if the ID already exists.
   * Handles errors explicitly and allows safe retries on subsequent refreshes.
   */
  private async migrateLocalConversationsToSupabase(
    userId: string,
    existingServerIds: Set<string>
  ): Promise<Conversation[]> {
    if (typeof window === "undefined") return [];
    const migrationFlagKey = `paylume_migrated_${userId}`;
    const alreadyMigrated = localStorage.getItem(migrationFlagKey) === "true";
    if (alreadyMigrated) return [];

    const localConvs = this.getLocalConversations(userId);
    if (!localConvs || localConvs.length === 0) {
      try {
        localStorage.setItem(migrationFlagKey, "true");
      } catch {}
      return [];
    }

    const newlyMigrated: Conversation[] = [];
    let hasFailure = false;

    for (const conv of localConvs) {
      if (existingServerIds.has(conv.id)) {
        continue;
      }

      try {
        const payload = {
          id: conv.id,
          user_id: userId,
          title: conv.title || "Payment Investigation",
          evidence_type: conv.evidence?.type || "message",
          evidence_payload: this.sanitizeEvidenceForDb(conv.evidence),
          messages: Array.isArray(conv.messages) ? conv.messages : [],
          created_at: conv.createdAt || new Date().toISOString(),
          updated_at: conv.updatedAt || new Date().toISOString()
        };

        const { error } = await supabase
          .from("chat_conversations")
          .upsert(payload, { onConflict: "id", ignoreDuplicates: true });

        if (error) {
          console.warn(`[Paylume Sync] Partial migration error for ${conv.id}:`, error.message);
          hasFailure = true;
        } else {
          newlyMigrated.push(conv);
          existingServerIds.add(conv.id);
        }
      } catch (err) {
        console.warn(`[Paylume Sync] Exception migrating conversation ${conv.id}:`, err);
        hasFailure = true;
      }
    }

    // Only set migration flag if all candidate local records were cleanly persisted without error
    if (!hasFailure) {
      try {
        localStorage.setItem(migrationFlagKey, "true");
      } catch {}
    }

    return newlyMigrated;
  }

  async uploadEvidence(file: File, onProgress?: (pct: number) => void): Promise<EvidenceUploadResponse> {
    if (USE_MOCK) {
      return mockApiClient.uploadEvidence(file, onProgress);
    }

    onProgress?.(30);
    const isQr = file.name.toLowerCase().includes("qr") || file.name.toLowerCase().includes("barcode");
    
    // Generate local preview URL
    const previewUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });

    onProgress?.(100);

    const id = `ev-${Date.now()}`;
    const type = isQr ? "qr" : "screenshot";

    return {
      evidenceId: id,
      type,
      previewUrl,
      evidence: {
        id,
        type,
        title: file.name,
        previewUrl,
        rawFile: file,
        fileMeta: {
          name: file.name,
          size: file.size,
          type: file.type
        },
        createdAt: new Date().toISOString()
      },
      extracted: {
        ocrText: `Image ready for multimodal forensic analysis (${file.name})`,
        timestamp: new Date().toISOString()
      }
    };
  }

  async uploadUrl(url: string): Promise<EvidenceUploadResponse> {
    if (USE_MOCK) {
      return mockApiClient.uploadUrl(url);
    }

    const cleanUrl = url.trim();
    let hostname = cleanUrl;
    try {
      hostname = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`).hostname;
    } catch {}

    const id = `ev-${Date.now()}`;

    return {
      evidenceId: id,
      type: "url",
      evidence: {
        id,
        type: "url",
        title: hostname,
        url: cleanUrl,
        createdAt: new Date().toISOString()
      },
      extracted: {
        detectedUrls: [cleanUrl],
        timestamp: new Date().toISOString()
      }
    };
  }

  createRawMessageEvidence(text: string): EvidenceUploadResponse {
    const id = `ev-${Date.now()}`;
    return {
      evidenceId: id,
      type: "message",
      evidence: {
        id,
        type: "message",
        title: text.slice(0, 36) + "...",
        rawText: text,
        createdAt: new Date().toISOString()
      },
      extracted: {
        ocrText: text,
        timestamp: new Date().toISOString()
      }
    };
  }

  async getConversations(): Promise<Conversation[]> {
    if (USE_MOCK) {
      return mockApiClient.getConversations();
    }

    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        const { data, error } = await supabase
          .from("chat_conversations")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          const serverConvs: Conversation[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            evidence: row.evidence_payload || { 
              id: row.id, 
              type: row.evidence_type || "message", 
              title: row.title, 
              createdAt: row.created_at 
            },
            messages: Array.isArray(row.messages) ? row.messages : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));

          const serverIds = new Set(serverConvs.map((c) => c.id));
          const localConvs = this.getLocalConversations(userId);

          // Safely migrate pending local conversations for this account
          const newlyMigrated = await this.migrateLocalConversationsToSupabase(userId, serverIds);

          // Keep track of any local conversations not confirmed on the server (e.g. migration failed or skipped)
          const unmigratedLocal = localConvs.filter((c) => !serverIds.has(c.id));

          // Merge: server records are primary for synced data, but unmigrated local records
          // are preserved and NEVER overwritten or erased by an empty server response.
          const convMap = new Map<string, Conversation>();

          for (const conv of serverConvs) {
            convMap.set(conv.id, conv);
          }
          for (const conv of newlyMigrated) {
            if (!convMap.has(conv.id)) {
              convMap.set(conv.id, conv);
            }
          }
          for (const conv of unmigratedLocal) {
            if (!convMap.has(conv.id)) {
              convMap.set(conv.id, conv);
            }
          }

          const allConvs = Array.from(convMap.values());
          allConvs.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          );

          this.saveLocalConversations(allConvs, userId);
          return allConvs;
        } else if (error) {
          console.warn("[Paylume Sync] Supabase query returned error, falling back to local storage:", error.message);
        }
      } catch (err) {
        console.warn("[Paylume Sync] Error contacting Supabase, using local cache:", err);
      }
    }

    // Unauthenticated or offline fallback
    return this.getLocalConversations(userId);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    if (USE_MOCK) {
      return mockApiClient.getConversation(id);
    }

    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        const { data, error } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) {
          const conv: Conversation = {
            id: data.id,
            title: data.title,
            evidence: data.evidence_payload || { 
              id: data.id, 
              type: data.evidence_type || "message", 
              title: data.title, 
              createdAt: data.created_at 
            },
            messages: Array.isArray(data.messages) ? data.messages : [],
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
          return conv;
        }
      } catch (e) {
        console.warn("[Paylume Sync] Error fetching single conversation from Supabase:", e);
      }
    }

    // Fallback to local storage
    const convs = this.getLocalConversations(userId);
    const found = convs.find((c) => c.id === id);
    if (found) return found;

    // Fallback: If requesting a verified preloaded test case, seed it to local store
    const sample = MOCK_PRELOADED_CONVERSATIONS.find((c) => c.id === id);
    if (sample) {
      const cloned: Conversation = JSON.parse(JSON.stringify(sample));
      convs.unshift(cloned);
      this.saveLocalConversations(convs, userId);
      return cloned;
    }

    return null;
  }

  loadSampleConversation(type: "qr" | "url" | "message" | "screenshot"): Conversation | null {
    const sample = MOCK_PRELOADED_CONVERSATIONS.find((c) => c.evidence?.type === type);
    if (!sample) return null;
    const convs = this.getLocalConversations();
    const existing = convs.find((c) => c.id === sample.id);
    if (existing) return existing;

    const cloned: Conversation = JSON.parse(JSON.stringify(sample));
    convs.unshift(cloned);
    this.saveLocalConversations(convs);
    return cloned;
  }

  async createConversation(req: CreateConversationRequest): Promise<CreateConversationResponse> {
    if (USE_MOCK) {
      return mockApiClient.createConversation(req);
    }

    const id = `conv-${Date.now()}`;
    const title = req.title || "New Payment Investigation";
    const defaultEvidence: EvidencePayload = req.evidencePayload || {
      id: req.evidenceId || `ev-${Date.now()}`,
      type: "message",
      title,
      rawText: "",
      createdAt: new Date().toISOString()
    };

    const newConv: Conversation = {
      id,
      title,
      evidence: defaultEvidence,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        const { error } = await supabase.from("chat_conversations").insert({
          id,
          user_id: userId,
          title,
          evidence_type: defaultEvidence.type || "message",
          evidence_payload: this.sanitizeEvidenceForDb(defaultEvidence),
          messages: [],
          created_at: newConv.createdAt,
          updated_at: newConv.updatedAt
        });
        if (error) {
          console.warn("[Paylume Sync] Error creating conversation in Supabase:", error.message);
        }
      } catch (err) {
        console.warn("[Paylume Sync] Exception inserting conversation to Supabase:", err);
      }
    }

    const convs = this.getLocalConversations(userId);
    convs.unshift(newConv);
    this.saveLocalConversations(convs, userId);

    return {
      conversationId: id,
      conversation: newConv
    };
  }

  async updateConversationMessages(id: string, messages: Message[]): Promise<void> {
    const updatedAt = new Date().toISOString();

    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        const { error } = await supabase
          .from("chat_conversations")
          .update({
            messages,
            updated_at: updatedAt
          })
          .eq("id", id);

        if (error) {
          console.warn("[Paylume Sync] Error updating messages in Supabase:", error.message);
        }
      } catch (err) {
        console.warn("[Paylume Sync] Exception updating messages in Supabase:", err);
      }
    }

    const convs = this.getLocalConversations(userId);
    const idx = convs.findIndex((c) => c.id === id);
    if (idx !== -1) {
      convs[idx].messages = messages;
      convs[idx].updatedAt = updatedAt;
      this.saveLocalConversations(convs, userId);
    }
  }

  /**
   * Persists the user's submitted message to the database and local cache before AI streaming starts.
   * Ensures the message is never lost on network disconnect, abort, or downstream failure.
   */
  async appendUserMessage(
    conversationId: string,
    userMessage: Message
  ): Promise<{ persistedToServer: boolean; error?: string }> {
    let persistedToServer = false;
    let serverError: string | undefined;

    const userId = await this.getCurrentUserId();
    const conv = await this.getConversation(conversationId);
    const existingMessages = conv?.messages ? [...conv.messages] : [];

    const alreadyExists = existingMessages.some(
      (m) =>
        m.id === userMessage.id ||
        (m.role === "user" &&
          m.content === userMessage.content &&
          Math.abs(new Date(m.createdAt).getTime() - new Date(userMessage.createdAt).getTime()) < 5000)
    );

    const updatedMessages = alreadyExists ? existingMessages : [...existingMessages, userMessage];
    const updatedAt = new Date().toISOString();

    if (userId) {
      try {
        const { error } = await supabase
          .from("chat_conversations")
          .update({
            messages: updatedMessages,
            updated_at: updatedAt
          })
          .eq("id", conversationId);

        if (!error) {
          persistedToServer = true;
        } else {
          serverError = error.message;
          console.warn(`[Paylume Sync] Error saving user message to Supabase (${conversationId}):`, error.message);
        }
      } catch (err: any) {
        serverError = err?.message || "Network error";
        console.warn(`[Paylume Sync] Exception saving user message to Supabase (${conversationId}):`, err);
      }
    }

    // Always update local cache so the message is recoverable even if server update fails
    const convs = this.getLocalConversations(userId);
    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx !== -1) {
      convs[idx].messages = updatedMessages;
      convs[idx].updatedAt = updatedAt;
      this.saveLocalConversations(convs, userId);
    }

    return { persistedToServer, error: serverError };
  }

  /**
   * Appends and persists the completed (or partial) assistant message without race conditions or duplicates.
   */
  async appendAssistantMessage(
    conversationId: string,
    assistantMessage: Message
  ): Promise<{ persistedToServer: boolean; error?: string }> {
    let persistedToServer = false;
    let serverError: string | undefined;

    const userId = await this.getCurrentUserId();
    const conv = await this.getConversation(conversationId);
    const existingMessages = conv?.messages ? [...conv.messages] : [];

    const alreadyExists = existingMessages.some((m) => m.id === assistantMessage.id);
    const updatedMessages = alreadyExists ? existingMessages : [...existingMessages, assistantMessage];
    const updatedAt = new Date().toISOString();

    if (userId) {
      try {
        const { error } = await supabase
          .from("chat_conversations")
          .update({
            messages: updatedMessages,
            updated_at: updatedAt
          })
          .eq("id", conversationId);

        if (!error) {
          persistedToServer = true;
        } else {
          serverError = error.message;
          console.warn(`[Paylume Sync] Error saving assistant message to Supabase (${conversationId}):`, error.message);
        }
      } catch (err: any) {
        serverError = err?.message || "Network error";
        console.warn(`[Paylume Sync] Exception saving assistant message to Supabase (${conversationId}):`, err);
      }
    }

    // Always update local cache
    const convs = this.getLocalConversations(userId);
    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx !== -1) {
      convs[idx].messages = updatedMessages;
      convs[idx].updatedAt = updatedAt;
      this.saveLocalConversations(convs, userId);
    }

    return { persistedToServer, error: serverError };
  }

  /**
   * Retrieves unscoped legacy conversations from browser storage.
   */
  getLegacyConversations(): Conversation[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Checks whether there are unimported legacy conversations waiting in local storage
   * that haven't been imported into or dismissed by the current account.
   */
  hasUnimportedLegacyConversations(userId?: string | null): boolean {
    if (typeof window === "undefined" || !userId) return false;
    try {
      const dismissedOrImported = localStorage.getItem(`paylume_legacy_resolved_${userId}`);
      if (dismissedOrImported === "true") return false;

      const legacy = this.getLegacyConversations();
      return Array.isArray(legacy) && legacy.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Allows the user to dismiss the legacy import prompt for their account.
   */
  dismissLegacyImport(userId: string): void {
    if (typeof window === "undefined" || !userId) return;
    try {
      localStorage.setItem(`paylume_legacy_resolved_${userId}`, "true");
    } catch {}
  }

  /**
   * Explicit user-approved import of legacy browser conversations into the currently signed-in account.
   * Uploads each conversation with ignoreDuplicates: true and merges into account-scoped store.
   * Does not delete legacy data until explicitly requested.
   */
  async importLegacyConversationsToAccount(
    userId: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (typeof window === "undefined" || !userId) {
      return { success: false, count: 0, error: "Invalid user session" };
    }

    const legacy = this.getLegacyConversations();
    if (!legacy || legacy.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      let successfullyPersisted = 0;
      const localUserConvs = this.getLocalConversations(userId);
      const localUserIds = new Set(localUserConvs.map((c) => c.id));
      const toMergeLocally: Conversation[] = [];

      for (const conv of legacy) {
        const payload = {
          id: conv.id,
          user_id: userId,
          title: conv.title || "Imported Payment Investigation",
          evidence_type: conv.evidence?.type || "message",
          evidence_payload: this.sanitizeEvidenceForDb(conv.evidence),
          messages: Array.isArray(conv.messages) ? conv.messages : [],
          created_at: conv.createdAt || new Date().toISOString(),
          updated_at: conv.updatedAt || new Date().toISOString()
        };

        const { error } = await supabase
          .from("chat_conversations")
          .upsert(payload, { onConflict: "id", ignoreDuplicates: true });

        if (!error) {
          successfullyPersisted++;
        } else {
          console.warn(`[Paylume Sync] Legacy import notice for ${conv.id}:`, error.message);
        }

        if (!localUserIds.has(conv.id)) {
          toMergeLocally.push(conv);
          localUserIds.add(conv.id);
        }
      }

      // Merge into current user's local store
      const merged = [...toMergeLocally, ...localUserConvs];
      merged.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
      this.saveLocalConversations(merged, userId);

      // Mark legacy import as resolved for this account
      localStorage.setItem(`paylume_legacy_resolved_${userId}`, "true");

      return { success: true, count: successfullyPersisted };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message || "Failed to import legacy history" };
    }
  }

  async deleteConversation(id: string): Promise<void> {
    if (USE_MOCK) {
      return mockApiClient.deleteConversation(id);
    }

    const userId = await this.getCurrentUserId();
    if (userId) {
      try {
        const { error } = await supabase
          .from("chat_conversations")
          .delete()
          .eq("id", id);

        if (error) {
          console.warn("[Paylume Sync] Error deleting conversation from Supabase:", error.message);
        }
      } catch (err) {
        console.warn("[Paylume Sync] Exception deleting conversation from Supabase:", err);
      }
    }

    const convs = this.getLocalConversations(userId).filter((c) => c.id !== id);
    this.saveLocalConversations(convs, userId);
  }

  /**
   * Main chat connection to real FastAPI POST /api/chat endpoint
   */
  async chat(params: SendChatParams): Promise<ChatApiResponse> {
    const formData = new FormData();
    formData.append("question", params.question);
    
    if (params.url && typeof params.url === "string" && params.url.trim() && params.url !== "undefined" && params.url !== "null") {
      formData.append("url", params.url.trim());
    }
    if (params.image && params.image instanceof Blob && params.image.size > 0) {
      formData.append("image", params.image);
    }
    if (params.conversationHistory && Array.isArray(params.conversationHistory) && params.conversationHistory.length > 0) {
      formData.append("conversation_history", JSON.stringify(params.conversationHistory));
    }

    // Attach verified Supabase JWT access token
    const headers: Record<string, string> = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      console.warn("Could not retrieve Supabase session token:", e);
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers,
        body: formData,
        signal: params.signal
      });
    } catch (netErr: any) {
      if (netErr?.name === "AbortError") {
        throw netErr;
      }
      const isLocalhost = API_URL.includes("localhost") || API_URL.includes("127.0.0.1");
      if (isLocalhost && typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
        throw new Error(
          `Unable to reach backend API at ${API_URL}. The frontend is running in production, but NEXT_PUBLIC_API_URL is still pointing to localhost. Please set NEXT_PUBLIC_API_URL in your hosting service (Render) to your deployed FastAPI backend URL.`
        );
      }
      throw new Error(`Unable to reach backend API at ${API_URL}. Please verify the backend service is running and accessible.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Your session is unauthenticated or has expired. Please sign in to continue.");
      }
      const err = await res.json().catch(() => ({ detail: "Chat request failed" }));
      throw new Error(err.detail || `Backend error: HTTP ${res.status}`);
    }

    return res.json();
  }

  // Backward compatibility wrapper for existing streamMessage call signature
  async streamMessage(
    conversationId: string,
    question: string,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (USE_MOCK) {
      return mockApiClient.streamMessage(conversationId, question, onEvent, signal);
    }

    const isConv = isConversationalMessage(question);

    if (isConv) {
      onEvent({ type: "status", data: { step: "generating", message: "Responding..." } });
    } else {
      onEvent({ type: "status", data: { step: "retrieving", message: "Analyzing evidence with Gemini & consulting RAG knowledge..." } });
    }

    const conv = await this.getConversation(conversationId);

    let history = (conv?.messages || []).map((m) => ({
      role: m.role,
      content: m.content || ""
    }));

    // If the latest message in history matches the current user question (persisted right before streaming),
    // exclude it from previous history turns so it isn't repeated to Gemini as both history and current prompt.
    if (
      history.length > 0 &&
      history[history.length - 1].role === "user" &&
      history[history.length - 1].content === question
    ) {
      history = history.slice(0, -1);
    }

    // Forward attached text evidence to backend ONLY if not a simple conversational remark
    let promptQuestion = question;
    if (!isConv && conv?.evidence?.rawText && !question.includes(conv.evidence.rawText.slice(0, 30))) {
      promptQuestion = `[Attached Message Evidence]:\n${conv.evidence.rawText}\n\n[User Question]:\n${question}`;
    }

    let targetUrl = !isConv ? conv?.evidence?.url : undefined;
    if (!targetUrl && !isConv) {
      const urlMatch = (conv?.evidence?.rawText || question).match(/https?:\/\/[^\s<>"\')]+/i);
      if (urlMatch) {
        targetUrl = urlMatch[0];
      }
    }
    
    // Safely resolve image: either in-memory Blob/File or restored from data: URL
    let targetImage: Blob | undefined = undefined;
    if (!isConv) {
      if (conv?.evidence?.rawFile instanceof Blob && conv.evidence.rawFile.size > 0) {
        targetImage = conv.evidence.rawFile;
      } else if (conv?.evidence?.previewUrl && typeof conv.evidence.previewUrl === "string" && conv.evidence.previewUrl.startsWith("data:image/")) {
        const restored = dataUriToBlob(conv.evidence.previewUrl);
        if (restored) {
          targetImage = restored;
        }
      }
    }

    const res = await this.chat({
      question: promptQuestion,
      url: targetUrl,
      image: targetImage,
      conversationHistory: history,
      signal
    });

    // Stream the citations (only for actual security analysis)
    if (!isConv && res.sources && res.sources.length > 0) {
      res.sources.forEach((s, idx) => {
        onEvent({
          type: "citation",
          data: {
            id: idx + 1,
            title: s.title,
            source: s.source,
            category: s.category,
            url: s.url || "",
            snippet: s.snippet || ""
          }
        });
      });
    }

    // Stream detected security evidence indicators (only for actual security analysis)
    const detectedEvidence = isConv ? [] : (res.security_evidence || res.metadata?.security_evidence || []);
    if (!isConv) {
      onEvent({
        type: "evidence",
        data: detectedEvidence
      });
    }

    // Stream tokens of the direct answer
    onEvent({
      type: "token",
      data: {
        delta: res.answer
      }
    });

    // Save finalized assistant message
    const botMessageId = `msg-bot-${Date.now()}`;
    const asstMessage: Message = {
      id: botMessageId,
      conversationId,
      role: "assistant",
      content: res.answer,
      citations: (res.sources || []).map((s, idx) => ({
        id: idx + 1,
        title: s.title,
        source: s.source,
        category: s.category,
        url: s.url || "",
        snippet: s.snippet || ""
      })),
      securityEvidence: detectedEvidence,
      createdAt: new Date().toISOString()
    };

    await this.appendAssistantMessage(conversationId, asstMessage);

    onEvent({ 
      type: "done", 
      data: { 
        messageId: botMessageId,
        message: asstMessage
      } 
    });
  }

  /**
   * Sends recorded audio blob to backend ElevenLabs Speech-to-Text endpoint.
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    const filename = audioBlob.type.includes("wav") ? "recording.wav" : "recording.webm";
    formData.append("file", audioBlob, filename);

    const headers: Record<string, string> = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      console.warn("Could not retrieve Supabase session token:", e);
    }

    const res = await fetch(`${API_URL}/api/voice/transcribe`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Your session is unauthenticated or has expired. Please sign in to use voice transcription.");
      }
      const err = await res.json().catch(() => ({ detail: "Transcription failed" }));
      throw new Error(err.detail || `Voice transcription error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.text || "";
  }
}

export const apiClient = new ApiClient();
