import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, test } from "vitest";

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

beforeAll(async () => {
  uA = await makeUser(emailA);
  uB = await makeUser(emailB);
  await admin.from("profiles").insert([
    { id: uA, full_name: "A", role: "learner" },
    { id: uB, full_name: "B", role: "learner" },
  ]);
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
