import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EntryNotice, { ENTRY_NOTICE_DISMISSED_KEY } from "./EntryNotice";

beforeEach(() => {
  localStorage.clear();
});

describe("EntryNotice", () => {
  it("shows the usage-recording notice identically regardless of who's visiting", () => {
    render(<EntryNotice />);

    expect(
      screen.getByText(/we record your activity while using it/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/whether you're a guest or signed in/i)).toBeInTheDocument();
  });

  it("disappears when dismissed, and records the dismissal in localStorage", () => {
    render(<EntryNotice />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText(/we record your activity/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(ENTRY_NOTICE_DISMISSED_KEY)).toBe("1");
  });

  it("stays dismissed on the next load, unlike the sessionStorage-only study prompt", () => {
    localStorage.setItem(ENTRY_NOTICE_DISMISSED_KEY, "1");

    const { container } = render(<EntryNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is an invitation, not a gate: it never blocks pointer events on the page below it", () => {
    render(<EntryNotice />);

    const banner = screen.getByRole("status");
    expect(banner.className).not.toMatch(/fixed|absolute|inset-0/);
  });
});
