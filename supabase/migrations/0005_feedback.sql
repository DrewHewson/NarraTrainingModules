-- Reviewer feedback: context-anchored notes left by a signed-in reviewer as they
-- go through the site. Test-site-only in the UI (gated by NEXT_PUBLIC_TEST_MODE),
-- but the data model + RLS stand on their own.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references profiles(id) on delete cascade,
  path text not null,            -- URL path where the note was left
  chapter_slug text,             -- chapter slug (if on /learn/<slug>)
  section_id text,               -- URL-hash anchor of the focused section, or 'chapter-quiz'
  section_label text,            -- human-readable section title (best-effort)
  category text not null,        -- content | typo | question | ux | general
  comment text not null,
  status text not null default 'open',   -- open | resolved
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- A reviewer may create their own notes.
create policy feedback_insert on feedback for insert to authenticated
  with check (reviewer_id = auth.uid());

-- A reviewer reads their own notes; admins read everyone's.
create policy feedback_read on feedback for select
  using (reviewer_id = auth.uid() or is_admin());

-- Only admins change status (resolve / reopen).
create policy feedback_admin_update on feedback for update
  using (is_admin())
  with check (is_admin());

-- Expose to PostgREST roles (auto_expose_new_tables is off); RLS above is the gate.
grant select, insert, update, delete on feedback to authenticated, service_role;
