import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";

export type ParsedQuestion = {
  externalKey: string;
  question: string;
  options: string[];
  correct: number[];
  type: "single" | "multiple";
  order: number;
};

export type ParsedChapter = {
  slug: string;
  title: string;
  order: number;
  body: string;
  media: unknown[];
  questions: ParsedQuestion[];
};

export type ParsedCourse = {
  slug: string;
  title: string;
  description: string;
  passingScore: number;
  status: "draft" | "published";
  chapters: ParsedChapter[];
  finalQuestions: ParsedQuestion[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readQuiz(path: string): ParsedQuestion[] {
  if (!existsSync(path)) return [];
  return readJson<ParsedQuestion[]>(path);
}

export function parseCourse(dir: string): ParsedCourse {
  const meta = readJson<Omit<ParsedCourse, "chapters" | "finalQuestions">>(
    join(dir, "course.json"),
  );
  const chapterDir = join(dir, "chapters");
  const chapters: ParsedChapter[] = readdirSync(chapterDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = basename(f, ".md");
      const parsed = matter(readFileSync(join(chapterDir, f), "utf8"));
      const questions = readQuiz(join(dir, "quizzes", `${slug}.json`));
      return {
        slug,
        title: String(parsed.data.title),
        order: Number(parsed.data.order),
        body: parsed.content.trim(),
        media: (parsed.data.media as unknown[]) ?? [],
        questions,
      };
    })
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

  return {
    ...meta,
    chapters,
    finalQuestions: readQuiz(join(dir, "quizzes", "final-test.json")),
  };
}
