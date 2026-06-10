
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount any rendered React tree after each test so component tests don't
// leak DOM (and shared store state) into one another.
afterEach(() => {
  cleanup();
});

// --- Minimal CSS Custom Highlight API polyfill: jsdom implements neither
// `Highlight` nor `CSS.highlights`, so we stub them to unit-test repainting ---
class HighlightPolyfill extends Set<Range> {}
if (typeof globalThis.Highlight === "undefined") {
  globalThis.Highlight = HighlightPolyfill as unknown as typeof Highlight;
}
if (typeof globalThis.CSS === "undefined") {
  globalThis.CSS = {} as unknown as typeof globalThis.CSS;
}
if (!globalThis.CSS.highlights) {
  globalThis.CSS.highlights = new Map() as unknown as typeof globalThis.CSS.highlights;
}

// jsdom implements neither scroll method; stub them so smooth-scroll calls in
// components are no-ops instead of throwing "Not implemented" during tests.
Element.prototype.scrollIntoView = () => {};
window.scrollTo = (() => {}) as typeof window.scrollTo;