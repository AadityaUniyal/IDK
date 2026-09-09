export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 font-bold tracking-tight text-white select-none">
      <div
        className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 shadow-md shadow-cyan-500/20"
        style={{ width: size, height: size }}
      >
        <span className="font-mono text-xs font-black text-white">T</span>
      </div>
      <span className="text-base font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">
        TRACE
      </span>
    </div>
  );
}
