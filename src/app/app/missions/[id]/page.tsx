"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import HoldToConfirm from "@/components/HoldToConfirm";

type Task = {
  id: string; label: string; description: string; tool: string; status: string;
  risk_level: string; requires_approval: boolean; position: number; output: string | null;
  tool_input: any;
};
type Event = { id: string; sequence_number: number; type: string; payload_json: any; created_at: string };
type Evidence = { id: string; excerpt: string; location: string | null; source_name: string | null; task_id: string | null };
type Artifact = { id: string; title: string; content: string };
type Approval = { id: string; action_name: string; risk_level: string; reason: string; status: string; task_id: string };
type MissionData = {
  mission: { id: string; title: string; objective: string; status: string; normalized_goal: string | null };
  tasks: Task[]; events: Event[]; evidence: Evidence[]; artifacts: Artifact[]; approvals: Approval[];
};

const taskStatusStyle: Record<string, string> = {
  completed: "border-accent/60 bg-accent/10",
  running: "border-amber/70 bg-amber/10",
  waiting_approval: "border-amber/70 bg-amber/15 animate-trace-pulse",
  pending: "border-border bg-surface",
  failed: "border-red-500/50 bg-red-500/10",
  skipped: "border-border bg-surface opacity-50",
};

const eventIcon: Record<string, string> = {
  GOAL_RECEIVED: "◆", MISSION_STARTED: "▶", PLAN_CREATED: "⛏", TASK_STARTED: "◉", TOOL_CALLED: "⚙",
  TASK_COMPLETED: "✓", TASK_FAILED: "✗", EVIDENCE_FOUND: "◈", APPROVAL_REQUIRED: "⚠",
  APPROVAL_GRANTED: "🔓", APPROVAL_REJECTED: "⊘", MISSION_COMPLETED: "★",
};

