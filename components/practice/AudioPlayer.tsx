"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { publicAssetPath } from "@/lib/assets";
import type { AudioPlaybackState } from "@/types/practice";
import type { AudioItem } from "@/types/test";

export function AudioPlayer({ testId, items, currentIndex, practiceMode, playbackRate, onIndexChange, playbackStates, onPlaybackStateChange }: {
  testId: string;
  items: AudioItem[];
  currentIndex: number;
  practiceMode: boolean;
  playbackRate: number;
  onIndexChange: (index: number) => void;
  playbackStates?: Record<string, AudioPlaybackState>;
  onPlaybackStateChange?: (audioId: string, state: AudioPlaybackState) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, forceRender] = useState(0);
  const item = items[currentIndex];
  const src = item ? publicAssetPath(testId, item.file) : null;
  const savedState = item ? playbackStates?.[item.id] : undefined;
  const blocked = Boolean(item && item.allowReplay === false && (savedState?.playCount || 0) > 0 && savedState?.status === "ended" && !practiceMode);

  function emit(update: Partial<AudioPlaybackState>) {
    if (!item) return;
    const audio = audioRef.current;
    onPlaybackStateChange?.(item.id, {
      audioId: item.id,
      currentTime: audio?.currentTime || savedState?.currentTime || 0,
      duration: Number.isFinite(audio?.duration) ? audio?.duration : savedState?.duration,
      playbackRate: audio?.playbackRate || playbackRate,
      volume: audio?.volume ?? savedState?.volume ?? 0.8,
      status: savedState?.status || "idle",
      playCount: savedState?.playCount || 0,
      ...update
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !item) return;
    audio.playbackRate = savedState?.playbackRate || playbackRate;
    audio.volume = savedState?.volume ?? 0.8;
    if (savedState?.currentTime && Number.isFinite(savedState.currentTime)) {
      audio.currentTime = savedState.currentTime;
    }
  }, [currentIndex, item, playbackRate, savedState?.currentTime, savedState?.playbackRate, savedState?.volume]);

  if (!item) return <div className="rounded-lg border border-line p-4 text-sm text-muted">No audio for this section.</div>;

  return (
    <div className="rounded-lg border border-line p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-xs text-muted">{practiceMode ? "Practice mode: replay limits disabled" : item.allowReplay === false ? "Replay locked after first play" : "Replay allowed"}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}>Prev</Button>
          <Button onClick={() => onIndexChange(Math.min(items.length - 1, currentIndex + 1))}>Next</Button>
        </div>
      </div>
      {src && !blocked ? (
        <audio
          ref={audioRef}
          className="mt-3 w-full"
          controls
          src={src}
          onLoadStart={() => emit({ status: "loading" })}
          onLoadedMetadata={() => emit({ status: "paused", duration: audioRef.current?.duration })}
          onPlay={() => emit({ status: "playing" })}
          onPause={() => emit({ status: "paused" })}
          onTimeUpdate={() => {
            emit({ status: audioRef.current?.paused ? "paused" : "playing" });
            forceRender((value) => value + 1);
          }}
          onVolumeChange={() => emit({ volume: audioRef.current?.volume ?? 0.8 })}
          onRateChange={() => emit({ playbackRate: audioRef.current?.playbackRate || playbackRate })}
          onError={() => emit({ status: "error" })}
          onEnded={() => emit({ status: "ended", playCount: (savedState?.playCount || 0) + 1, currentTime: audioRef.current?.duration || 0 })}
        />
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-line p-3 text-sm text-muted">
          {blocked ? "Replay is disabled for this audio." : `Missing audio file. Put it at content/${testId}/${item.file}.`}
        </p>
      )}
    </div>
  );
}
