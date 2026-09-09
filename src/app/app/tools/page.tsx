"use client";

import { useEffect, useState } from "react";

type Tool = { name: string; description: string; inputSchema: Record<string, string>; riskLevel: string };

const riskStyle: Record<string, string> = {
  read: "border-accent/50 text-accent",
  analyze: "border-accent/50 text-accent",
  write: "border-amber/60 text-amber",
  external: "border-amber/60 text-amber",
  destructive: "border-red-500/60 text-red-300",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  useEffect(() => {
    fetch("/api/tools").then((r) => r.json()).then((d) => setTools(d.tools ?? []));
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">Tool registry</h1>
      <p className="mt-1 text-sm text-muted">
        Capabilities the agent can discover and invoke at runtime. Risk class determines whether an action runs automatically or pauses at the approval gate.
      </p>
      <div className="mt-8 space-y-3">
        {tools.map((t) => (
          <div key={t.name} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-accent">{t.name}</span>
              <span className={`rounded-full border px-3 py-0.5 font-mono text-xs ${riskStyle[t.riskLevel] ?? "border-border text-muted"}`}>
                {t.riskLevel}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">{t.description}</p>
            <div className="mt-3 font-mono text-[11px] text-muted">
              {Object.entries(t.inputSchema).map(([k, v]) => (
                <div key={k}>· <span className="text-foreground">{k}</span>: {v}</div>
              ))}
            </div>
          </div>
        ))}
        {tools.length === 0 && <p className="font-mono text-sm text-muted">Loading registry…</p>}
      </div>
    </div>
  );
}
