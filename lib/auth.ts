import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const COURSE_SLUG = "neuromodulators-botulinum-toxin";

export async function singleCourse() {
  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", COURSE_SLUG)
    .single();
  if (error || !course) {
    throw new Error(
      `Course "${COURSE_SLUG}" not found. Run the seed script to populate it.`,
    );
  }
  return course;
}

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return { user, profile };
}

export async function requireAdmin() {
  const s = await getSessionProfile();
  if (!s?.profile) redirect("/login");
  if (s.profile.role !== "admin") redirect("/dashboard");
  return s;
}
