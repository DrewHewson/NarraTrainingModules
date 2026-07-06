# Access & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real Supabase auth so an admin can log in, invite/provision learners, and verify their CNO; and a learner can accept an invite, log in, upload CNO proof, and reach a dashboard that opens the auth-gated content.

**Architecture:** Next.js 16 App Router + `@supabase/ssr` (cookie-based sessions). A `middleware.ts` refreshes the session and gates route groups by auth + `profiles.role`. Privileged operations (create user, set CNO status) run in server actions using a service-role admin client. RLS (migration 0002) already enforces row access; migration 0003 closes a self-update gap and adds a private Storage bucket for CNO proofs.

**Tech Stack:** Next 16 (App Router, Turbopack), React 19, `@supabase/ssr` ^0.12, `@supabase/supabase-js` ^2.110, local Supabase (Docker), TypeScript, Tailwind v4, Vitest.

## Global Constraints
- **This is a modified Next.js** — per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/01-app/` before writing route/middleware code. `params`/`cookies()` are async and must be awaited.
- **One course only.** No course picker; invites/enrolments target the single seeded course. A helper resolves it.
- **Fully auth-gated, admin-provisioned, no public signup.** No public sign-up route.
- **Never hardcode credentials.** Admin seed + any secrets come from env.
- **Secrets stay server-side.** `SUPABASE_SERVICE_ROLE_KEY` is used ONLY in server actions / route handlers / scripts — never imported into a client component.
- **Do not touch** `/preview`, `lib/preview-content.ts`, `lib/content.ts`, or the seed pipeline. This work is additive.
- Dev server runs on **:3001** (3000 is taken). Local Supabase email UI (Mailpit/Inbucket) at the port shown by `supabase status`.
- Git: start on a feature branch (repo default is `main`); commit per task.
- **Design system (ALL new UI — Tasks 5–8).** Match the established Narra editorial aesthetic, do NOT inherit the default create-next-app root styling. Read `app/preview/preview.css` + `app/preview/layout.tsx` for the vocabulary and REUSE it: fonts Fraunces (`--font-display`) + Newsreader (`--font-body`) + Geist sans for uppercase eyebrows/labels; palette tokens `--paper #f6f1e8`, `--paper-lift #fcf9f3`, `--panel #efe7d9`, `--ink #221f18`, `--ink-soft #6a6153`, `--ink-faint #928979`, `--clay #9a6a46`, `--clay-deep #7c5335`, `--taupe #c9beac`, `--line rgba(34,31,24,.13)`; the "The Narra Training" wordmark lockup; generous whitespace, thin 1px rules, clay as the single accent, uppercase letter-spaced eyebrows/labels. Task 5 establishes a shared `.narra-*` foundation (tokens + reusable `field/label/input/btn/card/badge/alert` classes + auth & app layouts); Tasks 6–8 reuse it — no new palettes or fonts. Never hardcode secrets in client components.

## File Structure
- `lib/supabase/client.ts` — browser Supabase client (`createBrowserClient`).
- `lib/supabase/server.ts` — server Supabase client (`createServerClient` + async cookies).
- `lib/supabase/admin.ts` — service-role client (server-only).
- `lib/supabase/proxy.ts` — `updateSession()` used by the root proxy (Next 16 renamed Middleware → Proxy).
- `lib/auth.ts` — helpers: `getSessionProfile()`, `requireAdmin()`, `singleCourse()`, `COURSE_SLUG`.
- `proxy.ts` (repo root) — session refresh + route protection (Next 16 replacement for `middleware.ts`).
- `supabase/migrations/0003_auth_hardening.sql` — tighten `profiles_self_update`; create `cno-proofs` bucket + storage policies.
- `scripts/seed-admin.ts` — bootstrap one admin account (service role).
- `app/narra.css` — shared Narra design tokens + reusable `.narra-*` component classes (Task 5; reused by 6–8).
- `app/layout.tsx` (modify) — wire Fraunces + Newsreader fonts at the root.
- `app/(auth)/layout.tsx` — centered auth-card shell (login/set-password).
- `app/(auth)/login/page.tsx` + `app/(auth)/login/LoginForm.tsx` + `app/(auth)/login/actions.ts` — email+password sign-in.
- `app/auth/set-password/page.tsx` — invite acceptance (set password).
- `app/auth/sign-out/route.ts` — sign out.
- `app/admin/page.tsx` + `app/admin/actions.ts` + `app/admin/_components/*` — learner list, invite form, CNO review/verify.
- `app/onboarding/page.tsx` + `app/onboarding/actions.ts` — CNO proof upload.
- `app/dashboard/page.tsx` — learner home (course + CNO status + Start).
- `app/learn/[chapter]/page.tsx` — auth-gated content reader (reuses `getChapter` + `ChapterView`).
- `app/(app)/layout.tsx` or shared nav — minimal signed-in shell (optional, small).
- Tests: `tests/auth-hardening.test.ts` (RLS/storage guards), `tests/auth-helpers.test.ts` (`singleCourse`).

