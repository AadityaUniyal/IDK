"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, PieChart as PieIcon } from "lucide-react";

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type ChartSpec = {
  type: "chart";
  chartType: "bar" | "line" | "pie";
  title: string;
  data: ChartDataPoint[];
};

interface ChartRendererProps {
  spec: ChartSpec;
}

export default function ChartRenderer({ spec }: ChartRendererProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { title, chartType, data } = spec;
  if (!data || !data.length) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const colors = ["#38d5f0", "#f0b438", "#38f0a3", "#a855f7", "#ec4899", "#3b82f6"];

  return (
    <div className="my-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {chartType === "line" ? (
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          ) : chartType === "pie" ? (
            <PieIcon className="h-4 w-4 text-amber-400" />
          ) : (
            <BarChart3 className="h-4 w-4 text-cyan-400" />
          )}
          <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
        <span className="font-mono text-[10px] uppercase text-slate-500">{chartType} chart</span>
      </div>

      {/* Bar Chart */}
      {chartType === "bar" && (
        <div className="space-y-3">
          {data.map((item, i) => {
            const pct = Math.round((item.value / maxValue) * 100);
            const color = colors[i % colors.length];
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group cursor-pointer"
              >
                <div className="flex justify-between font-mono text-xs text-slate-300">
                  <span>{item.label}</span>
                  <span className="font-semibold text-slate-100">{item.value.toLocaleString()}</span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      boxShadow: isHovered ? `0 0 12px ${color}` : "none",
                    }}
                    className="h-full transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Line Chart */}
      {chartType === "line" && (
        <div className="relative pt-4">
          <div className="flex h-40 items-end justify-between gap-2 border-b border-l border-slate-800 pb-2 pl-2">
            {data.map((item, i) => {
              const heightPct = Math.max(10, Math.round((item.value / maxValue) * 100));
              const color = colors[i % colors.length];
              const isHovered = hoveredIndex === i;

              return (
                <div
                  key={item.label}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="flex flex-1 flex-col items-center gap-2 group cursor-pointer"
                >
                  <div
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: color,
                      boxShadow: isHovered ? `0 0 12px ${color}` : "none",
                    }}
                    className="w-full max-w-[28px] rounded-t-md transition-all duration-300"
                  />
                  <span className="truncate font-mono text-[10px] text-slate-400 max-w-[50px] text-center">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pie Chart / Legend */}
      {chartType === "pie" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-center p-4">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-cyan-500/30 bg-slate-950 shadow-inner">
              <span className="font-mono text-xs text-cyan-400 font-semibold">{data.length} Segments</span>
            </div>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {data.map((item, i) => (
              <div key={item.label} className="flex items-center justify-between rounded bg-slate-950/50 p-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="text-slate-300">{item.label}</span>
                </div>
                <span className="font-semibold text-slate-100">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
