"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpeechStore, VoiceOption } from "@/lib/stores/useSpeechStore";
import { prepareSpeechText, splitSpeechChunks } from "./speechFormatter";
import { NeuralVoiceEngine } from "./neuralVoiceEngine";
import { NeuralAudioPlayer } from "./neuralAudioPlayer";
import { Message, StructuredAnswer } from "@/types/chat";

export function useTextToSpeech() {
  const {
    engine,
    neuralStatus,
    neuralProgress,
    selectedNeuralVoice,
    playbackEngine,
    fallbackNotice,
    isTtsSupported,
    activeMessageId,
    playbackStatus,
    speechRate,
    selectedVoiceURI,
    autoReadEnabled,
    availableVoices,
    setEngine,
    setSelectedNeuralVoice,
    setPlaybackEngine,
    setFallbackNotice,
    setActiveMessageId,
    setPlaybackStatus,
    setSpeechRate,
    setSelectedVoiceURI,
    setAutoReadEnabled,
    setAvailableVoices,
    resetPlayback
  } = useSpeechStore();

  // Neural player instance (singleton ref per hook)
  const neuralPlayerRef = useRef<NeuralAudioPlayer | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  // Lazy getter to ensure ref is not read during render
  const getNeuralPlayer = useCallback(() => {
    if (!neuralPlayerRef.current && typeof window !== "undefined") {
      neuralPlayerRef.current = new NeuralAudioPlayer();
    }
    return neuralPlayerRef.current;
  }, []);

  // Browser SpeechSynthesis refs
  const browserChunksRef = useRef<string[]>([]);
  const browserCurrentChunkIndexRef = useRef<number>(0);
  const browserHeartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakCurrentBrowserChunkRef = useRef<() => void>(() => {});

  // Populate browser voices
  const populateVoices = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

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

      if (!selectedVoiceURI) {
        const userLang = typeof navigator !== "undefined" ? navigator.language : "en-US";
        const exactLangVoice = systemVoices.find((v) => v.lang.startsWith(userLang.split("-")[0]));
        const defaultVoice = systemVoices.find((v) => v.default) || exactLangVoice || systemVoices[0];
        if (defaultVoice) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    }
  }, [selectedVoiceURI, setAvailableVoices, setSelectedVoiceURI]);

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
    if (playbackStatus === "playing" && playbackEngine === "browser") {
      browserHeartbeatTimerRef.current = setInterval(() => {
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
      if (browserHeartbeatTimerRef.current) {
        clearInterval(browserHeartbeatTimerRef.current);
        browserHeartbeatTimerRef.current = null;
      }
    }

    return () => {
      if (browserHeartbeatTimerRef.current) {
        clearInterval(browserHeartbeatTimerRef.current);
        browserHeartbeatTimerRef.current = null;
      }
    };
  }, [playbackStatus, playbackEngine]);

  // Stop everything
  const stop = useCallback(() => {
    activeRequestIdRef.current = null;

    // Stop neural player
    const player = getNeuralPlayer();
    if (player) {
      player.stop();
    }
    NeuralVoiceEngine.getInstance().cancel();

    // Stop browser synthesis
    browserChunksRef.current = [];
    browserCurrentChunkIndexRef.current = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    resetPlayback();
  }, [getNeuralPlayer, resetPlayback]);

  // Pause
  const pause = useCallback(() => {
    if (playbackStatus !== "playing") return;

    if (playbackEngine === "neural") {
      getNeuralPlayer()?.pause();
    } else if (playbackEngine === "browser") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.pause();
        } catch {}
      }
    }
    setPlaybackStatus("paused");
  }, [getNeuralPlayer, playbackEngine, playbackStatus, setPlaybackStatus]);

  // Resume
  const resume = useCallback(() => {
    if (playbackStatus !== "paused") return;

    if (playbackEngine === "neural") {
      getNeuralPlayer()?.resume();
    } else if (playbackEngine === "browser") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
    }
    setPlaybackStatus("playing");
  }, [getNeuralPlayer, playbackEngine, playbackStatus, setPlaybackStatus]);

  // Speak via Browser SpeechSynthesis (used directly or as fallback)
  const speakBrowserInternal = useCallback(
    (messageId: string, textToSpeak: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resetPlayback();
        return;
      }

      const chunks = splitSpeechChunks(textToSpeak);
      if (chunks.length === 0) {
        resetPlayback();
        return;
      }

      browserChunksRef.current = chunks;
      browserCurrentChunkIndexRef.current = 0;
      setActiveMessageId(messageId);
      setPlaybackEngine("browser");
      setPlaybackStatus("playing");

      const speakNextBrowserChunk = () => {
        const chunks = browserChunksRef.current;
        const index = browserCurrentChunkIndexRef.current;

        if (index >= chunks.length) {
          resetPlayback();
          return;
        }

        const chunkText = chunks[index];
        if (!chunkText || !chunkText.trim()) {
          browserCurrentChunkIndexRef.current++;
          speakNextBrowserChunk();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunkText);
        utterance.rate = speechRate;
        utterance.pitch = 1.0;

        const systemVoices = window.speechSynthesis.getVoices();
        if (selectedVoiceURI && systemVoices.length > 0) {
          const found = systemVoices.find((v) => v.voiceURI === selectedVoiceURI);
          if (found) utterance.voice = found;
        }

        utterance.onend = () => {
          browserCurrentChunkIndexRef.current++;
          speakNextBrowserChunk();
        };

        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          if (e.error === "canceled" || e.error === "interrupted") return;
          console.warn("Browser Speech error on chunk:", e.error);
          resetPlayback();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakCurrentBrowserChunkRef.current = speakNextBrowserChunk;
      setTimeout(() => speakNextBrowserChunk(), 50);
    },
    [resetPlayback, selectedVoiceURI, setActiveMessageId, setPlaybackEngine, setPlaybackStatus, speechRate]
  );

  // Speak via Neural Engine
  const speakNeuralInternal = useCallback(
    async (messageId: string, textToSpeak: string) => {
      const engineInstance = NeuralVoiceEngine.getInstance();

      if (!engineInstance.isSupported()) {
        setFallbackNotice("Neural TTS unsupported on this browser. Using standard voice.");
        speakBrowserInternal(messageId, textToSpeak);
        return;
      }

      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      activeRequestIdRef.current = requestId;

      setActiveMessageId(messageId);
      setPlaybackEngine("neural");
      setPlaybackStatus("loading");

      // Initialize Kokoro TTS model (downloaded & cached lazily on first call)
      const initialized = await engineInstance.initialize();

      // If user stopped or started another message while loading
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      if (!initialized) {
        setFallbackNotice("Neural voice initialization failed. Falling back to browser speech.");
        speakBrowserInternal(messageId, textToSpeak);
        return;
      }

      const chunks = splitSpeechChunks(textToSpeak);
      if (chunks.length === 0) {
        resetPlayback();
        return;
      }

      const player = getNeuralPlayer();
      if (!player) {
        speakBrowserInternal(messageId, textToSpeak);
        return;
      }

      player.startSession(chunks.length, speechRate);

      player.onStarted = () => {
        if (activeRequestIdRef.current === requestId) {
          setPlaybackStatus("playing");
        }
      };

      player.onEnded = () => {
        if (activeRequestIdRef.current === requestId) {
          resetPlayback();
        }
      };

      player.onError = (err) => {
        console.warn("Neural audio playback error, falling back:", err);
        if (activeRequestIdRef.current === requestId) {
          setFallbackNotice("Audio playback error. Falling back to browser speech.");
          speakBrowserInternal(messageId, textToSpeak);
        }
      };

      // Dispatch pipelined chunk generation to Web Worker
      engineInstance.synthesizeChunks(
        requestId,
        chunks,
        selectedNeuralVoice,
        speechRate,
        (chunkIndex, totalChunks, wavBuffer) => {
          if (activeRequestIdRef.current === requestId) {
            player.enqueueChunk(chunkIndex, totalChunks, wavBuffer);
          }
        },
        (error) => {
          console.warn("Neural synthesis error on chunk:", error);
          if (activeRequestIdRef.current === requestId) {
            setFallbackNotice("Speech synthesis failure. Falling back to browser voice.");
            speakBrowserInternal(messageId, textToSpeak);
          }
        }
      );
    },
    [
      getNeuralPlayer,
      resetPlayback,
      selectedNeuralVoice,
      setActiveMessageId,
      setFallbackNotice,
      setPlaybackEngine,
      setPlaybackStatus,
      speakBrowserInternal,
      speechRate
    ]
  );

  // Main Speak function
  const speak = useCallback(
    (
      messageId: string,
      messageOrText: (Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }) | string
    ) => {
      // If clicking play on currently paused message, resume
      if (activeMessageId === messageId && playbackStatus === "paused") {
        resume();
        return;
      }

      // Stop any existing playback
      stop();

      const textToSpeak =
        typeof messageOrText === "string"
          ? messageOrText
          : prepareSpeechText(messageOrText);

      if (!textToSpeak || !textToSpeak.trim()) {
        return;
      }

      if (engine === "neural") {
        speakNeuralInternal(messageId, textToSpeak);
      } else {
        speakBrowserInternal(messageId, textToSpeak);
      }
    },
    [activeMessageId, engine, playbackStatus, resume, speakBrowserInternal, speakNeuralInternal, stop]
  );

  // Dynamic speech rate update
  const handleSetSpeechRate = useCallback(
    (rate: number) => {
      setSpeechRate(rate);
      getNeuralPlayer()?.setPlaybackRate(rate);
    },
    [getNeuralPlayer, setSpeechRate]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    engine,
    neuralStatus,
    neuralProgress,
    selectedNeuralVoice,
    playbackEngine,
    fallbackNotice,
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
    setEngine,
    setSelectedNeuralVoice,
    setSpeechRate: handleSetSpeechRate,
    setSelectedVoiceURI,
    setAutoReadEnabled,
    setFallbackNotice
  };
}
