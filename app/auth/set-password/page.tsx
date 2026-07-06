"use client";

/**
 * Set-password page — invite acceptance flow.
 *
 * The Supabase invite/recovery link routes the recipient through the GoTrue
 * /verify endpoint, which redirects here with the session delivered as URL
 * *hash* tokens (implicit flow: #access_token=…&refresh_token=…&type=invite).
 * The @supabase/ssr browser client defaults to PKCE, whose detectSessionInUrl
 * only reads ?code= from the query string — it ignores the hash. Admin-issued
 * invite links are always implicit (there is no PKCE code_verifier in the
 * recipient's browser), so we parse the hash ourselves and call setSession(),
 * then strip the tokens from the URL. No valid hash and no existing session →
 * the "expired" state.
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
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // A late SIGNED_IN (e.g. from setSession) also flips us to ready.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && session && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
        setPageState("ready");
      }
    });

    async function establish() {
      // 1) Invite/recovery links deliver the session as URL-hash tokens
      //    (implicit flow). The PKCE-mode client won't auto-parse the hash,
      //    so read it and establish the session explicitly.
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          // Strip the tokens from the address bar regardless of outcome.
          window.history.replaceState(null, "", window.location.pathname);
          if (!cancelled) setPageState(error ? "error-no-session" : "ready");
          return;
        }
      }

      // 2) Already-established session (e.g. a refresh after the exchange).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setPageState("ready");
      } else {
        timer = setTimeout(() => {
          setPageState((prev) => (prev === "loading" ? "error-no-session" : prev));
        }, 2500);
      }
    }

    establish();

    return () => {
      cancelled = true;
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
