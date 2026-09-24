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
  QrCode, 
  Globe, 
  FileText, 
  ImageIcon,
  Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
  onSelectSampleEvidence?: (type: "qr" | "url" | "message" | "screenshot") => void;
  onRetryStream?: () => void;
}

export function MessageThread({
  messages,
  isLoading,
  onSelectSampleEvidence,
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
          // Empty state: onboarding cues and sample scenarios
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12 space-y-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-[#2d7850] to-[#0c2215] border border-emerald-500/30 flex items-center justify-center text-emerald-300 shadow-[0_0_35px_rgba(45,120,80,0.35)]">
                <Shield className="h-8 w-8" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#060b08] border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-[10px]">
                <Sparkles className="h-3 w-3" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-semibold text-emerald-100 tracking-tight">
                Upload. Ask. Understand.
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                Paylume helps you inspect suspicious payment requests, QR barcodes, SMS alerts, and invoices with clinical clarity.
              </p>
            </div>

            {/* Quick Starter Sample Evidence */}
            {onSelectSampleEvidence && (
              <div className="w-full pt-4 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                  Or load a verified test case:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  <button
                    onClick={() => onSelectSampleEvidence("qr")}
                    className="p-3 rounded-2xl bg-[#09150d] border border-emerald-500/15 hover:border-emerald-400/40 hover:bg-[#0e2114] transition-all text-xs space-y-1 group"
                  >
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold group-hover:text-emerald-200">
                      <QrCode className="h-4 w-4 text-emerald-400" />
                      <span>Tampered Parking QR</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">Adhesive sticker masquerading as municipal parking</p>
                  </button>

                  <button
                    onClick={() => onSelectSampleEvidence("url")}
                    className="p-3 rounded-2xl bg-[#09150d] border border-emerald-500/15 hover:border-emerald-400/40 hover:bg-[#0e2114] transition-all text-xs space-y-1 group"
                  >
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold group-hover:text-emerald-200">
                      <Globe className="h-4 w-4 text-emerald-400" />
                      <span>Spoofed Bank Domain</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">Lookalike banking link on newly registered TLD</p>
                  </button>

                  <button
                    onClick={() => onSelectSampleEvidence("message")}
                    className="p-3 rounded-2xl bg-[#09150d] border border-emerald-500/15 hover:border-emerald-400/40 hover:bg-[#0e2114] transition-all text-xs space-y-1 group"
                  >
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold group-hover:text-emerald-200">
                      <FileText className="h-4 w-4 text-emerald-400" />
                      <span>Urgent Power Disconnect SMS</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">Utility cutoff threat from personal phone number</p>
                  </button>

                  <button
                    onClick={() => onSelectSampleEvidence("screenshot")}
                    className="p-3 rounded-2xl bg-[#09150d] border border-emerald-500/15 hover:border-emerald-400/40 hover:bg-[#0e2114] transition-all text-xs space-y-1 group"
                  >
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold group-hover:text-emerald-200">
                      <ImageIcon className="h-4 w-4 text-emerald-400" />
                      <span>Forged Escrow Receipt</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">Advance-fee payment release requirement</p>
                  </button>
                </div>
              </div>
            )}
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
