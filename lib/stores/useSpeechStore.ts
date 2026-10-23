import { create } from "zustand";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";

interface SpeechState {
  // TTS State (Web Speech API)
  isTtsSupported: boolean;
  activeMessageId: string | null;
  playbackStatus: PlaybackStatus;
  speechRate: number; // 0.8, 1.0, 1.25, 1.5
  autoReadEnabled: boolean;
  playbackEngine: "web-speech" | null;
  ttsError: string | null;

  // STT State (ElevenLabs Scribe via MediaRecorder)
  isSttSupported: boolean;

  // Actions
  setActiveMessageId: (id: string | null) => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setSpeechRate: (rate: number) => void;
  setAutoReadEnabled: (enabled: boolean) => void;
  setTtsSupported: (supported: boolean) => void;
  setSttSupported: (supported: boolean) => void;
  setTtsError: (error: string | null) => void;
  resetPlayback: () => void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  isTtsSupported:
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined",
  activeMessageId: null,
  playbackStatus: "idle",
  speechRate: 1.0,
  autoReadEnabled: false,
  playbackEngine: null,
  ttsError: null,

  isSttSupported:
    typeof window !== "undefined" &&
    Boolean(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    ),

  setActiveMessageId: (id) => set({ activeMessageId: id }),
  setPlaybackStatus: (status) =>
    set({
      playbackStatus: status,
      playbackEngine: status === "idle" ? null : "web-speech"
    }),
  setSpeechRate: (rate) => set({ speechRate: rate }),
  setAutoReadEnabled: (enabled) => set({ autoReadEnabled: enabled }),
  setTtsSupported: (supported) => set({ isTtsSupported: supported }),
  setSttSupported: (supported) => set({ isSttSupported: supported }),
  setTtsError: (error) => set({ ttsError: error }),
  resetPlayback: () =>
    set({
      activeMessageId: null,
      playbackStatus: "idle",
      playbackEngine: null,
      ttsError: null
    })
}));
