// Shared toolbar button styles. AccountMenu renders inside ToolBar, so it cannot import
// these from ToolBar without a cycle — they live here, and both import them.

// Add Text / manuscript / font-size buttons — and the AccountMenu trigger.
export const secondaryBtn =
  "rounded-md border border-[#E5E2D6] bg-white px-2.5 py-1.5 text-sm font-medium text-[#52524F] cursor-pointer transition-all hover:bg-[#F0EEE6] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

// The "on" state, for the Search and manuscript toggles.
export const toggleOnBtn =
  "rounded-md border border-[#52524F] bg-[#52524F] px-2.5 py-1.5 text-sm font-medium text-white cursor-pointer transition-all hover:bg-[#3F3F3C] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";
