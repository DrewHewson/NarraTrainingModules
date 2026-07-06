// Pure, server-only quiz grading. Kept free of any framework/db imports so it
// is trivially unit-testable. The `correct` answer key lives ONLY here + on the
// server; it never crosses to the client.

export type GradeableQuestion = {
  id: string;
  /** zero-based indices of the correct option(s) */
  correct: number[];
};

export type QuizGrade = {
  /** 0–100, two decimals */
  score: number;
  correctCount: number;
  total: number;
};

/** Order-independent set equality over small index arrays. */
function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  for (const x of b) if (!seen.has(x)) return false;
  return true;
}

/**
 * Grade a submission. A question is correct iff the set of selected indices
 * exactly equals its `correct` set (works for both single- and multi-select).
 * `answers` maps question id → selected zero-based indices.
 */
export function gradeQuiz(
  questions: GradeableQuestion[],
  answers: Record<string, number[]>,
): QuizGrade {
  const total = questions.length;
  let correctCount = 0;
  for (const q of questions) {
    const selected = answers[q.id] ?? [];
    if (sameSet(selected, q.correct)) correctCount += 1;
  }
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 10000) / 100;
  return { score, correctCount, total };
}
