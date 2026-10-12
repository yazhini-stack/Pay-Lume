import { create } from "zustand";
import { DEFAULT_NEURAL_VOICE_ID } from "../speech/neuralVoices";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  isDefault: boolean;
  localService: boolean;
}

export type VoiceEngine = "neural" | "browser";
export type NeuralModelStatus = "unloaded" | "loading" | "ready" | "error" | "unsupported";
export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";

interface SpeechState {
  // Engine Selection & Abstraction
  engine: VoiceEngine;
  neuralStatus: NeuralModelStatus;
  neuralProgress: number | null; // 0-100 percentage
  selectedNeuralVoice: string; // Kokoro voice key e.g. "af_heart"
  playbackEngine: VoiceEngine | null; // Engine actually generating current audio
  fallbackNotice: string | null;

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
  setEngine: (engine: VoiceEngine) => void;
  setNeuralStatus: (status: NeuralModelStatus) => void;
  setNeuralProgress: (progress: number | null) => void;
  setSelectedNeuralVoice: (voiceId: string) => void;
  setPlaybackEngine: (engine: VoiceEngine | null) => void;
  setFallbackNotice: (notice: string | null) => void;

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
  engine: "neural",
  neuralStatus: "unloaded",
  neuralProgress: null,
  selectedNeuralVoice: DEFAULT_NEURAL_VOICE_ID,
  playbackEngine: null,
  fallbackNotice: null,

  isTtsSupported: true, // Will be checked on client (Web Speech API or WebAssembly supported)
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

  setEngine: (engine) => set({ engine, fallbackNotice: null }),
  setNeuralStatus: (status) => set({ neuralStatus: status }),
  setNeuralProgress: (progress) => set({ neuralProgress: progress }),
  setSelectedNeuralVoice: (voiceId) => set({ selectedNeuralVoice: voiceId }),
  setPlaybackEngine: (engine) => set({ playbackEngine: engine }),
  setFallbackNotice: (notice) => set({ fallbackNotice: notice }),

  setTtsSupported: (supported) => set({ isTtsSupported: supported }),
  setActiveMessageId: (id) => set({ activeMessageId: id }),
  setPlaybackStatus: (status) => set({ playbackStatus: status }),
  setSpeechRate: (rate) => set({ speechRate: rate }),
  setSelectedVoiceURI: (uri) => set({ selectedVoiceURI: uri }),
  setAutoReadEnabled: (enabled) => set({ autoReadEnabled: enabled }),
  setAvailableVoices: (voices) => set({ availableVoices: voices }),
  setSttSupported: (supported) => set({ isSttSupported: supported }),
  setSttLanguage: (lang) => set({ sttLanguage: lang }),
  resetPlayback: () =>
    set({
      activeMessageId: null,
      playbackStatus: "idle",
      playbackEngine: null,
      fallbackNotice: null
    })
}));
