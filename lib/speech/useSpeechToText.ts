"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSpeechStore } from "@/lib/stores/useSpeechStore";
import { apiClient } from "@/lib/api/client";

export type SttStatus = "idle" | "listening" | "processing" | "success" | "error";
export type SttErrorType =
  | "permission-denied"
  | "unsupported"
  | "network"
  | "no-speech"
  | "audio-capture"
  | "aborted"
  | "unknown";

export function useSpeechToText() {
  const { isSttSupported, setSttSupported } = useSpeechStore();

  const [status, setStatus] = useState<SttStatus>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SttErrorType | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const baseTextRef = useRef<string>("");
  const onTranscriptUpdateRef = useRef<((fullText: string) => void) | null>(null);
  const isManuallyCancelledRef = useRef<boolean>(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone & MediaRecorder support on mount
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      Boolean(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof MediaRecorder !== "undefined"
      );
    setSttSupported(supported);
  }, [setSttSupported]);

  // Clean up all audio tracks and timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const cancelListening = useCallback(() => {
    isManuallyCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setInterimTranscript("");
    setFinalTranscript("");
    setStatus("idle");
    setError(null);
    setErrorType(null);
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && status === "listening") {
      setStatus("processing");
      setInterimTranscript("");
      try {
        mediaRecorderRef.current.stop();
      } catch {
        setStatus("idle");
      }
    } else {
      setStatus("idle");
    }
  }, [status]);

  const startListening = useCallback(
    async (
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
      chunksRef.current = [];

      baseTextRef.current = currentText.trim();
      onTranscriptUpdateRef.current = onTextUpdate;

      const hasMediaSupport =
        typeof window !== "undefined" &&
        Boolean(
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === "function" &&
          typeof MediaRecorder !== "undefined"
        );

      if (!hasMediaSupport) {
        setStatus("error");
        setErrorType("unsupported");
        setError("Audio recording is not supported by your browser. Please use Chrome, Edge, Safari, or Firefox.");
        return;
      }

      // Notify caller (e.g. to stop active TTS playback before recording)
      if (onBeforeStart) {
        onBeforeStart();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
      } catch (err: unknown) {
        console.warn("Microphone access error:", err);
        setStatus("error");
        const isDenied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setErrorType(isDenied ? "permission-denied" : "audio-capture");
        setError(
          isDenied
            ? "Microphone access was denied. Please allow microphone permissions in your browser."
            : "No working microphone detected. Please check your audio input device."
        );
        return;
      }

      try {
        let mimeType = "";
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          // Release microphone tracks immediately
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          if (isManuallyCancelledRef.current) {
            chunksRef.current = [];
            return;
          }

          if (chunksRef.current.length === 0) {
            setStatus("idle");
            return;
          }

          const recordedBlob = new Blob(chunksRef.current, {
            type: mimeType || "audio/webm"
          });
          chunksRef.current = [];

          if (recordedBlob.size < 1000) {
            setStatus("error");
            setErrorType("no-speech");
            setError("No speech was detected. Please hold the button or speak clearly into the microphone.");
            return;
          }

          try {
            setStatus("processing");
            const transcribed = await apiClient.transcribeAudio(recordedBlob);

            if (!transcribed || !transcribed.trim()) {
              setStatus("error");
              setErrorType("no-speech");
              setError("No speech was recognized. Please try speaking closer to the microphone.");
              return;
            }

            const cleanText = transcribed.trim();
            setFinalTranscript(cleanText);

            const composite = baseTextRef.current
              ? `${baseTextRef.current} ${cleanText}`
              : cleanText;

            if (onTranscriptUpdateRef.current) {
              onTranscriptUpdateRef.current(composite);
            }

            setStatus("success");
            successTimerRef.current = setTimeout(() => {
              setStatus("idle");
            }, 1800);
          } catch (err: unknown) {
            console.error("Transcription error:", err);
            const errMsg = err instanceof Error ? err.message : "Failed to transcribe speech.";
            setStatus("error");
            setErrorType("network");
            setError(errMsg);
          }
        };

        recorder.start(250);
        setStatus("listening");
        setInterimTranscript("Listening... speak now into your microphone");
      } catch (err: unknown) {
        console.error("Failed to start MediaRecorder:", err);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        setStatus("error");
        setErrorType("unknown");
        setError("Could not start audio recording. Please check browser permissions.");
      }
    },
    []
  );

  return {
    status,
    interimTranscript,
    finalTranscript,
    error,
    errorType,
    isSupported: isSttSupported,
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
