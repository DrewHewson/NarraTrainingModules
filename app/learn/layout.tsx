import type { Metadata } from "next";
import { Fraunces, Newsreader } from "next/font/google";
import Link from "next/link";
import TestSwitcher from "@/app/_components/TestSwitcher";
import FeedbackWidget from "@/app/_components/FeedbackWidget";
import "@/app/preview/preview.css";
import "@/app/narra.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const newsreader = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Narra Training",
  description: "Narra Training course content.",
};

export default function LearnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${fraunces.variable} ${newsreader.variable} np-root`}>
      <header className="np-topbar">
        <Link href="/dashboard" className="np-wordmark">
          <span className="np-wordmark-the">The</span>
          <span className="np-wordmark-name">Narra</span>
          <span className="np-wordmark-sub">Training</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <TestSwitcher />
          <Link
            href="/dashboard"
            style={{ fontSize: "0.82rem", color: "var(--ink-soft)", textDecoration: "none" }}
          >
            ← Dashboard
          </Link>
          <form action="/auth/sign-out" method="post">
            <button className="narra-btn ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
      <FeedbackWidget />
    </div>
  );
}
