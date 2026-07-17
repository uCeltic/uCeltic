# 6. Drop the workspace study prompt

- Status: Accepted
- Date: 2026-07-16
- Deciders: Zhou Dejian
- Amends: [ADR-0004](0004-public-tool-with-optional-accounts.md) — the decision
  that the August cohort would be funneled "by protocol... plus a dismissible
  in-app prompt, not by technical gating." The in-app prompt half of that is
  dropped; the invitation-protocol half is unaffected.

## Context

`StudyPrompt` (`client/src/workspace/panels/StudyPrompt.tsx`) is a dismissible
banner shown to anonymous visitors on the workspace route, inviting them to
sign in or register "so your sessions can be attributed to you." It was built
as part of the original auth/signup work (#65), before Entry Notice existed.

Two things built since then make it redundant:

- **Entry Notice** ([ADR-0005](0005-generic-entry-notice-not-per-account-consent.md))
  now shows a banner to every visitor, guest and signed-in alike, at the app's
  entry point. An anonymous visitor on `/workspace` can see both banners
  stacked at once — Entry Notice at the top, `StudyPrompt` beneath the
  toolbar.
- **`AccountMenu`** (`client/src/workspace/panels/ToolBar.tsx`) already
  renders a persistent "Sign in" link in the toolbar for anonymous visitors,
  independent of `StudyPrompt`. The sign-in path StudyPrompt exists to
  surface was already one click away.

`StudyPrompt` is therefore a second banner nagging toward an action
(signing in) that a permanent toolbar control already offers, layered under a
first banner that already discloses the recording this tool does.

## Decision

**Remove `StudyPrompt` entirely** — the component, its tests, its render
call in `WorkspaceLayout.tsx`, and its supporting `authStore.ts` state
(`promptDismissed`, `shouldShowStudyPrompt`, `dismissStudyPrompt`,
`STUDY_PROMPT_DISMISSED_KEY`) and their tests.

**No replacement banner.** Anonymous visitors keep the toolbar's "Sign in"
link (`AccountMenu`) and the Entry Notice disclosure; neither is changed by
this decision.

**The August cohort continues to be funneled by invitation protocol alone**,
per ADR-0004 — invitations require signing in first. This decision removes
only the supplementary in-app nudge, not the funnel itself.

## Consequences

- `BehaviorEvent`/attribution mechanics, the questionnaire flow, and Entry
  Notice are all unaffected — this is a UI-only removal.
- An anonymous visitor who ignores the toolbar's "Sign in" link and never
  visits `/account/login` directly gets no further in-app nudge. Accepted:
  the study protocol's invitation already tells participants to sign in
  before they arrive.
- `docs/adr/0004-public-tool-with-optional-accounts.md`'s Status line is
  updated to note it is now superseded in part by both ADR-0005 and this
  ADR.

## Rejected alternatives

- **Keep `StudyPrompt` but only unmount it.** Leaves dead component code,
  dead store state, and dead tests behind for no benefit — nothing about
  this decision is expected to reverse.
- **Merge `StudyPrompt`'s copy into Entry Notice.** Rejected: ADR-0005
  already decided Entry Notice's copy is deliberately generic and
  account-status-agnostic; splicing in "sign in so your sessions can be
  attributed" would reopen that decision for no stated need.
