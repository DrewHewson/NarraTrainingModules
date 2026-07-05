# Narra Training — Design Spec

**Date:** 2026-07-05
**Status:** Approved (design phase)

## Overview

Narra Training is a mobile/web training platform (an LMS) for medical aesthetics
services. Margarita, a Nurse Practitioner (NP), is the content authority.
Learners — external practitioners and paying customers — log in and work through
training modules composed of text/image chapters, chapter quizzes, and a final
module test requiring an 80% passing grade.

Payments are handled entirely outside the app. The platform only grants and
tracks access; it never processes money.

## Goals

- Deliver structured, self-paced training modules (courses) to enrolled learners.
- Enforce assessment: a quiz at the end of each chapter and a final module test
  (≥80% to pass).
- Give admins a hub to manage students, cohorts, enrollments, and completion
  status, and to verify CNO (College of Nurses of Ontario) registration proof.
- Author all content in the repo as files (buildable entirely in Claude), seeded
  into the database.

## Non-Goals (v1)

- Payment/checkout flows (explicitly out — access is granted, not sold, in-app).
- Public self-signup (access is admin-provisioned by email invite only).
- Certificate generation (data model stub only; built later).
- In-app content authoring UI (content is file-based and seeded).
- Native iOS/Android apps (responsive web covers mobile and desktop).

## Architecture

**Stack:**
- **Next.js (App Router)** — one responsive codebase for mobile web and desktop,
  deployed to Vercel.
- **Supabase** — Postgres (data), Auth (email invite login), Row-Level Security,
  and Storage (chapter images, CNO proof documents).
- **Tailwind CSS** — responsive UI.
- **Content** — Markdown (chapters) + JSON (quizzes) files in the repo, seeded
  into Postgres via a script.

**Roles:**
- **Learner** — sees only courses they're enrolled in; works through chapters,
  quizzes, and the final test; (later) downloads a certificate.
- **Admin** (Margarita + staff) — accesses the hub; manages students, cohorts,
  enrollments; verifies CNO proof; views progress and pass/fail status. Admins do
  not author content in-app.

**Access control:** Supabase Auth with email-invite onboarding (no public
signup). Row-Level Security ensures learners read only their own
enrollments/progress and the content of courses they're enrolled in. Admin areas
are gated by a role check plus RLS.

## Data Model

All tables in Supabase Postgres.

### Content (seeded from files)

- **`courses`** — a training module/course.
  Fields: `title`, `slug`, `description`, `passing_score` (default 80),
  `status` (draft/published).
- **`chapters`** — belong to a course, ordered.
  Fields: `course_id`, `title`, `slug`, `order`, `body` (Markdown),
  `media` (JSON: image refs; later YouTube URLs).
- **`quiz_questions`** — belong to either a chapter (chapter quiz) or a course
  (final test).
  Fields: `scope` (chapter/final), `parent_id`, `question`, `options` (JSON),
  `correct` (answer key), `type` (single/multiple choice), `order`.

### People & Access

- **`profiles`** — one per auth user.
  Fields: `full_name`, `role` (learner/admin), `cno_registration_number`
  (optional), `cno_status` (pending/verified/rejected), `cno_proof_path`
  (Storage reference).
- **`cohorts`** — a named group (e.g. "Fall 2026 Botox Intake").
  Fields: `name`, `course_id`, `start_date`.
- **`enrollments`** — grants a learner access to a course.
  Fields: `profile_id`, `course_id`, `cohort_id` (nullable),
  `status` (active/completed), `enrolled_at`.

### Progress & Results

- **`chapter_progress`** — a chapter marked complete per learner.
  Fields: `enrollment_id`, `chapter_id`, `completed_at`.
- **`quiz_attempts`** — each quiz/test attempt.
  Fields: `enrollment_id`, `quiz_scope` (chapter/final), `parent_id`, `score`,
  `passed`, `answers` (JSON), `attempted_at`.
- **`certificates`** — **stub only for v1** (schema present, generation later).
  Fields: `enrollment_id`, `issued_at`, `file_path`.

