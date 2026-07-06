import Link from "next/link";
import { listCourses } from "@/lib/preview-content";

export default function PreviewIndex() {
  const courses = listCourses();

  return (
    <div className="np-index">
      <p className="np-index-eyebrow">Narra Training · Authoring Preview</p>
      <h1 className="np-index-title">Course content, as the learner will see it.</h1>
      <p className="np-index-lede">
        A live render of the curriculum straight from the source Markdown. Draft content
        under clinical review — updates appear here as each chapter is written.
      </p>

      {courses.length === 0 && <p>No courses found in <code>content/courses</code>.</p>}

      {courses.map((course) => {
        const first = course.chapters[0];
        const href = first
          ? `/preview/${course.slug}/${first.slug}`
          : `/preview`;
        return (
          <Link key={course.slug} href={href} className="np-course-card">
            <div className="np-course-name">{course.title}</div>
            {course.description && (
              <div className="np-course-desc">{course.description}</div>
            )}
            <div className="np-course-meta">
              {course.chapters.length} chapter{course.chapters.length === 1 ? "" : "s"} drafted
              {course.status && <span className="np-status">{course.status}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
