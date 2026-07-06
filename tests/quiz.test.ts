import { describe, it, expect } from "vitest";
import { gradeQuiz, type GradeableQuestion } from "@/lib/quiz";

const q = (id: string, correct: number[]): GradeableQuestion => ({ id, correct });

describe("gradeQuiz", () => {
  it("scores a perfect single-select quiz as 100", () => {
    const questions = [q("a", [0]), q("b", [1]), q("c", [2])];
    const g = gradeQuiz(questions, { a: [0], b: [1], c: [2] });
    expect(g).toEqual({ score: 100, correctCount: 3, total: 3 });
  });

  it("4 of 5 correct = 80.00 (the pass boundary)", () => {
    const questions = [q("1", [0]), q("2", [0]), q("3", [0]), q("4", [0]), q("5", [0])];
    const g = gradeQuiz(questions, { "1": [0], "2": [0], "3": [0], "4": [0], "5": [1] });
    expect(g.score).toBe(80);
    expect(g.score >= 80).toBe(true); // passes at exactly 80
  });

  it("3 of 5 correct = 60.00 (fails)", () => {
    const questions = [q("1", [0]), q("2", [0]), q("3", [0]), q("4", [0]), q("5", [0])];
    const g = gradeQuiz(questions, { "1": [0], "2": [0], "3": [0], "4": [1], "5": [1] });
    expect(g.score).toBe(60);
    expect(g.score >= 80).toBe(false);
  });

  it("multi-select requires the exact set (order-independent)", () => {
    const questions = [q("m", [0, 2])];
    expect(gradeQuiz(questions, { m: [2, 0] }).score).toBe(100); // order doesn't matter
    expect(gradeQuiz(questions, { m: [0] }).score).toBe(0); // partial is wrong
    expect(gradeQuiz(questions, { m: [0, 1, 2] }).score).toBe(0); // superset is wrong
  });

  it("missing / empty answers count as incorrect", () => {
    const questions = [q("a", [0]), q("b", [1])];
    expect(gradeQuiz(questions, {}).score).toBe(0);
    expect(gradeQuiz(questions, { a: [] }).correctCount).toBe(0);
  });

  it("rounds to two decimals (5/6 = 83.33)", () => {
    const questions = Array.from({ length: 6 }, (_, i) => q(String(i), [0]));
    const answers: Record<string, number[]> = {};
    for (let i = 0; i < 6; i++) answers[String(i)] = i === 5 ? [1] : [0];
    expect(gradeQuiz(questions, answers).score).toBe(83.33);
  });

  it("empty quiz is 0/0 without dividing by zero", () => {
    expect(gradeQuiz([], {})).toEqual({ score: 0, correctCount: 0, total: 0 });
  });
});
