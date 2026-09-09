"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoldToConfirm from "@/components/HoldToConfirm";

type Approval = {
  id: string; action_name: string; risk_level: string; reason: string; status: string;
  requested_at: string; mission_id: string; mission_title: string; mission_objective: string;
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[] | null>(null);

  async function load() {
    const d = await fetch("/api/approvals").then((r) => r.json());
    setApprovals(d.approvals ?? []);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string, decision: "approved" | "rejected") {
    await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    load();
  }

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const resolved = (approvals ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">Approval center</h1>
      <p className="mt-1 text-sm text-muted">Actions the agent proposed that require deliberate human authorization.</p>

      {pending.length === 0 ? (
        <div className="glass mt-8 rounded-2xl p-10 text-center text-muted">No actions awaiting approval.</div>
      ) : (
        <div className="mt-8 space-y-4">
          {pending.map((a) => (
            <div key={a.id} className="rounded-2xl border border-amber/50 bg-amber/5 p-6">
              <div className="font-mono text-xs tracking-widest text-amber">⚠ ACTION REQUIRES APPROVAL · RISK {a.risk_level.toUpperCase()}</div>
              <div className="mt-2 font-medium">{a.action_name}</div>
              <p className="mt-1 text-sm text-muted">{a.reason}</p>
              <Link href={`/app/missions/${a.mission_id}`} className="mt-1 block text-xs text-accent hover:underline">
                Mission: {a.mission_title}
              </Link>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="sm:w-72">
                  <HoldToConfirm label="Hold to authorize" onConfirm={() => resolve(a.id, "approved")} />
                </div>
                <button onClick={() => resolve(a.id, "rejected")}
                  className="rounded-lg border border-border px-4 py-3 text-sm text-muted hover:text-foreground transition">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-10">
          <h2 className="font-mono text-xs tracking-widest text-muted">RESOLVED</h2>
          <div className="mt-3 space-y-2">
            {resolved.map((a) => (
              <div key={a.id} className="glass flex items-center justify-between rounded-xl px-4 py-3 text-sm">
                <span className="truncate">{a.action_name}</span>
                <span className={`font-mono text-xs ${a.status === "approved" ? "text-accent" : "text-red-300"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
