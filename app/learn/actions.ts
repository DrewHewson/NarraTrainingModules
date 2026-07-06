"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile, singleCourse } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeQuiz } from "@/lib/quiz";

export type QuizResult =
  | { score: number; passed: boolean; total: number; saved: boolean }
  | { error: string };

/**
 * Grade a chapter quiz server-side and persist the attempt.
 *
 * The answer key (`quiz_questions.correct`) is read only here via the
 * service-role client and never returned to the browser — the client sends its
 * selections and gets back only the score + pass/fail.
 */
export async function submitChapterQuiz(
  chapterId: string,
  answers: Record<string, number[]>,
): Promise<QuizResult> {
  const session = await getSessionProfile();
  if (!session?.user) {
    return { error: "Your session has expired — please sign in again." };
  }

  const admin = createAdminClient();
  const course = await singleCourse();

  // Answer key for this chapter's quiz (base table, service role).
  const { data: questions, error: qErr } = await admin
    .from("quiz_questions")
    .select("id, correct")
    .eq("scope", "chapter")
    .eq("parent_id", chapterId);

  if (qErr || !questions || questions.length === 0) {
    return { error: "This quiz isn't available right now." };
  }

  const { score, total } = gradeQuiz(
    questions.map((q) => ({ id: q.id as string, correct: (q.correct as number[]) ?? [] })),
    answers,
  );
  const passed = score >= course.passing_score;

  // The learner's enrollment (needed to persist the attempt/progress).
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("profile_id", session.user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  let saved = false;
  if (enrollment) {
    await admin.from("quiz_attempts").insert({
      enrollment_id: enrollment.id,
      quiz_scope: "chapter",
      parent_id: chapterId,
      score,
      passed,
      answers,
    });
    if (passed) {
      await admin
        .from("chapter_progress")
        .upsert(
          { enrollment_id: enrollment.id, chapter_id: chapterId },
          { onConflict: "enrollment_id,chapter_id" },
        );
    }
    saved = true;
    revalidatePath("/dashboard");
  }

  return { score, passed, total, saved };
}
