import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./_components/InviteForm";
import LearnerRow from "./_components/LearnerRow";

export const metadata = { title: "Admin — Narra Training" };

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  cno_status: "pending" | "verified" | "rejected" | null;
  cno_registration_number: string | null;
  cno_proof_path: string | null;
  created_at: string;
}

export default async function AdminPage() {
  await requireAdmin();

  const admin = createAdminClient();

  // Fetch learners (service role bypasses RLS)
  const { data: learners } = await admin
    .from("profiles")
    .select("*")
    .eq("role", "learner")
    .order("created_at") as { data: Profile[] | null };

  // Build userId → email map from Auth (single call, service role)
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>(
    (authData?.users ?? [])
      .filter((u) => u.email)
      .map((u) => [u.id, u.email as string]),
  );

  // Generate signed URLs for CNO proofs
  const learnersWithUrls = await Promise.all(
    (learners ?? []).map(async (learner) => {
      let signedUrl: string | null = null;
      if (learner.cno_proof_path) {
        const { data } = await admin.storage
          .from("cno-proofs")
          .createSignedUrl(learner.cno_proof_path, 60);
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...learner, signedUrl, email: emailMap.get(learner.id) ?? null };
    }),
  );

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "clamp(2rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <p className="narra-eyebrow" style={{ marginBottom: "0.4rem" }}>
          Admin
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <h1
            className="narra-h"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: "0.6rem" }}
          >
            Learner Management
          </h1>
          <Link
            href="/admin/feedback"
            className="narra-btn ghost"
            style={{ textDecoration: "none" }}
          >
            Feedback Logged →
          </Link>
        </div>
        <hr className="narra-divider" style={{ marginTop: "0.2rem" }} />
      </div>

      {/* Invite section */}
      <section style={{ marginBottom: "3rem" }}>
        <div className="narra-card">
          <h2
            className="narra-h"
            style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}
          >
            Invite a Learner
          </h2>
          <InviteForm />
        </div>
      </section>

      {/* Learners list */}
      <section>
        <h2
          className="narra-h"
          style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}
        >
          Enrolled Learners
          {learnersWithUrls.length > 0 && (
            <span
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: "0.72rem",
                fontWeight: 400,
                letterSpacing: "0.1em",
                color: "var(--ink-faint)",
                marginLeft: "0.75rem",
              }}
            >
              {learnersWithUrls.length}
            </span>
          )}
        </h2>

        {learnersWithUrls.length === 0 ? (
          <div
            className="narra-card"
            style={{ textAlign: "center", padding: "3rem 2rem" }}
          >
            <p
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: "0.82rem",
                color: "var(--ink-faint)",
                letterSpacing: "0.06em",
              }}
            >
              No learners enrolled yet. Use the form above to send the first invite.
            </p>
          </div>
        ) : (
          <div className="narra-card" style={{ padding: "0 clamp(1rem, 3vw, 1.5rem)", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th
                    className="narra-eyebrow"
                    style={{ textAlign: "left", padding: "0.85rem 1rem 0.85rem 0", whiteSpace: "nowrap" }}
                  >
                    Name
                  </th>
                  <th
                    className="narra-eyebrow"
                    style={{ textAlign: "left", padding: "0.85rem 1rem", whiteSpace: "nowrap" }}
                  >
                    Email
                  </th>
                  <th
                    className="narra-eyebrow"
                    style={{ textAlign: "left", padding: "0.85rem 1rem", whiteSpace: "nowrap" }}
                  >
                    CNO Status
                  </th>
                  <th
                    className="narra-eyebrow"
                    style={{ textAlign: "left", padding: "0.85rem 1rem", whiteSpace: "nowrap" }}
                  >
                    Proof
                  </th>
                  <th
                    className="narra-eyebrow"
                    style={{ textAlign: "left", padding: "0.85rem 0 0.85rem 1rem", whiteSpace: "nowrap" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {learnersWithUrls.map((learner) => (
                  <LearnerRow
                    key={learner.id}
                    profileId={learner.id}
                    fullName={learner.full_name ?? ""}
                    email={learner.email}
                    cnoStatus={learner.cno_status}
                    signedProofUrl={learner.signedUrl}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
