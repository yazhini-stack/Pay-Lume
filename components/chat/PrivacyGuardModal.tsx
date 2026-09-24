"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { usePrivacyGuard } from "@/lib/hooks/usePrivacyGuard";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Lock, AlertOctagon, CheckCircle2 } from "lucide-react";

export function PrivacyGuardModal() {
  const { isWarningModalOpen, dismissWarning } = usePrivacyGuard();

  return (
    <Modal
      isOpen={isWarningModalOpen}
      onClose={dismissWarning}
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-emerald-100">
              Payment Privacy Notice
            </h3>
            <p className="text-xs text-amber-300/90 font-medium mt-0.5">
              Please review before attaching payment documents
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/20 space-y-3">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Paylume extracts text and transaction parameters to explain payment safety risks. To protect your security, <strong className="text-amber-300">never upload or paste:</strong>
          </p>
          
          <ul className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
            <li className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-500/10">
              <AlertOctagon className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>One-Time Passwords (OTPs)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-500/10">
              <AlertOctagon className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>Debit / Credit Card CVVs</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-500/10">
              <AlertOctagon className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>ATM or UPI PINs</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-500/10">
              <AlertOctagon className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>Online Banking Passwords</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/15">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>Paylume runs automated client-side sanitization to filter out sensitive credentials.</span>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <Button
            variant="pill-primary"
            onClick={dismissWarning}
            className="w-full sm:w-auto"
          >
            I Understand & Agree
          </Button>
        </div>
      </div>
    </Modal>
  );
}
