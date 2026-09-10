"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, FastForward, SkipBack, SkipForward } from "lucide-react";

export type ReplayEvent = {
  id: string;
  sequence_number: number;
  type: string;
  payload_json: any;
  created_at: string;
};

interface TimeTravelReplayProps {
  events: ReplayEvent[];
  onSeek?: (seq: number) => void;
}

export default function TimeTravelReplay({ events, onSeek }: TimeTravelReplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);

  const total = events.length;
  const currentEvent = events[currentIndex] ?? null;

  useEffect(() => {
    if (!isPlaying || total === 0) return;
    const intervalTime = 1000 / speed;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= total - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        onSeek?.(events[next]?.sequence_number ?? next);
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, speed, total, events, onSeek]);

  function handleSliderChange(val: number) {
    setCurrentIndex(val);
    onSeek?.(events[val]?.sequence_number ?? val);
  }

  function togglePlay() {
    if (currentIndex >= total - 1) {
      setCurrentIndex(0);
      onSeek?.(events[0]?.sequence_number ?? 0);
    }
    setIsPlaying((p) => !p);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
          <RotateCcw className="h-4 w-4" /> TIME-TRAVEL REPLAY — EVENT {currentIndex + 1} OF {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            className="rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-cyan-500/50"
          >
            {speed}X SPEED
          </button>
        </div>
      </div>

      {/* Playback Controls & Slider */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSliderChange(Math.max(0, currentIndex - 1))}
          className="rounded-lg border border-slate-800 p-2 text-slate-300 hover:bg-slate-800"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </button>
        <button
          onClick={() => handleSliderChange(Math.min(total - 1, currentIndex + 1))}
          className="rounded-lg border border-slate-800 p-2 text-slate-300 hover:bg-slate-800"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={currentIndex}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
        />
      </div>

      {/* Current Event Details Card */}
      {currentEvent && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-cyan-400">#{currentEvent.sequence_number} {currentEvent.type}</span>
            <span>{new Date(currentEvent.created_at).toLocaleTimeString()}</span>
          </div>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-900/80 p-2 text-[11px] text-slate-300">
            {JSON.stringify(currentEvent.payload_json, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
