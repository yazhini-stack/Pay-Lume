"use client";

import React, { useEffect, useRef, useState } from "react";
import { Message } from "@/types/chat";
import { MessageItem } from "./MessageItem";
import { RAGPipelineIndicator } from "./RAGPipelineIndicator";
import { StreamingControls } from "./StreamingControls";
import { useChatStore } from "@/lib/stores/useChatStore";
import { MessageItemSkeleton } from "@/components/ui/Skeleton";
import { 
  Shield, 
  ArrowDown, 
  WifiOff, 
  AlertCircle, 
  Sparkles,
  Upload,
  HelpCircle,
  ShieldCheck,
  ImageIcon,
  QrCode,
  Globe,
  MessageSquare,
  Receipt,
  Mic
} from "lucide-react";

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
  onRetryStream?: () => void;
}

export function MessageThread({
  messages,
  isLoading,
  onRetryStream
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const {
    isStreaming,
    streamingStatus,
    streamingContent,
    streamingSections,
    streamingCitations,
    streamingSecurityEvidence,
    isOffline,
    isRateLimited,
    streamError,
    setStreamError,
    activeEvidence
  } = useChatStore();

  // Auto-scroll on new messages or streaming tokens
  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, streamingContent, streamingSections]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden">
      {/* Offline & Rate Limit Banners */}
      {isOffline && (
        <div className="p-3 bg-zinc-900/90 border-b border-zinc-700 text-zinc-300 text-xs flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-400" />
          <span>You are currently working in offline mode. Local mock data is active.</span>
        </div>
      )}

      {isRateLimited && (
        <div className="p-3 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <span>Rate limit reached: Maximum queries per minute exceeded. Please pause briefly.</span>
        </div>
      )}

      {/* Scrollable Message List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6"
      >
        {isLoading ? (
          <div className="space-y-6 max-w-3xl mx-auto py-8">
            <MessageItemSkeleton />
            <MessageItemSkeleton />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          // Refined Homepage Empty State
          <div className="min-h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto py-6 sm:py-8 space-y-7 sm:space-y-8 select-none">
            {/* Hero Section */}
            <div className="flex flex-col items-center space-y-3.5 max-w-2xl">
              {/* Luminous Emerald Shield Badge */}
              <div className="relative mb-1">
                <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-[#2d7850] to-[#0c2215] border border-emerald-500/30 flex items-center justify-center text-emerald-300 shadow-[0_0_35px_rgba(45,120,80,0.35)]">
                  <Shield className="h-8 w-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#060b08] border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-[10px]">
                  <Sparkles className="h-3 w-3" />
                </div>
              </div>

              {/* Main Heading */}
              <h1 className="text-2xl sm:text-3xl font-semibold text-emerald-100 tracking-tight">
                Upload. Ask. Understand.
              </h1>

              {/* Primary Supporting Text */}
              <p className="text-sm sm:text-[15px] text-zinc-300 leading-relaxed max-w-2xl font-normal">
                Pay-Lume helps you inspect suspicious payment requests, QR codes, SMS alerts, invoices, and links — using AI-powered analysis and security evidence to help you understand what’s really happening.
              </p>

              {/* Secondary Smaller Supporting Line */}
              <p className="text-xs sm:text-sm text-zinc-400 leading-normal max-w-lg">
                Upload a screenshot or photo, paste a suspicious link or message, and ask your question.
              </p>

              {/* Trust & Action Statement */}
              <div className="pt-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/25 text-emerald-300 text-xs font-medium shadow-sm tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Know before you pay.</span>
                </div>
              </div>
            </div>

            {/* How Pay-Lume Works Section */}
            <div className="w-full space-y-3 pt-1">
              <div className="text-center">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                  How Pay-Lume works
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                {/* 01 — Upload */}
                <div className="p-4 rounded-2xl bg-[#09150d]/80 border border-emerald-500/15 hover:border-emerald-500/30 hover:bg-[#0c1d12]/90 transition-all space-y-2 backdrop-blur-sm group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/25">
                      01
                    </span>
                    <Upload className="h-4 w-4 text-emerald-400/70 group-hover:text-emerald-300 transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-100 group-hover:text-emerald-200">
                    Upload
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Add a screenshot, photo, QR code, invoice, suspicious message, or link.
                  </p>
                </div>

                {/* 02 — Ask */}
                <div className="p-4 rounded-2xl bg-[#09150d]/80 border border-emerald-500/15 hover:border-emerald-500/30 hover:bg-[#0c1d12]/90 transition-all space-y-2 backdrop-blur-sm group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/25">
                      02
                    </span>
                    <HelpCircle className="h-4 w-4 text-emerald-400/70 group-hover:text-emerald-300 transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-100 group-hover:text-emerald-200">
                    Ask
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Ask Pay-Lume whether the content looks safe, suspicious, or potentially fraudulent.
                  </p>
                </div>

                {/* 03 — Understand */}
                <div className="p-4 rounded-2xl bg-[#09150d]/80 border border-emerald-500/15 hover:border-emerald-500/30 hover:bg-[#0c1d12]/90 transition-all space-y-2 backdrop-blur-sm group">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/25">
                      03
                    </span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400/70 group-hover:text-emerald-300 transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-100 group-hover:text-emerald-200">
                    Understand
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Get detected security indicators, supporting evidence, and a recommended action.
                  </p>
                </div>
              </div>
            </div>

            {/* What You Can Check Section */}
            <div className="w-full space-y-2.5 pt-0.5">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                  What you can check
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Screenshots & Photos</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <QrCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>QR Codes</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Links & URLs</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Messages & SMS</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <Receipt className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Payment Invoices</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09150d]/70 border border-emerald-500/15 text-xs text-zinc-300 font-medium hover:border-emerald-500/30 transition-colors">
                  <Mic className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Voice Questions</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} />
            ))}

            {/* Live Streaming Message */}
            {isStreaming && (
              <div className="space-y-4 max-w-3xl mr-auto">
                <RAGPipelineIndicator status={streamingStatus} />

                {(streamingContent || streamingSections.observed || streamingSections.interpretation || streamingSections.actions) && (
                  <MessageItem
                    message={{
                      id: "msg-streaming-live",
                      conversationId: "live",
                      role: "assistant",
                      content: streamingContent,
                      sections: streamingSections,
                      citations: streamingCitations,
                      securityEvidence: streamingSecurityEvidence,
                      createdAt: new Date().toISOString()
                    }}
                  />
                )}

                <StreamingControls onRetry={onRetryStream} />
              </div>
            )}

            {streamError && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-3 my-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-red-100">Unable to generate response</div>
                  <div className="text-zinc-300 leading-relaxed">{streamError}</div>
                </div>
                {onRetryStream && (
                  <button
                    onClick={() => {
                      setStreamError(null);
                      onRetryStream();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-xs font-medium text-red-200 border border-red-500/30 transition-all shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-8 p-2.5 rounded-full bg-[#0e2114]/90 border border-emerald-500/30 text-emerald-300 shadow-xl backdrop-blur-md hover:bg-emerald-900 transition-all z-10"
          title="Scroll to latest"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
