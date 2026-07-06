/**
 * scripts/e2e-verify.ts
 *
 * End-to-end verification of the Access & Admin feature.
 * Runs against local Supabase. Usage: npx tsx scripts/e2e-verify.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

// ── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!;
const MAILPIT_URL = "http://127.0.0.1:54324";

const E2E_EMAIL = "e2e-learner+smoke@narra.test";
const E2E_PASSWORD = "e2e-strong-pass-2026";
const E2E_FULL_NAME = "E2E Learner";
const COURSE_SLUG = "neuromodulators-botulinum-toxin";

// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string, detail?: string) {
  passed++;
  console.log(`  ✓ PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(`  ✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAnonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Narra Training — E2E Verification");
  console.log("══════════════════════════════════════════════════════════════");

  const admin = createServiceClient();
  const anonForAdmin = createAnonClient();

  // ── Step 1: Admin session ─────────────────────────────────────────────

  section("Step 1: Admin sign-in + profile role");

  const { data: adminSignIn, error: adminSignInErr } =
    await anonForAdmin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

  if (adminSignInErr || !adminSignIn.session) {
    fail("Admin sign-in", adminSignInErr?.message ?? "no session");
  } else {
    pass("Admin sign-in", `user id=${adminSignIn.session.user.id}`);

    const { data: adminProfile, error: profileErr } = await anonForAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminSignIn.session.user.id)
      .single();

    if (profileErr || !adminProfile) {
      fail("Admin profile fetch", profileErr?.message);
    } else if (adminProfile.role !== "admin") {
      fail("Admin profile role", `got "${adminProfile.role}"`);
    } else {
      pass("Admin profile role=admin", `role=${adminProfile.role}`);
    }
  }

  const adminUserId = adminSignIn?.session?.user.id ?? "";

  // ── Step 2: Invite learner ────────────────────────────────────────────

  section("Step 2: Invite e2e learner + Mailpit check");

  // Clean up any prior e2e user first (idempotent)
  {
    const { data: existing } = await admin.auth.admin.listUsers();
    const prior = existing?.users.find((u) => u.email === E2E_EMAIL);
    if (prior) {
      await admin.auth.admin.deleteUser(prior.id);
      console.log(`  ℹ  Cleaned up prior e2e user ${prior.id}`);
    }
  }

  const { data: inviteData, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(E2E_EMAIL, {
      redirectTo: `${SITE_URL}/auth/set-password`,
    });

  let e2eUserId = "";

  if (inviteErr || !inviteData?.user) {
    fail("Invite learner", inviteErr?.message ?? "no user returned");
  } else {
    e2eUserId = inviteData.user.id;
    pass("Invite learner", `user id=${e2eUserId}`);

    // Upsert profile
    const { error: profileUpsertErr } = await admin.from("profiles").upsert(
      {
        id: e2eUserId,
        full_name: E2E_FULL_NAME,
        role: "learner",
      },
      { onConflict: "id" },
    );
    if (profileUpsertErr) {
      fail("Upsert learner profile", profileUpsertErr.message);
    } else {
      pass("Upsert learner profile");
    }

    // Get course id
    const { data: course, error: courseErr } = await admin
      .from("courses")
      .select("id")
      .eq("slug", COURSE_SLUG)
      .single();

    if (courseErr || !course) {
      fail("Fetch course for enrollment", courseErr?.message);
    } else {
      const { error: enrollErr } = await admin.from("enrollments").upsert(
        {
          profile_id: e2eUserId,
          course_id: course.id,
          status: "active",
        },
        { onConflict: "profile_id,course_id" },
      );
      if (enrollErr) {
        fail("Upsert enrollment", enrollErr.message);
      } else {
        pass("Upsert enrollment", `course_id=${course.id}`);
      }
    }

    // Check Mailpit for invite email
    const mailResp = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const mailJson = (await mailResp.json()) as {
      messages?: Array<{ To?: Array<{ Address?: string }>; Subject?: string }>;
    };
    const inviteEmail = mailJson.messages?.find((m) =>
      m.To?.some((t) => t.Address === E2E_EMAIL),
    );
    if (inviteEmail) {
      pass("Invite email in Mailpit", `subject: ${inviteEmail.Subject}`);
    } else {
      fail("Invite email in Mailpit", "no email found for e2e address");
    }
  }

  // ── Step 3: Learner sign-in + RLS content read ────────────────────────

  section("Step 3: Learner sign-in + content RLS");

  const learnerClient = createAnonClient();

  if (!e2eUserId) {
    fail("(skipped — no e2e user id)");
  } else {
    // Set known password via admin and confirm the email
    // (invited users have unconfirmed email even with enable_confirmations=false)
    const { error: pwErr } = await admin.auth.admin.updateUserById(e2eUserId, {
      password: E2E_PASSWORD,
      email_confirm: true,
    });
    if (pwErr) {
      fail("Set learner password (admin)", pwErr.message);
    } else {
      pass("Set learner password via admin API");

      const { data: learnerSignIn, error: learnerSignInErr } =
        await learnerClient.auth.signInWithPassword({
          email: E2E_EMAIL,
          password: E2E_PASSWORD,
        });

      if (learnerSignInErr || !learnerSignIn.session) {
        fail("Learner sign-in", learnerSignInErr?.message ?? "no session");
      } else {
        pass("Learner sign-in", `user id=${learnerSignIn.session.user.id}`);

        // RLS: enrolled + published course visible
        const { data: courses, error: coursesErr } = await learnerClient
          .from("courses")
          .select("id, slug, status")
          .eq("slug", COURSE_SLUG);

        if (coursesErr) {
          fail("Learner can read courses (RLS)", coursesErr.message);
        } else if (!courses || courses.length === 0) {
          fail("Learner can read courses (RLS)", "no rows returned");
        } else {
          pass(
            "Learner can read enrolled+published course (RLS)",
            `slug=${courses[0].slug} status=${courses[0].status}`,
          );
        }

        // RLS: chapters visible
        const { data: chapters, error: chaptersErr } = await learnerClient
          .from("chapters")
          .select("id, slug")
          .limit(3);

        if (chaptersErr) {
          fail("Learner can read chapters (RLS)", chaptersErr.message);
        } else if (!chapters || chapters.length === 0) {
          fail("Learner can read chapters (RLS)", "no rows returned");
        } else {
          pass(
            "Learner can read chapters (RLS)",
            `${chapters.length} rows, first=${chapters[0].slug}`,
          );
        }
      }
    }
  }

  // ── Step 4: Proof upload (storage RLS) ───────────────────────────────

  section("Step 4: Proof upload — storage RLS");

  if (!e2eUserId) {
    fail("(skipped — no e2e user id)");
  } else {
    // Upload as learner to own folder
    const proofContent = Buffer.from("%PDF-1.4 e2e test proof");
    const ownPath = `${e2eUserId}/proof.pdf`;

    const { error: uploadErr } = await learnerClient.storage
      .from("cno-proofs")
      .upload(ownPath, proofContent, { upsert: true });

    if (uploadErr) {
      fail("Learner upload to own folder", uploadErr.message);
    } else {
      pass("Learner upload to own folder", `path=${ownPath}`);

      // Service-role confirms object exists
      const { data: listData, error: listErr } = await admin.storage
        .from("cno-proofs")
        .list(e2eUserId);

      if (listErr || !listData?.find((o) => o.name === "proof.pdf")) {
        fail(
          "Service-role confirms upload exists",
          listErr?.message ?? "object not found in list",
        );
      } else {
        pass("Service-role confirms upload exists");
      }
    }

    // Uploading to admin's folder should be REJECTED
    if (adminUserId) {
      const otherPath = `${adminUserId}/proof.pdf`;
      const { error: rejectErr } = await learnerClient.storage
        .from("cno-proofs")
        .upload(otherPath, proofContent, { upsert: true });

      if (rejectErr) {
        pass(
          "Learner REJECTED from uploading to other user's folder (RLS)",
          rejectErr.message,
        );
      } else {
        fail(
          "Learner REJECTED from uploading to other user's folder (RLS)",
          "upload succeeded — RLS hole!",
        );
      }
    } else {
      fail("Cross-user upload rejection (skipped — no admin uid)");
    }

    // Update profile cno_proof_path + cno_registration_number
    const { error: profileUpdateErr } = await learnerClient
      .from("profiles")
      .update({
        cno_proof_path: `${e2eUserId}/proof.pdf`,
        cno_registration_number: "RN-E2E-123",
      })
      .eq("id", e2eUserId);

    if (profileUpdateErr) {
      fail("Learner updates own profile cno fields", profileUpdateErr.message);
    } else {
      pass("Learner updates own profile cno fields");
    }
  }

  // ── Step 5: Learner CANNOT self-verify ───────────────────────────────

  section("Step 5: Learner cannot self-set cno_status=verified");

  if (!e2eUserId) {
    fail("(skipped — no e2e user id)");
  } else {
    // Learner tries to set cno_status to 'verified'
    await learnerClient
      .from("profiles")
      .update({ cno_status: "verified" })
      .eq("id", e2eUserId);

    // Service-role read-back to see what actually happened
    const { data: profile, error: readErr } = await admin
      .from("profiles")
      .select("cno_status")
      .eq("id", e2eUserId)
      .single();

    if (readErr) {
      fail("Read back cno_status after learner self-verify attempt", readErr.message);
    } else if (profile?.cno_status === "verified") {
      fail(
        "Learner CANNOT self-verify",
        "cno_status was set to 'verified' — RLS hole!",
      );
    } else {
      pass(
        "Learner CANNOT self-verify",
        `cno_status stayed '${profile?.cno_status ?? "null"}'`,
      );
    }
  }

  // ── Step 6: Admin verifies ────────────────────────────────────────────

  section("Step 6: Admin (service-role) can verify learner");

  if (!e2eUserId) {
    fail("(skipped — no e2e user id)");
  } else {
    const { error: verifyErr } = await admin
      .from("profiles")
      .update({ cno_status: "verified" })
      .eq("id", e2eUserId);

    if (verifyErr) {
      fail("Admin sets cno_status=verified", verifyErr.message);
    } else {
      const { data: verifiedProfile } = await admin
        .from("profiles")
        .select("cno_status")
        .eq("id", e2eUserId)
        .single();

      if (verifiedProfile?.cno_status === "verified") {
        pass("Admin sets cno_status=verified", "read-back confirmed");
      } else {
        fail(
          "Admin sets cno_status=verified",
          `got '${verifiedProfile?.cno_status}'`,
        );
      }
    }
  }

  // ── Step 7: Cleanup ───────────────────────────────────────────────────

  section("Step 7: Cleanup");

  if (e2eUserId) {
    // Delete storage object
    const { error: delObjErr } = await admin.storage
      .from("cno-proofs")
      .remove([`${e2eUserId}/proof.pdf`]);
    if (delObjErr) {
      console.log(`  ℹ  Storage delete warning: ${delObjErr.message}`);
    } else {
      pass("Deleted e2e storage object");
    }

    // Delete auth user (cascades to profile via FK)
    const { error: delUserErr } = await admin.auth.admin.deleteUser(e2eUserId);
    if (delUserErr) {
      fail("Delete e2e auth user", delUserErr.message);
    } else {
      pass("Deleted e2e auth user", `id=${e2eUserId}`);
    }
  } else {
    console.log("  ℹ  No e2e user to clean up.");
  }

  // ── Summary ────────────────────────────────────────────────────────────

  console.log(
    "\n══════════════════════════════════════════════════════════════",
  );
  console.log(
    `  RESULTS: ${passed} passed, ${failed} failed  (total=${passed + failed})`,
  );
  console.log(
    "══════════════════════════════════════════════════════════════\n",
  );

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
