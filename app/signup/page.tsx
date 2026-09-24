"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  Shield, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  MailCheck
} from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading: isAuthChecking } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerificationSent, setIsVerificationSent] = useState(false);

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (!isAuthChecking && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isAuthChecking, isAuthenticated, router]);

  // Password requirement tests
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const isMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation checks
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage("Your password does not satisfy all security requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please ensure both passwords match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await signUp(cleanEmail, password, cleanName);

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("user already registered") || msg.includes("already registered")) {
          setErrorMessage("An account with this email address already exists. Please sign in instead.");
        } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
          setErrorMessage("Too many signup attempts. Please try again in a few moments.");
        } else {
          setErrorMessage(error.message || "Failed to create account. Please try again.");
        }
        setIsSubmitting(false);
        return;
      }

      // If Supabase requires email verification (session is null)
      if (data?.user && !data.session) {
        setIsVerificationSent(true);
        setIsSubmitting(false);
      } else {
        // Auto-confirmed or session established immediately
        router.replace("/chat");
      }
    } catch (err: any) {
      setErrorMessage("A network error occurred while contacting authentication servers.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b08] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-emerald-600/12 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 -left-20 w-[400px] h-[300px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
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
                SECURITY
              </span>
            </div>
          </Link>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-emerald-100 tracking-tight">
              Create Your Protected Account
            </h1>
            <p className="text-xs text-zinc-400">
              Shine a light before you pay. Join Paylume payment safety defense.
            </p>
          </div>
        </div>

        {/* Verification Sent State */}
        {isVerificationSent ? (
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-[0_8px_35px_rgba(0,0,0,0.4)] text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-950/80 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-[0_0_25px_rgba(45,120,80,0.35)]">
              <MailCheck className="h-8 w-8 text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Check Your Inbox</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">
                We have sent an activation link to{" "}
                <span className="font-semibold text-emerald-300">{email}</span>.
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Please click the link in the email to verify your address and begin using Paylume.
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="w-full btn-pill-primary py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Signup Form */
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/20 shadow-[0_8px_35px_rgba(0,0,0,0.4)] backdrop-blur-2xl relative">
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="fullName" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    required
                    placeholder="Alex Thompson"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[#07130a]/80 border border-emerald-500/20 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="email" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Email Address
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

              {/* Password Field */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="password" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
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

                {/* Password Requirements Checklist */}
                {password.length > 0 && (
                  <div className="pt-2 pb-1 space-y-1.5 text-[11px]">
                    <span className="text-zinc-400 font-medium">Password Requirements:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-400 font-medium" : "text-zinc-500"}`}>
                        {hasMinLength ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1" />}
                        <span>Min 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-400 font-medium" : "text-zinc-500"}`}>
                        {hasUppercase ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1" />}
                        <span>1 uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasLowercase ? "text-emerald-400 font-medium" : "text-zinc-500"}`}>
                        {hasLowercase ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1" />}
                        <span>1 lowercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-400 font-medium" : "text-zinc-500"}`}>
                        {hasNumber ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 ml-1" />}
                        <span>1 number</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="confirmPassword" 
                  className="block text-xs font-medium text-zinc-300 uppercase tracking-wider text-[11px]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[#07130a]/80 border border-emerald-500/20 rounded-2xl pl-10 pr-11 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all disabled:opacity-50 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 focus:outline-none"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px]">
                    {isMatch ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <X className="h-3 w-3" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting || (password.length > 0 && !isPasswordValid)}
                  className="w-full btn-pill-primary py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(124,230,152,0.35)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Bottom Link to Login */}
            <div className="mt-6 pt-5 border-t border-emerald-500/15 text-center">
              <p className="text-xs text-zinc-400">
                Already registered?{" "}
                <Link 
                  href="/login" 
                  className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors underline decoration-emerald-500/40 underline-offset-4"
                >
                  Sign In
                </Link>
              </p>
            </div>

          </div>
        )}

        {/* Security Assurance Footer */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Lock className="h-3 w-3 text-emerald-400/80" />
            <span>Zero plaintext passwords stored. Secured by Supabase Auth engine.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
