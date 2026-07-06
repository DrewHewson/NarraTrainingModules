import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, singleCourse, COURSE_SLUG } from "@/lib/auth";
import { getCourse } from "@/lib/preview-content";

export const metadata = { title: "Dashboard — Narra Training" };

const CNO_STATUS_COPY: Record<string, { label: string; badgeClass: string; blurb: string }> = {
  pending: {
    label: "Pending review",
    badgeClass: "narra-badge is-pending",
    blurb: "Your CNO registration is awaiting admin verification. You can begin the course now.",
  },
  verified: {
    label: "CNO verified",
    badgeClass: "narra-badge is-verified",
    blurb: "Your CNO registration has been confirmed. You have full access to course content.",
  },
  rejected: {
    label: "Verification issue",
    badgeClass: "narra-badge is-rejected",
    blurb:
      "There was an issue with your CNO proof. Please contact your administrator to resolve it.",
  },
};

export default async function DashboardPage() {
  const session = await getSessionProfile();
  if (!session?.user) {
    redirect("/login");
  }

  const { profile } = session;

  // Learners who haven't submitted proof yet → onboarding
  if (profile?.role === "learner" && !profile?.cno_proof_path) {
    redirect("/onboarding");
  }

  // Course data
  const [course, courseContent] = await Promise.all([
    singleCourse(),
    Promise.resolve(getCourse(COURSE_SLUG)),
  ]);

  const firstChapterSlug = courseContent?.chapters[0]?.slug ?? null;

  const cnoStatus = (profile?.cno_status as string | null | undefined) ?? "pending";
  const statusInfo = CNO_STATUS_COPY[cnoStatus] ?? CNO_STATUS_COPY.pending;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)",
      }}
    >
      {/* Greeting */}
      <p className="narra-eyebrow" style={{ marginBottom: "0.4rem" }}>
        Welcome back
      </p>
      <h1
        className="narra-h"
        style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginBottom: "0.25rem" }}
      >
        {profile?.full_name ? `Hello, ${firstName}.` : "Hello."}
      </h1>
      <hr className="narra-divider" />

      {/* CNO status strip — only shown for learners */}
      {profile?.role === "learner" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "2.5rem",
            padding: "0.85rem 1rem",
            background: "var(--panel)",
            borderRadius: "9px",
            border: "1px solid var(--line-soft)",
          }}
        >
          <span className={statusInfo.badgeClass}>{statusInfo.label}</span>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--ink-soft)",
              fontFamily: "var(--font-geist-sans), sans-serif",
              lineHeight: 1.45,
            }}
          >
            {statusInfo.blurb}
          </p>
        </div>
      )}

      {/* Course card */}
      <div className="narra-card">
        <p className="narra-eyebrow" style={{ marginBottom: "0.5rem" }}>
          Your course
        </p>
        <h2
          className="narra-h"
          style={{ fontSize: "clamp(1.15rem, 3vw, 1.5rem)", marginBottom: "0.6rem" }}
        >
          {course.title}
        </h2>
        {course.description && (
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--ink-soft)",
              marginBottom: "1.75rem",
              lineHeight: 1.6,
            }}
          >
            {course.description}
          </p>
        )}

        {firstChapterSlug ? (
          <Link href={`/learn/${firstChapterSlug}`} className="narra-btn">
            Start / Continue →
          </Link>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "0.82rem",
              color: "var(--ink-faint)",
            }}
          >
            Course chapters are being prepared. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
