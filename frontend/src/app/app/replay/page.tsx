"use client";

import { useEffect, useState } from "react";
import Ambient3DBackground from "@/components/ui/ambient-3d-background";
import TimeTravelReplay, { ReplayEvent } from "@/components/ui/time-travel-replay";
import { RotateCcw, Activity } from "lucide-react";

type MissionItem = {
  id: string;
  title: string;
  objective: string;
  status: string;
  created_at: string;
};

export default function ReplayPage() {
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSeq, setActiveSeq] = useState<number>(0);

  useEffect(() => {
    fetch("/api/missions")
      .then((r) => r.json())
      .then((d) => {
        setMissions(d.missions ?? []);
        if (d.missions?.length > 0) {
          setSelectedMissionId(d.missions[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMissionId) return;
    fetch(`/api/missions/${selectedMissionId}`)
      .then((r) => r.json())
      .then((d) => {
        const evs = d.events ?? [];
        setEvents(evs);
        if (evs.length > 0) {
          setActiveSeq(evs[0].sequence_number);
        }
      });
  }, [selectedMissionId]);

  const visibleEvents = events.filter((e) => e.sequence_number <= activeSeq);

  return (
    <div className="relative min-h-screen p-6 md:p-10 text-slate-100 bg-slate-950">
      <Ambient3DBackground />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400">
              <RotateCcw className="h-4 w-4" /> TRAJECTORY REPLAY CENTER
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">
              Time-Travel Agent Execution Inspector
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Scrub backwards and forwards through persisted mission event trajectories to inspect exact state changes.
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* Mission Selector Sidebar */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md h-fit">
            <h2 className="font-mono text-xs text-cyan-400 font-semibold tracking-wider mb-3 uppercase">
              Select Mission ({missions.length})
            </h2>

            {loading ? (
              <div className="font-mono text-xs text-slate-500 py-4">Loading missions...</div>
            ) : missions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No completed or running missions available.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {missions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMissionId(m.id)}
                    className={`w-full text-left rounded-xl p-3 border transition ${
                      selectedMissionId === m.id
                        ? "border-cyan-500/50 bg-cyan-950/40 text-slate-100"
                        : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="font-medium text-xs truncate">{m.title}</div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                      <span className="capitalize">{m.status.replaceAll("_", " ")}</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Replay Surface */}
          <main className="space-y-6">
            {events.length > 0 ? (
              <>
                <TimeTravelReplay
                  events={events}
                  onSeek={(seq) => setActiveSeq(seq)}
                />

                {/* Event Log Stream */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
                  <h3 className="font-mono text-xs font-semibold text-cyan-400 uppercase mb-4">
                    Active Step Log ({visibleEvents.length} / {events.length} events)
                  </h3>

                  <div className="space-y-2 font-mono text-xs max-h-[400px] overflow-y-auto pr-2">
                    {visibleEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-cyan-400 font-semibold">#{ev.sequence_number} · {ev.type}</span>
                          <span className="text-[10px] text-slate-500">{new Date(ev.created_at).toLocaleTimeString()}</span>
                        </div>
                        <pre className="mt-1 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(ev.payload_json, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
                <Activity className="mx-auto h-8 w-8 text-cyan-400 mb-3 animate-pulse" />
                <p className="text-sm">Select a mission from the list to inspect its trajectory replay.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
