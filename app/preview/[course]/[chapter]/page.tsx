import { notFound } from "next/navigation";
import { getCourse, getChapter } from "@/lib/preview-content";
import ChapterView from "@/app/preview/_components/ChapterView";

type Params = { course: string; chapter: string };

export default async function ChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { course: courseSlug, chapter: chapterSlug } = await params;

  const course = getCourse(courseSlug);
  const chapter = course ? getChapter(courseSlug, chapterSlug) : null;
  if (!course || !chapter) notFound();

  const idx = course.chapters.findIndex((c) => c.slug === chapter.slug);
  const prev = idx > 0 ? course.chapters[idx - 1] : null;
  const next =
    idx >= 0 && idx < course.chapters.length - 1 ? course.chapters[idx + 1] : null;

  return (
    <ChapterView
      course={{ slug: course.slug, title: course.title }}
      chapters={course.chapters.map((c) => ({ slug: c.slug, title: c.title }))}
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
    />
  );
}
