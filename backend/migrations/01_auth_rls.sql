-- ==============================================================================
-- Paylume Authentication & User Data Isolation Migration
-- Configures Row Level Security (RLS) for user-scoped chats and investigations
-- ==============================================================================

-- 1. Enable pgcrypto / uuid-ossp if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create user profiles table synced with Supabase Auth users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read & update only their own profile
CREATE POLICY "Users can read own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 3. Create user conversations table with foreign key to auth.users
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

-- Create index on user_id for high-speed queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);

-- Enable RLS on chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Conversations policies: strict isolation per authenticated user
CREATE POLICY "Users can only read their own conversations"
    ON public.chat_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own conversations"
    ON public.chat_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own conversations"
    ON public.chat_conversations
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own conversations"
    ON public.chat_conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Shared Knowledge Base Table Note:
-- The existing 'documents' table contains shared public threat intelligence (CISA, FTC, OWASP, CERT-In).
-- Do NOT restrict 'documents' to a single user_id; all authenticated users share this RAG knowledge base.
