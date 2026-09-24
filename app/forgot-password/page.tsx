"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  Shield, 
  Mail, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft
} from "lucide-react";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter the email address linked to your account.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await resetPassword(cleanEmail);

      if (error) {
        setErrorMessage(error.message || "Failed to dispatch password recovery email.");
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMessage("A network error occurred while connecting to authentication service.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b08] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-emerald-600/12 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <Link href="/" className="group flex flex-col items-center">
            <div className="relative mb-3">
              <div className="absolute -inset-2 bg-emerald-500/25 rounded-2xl blur-lg group-hover:bg-emerald-500/35 transition-all duration-300" />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2d7850] to-[#123824] border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(45,120,80,0.4)] transition-transform group-hover:scale-105">
                <Shield className="h-7 w-7" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">Paylume</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                RECOVERY
              </span>
            </div>
          </Link>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-emerald-100 tracking-tight">
              Reset Your Password
            </h1>
            <p className="text-xs text-zinc-400">
              Enter your verified email to receive secure recovery instructions.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/20 shadow-[0_8px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl relative">
          
          {isSuccess ? (
            <div className="space-y-5 text-center animate-in fade-in zoom-in-95">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-950/80 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-[0_0_20px_rgba(45,120,80,0.3)]">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">Reset Link Dispatched</h2>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  We have sent password reset instructions to{" "}
                  <span className="font-semibold text-emerald-300">{email}</span>.
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  If an account exists with this email address, you will find a secure link to set your new password. Check your spam folder if it doesn&apos;t appear shortly.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full btn-pill-primary py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {errorMessage && (
                <div className="mb-4 p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <label 
                  htmlFor="email" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Account Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[#07130a]/80 border border-emerald-500/20 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-pill-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(124,230,152,0.35)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending Instructions...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Recovery Link</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-emerald-500/15 text-center">
                <Link 
                  href="/login" 
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-300 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>

            </form>
          )}

        </div>

        {/* Security Footer */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Lock className="h-3 w-3 text-emerald-400/80" />
            <span>Time-limited single-use cryptographic recovery via Supabase</span>
          </div>
        </div>

      </div>
    </div>
  );
}
