"use client";

import { useActionState } from "react";
import { inviteLearner } from "../actions";

export default function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteLearner, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Status messages */}
      {"ok" in (state ?? {}) && (
        <p className="narra-alert info" role="status">
          {"ok" in state! ? (state as { ok: string }).ok : ""}
        </p>
      )}
      {"error" in (state ?? {}) && (
        <p className="narra-alert" role="alert">
          {"error" in state! ? (state as { error: string }).error : ""}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="narra-field">
          <label htmlFor="invite-name" className="narra-label">
            Full name
          </label>
          <input
            id="invite-name"
            name="full_name"
            type="text"
            className="narra-input"
            placeholder="Jane Smith"
            required
            autoComplete="name"
          />
        </div>

        <div className="narra-field">
          <label htmlFor="invite-email" className="narra-label">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className="narra-input"
            placeholder="jane@example.com"
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <button type="submit" className="narra-btn" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}
