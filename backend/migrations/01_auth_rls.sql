-- ==============================================================================
-- Paylume Authentication & User Data Isolation Migration
-- Configures Row Level Security (RLS) for user-scoped chats and investigations
-- ==============================================================================

-- 1. Create user conversations table with foreign key to auth.users
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    evidence_type TEXT DEFAULT 'message',
    evidence_payload JSONB DEFAULT '{}'::jsonb,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Single composite index matching frontend query: .eq("user_id", ...).order("updated_at", { ascending: false })
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id_updated_at 
ON public.chat_conversations(user_id, updated_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- 4. Least privilege table grants (authenticated role only)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_conversations TO authenticated;

-- 5. Strict user-scoped RLS policies (idempotent with DROP POLICY IF EXISTS)
DROP POLICY IF EXISTS "Users can only read their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can only read their own conversations"
    ON public.chat_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can only insert their own conversations"
    ON public.chat_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can only update their own conversations"
    ON public.chat_conversations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own conversations" ON public.chat_conversations;
CREATE POLICY "Users can only delete their own conversations"
    ON public.chat_conversations
    FOR DELETE
    USING (auth.uid() = user_id);
