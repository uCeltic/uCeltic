import { useRef, useEffect, useState } from "react";
import { useWorkspaceStore } from "../../store/workspaceStore";

const WORKS = [
  { id: "the_finn_cycle", name: "The Finn Cycle" },
  { id: "tain", name: "Táin Bó Cúailnge" },
  { id: "saltair", name: "Saltair na Rann" },
];

const btnBase =
  "rounded-md border px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";
const btnIdle = `${btnBase} border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;
const btnOpen = `${btnBase} border-[#52524F] bg-[#F0EEE6] text-[#52524F]`;

export default function ScopeButton() {
  const selectedWorkIds = useWorkspaceStore((s) => s.selectedWorkIds);
  const setSelectedWorkIds = useWorkspaceStore((s) => s.setSelectedWorkIds);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const label =
    selectedWorkIds.length === 0
      ? "All Works"
      : selectedWorkIds.length === 1
        ? (WORKS.find((w) => w.id === selectedWorkIds[0])?.name ?? "1 Work")
        : `${selectedWorkIds.length} Works`;

  const toggle = (id: string) => {
    setSelectedWorkIds(
      selectedWorkIds.includes(id)
        ? selectedWorkIds.filter((w) => w !== id)
        : [...selectedWorkIds, id],
    );
  };
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
<div ref={ref} className="relative">
        <button type="button" className={open ? btnOpen : btnIdle} onClick={() => setOpen((v) => !v)}>
          {label} ▾
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1
  shadow-md">
            {WORKS.map((w) => (
              <label
                key={w.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-[#F0EEE6]"
              >
                <input
                  type="checkbox"
                  checked={selectedWorkIds.includes(w.id)}
                  onChange={() => toggle(w.id)}
                  className="accent-[#52524F]"
                />
                {w.name}
              </label>
            ))}
          </div>
        )}
      </div>
  );
}
