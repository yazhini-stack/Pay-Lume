"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { useTextToSpeech } from "@/lib/speech/useTextToSpeech";
import { Volume2, Sliders, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceSettingsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    speechRate,
    autoReadEnabled,
    setSpeechRate,
    setAutoReadEnabled
  } = useSpeechStore();

  const { isTtsSupported } = useTextToSpeech();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isTtsSupported) {
    return null;
  }

  const rates = [0.8, 1.0, 1.25, 1.5];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
          autoReadEnabled
            ? "bg-emerald-900/60 border-emerald-400/50 text-emerald-200 shadow-sm"
            : "bg-emerald-950/60 border-emerald-500/25 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400/40"
        )}
        title="Voice & Speech Settings"
        aria-label="Voice & Speech Settings"
        aria-expanded={isOpen}
      >
        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Voice</span>
        <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
          Native
        </span>
        {autoReadEnabled && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Auto-read enabled" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 max-w-sm mx-auto sm:mx-0 p-3.5 sm:p-4 rounded-3xl bg-[#09140d]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl z-50 text-xs space-y-4 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-emerald-100">Voice Settings</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 font-mono">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span>Web Speech</span>
            </div>
          </div>

          {/* Speech Provider Card */}
          <div className="p-3 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-emerald-200 text-[11px]">Speech Provider</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                Native
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 font-medium">
              Web Speech API
            </p>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Device English speech synthesis for assistant responses.
            </p>
          </div>

          {/* Speech Rate Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-300 text-[11px]">Playback Speed</span>
              <span className="font-mono text-emerald-400 text-[11px]">{speechRate}x</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {rates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSpeechRate(rate)}
                  className={cn(
                    "py-1.5 rounded-xl border text-center font-mono text-[11px] transition-all",
                    speechRate === rate
                      ? "bg-emerald-900/70 border-emerald-400/60 text-emerald-200 font-bold shadow-sm"
                      : "bg-black/30 border-emerald-500/15 text-zinc-400 hover:text-zinc-200 hover:bg-emerald-950/40"
                  )}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Auto-read Assistant Answers */}
          <div className="pt-2 border-t border-emerald-500/15">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoReadEnabled}
                onChange={(e) => setAutoReadEnabled(e.target.checked)}
                className="sr-only"
              />
              <div
                className={cn(
                  "mt-0.5 h-4 w-7 rounded-full transition-colors relative shrink-0",
                  autoReadEnabled ? "bg-emerald-500" : "bg-zinc-700"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                    autoReadEnabled ? "translate-x-3" : "translate-x-0"
                  )}
                />
              </div>
              <div className="flex-1">
                <span className="font-medium text-zinc-200 block text-[11px] group-hover:text-emerald-300 transition-colors">
                  Auto-read responses
                </span>
                <span className="text-[10px] text-zinc-400 block leading-relaxed">
                  Automatically read assistant assessments aloud when analysis completes.
                </span>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
