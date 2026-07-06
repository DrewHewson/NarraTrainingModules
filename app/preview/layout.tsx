import type { Metadata } from "next";
import { Fraunces, Newsreader } from "next/font/google";
import Link from "next/link";
import "./preview.css";

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
  title: "Narra Training — Content Preview",
  description: "Live authoring preview of Narra Training course content.",
};

export default function PreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${fraunces.variable} ${newsreader.variable} np-root`}>
      <header className="np-topbar">
        <Link href="/preview" className="np-wordmark">
          <span className="np-wordmark-the">The</span>
          <span className="np-wordmark-name">Narra</span>
          <span className="np-wordmark-sub">Training</span>
        </Link>
        <span className="np-preview-pill">Preview · content under review</span>
      </header>
      {children}
    </div>
  );
}
