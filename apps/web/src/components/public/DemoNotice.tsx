/** Shown on every example listing so nobody mistakes it for a real one. */
export function DemoNotice({ what = 'listing' }: { what?: string }) {
  return (
    <div className="rounded-xl border border-[#7c3aed]/30 bg-[#f5f0ff] px-4 py-3 text-sm text-[#4c1d95]">
      <strong className="mr-1 rounded bg-[#7c3aed] px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-white">Demo</strong>
      This is an example {what} that shows how Enhakkore works. It is not real, and registration is closed.
    </div>
  );
}
