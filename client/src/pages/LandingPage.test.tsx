import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<h1>Workspace</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("offers sign-in and registration alongside the existing workspace entry", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/account/login",
    );
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/account/signup",
    );
    expect(screen.getByRole("button", { name: /open workspace/i })).toBeInTheDocument();
  });
});
