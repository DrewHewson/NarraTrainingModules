"use client";

import { useTransition } from "react";
import { setCnoStatus } from "../actions";

interface LearnerRowProps {
  profileId: string;
  fullName: string;
  cnoStatus: "pending" | "verified" | "rejected" | null;
  signedProofUrl: string | null;
}

export default function LearnerRow({
  profileId,
  fullName,
  cnoStatus,
  signedProofUrl,
}: LearnerRowProps) {
  const [isPending, startTransition] = useTransition();

  const status = cnoStatus ?? "pending";

  function handleSetStatus(newStatus: "verified" | "rejected") {
    startTransition(() => {
      setCnoStatus(profileId, newStatus);
    });
  }

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      {/* Name */}
      <td style={{ padding: "0.85rem 1rem 0.85rem 0" }}>
        <span style={{ fontFamily: "var(--font-body), Georgia, serif" }}>
          {fullName || <em style={{ color: "var(--ink-faint)" }}>—</em>}
        </span>
      </td>

      {/* CNO status badge */}
      <td style={{ padding: "0.85rem 1rem" }}>
        <span className={`narra-badge is-${status}`}>
          {status}
        </span>
      </td>

      {/* Proof link */}
      <td style={{ padding: "0.85rem 1rem" }}>
        {signedProofUrl ? (
          <a
            href={signedProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--clay)",
              textDecoration: "none",
            }}
          >
            View proof
          </a>
        ) : (
          <span style={{ color: "var(--ink-faint)", fontSize: "0.82rem" }}>—</span>
        )}
      </td>

      {/* Verify / Reject actions */}
      <td style={{ padding: "0.85rem 0 0.85rem 1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="narra-btn"
            disabled={isPending || status === "verified"}
            onClick={() => handleSetStatus("verified")}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.65rem" }}
          >
            Verify
          </button>
          <button
            type="button"
            className="narra-btn ghost"
            disabled={isPending || status === "rejected"}
            onClick={() => handleSetStatus("rejected")}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.65rem" }}
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}
