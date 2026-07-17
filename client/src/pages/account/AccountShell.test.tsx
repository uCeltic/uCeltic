import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountShell from "./AccountShell";

describe("AccountShell", () => {
  it("renders the 'Continue without an account' link by default", () => {
    render(
      <MemoryRouter>
        <AccountShell title="Sign in">child</AccountShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /continue without an account/i })).toBeInTheDocument();
  });

  it("hides the link when hideAccountLink is set", () => {
    render(
      <MemoryRouter>
        <AccountShell title="Your profile" hideAccountLink>
          child
        </AccountShell>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: /continue without an account/i }),
    ).not.toBeInTheDocument();
  });
});
