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

  // Main Speak function
  const speak = useCallback(
    async (
      messageId: string,
      messageOrText: (Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }) | string
    ) => {
      // If clicking play on currently paused message, resume
      if (activeMessageId === messageId && playbackStatus === "paused") {
        resume();
        return;
      }

      // Stop any existing playback and in-flight fetch
      stop();
      setTtsError(null);

      const textToSpeak =
        typeof messageOrText === "string"
          ? messageOrText
          : prepareSpeechText(messageOrText);

      if (!textToSpeak || !textToSpeak.trim()) {
        return;
      }

      const requestId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      activeRequestIdRef.current = requestId;

      setActiveMessageId(messageId);
      setPlaybackStatus("loading");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const audioBlob = await apiClient.synthesizeSpeech(textToSpeak, abortController.signal);

        // Discard if cancelled or user started another message while loading
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audio.playbackRate = speechRate;
        audioRef.current = audio;

        audio.onplay = () => {
          if (activeRequestIdRef.current === requestId) {
            setPlaybackStatus("playing");
          }
        };

        audio.onpause = () => {
          if (activeRequestIdRef.current === requestId && !audio.ended && audio.currentTime > 0) {
            setPlaybackStatus("paused");
          }
        };

        audio.onended = () => {
          if (activeRequestIdRef.current === requestId) {
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = null;
            }
            resetPlayback();
          }
        };

        audio.onerror = (e) => {
          console.warn("ElevenLabs audio playback error:", e);
          if (activeRequestIdRef.current === requestId) {
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = null;
            }
            resetPlayback();
          }
        };

        await audio.play();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const errorMsg = err instanceof Error ? err.message : "Speech synthesis failed.";
        console.error("ElevenLabs TTS synthesis error:", err);
        if (activeRequestIdRef.current === requestId) {
          setTtsError(errorMsg);
          setPlaybackStatus("idle");
        }
      }
    },
    [activeMessageId, playbackStatus, resetPlayback, resume, setActiveMessageId, setPlaybackStatus, setTtsError, speechRate, stop]
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