---

### Task 1: Supabase clients + local stack up

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`

**Interfaces:**
- Produces: `createClient()` (browser) from `client.ts`; `createClient()` (async, server) from `server.ts`; `createAdminClient()` from `admin.ts`.

- [ ] **Step 1: Start local Supabase & capture ports**

```bash
cd ~/narra-training && supabase start
supabase status   # note API URL (54321), Studio, and Mailpit/Inbucket URL
```
Expected: services healthy; `.env.local` values already match `http://127.0.0.1:54321` + local anon/service keys (confirm; if not, copy from `supabase status`).

- [ ] **Step 2: Browser client** — `lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Server client** — `lib/supabase/server.ts` (cookies() is async in Next 16)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore; middleware refreshes
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Admin (service-role) client** — `lib/supabase/admin.ts`

```ts
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc --noEmit && git add lib/supabase && git commit -m "feat(auth): add supabase browser/server/admin clients"
```

---

### Task 2: Migration 0003 — RLS hardening + CNO storage bucket

**Files:**
- Create: `supabase/migrations/0003_auth_hardening.sql`
- Test: `tests/auth-hardening.test.ts`

**Interfaces:**
- Produces: private bucket `cno-proofs`; tightened `profiles_self_update` (self cannot change `role` or `cno_status`).

- [ ] **Step 1: Write the migration** — `supabase/migrations/0003_auth_hardening.sql`

```sql
-- Tighten self-update: a learner may edit their own profile but may NOT change
-- their role OR their cno_status. Only admins change those. (Fixes 0002 gap.)
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using (id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (
      id = auth.uid()
      and role = (select p.role from profiles p where p.id = auth.uid())
      and cno_status = (select p.cno_status from profiles p where p.id = auth.uid())
    )
  );

-- Private bucket for CNO registration proof
insert into storage.buckets (id, name, public)
values ('cno-proofs', 'cno-proofs', false)
on conflict (id) do nothing;

