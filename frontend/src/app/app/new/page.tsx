"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import { Sparkles, Database, Compass, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

type Source = { id: string; name: string; type: string; size: number };

const SAMPLE_TEMPLATES = [
  {
    title: "Financial & Revenue Trend Analysis",
    objective: "Analyze sales.csv, calculate revenue growth rates across regions, compare quarterly performance, and generate a visual bar chart report.",
    category: "Data Analysis",
  },
  {
    title: "System Log & Error Spike Investigation",
    objective: "Search log files for error spikes, identify root causes, calculate error frequency, and produce a structured root-cause analysis report.",
    category: "DevOps & Security",
  },
  {
    title: "Document Contradiction & Claim Audit",
    objective: "Search uploaded markdown and text reports, compare claims across documents, identify contradictory statements, and summarize ground-truth findings.",
    category: "Investigation",
  },
];

export default function NewMissionPage() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/data-sources").then((r) => r.json()).then((d) => setSources(d.sources ?? []));
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }
    await fetch(`/api/missions/${data.mission.id}/start`, { method: "POST" });
    router.push(`/app/missions/${data.mission.id}`);
  }

  return (
    <div className="relative min-h-screen p-8 text-slate-100 bg-slate-950">
      <Ambient3DBackground />

      <div className="relative z-10 max-w-3xl">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
          <Sparkles className="h-4 w-4" /> DYNAMIC AI RUNTIME PLANNER
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">Launch New Autonomous Mission</h1>
        <p className="mt-1 text-sm text-slate-400">
          Describe any arbitrary objective. TRACE discovers available data sources and tools to construct a dynamic, multi-step task graph.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between font-mono text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              AVAILABLE SOURCES ({sources.length}): {sources.map((s) => s.name).join(", ") || "none uploaded"}
            </span>
            {sources.length === 0 && (
              <Link href="/app/data" className="text-cyan-400 hover:underline">
                Upload context files →
              </Link>
            )}
          </div>

          <form onSubmit={start}>
            <textarea
              required
              rows={5}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Analyze these three reports, compare the claims, identify numerical differences, and produce an executive recommendation..."
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-4 font-sans text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />

            {/* Template Cards */}
            <div className="mt-4 space-y-2">
              <span className="font-mono text-[11px] text-slate-400">QUICK START TEMPLATES:</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {SAMPLE_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setObjective(tmpl.objective)}
                    className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-left hover:border-cyan-500/50 transition group"
                  >
                    <div>
                      <span className="font-mono text-[9px] uppercase text-cyan-400">{tmpl.category}</span>
                      <div className="mt-1 text-xs font-semibold text-slate-200 group-hover:text-cyan-300">{tmpl.title}</div>
                    </div>
                    <ArrowRight className="mt-2 h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</p>}

            <button
              disabled={creating || objective.trim().length < 10}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition shadow-lg shadow-cyan-500/20"
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  Formulating Task Graph...
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" /> Start Autonomous Mission
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          <span>Read-only investigations run automatically. High-impact tools trigger human approval gates.</span>
        </div>
      </div>
    </div>
  );
}
