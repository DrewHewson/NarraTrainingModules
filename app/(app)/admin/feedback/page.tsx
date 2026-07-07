import Link from "next/link";
import { requireAdmin, COURSE_SLUG } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourse } from "@/lib/preview-content";
import FeedbackRow from "./FeedbackRow";

export const metadata = { title: "Feedback Logged — Narra Training" };

const CATEGORY_LABEL: Record<string, string> = {
  content: "Content",
  typo: "Typo",
  question: "Quiz question",
  ux: "UX / bug",
  general: "General",
};

type Row = {
  id: string;
  reviewer_id: string;
  path: string;
  chapter_slug: string | null;
  section_id: string | null;
  section_label: string | null;
  category: string;
  comment: string;
  status: string;
  created_at: string;
  reviewer: { full_name: string | null } | null;
};

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("feedback")
    .select(
      "id, reviewer_id, path, chapter_slug, section_id, section_label, category, comment, status, created_at, reviewer:profiles(full_name)",
    )
    .order("status", { ascending: true }) // open before resolved
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const openCount = rows.filter((r) => r.status !== "resolved").length;

  // Map chapter slug → real chapter title for display.
  const titleBySlug = new Map(
    (getCourse(COURSE_SLUG)?.chapters ?? []).map((c) => [c.slug, c.title]),
  );

  // Group notes by reviewer so each person (e.g. Margie) can review all of
  // theirs together. Rows are already ordered open-first, newest-first.
  const groups = new Map<string, { name: string; rows: Row[] }>();
  for (const r of rows) {
    const g = groups.get(r.reviewer_id) ?? {
      name: r.reviewer?.full_name ?? "Reviewer",
      rows: [],
    };
    g.rows.push(r);
    groups.set(r.reviewer_id, g);
  }
  const groupList = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  const renderNote = (r: Row) => {
    const href = r.path + (r.section_id ? `#${r.section_id}` : "");
    const chapterTitle = r.chapter_slug
      ? (titleBySlug.get(r.chapter_slug) ??
        r.chapter_slug.replace(/^\d+-/, "").replace(/-/g, " "))
      : null;
    const where = [chapterTitle, r.section_label].filter(Boolean).join(" · ") || r.path;
    const resolved = r.status === "resolved";
    return (
      <li
        key={r.id}
        className="narra-card"
        style={{ opacity: resolved ? 0.6 : 1, padding: "1.1rem 1.2rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <span className="narra-badge">{CATEGORY_LABEL[r.category] ?? r.category}</span>
          <span
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "0.72rem",
              color: "var(--ink-faint)",
            }}
          >
            {new Date(r.created_at).toLocaleString()}
          </span>
        </div>

        <p style={{ margin: "0 0 0.7rem", lineHeight: 1.55 }}>{r.comment}</p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={href}
            style={{
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "0.76rem",
              color: "var(--clay-deep)",
            }}
          >
            ↦ {where}
          </Link>
          <FeedbackRow id={r.id} status={resolved ? "resolved" : "open"} />
        </div>
      </li>
    );
  };

  return (
    <div
      style={{
        maxWidth: "820px",
        margin: "0 auto",
        padding: "clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2rem)",
      }}
    >
      <p className="narra-eyebrow" style={{ marginBottom: "0.4rem" }}>
        <Link href="/admin" style={{ color: "var(--ink-faint)", textDecoration: "none" }}>
          ← Admin
        </Link>
      </p>
      <h1 className="narra-h" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "0.25rem" }}>
        Feedback Logged
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: "2rem" }}>
        {rows.length} note{rows.length === 1 ? "" : "s"} · {openCount} open
      </p>

      {rows.length === 0 ? (
        <div className="narra-card">
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            No feedback yet. Reviewers leave notes with the floating Feedback button as they go
            through the site.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.75rem" }}>
          {groupList.map((g) => {
            const gOpen = g.rows.filter((r) => r.status !== "resolved").length;
            return (
              <section key={g.name}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.7rem",
                    marginBottom: "1rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--line)",
                    flexWrap: "wrap",
                  }}
                >
                  <h2 className="narra-h" style={{ fontSize: "1.2rem", margin: 0 }}>
                    {g.name}
                  </h2>
                  <span className="narra-eyebrow" style={{ color: "var(--ink-faint)" }}>
                    {g.rows.length} note{g.rows.length === 1 ? "" : "s"} · {gOpen} open
                  </span>
                </div>
                <ol
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {g.rows.map((r) => renderNote(r))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
