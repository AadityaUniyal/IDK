"use client";

import { useEffect, useState } from "react";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import { Wrench, Search, ShieldAlert, CheckCircle, ExternalLink, Code } from "lucide-react";

type Tool = { name: string; description: string; inputSchema: Record<string, string>; riskLevel: string };

const riskStyle: Record<string, { badge: string; icon: any }> = {
  read: { badge: "border-cyan-500/50 bg-cyan-950/40 text-cyan-400", icon: CheckCircle },
  analyze: { badge: "border-cyan-500/50 bg-cyan-950/40 text-cyan-400", icon: Code },
  write: { badge: "border-amber-500/60 bg-amber-950/40 text-amber-300", icon: ShieldAlert },
  external: { badge: "border-amber-500/60 bg-amber-950/40 text-amber-300", icon: ExternalLink },
  destructive: { badge: "border-red-500/60 bg-red-950/40 text-red-400", icon: ShieldAlert },
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []));
  }, []);

  const filtered = tools.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || t.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="relative min-h-screen p-8 text-slate-100 bg-slate-950">
      <Ambient3DBackground />

      <div className="relative z-10 max-w-4xl">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
          <Wrench className="h-4 w-4" /> AGENT CAPABILITY REGISTRY
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">Tool Discovery & Autonomy Policy</h1>
        <p className="mt-1 text-sm text-slate-400">
          Capabilities discovered and invoked dynamically by TRACE at runtime. Risk levels dictate whether actions execute automatically or pause for human approval.
        </p>

        {/* Filter controls */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools by name or description..."
              className="bg-transparent font-mono text-xs text-slate-200 placeholder-slate-500 outline-none w-64"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            {["all", "read", "analyze", "write", "external"].map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`rounded-lg px-3 py-1.5 uppercase transition ${
                  riskFilter === r ? "bg-cyan-500 font-semibold text-slate-950" : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Tools List */}
        <div className="mt-6 space-y-3">
          {filtered.map((t) => {
            const riskInfo = riskStyle[t.riskLevel] ?? riskStyle.read;
            const RiskIcon = riskInfo.icon;

            return (
              <div key={t.name} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md hover:border-cyan-500/40 transition">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-sm font-semibold text-cyan-400">{t.name}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-xs ${riskInfo.badge}`}>
                    <RiskIcon className="h-3 w-3" />
                    {t.riskLevel.toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{t.description}</p>
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400 space-y-1">
                  <div className="text-[10px] text-slate-500">INPUT PARAMETER SCHEMA:</div>
                  {Object.entries(t.inputSchema).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-cyan-400">{k}:</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="py-8 font-mono text-xs text-slate-500 text-center">No tools matched "{search}".</p>}
        </div>
      </div>
    </div>
  );
}
