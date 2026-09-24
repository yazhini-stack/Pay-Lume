"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  Shield, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading: isAuthChecking } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (!isAuthChecking && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isAuthChecking, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signIn(cleanEmail, password);

      if (error) {
        // Map Supabase error messages to friendly, professional messages
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
          setErrorMessage("Invalid email or password. Please verify and try again.");
        } else if (msg.includes("email not confirmed")) {
          setErrorMessage("Please verify your email address before signing in. Check your inbox for the activation link.");
        } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
          setErrorMessage("Too many login attempts. Please wait a few moments before trying again.");
        } else {
          setErrorMessage(error.message || "Failed to sign in. Please try again.");
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Authentication successful. Redirecting to Paylume workspace...");
      setTimeout(() => {
        router.replace("/chat");
      }, 400);
    } catch (err: any) {
      setErrorMessage("A network connection error occurred. Please verify your connection.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b08] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-emerald-600/12 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 -right-20 w-[400px] h-[300px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <Link href="/" className="group flex flex-col items-center">
            {/* Luminous Emerald Shield */}
            <div className="relative mb-3">
              <div className="absolute -inset-2 bg-emerald-500/25 rounded-2xl blur-lg group-hover:bg-emerald-500/35 transition-all duration-300" />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2d7850] to-[#123824] border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(45,120,80,0.4)] transition-transform group-hover:scale-105">
                <Shield className="h-7 w-7" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">Paylume</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                SECURITY
              </span>
            </div>
          </Link>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-emerald-100 tracking-tight">
              Upload. Ask. Understand.
            </h1>
            <p className="text-xs text-zinc-400">
              Shine a light before you pay. Sign in to your protected account.
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/20 shadow-[0_8px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl relative">
          
          {/* Status / Alert Messages */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label 
                htmlFor="email" 
                className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
              >
                Work / Personal Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#07130a]/80 border border-emerald-500/20 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-[#07130a]/80 border border-emerald-500/20 rounded-2xl pl-10 pr-11 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all disabled:opacity-50 font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-500/30 bg-black/40 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 focus:ring-1 cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-zinc-300">Remember this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-pill-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(124,230,152,0.35)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Paylume</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Bottom Link to Sign Up */}
          <div className="mt-6 pt-5 border-t border-emerald-500/15 text-center">
            <p className="text-xs text-zinc-400">
              Don&apos;t have an account?{" "}
              <Link 
                href="/signup" 
                className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors underline decoration-emerald-500/40 underline-offset-4"
              >
                Create Account
              </Link>
            </p>
          </div>

        </div>

        {/* Security Assurance Footer */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Lock className="h-3 w-3 text-emerald-400/80" />
            <span>Encrypted with TLS 1.3 & Supabase Zero-Knowledge Credentials</span>
          </div>
        </div>

      </div>
    </div>
  );
}
