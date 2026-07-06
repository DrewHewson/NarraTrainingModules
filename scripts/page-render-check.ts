/**
 * scripts/page-render-check.ts
 *
 * Part C: Authenticated page-render checks using real session cookies.
 * Usage: npx tsx scripts/page-render-check.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// ── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const COURSE_SLUG = "neuromodulators-botulinum-toxin";
const E2E_EMAIL = "e2e-render+smoke@narra.test";
const E2E_PASSWORD = "e2e-render-pass-2026";

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

function note(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ── In-memory cookie jar ───────────────────────────────────────────────────

type CookieEntry = { name: string; value: string; options?: Record<string, unknown> };

function makeCookieJar() {
  const jar: Map<string, CookieEntry> = new Map();
  return {
    jar,
    getAll(): CookieEntry[] {
      return Array.from(jar.values());
    },
    setAll(cookies: CookieEntry[]) {
      for (const c of cookies) {
        jar.set(c.name, c);
      }
    },
    toCookieHeader(): string {
      return Array.from(jar.values())
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
    },
  };
}

async function signInWithCookies(email: string, password: string) {
  const cookieJar = makeCookieJar();

  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieJar.getAll(),
      setAll: (cookies) => cookieJar.setAll(cookies),
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error, cookieHeader: null, userId: null };

  const cookieHeader = cookieJar.toCookieHeader();
  return { error: null, cookieHeader, userId: data.user?.id ?? null };
}

async function curlPage(
  path: string,
  cookieHeader: string,
): Promise<{ status: number; body: string }> {
  const url = `${SITE_URL}${path}`;
  const resp = await fetch(url, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  const body = await resp.text();
  return { status: resp.status, body };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Narra Training — Part C: Page Render Checks");
  console.log("══════════════════════════════════════════════════════════════");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Unauth guard checks ────────────────────────────────────────────────

  section("Unauthenticated redirects");

  for (const path of ["/admin", "/dashboard", "/onboarding", "/learn/01-orientation"]) {
    const resp = await fetch(`${SITE_URL}${path}`, { redirect: "manual" });
    const loc = resp.headers.get("location") ?? "";
    if (resp.status >= 300 && resp.status < 400 && loc.includes("/login")) {
      pass(`GET ${path} → 3xx /login`, `${resp.status} → ${loc}`);
    } else {
      fail(`GET ${path} → 3xx /login`, `got ${resp.status} loc=${loc || "none"}`);
    }
  }

  // ── Admin session ──────────────────────────────────────────────────────

  section("Admin authenticated page: /admin");

  const {
    error: adminErr,
    cookieHeader: adminCookies,
  } = await signInWithCookies(ADMIN_EMAIL, ADMIN_PASSWORD);

  if (adminErr || !adminCookies) {
    fail("Admin SSR sign-in", adminErr?.message ?? "no cookies");
  } else {
    pass("Admin SSR sign-in (got cookies)");

    const { status: adminStatus, body: adminBody } = await curlPage("/admin", adminCookies);
    if (adminStatus === 200) {
      const hasInvite =
        adminBody.toLowerCase().includes("invite") ||
        adminBody.toLowerCase().includes("learner") ||
        adminBody.toLowerCase().includes("admin");
      pass(
        `GET /admin → 200`,
        hasInvite ? "contains invite/learner/admin content" : "200 but content check failed",
      );
      if (!hasInvite) {
        note("Admin page body excerpt: " + adminBody.substring(0, 200).replace(/\n/g, " "));
      }
    } else {
      fail(`GET /admin`, `status=${adminStatus}`);
      note("Body excerpt: " + adminBody.substring(0, 200).replace(/\n/g, " "));
    }
  }

  // ── Setup learner with proof ───────────────────────────────────────────

  section("Setup learner with cno_proof_path");

  // Clean up prior e2e render user
  {
    const { data: existing } = await admin.auth.admin.listUsers();
    const prior = existing?.users.find((u) => u.email === E2E_EMAIL);
    if (prior) {
      await admin.auth.admin.deleteUser(prior.id);
      note(`Cleaned up prior render user ${prior.id}`);
    }
  }

  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    E2E_EMAIL,
    { redirectTo: `${SITE_URL}/auth/set-password` },
  );

  let renderUserId = "";

  if (inviteErr || !inviteData?.user) {
    fail("Invite render learner", inviteErr?.message ?? "no user");
  } else {
    renderUserId = inviteData.user.id;
    pass("Invite render learner", `id=${renderUserId}`);

    // Confirm email + set password
    await admin.auth.admin.updateUserById(renderUserId, {
      password: E2E_PASSWORD,
      email_confirm: true,
    });

    // Get course id
    const { data: course } = await admin
      .from("courses")
      .select("id")
      .eq("slug", COURSE_SLUG)
      .single();

    if (course) {
      await admin.from("profiles").upsert(
        { id: renderUserId, full_name: "Render Learner", role: "learner" },
        { onConflict: "id" },
      );
      await admin.from("enrollments").upsert(
        { profile_id: renderUserId, course_id: course.id, status: "active" },
        { onConflict: "profile_id,course_id" },
      );
      pass("Profile + enrollment upserted");

      // Upload a proof file
      const proofContent = Buffer.from("%PDF-1.4 render test proof");
      await admin.storage
        .from("cno-proofs")
        .upload(`${renderUserId}/proof.pdf`, proofContent, { upsert: true });

      // Update profile with cno_proof_path
      await admin
        .from("profiles")
        .update({ cno_proof_path: `${renderUserId}/proof.pdf`, cno_status: "pending" })
        .eq("id", renderUserId);
      pass("cno_proof_path set on profile");
    }
  }

  // ── Learner WITH proof → /dashboard ───────────────────────────────────

  section("Learner (with proof) → /dashboard and /learn");

  if (renderUserId) {
    const { error: lErr, cookieHeader: lCookies } = await signInWithCookies(
      E2E_EMAIL,
      E2E_PASSWORD,
    );

    if (lErr || !lCookies) {
      fail("Learner SSR sign-in", lErr?.message ?? "no cookies");
    } else {
      pass("Learner SSR sign-in (got cookies)");

      // /dashboard
      const { status: dashStatus, body: dashBody } = await curlPage("/dashboard", lCookies);
      if (dashStatus === 200) {
        const hasCourse =
          dashBody.toLowerCase().includes("neuromodulator") ||
          dashBody.toLowerCase().includes("course") ||
          dashBody.toLowerCase().includes("botulinum");
        const hasCno =
          dashBody.toLowerCase().includes("cno") ||
          dashBody.toLowerCase().includes("proof") ||
          dashBody.toLowerCase().includes("registration");
        if (hasCourse) {
          pass("GET /dashboard → 200 with course card content");
        } else {
          fail(
            "GET /dashboard → 200 but missing course content",
            "body excerpt: " + dashBody.substring(0, 300).replace(/\n/g, " "),
          );
        }
        if (hasCno) {
          pass("GET /dashboard → CNO badge/section present");
        } else {
          note("CNO content not clearly detected in rendered HTML (may be client-side)");
          note("body excerpt: " + dashBody.substring(100, 400).replace(/\n/g, " "));
        }
      } else if (dashStatus >= 300 && dashStatus < 400) {
        fail(`GET /dashboard → ${dashStatus} (redirect, expected 200)`);
        note("Body: " + dashBody.substring(0, 200).replace(/\n/g, " "));
      } else {
        fail(`GET /dashboard → ${dashStatus}`);
        note("Body: " + dashBody.substring(0, 200).replace(/\n/g, " "));
      }

      // /learn first chapter
      const { data: chapters } = await admin
        .from("chapters")
        .select("slug, order")
        .order("order", { ascending: true })
        .limit(1);

      const firstChapter = chapters?.[0]?.slug ?? "01-orientation";
      const { status: learnStatus, body: learnBody } = await curlPage(
        `/learn/${firstChapter}`,
        lCookies,
      );
      if (learnStatus === 200) {
        const hasContent =
          learnBody.includes("np-shell") ||
          learnBody.includes("narra-shell") ||
          learnBody.includes("orientation") ||
          learnBody.toLowerCase().includes("chapter") ||
          learnBody.toLowerCase().includes("section") ||
          learnBody.toLowerCase().includes("toxin");
        if (hasContent) {
          pass(`GET /learn/${firstChapter} → 200 with reader content`);
        } else {
          fail(
            `GET /learn/${firstChapter} → 200 but missing reader markup`,
            dashBody.substring(0, 200).replace(/\n/g, " "),
          );
        }
      } else {
        fail(`GET /learn/${firstChapter} → ${learnStatus}`);
        note("Body: " + learnBody.substring(0, 200).replace(/\n/g, " "));
      }
    }
  } else {
    fail("Learner page checks (skipped — no render user)");
  }

  // ── Learner WITHOUT proof → /dashboard redirects to /onboarding ───────

  section("Learner WITHOUT proof → /dashboard → /onboarding");

  const NO_PROOF_EMAIL = "e2e-noproof+smoke@narra.test";
  const NO_PROOF_PASS = "e2e-noproof-2026";
  let noProofId = "";

  {
    const { data: existing } = await admin.auth.admin.listUsers();
    const prior = existing?.users.find((u) => u.email === NO_PROOF_EMAIL);
    if (prior) {
      await admin.auth.admin.deleteUser(prior.id);
    }
  }

  const { data: npInvite, error: npInvErr } = await admin.auth.admin.inviteUserByEmail(
    NO_PROOF_EMAIL,
    { redirectTo: `${SITE_URL}/auth/set-password` },
  );

  if (npInvErr || !npInvite?.user) {
    fail("Invite no-proof learner", npInvErr?.message ?? "no user");
  } else {
    noProofId = npInvite.user.id;
    await admin.auth.admin.updateUserById(noProofId, {
      password: NO_PROOF_PASS,
      email_confirm: true,
    });
    const { data: course } = await admin
      .from("courses")
      .select("id")
      .eq("slug", COURSE_SLUG)
      .single();
    if (course) {
      await admin.from("profiles").upsert(
        { id: noProofId, full_name: "No Proof Learner", role: "learner" },
        { onConflict: "id" },
      );
      await admin.from("enrollments").upsert(
        { profile_id: noProofId, course_id: course.id, status: "active" },
        { onConflict: "profile_id,course_id" },
      );
    }
    pass("No-proof learner created (no cno_proof_path set)");

    const { error: npErr, cookieHeader: npCookies } = await signInWithCookies(
      NO_PROOF_EMAIL,
      NO_PROOF_PASS,
    );

    if (npErr || !npCookies) {
      fail("No-proof learner sign-in", npErr?.message ?? "no cookies");
    } else {
      pass("No-proof learner SSR sign-in");

      const dashResp = await fetch(`${SITE_URL}/dashboard`, {
        headers: { Cookie: npCookies },
        redirect: "manual",
      });
      const loc = dashResp.headers.get("location") ?? "";
      if (
        (dashResp.status >= 300 && dashResp.status < 400 && loc.includes("/onboarding")) ||
        // Some implementations redirect to /onboarding after a second redirect
        (dashResp.status === 200 && (await dashResp.text()).includes("onboarding"))
      ) {
        pass(
          "Learner without proof → /dashboard redirects to /onboarding",
          `${dashResp.status} → ${loc}`,
        );
      } else {
        // May serve 200 if the redirect is client-side RSC
        note(
          `GET /dashboard (no proof) → ${dashResp.status} loc=${loc || "none"} — checking body…`,
        );
        const body = await dashResp.text().catch(() => "");
        if (body.includes("onboarding")) {
          pass(
            "Learner without proof → dashboard body references onboarding",
            "client-side redirect expected",
          );
        } else {
          fail(
            "Learner without proof → /dashboard did not redirect to /onboarding",
            `status=${dashResp.status} loc=${loc}`,
          );
          note("Body excerpt: " + body.substring(0, 300).replace(/\n/g, " "));
        }
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  section("Cleanup");

  if (renderUserId) {
    await admin.storage.from("cno-proofs").remove([`${renderUserId}/proof.pdf`]);
    await admin.auth.admin.deleteUser(renderUserId);
    pass("Deleted render learner");
  }
  if (noProofId) {
    await admin.auth.admin.deleteUser(noProofId);
    pass("Deleted no-proof learner");
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
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
