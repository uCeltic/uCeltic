// Shared toolbar button styles. AccountMenu renders inside ToolBar, so it cannot import
// these from ToolBar without a cycle — they live here, and both import them.

// `inline-flex items-center gap-1.5` lets every toolbar button pair an icon with
// its label; below `xl` the label span hides and the icon stands alone (ADR-0011).
// `shrink-0` keeps the buttons at their intrinsic width so only the search input
// gives up space when the bar tightens — the bar never overflows the page body.
// Exported so the dropdown triggers (Scope, Tag Filter, …) compose their own
// colour variants on top of the one shape, rather than restating the string.
export const toolbarBtnBase =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

// Add Text / manuscript / font-size buttons — and the AccountMenu trigger.
export const secondaryBtn = `${toolbarBtnBase} border border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;

// The "on" state, for the Search and manuscript toggles.
export const toggleOnBtn = `${toolbarBtnBase} border border-[#52524F] bg-[#52524F] text-white hover:bg-[#3F3F3C]`;

// The label that sits beside a toolbar icon: shown wide, hidden (icon-only) below `xl`.
// The button still carries an `aria-label`/`title`, so hiding the text keeps the
// control both tooltipped and named for assistive tech.
export const toolbarLabel = "hidden xl:inline";
