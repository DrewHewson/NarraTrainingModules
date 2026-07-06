"use server";

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ActionState = { error: string } | null;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function submitCnoProof(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSessionProfile();
  if (!session?.user) {
    redirect("/login");
  }
  const { user } = session;

  const cnoNumber = (formData.get("cno_registration_number") as string | null)?.trim() ?? "";
  if (!cnoNumber) {
    return { error: "CNO registration number is required." };
  }

  const file = formData.get("proof_file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please select a PDF or image file to upload." };
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { error: "Only PDF, JPEG, or PNG files are accepted." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "File must be 10 MB or smaller." };
  }

  const supabase = await createClient();

  const path = `${user.id}/proof.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("cno-proofs")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ cno_proof_path: path, cno_registration_number: cnoNumber })
    .eq("id", user.id);

  if (profileError) {
    return { error: `Profile update failed: ${profileError.message}` };
  }

  redirect("/dashboard");
}