-- Storage policies: a learner reads/writes objects under their own {uid}/ prefix;
-- admins read all. Path convention: '<profile_id>/<filename>'.
create policy cno_learner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cno-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy cno_learner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'cno-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
create policy cno_learner_update on storage.objects for update to authenticated
  using (bucket_id = 'cno-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Apply & write the guard test** — `tests/auth-hardening.test.ts`

Reset DB to apply, then a Vitest that (a) creates a learner profile via service role, (b) uses an anon client signed in as that learner to attempt `update profiles set cno_status='verified'`, and asserts the row is unchanged (RLS blocks it). Mirror the existing `tests/rls.test.ts` setup for signing in a test user.

```bash
npm run db:reset      # applies 0001,0002,0003 + config
```
```ts
// tests/auth-hardening.test.ts (shape — follow tests/rls.test.ts helpers)
import { describe, it, expect } from "vitest";
// helpers from existing rls test: admin client + a signed-in learner client
it("learner cannot self-verify CNO", async () => {
  const learner = await makeLearner(); // service-role: auth user + profile(role=learner, cno_status=pending)
  const asLearner = await signInAs(learner.email, learner.password);
  await asLearner.from("profiles").update({ cno_status: "verified" }).eq("id", learner.id);
  const { data } = await admin.from("profiles").select("cno_status").eq("id", learner.id).single();
  expect(data!.cno_status).toBe("pending");
});
```

- [ ] **Step 3: Run test**

Run: `npm run test -- tests/auth-hardening.test.ts` (local Supabase must be running)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_auth_hardening.sql tests/auth-hardening.test.ts
git commit -m "feat(auth): migration 0003 — cno_status admin-only + cno-proofs storage"
```

---

### Task 3: Seed one admin

**Files:**
- Create: `scripts/seed-admin.ts`; add `"seed:admin"` to `package.json` scripts.

**Interfaces:**
- Consumes: service-role client (created inline, NOT `lib/supabase/admin.ts`).
- Produces: an auth user (email-confirmed) + `profiles` row with `role='admin'`.

- [ ] **Step 1: Write the script** — `scripts/seed-admin.ts`

> NOTE: do NOT import `lib/supabase/admin.ts` here — it carries `import "server-only"`, which throws under `tsx`/node. Create a service-role client inline, exactly like `scripts/seed.ts` does, and load env with the same `dotenv` `config({ path: ".env.local", quiet: true })` pattern.

```ts
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
```

- [ ] **Step 2: Add env + script, run it**

Add to `.env.local`: `SEED_ADMIN_EMAIL=admin@narra.test` and `SEED_ADMIN_PASSWORD=<choose>`.
Add to `package.json` scripts: `"seed:admin": "tsx scripts/seed-admin.ts"`.
Run: `npm run seed && npm run seed:admin`
Expected: content seeded + "Admin ready: admin@narra.test".

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-admin.ts package.json && git commit -m "feat(auth): seed-admin bootstrap script"
```

---

### Task 4: Auth helpers + middleware (session refresh + route guards)

**Files:**
- Create: `lib/auth.ts`, `lib/supabase/proxy.ts`, `proxy.ts` (root)
- Test: `tests/auth-helpers.test.ts`

> **Next 16 rename:** Middleware is now **Proxy**. The root file is `proxy.ts` exporting `export function proxy(request: NextRequest)` (async allowed), with the same `export const config = { matcher }`. There is NO `middleware.ts` in Next 16. Read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `.../03-api-reference/03-file-conventions/proxy.md` before writing it.

**Interfaces:**
- Produces: `COURSE_SLUG` (const); `getSessionProfile()` → `{ user, profile } | null`; `requireAdmin()`; `singleCourse()` → the target course row; `updateSession(req)` → `NextResponse`.

- [ ] **Step 1: `COURSE_SLUG` + `singleCourse()` + a unit test**

> DATA NOTE: the seeded DB contains TWO courses — the real `neuromodulators-botulinum-toxin` (now `status='published'`) and a tiny `sample-intro` fixture (also `status='published'`) used only to validate seeding. So `singleCourse()` must target the real course by a named constant slug (NOT by status, and NOT "the only row"). This is deterministic and unambiguous.
>
> TESTABILITY: `singleCourse()` uses the Next server client, whose `await cookies()` cannot run inside a plain vitest test. Do NOT try to call `singleCourse()` directly in the test. Instead, the test asserts the **constant↔seed alignment** — the real risk (a typo'd slug or missing seed): query the seeded DB with a service-role `@supabase/supabase-js` client (as `tests/rls.test.ts` does) — `from("courses").select("slug").eq("slug", COURSE_SLUG).single()` — and assert it returns a row whose `slug === COURSE_SLUG`. The RLS-gated learner reachability of this course is verified end-to-end in Task 9.

`lib/auth.ts` exports `export const COURSE_SLUG = "neuromodulators-botulinum-toxin";` and `singleCourse()` which fetches that specific course via the server client (`.eq("slug", COURSE_SLUG).single()`) and throws a clear error if it is missing. Add the constant-alignment test described above in `tests/auth-helpers.test.ts`. Run `npm run test -- tests/auth-helpers.test.ts` → PASS. (Do not remove or alter the `sample-intro` fixture — seed/schema tests depend on it.)

- [ ] **Step 2: `getSessionProfile()` / `requireAdmin()`** in `lib/auth.ts`

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getSessionProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  return { user, profile };
}

export async function requireAdmin() {
  const s = await getSessionProfile();
  if (!s?.profile) redirect("/login");
  if (s.profile.role !== "admin") redirect("/dashboard");
  return s;
}
```

- [ ] **Step 3: `updateSession`** — `lib/supabase/proxy.ts` (standard @supabase/ssr cookie-refresh pattern, adapted to Next 16 Proxy; read the @supabase/ssr server-side-auth docs conceptually + the Next 16 proxy docs named above). Create a server client bound to the incoming request + a `NextResponse`, mirror cookies via `getAll`/`setAll` onto both request and response, call `await supabase.auth.getUser()` to refresh, and return the response. Include route protection: if there is no user and the path starts with a protected prefix (`/admin`,`/dashboard`,`/onboarding`,`/learn`) → return a redirect to `/login`; otherwise return the refreshed response. Do NOT do role/onboarding branching here — that lives in the pages via `requireAdmin()`/`getSessionProfile()` (the Next 16 proxy docs explicitly say Proxy is for optimistic checks, not full authorization). Fail closed. IMPORTANT: return the SAME response object whose cookies were set (don't construct a fresh `NextResponse` after `setAll`, or the refreshed session cookie is lost).

- [ ] **Step 4: Root `proxy.ts`** (NOT `middleware.ts` — Next 16)

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.svg$).*)"],
};
```

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint && git add lib/auth.ts lib/supabase/proxy.ts proxy.ts tests/auth-helpers.test.ts && git commit -m "feat(auth): proxy session guard + auth helpers"
```

---

### Task 5: Narra design foundation + login + set-password + sign-out

**Files:**
- Create: `app/narra.css` (shared tokens + `.narra-*` component classes), `app/(auth)/layout.tsx` (centered auth card shell), `app/(auth)/login/page.tsx`, `app/(auth)/login/LoginForm.tsx` (client), `app/(auth)/login/actions.ts`, `app/auth/set-password/page.tsx`, `app/auth/sign-out/route.ts`
- Modify: `app/layout.tsx` (wire Fraunces + Newsreader fonts at the root; keep it minimal so every route inherits the font vars), `app/globals.css` if needed (only to import `narra.css`; do not fight the reset).

**Interfaces:**
- Produces: the shared `.narra-*` design layer (reused by Tasks 6–8); a working sign-in that lands admin on `/admin`, learner on `/dashboard`; `signOut` route; `SetPasswordForm`.
- Consumes: `createClient` (browser + server), `getSessionProfile`.

> **Design foundation first.** Read `app/preview/preview.css` + `app/preview/layout.tsx`. Create `app/narra.css` defining a `.narra-root` (or `:root`-scoped) token block with the exact palette from Global Constraints, and reusable classes: `.narra-eyebrow` (uppercase Geist, letter-spaced, `--ink-faint`), `.narra-h` (Fraunces display), `.narra-card` (paper-lift panel, thin `--line` border, soft shadow, generous padding), `.narra-field`/`.narra-label`/`.narra-input` (label above input, `--line` border, focus ring in `--clay`), `.narra-btn` (primary = `--clay` bg / paper text) and `.narra-btn.ghost`, `.narra-alert` (error, warm red-clay), and status badges `.narra-badge.is-pending|is-verified|is-rejected`. Wire fonts in `app/layout.tsx` via `next/font` (Fraunces `--font-display`, Newsreader `--font-body`) — the Geist vars already exist. This layer must look like it belongs to the same product as `/preview`.

> **Next 16 notes (read the docs):** route handlers → `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (sign-out is a `POST` handler); server actions are `"use server"`; client form uses `useActionState` (React 19). `cookies()` is async.

- [ ] **Step 1: Design foundation** — create `app/narra.css`, wire fonts in `app/layout.tsx`, add `app/(auth)/layout.tsx` (centered single-column card on `--paper`, the "The Narra Training" wordmark at top). Verify visually before adding forms.

- [ ] **Step 2: Login server action** — `app/(auth)/login/actions.ts`

`"use server"`; `login(prevState, formData)`: read email/password → server `createClient()` → `supabase.auth.signInWithPassword` → on error `return { error: "Incorrect email or password." }` (never reveal which field). On success read the profile role and `redirect(role === "admin" ? "/admin" : "/dashboard")`. (`redirect` throws — don't wrap it in try/catch.)

- [ ] **Step 3: Login page + form** — `app/(auth)/login/page.tsx` (server: if `getSessionProfile()` already has a session → redirect admin→`/admin`, else `/dashboard`) rendering `LoginForm.tsx` (`"use client"`, `useActionState(login, null)`, email+password `.narra-input`, `.narra-btn` submit with pending state, inline `.narra-alert` on error).

- [ ] **Step 4: Set-password page** — `app/auth/set-password/page.tsx` + a `"use client"` form. Invite acceptance: Supabase sends the invite link which establishes a session on landing (via the ssr client detecting the token in the URL / `onAuthStateChange`); the form calls browser `supabase.auth.updateUser({ password })`, then `router.push("/onboarding")`. Handle the no-session/expired-link case with a `.narra-alert` telling the user to ask the admin to re-invite.

- [ ] **Step 5: Sign-out** — `app/auth/sign-out/route.ts`: `POST` handler → server `createClient()` → `await supabase.auth.signOut()` → `NextResponse.redirect(new URL("/login", request.url))`.

- [ ] **Step 6: Verify + commit**

`npx tsc --noEmit && npm run lint`. Run dev on **:3001** (`PORT=3001 npm run dev` or `npm run dev -- -p 3001`), sign in as `admin@narra.test` / the seeded dev password → lands on `/admin` (placeholder is fine this task). Take a headless-Chrome screenshot of `/login` and read it back to confirm it is on-brand (Fraunces heading, clay button, ivory paper). Sign-out returns to `/login`.
```bash
git add app/narra.css app/layout.tsx "app/(auth)" app/auth && git commit -m "feat(auth): narra design foundation + login, set-password, sign-out"
```
(If `app/globals.css` was touched to import narra.css, add it too. Do NOT `git add -A`.)

---

### Task 6: Signed-in app shell + Admin (invite learner, list, verify CNO)

**Files:**
- Create: `app/(app)/layout.tsx` (shared signed-in shell — reused by Tasks 7–8), `app/(app)/app.css` (or extend `narra.css`) for shell styles, `app/(app)/admin/page.tsx`, `app/(app)/admin/actions.ts`, `app/(app)/admin/_components/InviteForm.tsx`, `app/(app)/admin/_components/LearnerRow.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `createAdminClient`, `singleCourse`, `getSessionProfile`.
- Produces: the `(app)` shell layout; `inviteLearner(prevState, formData)`, `setCnoStatus(profileId, status)` server actions.

> **Signed-in app shell (do this first).** Create `app/(app)/layout.tsx` — a **58px** sticky topbar (height matches the preview's `.np-topbar`, so `ChapterView`'s `calc(100dvh - 58px)` panes line up in Task 8) with the "The Narra Training" wordmark (reuse the `.narra-wordmark*` classes) on the left and a **sign-out** control on the right (a `<form action="/auth/sign-out" method="post">` with a `.narra-btn.ghost` submit — real POST, no JS needed), on `--paper`. Admin/dashboard/onboarding live UNDER this `(app)` group (URLs stay `/admin`, `/dashboard`, etc. — route groups don't affect the path). `/learn` is the exception — it gets its OWN reader layout in Task 8 (it needs the preview's `.np-root`/`.np-*` styling context, not this shell). The shell itself does not gate; each page calls `requireAdmin()`/`getSessionProfile()`. Keep it lean and on-brand.

> **Schema facts (verified):** `profiles(full_name, role, cno_status ['pending'|'verified'|'rejected'], cno_registration_number, cno_proof_path)`; `enrollments(profile_id, course_id, status enrollment_status ['active'|'completed'], unique(profile_id, course_id))` → upsert `onConflict: "profile_id,course_id"` with `status: "active"`. `createAdminClient()` (service role) bypasses RLS — correct for these admin writes. Add `NEXT_PUBLIC_SITE_URL=http://localhost:3001` to `.env.local` (used for the invite `redirectTo`). `findUserIdByEmail`: `const { data } = await admin.auth.admin.listUsers(); return data.users.find(u => u.email === email)?.id` (local list is small; pagination not needed).

- [ ] **Step 1: `inviteLearner` server action** — `app/(app)/admin/actions.ts`

`"use server"`; `requireAdmin()` first. Then admin client:
```ts
const admin = createAdminClient();
const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`,
});
// if user exists, inviteUserByEmail errors → treat as "already invited"
const userId = data?.user?.id ?? (await findUserIdByEmail(admin, email));
await admin.from("profiles").upsert({ id: userId, full_name, role: "learner" }, { onConflict: "id" });
const course = await singleCourse();
await admin.from("enrollments").upsert(
  { profile_id: userId, course_id: course.id, status: "active" },
  { onConflict: "profile_id,course_id" },
);
```
Add `NEXT_PUBLIC_SITE_URL=http://localhost:3001` to `.env.local`. Handle duplicate gracefully (return a friendly message + still ensure profile/enrolment exist).

