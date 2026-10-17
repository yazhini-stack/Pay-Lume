"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { prepareSpeechText } from "./speechFormatter";
import { apiClient } from "@/lib/api/client";
import { Message, StructuredAnswer } from "@/types/chat";

export function useTextToSpeech() {
  const {
    isTtsSupported,
    activeMessageId,
    playbackStatus,
    speechRate,
    autoReadEnabled,
    playbackEngine,
    ttsError,
    setActiveMessageId,
    setPlaybackStatus,
    setSpeechRate,
    setAutoReadEnabled,
    setTtsError,
    resetPlayback
  } = useSpeechStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  // Stop active playback, cancel in-flight request, and clean up blob URLs
  const stop = useCallback(() => {
    activeRequestIdRef.current = null;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onpause = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    resetPlayback();
  }, [resetPlayback]);

  // Pause current audio
  const pause = useCallback(() => {
    if (playbackStatus !== "playing") return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaybackStatus("paused");
  }, [playbackStatus, setPlaybackStatus]);

  // Resume paused audio
  const resume = useCallback(() => {
    if (playbackStatus !== "paused") return;
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.warn("Could not resume audio:", err);
      });
    }
    setPlaybackStatus("playing");
  }, [playbackStatus, setPlaybackStatus]);

  // Main Speak function (temporarily disabled for demo safety)
  const speak = useCallback(
    async (
      _messageId: string,
      _messageOrText: (Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }) | string
    ) => {
      // Temporary demo-safe fix: ElevenLabs TTS disabled completely.
      // Prevent any backend API calls, audio playback, or error displays.
      return;
    },
    []
  );

  // Dynamic speech rate update
  const handleSetSpeechRate = useCallback(
    (rate: number) => {
      setSpeechRate(rate);
      if (audioRef.current) {
        audioRef.current.playbackRate = rate;
      }
    },
    [setSpeechRate]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isTtsSupported,
    activeMessageId,
    playbackStatus,
    speechRate,
    autoReadEnabled,
    playbackEngine,
    ttsError,
    speak,
    pause,
    resume,
    stop,
    setSpeechRate: handleSetSpeechRate,
    setAutoReadEnabled,
    resetPlayback
  };
}
