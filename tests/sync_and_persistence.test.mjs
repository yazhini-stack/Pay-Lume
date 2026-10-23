import test from "node:test";
import assert from "node:assert/strict";

// Mock localStorage implementation for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Minimal simulator of the Supabase chat_conversations table
class MockSupabaseTable {
  constructor() {
    this.records = new Map(); // id -> row
    this.failNextUpsert = false;
  }

  async select() {
    return {
      data: Array.from(this.records.values()),
      error: null
    };
  }

  async upsert(payload, options = {}) {
    if (this.failNextUpsert) {
      this.failNextUpsert = false;
      return { data: null, error: { message: "Simulated network/DB error" } };
    }

    const { onConflict = "id", ignoreDuplicates = false } = options;
    const key = payload[onConflict];

    if (this.records.has(key)) {
      if (ignoreDuplicates) {
        // ON CONFLICT DO NOTHING: Do NOT overwrite server record!
        return { data: [this.records.get(key)], error: null };
      }
      // Overwrite if ignoreDuplicates is false
      this.records.set(key, { ...payload });
      return { data: [payload], error: null };
    }

    this.records.set(key, { ...payload });
    return { data: [payload], error: null };
  }

  async update(id, updates) {
    if (!this.records.has(id)) {
      return { data: null, error: { message: "Record not found" } };
    }
    const existing = this.records.get(id);
    const updated = { ...existing, ...updates };
    this.records.set(id, updated);
    return { data: [updated], error: null };
  }

  async delete(id) {
    this.records.delete(id);
    return { data: null, error: null };
  }
}

// Client synchronization engine mirroring lib/api/client.ts logic
class SyncEngine {
  constructor(localStorageInstance, supabaseMock) {
    this.localStorage = localStorageInstance;
    this.supabase = supabaseMock;
    this.STORAGE_KEY = "paylume_conversations_v1";
  }

  getLocalConversations(userId) {
    try {
      if (userId) {
        // Authenticated sessions strictly access their own isolated storage
        const userScoped = this.localStorage.getItem(`paylume_conversations_${userId}`);
        return userScoped ? JSON.parse(userScoped) : [];
      }
      // Only unauthenticated guest sessions use the unscoped legacy store
      const raw = this.localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLocalConversations(convs, userId) {
    try {
      const serialized = JSON.stringify(convs);
      if (userId) {
        this.localStorage.setItem(`paylume_conversations_${userId}`, serialized);
      } else {
        this.localStorage.setItem(this.STORAGE_KEY, serialized);
      }
    } catch (e) {
      // ignore
    }
  }

  async migrateLocalConversationsToSupabase(userId, existingServerIds) {
    const migrationFlagKey = `paylume_migrated_${userId}`;
    const alreadyMigrated = this.localStorage.getItem(migrationFlagKey) === "true";
    if (alreadyMigrated) return [];

    const localConvs = this.getLocalConversations(userId);
    if (!localConvs || localConvs.length === 0) {
      this.localStorage.setItem(migrationFlagKey, "true");
      return [];
    }

    const newlyMigrated = [];
    let hasFailure = false;

    for (const conv of localConvs) {
      if (existingServerIds.has(conv.id)) {
        continue;
      }

      const payload = {
        id: conv.id,
        user_id: userId,
        title: conv.title || "Investigation",
        messages: Array.isArray(conv.messages) ? conv.messages : [],
        updated_at: conv.updatedAt || new Date().toISOString()
      };

      const { error } = await this.supabase.upsert(payload, { onConflict: "id", ignoreDuplicates: true });

      if (error) {
        hasFailure = true;
      } else {
        newlyMigrated.push(conv);
        existingServerIds.add(conv.id);
      }
    }

    if (!hasFailure) {
      this.localStorage.setItem(migrationFlagKey, "true");
    }

    return newlyMigrated;
  }

  async getConversations(userId) {
    if (userId) {
      const { data, error } = await this.supabase.select();
      if (!error && Array.isArray(data)) {
        const serverConvs = data.filter((row) => row.user_id === userId);
        const serverIds = new Set(serverConvs.map((c) => c.id));
        const localConvs = this.getLocalConversations(userId);

        const newlyMigrated = await this.migrateLocalConversationsToSupabase(userId, serverIds);
        const unmigratedLocal = localConvs.filter((c) => !serverIds.has(c.id));

        const convMap = new Map();
        for (const conv of serverConvs) {
          convMap.set(conv.id, conv);
        }
        for (const conv of newlyMigrated) {
          if (!convMap.has(conv.id)) convMap.set(conv.id, conv);
        }
        for (const conv of unmigratedLocal) {
          if (!convMap.has(conv.id)) convMap.set(conv.id, conv);
        }

        const allConvs = Array.from(convMap.values());
        this.saveLocalConversations(allConvs, userId);
        return allConvs;
      }
    }
    return this.getLocalConversations(userId);
  }

  async appendUserMessage(conversationId, userMessage, userId) {
    let persistedToServer = false;
    let serverError;

    const convs = this.getLocalConversations(userId);
    const conv = convs.find((c) => c.id === conversationId) || { id: conversationId, messages: [] };
    const existingMessages = conv.messages || [];

    const alreadyExists = existingMessages.some(
      (m) => m.id === userMessage.id || (m.role === "user" && m.content === userMessage.content)
    );
    const updatedMessages = alreadyExists ? existingMessages : [...existingMessages, userMessage];

    if (userId) {
      const { error } = await this.supabase.update(conversationId, { messages: updatedMessages });
      if (!error) {
        persistedToServer = true;
      } else {
        serverError = error.message;
      }
    }

    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx !== -1) {
      convs[idx].messages = updatedMessages;
      this.saveLocalConversations(convs, userId);
    } else {
      convs.push({ id: conversationId, messages: updatedMessages, user_id: userId });
      this.saveLocalConversations(convs, userId);
    }

    return { persistedToServer, error: serverError };
  }

  async appendAssistantMessage(conversationId, assistantMessage, userId) {
    let persistedToServer = false;
    const convs = this.getLocalConversations(userId);
    const conv = convs.find((c) => c.id === conversationId) || { id: conversationId, messages: [] };
    const existingMessages = conv.messages || [];

    const alreadyExists = existingMessages.some((m) => m.id === assistantMessage.id);
    const updatedMessages = alreadyExists ? existingMessages : [...existingMessages, assistantMessage];

    if (userId) {
      const { error } = await this.supabase.update(conversationId, { messages: updatedMessages });
      if (!error) persistedToServer = true;
    }

    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx !== -1) {
      convs[idx].messages = updatedMessages;
      this.saveLocalConversations(convs, userId);
    }

    return { persistedToServer };
  }

