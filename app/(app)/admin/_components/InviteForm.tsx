"use client";

import { useActionState, useState } from "react";
import { inviteLearner } from "../actions";

type ActionState = { ok: string } | { error: string } | null;

// Inner form — remounts (via key) on each new successKey to clear fields.
function InviteFormInner({
  onSuccess,
}: {
  onSuccess: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await inviteLearner(prev, formData);
      if (result && "ok" in result) {
        onSuccess(result.ok);
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Error banner — stays inside the keyed form so stale values are preserved */}
      {"error" in (state ?? {}) && (
        <p className="narra-alert" role="alert">
          {(state as { error: string }).error}
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

// Outer wrapper holds the success banner and the remount key.
export default function InviteForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  function handleSuccess(message: string) {
    setSuccessMessage(message);
    setFormKey((k) => k + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {successMessage && (
        <p className="narra-alert info" role="status">
          {successMessage}
        </p>
      )}
      <InviteFormInner key={formKey} onSuccess={handleSuccess} />
    </div>
  );
}