export default function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MissionData | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<"activity" | "evidence" | "replay" | "artifact">("activity");
  const stepping = useRef(false);
  const started = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/missions/${id}`);
    if (!res.ok) return null;
    const d: MissionData = await res.json();
    setData(d);
    return d;
  }, [id]);

  // Drive the agent: while the mission is active, repeatedly call /step.
  useEffect(() => {
    if (!data) return;
    const status = data.mission.status;
    if (status === "completed" || status === "failed" || status === "cancelled" || status === "draft") return;
    if (status === "waiting_for_approval") return;
    if (stepping.current) return;
    stepping.current = true;
    fetch(`/api/missions/${id}/step`, { method: "POST" })
      .then((r) => r.json())
      .then(async (r) => {
        if (r.advanced) await refresh();
      })
      .catch(() => {})
      .finally(() => {
        stepping.current = false;
        setTimeout(() => refresh(), 200);
      });
  }, [data, id, refresh]);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      refresh();
    }
  }, [refresh]);

  async function resolveApproval(approvalId: string, decision: "approved" | "rejected") {
    await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setTab("activity");
    refresh();
  }

  if (!data) {
    return <div className="flex h-screen items-center justify-center font-mono text-sm text-muted">
      <span className="mr-3 h-2 w-2 rounded-full bg-accent animate-trace-pulse" /> Loading mission…
    </div>;
  }

  const { mission, tasks, events, evidence, artifacts, approvals } = data;
  const pendingApproval = approvals.find((a) => a.status === "pending");
  const active = !["completed", "failed", "cancelled", "draft"].includes(mission.status);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted">TRACE / MISSION</div>
          <h1 className="truncate text-lg font-semibold">{mission.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 font-mono text-xs ${
            mission.status === "completed" ? "border-accent/60 text-accent"
            : mission.status === "waiting_for_approval" ? "border-amber/60 text-amber animate-trace-pulse"
            : "border-amber/60 text-amber animate-trace-pulse"}`}>
            {mission.status.replaceAll("_", " ").toUpperCase()}
          </span>
          {active && <span className="relative h-1.5 w-24 overflow-hidden rounded bg-surface-2">
            <span className="absolute inset-y-0 w-1/3 bg-accent animate-trace-scan" />
          </span>}
        </div>
      </header>

      {/* Approval banner */}
      {pendingApproval && (
        <div className="border-b border-amber/40 bg-amber/10 px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-mono text-xs tracking-widest text-amber">⚠ ACTION REQUIRES APPROVAL</div>
              <div className="mt-1 font-medium">{pendingApproval.action_name}</div>
              <div className="text-xs text-muted">Risk: {pendingApproval.risk_level.toUpperCase()} — {pendingApproval.reason}</div>
            </div>
            <div className="w-full md:w-80 space-y-2">
              <HoldToConfirm
                label="Hold to authorize"
                onConfirm={() => resolveApproval(pendingApproval.id, "approved")}
              />
              <button onClick={() => resolveApproval(pendingApproval.id, "rejected")}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition">
                Reject action
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Task graph */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="mb-4 font-mono text-xs tracking-widest text-muted">TASK GRAPH — {tasks.length} TASKS</h2>
          <div className="space-y-2">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`block w-full rounded-xl border p-4 text-left transition hover:border-accent/50 ${taskStatusStyle[t.status] ?? "border-border"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] text-muted">#{t.position + 1} {t.tool}</span>
                  <span className="font-mono text-[10px] text-muted">{t.status.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-1 text-sm font-medium">{t.label}</div>
                {t.requires_approval && <span className="mt-1 inline-block rounded border border-amber/50 px-1.5 py-0.5 font-mono text-[10px] text-amber">approval gated</span>}
              </button>
            ))}
          </div>

          {artifacts.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-mono text-xs tracking-widest text-muted">ARTIFACTS</h2>
              {artifacts.map((a) => (
                <div key={a.id} className="glass rounded-xl p-4">
                  <button onClick={() => { setTab("artifact"); }} className="font-medium text-accent hover:underline">{a.title}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inspector */}
        {selectedTask && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-border p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs tracking-widest text-muted">TASK INSPECTOR</h2>
              <button onClick={() => setSelectedTask(null)} className="text-muted hover:text-foreground">✕</button>
            </div>
            <div className={`mt-4 rounded-xl border p-4 ${taskStatusStyle[selectedTask.status]}`}>
              <div className="text-sm font-medium">{selectedTask.label}</div>
              {selectedTask.description && <p className="mt-1 text-xs text-muted">{selectedTask.description}</p>}
              <div className="mt-3 font-mono text-[10px] text-muted">
                tool: {selectedTask.tool} · risk: {selectedTask.risk_level}
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted">input: {JSON.stringify(selectedTask.tool_input)}</div>
            </div>
            {selectedTask.output && (
              <div className="mt-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">OUTPUT</div>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-xs">{selectedTask.output}</pre>
              </div>
            )}
            {evidence.filter((e) => e.task_id === selectedTask.id).length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[10px] tracking-widest text-muted">EVIDENCE LINKED</div>
                {evidence.filter((e) => e.task_id === selectedTask.id).map((e) => (
                  <div key={e.id} className="mt-2 rounded-lg border border-border p-2 text-xs">
                    <div className="font-mono text-[10px] text-accent">{e.source_name ?? "tool result"} {e.location ? `· ${e.location}` : ""}</div>
                    <div className="mt-1 line-clamp-4 text-muted">{e.excerpt}</div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* Bottom-right: activity / evidence / replay / artifact */}
        <aside className="flex w-[26rem] shrink-0 flex-col border-l border-border">
          <div className="flex border-b border-border font-mono text-xs">
            {(["activity", "evidence", "replay", "artifact"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-3 py-3 tracking-widest transition ${tab === t ? "text-accent border-b-2 border-accent" : "text-muted hover:text-foreground"}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "activity" && (
              <div className="space-y-2 font-mono text-xs">
                {events.length === 0 && <p className="text-muted">No events yet.</p>}
                {events.map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className={e.type.includes("FAILED") ? "text-red-300" : e.type.includes("APPROVAL") ? "text-amber" : "text-accent"}>
                      {eventIcon[e.type] ?? "·"}
                    </span>
                    <span className="text-muted">{new Date(e.created_at).toLocaleTimeString()}</span>
                    <span className="flex-1">
                      {e.type.replaceAll("_", " ").toLowerCase()}
                      {e.payload_json?.label ? ` — ${e.payload_json.label}` : e.payload_json?.action ? ` — ${e.payload_json.action}` : e.payload_json?.reason ? ` — ${e.payload_json.reason}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {tab === "evidence" && (
              <div className="space-y-3">
                {evidence.length === 0 && <p className="text-sm text-muted">No evidence collected yet.</p>}
                {evidence.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border p-3">
                    <div className="font-mono text-[10px] text-accent">{e.source_name ?? "tool result"} {e.location ? `· ${e.location}` : ""}</div>
                    <p className="mt-1 line-clamp-6 text-xs text-muted">{e.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
            {tab === "replay" && (
              <div className="space-y-2 font-mono text-xs">
                {events.map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className="text-muted">{new Date(e.created_at).toLocaleTimeString()}</span>
                    <span className="text-foreground">{e.type.replaceAll("_", " ").toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === "artifact" && (
              <div>
                {artifacts.length === 0 && <p className="text-sm text-muted">No artifacts yet. They appear when the mission completes.</p>}
                {artifacts.map((a) => (
                  <div key={a.id}>
                    <div className="font-medium text-accent">{a.title}</div>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{a.content}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