**Key relationships:** A course has many chapters and one final test (its
`quiz_questions` with `scope = final`). A learner is granted a course via an
`enrollment` (optionally tied to a `cohort`). All progress and attempts hang off
the enrollment, so a learner's entire journey through a course is one clean
record set.

**Decisions:**
- **Quiz retakes:** unlimited, each recorded. One final attempt ≥80% completes
  the course.
- **CNO proof** stored in a **private Supabase Storage bucket**; RLS restricts
  viewing to the owning learner and admins.

## Learner Experience

- **Onboarding:** email invite → set password → complete profile (name, CNO
  registration number, upload CNO proof) → dashboard. Access is immediate; CNO
  verification happens **in parallel** (not a gate) and shows "pending."
- **Dashboard:** enrolled course(s) with progress bar and next-up chapter.
- **Course view:** chapter list with completion checkmarks. **Sequential
  unlocking** — complete a chapter and pass its quiz before the next opens.
- **Chapter view:** rendered Markdown + images (YouTube embeds later) → "Mark
  complete" → chapter quiz → must pass to proceed.
- **Final test:** unlocks after all chapters complete; 80% to pass. On pass, the
  course is marked complete (certificate later).

## Admin Hub

- **Access:** admin-only section (role check + RLS), same app.
- **Students:** searchable list. Detail view shows profile, CNO status with a
  viewer for the uploaded proof and **Verify / Reject** actions, enrollments, and
  progress/quiz results.
- **Cohorts:** create (name, course, start date), add/remove learners. Cohort
  view shows each member's progress, final-test status, and CNO status at a
  glance — day-to-day verification and tracking happen here (no separate queue).
- **Enrollments / Invites:** invite a learner by email, assign to a course (and
  optionally a cohort). Sends the Supabase auth invite email. Re-invite/revoke
  supported.
- **Courses:** read-only list of seeded courses with chapter and quiz counts,
  for reference and assignment.

## Content Authoring & Seeding

Repo layout:

```
content/
  courses/
    botox-fundamentals/
      course.json          # title, description, passing_score
      chapters/
        01-introduction.md      # frontmatter (title, order) + Markdown body
        02-anatomy.md
      quizzes/
        01-introduction.json    # chapter quiz questions
        02-anatomy.json
        final-test.json         # final module test
      images/                   # referenced by chapters, uploaded to Storage
```

- **Chapters** — Markdown with frontmatter (`title`, `order`). Images referenced
  by relative path; the seed script uploads them to Storage and rewrites URLs.
- **Quizzes** — JSON arrays of questions, each with `question`, `options`,
  `correct`, and `type` (single/multiple). Extensible to more types later.
- **Seed script** (`npm run seed`) — reads the content tree, upserts
  courses/chapters/quiz_questions into Postgres (idempotent, keyed by slug), and
  syncs images to Storage. Editing content = edit files + re-seed.

## Scope & Phasing

**In scope for v1:**
- Auth + invite-based onboarding; profile with CNO upload.
- Content data model + seed script, with one real seeded course.
- Learner: dashboard, sequential course/chapter view, chapter quizzes, final
  test with 80% grading.
- Admin hub: students, cohorts, enrollments/invites, CNO verify/reject.
- RLS securing all learner/admin boundaries.

**Deferred (designed-for, not built):**
- Certificate generation (table stub only).
- YouTube/mixed-media embeds (media JSON field ready; renderer later).
- Public self-signup, payments (out).
- Additional quiz question types.

## Testing

- **Unit** — grading logic (score calc, 80% pass), seed script parsing/
  idempotency, access helpers.
- **Integration** — RLS policies (learner can't read others' data; non-admin
  can't reach hub), enrollment/progress flows.
- **E2E (key paths)** — invite → onboard → complete chapter → pass final; admin
  verifies CNO.
- Tests written alongside features (TDD where it fits).

## Build Order

1. Schema + RLS
2. Seed script
3. Auth / onboarding (profile + CNO upload)
4. Learner flow (dashboard, chapters, quizzes, final test)
5. Admin hub (students, cohorts, invites, CNO verification)
