"use server";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["content", "typo", "question", "ux", "general"] as const;

export type FeedbackInput = {
  path: string;
  chapterSlug?: string | null;
  sectionId?: string | null;
  sectionLabel?: string | null;
  category: string;
  comment: string;
};

export type FeedbackResult = { ok: true } | { error: string };

/**
 * Save a reviewer's context-anchored note. Inserted via the authenticated
 * client so RLS (`feedback_insert`: reviewer_id = auth.uid()) attributes it to
 * whoever is signed in.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const session = await getSessionProfile();
  if (!session?.user) {
    return { error: "Your session has expired — please sign in again." };
  }
  const comment = input.comment?.trim();
  if (!comment) return { error: "Please add a comment before sending." };
  const category = (CATEGORIES as readonly string[]).includes(input.category)
    ? input.category
    : "general";

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    reviewer_id: session.user.id,
    path: input.path,
    chapter_slug: input.chapterSlug ?? null,
    section_id: input.sectionId ?? null,
    section_label: input.sectionLabel ?? null,
    category,
    comment,
  });
  if (error) return { error: "Couldn't save your feedback. Please try again." };
  return { ok: true };
}
