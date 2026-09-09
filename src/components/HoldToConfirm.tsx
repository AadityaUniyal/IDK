"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Deliberate authorization control: press and hold to fill the progress
// ring, release early to cancel. Keyboard: hold Space/Enter, Escape cancels.
export default function HoldToConfirm({
  label,
  holdingLabel = "Keep holding…",
  confirmedLabel = "Authorized",
  durationMs = 1600,
  onConfirm,
  disabled,
}: {
  label: string;
  holdingLabel?: string;
  confirmedLabel?: string;
  durationMs?: number;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "holding" | "committed">("idle");
  const raf = useRef(0);
  const start = useRef(0);
  const done = useRef(false);

  const stop = useCallback((commit: boolean) => {
    cancelAnimationFrame(raf.current);
    if (done.current) return;
    if (commit) {
      done.current = true;
      setState("committed");
      setProgress(1);
      onConfirm();
    } else {
      setState("idle");
      setProgress(0);
    }
  }, [onConfirm]);

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - start.current) / durationMs);
    setProgress(p);
    if (p >= 1) {
      stop(true);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [durationMs, stop]);

  const begin = useCallback(() => {
    if (done.current || disabled) return;
    done.current = false;
    setState("holding");
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const pct = Math.round(progress * 100);
  return (
    <button
      type="button"
      disabled={disabled || state === "committed"}
      onPointerDown={(e) => { e.preventDefault(); begin(); }}
      onPointerUp={() => stop(false)}
      onPointerLeave={() => state === "holding" && stop(false)}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && state === "idle") { e.preventDefault(); begin(); }
        if (e.key === "Escape" && state === "holding") stop(false);
      }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(progress >= 1); }}
      className="relative w-full overflow-hidden rounded-lg border border-amber/60 bg-surface-2 px-4 py-3 text-left font-medium text-amber transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-60"
      aria-label={`${label}. Press and hold for ${durationMs / 1000} seconds to authorize.`}
      aria-live="polite"
    >
      <span
        className="absolute inset-y-0 left-0 bg-amber/25 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
      <span className="relative flex items-center justify-between gap-3">
        <span>{state === "committed" ? confirmedLabel : state === "holding" ? holdingLabel : label}</span>
        <span className="font-mono text-xs" aria-hidden="true">{pct}%</span>
      </span>
    </button>
  );
}
