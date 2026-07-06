"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <form action={formAction} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Error alert */}
      {state?.error && (
        <div className="narra-alert" role="alert">
          {state.error}
        </div>
      )}

      {/* Email */}
      <div className="narra-field">
        <label htmlFor="email" className="narra-label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="narra-input"
        />
      </div>

      {/* Password */}
      <div className="narra-field">
        <label htmlFor="password" className="narra-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="narra-input"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="narra-btn full"
        style={{ marginTop: "0.25rem" }}
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
