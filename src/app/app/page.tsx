"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mission = { id: string; title: string; objective: string; status: string; created_at: string };

const statusStyle: Record<string, string> = {
  completed: "border-accent/50 text-accent",
  running: "border-accent/50 text-accent animate-trace-pulse",
  planning: "border-amber/60 text-amber",
  waiting_for_approval: "border-amber/60 text-amber animate-trace-pulse",
  failed: "border-red-500/50 text-red-300",
  draft: "border-border text-muted",
};

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[] | null>(null);

  useEffect(() => {
    fetch("/api/missions").then((r) => r.json()).then((d) => setMissions(d.missions ?? []));
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mission Center</h1>
          <p className="mt-1 text-sm text-muted">Every objective becomes an observable, replayable investigation.</p>
        </div>
        <Link href="/app/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:brightness-110 transition">
          + New mission
        </Link>
      </div>

      {missions === null ? (
        <p className="mt-10 font-mono text-sm text-muted">Loading missions…</p>
      ) : missions.length === 0 ? (
        <div className="glass mt-10 rounded-2xl p-10 text-center">
          <p className="text-muted">No missions yet.</p>
          <p className="mt-2 text-sm text-muted">Upload data sources, then describe any objective — the agent builds the plan.</p>
          <Link href="/app/new" className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-background">Start your first mission</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {missions.map((m) => (
            <Link key={m.id} href={`/app/missions/${m.id}`} className="glass block rounded-xl p-5 hover:border-accent/40 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.title}</div>
                  <div className="mt-1 truncate text-sm text-muted">{m.objective}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs ${statusStyle[m.status] ?? "border-border text-muted"}`}>
                  {m.status.replaceAll("_", " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
