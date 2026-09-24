"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  unit?: string;
  avatarUrl?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ data: any; error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  setAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUserToProfile(supabaseUser: User | null): UserProfile | null {
  if (!supabaseUser) return null;

  const metadata = supabaseUser.user_metadata || {};
  const email = supabaseUser.email || "";
  const name =
    metadata.full_name ||
    metadata.name ||
    (email ? email.split("@")[0].replace(/[._-]/g, " ") : "Paylume User");

  // Format capitalized name
  const formattedName = name
    .split(" ")
    .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return {
    id: supabaseUser.id,
    name: formattedName,
    email,
    unit: metadata.unit || "Protected Account",
    avatarUrl: metadata.avatar_url || undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch initial session
    const initializeAuth = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("Error fetching Supabase session:", error.message);
        }
        if (isMounted) {
          setSession(data.session);
          setSupabaseUser(data.session?.user || null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to initialize auth session:", err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    if (!isSupabaseConfigured) return;

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setSupabaseUser(newSession?.user || null);
      setIsLoading(false);

      if (event === "SIGNED_OUT") {
        setSession(null);
        setSupabaseUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = useMemo(() => mapSupabaseUserToProfile(supabaseUser), [supabaseUser]);
  const isAuthenticated = Boolean(session && supabaseUser);
  const accessToken = session?.access_token || null;

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase Public API key is missing. Please add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to your .env.local file and restart Next.js."
        ),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      setSession(data.session);
      setSupabaseUser(data.user);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: new Error(
          "Supabase Public API key is missing. Please add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to your .env.local file and restart Next.js."
        ),
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/chat` : undefined,
        },
      });

      if (error) {
        return { data: null, error };
      }

      if (data.session) {
        setSession(data.session);
        setSupabaseUser(data.user);
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      setSession(null);
      setSupabaseUser(null);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      return { error: error ? (error as Error) : null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      return { error: error ? (error as Error) : null };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      supabaseUser,
      session,
      accessToken,
      isLoading,
      isAuthenticated,
      isAuthModalOpen,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      setAuthModalOpen,
    }),
    [
      user,
      supabaseUser,
      session,
      accessToken,
      isLoading,
      isAuthenticated,
      isAuthModalOpen,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
