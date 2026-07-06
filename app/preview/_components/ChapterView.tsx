"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Section = { id: string; title: string; html: string };
type ChapterMini = { slug: string; title: string };
type ChapterData = {
  slug: string;
  title: string;
  part?: string;
  estimatedMinutes?: number;
  preamble: string;
  sections: Section[];
};

// Paginated chapter reader: shows ONE sub-section in focus at a time. The learner
// drives through with the sidebar TOC or the Prev/Next controls — sub-sections are
// not stacked below and scrolled into view. Sidebar and content are independent
// scroll panes (see .np-shell in preview.css). Active sub-section is hash-addressable.
export default function ChapterView({
  course,
  chapters,
  chapter,
  prevChapter,
  nextChapter,
  linkBase,
}: {
  course: { slug: string; title: string };
  chapters: ChapterMini[];
  chapter: ChapterData;
  prevChapter: ChapterMini | null;
  nextChapter: ChapterMini | null;
  linkBase?: string;
}) {
  const base = linkBase ?? `/preview/${course.slug}`;
  const router = useRouter();
  const sections = chapter.sections;
  const [active, setActive] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);

  // Initialize the focused sub-section from the URL hash (so refresh / shared links
  // restore position). Re-runs when navigating to a different chapter.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const i = hash ? sections.findIndex((s) => s.id === hash) : -1;
    // Sync from the URL hash on mount / chapter change — this cannot run server-side,
    // so an effect is the correct place (initializing lazily would hydrate-mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(i >= 0 ? i : 0);
  }, [chapter.slug, sections]);

  // Keep the hash in sync and scroll the content pane to the top on change.
  useEffect(() => {
    const id = sections[active]?.id;
    if (id) history.replaceState(null, "", `#${id}`);
    mainRef.current?.scrollTo({ top: 0 });
  }, [active, sections]);

  const go = (i: number) => setActive(Math.max(0, Math.min(sections.length - 1, i)));
  const onPrev = () => {
    if (active > 0) go(active - 1);
    else if (prevChapter) router.push(`${base}/${prevChapter.slug}`);
  };
  const onNext = () => {
    if (active < sections.length - 1) go(active + 1);
    else if (nextChapter) router.push(`${base}/${nextChapter.slug}`);
  };

  const current = sections[active];
  const progress = sections.length ? (active + 1) / sections.length : 0;
  const atFirst = active === 0;
  const atLast = active >= sections.length - 1;

  return (
    <div className="np-shell">
      <aside className="np-sidebar">
        <p className="np-side-eyebrow">Module 1</p>
        <div className="np-side-title">{course.title.replace(/^Module 1 — /, "")}</div>
        <ol className="np-chapter-list">
          {chapters.map((c, i) => (
            <li key={c.slug} className="np-chapter-item">
              <Link
                href={`${base}/${c.slug}`}
                className={`np-chapter-link${c.slug === chapter.slug ? " is-current" : ""}`}
              >
                <span className="np-chapter-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="np-chapter-title">{c.title}</span>
              </Link>

              {c.slug === chapter.slug && sections.length > 0 && (
                <nav className="np-toc-wrap" aria-label="On this page">
                  <div className="np-toc-head">
                    <span className="np-toc-eyebrow">On this page</span>
                    <div className="np-toc-progress" aria-hidden="true">
                      <span
                        className="np-toc-progress-fill"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <ol className="np-toc">
                    {sections.map((s, si) => {
                      const cls = [
                        "np-toc-link",
                        si === active ? "is-active" : "",
                        si < active ? "is-visited" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <li key={s.id} className="np-toc-item">
                          <a
                            href={`#${s.id}`}
                            className={cls}
                            onClick={(e) => {
                              e.preventDefault();
                              go(si);
                            }}
                          >
                            {s.title}
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              )}
            </li>
          ))}
        </ol>
      </aside>

      <main className="np-main" ref={mainRef}>
        <article className="np-article">
          <div className="np-kicker">
            {chapter.part && <span>{chapter.part}</span>}
            {chapter.part && chapter.estimatedMinutes && <span className="dot" />}
            {chapter.estimatedMinutes && (
              <span className="muted">≈ {chapter.estimatedMinutes} min</span>
            )}
          </div>
          <h1 className="np-article-title">{chapter.title}</h1>

          {atFirst && chapter.preamble && (
            <div
              className="np-prose np-preamble"
              dangerouslySetInnerHTML={{ __html: chapter.preamble }}
            />
          )}

          {current && (
            <div
              key={current.id}
              className="np-prose"
              dangerouslySetInnerHTML={{ __html: current.html }}
            />
          )}

          <nav className="np-reader-nav">
            <button
              type="button"
              className="np-reader-btn prev"
              onClick={onPrev}
              disabled={atFirst && !prevChapter}
            >
              <span className="np-nav-dir">← Previous</span>
              <span className="np-nav-title">
                {!atFirst
                  ? sections[active - 1].title
                  : prevChapter
                    ? prevChapter.title
                    : "Start"}
              </span>
            </button>

            <span className="np-reader-count">
              {sections.length ? `Section ${active + 1} of ${sections.length}` : ""}
            </span>

            <button
              type="button"
              className="np-reader-btn next"
              onClick={onNext}
              disabled={atLast && !nextChapter}
            >
              <span className="np-nav-dir">
                {atLast && nextChapter ? "Next chapter →" : "Next →"}
              </span>
              <span className="np-nav-title">
                {!atLast
                  ? sections[active + 1].title
                  : nextChapter
                    ? nextChapter.title
                    : "End of module"}
              </span>
            </button>
          </nav>
        </article>
      </main>
    </div>
  );
}
