export interface RecordedAudio {
  id: string;
  blob: Blob;
  mimeType: string;
  durationMs?: number;
  createdAt: string;
}

export interface RecordingAdapter {
  start(): Promise<void>;
  stop(): Promise<RecordedAudio>;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
  getPermissionState(): Promise<PermissionState>;
}

export class BrowserRecordingAdapter implements RecordingAdapter {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async getPermissionState() {
    if (!navigator.permissions) return "prompt";
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser recording is not supported.");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.startedAt = Date.now();
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  async stop() {
    if (!this.recorder) throw new Error("Recording has not started.");
    const recorder = this.recorder;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    this.stream?.getTracks().forEach((track) => track.stop());
    const mimeType = recorder.mimeType || "audio/webm";
    return {
      id: crypto.randomUUID(),
      blob: new Blob(this.chunks, { type: mimeType }),
      mimeType,
      durationMs: Date.now() - this.startedAt,
      createdAt: new Date().toISOString()
    };
  }

  async pause() {
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  async resume() {
    if (this.recorder?.state === "paused") this.recorder.resume();
  }
}
