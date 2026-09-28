import { create } from "zustand";
import { EvidencePayload, ExtractedContext } from "@/types/evidence";
import { RAGStatus, MessageSection, StructuredAnswer, Citation } from "@/types/chat";

interface ChatState {
  activeConversationId: string | null;
  activeEvidence: EvidencePayload | null;
  activeExtractedContext: ExtractedContext | null;

  // Streaming state
  isStreaming: boolean;
  streamingStatus: { step: RAGStatus; message: string } | null;
  streamingContent: string;
  streamingSections: Partial<StructuredAnswer>;
  streamingCitations: Citation[];
  streamingSecurityEvidence: string[];
  abortController: AbortController | null;

  // Layout state
  isEvidencePanelOpen: boolean;
  isSidebarOpen: boolean;
  isAlreadyPaidModalOpen: boolean;
  prefilledQuestion: string | null;

  // Status & Error state
  uploadProgress: number | null;
  uploadError: string | null;
  streamError: string | null;
  isRateLimited: boolean;
  isOffline: boolean;

  // Actions
  setActiveConversationId: (id: string | null) => void;
  setActiveEvidence: (evidence: EvidencePayload | null, extracted?: ExtractedContext) => void;
  setStreaming: (isStreaming: boolean) => void;
  setStreamingStatus: (status: { step: RAGStatus; message: string } | null) => void;
  appendStreamingToken: (delta: string, section?: MessageSection) => void;
  addStreamingCitation: (citation: Citation) => void;
  setStreamingSecurityEvidence: (evidence: string[]) => void;
  resetStreaming: () => void;
  stopStreaming: () => void;
  setAbortController: (ctrl: AbortController | null) => void;
  toggleEvidencePanel: (open?: boolean) => void;
  toggleSidebar: (open?: boolean) => void;
  openAlreadyPaidModal: () => void;
  closeAlreadyPaidModal: () => void;
  setPrefilledQuestion: (question: string | null) => void;
  setUploadProgress: (pct: number | null) => void;
  setUploadError: (err: string | null) => void;
  setStreamError: (err: string | null) => void;
  setRateLimited: (isLimited: boolean) => void;
  setOffline: (isOffline: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  activeEvidence: null,
  activeExtractedContext: null,

  isStreaming: false,
  streamingStatus: null,
  streamingContent: "",
  streamingSections: {},
  streamingCitations: [],
  streamingSecurityEvidence: [],
  abortController: null,

  isEvidencePanelOpen: true,
  isSidebarOpen: true,
  isAlreadyPaidModalOpen: false,
  prefilledQuestion: null,

  uploadProgress: null,
  uploadError: null,
  streamError: null,
  isRateLimited: false,
  isOffline: false,

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  setActiveEvidence: (evidence, extracted) => set({ 
    activeEvidence: evidence,
    activeExtractedContext: extracted || evidence?.extractedContext || null
  }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setStreamingStatus: (status) => set({ streamingStatus: status }),

  appendStreamingToken: (delta, section) => set((state) => {
    if (section) {
      return {
        streamingSections: {
          ...state.streamingSections,
          [section]: (state.streamingSections[section] || "") + delta
        }
      };
    }
    return {
      streamingContent: state.streamingContent + delta
    };
  }),

  addStreamingCitation: (citation) => set((state) => {
    if (state.streamingCitations.some((c) => c.id === citation.id)) return state;
    return {
      streamingCitations: [...state.streamingCitations, citation]
    };
  }),

  setStreamingSecurityEvidence: (evidence) => set({ streamingSecurityEvidence: evidence }),

  resetStreaming: () => set({
    isStreaming: false,
    streamingStatus: null,
    streamingContent: "",
    streamingSections: {},
    streamingCitations: [],
    streamingSecurityEvidence: [],
    abortController: null,
    streamError: null
  }),

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isStreaming: false,
      abortController: null
    });
  },

  setAbortController: (ctrl) => set({ abortController: ctrl }),

  toggleEvidencePanel: (open) => set((state) => ({
    isEvidencePanelOpen: open !== undefined ? open : !state.isEvidencePanelOpen
  })),

  toggleSidebar: (open) => set((state) => ({
    isSidebarOpen: open !== undefined ? open : !state.isSidebarOpen
  })),

  openAlreadyPaidModal: () => set({ isAlreadyPaidModalOpen: true }),
  closeAlreadyPaidModal: () => set({ isAlreadyPaidModalOpen: false }),
  setPrefilledQuestion: (question) => set({ prefilledQuestion: question }),

  setUploadProgress: (pct) => set({ uploadProgress: pct }),
  setUploadError: (err) => set({ uploadError: err }),
  setStreamError: (err) => set({ streamError: err }),
  setRateLimited: (isLimited) => set({ isRateLimited: isLimited }),
  setOffline: (isOffline) => set({ isOffline })
}));
