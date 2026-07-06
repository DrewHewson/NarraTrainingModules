import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

interface LearnerFixture {
  id: string;
  email: string;
  password: string;
}

async function makeLearner(): Promise<LearnerFixture> {
  const email = `hardening-${Date.now()}@test.dev`;
  const password = "password123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user!.id;
  const { error: profileErr } = await admin.from("profiles").insert({
    id,
    full_name: "Test Learner",
    role: "learner",
    cno_status: "pending",
  });
  if (profileErr) throw profileErr;
  return { id, email, password };
}

async function signInAs(email: string, password: string) {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

const createdUserIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("auth hardening: cno_status write protection", () => {
  it("learner cannot self-verify CNO status", async () => {
    const learner = await makeLearner();
    createdUserIds.push(learner.id);

    const asLearner = await signInAs(learner.email, learner.password);

    // Attempt to escalate cno_status — RLS WITH CHECK should block this
    await asLearner
      .from("profiles")
      .update({ cno_status: "verified" })
      .eq("id", learner.id);

    // Verify via service-role (bypasses RLS) that the row is still 'pending'
    const { data, error } = await admin
      .from("profiles")
      .select("cno_status")
      .eq("id", learner.id)
      .single();
    expect(error).toBeNull();
    expect(data!.cno_status).toBe("pending");
  });

  it("learner cannot self-elevate their role to admin", async () => {
    const learner = await makeLearner();
    createdUserIds.push(learner.id);

    const asLearner = await signInAs(learner.email, learner.password);

    // Attempt to escalate role — WITH CHECK should block this
    await asLearner
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", learner.id);

    // Verify via service-role that role is still 'learner'
    const { data, error } = await admin
      .from("profiles")
      .select("role")
      .eq("id", learner.id)
      .single();
    expect(error).toBeNull();
    expect(data!.role).toBe("learner");
  });

  it("learner can still update benign fields (e.g. full_name)", async () => {
    const learner = await makeLearner();
    createdUserIds.push(learner.id);

    const asLearner = await signInAs(learner.email, learner.password);

    await asLearner
      .from("profiles")
      .update({ full_name: "Updated Name" })
      .eq("id", learner.id);

    // This update should succeed (role and cno_status unchanged)
    const { data } = await admin
      .from("profiles")
      .select("full_name, role, cno_status")
      .eq("id", learner.id)
      .single();

    expect(data!.full_name).toBe("Updated Name");
    expect(data!.role).toBe("learner");
    expect(data!.cno_status).toBe("pending");
  });
});