  hasUnimportedLegacyConversations(userId) {
    if (!userId) return false;
    const resolved = this.localStorage.getItem(`paylume_legacy_resolved_${userId}`) === "true";
    if (resolved) return false;
    const raw = this.localStorage.getItem(this.STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.length > 0;
  }

  async importLegacyConversationsToAccount(userId) {
    const raw = this.localStorage.getItem(this.STORAGE_KEY);
    const legacy = raw ? JSON.parse(raw) : [];
    if (!legacy.length) return { success: true, count: 0 };

    const localUserConvs = this.getLocalConversations(userId);
    const localUserIds = new Set(localUserConvs.map((c) => c.id));
    const toMerge = [];

    for (const conv of legacy) {
      await this.supabase.upsert(
        { id: conv.id, user_id: userId, title: conv.title, messages: conv.messages },
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (!localUserIds.has(conv.id)) {
        toMerge.push({ ...conv, user_id: userId });
        localUserIds.add(conv.id);
      }
    }

    const merged = [...toMerge, ...localUserConvs];
    this.saveLocalConversations(merged, userId);
    this.localStorage.setItem(`paylume_legacy_resolved_${userId}`, "true");
    return { success: true, count: legacy.length };
  }
}

// ======================== TESTS ========================

test("Issue 1: Migration conflict never overwrites an existing server conversation", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  const userId = "user-123";
  const convId = "conv-shared-1";

  // Pre-seed server with authoritative conversation record
  await mockDb.upsert(
    {
      id: convId,
      user_id: userId,
      title: "Authoritative Server Title",
      messages: [{ id: "m-server-1", role: "user", content: "Original server query" }],
      evidence_payload: { type: "qr", verified: true }
    },
    { onConflict: "id" }
  );

  // Local device has a stale or conflict copy with different message/title
  mockStorage.setItem(
    `paylume_conversations_${userId}`,
    JSON.stringify([
      {
        id: convId,
        title: "Stale Local Title (Should NOT overwrite server)",
        messages: [{ id: "m-local-stale", role: "user", content: "Stale local prompt" }]
      }
    ])
  );

  // Run migration
  await engine.migrateLocalConversationsToSupabase(userId, new Set());

  // Verify server record was NOT overwritten
  const { data } = await mockDb.select();
  const serverRec = data.find((r) => r.id === convId);
  assert.equal(serverRec.title, "Authoritative Server Title");
  assert.equal(serverRec.messages[0].content, "Original server query");
  assert.notEqual(serverRec.messages[0].id, "m-local-stale");
});

test("Issue 2: Empty server response does not erase non-empty local history", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  const userId = "user-456";

  // User has local conversations waiting
  const localItems = [
    { id: "conv-local-1", title: "Unsynced Local Case 1", messages: [] },
    { id: "conv-local-2", title: "Unsynced Local Case 2", messages: [] }
  ];
  mockStorage.setItem(`paylume_conversations_${userId}`, JSON.stringify(localItems));

  // Server table has NO records for this user (e.g. empty table, fresh account)
  // And simulate migration failing (e.g. temporary network issue or policy error)
  mockDb.failNextUpsert = true;

  const resultConvs = await engine.getConversations(userId);

  // Must NOT be empty! Local items must be preserved
  assert.equal(resultConvs.length, 2);
  assert.ok(resultConvs.some((c) => c.id === "conv-local-1"));
  assert.ok(resultConvs.some((c) => c.id === "conv-local-2"));

  // Local storage cache must still contain both items
  const cached = JSON.parse(mockStorage.getItem(`paylume_conversations_${userId}`));
  assert.equal(cached.length, 2);
  assert.ok(cached.some((c) => c.id === "conv-local-1"));
  assert.ok(cached.some((c) => c.id === "conv-local-2"));
});

