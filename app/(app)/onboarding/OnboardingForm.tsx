"use client";

import { useActionState } from "react";
import { submitCnoProof } from "./actions";

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(submitCnoProof, null);

  return (
    <form action={formAction} encType="multipart/form-data">
      {state?.error && (
        <div className="narra-alert" role="alert" style={{ marginBottom: "1.5rem" }}>
          {state.error}
        </div>
      )}

      <div className="narra-field" style={{ marginBottom: "1.25rem" }}>
        <label className="narra-label" htmlFor="cno_registration_number">
          CNO Registration Number
        </label>
        <input
          id="cno_registration_number"
          name="cno_registration_number"
          type="text"
          className="narra-input"
          placeholder="e.g. 12345678"
          required
          autoComplete="off"
          style={{ maxWidth: "22rem" }}
        />
      </div>

      <div className="narra-field" style={{ marginBottom: "2rem" }}>
        <label className="narra-label" htmlFor="proof_file">
          Proof of Registration (PDF, JPEG, or PNG · max 10 MB)
        </label>
        <input
          id="proof_file"
          name="proof_file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          style={{
            fontFamily: "var(--font-geist-sans), sans-serif",
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            cursor: "pointer",
          }}
        />
      </div>

      <button type="submit" className="narra-btn" disabled={pending}>
        {pending ? "Uploading…" : "Submit Registration"}
      </button>
    </form>
  );
}
