import { useSpeechStore } from "@/lib/stores/useSpeechStore";

export class NeuralVoiceEngine {
  private static instance: NeuralVoiceEngine | null = null;
  private worker: Worker | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private activeRequestId: string | null = null;
  private chunkReadyListeners: Map<
    string,
    (payload: { chunkIndex: number; totalChunks: number; wavBuffer: ArrayBuffer }) => void
  > = new Map();
  private chunkErrorListeners: Map<string, (error: string) => void> = new Map();

  private constructor() {}

  public static getInstance(): NeuralVoiceEngine {
    if (!NeuralVoiceEngine.instance) {
      NeuralVoiceEngine.instance = new NeuralVoiceEngine();
    }
    return NeuralVoiceEngine.instance;
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
    const hasWorker = typeof Worker === "function";
    return Boolean(hasWasm && hasWorker);
  }

  public async initialize(): Promise<boolean> {
    if (!this.isSupported()) {
      useSpeechStore.getState().setNeuralStatus("unsupported");
      return false;
    }

    if (useSpeechStore.getState().neuralStatus === "ready" && this.worker) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        this.isInitializing = true;
        useSpeechStore.getState().setNeuralStatus("loading");
        useSpeechStore.getState().setNeuralProgress(0);

        this.worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), {
          type: "module"
        });

        this.worker.onmessage = (e: MessageEvent) => {
          const { type, payload, error } = e.data;

          if (type === "init-progress") {
            const pct = payload?.percent ?? 0;
            useSpeechStore.getState().setNeuralProgress(pct);
          } else if (type === "init-ready") {
            this.isInitializing = false;
            useSpeechStore.getState().setNeuralStatus("ready");
            useSpeechStore.getState().setNeuralProgress(null);
            resolve(true);
          } else if (type === "init-error") {
            console.warn("Kokoro model init error:", error);
            this.isInitializing = false;
            useSpeechStore.getState().setNeuralStatus("error");
            useSpeechStore.getState().setNeuralProgress(null);
            resolve(false);
          } else if (type === "chunk-ready") {
            const listener = this.chunkReadyListeners.get(payload.requestId);
            if (listener) {
              listener(payload);
            }
          } else if (type === "chunk-error") {
            console.warn("Kokoro chunk synthesis error:", payload.error);
            const listener = this.chunkErrorListeners.get(payload.requestId);
            if (listener) {
              listener(payload.error);
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn("Neural voice worker error:", err);
          this.isInitializing = false;
          useSpeechStore.getState().setNeuralStatus("error");
          useSpeechStore.getState().setNeuralProgress(null);
          resolve(false);
        };

        // Post init message
        this.worker.postMessage({
          type: "init",
          payload: { dtype: "q8" }
        });
      } catch (err) {
        console.warn("Failed to create neural voice worker:", err);
        this.isInitializing = false;
        useSpeechStore.getState().setNeuralStatus("error");
        useSpeechStore.getState().setNeuralProgress(null);
        resolve(false);
      }
    });

    return this.initPromise;
  }

  public synthesizeChunks(
    requestId: string,
    chunks: string[],
    voice: string,
    speed: number,
    onChunkReady: (chunkIndex: number, totalChunks: number, wavBuffer: ArrayBuffer) => void,
    onChunkError: (error: string) => void
  ) {
    if (!this.worker) return;

    this.activeRequestId = requestId;
    const totalChunks = chunks.length;

    this.chunkReadyListeners.set(requestId, (payload) => {
      onChunkReady(payload.chunkIndex, payload.totalChunks, payload.wavBuffer);
    });

    this.chunkErrorListeners.set(requestId, (error) => {
      onChunkError(error);
    });

    // Pipelined chunk synthesis: send chunks sequentially
    let nextChunkToSynthesize = 0;

    const dispatchNext = () => {
      if (this.activeRequestId !== requestId) return;
      if (nextChunkToSynthesize >= totalChunks) return;

      const idx = nextChunkToSynthesize++;
      this.worker?.postMessage({
        type: "synthesize-chunk",
        payload: {
          requestId,
          chunkIndex: idx,
          totalChunks,
          text: chunks[idx],
          voice,
          speed
        }
      });
    };

    // Synthesize first chunk immediately, and when each chunk completes, dispatch next
    const origListener = this.chunkReadyListeners.get(requestId);
    this.chunkReadyListeners.set(requestId, (payload) => {
      if (origListener) origListener(payload);
      dispatchNext();
    });

    // Start synthesizing chunk 0
    dispatchNext();
  }

  public cancel(requestId?: string) {
    this.activeRequestId = null;
    if (requestId) {
      this.chunkReadyListeners.delete(requestId);
      this.chunkErrorListeners.delete(requestId);
    } else {
      this.chunkReadyListeners.clear();
      this.chunkErrorListeners.clear();
    }

    if (this.worker) {
      this.worker.postMessage({
        type: "cancel",
        payload: { requestId }
      });
    }
  }
}
