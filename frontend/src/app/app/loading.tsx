export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex items-center gap-3 font-mono text-sm text-muted">
        <span className="h-2.5 w-2.5 animate-trace-pulse rounded-full bg-accent" />
        Loading mission surface...
      </div>
    </div>
  );
}
