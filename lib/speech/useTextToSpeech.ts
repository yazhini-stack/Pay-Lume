"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { prepareSpeechText, formatMarkdownForSpeech, splitSpeechChunks } from "./speechFormatter";
import { Message, StructuredAnswer } from "@/types/chat";

/**
 * Selects one fixed English voice, prioritizing high-quality device voices
 * (Natural/Online, Google, Apple) with a reliable fallback to any available
 * English voice or the system default.
 */
function selectEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  // Filter English voices
  const englishVoices = voices.filter((v) => {
    const lang = (v.lang || "").toLowerCase();
    return lang.startsWith("en-") || lang === "en";
  });

  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. Prefer high-quality Natural / Online voices (Edge, Windows, Chrome)
  const naturalVoice = pool.find(
    (v) =>
      v.name.includes("Natural") ||
      v.name.includes("Online (Natural)") ||
      v.name.includes("Neural")
  );
  if (naturalVoice) return naturalVoice;

  // 2. Prefer Google English voices (Chrome)
  const googleVoice = pool.find(
    (v) =>
      v.name.includes("Google") &&
      (v.lang.toLowerCase().startsWith("en-us") || v.lang.toLowerCase().startsWith("en-gb"))
  );
  if (googleVoice) return googleVoice;

  // 3. Prefer Apple premium voices (macOS / iOS)
  const appleVoice = pool.find(
    (v) =>
      v.name.includes("Samantha") ||
      v.name.includes("Daniel") ||
      v.name.includes("Karen") ||
      v.name.includes("Serena")
  );
  if (appleVoice) return appleVoice;

  // 4. Default English voice
  const defaultEn = englishVoices.find((v) => v.default);
  if (defaultEn) return defaultEn;

  // 5. English US preferred
  const enUs = englishVoices.find((v) => v.lang.toLowerCase().startsWith("en-us"));
  if (enUs) return enUs;

  // 6. Any English voice
  if (englishVoices.length > 0) return englishVoices[0];

  // 7. System default or first available voice
  const sysDefault = voices.find((v) => v.default);
  return sysDefault || voices[0] || null;
}

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
    setTtsSupported,
    setTtsError,
    resetPlayback
  } = useSpeechStore();

  // Active utterance references to prevent JavaScript GC from truncating playback
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentMessageIdRef = useRef<string | null>(null);

  // Stop active speech and reset state
  const stop = useCallback(() => {
    currentMessageIdRef.current = null;
    activeUtterancesRef.current = [];

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    resetPlayback();
  }, [resetPlayback]);

  // Pause speech
  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
    setPlaybackStatus("paused");
  }, [setPlaybackStatus]);

  // Resume paused speech
  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    setPlaybackStatus("playing");
  }, [setPlaybackStatus]);

  // Main speak function using native Web Speech API
  const speak = useCallback(
    (
      messageId: string,
      messageOrText: (Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }) | string
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      // Always cancel ongoing speech to prevent overlapping utterances
      window.speechSynthesis.cancel();
      activeUtterancesRef.current = [];

      // Format markdown/content into clean conversational text
      let spokenText = "";
      if (typeof messageOrText === "string") {
        spokenText = formatMarkdownForSpeech(messageOrText);
      } else {
        spokenText = prepareSpeechText(messageOrText);
      }

      spokenText = spokenText.trim();
      if (!spokenText) {
        currentMessageIdRef.current = null;
        resetPlayback();
        return;
      }

      // Split into sentence-length chunks to prevent Chrome utterance stall
      const chunks = splitSpeechChunks(spokenText, 180);
      if (chunks.length === 0) {
        currentMessageIdRef.current = null;
        resetPlayback();
        return;
      }

      currentMessageIdRef.current = messageId;
      setActiveMessageId(messageId);
      setPlaybackStatus("playing");
      setTtsError(null);

      const voice = selectEnglishVoice();
      const rate = speechRate;
      const utterances: SpeechSynthesisUtterance[] = [];

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-US";
        }
        utterance.rate = rate;

        if (index === 0) {
          utterance.onstart = () => {
            if (currentMessageIdRef.current === messageId) {
              setActiveMessageId(messageId);
              setPlaybackStatus("playing");
            }
          };
        }

        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (currentMessageIdRef.current === messageId) {
              currentMessageIdRef.current = null;
              activeUtterancesRef.current = [];
              resetPlayback();
            }
          };
        }

        utterance.onerror = (e) => {
          // Ignore intentional cancellation/interruption
          if (e.error === "canceled" || e.error === "interrupted") {
            return;
          }
          console.warn("Web Speech API synthesis error:", e.error);
          if (currentMessageIdRef.current === messageId) {
            currentMessageIdRef.current = null;
            activeUtterancesRef.current = [];
            setTtsError(e.error || "Speech playback failed");
            resetPlayback();
          }
        };

        utterances.push(utterance);
      });

      // Keep utterance references in ref so garbage collection does not abort audio
      activeUtterancesRef.current = utterances;

      // Speak sequentially via browser speech synthesis queue
      for (const u of utterances) {
        window.speechSynthesis.speak(u);
      }
    },
    [setActiveMessageId, setPlaybackStatus, setTtsError, resetPlayback, speechRate]
  );

  // Dynamic speech rate update
  const handleSetSpeechRate = useCallback(
    (rate: number) => {
      setSpeechRate(rate);
      if (activeUtterancesRef.current.length > 0) {
        for (const u of activeUtterancesRef.current) {
          u.rate = rate;
        }
      }
    },
    [setSpeechRate]
  );

  // Initialize and monitor voice loading
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTtsSupported(false);
      return;
    }

    setTtsSupported(true);

    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };

    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    } else {
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }

    window.speechSynthesis.getVoices();

    return () => {
      if (window.speechSynthesis.removeEventListener) {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      } else {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [setTtsSupported]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      activeUtterancesRef.current = [];
      currentMessageIdRef.current = null;
    };
  }, []);

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
