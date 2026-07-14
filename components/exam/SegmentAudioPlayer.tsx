"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(value: number) {
  const safe = Math.max(0, Math.floor(value));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function SegmentAudioPlayer({ src, startSeconds = 0, endSeconds, title }: {
  src: string;
  startSeconds?: number;
  endSeconds?: number;
  title?: string;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const segmentDuration = Math.max(0, (endSeconds || 0) - startSeconds);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !ready) return;
    audio.currentTime = startSeconds;
    setCurrentSeconds(0);
    setPlaying(false);
  }, [ready, src, startSeconds]);

  function togglePlay() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      if (audio.currentTime < startSeconds || (endSeconds && audio.currentTime >= endSeconds)) audio.currentTime = startSeconds;
      void audio.play();
    } else {
      audio.pause();
    }
  }

  return (
    <div className="rounded-md border border-line bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
      {title ? <p className="mb-2 text-xs font-medium uppercase text-muted">{title}</p> : null}
      <audio
        ref={ref}
        preload="metadata"
        src={src}
        onLoadedMetadata={() => setReady(true)}
        onPause={() => setPlaying(false)}
        onPlay={(event) => {
          setPlaying(true);
          if (event.currentTarget.currentTime < startSeconds || (endSeconds && event.currentTarget.currentTime >= endSeconds)) {
            event.currentTarget.currentTime = startSeconds;
          }
        }}
        onTimeUpdate={(event) => {
          if (endSeconds && event.currentTarget.currentTime >= endSeconds) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = startSeconds;
            setCurrentSeconds(0);
            return;
          }
          setCurrentSeconds(Math.max(0, event.currentTarget.currentTime - startSeconds));
        }}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50" disabled={!ready} onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-action" style={{ width: `${segmentDuration ? Math.min(100, (currentSeconds / segmentDuration) * 100) : 0}%` }} />
        </div>
        <span className="w-20 text-right text-xs tabular-nums text-muted">{formatTime(currentSeconds)} / {formatTime(segmentDuration || currentSeconds)}</span>
      </div>
      {endSeconds ? <p className="mt-2 text-xs text-muted">Segment {startSeconds.toFixed(1)}s - {endSeconds.toFixed(1)}s</p> : null}
    </div>
  );
}