- [ ] **Step 2: `setCnoStatus` server action**

`requireAdmin()`; admin client updates `profiles.cno_status` to `'verified'|'rejected'` for the given `profileId`. (Service role → bypasses the self-update restriction by design.) `revalidatePath('/admin')`.

- [ ] **Step 3: Admin page** — `app/(app)/admin/page.tsx`

`await requireAdmin()`. Query learners with the admin (service-role) client: `profiles` where `role='learner'` (+ optionally join enrollment for a simple status). Render on-brand with `.narra-*`: header + `<InviteForm>` + a table/list of `<LearnerRow>` (name, email, `.narra-badge` CNO status, "View proof" only when `cno_proof_path` is set → a signed URL via `admin.storage.from('cno-proofs').createSignedUrl(cno_proof_path, 60)` generated server-side, Verify / Reject buttons wired to `setCnoStatus`). Show an empty-state when there are no learners yet.

- [ ] **Step 4: Components** — `InviteForm.tsx` (`"use client"`, `useActionState(inviteLearner, null)`, email + full-name `.narra-input`, `.narra-btn`, shows success/error incl. the "already invited/enrolled" friendly message), `LearnerRow.tsx` (`"use client"`, Verify/Reject buttons calling `setCnoStatus`; disable while pending).

- [ ] **Step 5: Manual verify + commit**

