"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import HoldToConfirm from "@/components/ui/hold-to-confirm";
import InteractiveTaskGraph, { TaskNode } from "@/components/ui/interactive-task-graph";
import TimeTravelReplay from "@/components/ui/time-travel-replay";
import CommandPalette from "@/components/ui/command-palette";
import ChartRenderer, { ChartSpec } from "@/components/ui/chart-renderer";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";

type Task = TaskNode;
type Event = { id: string; sequence_number: number; type: string; payload_json: any; created_at: string };
type Evidence = { id: string; excerpt: string; location: string | null; source_name: string | null; task_id: string | null };
type Artifact = { id: string; title: string; content: string };
type Approval = { id: string; action_name: string; risk_level: string; reason: string; status: string; task_id: string };
type MissionData = {
  mission: { id: string; title: string; objective: string; status: string; normalized_goal: string | null };
  tasks: Task[]; events: Event[]; evidence: Evidence[]; artifacts: Artifact[]; approvals: Approval[];
};

const taskStatusStyle: Record<string, string> = {
  completed: "border-cyan-500/60 bg-cyan-950/20",
  running: "border-amber-500/70 bg-amber-950/20",
  waiting_approval: "border-amber-500/90 bg-amber-950/30 animate-pulse",
  pending: "border-slate-800 bg-slate-900/60",
  failed: "border-red-500/50 bg-red-950/20",
  skipped: "border-slate-800 bg-slate-900/30 opacity-50",
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

  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/missions/${id}/stream`);

    es.addEventListener("agent_event", () => {
      refresh();
    });

    es.addEventListener("mission_state", () => {
      refresh();
    });

    return () => {
      es.close();
    };
  }, [id, refresh]);

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

  function parseChartSpec(content: string): ChartSpec | null {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type === "chart" && Array.isArray(parsed.data)) {
        return parsed as ChartSpec;
      }
    } catch {}
    return null;
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center font-mono text-sm text-slate-400 bg-slate-950">
        <span className="mr-3 h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" /> Initializing TRACE Mission Environment…
      </div>
    );
  }

  const { mission, tasks, events, evidence, artifacts, approvals } = data;
  const pendingApproval = approvals.find((a) => a.status === "pending");
  const active = !["completed", "failed", "cancelled", "draft"].includes(mission.status);

  return (
    <div className="relative flex h-screen flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <Ambient3DBackground />
      <CommandPalette />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <div className="font-mono text-xs text-slate-400">TRACE / MISSION CANVAS</div>
          <h1 className="truncate text-lg font-semibold text-slate-100">{mission.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 font-mono text-xs ${
              mission.status === "completed"
                ? "border-cyan-500/60 text-cyan-400 bg-cyan-950/30"
                : mission.status === "waiting_for_approval"
                ? "border-amber-500/60 text-amber-300 bg-amber-950/30 animate-pulse"
                : "border-amber-500/60 text-amber-300 bg-amber-950/30 animate-pulse"
            }`}
          >
            {mission.status.replaceAll("_", " ").toUpperCase()}
          </span>
          {active && (
            <span className="relative h-1.5 w-24 overflow-hidden rounded bg-slate-800">
              <span className="absolute inset-y-0 w-1/3 bg-cyan-400 animate-pulse" />
            </span>
          )}
        </div>
      </header>

      {/* Approval Banner */}
      {pendingApproval && (
        <div className="relative z-10 border-b border-amber-500/40 bg-amber-950/20 px-6 py-4 backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-mono text-xs tracking-widest text-amber-400">⚠ ACTION REQUIRES AUTHORIZATION</div>
              <div className="mt-1 font-semibold text-slate-100">{pendingApproval.action_name}</div>
              <div className="text-xs text-slate-400">
                Risk Class: <span className="font-mono uppercase text-amber-300">{pendingApproval.risk_level}</span> — {pendingApproval.reason}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HoldToConfirm
                onConfirm={() => resolveApproval(pendingApproval.id, "approved")}
                confirmLabel="Action Authorized"
                className="bg-amber-500 text-slate-950 font-semibold border-amber-400 hover:bg-amber-400"
              >
                Hold to Authorize
              </HoldToConfirm>
              <button
                onClick={() => resolveApproval(pendingApproval.id, "rejected")}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Reject Action
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Task Graph Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="mb-4 font-mono text-xs tracking-widest text-slate-400">DYNAMIC TASK DAG GRAPH — {tasks.length} TASKS</h2>

          <InteractiveTaskGraph
            tasks={tasks}
            selectedTaskId={selectedTask?.id}
            onSelectTask={(t) => setSelectedTask(t)}
          />

          {artifacts.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-400">GENERATED ARTIFACTS</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {artifacts.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-cyan-500/50 transition">
                    <button
                      onClick={() => {
                        setTab("artifact");
                      }}
                      className="font-medium text-cyan-400 hover:underline"
                    >
                      {a.title}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Task Inspector */}
        {selectedTask && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs tracking-widest text-slate-400">TASK INSPECTOR</h2>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-100">
                ✕
              </button>
            </div>
            <div className={`mt-4 rounded-xl border p-4 ${taskStatusStyle[selectedTask.status]}`}>
              <div className="text-sm font-semibold text-slate-100">{selectedTask.label}</div>
              {selectedTask.description && <p className="mt-1 text-xs text-slate-400">{selectedTask.description}</p>}
              <div className="mt-3 font-mono text-[10px] text-slate-400">
                Tool: <span className="text-cyan-400">{selectedTask.tool}</span> · Risk: <span className="uppercase text-amber-300">{selectedTask.risk_level}</span>
              </div>
              <div className="mt-2 font-mono text-[10px] text-slate-400">
                Input: <code className="text-slate-300">{JSON.stringify(selectedTask.tool_input)}</code>
              </div>
            </div>

            {selectedTask.output && (
              <div className="mt-4">
                <div className="font-mono text-[10px] tracking-widest text-slate-400">EXECUTION OUTPUT</div>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
                  {selectedTask.output}
                </pre>
              </div>
            )}

            {evidence.filter((e) => e.task_id === selectedTask.id).length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[10px] tracking-widest text-slate-400">EVIDENCE LINKED</div>
                {evidence
                  .filter((e) => e.task_id === selectedTask.id)
                  .map((e) => (
                    <div key={e.id} className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                      <div className="font-mono text-[10px] text-cyan-400">
                        {e.source_name ?? "tool result"} {e.location ? `· ${e.location}` : ""}
                      </div>
                      <div className="mt-1 line-clamp-4 text-slate-300">{e.excerpt}</div>
                    </div>
                  ))}
              </div>
            )}
          </aside>
        )}

        {/* Activity / Evidence / Replay / Artifact Sidebar */}
        <aside className="flex w-[26rem] shrink-0 flex-col border-l border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <div className="flex border-b border-slate-800 font-mono text-xs">
            {(["activity", "evidence", "replay", "artifact"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-3 tracking-widest transition ${
                  tab === t ? "border-b-2 border-cyan-400 text-cyan-400 bg-cyan-950/20" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "activity" && (
              <div className="space-y-2 font-mono text-xs">
                {events.length === 0 && <p className="text-slate-500">No events recorded yet.</p>}
                {events.map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className={e.type.includes("FAILED") ? "text-red-400" : e.type.includes("APPROVAL") ? "text-amber-400" : "text-cyan-400"}>
                      {eventIcon[e.type] ?? "·"}
                    </span>
                    <span className="text-slate-500">{new Date(e.created_at).toLocaleTimeString()}</span>
                    <span className="flex-1 text-slate-300">
                      {e.type.replaceAll("_", " ").toLowerCase()}
                      {e.payload_json?.label
                        ? ` — ${e.payload_json.label}`
                        : e.payload_json?.action
                        ? ` — ${e.payload_json.action}`
                        : e.payload_json?.reason
                        ? ` — ${e.payload_json.reason}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "evidence" && (
              <div className="space-y-3">
                {evidence.length === 0 && <p className="text-sm text-slate-500">No evidence collected yet.</p>}
                {evidence.map((e) => (
                  <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="font-mono text-[10px] text-cyan-400">
                      {e.source_name ?? "tool result"} {e.location ? `· ${e.location}` : ""}
                    </div>
                    <p className="mt-1 line-clamp-6 text-xs text-slate-300">{e.excerpt}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "replay" && (
              <div>
                <TimeTravelReplay events={events} />
              </div>
            )}

            {tab === "artifact" && (
              <div className="space-y-4">
                {artifacts.length === 0 && <p className="text-sm text-slate-500">No artifacts generated yet.</p>}
                {artifacts.map((a) => {
                  const chartSpec = parseChartSpec(a.content);
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="font-semibold text-cyan-400">{a.title}</div>
                      {chartSpec ? (
                        <ChartRenderer spec={chartSpec} />
                      ) : (
                        <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed">{a.content}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
