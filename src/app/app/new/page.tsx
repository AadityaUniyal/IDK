"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Source = { id: string; name: string; type: string; size: number };

const EXAMPLES = [
  "Compare my uploaded reports, identify contradictions between them, calculate the most important numerical differences, and produce a recommendation.",
  "Analyze sales.csv and determine the likely drivers of the sales decline. Show the evidence and produce a summary.",
  "Examine these logs and notes and determine what changed around the error spike.",
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
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold">New mission</h1>
      <p className="mt-1 text-sm text-muted">Describe any objective. TRACE generates the plan — you never pick a workflow template.</p>

      <div className="glass mt-6 rounded-2xl p-6">
        <div className="mb-2 font-mono text-xs text-muted">
          DATA SOURCES ({sources.length}) — {sources.map((s) => s.name).join(", ") || "none uploaded"}
          {sources.length === 0 && (
            <a href="/app/data" className="ml-2 text-accent hover:underline">Upload data →</a>
          )}
        </div>
        <form onSubmit={start}>
          <textarea
            required
            rows={5}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Analyze these three reports, compare the claims, identify contradictions, and produce a recommendation…"
            className="w-full resize-y rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="mt-3 space-y-2">
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => setObjective(ex)}
                className="block w-full truncate rounded-lg border border-border px-3 py-2 text-left text-xs text-muted hover:border-accent/40 hover:text-foreground transition">
                {ex}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
          <button disabled={creating || objective.trim().length < 10}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-medium text-background hover:brightness-110 disabled:opacity-50 transition">
            {creating ? "Planning mission…" : "Start mission"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-xs text-muted">
        Reads and analysis run automatically. High-impact actions pause at an approval gate.
      </p>
    </div>
  );
}