Sign in as `admin@narra.test` (dev server on :3001, likely already running). Invite `learner1@narra.test`; confirm the invite email appears in **Mailpit** (`http://127.0.0.1:54324`); verify a `profiles` (role=learner) + `enrollments` (course = `singleCourse()`) row exist via the service-role client. Screenshot `/admin` and read it back for on-brand layout.
```bash
git add "app/(app)" && git commit -m "feat(admin): signed-in shell + invite learner, learner list, CNO verify"
```
(Also `git add .env.local`? NO — it is gitignored; just ensure `NEXT_PUBLIC_SITE_URL` is present locally.)

---

### Task 7: Learner — onboarding (CNO upload) + dashboard

**Files:**
- Create: `app/onboarding/page.tsx`, `app/onboarding/actions.ts`, `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getSessionProfile`, server client, `singleCourse`.
- Produces: `submitCnoProof(formData)` server action.

**Files:** `app/(app)/onboarding/page.tsx`, `app/(app)/onboarding/actions.ts`, `app/(app)/onboarding/OnboardingForm.tsx` (client), `app/(app)/dashboard/page.tsx`. All under the `(app)` shell from Task 6 (topbar + sign-out). Reuse `.narra-*`.

- [ ] **Step 1: `submitCnoProof`** — `app/(app)/onboarding/actions.ts`

