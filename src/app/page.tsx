import Link from "next/link";
import Logo from "@/components/Logo";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import { ArrowRight, Compass, Shield, Sparkles } from "lucide-react";

const steps = [
  { n: "01", title: "Describe Objective", body: "Give TRACE any objective and attach text, CSV, log, or JSON files. No fixed templates or hardcoded rules." },
  { n: "02", title: "Watch Investigation", body: "The agent plans a dynamic task DAG, executes tools, streams real-time events, and adapts from observations." },
  { n: "03", title: "Authorize Actions", body: "Read-only investigations execute automatically. High-impact tools trigger progressive hold-to-confirm authorization gates." },
];

export default function Landing() {
  return (
    <main className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <Ambient3DBackground />

      <header className="relative z-10 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/40 px-6 py-5 backdrop-blur-md md:px-12">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/hero-demo" className="rounded-xl px-3.5 py-2 font-medium text-cyan-400 hover:bg-cyan-950/40 transition">
            Hero Demo
          </Link>
          <Link href="/hold-to-confirm-demo" className="rounded-xl px-3.5 py-2 font-medium text-amber-400 hover:bg-amber-950/40 transition">
            Hold Gate Demo
          </Link>
          <Link href="/login" className="rounded-xl px-3.5 py-2 font-medium text-slate-400 hover:text-slate-100 transition">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 font-medium text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center md:px-12">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/50 px-4 py-1.5 font-mono text-xs tracking-widest text-cyan-400 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5" /> INVESTIGATE · UNDERSTAND · ACT
        </p>
        <h1 className="max-w-4xl text-4xl font-bold leading-tight text-slate-100 md:text-6xl">
          A visual operating system for <span className="bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent">autonomous AI work</span>
        </h1>
        <p className="mt-6 max-w-2xl text-slate-400 md:text-lg">
          Give the agent a goal. Watch it investigate. Stay in control.
          TRACE decomposes arbitrary objectives into tool-executable task graphs — with evidence, approvals, and full replayability.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-7 py-3.5 font-semibold text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/25"
          >
            Start your first mission <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-7 py-3.5 font-semibold text-slate-300 hover:bg-slate-800 transition backdrop-blur-md"
          >
            I already have an account
          </Link>
        </div>

        {/* Dynamic Mission Preview Card */}
        <div className="mt-16 w-full max-w-4xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-left shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between font-mono text-xs text-slate-400">
              <span className="flex items-center gap-2 text-cyan-400">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
                MISSION #2841 — AUTONOMOUS INVESTIGATION IN PROGRESS
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">RUNNING</span>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {[
                "understand objective",
                "search files",
                "query table",
                "compare metrics",
                "execute code",
                "web search",
                "request approval",
                "generate chart",
                "synthesize report",
              ].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-full border px-3.5 py-1 ${
                    i < 5
                      ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                      : i === 5
                      ? "border-amber-500/60 bg-amber-950/40 text-amber-300 animate-pulse"
                      : "border-slate-800 bg-slate-950 text-slate-500"
                  }`}
                >
                  {i < 5 ? "✓ " : i === 5 ? "◉ " : "· "}
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 grid gap-6 px-6 pb-20 md:grid-cols-3 md:px-12 max-w-6xl mx-auto w-full">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-cyan-500/40 transition">
            <div className="font-mono text-xs text-cyan-400 font-semibold">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">{s.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{s.body}</p>
          </div>
        ))}
      </section>

      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 px-6 py-6 text-center text-xs text-slate-500 backdrop-blur-md md:px-12">
        TRACE — Universal Agentic AI Investigation Platform. Every agent event is persisted, replayable, and auditable.
      </footer>
    </main>
  );
}
