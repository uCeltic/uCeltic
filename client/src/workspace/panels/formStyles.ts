// Shared form tokens for the workspace's two typed-into surfaces — the questionnaire
// modal and the feedback popover. They were one copy each until #137 made it two; the
// same reasoning as buttonStyles.ts applies, so they live here rather than drifting.
//
// Deliberately not shared with pages/account/AccountShell: that module is scoped to the
// /account/* routes and owns its own look.

export const inputStyle =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#52524F] focus:ring-2 focus:ring-[#52524F]/20 transition-all";

export const labelStyle = "block text-sm font-medium text-[#52524F]";

// The one full-width commit button a workspace form ends with (Submit, Send).
export const primaryBtnStyle =
  "w-full rounded-md border border-[#52524F] bg-[#52524F] px-3 py-2 text-sm font-medium text-white cursor-pointer transition-all hover:bg-[#3F3F3C] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";
