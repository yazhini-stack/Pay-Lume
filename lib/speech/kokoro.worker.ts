// Web Worker for client-side Kokoro-82M Neural Text-to-Speech
// Runs on a separate browser thread using ONNX Runtime WebAssembly

import { KokoroTTS } from "kokoro-js";

interface ProgressPayload {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
  progress?: number;
}

interface WorkerScopeWithTransfer {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerScopeWithTransfer;

let ttsInstance: KokoroTTS | null = null;
let isInitializing = false;
let currentRequestId: string | null = null;

// Track file download progress
const fileProgressMap = new Map<string, { loaded: number; total: number }>();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  // 1. Initialize Neural Model lazily
  if (type === "init") {
    if (ttsInstance) {
      workerScope.postMessage({ type: "init-ready" });
      return;
    }

    if (isInitializing) {
      return;
    }

    isInitializing = true;
    try {
      ttsInstance = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        {
          dtype: payload?.dtype || "q8",
          device: "wasm",
          progress_callback: (progressData: ProgressPayload) => {
            if (progressData && progressData.status === "progress") {
              const file = progressData.file || "model";
              const loaded = progressData.loaded || 0;
              const total = progressData.total || 0;

              if (total > 0) {
                fileProgressMap.set(file, { loaded, total });
                let sumLoaded = 0;
                let sumTotal = 0;
                fileProgressMap.forEach((v) => {
                  sumLoaded += v.loaded;
                  sumTotal += v.total;
                });
                const pct = Math.min(99, Math.round((sumLoaded / sumTotal) * 100));
                workerScope.postMessage({
                  type: "init-progress",
                  payload: {
                    percent: pct,
                    file,
                    loaded: sumLoaded,
                    total: sumTotal
                  }
                });
              } else if (typeof progressData.progress === "number") {
                workerScope.postMessage({
                  type: "init-progress",
                  payload: {
                    percent: Math.min(99, Math.round(progressData.progress)),
                    file
                  }
                });
              }
            }
          }
        }
      );

      isInitializing = false;
      workerScope.postMessage({ type: "init-ready" });
    } catch (err: unknown) {
      isInitializing = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      workerScope.postMessage({
        type: "init-error",
        error: errMsg || "Failed to initialize neural TTS model."
      });
    }
    return;
  }

  // 2. Synthesize audio chunk
  if (type === "synthesize-chunk") {
    const { requestId, chunkIndex, totalChunks, text, voice, speed } = payload;
    currentRequestId = requestId;

    if (!ttsInstance) {
      workerScope.postMessage({
        type: "chunk-error",
        payload: {
          requestId,
          chunkIndex,
          error: "Neural TTS model is not initialized."
        }
      });
      return;
    }

    try {
      const rawAudio = await ttsInstance.generate(text, {
        voice: voice || "af_heart",
        speed: speed || 1.0
      });

      // Discard if cancelled while synthesizing
      if (currentRequestId !== requestId) {
        return;
      }

      const wavBuffer = rawAudio.toWav();

      // Transfer the ArrayBuffer with zero-copy
      workerScope.postMessage(
        {
          type: "chunk-ready",
          payload: {
            requestId,
            chunkIndex,
            totalChunks,
            wavBuffer
          }
        },
        [wavBuffer]
      );
    } catch (err: unknown) {
      if (currentRequestId === requestId) {
        const errMsg = err instanceof Error ? err.message : String(err);
        workerScope.postMessage({
          type: "chunk-error",
          payload: {
            requestId,
            chunkIndex,
            error: errMsg || "Failed to generate chunk audio."
          }
        });
      }
    }
    return;
  }

  // 3. Cancel ongoing speech request
  if (type === "cancel") {
    currentRequestId = null;
    return;
  }
};
