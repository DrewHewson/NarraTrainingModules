import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const email = process.env.SEED_ADMIN_EMAIL!;
const password = process.env.SEED_ADMIN_PASSWORD!;

async function main() {
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // find or create the auth user
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email) ?? null;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  // upsert admin profile
  const { error: pErr } = await admin.from("profiles")
    .upsert({ id: user!.id, full_name: "Admin", role: "admin" }, { onConflict: "id" });
  if (pErr) throw pErr;
  console.log("Admin ready:", email);
}
main().catch((e) => { console.error(e); process.exit(1); });
