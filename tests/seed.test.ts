import { createClient } from "@supabase/supabase-js";
import { beforeAll, expect, test } from "vitest";
import { seedCourse } from "@/scripts/seed";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

beforeAll(async () => {
  await seedCourse("content/courses/sample-intro");
  await seedCourse("content/courses/sample-intro"); // second run must not duplicate
});

test("seed inserts exactly one course (idempotent)", async () => {
  const { data } = await admin.from("courses").select("id").eq("slug", "sample-intro");
  expect(data).toHaveLength(1);
});

test("seed inserts one chapter and its quiz + final questions", async () => {
  const { data: course } = await admin
    .from("courses").select("id").eq("slug", "sample-intro").single();
  const { data: chapters } = await admin
    .from("chapters").select("id").eq("course_id", course!.id);
  expect(chapters).toHaveLength(1);

  const { data: chapterQ } = await admin
    .from("quiz_questions").select("id")
    .eq("scope", "chapter").eq("parent_id", chapters![0].id);
  expect(chapterQ).toHaveLength(1);

  const { data: finalQ } = await admin
    .from("quiz_questions").select("id")
    .eq("scope", "final").eq("parent_id", course!.id);
  expect(finalQ).toHaveLength(1);
});
