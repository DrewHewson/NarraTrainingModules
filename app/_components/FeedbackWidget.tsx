"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { submitFeedback } from "@/app/feedback/actions";
import { getReaderContext, subscribeReaderContext } from "@/app/_components/readerContext";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "content", label: "Content / accuracy" },
  { value: "typo", label: "Typo / wording" },
  { value: "question", label: "Quiz question" },
  { value: "ux", label: "UX / bug" },
  { value: "general", label: "General" },
];

// TEST-ONLY reviewer feedback. Renders nothing unless NEXT_PUBLIC_TEST_MODE is
// on. A floating button that logs a note within the exact chapter + focused
// sub-section (published by the reader via readerContext).
export default function FeedbackWidget() {
  const pathname = usePathname();
  const readerCtx = useSyncExternalStore(subscribeReaderContext, getReaderContext, () => null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("content");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;

  function buildInput() {
    const path = window.location.pathname;
    if (readerCtx) {
      return {
        path,
        chapterSlug: readerCtx.chapterSlug,
        sectionId: readerCtx.sectionId,
        sectionLabel: readerCtx.sectionTitle,
        category,
        comment,
      };
    }
    const sectionId = window.location.hash.replace(/^#/, "") || null;
    return {
      path,
      chapterSlug: path.startsWith("/learn/") ? (path.split("/")[2] ?? null) : null,
      sectionId,
      sectionLabel: null,
      category,
      comment,
    };
  }

  async function send() {
    setStatus("sending");
    setErrorMsg("");
    const res = await submitFeedback(buildInput());
    if ("error" in res) {
      setStatus("error");
      setErrorMsg(res.error);
    } else {
      setStatus("sent");
      setComment("");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!open) setStatus("idle");
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: "1.25rem",
          right: "1.25rem",
          zIndex: 60,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          padding: "0.65rem 1.1rem",
          background: "var(--clay)",
          color: "var(--paper)",
          border: "none",
          borderRadius: "999px",
          boxShadow: "0 6px 18px rgba(34,31,24,0.22)",
          cursor: "pointer",
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "0.74rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden>✦</span> {open ? "Close" : "Feedback"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Leave feedback"
          style={{
            position: "fixed",
            bottom: "4.75rem",
            right: "1.25rem",
            zIndex: 60,
            width: "min(460px, calc(100vw - 2rem))",
            maxHeight: "calc(100dvh - 7rem)",
            overflowY: "auto",
            background: "var(--paper-lift)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 16px 40px rgba(34,31,24,0.2)",
            padding: "1.35rem 1.4rem 1.45rem",
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              margin: "0 0 0.6rem",
            }}
          >
            Reviewer feedback
          </p>

          {/* Exact scope this note will be filed under */}
          <div
            style={{
              padding: "0.7rem 0.85rem",
              background: "var(--panel)",
              border: "1px solid var(--line-soft)",
              borderRadius: "10px",
              marginBottom: "1rem",
            }}
          >
            {readerCtx ? (
              <>
                <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                  Chapter:{" "}
                  <strong style={{ color: "var(--ink)" }}>{readerCtx.chapterTitle}</strong>
                </p>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                  Focused on:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {readerCtx.sectionTitle ?? "—"}
                  </strong>
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                Page: <strong style={{ color: "var(--ink)" }}>{pathname}</strong>
              </p>
            )}
          </div>

          {status === "sent" ? (
            <div>
              <p style={{ fontSize: "0.95rem", color: "var(--ink)", margin: "0 0 1rem" }}>
                Sent ✓ — thanks. Leave another note on this section?
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
                style={{ ...fieldStyle, marginBottom: "0.85rem" }}
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
                rows={7}
                placeholder="What did you notice on this section? Be as specific as you like…"
                style={{
                  ...fieldStyle,
                  minHeight: "150px",
                  resize: "vertical",
                  lineHeight: 1.5,
                  marginBottom: "0.9rem",
                }}
              />

              {status === "error" && (
                <p style={{ color: "var(--clay-deep)", fontSize: "0.82rem", margin: "0 0 0.7rem" }}>
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
  marginBottom: "0.35rem",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.6rem 0.7rem",
  border: "1px solid var(--line)",
  borderRadius: "9px",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: "0.95rem",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem",
  background: "var(--clay)",
  color: "var(--paper)",
  border: "none",
  borderRadius: "9px",
  fontFamily: "inherit",
  fontSize: "0.74rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const ghostBtn: React.CSSProperties = {
  padding: "0.55rem 0.9rem",
  background: "transparent",
  color: "var(--clay-deep)",
  border: "1px solid var(--line)",
  borderRadius: "9px",
  fontFamily: "inherit",
  fontSize: "0.74rem",
  cursor: "pointer",
};
