"use client";

import React from "react";
import { useChatStore } from "@/lib/stores/useChatStore";
import { Square, RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface StreamingControlsProps {
  onRetry?: () => void;
}

export function StreamingControls({ onRetry }: StreamingControlsProps) {
  const { isStreaming, stopStreaming, streamError, setStreamError } = useChatStore();

  if (isStreaming) {
    return (
      <div className="flex items-center justify-center my-2">
        <button
          onClick={stopStreaming}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 text-xs font-medium backdrop-blur-md transition-all shadow-lg active:scale-95"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          <span>Stop Analysis Generation</span>
        </button>
      </div>
    );
  }

  if (streamError) {
    return (
      <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3 my-2 animate-in fade-in">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span>{streamError}</span>
        </div>
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={() => {
                setStreamError(null);
                onRetry();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-900/60 text-white hover:bg-red-800 text-xs font-medium"
            >
              <RotateCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
          <button
            onClick={() => setStreamError(null)}
            className="text-zinc-400 hover:text-white p-1 text-xs"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
