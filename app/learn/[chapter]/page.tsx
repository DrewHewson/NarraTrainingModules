import { notFound, redirect } from "next/navigation";
import { getSessionProfile, singleCourse, COURSE_SLUG } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourse, getChapter } from "@/lib/preview-content";
import ChapterView from "@/app/preview/_components/ChapterView";
import ChapterQuiz, { type QuizQuestion } from "@/app/preview/_components/ChapterQuiz";

type Params = { chapter: string };

export default async function LearnChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { chapter: chapterSlug } = await params;

  // Auth gate — unauthenticated → /login
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  // Access gate — admin or enrolled
  const course = await singleCourse();
  const isAdmin = session.profile?.role === "admin";
  const supabase = await createClient();
  if (!isAdmin) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("profile_id", session.user.id)
      .eq("course_id", course.id)
      .maybeSingle();
    if (!enrollment) redirect("/dashboard");
  }

  // Content
  const courseMeta = getCourse(COURSE_SLUG);
  const chapter = courseMeta ? getChapter(COURSE_SLUG, chapterSlug) : null;
  if (!courseMeta || !chapter) notFound();

  const idx = courseMeta.chapters.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? courseMeta.chapters[idx - 1] : null;
  const next =
    idx >= 0 && idx < courseMeta.chapters.length - 1
      ? courseMeta.chapters[idx + 1]
      : null;

  // Chapter quiz — resolve the DB chapter id, then read this chapter's questions
  // from the answer-hiding view (RLS filters to enrolled learners / admins; the
  // `correct` key is never selected). Only rendered if questions exist.
  const { data: dbChapter } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", course.id)
    .eq("slug", chapterSlug)
    .maybeSingle();

  let quizSlot: React.ReactNode = null;
  if (dbChapter) {
    const { data: questions } = await supabase
      .from("quiz_questions_public")
      .select("id, question, options, type")
      .eq("scope", "chapter")
      .eq("parent_id", dbChapter.id)
      .order("order");
    if (questions && questions.length > 0) {
      quizSlot = (
        <ChapterQuiz
          chapterId={dbChapter.id}
          questions={questions as QuizQuestion[]}
          passingScore={course.passing_score}
          nextHref={next ? `/learn/${next.slug}` : null}
        />
      );
    }
  }

  return (
    <ChapterView
      course={{ slug: courseMeta.slug, title: courseMeta.title }}
      chapters={courseMeta.chapters.map((c) => ({ slug: c.slug, title: c.title }))}
      chapter={{
        slug: chapter.slug,
        title: chapter.title,
        part: chapter.part,
        estimatedMinutes: chapter.estimatedMinutes,
        preamble: chapter.preamble,
        sections: chapter.sections,
      }}
      prevChapter={prev ? { slug: prev.slug, title: prev.title } : null}
      nextChapter={next ? { slug: next.slug, title: next.title } : null}
      linkBase="/learn"
      quizSlot={quizSlot}
    />
  );
}
