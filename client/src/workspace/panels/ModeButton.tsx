import { useRef, useEffect, useState } from "react";
import { useWorkspaceStore, MODE_LABELS } from "../../store/workspaceStore";
import type { WorkspaceMode } from "../../store/workspaceStore";

const MODES: WorkspaceMode[] = ["search", "entities", "personal"];

const btnBase =
  "rounded-md border px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";
const btnIdle = `${btnBase} border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;
const btnOpen = `${btnBase} border-[#52524F] bg-[#F0EEE6] text-[#52524F]`;

export default function ModeButton() {
  const mode = useWorkspaceStore((s) => s.mode);
  const setMode = useWorkspaceStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? btnOpen : btnIdle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {MODE_LABELS[mode]} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1
shadow-md">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${m === mode ?
"bg-[#F0EEE6] font-semibold text-[#52524F]" : "text-gray-600 hover:bg-[#F0EEE6]"}`}
              onClick={() => { setMode(m); setOpen(false); }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}