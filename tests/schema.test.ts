import { createClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

test("core tables exist and are queryable", async () => {
  for (const table of [
    "profiles", "courses", "chapters", "quiz_questions",
    "cohorts", "enrollments", "chapter_progress",
    "quiz_attempts", "certificates",
  ]) {
    const { error } = await admin.from(table).select("*").limit(0);
    expect(error, `table ${table}`).toBeNull();
  }
});

test("courses.passing_score defaults to 80", async () => {
  const { data, error } = await admin
    .from("courses")
    .insert({ slug: "t-default", title: "T", description: "d", status: "draft" })
    .select("passing_score")
    .single();
  expect(error).toBeNull();
  expect(data!.passing_score).toBe(80);
  await admin.from("courses").delete().eq("slug", "t-default");
});
