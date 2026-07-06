import { type NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * TEST-ONLY one-click sign-in as a seeded admin/learner.
 *
 * Hard-disabled unless TEST_MODE === "true": the route 404s otherwise, so it is
 * inert on any deploy that doesn't explicitly opt in. NEVER set TEST_MODE in a
 * real production environment — this is an intentional login-as-anyone backdoor
 * for a throwaway test env only.
 */
export async function POST(request: NextRequest) {
  if (process.env.TEST_MODE !== "true") notFound();

  const role = (await request.formData()).get("role");

  const creds =
    role === "admin"
      ? {
          email: process.env.SEED_ADMIN_EMAIL,
          password: process.env.SEED_ADMIN_PASSWORD,
          dest: "/admin",
        }
      : role === "learner"
        ? {
            email: process.env.TEST_LEARNER_EMAIL,
            password: process.env.TEST_LEARNER_PASSWORD,
            dest: "/dashboard",
          }
        : null;

  if (!creds?.email || !creds.password) notFound();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error) {
    // Seed account missing/misconfigured — bounce back to login.
    return NextResponse.redirect(new URL("/login?testswitch=failed", request.url));
  }
  return NextResponse.redirect(new URL(creds.dest, request.url));
}
