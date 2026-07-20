import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./LandingPage";
import { useAuthStore } from "../store/authStore";

const USER = { id: 1, email: "visitor@example.com" };

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workspace" element={<h1>Workspace</h1>} />
        <Route path="/account/signup" element={<h1>Register</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ status: "unknown", user: null });
});

describe("LandingPage", () => {
  describe("anonymous visitor", () => {
    beforeEach(() => {
      useAuthStore.setState({ status: "anonymous", user: null });
    });

    it("embeds the sign-in form", () => {
      renderLanding();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("offers 'Continue as a Visitor' into /workspace", () => {
      renderLanding();

      expect(screen.getByRole("link", { name: /continue as a visitor/i })).toHaveAttribute(
        "href",
        "/workspace",
      );
    });

    it("offers a 'No account? Register' link to /account/signup", () => {
      renderLanding();

      expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
        "href",
        "/account/signup",
      );
    });

    it("does not claim anyone is signed in", () => {
      renderLanding();

      expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
    });

    it("renders the brand image", () => {
      const { container } = renderLanding();

      expect(container.querySelector('img[src="/index_pic.png"]')).toBeInTheDocument();
    });
  });

  describe("authenticated visitor", () => {
    beforeEach(() => {
      useAuthStore.setState({ status: "authenticated", user: USER });
    });

    it("shows 'Signed in as {email}' instead of the login form", () => {
      renderLanding();

      expect(screen.getByText(`Signed in as ${USER.email}`)).toBeInTheDocument();
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    });

    it("offers a direct entry into /workspace", () => {
      renderLanding();

      expect(screen.getByRole("link", { name: /workspace/i })).toHaveAttribute(
        "href",
        "/workspace",
      );
    });

    it("does not offer 'Continue as a Visitor' — the visitor is already signed in", () => {
      renderLanding();

      expect(
        screen.queryByRole("link", { name: /continue as a visitor/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the brand image", () => {
      const { container } = renderLanding();

      expect(container.querySelector('img[src="/index_pic.png"]')).toBeInTheDocument();
    });
  });

  it("renders nothing while the session probe is still unresolved", () => {
    useAuthStore.setState({ status: "unknown", user: null });
    const { container } = renderLanding();

    expect(container).toBeEmptyDOMElement();
  });
});
