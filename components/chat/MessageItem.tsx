"use client";

import React, { useState } from "react";
import { Message, Citation } from "@/types/chat";
import { 
  Eye, 
  Compass, 
  CheckCircle2, 
  Shield, 
  User, 
  ExternalLink, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Bookmark,
  Share2,
  Search,
  AlertTriangle,
  AlertOctagon,
  BookOpen
} from "lucide-react";
import { formatTimestamp, cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore } from "@/lib/stores/useChatStore";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isCitationsOpen, setIsCitationsOpen] = useState(true);
  const [activePopoverCitation, setActivePopoverCitation] = useState<Citation | null>(null);
  const { openAlreadyPaidModal } = useChatStore();

  const isUser = message.role === "user";

  const handleCopy = () => {
    let text = "";
    if (message.content) {
      text += message.content;
    }
    if (message.sections) {
      const secParts: string[] = [];
      if (message.sections.observed) secParts.push(`OBSERVED:\n${message.sections.observed}`);
      if (message.sections.interpretation) secParts.push(`INTERPRETATION:\n${message.sections.interpretation}`);
      if (message.sections.actions) secParts.push(`RECOMMENDED ACTIONS:\n${message.sections.actions}`);
      if (secParts.length > 0) {
        text += (text ? "\n\n" : "") + secParts.join("\n\n");
      }
    }
    navigator.clipboard.writeText(text || message.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render text with clickable citation superscripts [1], [2], etc.
  const renderTextWithCitations = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) {
      return (
        <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    // Split on citation tags like [1], [2], [3]
    const parts = content.split(/(\[\d+\])/g);
    return (
      <div className="text-sm text-zinc-200 leading-relaxed space-y-2 whitespace-pre-wrap">
        {parts.map((part, index) => {
          const match = part.match(/\[(\d+)\]/);
          if (match) {
            const citId = parseInt(match[1], 10);
            const cit = citations.find((c) => c.id === citId);
            if (cit) {
              return (
                <button
                  key={index}
                  onClick={() => setActivePopoverCitation(cit)}
                  className="inline-flex items-center justify-center text-[10px] font-bold text-emerald-400 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-500/30 px-1.5 py-0.5 rounded mx-0.5 align-super cursor-pointer transition-colors"
                  title={`Source: ${cit.source}`}
                >
                  [{cit.id}]
                </button>
              );
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 max-w-3xl ml-auto">
        <div className="p-4 rounded-3xl rounded-tr-sm bg-gradient-to-br from-[#12281b] to-[#0b1710] border border-emerald-500/25 shadow-lg text-emerald-50 text-sm max-w-xl">
          <p className="leading-relaxed font-sans">{message.content}</p>
          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-emerald-400/60">
            <span>{formatTimestamp(message.createdAt)}</span>
          </div>
        </div>
        <div className="h-9 w-9 rounded-2xl bg-emerald-900/60 border border-emerald-500/30 flex items-center justify-center text-emerald-300 flex-shrink-0 mt-0.5">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const sections = message.sections || {};
  const hasObserved = Boolean(sections.observed);
  const hasInterpretation = Boolean(sections.interpretation);
  const hasActions = Boolean(sections.actions);
  const citations = message.citations || [];

  return (
    <div className="space-y-4 max-w-3xl mr-auto animate-in fade-in duration-300">
      {/* Bot Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#2d7850] to-[#123824] border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(45,120,80,0.3)]">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-100">Paylume Intelligence</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 font-mono">
                {hasObserved && hasInterpretation && hasActions ? "Structured Review" : "Cybersecurity RAG"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-1.5 text-zinc-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-950/40 transition-colors"
            title="Copy answer"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* DIRECT QUESTION-DRIVEN CONTENT ANSWER */}
      {message.content && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#0a150e]/90 border border-emerald-500/20 shadow-[0_2px_15px_rgba(0,0,0,0.4)] text-sm text-zinc-200 leading-relaxed">
          {renderTextWithCitations(message.content, citations)}
        </div>
      )}

      {/* OPTIONAL STRUCTURED SECTIONS (ONLY RENDERED WHEN PRESENT & USEFUL) */}
      {(hasObserved || hasInterpretation || hasActions) && (
        <div className="space-y-3.5">
          {/* 1. OBSERVED */}
          {hasObserved && (
            <div className="p-4 rounded-3xl bg-[#0a150e]/90 border border-emerald-500/20 shadow-[0_2px_15px_rgba(0,0,0,0.4)] relative overflow-hidden group hover:border-emerald-500/35 transition-colors">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-6 w-6 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <Eye className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Observed (Factual Evidence)
                </h4>
              </div>
              <div className="pl-8">
                {renderTextWithCitations(sections.observed || "", citations)}
              </div>
            </div>
          )}

          {/* 2. INTERPRETATION */}
          {hasInterpretation && (
            <div className="p-4 rounded-3xl bg-[#0a150e]/90 border border-emerald-500/20 shadow-[0_2px_15px_rgba(0,0,0,0.4)] relative overflow-hidden group hover:border-emerald-500/35 transition-colors">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-6 w-6 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <Compass className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Interpretation (Analysis)
                </h4>
              </div>
              <div className="pl-8">
                {renderTextWithCitations(sections.interpretation || "", citations)}
              </div>
            </div>
          )}

          {/* 3. RECOMMENDED ACTIONS */}
          {hasActions && (
            <div className="p-4 rounded-3xl bg-[#08130b]/90 border border-emerald-500/25 shadow-[0_2px_15px_rgba(0,0,0,0.4)] relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-6 w-6 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Recommended Actions
                </h4>
              </div>
              <div className="pl-8">
                {renderTextWithCitations(sections.actions || "", citations)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🔍 SECURITY EVIDENCE SECTION */}
      {message.securityEvidence !== undefined && (
        <div className="p-4 rounded-3xl bg-[#09150d]/90 border border-emerald-500/20 shadow-md space-y-2.5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              🔍 Security Evidence
            </h4>
          </div>

          {message.securityEvidence.length > 0 ? (
            <ul className="space-y-1.5 pl-1">
              {message.securityEvidence.map((indicator, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-amber-200 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{indicator}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-300/80 italic flex items-center gap-1.5 pl-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>No specific suspicious indicators were detected from the provided content.</span>
            </p>
          )}
        </div>
      )}

      {/* 📚 TRUSTED RESOURCES (Actual RAG Sources from pgvector) */}
      {citations.length > 0 && (
        <div className="rounded-3xl bg-[#071109]/90 border border-emerald-500/20 overflow-hidden shadow-md">
          <div className="p-3.5 flex items-center justify-between border-b border-emerald-500/10">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                📚 Trusted Resources
              </h4>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              {citations.length} Verified {citations.length === 1 ? 'Advisory' : 'Advisories'}
            </span>
          </div>

          <div className="p-3 space-y-2 text-xs">
            {citations.map((c) => (
              <div key={c.id} className="p-3 rounded-2xl bg-black/40 border border-emerald-500/10 space-y-1.5 hover:border-emerald-500/25 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      {c.source}
                    </span>
                    {c.category && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-700/50">
                        {c.category}
                      </span>
                    )}
                    <span className="font-semibold text-emerald-100">{c.title}</span>
                  </div>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 p-1 flex-shrink-0"
                      title={`Official advisory link for ${c.title}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {c.snippet && (
                  <p className="text-[11px] text-zinc-300 leading-relaxed italic pl-1">
                    "{c.snippet}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚨 ALREADY PAID? ASSISTANCE ACTION CARD */}
      <div className="p-3.5 rounded-3xl bg-gradient-to-r from-red-950/40 via-[#130b0b] to-[#08120b] border border-red-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-red-950 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">🚨 Already Paid?</span>
            <span className="text-[11px] text-zinc-400">Transferred money or shared account details? Get immediate guidance.</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openAlreadyPaidModal()}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 border border-red-500/40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0 self-end sm:self-auto"
        >
          <span>Get Help</span>
        </button>
      </div>

      {/* Source Popover Modal when clicking superscript [N] */}
      {activePopoverCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-md w-full p-5 rounded-3xl bg-[#0b160f] border border-emerald-500/30 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-bold">
                  [{activePopoverCitation.id}]
                </span>
                <h4 className="text-sm font-semibold text-emerald-100">{activePopoverCitation.title}</h4>
              </div>
              <button
                onClick={() => setActivePopoverCitation(null)}
                className="text-zinc-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-emerald-400 font-medium">
              Publishing Organization: {activePopoverCitation.source}
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-xl border border-emerald-500/10 italic">
              "{activePopoverCitation.snippet}"
            </p>
            <div className="flex items-center justify-between pt-2">
              {activePopoverCitation.url && (
                <a
                  href={activePopoverCitation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-300 hover:underline flex items-center gap-1.5"
                >
                  <span>Read full official advisory</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                onClick={() => setActivePopoverCitation(null)}
                className="btn-pill-secondary text-xs px-3 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
