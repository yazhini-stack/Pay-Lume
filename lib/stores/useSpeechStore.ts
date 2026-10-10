import { create } from "zustand";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  isDefault: boolean;
  localService: boolean;
}

export type PlaybackStatus = "idle" | "playing" | "paused";

interface SpeechState {
  // TTS State
  isTtsSupported: boolean;
  activeMessageId: string | null;
  playbackStatus: PlaybackStatus;
  speechRate: number; // 0.8, 1.0, 1.25, 1.5
  selectedVoiceURI: string | null;
  autoReadEnabled: boolean;
  availableVoices: VoiceOption[];

  // STT State
  isSttSupported: boolean;
  sttLanguage: string;

  // Actions
  setTtsSupported: (supported: boolean) => void;
  setActiveMessageId: (id: string | null) => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setSpeechRate: (rate: number) => void;
  setSelectedVoiceURI: (uri: string | null) => void;
  setAutoReadEnabled: (enabled: boolean) => void;
  setAvailableVoices: (voices: VoiceOption[]) => void;
  setSttSupported: (supported: boolean) => void;
  setSttLanguage: (lang: string) => void;
  resetPlayback: () => void;
}

export const useSpeechStore = create<SpeechState>((set) => ({
  isTtsSupported: typeof window !== "undefined" && "speechSynthesis" in window,
  activeMessageId: null,
  playbackStatus: "idle",
  speechRate: 1.0,
  selectedVoiceURI: null,
  autoReadEnabled: false,
  availableVoices: [],

  isSttSupported:
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    ),
  sttLanguage: typeof navigator !== "undefined" ? (navigator.language || "en-US") : "en-US",

  setTtsSupported: (supported) => set({ isTtsSupported: supported }),
  setActiveMessageId: (id) => set({ activeMessageId: id }),
  setPlaybackStatus: (status) => set({ playbackStatus: status }),
  setSpeechRate: (rate) => set({ speechRate: rate }),
  setSelectedVoiceURI: (uri) => set({ selectedVoiceURI: uri }),
  setAutoReadEnabled: (enabled) => set({ autoReadEnabled: enabled }),
  setAvailableVoices: (voices) => set({ availableVoices: voices }),
  setSttSupported: (supported) => set({ isSttSupported: supported }),
  setSttLanguage: (lang) => set({ sttLanguage: lang }),
  resetPlayback: () => set({ activeMessageId: null, playbackStatus: "idle" })
}));
