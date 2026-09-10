"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import { Activity, ArrowUpRight, CheckCircle2, Database, FileOutput, Plus, RefreshCw, ShieldAlert, Zap } from "lucide-react";

type Mission = { id: string; title: string; objective: string; status: string; created_at: string };
type Metrics = { total: number; running: number; completed: number; approvals: number; sources: number; artifacts: number };

const statusStyles: Record<string, string> = {
  completed: "border-accent/30 bg-accent/5 text-accent",
  running: "border-cyan-400/40 bg-cyan-400/5 text-cyan-300",
  waiting_for_approval: "border-amber/40 bg-amber/5 text-amber",
  paused: "border-slate-500/40 bg-slate-500/5 text-slate-300",
  failed: "border-red-500/40 bg-red-500/5 text-red-300",
  draft: "border-border bg-surface-2 text-muted",
};

export default function MissionCenter() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMissions() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/missions");
      if (!response.ok) throw new Error("Unable to load missions");
      const data = await response.json();
      setMissions(data.missions ?? []);
      setMetrics(data.metrics ?? null);
    } catch {
      setError("Mission data is temporarily unavailable. Try refreshing the control room.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMissions(); }, []);

  const cards = metrics ? [
    ["Active missions", metrics.running, Activity, "text-cyan-300"],
    ["Awaiting approval", metrics.approvals, ShieldAlert, "text-amber"],
    ["Evidence sources", metrics.sources, Database, "text-accent"],
    ["Generated artifacts", metrics.artifacts, FileOutput, "text-violet-300"],
  ] as const : [];

  return (
    <div className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <Ambient3DBackground />
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent"><Zap className="h-4 w-4" /> MISSION CONTROL</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Make complex work observable.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Launch an objective, watch TRACE build the investigation graph, and keep authority exactly where it belongs: with you.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadMissions()} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-muted transition hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
            <Link href="/app/new" className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-medium text-background transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Plus className="h-4 w-4" /> New mission</Link>
          </div>
        </header>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading && !metrics ? Array.from({ length: 4 }, (_, index) => <div key={index} className="glass animate-pulse rounded-2xl p-5"><div className="h-4 w-28 rounded bg-border" /><div className="mt-5 h-9 w-14 rounded bg-border" /><div className="mt-3 h-1 rounded bg-border" /></div>) : cards.map(([label, value, Icon, color]) => <div key={label} className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Icon className={`h-4 w-4 ${color}`} /></div><div className="mt-4 text-3xl font-semibold">{value}</div><div className="mt-3 text-[10px] font-mono uppercase tracking-widest text-muted">Live workspace count</div></div>)}
        </div>
        {error && <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void loadMissions()} className="shrink-0 font-medium underline underline-offset-4">Retry</button></div>}
        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_320px]">
          <section>
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-medium">Recent missions</h2><p className="mt-1 text-xs text-muted">Every run is persisted, replayable, and evidence-linked.</p></div><span className="font-mono text-xs text-muted">{metrics?.total ?? 0} TOTAL</span></div>
            {missions.length === 0 ? <div className="glass mt-5 rounded-2xl p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10"><Activity className="h-6 w-6 text-accent" /></div><h3 className="mt-5 font-medium">Your control room is ready.</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted">Upload context or start with an objective. TRACE will create the task graph dynamically.</p><Link href="/app/new" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-accent/40 px-4 py-2 text-sm text-accent">Start first mission <ArrowUpRight className="h-4 w-4" /></Link></div> : <div className="mt-5 space-y-3">{missions.map((mission) => <Link key={mission.id} href={`/app/missions/${mission.id}`} className="glass group block rounded-2xl p-5 transition hover:border-accent/40"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="truncate font-medium group-hover:text-accent">{mission.title}</div><p className="mt-1 truncate text-sm text-muted">{mission.objective}</p></div><span className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase ${statusStyles[mission.status] ?? statusStyles.draft}`}>{mission.status.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center gap-2 text-[10px] text-muted"><CheckCircle2 className="h-3.5 w-3.5" /> {new Date(mission.created_at).toLocaleString()}</div></Link>)}</div>}
          </section>
          <aside className="glass h-fit rounded-2xl p-5"><div className="flex items-center gap-2 font-mono text-xs tracking-widest text-accent"><ShieldAlert className="h-4 w-4" /> SAFETY POSTURE</div><div className="mt-5 flex items-center gap-3"><div className="h-3 w-3 rounded-full bg-accent shadow-[0_0_18px_var(--accent)]" /><div><div className="font-medium">Human authority active</div><div className="mt-1 text-xs text-muted">High-impact actions require approval.</div></div></div><div className="mt-5 border-t border-border pt-5 text-xs leading-relaxed text-muted">TRACE separates reasoning from authority. The AI can plan, inspect, calculate, and explain; the policy engine controls side effects.</div></aside>
        </div>
      </div>
    </div>
  );
}
