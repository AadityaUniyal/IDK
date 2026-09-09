import Link from "next/link";
import Logo from "@/components/Logo";

const steps = [
  { n: "01", title: "Describe", body: "Give TRACE any objective and attach your own files, CSVs, logs or notes. No templates, no fixed workflows." },
  { n: "02", title: "Watch", body: "The agent plans a dynamic task graph, executes tools, gathers evidence, and adapts when results change the picture — streamed live." },
  { n: "03", title: "Approve", body: "Read-only investigation runs automatically. High-impact actions pause at an approval gate that requires your deliberate authorization." },
];

export default function Landing() {
  return (
    <main className="trace-grid-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/hero-demo" className="rounded-lg px-3 py-2 text-accent hover:bg-accent/10 transition">Hero Demo</Link>
          <Link href="/hold-to-confirm-demo" className="rounded-lg px-3 py-2 text-accent hover:bg-accent/10 transition">Hold to Confirm Demo</Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-muted hover:text-foreground transition">Sign in</Link>
          <Link href="/signup" className="rounded-lg border border-accent/50 px-3 py-2 text-accent hover:bg-accent/10 transition">Get started</Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center md:px-12">
        <p className="mb-4 rounded-full border border-border bg-surface/70 px-4 py-1 font-mono text-xs tracking-widest text-accent">
          INVESTIGATE · UNDERSTAND · ACT
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          A visual operating system for <span className="text-accent">autonomous AI work</span>
        </h1>
        <p className="mt-6 max-w-xl text-muted md:text-lg">
          Give the agent a goal. Watch it investigate. Stay in control.
          TRACE decomposes arbitrary objectives into tool-executable task graphs — with evidence, approvals and full replay.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup" className="rounded-lg bg-accent px-6 py-3 font-medium text-background hover:brightness-110 transition">
            Start your first mission
          </Link>
          <Link href="/login" className="rounded-lg border border-border px-6 py-3 hover:bg-surface transition">
            I already have an account
          </Link>
        </div>

        <div className="mt-16 w-full max-w-4xl">
          <div className="glass rounded-2xl p-6 text-left">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-accent animate-trace-pulse" />
              MISSION #2841 — INVESTIGATING
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {["understand objective", "search files", "query table", "compare metrics", "test hypothesis", "request approval", "execute", "verify", "report"].map((t, i) => (
                <span key={t} className={`rounded-full border px-3 py-1 ${i < 4 ? "border-accent/50 text-accent" : i === 4 ? "border-amber/60 text-amber animate-trace-pulse" : "border-border text-muted"}`}>
                  {i < 4 ? "✓ " : i === 4 ? "◉ " : "· "}{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 px-6 pb-20 md:grid-cols-3 md:px-12 max-w-6xl mx-auto w-full">
        {steps.map((s) => (
          <div key={s.n} className="glass rounded-2xl p-6">
            <div className="font-mono text-xs text-accent">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted md:px-12">
        TRACE — portfolio/research project. Every agent event is persisted, replayable and auditable.
      </footer>
    </main>
  );
}
