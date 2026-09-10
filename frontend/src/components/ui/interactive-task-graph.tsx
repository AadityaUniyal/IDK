"use client";

import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, Clock, Play, XCircle, ShieldAlert } from "lucide-react";

export type TaskNode = {
  id: string;
  label: string;
  description: string;
  tool: string;
  status: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "skipped" | string;
  risk_level: string;
  requires_approval: boolean;
  position: number;
  depends_on?: string[];
  output?: string | null;
  tool_input?: any;
};

interface InteractiveTaskGraphProps {
  tasks: TaskNode[];
  selectedTaskId?: string | null;
  onSelectTask: (task: TaskNode) => void;
}

const statusColors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  completed: { border: "border-cyan-500/80", bg: "bg-cyan-950/40", text: "text-cyan-400", glow: "rgba(56, 213, 240, 0.3)" },
  running: { border: "border-amber-400/90", bg: "bg-amber-950/40", text: "text-amber-300", glow: "rgba(240, 180, 56, 0.4)" },
  waiting_approval: { border: "border-amber-500/90", bg: "bg-amber-950/60", text: "text-amber-400 animate-pulse", glow: "rgba(245, 158, 11, 0.5)" },
  pending: { border: "border-slate-800", bg: "bg-slate-900/60", text: "text-slate-400", glow: "none" },
  failed: { border: "border-red-500/80", bg: "bg-red-950/40", text: "text-red-400", glow: "rgba(239, 68, 68, 0.3)" },
  skipped: { border: "border-slate-800/50", bg: "bg-slate-950/40", text: "text-slate-600 opacity-60", glow: "none" },
};

export default function InteractiveTaskGraph({ tasks, selectedTaskId, onSelectTask }: InteractiveTaskGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw connecting canvas lines between dependencies
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodeElements = Array.from(container.querySelectorAll<HTMLElement>("[data-task-id]"));
    const nodeCoords = new Map<string, { x: number; y: number }>();

    nodeElements.forEach((el) => {
      const taskId = el.getAttribute("data-task-id");
      if (!taskId) return;
      const rect = el.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      nodeCoords.set(taskId, {
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top + rect.height / 2,
      });
    });

    tasks.forEach((t) => {
      const targetPos = nodeCoords.get(t.id);
      if (!targetPos) return;

      for (const dependencyId of t.depends_on ?? []) {
        const sourcePos = nodeCoords.get(dependencyId);
        if (sourcePos) {
          ctx.beginPath();
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.strokeStyle = t.status === "completed" ? "rgba(56, 213, 240, 0.4)" : "rgba(100, 116, 139, 0.25)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        }
      }
    });
  }, [tasks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden p-2">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      <div className="relative z-10 space-y-3">
        {tasks.map((task, idx) => {
          const style = statusColors[task.status] ?? statusColors.pending;
          const isSelected = selectedTaskId === task.id;

          return (
            <button
              key={task.id}
              data-task-id={task.id}
              onClick={() => onSelectTask(task)}
              type="button"
              style={{ boxShadow: isSelected ? `0 0 20px ${style.glow}` : undefined }}
              className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-300 ${style.border} ${style.bg} ${
                isSelected ? "ring-2 ring-cyan-400/70" : "hover:border-cyan-500/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-semibold text-slate-300 border border-slate-800">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{task.tool}</span>
                </div>
                <div className="flex items-center gap-2">
                  {task.requires_approval && (
                    <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/30">
                      <ShieldAlert className="h-3 w-3" /> APPROVAL GATED
                    </span>
                  )}
                  <span className={`font-mono text-xs ${style.text}`}>
                    {task.status.replaceAll("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                {task.label}
              </div>

              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{task.description}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
