"use client";

import React from "react";
import { RAGStatus } from "@/types/chat";
import { Scan, Database, GitFork, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RAGPipelineIndicatorProps {
  status: { step: RAGStatus; message: string } | null;
}

const STAGES: { step: RAGStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { step: "extracting", label: "Extracting", icon: Scan },
  { step: "retrieving", label: "Retrieving", icon: Database },
  { step: "reranking", label: "Reranking", icon: GitFork },
  { step: "generating", label: "Synthesizing", icon: Sparkles }
];

export function RAGPipelineIndicator({ status }: RAGPipelineIndicatorProps) {
  if (!status || status.step === "idle") return null;

  const currentIdx = STAGES.findIndex((s) => s.step === status.step);

  return (
    <div 
      aria-live="polite"
      className="p-4 rounded-3xl bg-[#09150d]/90 border border-emerald-500/25 shadow-[0_4px_25px_-5px_rgba(16,185,129,0.15)] backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Multimodal RAG Pipeline Active
          </span>
        </div>
        <span className="text-xs text-zinc-400 font-mono italic">
          {status.message}
        </span>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-2">
        {STAGES.map((s, idx) => {
          const Icon = s.icon;
          const isDone = currentIdx > idx;
          const isCurrent = currentIdx === idx;

          return (
            <div
              key={s.step}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-medium transition-all duration-300 border",
                isDone && "bg-emerald-950/80 border-emerald-500/40 text-emerald-300",
                isCurrent && "bg-emerald-500/20 border-emerald-400 text-emerald-100 shadow-[0_0_15px_rgba(124,230,152,0.3)] animate-pulse",
                !isDone && !isCurrent && "bg-black/30 border-emerald-500/10 text-zinc-500"
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", isCurrent ? "text-emerald-400" : "")} />
              )}
              <span className="truncate hidden sm:inline">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
