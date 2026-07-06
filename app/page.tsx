import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

// The root is an entry point, not a landing page: route each visitor to the
// right place based on their session. Unauthenticated → login.
export default async function Home() {
  const session = await getSessionProfile();

  if (!session) redirect("/login");
  if (session.profile?.role === "admin") redirect("/admin");
  if (session.profile?.role === "learner" && !session.profile.cno_proof_path) {
    redirect("/onboarding");
  }
  redirect("/dashboard");
}
