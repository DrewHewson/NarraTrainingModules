"use client";

import { useTransition } from "react";
import { setFeedbackStatus } from "@/app/(app)/admin/actions";

export default function FeedbackRow({ id, status }: { id: string; status: "open" | "resolved" }) {
  const [pending, startTransition] = useTransition();
  const next = status === "resolved" ? "open" : "resolved";
  return (
    <button
      type="button"
      className="narra-btn ghost"
      disabled={pending}
      style={{ padding: "0.3rem 0.8rem", fontSize: "0.68rem" }}
      onClick={() => startTransition(() => setFeedbackStatus(id, next))}
    >
      {pending ? "…" : status === "resolved" ? "Reopen" : "Resolve"}
    </button>
  );
}
