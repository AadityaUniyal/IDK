"use client";

import { useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("TRACE application error:", error); }, [error]);
  return (
    <main className="trace-grid-bg flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-12 font-mono text-xs tracking-[0.3em] text-amber">RUNTIME INTERRUPTION</div>
        <h1 className="mt-4 text-4xl font-semibold">The mission surface paused unexpectedly.</h1>
        <p className="mt-4 text-muted">Your persisted mission data is safe. Retry the surface or return to mission control.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-accent px-5 py-3 font-medium text-background">Retry surface</button>
          <Link href="/app" className="rounded-xl border border-border px-5 py-3 text-sm text-muted">Mission control</Link>
        </div>
      </div>
    </main>
  );
}
