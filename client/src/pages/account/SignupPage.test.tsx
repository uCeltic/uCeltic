import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "./SignupPage";

describe("SignupPage", () => {
  it("shows the minimum password length under the password field", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });
});
