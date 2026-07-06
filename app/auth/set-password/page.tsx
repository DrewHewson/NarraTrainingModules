"use client";

/**
 * Set-password page — invite acceptance flow.
 *
 * The Supabase invite link contains a token in the URL fragment (e.g.
 * #access_token=…&type=invite). The @supabase/ssr browser client's
 * detectSessionInUrl (enabled by default in createBrowserClient) picks up
 * that token on mount and exchanges it for a live session via
 * onAuthStateChange. We wait for that event before showing the form so we
 * can distinguish "valid invite" from "expired / invalid link".
 *
 * NOTE: Full end-to-end invite acceptance cannot be exercised until Task 6
 * (admin invite UI) and Task 9 (E2E smoke tests). This page is built to the
 * correct @supabase/ssr flow and is marked DONE_WITH_CONCERNS in the
 * task-5 report.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PageState = "loading" | "ready" | "submitting" | "error-no-session";

export default function SetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Listen for the SIGNED_IN event that fires when detectSessionInUrl
    // exchanges the invite token.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setPageState("ready");
      }
    });

    // Give onAuthStateChange a short window to fire before showing the
    // "no session" error state. Hoisted here so the cleanup can clear it.
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Also check if a session already exists (e.g. page refresh after
    // the token was already exchanged).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState("ready");
      } else {
        timer = setTimeout(() => {
          setPageState((prev) =>
            prev === "loading" ? "error-no-session" : prev,
          );
        }, 2500);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match.");
      return;
    }

    setPageState("submitting");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFieldError(
        "Unable to set your password. Please try again or ask your administrator to re-invite you.",
      );
      setPageState("ready");
      return;
    }

    router.push("/onboarding");
  }

  // ---- Render states ----

  if (pageState === "loading") {
    return (
      <div
        className="narra-root"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div className="narra-card" style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>
          <p className="narra-eyebrow" style={{ marginBottom: "1rem" }}>
            Narra Training
          </p>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>
            Verifying your invitation link…
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "error-no-session") {
    return (
      <div
        className="narra-root"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div className="narra-card" style={{ maxWidth: "420px", width: "100%" }}>
          <p className="narra-eyebrow" style={{ marginBottom: "1rem" }}>
            Narra Training
          </p>
          <h1
            className="narra-h"
            style={{ fontSize: "1.4rem", marginBottom: "1rem" }}
          >
            Invitation link expired
          </h1>
          <div className="narra-alert">
            This invitation link is no longer valid or has already been used.
            Please ask your administrator to send you a new invite.
          </div>
        </div>
      </div>
    );
  }

  // "ready" or "submitting"
  return (
    <div
      className="narra-root"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(1.5rem, 5vw, 3rem) 1rem",
      }}
    >
      {/* Wordmark */}
      <div className="narra-wordmark" style={{ marginBottom: "2rem" }}>
        <span className="narra-wordmark-the">The</span>
        <span className="narra-wordmark-name">Narra</span>
        <span className="narra-wordmark-sub">Training</span>
      </div>

      <div className="narra-card" style={{ maxWidth: "420px", width: "100%" }}>
        <p className="narra-eyebrow" style={{ marginBottom: "0.5rem" }}>
          Set up your account
        </p>
        <h1
          className="narra-h"
          style={{ fontSize: "clamp(1.4rem, 4vw, 1.8rem)", marginBottom: "0.4rem" }}
        >
          Create your password
        </h1>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: "0.95rem",
            marginBottom: "1.75rem",
            lineHeight: 1.5,
          }}
        >
          Choose a strong password to secure your Narra Training account.
        </p>

        <hr className="narra-divider" style={{ marginBottom: "1.75rem" }} />

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {fieldError && (
            <div className="narra-alert" role="alert">
              {fieldError}
            </div>
          )}

          <div className="narra-field">
            <label htmlFor="password" className="narra-label">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="narra-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="narra-field">
            <label htmlFor="confirm" className="narra-label">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              className="narra-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={pageState === "submitting"}
            className="narra-btn full"
            style={{ marginTop: "0.25rem" }}
          >
            {pageState === "submitting" ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
