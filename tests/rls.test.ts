import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, test } from "vitest";
import { seedCourse } from "@/scripts/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function authedClient(email: string) {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}

let uA: string, uB: string;
const emailA = "a-rls@test.dev";
const emailB = "b-rls@test.dev";

// Fixture ids set in beforeAll for use in negative-path tests
let courseId: string;
let chapterId: string;
let enrollmentA: string;
let enrollmentB: string;

beforeAll(async () => {
  uA = await makeUser(emailA);
  uB = await makeUser(emailB);
  await admin.from("profiles").insert([
    { id: uA, full_name: "A", role: "learner" },
    { id: uB, full_name: "B", role: "learner" },
  ]);

  // Seed the sample course (idempotent)
  await seedCourse("content/courses/sample-intro");

  // Look up the seeded course id
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id")
    .eq("slug", "sample-intro")
    .single();
  if (courseErr) throw courseErr;
  courseId = course!.id;

  // Look up the first chapter id
  const { data: chapters, error: chapErr } = await admin
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
    .limit(1);
  if (chapErr) throw chapErr;
  chapterId = chapters![0].id;

  // Enroll both learners — upsert so re-runs are idempotent
  const { data: enrA, error: enrAErr } = await admin
    .from("enrollments")
    .upsert({ profile_id: uA, course_id: courseId }, { onConflict: "profile_id,course_id" })
    .select("id")
    .single();
  if (enrAErr) throw enrAErr;
  enrollmentA = enrA!.id;

  const { data: enrB, error: enrBErr } = await admin
    .from("enrollments")
    .upsert({ profile_id: uB, course_id: courseId }, { onConflict: "profile_id,course_id" })
    .select("id")
    .single();
  if (enrBErr) throw enrBErr;
  enrollmentB = enrB!.id;
});

afterAll(async () => {
  await admin.auth.admin.deleteUser(uA);
  await admin.auth.admin.deleteUser(uB);
});

test("a learner reads only their own profile", async () => {
  const cA = await authedClient(emailA);
  const { data } = await cA.from("profiles").select("id");
  expect(data?.map((r) => r.id)).toEqual([uA]);
});

test("learners cannot read the base quiz_questions table", async () => {
  const cA = await authedClient(emailA);
  // RLS on the admin-only base table returns zero rows to a learner (no error).
  const base = await cA.from("quiz_questions").select("id");
  expect(base.error).toBeNull();
  expect(base.data).toEqual([]);
});

test("quiz_questions_public exposes no `correct` column", async () => {
  const cA = await authedClient(emailA);
  const view = await cA.from("quiz_questions_public").select("*").limit(1);
  expect(view.error).toBeNull();
  const cols = view.data?.[0] ? Object.keys(view.data[0]) : [];
  expect(cols).not.toContain("correct");
});

test("a learner cannot escalate their own role to admin", async () => {
  const cA = await authedClient(emailA);
  await cA.from("profiles").update({ role: "admin" }).eq("id", uA);
  const { data } = await cA.from("profiles").select("role").eq("id", uA).single();
  expect(data?.role).toBe("learner");
});

test("a learner cannot insert a quiz_attempts row (no insert policy; service-role only)", async () => {
  const cA = await authedClient(emailA);
  const { error } = await cA.from("quiz_attempts").insert({
    enrollment_id: enrollmentA, // even their OWN enrollment must be denied
    quiz_scope: "final",
    parent_id: courseId,
    score: 100,
    passed: true,
    answers: {},
  });
  expect(error).not.toBeNull(); // RLS denies: no INSERT policy exists
  // and nothing persisted
  const { data } = await admin
    .from("quiz_attempts")
    .select("id")
    .eq("enrollment_id", enrollmentA);
  expect(data).toEqual([]);
});

test("a learner cannot read another learner's enrollment", async () => {
  const cA = await authedClient(emailA);
  const { data } = await cA.from("enrollments").select("id").eq("id", enrollmentB);
  expect(data).toEqual([]); // RLS returns zero rows for B's enrollment
});

test("a learner cannot record progress against another learner's enrollment", async () => {
  const cA = await authedClient(emailA);
  const { error } = await cA.from("chapter_progress").insert({
    enrollment_id: enrollmentB, // B's enrollment — WITH CHECK must reject
    chapter_id: chapterId,
  });
  expect(error).not.toBeNull();
  const { data } = await admin
    .from("chapter_progress")
    .select("id")
    .eq("enrollment_id", enrollmentB);
  expect(data).toEqual([]);
});
