import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, singleCourse, COURSE_SLUG } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

  const chapters = courseContent?.chapters ?? [];
  const firstChapterSlug = chapters[0]?.slug ?? null;

  // Per-learner progress: which chapters they've passed (score ≥ passing) and
  // their best score per chapter. Persisted in chapter_progress + quiz_attempts.
  const passedSlugs = new Set<string>();
  const bestScoreBySlug = new Map<string, number>();
  if (profile?.role === "learner") {
    const supabase = await createClient();
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("profile_id", session.user.id)
      .eq("course_id", course.id)
      .maybeSingle();
    if (enrollment) {
      const [{ data: dbChapters }, { data: progress }, { data: attempts }] = await Promise.all([
        supabase.from("chapters").select("id, slug").eq("course_id", course.id),
        supabase.from("chapter_progress").select("chapter_id").eq("enrollment_id", enrollment.id),
        supabase
          .from("quiz_attempts")
          .select("parent_id, score")
          .eq("enrollment_id", enrollment.id)
          .eq("quiz_scope", "chapter"),
      ]);
      const idToSlug = new Map((dbChapters ?? []).map((c) => [c.id as string, c.slug as string]));
      for (const p of progress ?? []) {
        const slug = idToSlug.get(p.chapter_id as string);
        if (slug) passedSlugs.add(slug);
      }
      for (const a of attempts ?? []) {
        const slug = idToSlug.get(a.parent_id as string);
        if (!slug) continue;
        const s = Number(a.score);
        if (s > (bestScoreBySlug.get(slug) ?? -1)) bestScoreBySlug.set(slug, s);
      }
    }
  }

  const passedCount = chapters.filter((c) => passedSlugs.has(c.slug)).length;
  const continueSlug = chapters.find((c) => !passedSlugs.has(c.slug))?.slug ?? firstChapterSlug;
  const isLearner = profile?.role === "learner";

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

        {isLearner && chapters.length > 0 && (
          <p
            className="narra-eyebrow"
            style={{ marginBottom: "0.9rem", color: "var(--clay-deep)" }}
          >
            {passedCount} of {chapters.length} chapters passed
          </p>
        )}

        {isLearner && chapters.length > 0 && (
          <ol
            style={{
              listStyle: "none",
              margin: "0 0 1.75rem",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.15rem",
            }}
          >
            {chapters.map((c, i) => {
              const passed = passedSlugs.has(c.slug);
              const best = bestScoreBySlug.get(c.slug);
              const status = passed
                ? `Passed ✓${best !== undefined ? ` · ${best}%` : ""}`
                : best !== undefined
                  ? `Best ${best}%`
                  : "Not started";
              return (
                <li key={c.slug}>
                  <Link
                    href={`/learn/${c.slug}`}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.55rem 0.2rem",
                      borderBottom: "1px solid var(--line-soft)",
                      textDecoration: "none",
                      color: "var(--ink)",
                    }}
                  >
                    <span style={{ display: "flex", gap: "0.7ch", alignItems: "baseline" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-geist-sans), sans-serif",
                          fontSize: "0.72rem",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: "0.95rem" }}>{c.title}</span>
                    </span>
                    <span
                      style={{
                        flex: "none",
                        fontFamily: "var(--font-geist-sans), sans-serif",
                        fontSize: "0.72rem",
                        letterSpacing: "0.04em",
                        color: passed ? "#4a7c59" : "var(--ink-faint)",
                      }}
                    >
                      {status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {continueSlug ? (
          <Link href={`/learn/${continueSlug}`} className="narra-btn">
            {passedCount > 0 ? "Continue →" : "Start →"}
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
