"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { submitFeedback } from "@/app/feedback/actions";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "content", label: "Content / accuracy" },
  { value: "typo", label: "Typo / wording" },
  { value: "question", label: "Quiz question" },
  { value: "ux", label: "UX / bug" },
  { value: "general", label: "General" },
];

type Ctx = {
  path: string;
  chapterSlug: string | null;
  sectionId: string | null;
  sectionLabel: string | null;
};

// TEST-ONLY reviewer feedback. Renders nothing unless NEXT_PUBLIC_TEST_MODE is
// on. A floating button that captures the reviewer's current chapter/section
// (or quiz) so each note is anchored to the exact spot.
export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("content");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ctx, setCtx] = useState<Ctx>({ path: "", chapterSlug: null, sectionId: null, sectionLabel: null });

  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;

  function captureContext(): Ctx {
    const path = window.location.pathname;
    const chapterSlug = path.startsWith("/learn/") ? (path.split("/")[2] ?? null) : null;
    const sectionId = window.location.hash.replace(/^#/, "") || null;
    const sectionLabel =
      document.querySelector(".np-toc-link.is-active")?.textContent?.trim() ||
      document.querySelector(".np-prose h2")?.textContent?.trim() ||
      null;
    return { path, chapterSlug, sectionId, sectionLabel };
  }

  function toggle() {
    if (!open) {
      setCtx(captureContext());
      setStatus("idle");
      setErrorMsg("");
    }
    setOpen((o) => !o);
  }

  async function send() {
    setStatus("sending");
    setErrorMsg("");
    const res = await submitFeedback({ ...captureContext(), category, comment });
    if ("error" in res) {
      setStatus("error");
      setErrorMsg(res.error);
    } else {
      setStatus("sent");
      setComment("");
    }
  }

  const contextLabel =
    ctx.sectionLabel ??
    (ctx.chapterSlug ? ctx.chapterSlug.replace(/^\d+-/, "").replace(/-/g, " ") : pathname);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "4.5rem",
    right: "1.25rem",
    zIndex: 60,
    width: "min(340px, calc(100vw - 2.5rem))",
    background: "var(--paper-lift)",
    border: "1px solid var(--line)",
    borderRadius: "14px",
    boxShadow: "0 12px 32px rgba(34,31,24,0.18)",
    padding: "1.1rem 1.15rem 1.2rem",
    fontFamily: "var(--font-geist-sans), sans-serif",
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: "1.25rem",
          right: "1.25rem",
          zIndex: 60,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          padding: "0.6rem 1rem",
          background: "var(--clay)",
          color: "var(--paper)",
          border: "none",
          borderRadius: "999px",
          boxShadow: "0 6px 18px rgba(34,31,24,0.22)",
          cursor: "pointer",
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "0.72rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden>✦</span> {open ? "Close" : "Feedback"}
      </button>

      {open && (
        <div style={panelStyle} role="dialog" aria-label="Leave feedback">
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              margin: "0 0 0.15rem",
            }}
          >
            Reviewer feedback
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 0.85rem" }}>
            On: <strong style={{ color: "var(--ink)" }}>{contextLabel}</strong>
          </p>

          {status === "sent" ? (
            <div>
              <p style={{ fontSize: "0.9rem", color: "var(--ink)", margin: "0 0 0.9rem" }}>
                Sent ✓ — thanks. Leave another?
              </p>
              <button type="button" onClick={() => setStatus("idle")} style={ghostBtn}>
                Add another note
              </button>
            </div>
          ) : (
            <>
              <label style={labelStyle}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ ...fieldStyle, marginBottom: "0.7rem" }}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <label style={labelStyle}>Your note</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="What did you notice here?"
                style={{ ...fieldStyle, resize: "vertical", marginBottom: "0.8rem" }}
              />

              {status === "error" && (
                <p style={{ color: "var(--clay-deep)", fontSize: "0.8rem", margin: "0 0 0.6rem" }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="button"
                onClick={send}
                disabled={status === "sending" || !comment.trim()}
                style={{
                  ...primaryBtn,
                  opacity: status === "sending" || !comment.trim() ? 0.55 : 1,
                  cursor: status === "sending" || !comment.trim() ? "not-allowed" : "pointer",
                }}
              >
                {status === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.62rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  marginBottom: "0.3rem",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.5rem 0.6rem",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: "0.88rem",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem",
  background: "var(--clay)",
  color: "var(--paper)",
  border: "none",
  borderRadius: "8px",
  fontFamily: "inherit",
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const ghostBtn: React.CSSProperties = {
  padding: "0.5rem 0.8rem",
  background: "transparent",
  color: "var(--clay-deep)",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  fontFamily: "inherit",
  fontSize: "0.72rem",
  cursor: "pointer",
};
