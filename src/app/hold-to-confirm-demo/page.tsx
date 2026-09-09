import HoldToConfirmDemo from "@/components/ui/hold-to-confirm-demo";

export default function HoldToConfirmDemoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-md">
        <h1 className="text-xl font-semibold text-slate-100">Hold To Confirm Component</h1>
        <p className="mt-2 text-sm text-slate-400">
          Press and hold the button below until the progress fills to confirm the action.
        </p>
        <div className="mt-6">
          <HoldToConfirmDemo />
        </div>
      </div>
    </main>
  );
}
