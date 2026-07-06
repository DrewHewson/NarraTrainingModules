import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Narra Training — Sign In",
};

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      {/* Wordmark lockup */}
      <Link href="/" className="narra-wordmark" style={{ marginBottom: "2rem" }}>
        <span className="narra-wordmark-the">The</span>
        <span className="narra-wordmark-name">Narra</span>
        <span className="narra-wordmark-sub">Training</span>
      </Link>

      {/* Auth card */}
      <div
        className="narra-card"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        {children}
      </div>

      {/* Thin footer rule */}
      <p
        style={{
          marginTop: "2rem",
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "0.62rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        Narra Training · Professional Development
      </p>
    </div>
  );
}
