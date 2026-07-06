import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "CNO Verification — Narra Training" };

export default async function OnboardingPage() {
  const session = await getSessionProfile();
  if (!session?.user) {
    redirect("/login");
  }

  // Already submitted — go straight to the dashboard
  if (session.profile?.cno_proof_path) {
    redirect("/dashboard");
  }

  const firstName = session.profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)",
      }}
    >
      {/* Header */}
      <p className="narra-eyebrow" style={{ marginBottom: "0.5rem" }}>
        Account setup
      </p>
      <h1
        className="narra-h"
        style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: "0.75rem" }}
      >
        Verify your CNO registration, {firstName}.
      </h1>
      <hr className="narra-divider" />

      {/* Why we ask */}
      <div className="narra-card" style={{ marginBottom: "2.5rem" }}>
        <p className="narra-eyebrow" style={{ marginBottom: "0.5rem" }}>
          Why we need this
        </p>
        <p style={{ fontSize: "1rem", color: "var(--ink-soft)", margin: 0 }}>
          Medical aesthetics procedures — including neuromodulator injections — may only be
          performed by regulated health professionals. Before accessing course content, Narra
          Training is required to confirm that every learner holds a current College of Nurses
          of Ontario (CNO) registration as an RN or RPN.
        </p>
        <p
          style={{
            fontSize: "0.88rem",
            color: "var(--ink-faint)",
            marginTop: "0.9rem",
            marginBottom: 0,
            fontFamily: "var(--font-geist-sans), sans-serif",
          }}
        >
          Your file is stored securely and reviewed only by the Narra administrator.
          Verification typically takes one business day.
        </p>
      </div>

      {/* Form */}
      <OnboardingForm />
    </div>
  );
}
