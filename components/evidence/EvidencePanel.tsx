"use client";

import React from "react";
import { useChatStore } from "@/lib/stores/useChatStore";
import { EvidencePreview } from "./EvidencePreview";
import { ExtractedContextDisclosure } from "./ExtractedContextDisclosure";
import { 
  FileSearch, 
  X, 
  Shield, 
  Clock, 
  Maximize2,
  FolderOpen
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatTimestamp } from "@/lib/utils";

export function EvidencePanel() {
  const { 
    activeEvidence, 
    activeExtractedContext, 
    isEvidencePanelOpen, 
    toggleEvidencePanel 
  } = useChatStore();

  if (!isEvidencePanelOpen) return null;

  return (
    <aside className="w-80 xl:w-96 flex flex-col h-full bg-[#08100b]/90 border-l border-emerald-500/15 backdrop-blur-xl z-20 flex-shrink-0">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/15">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-100">Attached Evidence</h3>
            <span className="text-[11px] text-zinc-400">Thread Context Baseline</span>
          </div>
        </div>
        <button
          onClick={() => toggleEvidencePanel(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
          title="Collapse evidence panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeEvidence ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <Badge variant="emerald" dot>
                {activeEvidence.type.toUpperCase()} EVIDENCE
              </Badge>
              <div className="flex items-center gap-1 text-zinc-400 text-[11px]">
                <Clock className="h-3 w-3" />
                <span>{formatTimestamp(activeEvidence.createdAt)}</span>
              </div>
            </div>

            {/* Evidence Preview Component */}
            <EvidencePreview evidence={activeEvidence} />

            {/* Extracted Context Disclosure */}
            <ExtractedContextDisclosure 
              extracted={activeExtractedContext || activeEvidence.extractedContext} 
            />

            {/* Explanatory note */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/10 text-[11px] text-zinc-400 leading-relaxed">
              <span className="text-emerald-300 font-medium block mb-1">Persistent Context Guarantee</span>
              Paylume anchors every follow-up question to this evidence item so you can probe specific details without re-uploading.
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400/60">
              <FolderOpen className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-medium text-emerald-200">No Evidence Attached</h4>
            <p className="text-xs text-zinc-400 max-w-xs leading-normal">
              Drop an image, paste a payment link, or input notification text in the composer below to begin analysis.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
