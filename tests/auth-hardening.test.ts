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
// Objects uploaded during storage tests — cleaned up in afterAll
const uploadedStoragePaths: string[] = [];

afterAll(async () => {
  // Remove any storage objects created during tests (idempotent reruns)
  if (uploadedStoragePaths.length > 0) {
    await admin.storage.from("cno-proofs").remove(uploadedStoragePaths);
  }
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

describe("auth hardening: cno-proofs storage RLS", () => {
  // Tiny valid PDF-ish content for uploads
  const fileBody = new Uint8Array([37, 80, 68, 70]); // %PDF

  it("cno-proofs bucket is private (not public)", async () => {
    const { data, error } = await admin.storage.getBucket("cno-proofs");
    expect(error).toBeNull();
    expect(data!.public).toBe(false);
  });

  it("learner can upload to their own prefix", async () => {
    const learner = await makeLearner();
    createdUserIds.push(learner.id);

    const asLearner = await signInAs(learner.email, learner.password);
    const path = `${learner.id}/proof.pdf`;
    uploadedStoragePaths.push(path);

    const { error } = await asLearner.storage
      .from("cno-proofs")
      .upload(path, fileBody, { contentType: "application/pdf" });

    expect(error).toBeNull();

    // Confirm via service role that the object exists
    const { data: list } = await admin.storage
      .from("cno-proofs")
      .list(learner.id);
    const names = (list ?? []).map((o) => o.name);
    expect(names).toContain("proof.pdf");
  });

  it("learner cannot upload to another learner's prefix", async () => {
    const owner = await makeLearner();
    const attacker = await makeLearner();
    createdUserIds.push(owner.id, attacker.id);

    const asAttacker = await signInAs(attacker.email, attacker.password);
    const path = `${owner.id}/proof.pdf`;

    // Attempt — expect RLS to block this
    const { error } = await asAttacker.storage
      .from("cno-proofs")
      .upload(path, fileBody, { contentType: "application/pdf" });

    // The upload should be rejected
    expect(error).not.toBeNull();

    // Belt-and-suspenders: verify via service role that no object was created
    const { data: list } = await admin.storage
      .from("cno-proofs")
      .list(owner.id);
    const names = (list ?? []).map((o) => o.name);
    expect(names).not.toContain("proof.pdf");
  });

  it("admin can read/list any learner's object", async () => {
    const learner = await makeLearner();
    createdUserIds.push(learner.id);

    const path = `${learner.id}/admin-read-test.pdf`;
    uploadedStoragePaths.push(path);

    // Upload via service-role (bypasses RLS) to seed the object
    const { error: uploadErr } = await admin.storage
      .from("cno-proofs")
      .upload(path, fileBody, { contentType: "application/pdf" });
    expect(uploadErr).toBeNull();

    // Admin listing should see the object
    const { data: list, error: listErr } = await admin.storage
      .from("cno-proofs")
      .list(learner.id);
    expect(listErr).toBeNull();
    const names = (list ?? []).map((o) => o.name);
    expect(names).toContain("admin-read-test.pdf");
  });
});
