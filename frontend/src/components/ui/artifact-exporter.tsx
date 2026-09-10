"use client";

import { Download, FileCode, Check } from "lucide-react";
import { useState } from "react";

interface ArtifactExporterProps {
  title: string;
  content: string;
  type?: string;
}

export default function ArtifactExporter({ title, content, type = "report" }: ArtifactExporterProps) {
  const [downloaded, setDownloaded] = useState(false);

  function downloadFile(format: "md" | "json") {
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
    const fileContent =
      format === "json"
        ? JSON.stringify({ title, type, content, exportedAt: new Date().toISOString() }, null, 2)
        : content;

    const blob = new Blob([fileContent], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => downloadFile("md")}
        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition"
      >
        {downloaded ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Download className="h-3.5 w-3.5" />}
        Export Markdown (.md)
      </button>

      <button
        onClick={() => downloadFile("json")}
        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 transition"
      >
        <FileCode className="h-3.5 w-3.5" />
        JSON Bundle
      </button>
    </div>
  );
}