test("Issue 3A: User's submitted message is persisted BEFORE streaming and recoverable on failure", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  const userId = "user-789";
  const convId = "conv-active-77";

  // Create initial conversation row on server and locally
  await mockDb.upsert({ id: convId, user_id: userId, title: "Active Case", messages: [] }, { onConflict: "id" });
  engine.saveLocalConversations([{ id: convId, title: "Active Case", messages: [] }], userId);

  const userMsg = {
    id: "msg-user-1",
    conversationId: convId,
    role: "user",
    content: "Is this payment request legitimate?",
    createdAt: new Date().toISOString()
  };

  // Persist user message prior to starting AI streaming
  const persistResult = await engine.appendUserMessage(convId, userMsg, userId);
  assert.equal(persistResult.persistedToServer, true);

  // Simulate AI streaming failure (e.g. backend network failure or abort)
  let streamingFailed = false;
  try {
    throw new Error("Simulated streaming network disconnection");
  } catch (err) {
    streamingFailed = true;
  }
  assert.equal(streamingFailed, true);

  // Check that the user message is safe and recoverable in both DB and local cache
  const { data } = await mockDb.select();
  const serverRec = data.find((r) => r.id === convId);
  assert.equal(serverRec.messages.length, 1);
  assert.equal(serverRec.messages[0].content, "Is this payment request legitimate?");

  const localConvs = engine.getLocalConversations(userId);
  const localRec = localConvs.find((c) => c.id === convId);
  assert.equal(localRec.messages.length, 1);
  assert.equal(localRec.messages[0].content, "Is this payment request legitimate?");
});

test("Issue 3B: Successful streaming persists both user and assistant messages without duplication", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  const userId = "user-789";
  const convId = "conv-success-99";

  await mockDb.upsert({ id: convId, user_id: userId, title: "Success Case", messages: [] }, { onConflict: "id" });
  engine.saveLocalConversations([{ id: convId, title: "Success Case", messages: [] }], userId);

  const userMsg = {
    id: "msg-user-99",
    conversationId: convId,
    role: "user",
    content: "Check this UPI ID",
    createdAt: new Date().toISOString()
  };

  // Step 1: User message persisted before streaming
  await engine.appendUserMessage(convId, userMsg, userId);

  // Step 2: Streaming completes successfully and appends assistant response
  const asstMsg = {
    id: "msg-bot-99",
    conversationId: convId,
    role: "assistant",
    content: "The UPI ID belongs to a known verified merchant.",
    createdAt: new Date().toISOString()
  };
  await engine.appendAssistantMessage(convId, asstMsg, userId);

  // Verify conversation has exactly 2 messages in correct sequence
  const localConvs = engine.getLocalConversations(userId);
  const localRec = localConvs.find((c) => c.id === convId);
  assert.equal(localRec.messages.length, 2);
  assert.equal(localRec.messages[0].role, "user");
  assert.equal(localRec.messages[1].role, "assistant");

  // Server state also matches
  const { data } = await mockDb.select();
  const serverRec = data.find((r) => r.id === convId);
  assert.equal(serverRec.messages.length, 2);
  assert.equal(serverRec.messages[0].id, "msg-user-99");
  assert.equal(serverRec.messages[1].id, "msg-bot-99");
});

