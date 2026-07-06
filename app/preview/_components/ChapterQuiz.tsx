"use client";

import Link from "next/link";
import { useState } from "react";
import { submitChapterQuiz, type QuizResult, type QuizReview } from "@/app/learn/actions";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  type: "single" | "multiple";
};

// End-of-chapter quiz (the chapter's Knowledge Check, graded). Renders the
// answer-free questions, submits to the server action for grading, then reveals
// score + per-question correct answer + explanation. Unlimited retakes.
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

  const reviewMode = !!result && !("error" in result);
  const reviewById = new Map<string, QuizReview>(
    result && "review" in result ? result.review.map((r) => [r.questionId, r]) : [],
  );
  const allAnswered = questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  const passed = result && "passed" in result && result.passed;

  function select(q: QuizQuestion, optionIndex: number) {
    if (reviewMode) return;
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
      setResult(await submitChapterQuiz(chapterId, answers));
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

  return (
    <div className="np-quiz">
      <p className="narra-eyebrow">Chapter quiz</p>
      <h2 className="np-quiz-title">Check your understanding</h2>
      <p className="np-quiz-intro">
        Answer all {questions.length} questions. You need {passingScore}% to pass — you can
        retake as many times as you like.
      </p>

      {reviewMode && (
        <div className={`np-quiz-result${passed ? " is-pass" : " is-fail"}`} role="status">
          <p className="np-quiz-score">
            You scored <strong>{(result as { score: number }).score}%</strong> —{" "}
            {passed ? "Passed ✓" : `${passingScore}% needed to pass`}
          </p>
          {result && "saved" in result && !result.saved && (
            <p className="np-quiz-note">
              (Preview mode — this attempt wasn’t recorded because you’re not enrolled.)
            </p>
          )}
        </div>
      )}

      <ol className="np-quiz-list">
        {questions.map((q, qi) => {
          const rev = reviewById.get(q.id);
          return (
            <li key={q.id} className="np-quiz-q">
              <p className="np-quiz-prompt">
                {reviewMode && (
                  <span className={`np-quiz-mark${rev?.wasCorrect ? " is-right" : " is-wrong"}`}>
                    {rev?.wasCorrect ? "✓" : "✗"}
                  </span>
                )}
                <span className="np-quiz-num">{qi + 1}.</span> {q.question}
                {q.type === "multiple" && (
                  <span className="np-quiz-hint"> (select all that apply)</span>
                )}
              </p>
              <div className="np-quiz-options">
                {q.options.map((opt, oi) => {
                  const checked = answers[q.id]?.includes(oi) ?? false;
                  const isCorrect = reviewMode && (rev?.correct.includes(oi) ?? false);
                  const isWrongChoice = reviewMode && checked && !(rev?.correct.includes(oi) ?? false);
                  const cls = [
                    "np-quiz-option",
                    checked ? "is-selected" : "",
                    reviewMode ? "is-locked" : "",
                    isCorrect ? "is-correct" : "",
                    isWrongChoice ? "is-wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <label key={oi} className={cls}>
                      <input
                        type={q.type === "multiple" ? "checkbox" : "radio"}
                        name={q.id}
                        checked={checked}
                        disabled={reviewMode || pending}
                        onChange={() => select(q, oi)}
                      />
                      <span>{opt}</span>
                      {isCorrect && <span className="np-quiz-tag">Correct</span>}
                    </label>
                  );
                })}
              </div>
              {reviewMode && rev?.explanation && (
                <p className="np-quiz-explain">{rev.explanation}</p>
              )}
            </li>
          );
        })}
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
      ) : reviewMode ? (
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
