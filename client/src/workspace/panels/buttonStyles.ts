// Shared toolbar button styles. AccountMenu renders inside ToolBar, so it cannot import
// these from ToolBar without a cycle — they live here, and both import them.

// `inline-flex items-center gap-1.5` lets every toolbar button pair an icon with
// its label; as the bar tightens the label spans hide in stages and the icons
// stand alone (ADR-0011, staged by ADR-0020).
// `shrink-0` keeps the buttons at their intrinsic width so only the search input
// gives up space when the bar tightens — the bar never overflows the page body.
// Exported so the dropdown triggers (Scope, Tag Filter, …) compose their own
// colour variants on top of the one shape, rather than restating the string.
export const toolbarBtnBase =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

// Add Text / manuscript / font-size buttons — and the AccountMenu trigger.
// The `disabled:` variants grey out a control the workspace cannot honour right now
// — the too-narrow window for Manuscripts (#160) — the same way the dropdowns dim
// their own actions (WorkPicker), rather than swapping in a second class string.
export const secondaryBtn = `${toolbarBtnBase} border border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-white`;

// The "on" state, for the Search and manuscript toggles.
// It carries `disabled:` variants for one reason: Search disables itself while a
// search is in flight, and the spinner that says so does not spin for a reader on
// `prefers-reduced-motion`. Dimming the button says it without moving anything —
// otherwise a running search would be invisible to them at every width (#174).
export const toggleOnBtn = `${toolbarBtnBase} border border-[#52524F] bg-[#52524F] text-white hover:bg-[#3F3F3C] disabled:cursor-progress disabled:border-[#8A8778] disabled:bg-[#8A8778] disabled:hover:bg-[#8A8778]`;

// The two two-level toolbar dropdowns (Tag Filter, Works) share one trigger:
// same shape closed, same darkened border while their panel is open. Kept here
// so the pair cannot drift apart — they sit side by side.
export const dropdownTriggerIdle = `${toolbarBtnBase} border border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;
export const dropdownTriggerOpen = `${toolbarBtnBase} border border-[#52524F] bg-[#F0EEE6] text-[#52524F]`;

// The label that sits beside a toolbar icon. Hiding one is always safe for assistive
// tech — the button keeps its `aria-label`/`title` — so the only question is what a
// sighted reader loses, and the answer differs per control. Labels therefore collapse
// in two stages, ordered by how much the label says that its icon does not (ADR-0020).
//
// Stock Tailwind breakpoints only. `responsive.ts` already needs `lg`/`xl` kept in
// step with the layout; a bespoke width here would be a third number to keep in step.

/**
 * Stage one, hidden below `xl` (1280px): the label repeats what the icon and the
 * button's own state already say. Add Text beside a file-plus glyph; "Hide
 * Manuscripts" beside a book glyph on a button whose colour and `aria-pressed`
 * carry the toggle state; "Advanced" beside sliders.
 */
export const toolbarLabelFirstToGo = "hidden xl:inline";

/**
 * Stage two, hidden below `lg` (1024px): the label is the control's only statement
 * of *content*, not just of identity. The Tag Filter and Works triggers render the
 * selected entity and work, so their labels are the one place the workspace says
 * what it is currently filtered to; Search's is the action the whole bar exists for.
 * These go last, at the same width where the Manuscript panel itself auto-hides.
 */
export const toolbarLabelLastToGo = "hidden lg:inline";
