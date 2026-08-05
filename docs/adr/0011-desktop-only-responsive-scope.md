# 11. Responsive scope is desktop-only: adapt to window/split-screen, not mobile

- Status: Accepted
- Date: 2026-07-21
- Deciders: Zhou Dejian

> **Update (2026-08-05).** This document decided the tool bar; the document area
> below it was still collapsing at the same widths, until a column was narrower
> than its own ✕ and result arrows.
> [ADR-0019](0019-columns-keep-a-minimum-width-and-the-strip-scrolls.md) extends
> the scope here to the columns: they take a `min-width` and the strip scrolls
> horizontally, deliberately not the measure-and-collapse scheme rejected below.
> Nothing in this document changes.

## Context

The workspace is built for **desktop browsers only**. "Responsive" here means
the layout must survive a shrunk window or a vertically split screen on a
desktop — today it collapses badly (the toolbar's ten controls overflow and the
menu folds wrongly). It explicitly does **not** target phones or tablets, and we
may state that limitation to users.

## Decision

A **two-breakpoint** toolbar. Wide → text labels; below the breakpoint →
**icon-only** controls with tooltips; narrower still → the IIIF Manuscript panel
auto-hides and restores when the window grows back.

## Consequences

- Text→icon swaps must **not** drop client-requirement terms. In particular the
  Manuscript control keeps the word "Manuscripts" and is distinguished by an
  icon, never renamed to "Books" (see CONTEXT.md → Manuscript).
- Toolbar space is freed by moving the font-size (`A−`/`A+`) and Account
  controls into a hamburger menu.

## Rejected alternatives

- A full `ResizeObserver` measure-and-collapse scheme — judged too costly for
  the pre-workshop delivery.
- A second toolbar row: "two levels is messy — we already pile everything in one
  row", so the framework-only empty second row is not built.
