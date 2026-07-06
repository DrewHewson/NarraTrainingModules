"use client";

import Link from "next/link";
import { useState } from "react";
import { submitChapterQuiz, type QuizResult } from "@/app/learn/actions";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  type: "single" | "multiple";
};

// End-of-chapter quiz. Renders the (answer-free) questions, submits selections to
// the server action for grading, and shows score + pass/fail. Unlimited retakes;
// no per-question answer reveal (the key stays server-side).
export default function ChapterQuiz({
  chapterId,
  questions,
  passingScore,
  nextHref,
}: {
  chapterId: string;
  questions: QuizQuestion[];
  passingScore: number;
  nextHref: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, setPending] = useState(false);

  const allAnswered = questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  function select(q: QuizQuestion, optionIndex: number) {
    if (result) return; // locked while showing a result until Retake
    setAnswers((prev) => {
      if (q.type === "single") return { ...prev, [q.id]: [optionIndex] };
      const cur = prev[q.id] ?? [];
      const next = cur.includes(optionIndex)
        ? cur.filter((i) => i !== optionIndex)
        : [...cur, optionIndex];
      return { ...prev, [q.id]: next };
    });
  }

  async function onSubmit() {
    setPending(true);
    try {
      const res = await submitChapterQuiz(chapterId, answers);
      setResult(res);
    } catch {
      setResult({ error: "Something went wrong submitting your quiz. Please try again." });
    } finally {
      setPending(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
  }

  const passed = result && "passed" in result && result.passed;

  return (
    <div className="np-quiz">
      <p className="narra-eyebrow">Chapter quiz</p>
      <h2 className="np-quiz-title">Check your understanding</h2>
      <p className="np-quiz-intro">
        Answer all {questions.length} questions. You need {passingScore}% to pass — you can
        retake as many times as you like.
      </p>

      <ol className="np-quiz-list">
        {questions.map((q, qi) => (
          <li key={q.id} className="np-quiz-q">
            <p className="np-quiz-prompt">
              <span className="np-quiz-num">{qi + 1}.</span> {q.question}
              {q.type === "multiple" && <span className="np-quiz-hint"> (select all that apply)</span>}
            </p>
            <div className="np-quiz-options">
              {q.options.map((opt, oi) => {
                const checked = answers[q.id]?.includes(oi) ?? false;
                return (
                  <label
                    key={oi}
                    className={`np-quiz-option${checked ? " is-selected" : ""}${result ? " is-locked" : ""}`}
                  >
                    <input
                      type={q.type === "multiple" ? "checkbox" : "radio"}
                      name={q.id}
                      checked={checked}
                      disabled={!!result || pending}
                      onChange={() => select(q, oi)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {result && "error" in result ? (
        <div className="narra-alert" role="alert">
          {result.error}
          <div style={{ marginTop: "1rem" }}>
            <button type="button" className="narra-btn ghost" onClick={() => setResult(null)}>
              Try again
            </button>
          </div>
        </div>
      ) : result ? (
        <div className={`np-quiz-result${passed ? " is-pass" : " is-fail"}`} role="status">
          <p className="np-quiz-score">
            You scored <strong>{result.score}%</strong> —{" "}
            {passed ? "Passed ✓" : `${passingScore}% needed to pass`}
          </p>
          {!result.saved && (
            <p className="np-quiz-note">
              (Preview mode — this attempt wasn’t recorded because you’re not enrolled.)
            </p>
          )}
          <div className="np-quiz-actions">
            <button type="button" className="narra-btn ghost" onClick={retake}>
              Retake
            </button>
            {passed && nextHref && (
              <Link href={nextHref} className="narra-btn">
                Continue →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="np-quiz-actions">
          <button
            type="button"
            className="narra-btn"
            onClick={onSubmit}
            disabled={!allAnswered || pending}
          >
            {pending ? "Submitting…" : "Submit quiz"}
          </button>
          {!allAnswered && <span className="np-quiz-note">Answer every question to submit.</span>}
        </div>
      )}
    </div>
  );
}
