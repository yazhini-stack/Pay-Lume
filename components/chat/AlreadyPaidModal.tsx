"use client";

import React, { useState } from "react";
import { 
  AlertOctagon, 
  X, 
  CreditCard, 
  Smartphone, 
  Building2, 
  Link2, 
  QrCode, 
  HelpCircle, 
  ShieldCheck, 
  ShieldAlert,
  Send,
  Edit3
} from "lucide-react";

interface AlreadyPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFlow: (prefilledQuestion: string, autoSend: boolean) => void;
}

interface PaymentOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "upi",
    label: "UPI Payment",
    icon: <Smartphone className="h-4 w-4 text-emerald-400" />,
    prompt: "I already made a payment via UPI to this recipient. What immediate emergency steps should I take with my payment app, bank, and cybercrime authorities to stop or dispute this transaction?"
  },
  {
    id: "card",
    label: "Card Payment",
    icon: <CreditCard className="h-4 w-4 text-emerald-400" />,
    prompt: "I entered my card details and a payment was charged. What immediate actions should I take with my bank or card issuer to block my card and dispute this charge?"
  },
  {
    id: "bank",
    label: "Bank Transfer",
    icon: <Building2 className="h-4 w-4 text-emerald-400" />,
    prompt: "I transferred money via direct bank wire / IMPS / NEFT. What immediate steps should I take to contact my bank's emergency cyber fraud desk and request an account freeze or recall?"
  },
  {
    id: "link",
    label: "Payment Link",
    icon: <Link2 className="h-4 w-4 text-emerald-400" />,
    prompt: "I completed a payment through a suspicious payment link. What immediate steps should I take with the payment gateway and my bank to report and dispute the transaction?"
  },
  {
    id: "qr",
    label: "QR Payment",
    icon: <QrCode className="h-4 w-4 text-emerald-400" />,
    prompt: "I scanned a QR code and money was debited from my account. What immediate steps should I take to report this merchant handle and protect my account?"
  },
  {
    id: "other",
    label: "Other Payment",
    icon: <HelpCircle className="h-4 w-4 text-emerald-400" />,
    prompt: "I already sent money to this recipient. What immediate practical steps should I take right now to protect my accounts and report this situation?"
  }
];

export function AlreadyPaidModal({ isOpen, onClose, onSelectFlow }: AlreadyPaidModalProps) {
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(PAYMENT_OPTIONS[0]);
  const [customNotes, setCustomNotes] = useState("");

  if (!isOpen) return null;

  const handleSelect = (option: PaymentOption) => {
    setSelectedOption(option);
  };

  const getFinalQuestion = () => {
    const base = selectedOption?.prompt || "I already made the payment. What should I do now?";
    if (customNotes.trim()) {
      return `${base} Additional context: ${customNotes.trim()}`;
    }
    return base;
  };

  const handleApplyToInput = () => {
    onSelectFlow(getFinalQuestion(), false);
    onClose();
  };

  const handleSendImmediately = () => {
    onSelectFlow(getFinalQuestion(), true);
    onClose();
  };

  const handleQuickQuestion = () => {
    onSelectFlow("I already made the payment. What should I do now?", true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl rounded-3xl bg-[#0b140f] border border-red-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="already-paid-title"
      >
        {/* Top Emergency Header */}
        <div className="p-5 border-b border-red-500/20 bg-gradient-to-r from-red-950/60 via-[#160c0c] to-[#0c1810] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-950 border border-red-500/40 flex items-center justify-center text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex-shrink-0">
              <AlertOctagon className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h3 id="already-paid-title" className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span>🚨 I Already Paid</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-500/30 font-bold uppercase tracking-wider">
                  Post-Payment Assistance
                </span>
              </h3>
              <p className="text-xs text-red-200/80 mt-0.5">
                Don't panic. Acting promptly gives you the strongest chance to safeguard your funds and accounts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close post-payment modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Method Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-emerald-200 block">
              What payment method did you use?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const isSelected = selectedOption?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt)}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                      isSelected
                        ? "bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "bg-[#09150d]/80 border-emerald-500/15 hover:border-emerald-500/35 text-zinc-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {opt.icon}
                      {isSelected && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Additional Detail Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Optional details (Amount, bank name, or what was promised):
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Paid ₹5,000 via Google Pay after an electricity cutoff alert"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-emerald-500/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          {/* Preview of Question to be Asked */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
              <span>Question to be analyzed by Paylume RAG:</span>
              <span className="text-zinc-500 font-mono text-[10px]">Editable before sending</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans italic">
              "{getFinalQuestion()}"
            </p>
          </div>

          {/* Strict Privacy Callout */}
          <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-amber-200 text-xs">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold text-amber-100">Strict Security Rule:</span>
              <p className="text-[11px]">
                Paylume will <strong>never</strong> ask for or store your OTP, UPI PIN, ATM PIN, CVV, or passwords. Never share these credentials with anyone.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-emerald-500/15 bg-[#08120b] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={handleQuickQuestion}
            className="text-xs text-zinc-400 hover:text-emerald-300 underline underline-offset-4 order-3 sm:order-1"
          >
            Just ask "What should I do now?"
          </button>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              onClick={handleApplyToInput}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-200 text-xs font-medium transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Question First</span>
            </button>
            <button
              onClick={handleSendImmediately}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Get Immediate Help</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
