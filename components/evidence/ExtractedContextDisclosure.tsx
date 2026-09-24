"use client";

import React, { useState } from "react";
import { ExtractedContext } from "@/types/evidence";
import { ChevronDown, ChevronUp, AlertTriangle, Scan, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ExtractedContextDisclosureProps {
  extracted?: ExtractedContext | null;
}

export function ExtractedContextDisclosure({ extracted }: ExtractedContextDisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!extracted) return null;

  const sensitive = extracted.sensitiveDataDetected;
  const paymentFields = extracted.paymentFields;

  return (
    <div className="space-y-3">
      {/* Inline non-blocking Sensitive Data Warning if flagged by backend */}
      {sensitive?.warningMessage && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]">
          <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-300">Sensitive Information Detected</span>
            <p className="text-amber-200/90 leading-normal">{sensitive.warningMessage}</p>
          </div>
        </div>
      )}

      {/* Disclosure Card */}
      <div className="rounded-2xl bg-[#09130c]/80 border border-emerald-500/15 overflow-hidden transition-all duration-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3.5 text-left hover:bg-emerald-950/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Scan className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-100 flex items-center gap-2">
                <span>What Paylume Extracted</span>
                {extracted.extractionConfidence && (
                  <Badge variant="emerald" size="sm">
                    {(extracted.extractionConfidence * 100).toFixed(0)}% parsed
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">Underlying OCR text, URLs, and payment fields</p>
            </div>
          </div>
          <div className="text-emerald-400">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="p-4 pt-1 space-y-4 border-t border-emerald-500/10 text-xs animate-in slide-in-from-top-2 duration-150">
            {/* Payment Fields */}
            {paymentFields && Object.keys(paymentFields).length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400/80">
                  Detected Payment Parameters
                </span>
                <div className="rounded-xl bg-black/40 p-2.5 space-y-1.5 border border-emerald-500/10 divide-y divide-emerald-500/5">
                  {paymentFields.payee && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Payee / Recipient:</span>
                      <span className="text-emerald-200 font-medium">{paymentFields.payee}</span>
                    </div>
                  )}
                  {paymentFields.amount && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Amount:</span>
                      <span className="text-emerald-200 font-medium">
                        {paymentFields.currency ? `${paymentFields.currency} ` : ""}
                        {paymentFields.amount}
                      </span>
                    </div>
                  )}
                  {paymentFields.accountOrVpa && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">VPA / Route:</span>
                      <span className="text-emerald-300 font-mono text-right">{paymentFields.accountOrVpa}</span>
                    </div>
                  )}
                  {paymentFields.bankOrGateway && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Routing Gateway:</span>
                      <span className="text-zinc-300">{paymentFields.bankOrGateway}</span>
                    </div>
                  )}
                  {paymentFields.urgencyPhrases && paymentFields.urgencyPhrases.length > 0 && (
                    <div className="py-1">
                      <span className="text-zinc-400 block mb-1">Urgency Phrases:</span>
                      <div className="flex flex-wrap gap-1">
                        {paymentFields.urgencyPhrases.map((phrase, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[10px] border border-amber-500/30">
                            {phrase}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OCR Text */}
            {extracted.ocrText && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400/80">
                  Raw OCR Text Stream
                </span>
                <pre className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/10 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {extracted.ocrText}
                </pre>
              </div>
            )}

            {/* Detected URLs */}
            {extracted.detectedUrls && extracted.detectedUrls.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400/80">
                  Extracted Links & Protocols
                </span>
                <div className="space-y-1">
                  {extracted.detectedUrls.map((u, i) => (
                    <div key={i} className="p-2 rounded-lg bg-black/40 border border-emerald-500/10 font-mono text-[11px] text-emerald-300 break-all">
                      {u}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
