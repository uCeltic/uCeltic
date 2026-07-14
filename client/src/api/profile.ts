import { csrfHeaders, ensureCsrfToken } from "./csrf";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const PROFILE_URL = `${API_BASE}/auth/profile/`;

export interface Profile {
  email: string;
  display_name: string;
}

/** A rejected profile request. The DRF field errors are flattened to one line for the form. */
export class ProfileError extends Error {}

async function request(init: RequestInit): Promise<Profile> {
  // This is our own DRF endpoint, not allauth — SessionAuthentication still enforces CSRF
  // on the PATCH, so the same cookie dance as auth.ts applies.
  await ensureCsrfToken();

  const response = await fetch(PROFILE_URL, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const firstMessage = Object.values(body).flat()[0];
    throw new ProfileError(
      typeof firstMessage === "string" ? firstMessage : "Could not save. Please try again.",
    );
  }
  return response.json();
}

export function fetchProfile(): Promise<Profile> {
  return request({ method: "GET" });
}

export function updateDisplayName(displayName: string): Promise<Profile> {
  return request({ method: "PATCH", body: JSON.stringify({ display_name: displayName }) });
}