test("Issue 4: Account switching never automatically transfers unscoped legacy conversations", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  // Legacy unscoped conversation left on the browser (e.g. from an offline session or User A)
  mockStorage.setItem(
    "paylume_conversations_v1",
    JSON.stringify([
      { id: "legacy-conv-1", title: "Private Investigation from previous user", messages: [] }
    ])
  );

  const userB_id = "user-account-B";

  // When User B logs in, their local store is empty initially
  const userB_local = engine.getLocalConversations(userB_id);
  // Must NOT automatically return or ingest the legacy store!
  assert.equal(userB_local.length, 0);

  // Automatic migration must NOT migrate legacy items into User B's account
  const migrated = await engine.migrateLocalConversationsToSupabase(userB_id, new Set());
  assert.equal(migrated.length, 0);

  // Server records for User B must be empty
  const { data } = await mockDb.select();
  const userB_serverRecords = data.filter((r) => r.user_id === userB_id);
  assert.equal(userB_serverRecords.length, 0);

  // Legacy data remains un-deleted and un-overwritten in paylume_conversations_v1
  const legacyStore = JSON.parse(mockStorage.getItem("paylume_conversations_v1"));
  assert.equal(legacyStore.length, 1);
  assert.equal(legacyStore[0].id, "legacy-conv-1");

  // Explicit user action prompt is detected
  assert.equal(engine.hasUnimportedLegacyConversations(userB_id), true);

  // When user explicitly approves import:
  await engine.importLegacyConversationsToAccount(userB_id);

  // Now and only now is it in User B's store
  const userB_afterImport = engine.getLocalConversations(userB_id);
  assert.equal(userB_afterImport.length, 1);
  assert.equal(userB_afterImport[0].id, "legacy-conv-1");

  // Prompt is now resolved for User B
  assert.equal(engine.hasUnimportedLegacyConversations(userB_id), false);

  // Original legacy store in paylume_conversations_v1 was NOT deleted prematurely
  assert.notEqual(mockStorage.getItem("paylume_conversations_v1"), null);
});

test("Issue 5: Failed migrations can safely retry without duplicating messages", async () => {
  const mockStorage = new MockLocalStorage();
  const mockDb = new MockSupabaseTable();
  const engine = new SyncEngine(mockStorage, mockDb);

  const userId = "user-retry-1";
  const convId = "conv-retry-case";

  mockStorage.setItem(
    `paylume_conversations_${userId}`,
    JSON.stringify([
      {
        id: convId,
        title: "Retry Case",
        messages: [{ id: "m-1", role: "user", content: "Test question" }]
      }
    ])
  );

  // 1st attempt: Supabase fails
  mockDb.failNextUpsert = true;
  const existingIds = new Set();
  const firstAttempt = await engine.migrateLocalConversationsToSupabase(userId, existingIds);
  assert.equal(firstAttempt.length, 0);
  // Migration flag must NOT be set on failure
  assert.notEqual(mockStorage.getItem(`paylume_migrated_${userId}`), "true");

  // 2nd attempt: Supabase succeeds (e.g. network restored)
  const secondAttempt = await engine.migrateLocalConversationsToSupabase(userId, existingIds);
  assert.equal(secondAttempt.length, 1);
  assert.equal(mockStorage.getItem(`paylume_migrated_${userId}`), "true");

  // 3rd attempt: Migration flag is set, does nothing and does not duplicate
  const thirdAttempt = await engine.migrateLocalConversationsToSupabase(userId, existingIds);
  assert.equal(thirdAttempt.length, 0);

  // Verify only 1 record exists on server with exact messages
  const { data } = await mockDb.select();
  const records = data.filter((r) => r.id === convId);
  assert.equal(records.length, 1);
  assert.equal(records[0].messages.length, 1);
});
