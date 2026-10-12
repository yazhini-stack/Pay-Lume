// Audio Queue Player for streaming / pipelined WAV audio chunks in the browser

export interface QueuedChunk {
  chunkIndex: number;
  totalChunks: number;
  wavBuffer: ArrayBuffer;
  objectUrl: string;
}

export class NeuralAudioPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private queuedChunks: Map<number, QueuedChunk> = new Map();
  private currentPlayingIndex: number = 0;
  private totalExpectedChunks: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private speechRate: number = 1.0;
  private activeUrls: string[] = [];
  private naturalPauseTimer: NodeJS.Timeout | null = null;

  public onStarted?: () => void;
  public onEnded?: () => void;
  public onError?: (error: unknown) => void;

  constructor() {}

  public startSession(totalChunks: number, speechRate: number = 1.0) {
    this.stop();
    this.totalExpectedChunks = totalChunks;
    this.currentPlayingIndex = 0;
    this.speechRate = speechRate;
    this.queuedChunks.clear();
    this.isPlaying = false;
    this.isPaused = false;
  }

  public enqueueChunk(chunkIndex: number, totalChunks: number, wavBuffer: ArrayBuffer) {
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const objectUrl = URL.createObjectURL(blob);
    this.activeUrls.push(objectUrl);

    this.queuedChunks.set(chunkIndex, {
      chunkIndex,
      totalChunks,
      wavBuffer,
      objectUrl
    });

    // If we're waiting for this chunk to play, start it now
    if (this.isPlaying && !this.currentAudio && this.currentPlayingIndex === chunkIndex) {
      this.playCurrentChunk();
    } else if (!this.isPlaying && !this.isPaused && chunkIndex === 0) {
      // First chunk is ready: start playback
      this.isPlaying = true;
      this.playCurrentChunk();
    }
  }

  private playCurrentChunk() {
    if (!this.isPlaying || this.isPaused) return;

    const chunk = this.queuedChunks.get(this.currentPlayingIndex);
    if (!chunk) {
      // Chunk not generated yet; it will play when enqueueChunk arrives
      return;
    }

    try {
      const audio = new Audio(chunk.objectUrl);
      audio.playbackRate = this.speechRate;
      this.currentAudio = audio;

      audio.onplay = () => {
        if (this.currentPlayingIndex === 0 && this.onStarted) {
          this.onStarted();
        }
      };

      audio.onended = () => {
        this.currentAudio = null;
        this.currentPlayingIndex++;

        if (this.currentPlayingIndex >= this.totalExpectedChunks) {
          // Finished all chunks!
          this.isPlaying = false;
          this.cleanupUrls();
          if (this.onEnded) this.onEnded();
        } else {
          // Natural conversational pause between sentences (~160ms)
          this.naturalPauseTimer = setTimeout(() => {
            if (this.isPlaying && !this.isPaused) {
              this.playCurrentChunk();
            }
          }, 160);
        }
      };

      audio.onerror = (e) => {
        console.warn("Neural audio chunk playback error:", e);
        if (this.onError) {
          this.onError(e);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Autoplay policy or interruption
          if (err.name !== "AbortError") {
            console.warn("Audio play error:", err);
            if (this.onError) this.onError(err);
          }
        });
      }
    } catch (err) {
      console.warn("Failed to instantiate Audio for chunk:", err);
      if (this.onError) this.onError(err);
    }
  }

  public pause() {
    this.isPaused = true;
    if (this.naturalPauseTimer) {
      clearTimeout(this.naturalPauseTimer);
      this.naturalPauseTimer = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  public resume() {
    this.isPaused = false;
    if (this.currentAudio) {
      this.currentAudio.play().catch((err) => console.warn("Resume failed:", err));
    } else {
      this.playCurrentChunk();
    }
  }

  public stop() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.naturalPauseTimer) {
      clearTimeout(this.naturalPauseTimer);
      this.naturalPauseTimer = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = "";
      } catch {}
      this.currentAudio = null;
    }
    this.queuedChunks.clear();
    this.cleanupUrls();
  }

  public setPlaybackRate(rate: number) {
    this.speechRate = rate;
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
    }
  }

  private cleanupUrls() {
    for (const url of this.activeUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.activeUrls = [];
  }
}
