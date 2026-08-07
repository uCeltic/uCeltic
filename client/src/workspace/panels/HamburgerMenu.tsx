import { useWorkspaceStore } from "../../store/workspaceStore";
import AccountMenu from "./AccountMenu";
import { secondaryBtn } from "./buttonStyles";
import { useDismissableDropdown } from "./useDismissableDropdown";

/**
 * The overflow menu on the right of the toolbar. It holds the low-frequency controls —
 * font size and account — so the toolbar's single row has room for search (ADR-0011).
 * `Show / Hide Manuscripts` deliberately stays a top-level toolbar button (#123).
 */
export default function HamburgerMenu() {
  const increaseFontSize = useWorkspaceStore((s) => s.increaseFontSize);
  const decreaseFontSize = useWorkspaceStore((s) => s.decreaseFontSize);
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={secondaryBtn}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        data-tour="menu"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>

      {open && (
        <div
          role="menu"
          // The tour's card keeps clear of an open panel, not just of the
          // button it rings (tourCardPlacement.ts).
          data-tour-panel=""
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[#D8D4C3] bg-white py-1 shadow-md"
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-xs text-[#8A8778]">Font size</span>
            <button type="button" onClick={decreaseFontSize} className={secondaryBtn}>
              A−
            </button>
            <button type="button" onClick={increaseFontSize} className={secondaryBtn}>
              A+
            </button>
          </div>
          <div className="my-1 border-t border-[#E5E2D6]" />
          <AccountMenu />
        </div>
      )}
    </div>
  );
}
