# Design — Access & Admin (Phase 2 + first slice of Phase 4)

## Context

Narra Training's content (Module 1) is authored and rendering in the file-based `/preview` harness, but there is **no way to experience it as a student or manage it as an admin** — the app is designed fully auth-gated and admin-provisioned, yet no auth, admin, or learner-entry UI exists. Phase 1 built the data layer (schema, RLS, seed); this is Phase 2 (Auth & Onboarding) plus the first slice of Phase 4 (Admin Hub). Goal: an admin can log in, invite/provision learners, and verify their CNO; a learner can accept an invite, log in, complete onboarding (CNO upload), and reach a dashboard that opens the (auth-gated) content. Only **one course exists for now**, so no multi-course UI.

## Scope

**In:**
- Real Supabase auth (email + password) via `@supabase/ssr`; middleware session refresh + route protection; role from `profiles.role`.
- **Admin:** login → admin area → invite a learner (email) → learner list with CNO status → view proof → verify/reject CNO.
- **Learner:** accept invite (set password) → login → onboarding (upload CNO proof) → dashboard (the one course + a "Start" into the content).
- Local-first infra: run local Supabase, bootstrap one admin, invites via local email (Inbucket/Mailpit).
- Content reader (existing `ChapterView`) becomes reachable **only when authenticated + enrolled**; the `/preview` authoring route stays untouched.

**Out (next pass — the graded learner flow):** chapter quizzes, "mark complete," sequential unlocking, final test (≥80%), certificates. Also out: cohort management UI, admin content authoring, cloud deploy, a chrome-free learner reading view.

## Architecture

- **Supabase clients** (`lib/supabase/`): a browser client (`createBrowserClient`) and a server client (`createServerClient` reading/writing cookies) per `@supabase/ssr` conventions; plus an **admin client** using `SUPABASE_SERVICE_ROLE_KEY` used only in server actions/route handlers for privileged operations (user creation).
- **`middleware.ts`:** refresh the session on every request and gate route groups: unauthenticated → `/login`; authenticated non-admin hitting `/admin/*` → their dashboard; a learner who has **not yet submitted** CNO proof (`cno_proof_path` is null) → `/onboarding`.
  - **Onboarding gate = submission, not verification.** Once a learner has uploaded proof (`cno_status` becomes/stays `pending`), they reach `/dashboard` and can open the content. Admin verification happens **in parallel** and does **not** hard-gate content in this pass (whether to block content until `verified` is a later product decision). CNO status is shown prominently on the dashboard.
- **Route groups (App Router):**
  - `/login` — email+password sign-in (public).
  - `/auth/*` — Supabase callback / set-password (invite acceptance), sign-out.
  - `/onboarding` — learner CNO upload (post-login, pre-dashboard when `cno_status='pending'` and no proof).
  - `/dashboard` — learner home: the one course, CNO status, "Start" → content.
  - `/admin` — admin home: learner list + CNO status; invite form; CNO review/verify.
  - `/learn/[chapter]` (or reuse `/preview/...` gated) — the auth-gated content reader. **Decision:** add a thin `/learn` route that reuses `getChapter` + `ChapterView`, gated by enrollment; keep `/preview` as the ungated authoring view. (A chrome-free learner styling pass is deferred.)
- **Server actions** (mutations, in server components / route handlers):
  - `inviteLearner(email, fullName)` — admin-only; uses the **admin client**: `auth.admin.inviteUserByEmail` (or `createUser`), then inserts `profiles` (role `learner`) + `enrollments` (to the single course). Idempotent on existing email.
  - `submitCnoProof(file, registrationNumber)` — learner; uploads to Storage, sets `cno_proof_path` + `cno_registration_number`, `cno_status` stays `pending`.
  - `setCnoStatus(profileId, 'verified'|'rejected')` — **admin-only** (service role or admin-gated), the only path that changes `cno_status`.

## Data & security

- **Profiles are not auto-created** (no trigger). The invite action explicitly inserts the `profiles` row alongside creating the auth user (both server-side, service role). *(Alternative considered: an `on auth.users` trigger to auto-insert a profile — deferred; explicit insert keeps the role/enrollment decision in one place.)*
- **CNO status must be admin-only.** Current `profiles_self_update` (0002) lets a learner update their own row without restricting `cno_status`, so a learner could self-verify. **Fix (migration `0003`):** tighten `profiles_self_update` so a self-update cannot change `role` **or** `cno_status` (only admins can); learner writes to `cno_proof_path`/`cno_registration_number` only. Belt-and-braces: `setCnoStatus` runs server-side.
- **Storage:** a private bucket `cno-proofs`. Policies (migration `0003` or storage config): a learner may `insert`/`read` objects under their own `{auth.uid()}/…` prefix; admins may `read` all; no public access. Admin proof viewing uses a short-lived signed URL generated server-side.
- **Admin bootstrap:** a `scripts/seed-admin.ts` (service role): create/find an auth user for a configured admin email + password and upsert its `profiles` row with `role='admin'`. Run once locally. Credentials come from env (e.g. `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`), never hardcoded.
- Existing RLS otherwise already supports the flow (self/admin profile reads, admin enrollment writes, enrolled-learner content reads).

## Auth mechanics

- Email + password. Admin invite → Supabase sends a set-password link → local email lands in **Inbucket/Mailpit** (`http://127.0.0.1:54324`) → learner sets password → logs in.
- Local `config.toml [auth]`: ensure `site_url`/`additional_redirect_urls` include `http://localhost:3001`; keep signups admin-only (no public sign-up UI; Supabase `enable_signup` can stay on for the invite API but there is no public signup route).

## Error handling
- Login: invalid credentials → inline error; never reveal which field failed.
- Invite: duplicate email → surface "already invited/enrolled" (no duplicate user); email-send failure → show the set-password link to the admin as fallback (local dev).
- CNO upload: type/size validation; failure keeps the learner on `/onboarding` with a retry.
- Route guards fail **closed** — any auth/role uncertainty routes to `/login`.

## Verification
1. `supabase start`; apply migrations; `npm run seed` (content); `tsx scripts/seed-admin.ts`.
2. Log in as the seeded admin → `/admin` renders the (empty) learner list + invite form.
3. Invite a learner email → Inbucket shows the set-password mail → set password → land on `/onboarding`.
4. Upload a CNO proof → `/dashboard` shows the course with `cno_status: pending`; confirm the learner **cannot** self-set `verified` (RLS/action).
5. Back as admin → see the learner + pending CNO → view proof (signed URL) → verify → learner's dashboard reflects `verified`.
6. Learner "Start" opens the auth-gated content; signing out and hitting `/dashboard` or `/learn` → redirected to `/login`.
7. `npx tsc --noEmit`, `npm run lint`, `npm run test`.

## Out-of-scope follow-ups (tracked, not built here)
Graded learner flow (quizzes/gating/final/cert), cohort management, chrome-free learner reader, cloud deploy for external testers.
