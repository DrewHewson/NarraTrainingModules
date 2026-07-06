import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: process.env.ENV_FILE ?? ".env.local", quiet: true });

// Mirror of COURSE_SLUG in lib/auth.ts (kept literal here to avoid importing
// server-only modules into this node script).
const COURSE_SLUG = "neuromodulators-botulinum-toxin";

const email = process.env.TEST_LEARNER_EMAIL!;
const password = process.env.TEST_LEARNER_PASSWORD!;

async function main() {
  if (!email || !password) {
    throw new Error("Set TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD");
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // find or create the auth user (idempotent)
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email) ?? null;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }

  // Ready-to-use learner: verified CNO + a placeholder proof path so they land
  // straight on the dashboard (past the onboarding gate) and can open /learn.
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: user!.id,
      full_name: "Test Learner",
      role: "learner",
      cno_registration_number: "RN-TEST-0001",
      cno_proof_path: "test/placeholder.pdf",
      cno_status: "verified",
    },
    { onConflict: "id" },
  );
  if (pErr) throw pErr;

  // enroll in the primary course
  const { data: course, error: cErr } = await admin
    .from("courses")
    .select("id")
    .eq("slug", COURSE_SLUG)
    .single();
  if (cErr || !course) {
    throw new Error(`Course ${COURSE_SLUG} not found — run \`npm run seed\` first.`);
  }
  const { error: eErr } = await admin.from("enrollments").upsert(
    { profile_id: user!.id, course_id: course.id, status: "active" },
    { onConflict: "profile_id,course_id" },
  );
  if (eErr) throw eErr;

  console.log("Test learner ready:", email);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
