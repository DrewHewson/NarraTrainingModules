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
//
// When `quizSlot` is provided (the /learn route), it is appended as one extra
// step after the last section (the "Chapter quiz"). /preview passes no quizSlot,
// so the authoring view behaves exactly as before.
export default function ChapterView({
  course,
  chapters,
  chapter,
  prevChapter,
  nextChapter,
  linkBase,
  quizSlot,
}: {
  course: { slug: string; title: string };
  chapters: ChapterMini[];
  chapter: ChapterData;
  prevChapter: ChapterMini | null;
  nextChapter: ChapterMini | null;
  linkBase?: string;
  quizSlot?: React.ReactNode;
}) {
  const base = linkBase ?? `/preview/${course.slug}`;
  const router = useRouter();
  const sections = chapter.sections;
  const hasQuiz = !!quizSlot;
  const stepCount = sections.length + (hasQuiz ? 1 : 0);
  const quizIndex = sections.length; // step index of the quiz, when present
  const [active, setActive] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);

  // Initialize the focused step from the URL hash (so refresh / shared links
  // restore position). Re-runs when navigating to a different chapter.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    let i = -1;
    if (hash === "chapter-quiz" && hasQuiz) i = quizIndex;
    else if (hash) i = sections.findIndex((s) => s.id === hash);
    // Sync from the URL hash on mount / chapter change — this cannot run server-side,
    // so an effect is the correct place (initializing lazily would hydrate-mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(i >= 0 ? i : 0);
  }, [chapter.slug, sections, hasQuiz, quizIndex]);

  // Keep the hash in sync and scroll the content pane to the top on change.
  useEffect(() => {
    const hash = hasQuiz && active === quizIndex ? "chapter-quiz" : sections[active]?.id;
    if (hash) history.replaceState(null, "", `#${hash}`);
    mainRef.current?.scrollTo({ top: 0 });
  }, [active, sections, hasQuiz, quizIndex]);

  const go = (i: number) => setActive(Math.max(0, Math.min(stepCount - 1, i)));
  const onPrev = () => {
    if (active > 0) go(active - 1);
    else if (prevChapter) router.push(`${base}/${prevChapter.slug}`);
  };
  const onNext = () => {
    if (active < stepCount - 1) go(active + 1);
    else if (nextChapter) router.push(`${base}/${nextChapter.slug}`);
  };

  const isQuizStep = hasQuiz && active === quizIndex;
  const current = sections[active];
  const progress = stepCount ? (active + 1) / stepCount : 0;
  const atFirst = active === 0;
  const atLast = active >= stepCount - 1;
  const stepTitle = (i: number) => (i < sections.length ? sections[i].title : "Chapter quiz");

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
                    {hasQuiz && (
                      <li className="np-toc-item">
                        <a
                          href="#chapter-quiz"
                          className={`np-toc-link${isQuizStep ? " is-active" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            go(quizIndex);
                          }}
                        >
                          Chapter quiz
                        </a>
                      </li>
                    )}
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

          {isQuizStep
            ? quizSlot
            : current && (
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
                {!atFirst ? stepTitle(active - 1) : prevChapter ? prevChapter.title : "Start"}
              </span>
            </button>

            <span className="np-reader-count">
              {isQuizStep ? "Chapter quiz" : `Section ${active + 1} of ${sections.length}`}
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
                  ? stepTitle(active + 1)
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
