"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BrainCircuit, ShieldCheck, UploadCloud } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState("assist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function finish() {
    setBusy(true);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autonomyMode: mode, onboarded: true }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Unable to finish onboarding");
      setBusy(false);
      return;
    }
    router.replace("/app");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background p-6 text-foreground md:p-12">
      <div className="pointer-events-none absolute -left-20 top-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative mx-auto max-w-4xl">
        <div className="font-mono text-xs tracking-[0.25em] text-accent">TRACE / INITIALIZE WORKSPACE</div>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight">Set the boundaries before the agent starts working.</h1>
        <p className="mt-4 max-w-2xl text-muted">TRACE investigates automatically, but consequential actions remain visible and deliberate. Choose the default operating mode for this workspace.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["observe", "Observe", "The agent plans and proposes. It never executes state-changing tools.", BrainCircuit],
            ["assist", "Assist", "Read and analysis tools run automatically. Writes pause for approval.", ShieldCheck],
            ["controlled_autonomous", "Controlled autonomous", "Idempotent internal writes may run. External and destructive actions still pause.", UploadCloud],
          ].map(([value, label, description, Icon]) => (
            <button key={value as string} onClick={() => setMode(value as string)} className={`rounded-2xl border p-5 text-left transition ${mode === value ? "border-accent bg-accent/10" : "border-border bg-surface/60 hover:border-accent/50"}`}>
              <Icon className={`h-6 w-6 ${mode === value ? "text-accent" : "text-muted"}`} />
              <div className="mt-5 font-medium">{label as string}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description as string}</p>
            </button>
          ))}
        </div>
        {error && <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy} onClick={finish} className="mt-8 flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-background transition hover:brightness-110 disabled:opacity-60">
          {busy ? "Initializing..." : "Enter mission control"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
