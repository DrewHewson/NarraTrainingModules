import type { Metadata } from "next";
import Link from "next/link";
import TestSwitcher from "@/app/_components/TestSwitcher";
import FeedbackWidget from "@/app/_components/FeedbackWidget";

export const metadata: Metadata = {
  title: "Narra Training",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="narra-root" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* 58px sticky topbar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: "58px",
          background: "var(--paper)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(1rem, 4vw, 2rem)",
          boxShadow: "0 1px 4px rgba(34,31,24,0.06)",
        }}
      >
        {/* Wordmark */}
        <Link href="/dashboard" className="narra-wordmark">
          <span className="narra-wordmark-the">The</span>
          <span className="narra-wordmark-name">Narra</span>
          <span className="narra-wordmark-sub">Training</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <TestSwitcher />
          {/* Sign-out — real POST, no JS required */}
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="narra-btn ghost">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1 }}>{children}</main>

      <FeedbackWidget />
    </div>
  );
}
