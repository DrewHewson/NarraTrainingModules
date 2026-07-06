"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { singleCourse } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionState = { ok: string } | { error: string } | null;

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  const { data } = await admin.auth.admin.listUsers();
  return data?.users.find((u) => u.email === email)?.id;
}

export async function inviteLearner(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const full_name = (formData.get("full_name") as string | null)?.trim() ?? "";

  // Basic validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }
  if (!full_name) {
    return { error: "Full name is required." };
  }

  const admin = createAdminClient();

  let userId: string | undefined;
  let alreadyExists = false;

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`,
    });

  if (inviteError) {
    // Treat "already exists" errors as non-fatal — look up the user
    userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      return { error: `Could not invite learner: ${inviteError.message}` };
    }
    alreadyExists = true;
  } else {
    userId = inviteData?.user?.id;
    if (!userId) {
      return { error: "Invite sent but user ID was missing — please retry." };
    }
  }

  // Upsert profile row
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, full_name, role: "learner" }, { onConflict: "id" });
  if (profileError) {
    return { error: `Profile upsert failed: ${profileError.message}` };
  }

  // Upsert enrollment row
  const course = await singleCourse();
  const { error: enrollError } = await admin
    .from("enrollments")
    .upsert(
      { profile_id: userId, course_id: course.id, status: "active" },
      { onConflict: "profile_id,course_id" },
    );
  if (enrollError) {
    return { error: `Enrollment upsert failed: ${enrollError.message}` };
  }

  if (alreadyExists) {
    return {
      ok: `${email} is already invited/enrolled. Profile and enrollment confirmed.`,
    };
  }

  return { ok: `Invite sent to ${email}.` };
}

export async function setCnoStatus(
  profileId: string,
  status: "verified" | "rejected",
): Promise<void> {
  await requireAdmin();

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ cno_status: status })
    .eq("id", profileId);

  revalidatePath("/admin");
}
