import { create } from "zustand";

interface PrivacyGuardState {
  hasDismissedSessionWarning: boolean;
  isWarningModalOpen: boolean;
  pendingUploadAction: (() => void) | null;
  checkAndProceedWithUpload: (onProceed: () => void) => void;
  dismissWarning: () => void;
  openWarningModal: () => void;
}

const SESSION_KEY = "paylume_privacy_dismissed";

export const usePrivacyGuard = create<PrivacyGuardState>((set, get) => ({
  hasDismissedSessionWarning: typeof window !== "undefined" ? !!sessionStorage.getItem(SESSION_KEY) : false,
  isWarningModalOpen: false,
  pendingUploadAction: null,

  checkAndProceedWithUpload: (onProceed) => {
    const { hasDismissedSessionWarning } = get();
    if (hasDismissedSessionWarning) {
      onProceed();
    } else {
      set({
        isWarningModalOpen: true,
        pendingUploadAction: onProceed
      });
    }
  },

  dismissWarning: () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "true");
    }
    const { pendingUploadAction } = get();
    set({
      hasDismissedSessionWarning: true,
      isWarningModalOpen: false,
      pendingUploadAction: null
    });
    if (pendingUploadAction) {
      pendingUploadAction();
    }
  },

  openWarningModal: () => set({ isWarningModalOpen: true })
}));
