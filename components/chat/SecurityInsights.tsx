"use client";

import React, { useState } from "react";
import { Citation } from "@/types/chat";
import { 
  ShieldAlert, 
  Search, 
  AlertTriangle, 
  BookOpen, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  AlertOctagon,
  CheckCircle2
} from "lucide-react";
import { getSafeExternalUrl, extractResourceDomain } from "@/lib/utils";

interface SecurityInsightsProps {
  indicators: string[];
  resources: Citation[];
  onOpenAlreadyPaid: () => void;
}

export function SecurityInsights({
  indicators,
  resources,
  onOpenAlreadyPaid
}: SecurityInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const indicatorCount = indicators.length;
  const resourceCount = resources.length;

  // Empty state: If no security analysis has been performed yet, keep hidden
  if (indicatorCount === 0 && resourceCount === 0) {
    return null;
  }

  // Build summary label
  const indicatorLabel = indicatorCount === 1 
    ? "1 indicator detected" 
    : `${indicatorCount} indicators detected`;

  const resourceLabel = resourceCount === 1 
    ? "1 trusted resource" 
    : `${resourceCount} trusted resources`;

  const summaryText = indicatorCount > 0 && resourceCount > 0
    ? `Security Insights · ${indicatorLabel} · ${resourceLabel}`
    : indicatorCount > 0
    ? `Security Insights · ${indicatorLabel}`
    : `Security Insights · ${resourceLabel}`;

  return (
    <div className="w-full px-3 sm:px-6 py-1 select-none flex-shrink-0 z-20">
      <div className="rounded-2xl bg-[#08130c]/90 border border-emerald-500/20 hover:border-emerald-500/35 backdrop-blur-xl shadow-lg transition-all duration-200 overflow-hidden">
        {/* Collapsed Header Bar */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-emerald-950/30 transition-colors group"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="h-6 w-6 rounded-lg bg-emerald-950/90 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 shadow-sm">
              <ShieldAlert className="h-3.5 w-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-emerald-200 truncate">
                {summaryText}
              </span>
              <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-emerald-400/80 group-hover:text-emerald-300 transition-colors">
            <span className="text-[11px] font-medium hidden sm:inline">
              {isExpanded ? "Collapse" : "View"}
            </span>
            <div className="p-1 rounded-md bg-emerald-950/60 border border-emerald-500/20">
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="border-t border-emerald-500/15 p-4 sm:p-5 space-y-4 max-h-80 sm:max-h-96 overflow-y-auto bg-[#060e09]/95 text-xs text-zinc-300">
            {/* 1. Security Evidence Indicators */}
            {indicatorCount > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Search className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                    Security Evidence
                  </h4>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/15 space-y-2">
                  <ul className="space-y-2">
                    {indicators.map((indicator, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed font-medium">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{indicator}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 2. Trusted Resources */}
            {resourceCount > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <BookOpen className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                      Trusted Resources
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {resourceCount} Verified {resourceCount === 1 ? "Advisory" : "Advisories"}
                  </span>
                </div>

                <div className="space-y-2">
                  {resources.map((c) => {
                    const safeUrl = getSafeExternalUrl(c.url, c.source);
                    const displayDomain = extractResourceDomain(c.url, c.source);

                    return (
                      <div
                        key={c.id || c.title}
                        className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/15 space-y-2 hover:border-emerald-500/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                {c.source}
                              </span>
                              {c.category && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-700/50">
                                  {c.category}
                                </span>
                              )}
                              {displayDomain && (
                                <span className="text-[11px] font-mono text-zinc-400">
                                  {displayDomain}
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-emerald-100 text-xs leading-snug">
                              {c.title}
                            </div>
                          </div>

                          {/* Clickable Official Website Button */}
                          <div className="shrink-0 self-start">
                            {safeUrl ? (
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-emerald-100 border border-emerald-500/30 hover:border-emerald-400/50 text-[11px] font-medium transition-colors shadow-sm"
                                title={`Open ${displayDomain || c.source} official advisory in a new tab`}
                              >
                                <span>Visit website</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-zinc-500 italic px-2 py-1">
                                Link unavailable
                              </span>
                            )}
                          </div>
                        </div>

                        {c.snippet && (
                          <p className="text-[11px] text-zinc-300 leading-relaxed italic pl-2 border-l-2 border-emerald-500/20">
                            "{c.snippet}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. 💳 ALREADY PAID? PERSISTENT ACTION CARD */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-950/40 via-[#130b0b] to-[#08120b] border border-red-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-red-950 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <AlertOctagon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">💳 Already Paid?</span>
                  <span className="text-[11px] text-zinc-400">
                    If you've already completed the payment, get guidance on what to do next.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAlreadyPaid}
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 border border-red-500/40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0 self-end sm:self-auto cursor-pointer"
              >
                <span>Already Paid</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
