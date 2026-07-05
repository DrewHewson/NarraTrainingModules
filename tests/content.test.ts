import { expect, test } from "vitest";
import { parseCourse } from "@/lib/content";

test("parseCourse reads course, chapters, quizzes", () => {
  const c = parseCourse("content/courses/sample-intro");
  expect(c.slug).toBe("sample-intro");
  expect(c.passingScore).toBe(80);
  expect(c.chapters).toHaveLength(1);
  expect(c.chapters[0].slug).toBe("01-welcome");
  expect(c.chapters[0].title).toBe("Welcome");
  expect(c.chapters[0].questions[0].externalKey).toBe("welcome-q1");
  expect(c.finalQuestions[0].correct).toEqual([2]);
});
