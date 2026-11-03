/**
 * Page Jump (CONTEXT.md → Page Jump, #198): a click on a Print-Edition Locator
 * in one column brings every other open column of the same Work to that same
 * page of Stokes, lined up at the height the clicked locator sits at.
 *
 * It works on the rendered strip rather than on the parse trees, because what
 * it has to line up is where things are on screen, and the strip already holds
 * every open column — including the ones scrolled out of view sideways, which
 * jump like the rest.
 *
 * It only moves the columns. Search results, the Tag Filter's occurrence index
 * and Search History are store state this never touches, so each column's
 * "next result" and arrows carry on from where they were.
 */

/** A Print-Edition Locator: a `pb` that carries an `xml:id` (digitizedText.tsx). */
const PRINT_EDITION_LOCATOR_SELECTOR = '[data-tei-tag="pb"][data-tei-id]';

/** How long a found locator stays flashed, so the eye can find it. */
export const PAGE_JUMP_FLASH_MS = 1500;

// The attribute a found locator wears while it flashes; index.css animates it.
const FLASH_ATTRIBUTE = "data-page-jump-flash";

const flashTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/**
 * Page Jump from wherever an event landed in a column's text, if it landed on a
 * Print-Edition Locator. Says whether it did, so a key handler knows whether
 * the key was this control's to take.
 */
export function pageJumpFrom(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const locator = target.closest<HTMLElement>(PRINT_EDITION_LOCATOR_SELECTOR);
  if (!locator) return false;
  pageJump(locator);
  return true;
}

/**
 * Jump every other open column of the clicked locator's Work to its page.
 *
 * A column matches only on an identical `xml:id` — nothing is parsed out of
 * the locator, and a column without the page is never sent to the "nearest"
 * one. If a document has the id more than once, the first occurrence wins.
 */
export function pageJump(clicked: HTMLElement): void {
  const pageId = clicked.dataset.teiId;
  const column = clicked.closest<HTMLElement>("[data-doc-column-id]");
  const workId = column?.dataset.workId;
  const strip = column?.closest("[data-column-strip]");
  // A document no one has assigned to a Work has no Versions to jump to.
  if (!pageId || !column || !workId || !strip) return;

  const clickedTop = clicked.getBoundingClientRect().top;

  for (const other of strip.querySelectorAll<HTMLElement>("[data-doc-column-id]")) {
    if (other === column || other.dataset.workId !== workId) continue;

    // Compared as strings rather than spliced into a selector, so the match is
    // exactly `===` and an id with CSS-special characters cannot widen it.
    const target = [
      ...other.querySelectorAll<HTMLElement>(PRINT_EDITION_LOCATOR_SELECTOR),
    ].find((pb) => pb.dataset.teiId === pageId);
    const pane = other.querySelector<HTMLElement>("[data-column-text-pane]");
    if (!target || !pane) continue;

    // The pane's own scroll, never scrollIntoView: that would also scroll the
    // strip sideways to bring the column into view, and the strip stays put.
    pane.scrollTop += target.getBoundingClientRect().top - clickedTop;
    flash(target);
  }
}

function flash(el: HTMLElement): void {
  const pending = flashTimers.get(el);
  if (pending !== undefined) clearTimeout(pending);
  // Off and on again across a reflow, so a second jump to a locator that is
  // still flashing restarts the animation rather than letting it run out.
  el.removeAttribute(FLASH_ATTRIBUTE);
  void el.offsetWidth;
  el.setAttribute(FLASH_ATTRIBUTE, "");
  flashTimers.set(
    el,
    setTimeout(() => {
      el.removeAttribute(FLASH_ATTRIBUTE);
      flashTimers.delete(el);
    }, PAGE_JUMP_FLASH_MS),
  );
}
