"use client";

import React, { useState } from "react";
import { EvidencePayload } from "@/types/evidence";
import { Lightbox } from "@/components/ui/Lightbox";
import { 
  QrCode, 
  ExternalLink, 
  Globe, 
  FileText, 
  ShieldCheck, 
  Lock, 
  Copy, 
  Check, 
  Maximize2,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface EvidencePreviewProps {
  evidence: EvidencePayload;
}

export function EvidencePreview({ evidence }: EvidencePreviewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  if (evidence.type === "qr") {
    const qrData = evidence.qrDecoded;
    return (
      <div className="space-y-4">
        {/* Cyber-bracket QR display inspired by reference UI */}
        <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-[#09130c] border border-emerald-500/20 shadow-inner">
          <div className="relative p-6 bg-[#040805] rounded-2xl border border-emerald-500/30">
            {/* Cyber Brackets */}
            <div className="cyber-bracket cyber-bracket-tl" />
            <div className="cyber-bracket cyber-bracket-tr" />
            <div className="cyber-bracket cyber-bracket-bl" />
            <div className="cyber-bracket cyber-bracket-br" />

            {/* Styled QR Matrix Mockup */}
            <div className="w-36 h-36 flex items-center justify-center relative">
              <svg 
                className="w-full h-full text-emerald-400 drop-shadow-[0_0_10px_rgba(124,230,152,0.4)]"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75ZM6.75 16.5h.008v.008H6.75V16.5ZM16.5 6.75h.008v.008H16.5V6.75ZM13.5 13.5h3v3h-3zM18 15h2v2h-2zM15 18h2v2h-2zM18 18h2v2h-2z" />
              </svg>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs uppercase tracking-widest text-emerald-400/70 font-mono">
              Decoded Payment Barcode
            </span>
            <div className="text-sm font-semibold text-emerald-200 mt-0.5">
              {qrData?.protocol || "UPI Protocol"}
            </div>
          </div>
        </div>

        {/* Decoded Key-Value Table */}
        <div className="rounded-2xl bg-[#09130c]/70 border border-emerald-500/15 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Decoded Payload Fields</span>
            <button
              onClick={() => handleCopy(qrData?.rawPayload || "")}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
            >
              {hasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{hasCopied ? "Copied" : "Copy Raw"}</span>
            </button>
          </div>

          <div className="divide-y divide-emerald-500/10 text-xs">
            {qrData?.parsedFields && Object.entries(qrData.parsedFields).map(([k, v]) => (
              <div key={k} className="py-2 flex items-start justify-between gap-4">
                <span className="text-zinc-400">{k}</span>
                <span className="text-emerald-200 font-mono text-right break-all">{v}</span>
              </div>
            ))}
            {!qrData?.parsedFields && qrData?.rawPayload && (
              <div className="py-2 font-mono text-emerald-300 break-all">
                {qrData.rawPayload}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (evidence.type === "url") {
    const urlStr = evidence.url || "";
    let domain = "";
    try {
      domain = new URL(urlStr).hostname;
    } catch {
      domain = urlStr;
    }
    const isHttps = urlStr.startsWith("https://");
    const meta = evidence.extractedContext?.domainMetadata;

    return (
      <div className="space-y-4">
        <div className="p-5 rounded-3xl bg-[#09130c] border border-emerald-500/20 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-emerald-100">{domain}</h4>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                  {isHttps ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Lock className="h-3 w-3" /> HTTPS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Not Secure (HTTP)
                    </span>
                  )}
                  <span>•</span>
                  <span>{meta?.creationAge || "Recent domain"}</span>
                </div>
              </div>
            </div>
            <a
              href={urlStr}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-zinc-400 hover:text-emerald-300 rounded-xl hover:bg-emerald-950/40"
              title="Open link (Caution)"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/10 font-mono text-xs text-emerald-200/90 break-all">
            {urlStr}
          </div>

          {meta?.reputationScore && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-400">Heuristic Assessment</span>
              <Badge variant="amber" size="sm" dot>
                {meta.reputationScore}
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (evidence.type === "screenshot") {
    const previewUrl = evidence.previewUrl || "/mock/receipt.png";
    return (
      <div className="space-y-4">
        <div className="relative group rounded-3xl overflow-hidden border border-emerald-500/20 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={evidence.title}
            className="w-full h-56 object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
          
          <button
            onClick={() => setIsLightboxOpen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 text-xs font-medium backdrop-blur-md hover:bg-emerald-900 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Inspect Full Image</span>
          </button>
        </div>

        {evidence.fileMeta && (
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>{evidence.fileMeta.name}</span>
            <span>{(evidence.fileMeta.size / 1024).toFixed(0)} KB</span>
          </div>
        )}

        <Lightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          imageUrl={previewUrl}
          title={evidence.title}
        />
      </div>
    );
  }

  // Message type
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl bg-[#09130c] border border-emerald-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <FileText className="h-3.5 w-3.5" />
            <span>Verbatim Notification Text</span>
          </div>
          <button
            onClick={() => handleCopy(evidence.rawText || "")}
            className="text-xs text-zinc-400 hover:text-emerald-300 flex items-center gap-1"
          >
            {hasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span>{hasCopied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans bg-black/40 p-3 rounded-xl border border-emerald-500/10">
          {evidence.rawText}
        </p>
      </div>
    </div>
  );
}
