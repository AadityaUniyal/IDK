import Link from "next/link";
import Logo from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="trace-grid-bg flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="flex justify-center"><Logo /></div>
        <div className="mt-12 font-mono text-xs tracking-[0.3em] text-accent">SIGNAL LOST / 404</div>
        <h1 className="mt-4 text-4xl font-semibold">This trace does not exist.</h1>
        <p className="mt-4 text-muted">The requested mission surface could not be located. Return to a known control point and continue the investigation.</p>
        <Link href="/" className="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 font-medium text-background">Return to TRACE</Link>
      </div>
    </main>
  );
}
