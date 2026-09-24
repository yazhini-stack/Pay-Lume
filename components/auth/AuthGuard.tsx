"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Shield, Lock } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#060b08] text-zinc-100 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative flex flex-col items-center space-y-6 z-10">
          {/* Animated Glowing Shield */}
          <div className="relative">
            <div className="absolute -inset-2 bg-emerald-500/25 rounded-2xl blur-lg animate-pulse" />
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2d7850] to-[#123824] border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(45,120,80,0.4)]">
              <Shield className="h-7 w-7 animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Lock className="h-3.5 w-3.5" />
              <span>Encrypted Session Verification</span>
            </div>
            <p className="text-sm text-zinc-400">
              Checking authentication with Supabase...
            </p>
          </div>

          {/* Minimal progress bar */}
          <div className="w-48 h-1 bg-emerald-950/80 rounded-full overflow-hidden border border-emerald-500/20">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-mint animate-[indeterminate_1.5s_infinite_linear] rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