`"use server"`; `getSessionProfile()` (→ `/login` if none); read the `File` from FormData; validate type (pdf/jpg/png) + size (≤ ~10MB) and return `{ error }` on failure. Upload to `cno-proofs` at path `${user.id}/proof.<ext>` via the **server client** (the learner's own session → RLS `cno_learner_insert` permits their own prefix), `upsert: true` so re-submission overwrites. Then `update profiles set cno_proof_path=<path>, cno_registration_number=<num>` for `id = user.id` (status stays `pending` — a learner cannot change it anyway per migration 0003). `redirect('/dashboard')` (outside try/catch).

- [ ] **Step 2: Onboarding page** — `app/(app)/onboarding/page.tsx` + `OnboardingForm.tsx`

Server page: `getSessionProfile()`; no session → `/login`; if `profile?.cno_proof_path` already set → `redirect('/dashboard')`. Render the "why we need this" copy (CNO verification for RN/RPN practice) + `OnboardingForm` (`"use client"`, `useActionState(submitCnoProof, null)`, CNO number `.narra-input` + a file input, `.narra-btn`, inline `.narra-alert` on validation error, pending state).

- [ ] **Step 3: Dashboard** — `app/(app)/dashboard/page.tsx`

`getSessionProfile()`; none → `/login`; a learner (`role==='learner'`) with no `cno_proof_path` → `redirect('/onboarding')`. Show: greeting (`full_name`), a `.narra-card` course card for `singleCourse()` (title + description), a prominent **CNO status** `.narra-badge` (pending/verified/rejected with a short explanation line), and a "Start / Continue" `.narra-btn` linking to `/learn/${getCourse(COURSE_SLUG)!.chapters[0].slug}` (first chapter). An admin visiting `/dashboard` is allowed (show the same course card without the onboarding redirect). Content is NOT hard-gated on `verified` this pass — pending learners can Start; the badge just communicates status.

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit && npm run lint && npm run test`. E2E (invite→set-password→onboarding→upload→dashboard) is exercised in Task 9; for this task, verify the guards/redirects with `curl` (unauth `/onboarding`/`/dashboard` → `/login`) and confirm the pages render structurally. Screenshot deferred to Task 9.
```bash
git add "app/(app)" && git commit -m "feat(learner): CNO onboarding + dashboard"
```

---

### Task 8: Auth-gated content reader (`/learn`)

**Files:**
- Modify: `app/preview/_components/ChapterView.tsx` (add an optional serializable `linkBase` prop — see below; this is a shared component, keep the preview behavior as the default so `app/preview` is unchanged).
- Create: `app/learn/layout.tsx` (its OWN reader layout — NOT under the `(app)` group), `app/learn/[chapter]/page.tsx`.

**Interfaces:**
- Consumes: `getSessionProfile`, `singleCourse`, `getCourse`/`getChapter` (from `lib/preview-content.ts`), `ChapterView`, the server client.

> **Why its own layout, not the `(app)` shell:** `ChapterView` renders `.np-shell` and relies on the `.np-root` CSS-var wrapper + `.np-*` styles from `app/preview/preview.css`, which are loaded by `app/preview/layout.tsx` — NOT by the `(app)` shell. So `/learn` needs a layout that mirrors `app/preview/layout.tsx`: wire Fraunces + Newsreader, `import "@/app/preview/preview.css"`, wrap children in `<div className="…np-root">`, and render an `.np-topbar` (58px) with the "The Narra Training" wordmark on the left and a **sign-out** `<form action="/auth/sign-out" method="post">` on the right (replace the preview's "content under review" pill). Result: the learner gets the same immersive two-pane reader as `/preview`, but gated and with sign-out.

> **`linkBase` prop on `ChapterView`:** it currently hardcodes `/preview/${course.slug}` in the sidebar chapter `<Link href>` and in `onPrev`/`onNext` `router.push`. Add a prop `linkBase?: string` and build chapter links as `` `${linkBase}/${slug}` ``, defaulting `linkBase` to `` `/preview/${course.slug}` `` so the preview page needs no change. (Must be a string, not a function — `ChapterView` is a client component and function props aren't serializable.) The `/learn` page passes `linkBase="/learn"` → links become `/learn/${chapterSlug}` (single-course, no course segment).

- [ ] **Step 1: Add `linkBase` to `ChapterView`** — the optional prop + default described above; verify `/preview/...` still navigates correctly (default unchanged).

- [ ] **Step 2: `/learn` layout** — `app/learn/layout.tsx` mirroring `app/preview/layout.tsx` (fonts + `preview.css` + `.np-root` + `.np-topbar` with wordmark + POST sign-out).

- [ ] **Step 3: The gated reader page** — `app/learn/[chapter]/page.tsx`

`await` params → `chapterSlug`. `getSessionProfile()` → none → `/login`. Confirm access: `requireAdmin`-style — either the profile is admin, OR an `enrollments` row exists for `(profile.id, singleCourse().id)`; else `redirect('/dashboard')`. Then, with `courseSlug = COURSE_SLUG`: `getCourse(courseSlug)`, `getChapter(courseSlug, chapterSlug)` → `notFound()` if missing; compute prev/next from `course.chapters` (exactly as the preview page does); render `<ChapterView … linkBase="/learn" />`.

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit && npm run lint && npm run test`. Confirm `/preview/<course>/<chapter>` still renders + navigates (default `linkBase` intact). Unauth `/learn/<chapter>` → `/login` (proxy). Authenticated E2E (Start → reader) is exercised in Task 9. Screenshot `/learn/<firstChapter>` (you can reach it once signed in) and read it back for the two-pane reader.
```bash
git add app/preview/_components/ChapterView.tsx app/learn && git commit -m "feat(learner): auth-gated content reader at /learn"
```
(Note: `ChapterView.tsx` is part of the uncommitted preview work; committing the modified file here is fine — the rest of the preview pile stays uncommitted. Do NOT `git add -A`.)

---

### Task 9: End-to-end verification + polish

- [ ] **Step 1: Full walkthrough** (dev on :3001):
  1. `/login` as admin → `/admin`.
  2. Invite `learner2@narra.test` → Mailpit → set-password → `/onboarding`.
  3. Upload CNO proof → `/dashboard` (pending) → Start → `/learn` reads content.
  4. Admin verifies CNO → learner dashboard shows verified.
  5. Sign out → protected routes bounce to `/login`.
  6. Confirm a learner **cannot** reach `/admin` (redirected) and **cannot** self-verify (Task 2 test).
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint && npm run test`
- [ ] **Step 3:** Headless-Chrome screenshots of `/login`, `/admin`, `/onboarding`, `/dashboard`; read back for on-brand styling.
- [ ] **Step 4: Commit** any polish.

---

## Self-Review

**Spec coverage:** login (T5) ✓ · admin invite/list/verify (T6) ✓ · learner onboarding+dashboard (T7) ✓ · auth-gated content (T8) ✓ · middleware/route-protection (T4) ✓ · Supabase SSR clients (T1) ✓ · RLS cno_status fix + storage bucket (T2) ✓ · admin bootstrap (T3) ✓ · `/preview` untouched (constraint) ✓ · verification flow (T9) ✓. Out-of-scope items (quizzes/gating/final/cert, cohorts, chrome-free reader, cloud) are intentionally not tasked.

**Placeholder scan:** UI pages describe exact actions/redirects/queries rather than full JSX (auth UI is integration-verified, not unit-tested) — intentional and specific, not "TODO". No `TBD`/"add error handling" hand-waves; error handling is named per action (login inline error, invite duplicate, upload validation, fail-closed guards).

**Type consistency:** `createClient` (browser+server), `createAdminClient`, `getSessionProfile`/`requireAdmin`/`singleCourse`, `inviteLearner`/`setCnoStatus`/`submitCnoProof` used consistently across tasks; path convention `cno-proofs/<uid>/<file>` matches the storage policy in T2.

**Note on TDD:** DB/RLS guard (T2) and the `singleCourse` helper (T4) are test-first. Auth/SSR/UI flows are verified by running the end-to-end walkthrough (T9) + tsc/lint, since they depend on live Supabase sessions and cookies rather than unit-mockable logic — called out honestly rather than faking unit tests.
