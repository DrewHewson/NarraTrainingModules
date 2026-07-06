import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign In — Narra Training",
};

export default async function LoginPage() {
  // Redirect already-signed-in users
  const session = await getSessionProfile();
  if (session) {
    redirect(session.profile?.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <>
      {/* Eyebrow */}
      <p className="narra-eyebrow" style={{ marginBottom: "0.5rem" }}>
        Narra Training
      </p>

      {/* Heading */}
      <h1
        className="narra-h"
        style={{ fontSize: "clamp(1.5rem, 4vw, 1.9rem)", marginBottom: "0.4rem" }}
      >
        Welcome back
      </h1>

      {/* Subtext */}
      <p
        style={{
          color: "var(--ink-soft)",
          fontSize: "0.95rem",
          marginBottom: "1.75rem",
          lineHeight: 1.5,
        }}
      >
        Sign in to access your training materials.
      </p>

      {/* Thin rule */}
      <hr className="narra-divider" style={{ marginBottom: "1.75rem" }} />

      <LoginForm />
    </>
  );
}
