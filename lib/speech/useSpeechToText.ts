"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";

export type SttStatus = "idle" | "listening" | "processing" | "success" | "error";
export type SttErrorType =
  | "permission-denied"
  | "unsupported"
  | "network"
  | "no-speech"
  | "audio-capture"
  | "aborted"
  | "unknown";

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: {
    isFinal: boolean;
    [altIndex: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function useSpeechToText() {
  const { sttLanguage, setSttLanguage, isSttSupported, setSttSupported } = useSpeechStore();

  const [status, setStatus] = useState<SttStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SttErrorType | null>(null);

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const baseTextRef = useRef<string>("");
  const onTranscriptUpdateRef = useRef<((fullText: string) => void) | null>(null);
  const isManuallyCancelledRef = useRef<boolean>(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check support on mount
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      Boolean(
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      );
    setSttSupported(supported);
  }, [setSttSupported]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && status === "listening") {
      setStatus("processing");
      try {
        recognitionRef.current.stop();
      } catch {
        setStatus("idle");
      }
    } else {
      setStatus("idle");
    }
  }, [status]);

  const cancelListening = useCallback(() => {
    isManuallyCancelledRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    // Revert to base text
    if (onTranscriptUpdateRef.current) {
      onTranscriptUpdateRef.current(baseTextRef.current);
    }
    setInterimTranscript("");
    setFinalTranscript("");
    setStatus("idle");
    setError(null);
    setErrorType(null);
  }, []);

  const startListening = useCallback(
    (
      currentText: string,
      onTextUpdate: (text: string) => void,
      onBeforeStart?: () => void
    ) => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      setError(null);
      setErrorType(null);
      setInterimTranscript("");
      setFinalTranscript("");
      isManuallyCancelledRef.current = false;

      baseTextRef.current = currentText.trim();
      onTranscriptUpdateRef.current = onTextUpdate;

      const SpeechRecognitionConstructor =
        typeof window !== "undefined"
          ? ((window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition }).SpeechRecognition ||
             (window as unknown as { webkitSpeechRecognition?: new () => WebSpeechRecognition }).webkitSpeechRecognition)
          : null;

      if (!SpeechRecognitionConstructor) {
        setStatus("error");
        setErrorType("unsupported");
        setError("Voice input is not supported by your browser. Please use Chrome, Edge, or Safari.");
        return;
      }

      // Notify caller (e.g. to stop TTS playback before listening)
      if (onBeforeStart) {
        onBeforeStart();
      }

      try {
        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = sttLanguage || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";

        let sessionFinals = "";

        recognition.onstart = () => {
          setStatus("listening");
          setError(null);
          setErrorType(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (result.isFinal) {
              sessionFinals += (sessionFinals ? " " : "") + transcript.trim();
            } else {
              currentInterim += transcript;
            }
          }

          setInterimTranscript(currentInterim);
          setFinalTranscript(sessionFinals);

          // Calculate full composite text
          const currentSessionText = [sessionFinals, currentInterim]
            .filter(Boolean)
            .join(" ")
            .trim();

          const composite = baseTextRef.current
            ? `${baseTextRef.current} ${currentSessionText}`
            : currentSessionText;

          if (onTranscriptUpdateRef.current && currentSessionText) {
            onTranscriptUpdateRef.current(composite);
          }
        };

        recognition.onerror = (event: { error: string }) => {
          if (isManuallyCancelledRef.current) return;

          console.warn("Speech recognition error:", event.error);
          let userMsg = `Speech recognition error (${event.error})`;
          let errType: SttErrorType = "unknown";

          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            userMsg = "Microphone access was denied. Please allow microphone permissions in your browser.";
            errType = "permission-denied";
          } else if (event.error === "network") {
            userMsg = "Network error: unable to reach speech recognition service. Please check connection.";
            errType = "network";
          } else if (event.error === "audio-capture") {
            userMsg = "No working microphone detected. Please check your audio input device.";
            errType = "audio-capture";
          } else if (event.error === "no-speech") {
            userMsg = "No speech was detected. Please try speaking closer to the microphone.";
            errType = "no-speech";
          } else if (event.error === "aborted") {
            // Ignored if cancelled
            return;
          }

          setError(userMsg);
          setErrorType(errType);
          setStatus("error");
        };

        recognition.onend = () => {
          if (isManuallyCancelledRef.current) return;

          // If session finalized with text
          if (sessionFinals) {
            setStatus("success");
            setInterimTranscript("");
            successTimerRef.current = setTimeout(() => {
              setStatus("idle");
            }, 1800);
          } else {
            setInterimTranscript("");
            setStatus((prev) => (prev === "error" ? "error" : "idle"));
          }
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: unknown) {
        console.warn("Failed to initiate SpeechRecognition:", err);
        setStatus("error");
        setErrorType("unknown");
        setError("Could not start microphone. Please check your browser audio permissions.");
      }
    },
    [sttLanguage]
  );

  return {
    status,
    interimTranscript,
    finalTranscript,
    error,
    errorType,
    isSupported: isSttSupported,
    language: sttLanguage,
    setLanguage: setSttLanguage,
    startListening,
    stopListening,
    cancelListening,
    clearError: () => {
      setError(null);
      setErrorType(null);
      setStatus("idle");
    }
  };
}
