"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface DiagnosticState {
  urlConfigured: boolean;
  urlHostname: string;
  publishableKeyConfigured: boolean;
  publishableKeyLength: number;
  publishableKeyPrefix: string;
  anonKeyConfigured: boolean;
  anonKeyLength: number;
  anonKeyPrefix: string;
  isUsingPlaceholderFallback: boolean;
  clientInitialized: boolean;
  connectivityStatus: "pending" | "success" | "error";
  connectivityMessage: string;
  deducedRootCause: string;
}

export default function DebugSupabasePage() {
  const [diag, setDiag] = useState<DiagnosticState | null>(null);

  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let hostname = "Not set";
    try {
      if (rawUrl) {
        hostname = new URL(rawUrl).hostname;
      }
    } catch {
      hostname = "Malformed URL";
    }

    const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const activeKey = pubKey || anonKey;

    const getSafePrefix = (val: string) => {
      if (!val) return "NONE";
      if (val.startsWith("sb_publishable_")) return "sb_publishable_*** (New Supabase Format)";
      if (val.startsWith("eyJ")) return "eyJ*** (Legacy Supabase JWT Format)";
      return "UNKNOWN_FORMAT (length " + val.length + ")";
    };

    const isUsingPlaceholder = !activeKey || activeKey.trim() === "";

    let rootCause = "";
    if (isUsingPlaceholder) {
      rootCause = "A. Missing environment variable — Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY has a value in .env.local. The client defaulted to 'placeholder-anon-key', which Supabase rejects with 'Invalid API key'.";
    } else if (hostname === "Not set" || hostname === "Malformed URL") {
      rootCause = "C. Wrong Supabase URL — NEXT_PUBLIC_SUPABASE_URL is missing or invalid.";
    }

    const runCheck = async () => {
      let status: "pending" | "success" | "error" = "pending";
      let msg = "";

      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          status = "error";
          const hint = (error as any).hint;
          msg = `${error.message}${hint ? ` (${hint})` : ""}`;
        } else {
          status = "success";
          msg = "Supabase Auth responded with HTTP 200 OK. Public key is verified and operational.";
          rootCause = "None — Configuration is valid!";
        }
      } catch (err: any) {
        status = "error";
        msg = err?.message || String(err);
      }

      setDiag({
        urlConfigured: Boolean(rawUrl),
        urlHostname: hostname,
        publishableKeyConfigured: Boolean(pubKey),
        publishableKeyLength: pubKey.length,
        publishableKeyPrefix: getSafePrefix(pubKey),
        anonKeyConfigured: Boolean(anonKey),
        anonKeyLength: anonKey.length,
        anonKeyPrefix: getSafePrefix(anonKey),
        isUsingPlaceholderFallback: isUsingPlaceholder,
        clientInitialized: Boolean(supabase),
        connectivityStatus: status,
        connectivityMessage: msg,
        deducedRootCause: rootCause,
      });
    };

    runCheck();
  }, []);

  if (!diag) {
    return (
      <div className="min-h-screen bg-[#060b08] text-emerald-400 p-8 flex items-center justify-center font-mono">
        Scanning Supabase configuration...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b08] text-zinc-100 p-6 md:p-12 font-mono flex flex-col items-center">
      <div className="w-full max-w-2xl bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="border-b border-zinc-800 pb-4">
          <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">
            Safe Environment Diagnostic
          </div>
          <h1 className="text-xl font-bold text-white">
            Paylume Supabase Auth Healthcheck
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Zero secret exposure. Validates environment bindings and client initialization.
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL Configured</span>
            <span className={diag.urlConfigured ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {diag.urlConfigured ? "YES" : "NO"}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">Supabase Project Hostname</span>
            <span className="text-zinc-200 font-medium">{diag.urlHostname}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY Configured</span>
            <span className={diag.publishableKeyConfigured ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {diag.publishableKeyConfigured ? `YES (Length: ${diag.publishableKeyLength})` : "NO (Empty / Not Set)"}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_ANON_KEY Configured</span>
            <span className={diag.anonKeyConfigured ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {diag.anonKeyConfigured ? `YES (Length: ${diag.anonKeyLength})` : "NO (Empty / Not Set)"}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">Client Fallback In Use</span>
            <span className={diag.isUsingPlaceholderFallback ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold"}>
              {diag.isUsingPlaceholderFallback ? "YES ('placeholder-anon-key' Active)" : "NO (Real Key Loaded)"}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">Supabase Client Initialized</span>
            <span className="text-emerald-400 font-semibold">
              {diag.clientInitialized ? "YES" : "NO"}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-zinc-800/60">
            <span className="text-zinc-400">Supabase Auth Ping</span>
            <span className={diag.connectivityStatus === "success" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {diag.connectivityStatus === "success" ? "HTTP 200 OK" : "ERROR"}
            </span>
          </div>
        </div>

        {/* Connectivity Detail */}
        <div className="bg-black/40 border border-zinc-800 rounded-xl p-4 text-xs space-y-1">
          <div className="text-zinc-400 font-medium uppercase tracking-wider">Auth Ping Response Detail:</div>
          <div className={diag.connectivityStatus === "success" ? "text-emerald-400" : "text-rose-300"}>
            {diag.connectivityMessage}
          </div>
        </div>

        {/* Diagnosis Box */}
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs space-y-2">
          <div className="font-semibold text-rose-400 uppercase tracking-wider">
            Root Cause Diagnosis
          </div>
          <p className="text-rose-200 leading-relaxed">
            {diag.deducedRootCause}
          </p>
        </div>
      </div>
    </div>
  );
}
