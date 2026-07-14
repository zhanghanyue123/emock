"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpeakingRecording, SpeakingRecordingAnswer } from "@/types/practice";

type RecorderState = "idle" | "requesting_permission" | "ready" | "countdown" | "recording" | "processing" | "recorded" | "playing" | "error";
type RecorderMode = "practice" | "full_mock";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
const MAX_TAKES = 3;

function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function bestMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function emptyAnswer(questionId: string): SpeakingRecordingAnswer {
  return { recordingsByQuestionId: { [questionId]: [] } };
}

function normalizeAnswer(value: unknown, questionId: string): SpeakingRecordingAnswer {
  const answer = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SpeakingRecordingAnswer> : {};
  return {
    recordingsByQuestionId: {
      ...answer.recordingsByQuestionId,
      [questionId]: answer.recordingsByQuestionId?.[questionId] || []
    },
    selectedRecordingId: answer.selectedRecordingId
  };
}

function recordingSource(recording?: SpeakingRecording) {
  return recording?.dataUrl || recording?.blobUrl || "";
}

export function SpeakingRecorder({
  questionId,
  examId,
  sectionId,
  attemptId,
  value,
  mode,
  responseSeconds,
  originalAudioSrc,
  onChange
}: {
  questionId: string;
  examId: string;
  sectionId: string;
  attemptId: string;
  value: unknown;
  mode: RecorderMode;
  responseSeconds?: number;
  originalAudioSrc?: string | null;
  onChange: (value: SpeakingRecordingAnswer) => void;
}) {
  const answer = useMemo(() => normalizeAnswer(value, questionId), [questionId, value]);
  const takes = answer.recordingsByQuestionId[questionId] || [];
  const selected = takes.find((take) => take.id === answer.selectedRecordingId) || takes.at(-1);
  const [state, setState] = useState<RecorderState>(takes.length ? "recorded" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const mineAudioRef = useRef<HTMLAudioElement | null>(null);
  const isFullMock = mode === "full_mock";

  function emit(nextTakes: SpeakingRecording[], selectedRecordingId?: string) {
    onChange({
      ...emptyAnswer(questionId),
      ...answer,
      recordingsByQuestionId: { ...answer.recordingsByQuestionId, [questionId]: nextTakes },
      selectedRecordingId
    });
  }

  function stopPlayback() {
    for (const audio of [originalAudioRef.current, mineAudioRef.current]) {
      if (!audio) continue;
      audio.pause();
    }
    setPlayingId(null);
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearStopTimer() {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  async function requestStream() {
    setError(null);
    setState("requesting_permission");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser recording is not supported.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    setState("ready");
    return stream;
  }

  async function startRecording(withCountdown = mode === "practice") {
    try {
      stopPlayback();
      const stream = streamRef.current || await requestStream();
      if (withCountdown) {
        setState("countdown");
        for (const value of [3, 2, 1]) {
          setCountdown(value);
          await new Promise((resolve) => window.setTimeout(resolve, 650));
        }
        setCountdown(0);
      }
      chunksRef.current = [];
      const mimeType = bestMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        setState("processing");
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || mimeType || "audio/webm" });
        const durationMs = Math.max(0, Date.now() - startedAtRef.current);
        const reader = new FileReader();
        reader.onload = () => {
          const now = new Date().toISOString();
          const nextTakeNumber = isFullMock ? 1 : Math.max(1, (takes.at(-1)?.takeNumber || 0) + 1);
          const recording: SpeakingRecording = {
            id: `${questionId}-take-${Date.now()}`,
            attemptId,
            examId,
            sectionId,
            questionId,
            takeNumber: nextTakeNumber,
            dataUrl: String(reader.result || ""),
            mimeType: blob.type,
            durationMs,
            createdAt: now,
            status: "saved",
            mode
          };
          const nextTakes = isFullMock ? [recording] : [...takes, recording].slice(-MAX_TAKES).map((take, index) => ({ ...take, takeNumber: index + 1 }));
          emit(nextTakes, recording.id);
          setState("recorded");
          stopTracks();
        };
        reader.readAsDataURL(blob);
      };
      // eslint-disable-next-line react-hooks/purity
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
      mediaRecorder.start();
      if (responseSeconds) {
        stopTimerRef.current = window.setTimeout(() => stopRecording(), responseSeconds * 1000);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to access microphone.");
      setState("error");
      stopTracks();
    }
  }

  function stopRecording() {
    clearStopTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function selectTake(recordingId: string) {
    emit(takes, recordingId);
  }

  function deleteTake(recordingId: string) {
    const nextTakes = takes.filter((take) => take.id !== recordingId).map((take, index) => ({ ...take, takeNumber: index + 1 }));
    const nextSelected = answer.selectedRecordingId === recordingId ? nextTakes.at(-1)?.id : answer.selectedRecordingId;
    emit(nextTakes, nextSelected);
    if (!nextTakes.length) setState("idle");
  }

  async function playOriginal() {
    if (!originalAudioRef.current) return;
    stopPlayback();
    setPlayingId("original");
    setState("playing");
    await originalAudioRef.current.play().catch(() => setState(takes.length ? "recorded" : "ready"));
  }

  async function playMine(recording = selected) {
    if (!mineAudioRef.current || !recordingSource(recording)) return;
    mineAudioRef.current.src = recordingSource(recording);
    stopPlayback();
    setPlayingId(recording?.id || "mine");
    setState("playing");
    await mineAudioRef.current.play().catch(() => setState("recorded"));
  }

  async function replaySequence(recording = selected) {
    if (!originalAudioRef.current || !mineAudioRef.current || !recordingSource(recording)) return;
    stopPlayback();
    setPlayingId("sequence");
    mineAudioRef.current.src = recordingSource(recording);
    originalAudioRef.current.currentTime = 0;
    mineAudioRef.current.currentTime = 0;
    await originalAudioRef.current.play();
    await new Promise<void>((resolve) => {
      originalAudioRef.current?.addEventListener("ended", () => resolve(), { once: true });
    });
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    await mineAudioRef.current.play();
  }

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    clearStopTimer();
    stopPlayback();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopTracks();
  }, []);

  const remaining = responseSeconds ? Math.max(0, responseSeconds - Math.floor(elapsedMs / 1000)) : undefined;
  const activeDuration = responseSeconds ? `${formatClock(Math.floor(elapsedMs / 1000))} / ${formatClock(responseSeconds)}` : formatClock(Math.floor(elapsedMs / 1000));

  return (
    <div className="grid gap-4">
      <audio ref={originalAudioRef} src={originalAudioSrc || undefined} onEnded={() => setPlayingId(null)} />
      <audio ref={mineAudioRef} onEnded={() => setPlayingId(null)} />
      <div className="rounded-md border border-line bg-panel p-3 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{state === "recording" ? "Recording" : state === "countdown" ? `Starting in ${countdown}` : "Speaking response"}</p>
            <p className="text-xs text-muted">{responseSeconds ? `Response time ${formatClock(responseSeconds)}` : "No response limit"}</p>
          </div>
          <div className="text-lg font-semibold tabular-nums">{state === "recording" ? activeDuration : selected ? formatClock(Math.round(selected.durationMs / 1000)) : "--:--"}</div>
        </div>
        {state === "recording" ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-action transition-all" style={{ width: responseSeconds ? `${Math.min(100, (elapsedMs / 1000 / responseSeconds) * 100)}%` : "35%" }} />
          </div>
        ) : null}
      </div>
      {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-100">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {state === "idle" || state === "error" ? <button type="button" className="rounded-md border border-line px-3 py-2 text-sm font-medium dark:border-slate-700" onClick={() => void requestStream()}>Allow microphone</button> : null}
        {state !== "recording" && (!isFullMock || takes.length === 0) ? <button type="button" className="rounded-md border border-action bg-action px-3 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => void startRecording()} disabled={state === "requesting_permission" || state === "countdown" || state === "processing"}>{takes.length && !isFullMock ? "Re-record" : "Start recording"}</button> : null}
        {state === "recording" ? <button type="button" className="rounded-md border border-line px-3 py-2 text-sm font-medium dark:border-slate-700" onClick={stopRecording}>Stop</button> : null}
      </div>
      {!isFullMock && takes.length > 0 ? (
        <div className="rounded-md border border-line bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold">Compare</h3>
          <div className="mt-3 grid gap-3">
            <div className="rounded-md bg-panel p-3 dark:bg-slate-950">
              <p className="text-sm font-medium">Original prompt</p>
              <button type="button" className="mt-2 rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700" onClick={() => void playOriginal()} disabled={!originalAudioSrc}>{playingId === "original" ? "Playing original" : "Play original"}</button>
            </div>
            <div className="rounded-md bg-panel p-3 dark:bg-slate-950">
              <p className="text-sm font-medium">My recording · Take {selected?.takeNumber || takes.length}</p>
              {selected ? <audio controls src={recordingSource(selected)} className="mt-2 w-full" onPlay={() => originalAudioRef.current?.pause()} /> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700" onClick={() => void playMine()}>{playingId && playingId !== "original" ? "Playing mine" : "Play mine"}</button>
                <button type="button" className="rounded-md border border-line px-3 py-2 text-sm dark:border-slate-700" onClick={() => void replaySequence()} disabled={!originalAudioSrc}>Replay sequence</button>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {takes.map((take) => (
              <div key={take.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${take.id === answer.selectedRecordingId ? "border-action bg-blue-50 dark:bg-blue-950" : "border-line dark:border-slate-700"}`}>
                <span>Take {take.takeNumber} · {formatClock(Math.round(take.durationMs / 1000))} · {new Date(take.createdAt).toLocaleTimeString()}</span>
                <span className="flex gap-2">
                  <button type="button" className="rounded border border-line px-2 py-1 dark:border-slate-700" onClick={() => void playMine(take)}>Play</button>
                  <button type="button" className="rounded border border-line px-2 py-1 dark:border-slate-700" onClick={() => selectTake(take.id)}>Select as final</button>
                  <button type="button" className="rounded border border-line px-2 py-1 dark:border-slate-700" onClick={() => deleteTake(take.id)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : isFullMock && takes.length > 0 ? (
        <p className="rounded-md border border-line bg-panel p-3 text-sm text-muted dark:border-slate-700 dark:bg-slate-950">Recording saved. Playback is available after submission.</p>
      ) : null}
      {remaining !== undefined && state === "recording" ? <p className="text-xs text-muted">Remaining: {formatClock(remaining)}</p> : null}
    </div>
  );
}
