"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechStore, VoiceOption } from "@/lib/stores/useSpeechStore";
import { prepareSpeechText, splitSpeechChunks } from "./speechFormatter";
import { Message, StructuredAnswer } from "@/types/chat";

export function useTextToSpeech() {
  const {
    isTtsSupported,
    activeMessageId,
    playbackStatus,
    speechRate,
    selectedVoiceURI,
    autoReadEnabled,
    availableVoices,
    setTtsSupported,
    setActiveMessageId,
    setPlaybackStatus,
    setSpeechRate,
    setSelectedVoiceURI,
    setAutoReadEnabled,
    setAvailableVoices,
    resetPlayback
  } = useSpeechStore();

  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const activeMessageIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakCurrentChunkRef = useRef<() => void>(() => {});

  // Sync ref
  useEffect(() => {
    activeMessageIdRef.current = activeMessageId;
    isPlayingRef.current = playbackStatus === "playing";
  }, [activeMessageId, playbackStatus]);

  // Load and cache voices
  const populateVoices = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTtsSupported(false);
      return;
    }

    setTtsSupported(true);
    const systemVoices = window.speechSynthesis.getVoices();
    if (systemVoices && systemVoices.length > 0) {
      const formatted: VoiceOption[] = systemVoices.map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        isDefault: v.default,
        localService: v.localService
      }));

      setAvailableVoices(formatted);

      // If no voice is selected yet, choose a suitable default
      if (!selectedVoiceURI) {
        // Look for default voice or matching natural/english voice
        const userLang = typeof navigator !== "undefined" ? navigator.language : "en-US";
        const exactLangVoice = systemVoices.find((v) => v.lang.startsWith(userLang.split("-")[0]));
        const defaultVoice = systemVoices.find((v) => v.default) || exactLangVoice || systemVoices[0];
        if (defaultVoice) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    }
  }, [selectedVoiceURI, setAvailableVoices, setSelectedVoiceURI, setTtsSupported]);

  useEffect(() => {
    populateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [populateVoices]);

  // Keep-alive heartbeat for Chrome speech synthesis bug
  useEffect(() => {
    if (playbackStatus === "playing") {
      heartbeatTimerRef.current = setInterval(() => {
        if (
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          window.speechSynthesis.speaking &&
          !window.speechSynthesis.paused
        ) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    } else {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [playbackStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      resetPlayback();
    };
  }, [resetPlayback]);

  // Internal helper to play current chunk index
  const speakCurrentChunk = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const chunks = chunksRef.current;
    const index = currentChunkIndexRef.current;

    if (index >= chunks.length) {
      // Done speaking all chunks
      resetPlayback();
      return;
    }

    const chunkText = chunks[index];
    if (!chunkText || !chunkText.trim()) {
      currentChunkIndexRef.current++;
      speakCurrentChunkRef.current();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    // Attach selected voice if available
    const systemVoices = window.speechSynthesis.getVoices();
    if (selectedVoiceURI && systemVoices.length > 0) {
      const foundVoice = systemVoices.find((v) => v.voiceURI === selectedVoiceURI);
      if (foundVoice) {
        utterance.voice = foundVoice;
      }
    }

    utterance.onend = () => {
      // Move to next chunk if still in playing state for this message
      if (activeMessageIdRef.current) {
        currentChunkIndexRef.current++;
        speakCurrentChunkRef.current();
      }
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      // Cancelled or interrupted by user action is normal
      if (e.error === "canceled" || e.error === "interrupted") {
        return;
      }
      console.warn("Speech synthesis error on chunk:", e.error);
      resetPlayback();
    };

    window.speechSynthesis.speak(utterance);
  }, [resetPlayback, selectedVoiceURI, speechRate]);

  // Keep ref up to date
  useEffect(() => {
    speakCurrentChunkRef.current = speakCurrentChunk;
  }, [speakCurrentChunk]);

  // Stop playback cleanly
  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      chunksRef.current = [];
      currentChunkIndexRef.current = 0;
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn("Error stopping speech synthesis:", err);
    }
    resetPlayback();
  }, [resetPlayback]);

  // Pause playback
  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.pause();
      setPlaybackStatus("paused");
    } catch (err) {
      console.warn("Error pausing speech synthesis:", err);
    }
  }, [setPlaybackStatus]);

  // Resume playback
  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.resume();
      setPlaybackStatus("playing");
    } catch (err) {
      console.warn("Error resuming speech synthesis:", err);
    }
  }, [setPlaybackStatus]);

  // Main Speak function
  const speak = useCallback(
    (
      messageId: string,
      messageOrText: (Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }) | string
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      // If clicking play on the currently paused message, simply resume
      if (activeMessageId === messageId && playbackStatus === "paused") {
        resume();
        return;
      }

      // If already playing another message or re-triggering this one, stop previous first
      stop();

      const textToSpeak =
        typeof messageOrText === "string"
          ? messageOrText
          : prepareSpeechText(messageOrText);

      if (!textToSpeak || !textToSpeak.trim()) {
        return;
      }

      const chunks = splitSpeechChunks(textToSpeak);
      if (chunks.length === 0) {
        return;
      }

      chunksRef.current = chunks;
      currentChunkIndexRef.current = 0;
      setActiveMessageId(messageId);
      setPlaybackStatus("playing");

      // Small tick timeout to ensure previous cancel settled in browser
      setTimeout(() => {
        speakCurrentChunk();
      }, 50);
    },
    [activeMessageId, playbackStatus, resume, speakCurrentChunk, stop, setActiveMessageId, setPlaybackStatus]
  );

  return {
    isTtsSupported,
    activeMessageId,
    playbackStatus,
    speechRate,
    selectedVoiceURI,
    autoReadEnabled,
    availableVoices,
    speak,
    pause,
    resume,
    stop,
    setSpeechRate,
    setSelectedVoiceURI,
    setAutoReadEnabled
  };
}
