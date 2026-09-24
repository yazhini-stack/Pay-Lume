import { createClient } from "@supabase/supabase-js";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qtfszgcqknnxgrgiigmq.supabase.co";

// Check for either the new Supabase Publishable Key or the legacy Anon Key
export const rawSupabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

export const isSupabaseConfigured = Boolean(
  rawSupabaseKey &&
  rawSupabaseKey !== "placeholder-anon-key" &&
  rawSupabaseKey !== "your_supabase_anon_publishable_key_here"
);

// Fallback key prevents build-time crash when compiling static pages
const supabaseApiKey = isSupabaseConfigured ? rawSupabaseKey : "placeholder-anon-key";

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[Paylume Supabase Config Error] Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is configured in .env.local. The client defaulted to 'placeholder-anon-key' which causes Supabase to return 'Invalid API key'."
  );
}

export const supabase = createClient(supabaseUrl, supabaseApiKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "paylume_supabase_auth_token",
  },
});
