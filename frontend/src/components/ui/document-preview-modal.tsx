"use client";

import { useState } from "react";
import { X, FileText, Search, Table, Copy, Check } from "lucide-react";

export type DataSource = {
  id: string;
  name: string;
  type: string;
  content: string;
  created_at?: string;
};

interface DocumentPreviewModalProps {
  source: DataSource | null;
  onClose: () => void;
}

export default function DocumentPreviewModal({ source, onClose }: DocumentPreviewModalProps) {
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);

  if (!source) return null;

  const isCsv = source.type === "csv" || source.name.endsWith(".csv");
  const lines = source.content.split(/\r?\n/).filter(Boolean);

  const filteredLines = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  function copyContent() {
    navigator.clipboard.writeText(source?.content ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
              {isCsv ? <Table className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">{source.name}</h2>
              <p className="font-mono text-xs text-slate-400">
                {source.type.toUpperCase()} · {source.content.length.toLocaleString()} characters · {lines.length} lines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyContent}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-300 hover:border-cyan-500/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Raw"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center border-b border-slate-800 px-6 py-2.5 bg-slate-950/40">
          <Search className="h-4 w-4 text-slate-400 mr-2" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter lines in document..."
            className="w-full bg-transparent font-mono text-xs text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>

        {/* Document Content View */}
        <div className="flex-1 overflow-auto p-6 font-mono text-xs">
          {filteredLines.length === 0 ? (
            <p className="py-8 text-center text-slate-500">No lines matched "{filter}".</p>
          ) : (
            <div className="space-y-1">
              {filteredLines.map((line, idx) => (
                <div key={idx} className="flex gap-4 hover:bg-slate-800/40 px-2 py-0.5 rounded">
                  <span className="w-10 shrink-0 text-right text-slate-600 select-none">{idx + 1}</span>
                  <span className="text-slate-300 whitespace-pre-wrap break-all">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
