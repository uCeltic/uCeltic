# 5. Generic entry notice replaces per-account consent copy

- Status: Accepted
- Date: 2026-07-14
- Deciders: Zhou Dejian
- Amends: [ADR-0004](0004-public-tool-with-optional-accounts.md) — the "Consent —
  re-done, because the premise changed" section promised specific per-account
  language (linked to your account, researcher-only, pseudonymized in any
  published analysis, deletable on request, destroyed after the thesis). That
  specific language is not built; see Decision.

## Context

Issue #68 carried an acceptance criterion to update "consent/info copy... wherever
it is shown or linked" with ADR-0004's specific promises. Before this decision, no
consent or privacy notice existed anywhere in the app — not in the client, not as
a static page. The owner wanted one thing instead: a single notice at the site's
entry point, telling *every* visitor (guest and signed-in alike) that usage is
recorded, with the same data collected regardless of account status.

This creates a real tension with ADR-0004, which frames consent as two different
stories: informed, account-linked consent for the identified study cohort (backed
by an ethics/advisor sign-off precondition) versus incidental, unremarked-upon
logging for anonymous ambient traffic. A single uniform notice for both
populations collapses that distinction.

## Decision

**One generic banner, shown identically to guest and signed-in visitors.** It
states that usage behavior is recorded, and that this is used to improve the
software and support a research project. It does **not** distinguish by
account status, and does **not** state the specific per-account promises ADR-0004
described (researcher-only, pseudonymized, deletable on request, destroyed after
the thesis). Copy:

> To help make this tool better, we record your activity while using it (such as
> searches performed, documents opened, and settings changed). This data is used
> to improve the software and as material for a research project. Whether you're
> a guest or signed in, the same data is recorded. If you don't want to be
> recorded, please don't continue using this site.

**No separate consent step for account holders.** Registration gains no checkbox
or additional flow; the same banner is the entire notice for both populations.

**No link-out, no expandable detail.** The banner is the complete text — no
secondary page carries the specific promises ADR-0004 anticipated.

**Acknowledgment is client-side only.** Dismissal is stored locally (e.g.
`localStorage`); there is no backend record of who saw or dismissed it, and no
new table.

**The advisor/ethics re-confirmation gate on #68 is unaffected by this ADR and
stays the owner's task**, done outside the codebase; this decision does not
supply the text that gate was originally expected to review.

## Consequences

- `BehaviorEvent.user`/cohort semantics (`user IS NOT NULL`) are unchanged — this
  ADR only touches what visitors are told, not what is collected or how it is
  attributed.
- CONTEXT.md's "researcher-only, pseudonymized" language (under **User**)
  describes internal data-handling practice; it is no longer restated to
  visitors at entry, and should not be read as UI copy.
- The ethics/advisor conversation on #68's human gate, if it still happens, now
  reviews this shorter banner text rather than the detailed promises ADR-0004
  described — a materially different, less specific thing to sign off on.
- If the advisor/ethics contact later requires the specific promises to be
  shown to the study cohort, that is new work, not something this ADR
  delivers.

## Rejected alternatives

- **Separate affirmative checkbox at registration**, giving account holders a
  distinct, recorded consent step. Rejected: adds a flow for a population the
  owner explicitly wants treated the same as guests.
- **Banner + link to a detail page carrying the specific promises.** Rejected:
  extra click, extra content to maintain, for no immediate need.
- **Different notice content for guest vs. signed-in.** Rejected: the owner
  wants identical data collection and identical notice regardless of account
  status.
- **Backend-recorded acknowledgment** (timestamped "seen" flag). Rejected as
  unnecessary complexity; `localStorage` is sufficient for the owner's purpose,
  and there is no evidentiary need if the ethics gate isn't relying on this
  banner's specific wording.
