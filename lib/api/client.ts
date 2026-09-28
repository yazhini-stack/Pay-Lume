import { mockApiClient } from "./mock/mock-client";
import { 
  EvidenceUploadResponse, 
  CreateConversationRequest, 
  CreateConversationResponse, 
  SSEEvent 
} from "@/types/api";
import { Conversation, Message } from "@/types/chat";
import { EvidencePayload } from "@/types/evidence";
import { supabase } from "@/lib/supabase/client";

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
  private getLocalConversations(): Conversation[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalConversations(convs: Conversation[]) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
    } catch (e) {
      console.warn("Could not persist conversation to localStorage:", e);
    }
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
    return this.getLocalConversations();
  }

  async getConversation(id: string): Promise<Conversation | null> {
    if (USE_MOCK) {
      return mockApiClient.getConversation(id);
    }
    const convs = this.getLocalConversations();
    return convs.find((c) => c.id === id) || null;
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

    const convs = this.getLocalConversations();
    convs.unshift(newConv);
    this.saveLocalConversations(convs);

    return {
      conversationId: id,
      conversation: newConv
    };
  }

  async updateConversationMessages(id: string, messages: Message[]): Promise<void> {
    const convs = this.getLocalConversations();
    const idx = convs.findIndex((c) => c.id === id);
    if (idx !== -1) {
      convs[idx].messages = messages;
      convs[idx].updatedAt = new Date().toISOString();
      this.saveLocalConversations(convs);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    if (USE_MOCK) {
      return mockApiClient.deleteConversation(id);
    }
    const convs = this.getLocalConversations().filter((c) => c.id !== id);
    this.saveLocalConversations(convs);
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

    onEvent({ type: "status", data: { step: "retrieving", message: "Analyzing evidence with Gemini & consulting RAG knowledge..." } });

    const convs = this.getLocalConversations();
    const conv = convs.find((c) => c.id === conversationId);

    const history = (conv?.messages || []).map((m) => ({
      role: m.role,
      content: m.content || ""
    }));

    const targetUrl = conv?.evidence?.url;
    
    // Safely resolve image: either in-memory Blob/File or restored from data: URL
    let targetImage: Blob | undefined = undefined;
    if (conv?.evidence?.rawFile instanceof Blob && conv.evidence.rawFile.size > 0) {
      targetImage = conv.evidence.rawFile;
    } else if (conv?.evidence?.previewUrl && typeof conv.evidence.previewUrl === "string" && conv.evidence.previewUrl.startsWith("data:image/")) {
      const restored = dataUriToBlob(conv.evidence.previewUrl);
      if (restored) {
        targetImage = restored;
      }
    }

    const res = await this.chat({
      question,
      url: targetUrl,
      image: targetImage,
      conversationHistory: history,
      signal
    });

    // Stream the citations
    if (res.sources && res.sources.length > 0) {
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

    // Stream detected security evidence indicators
    const detectedEvidence = res.security_evidence || res.metadata?.security_evidence || [];
    if (detectedEvidence.length > 0) {
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

    // Save updated messages into local conversation
    const updatedMessages: Message[] = [
      ...(conv?.messages || []),
      {
        id: `msg-user-${Date.now() - 1}`,
        conversationId,
        role: "user",
        content: question,
        createdAt: new Date().toISOString()
      },
      {
        id: `msg-bot-${Date.now()}`,
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
      }
    ];
    await this.updateConversationMessages(conversationId, updatedMessages);

    onEvent({ type: "done", data: { messageId: `msg-bot-${Date.now()}` } });
  }
}

export const apiClient = new ApiClient();
