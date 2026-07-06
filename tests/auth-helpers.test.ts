/**
 * auth-helpers.test.ts
 *
 * Verifies that COURSE_SLUG matches an actual row in the seeded database.
 * We cannot call singleCourse() directly here because it uses the Next.js
 * server client (await cookies()), which cannot run in vitest. Instead we
 * mirror the query with a service-role supabase-js client — the real risk
 * being a typo'd slug or a missing seed.
 */
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";
import { COURSE_SLUG } from "@/lib/auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

test("COURSE_SLUG matches a seeded course row", async () => {
  const { data, error } = await admin
    .from("courses")
    .select("slug")
    .eq("slug", COURSE_SLUG)
    .single();
  expect(error).toBeNull();
  expect(data?.slug).toBe(COURSE_SLUG);
});
