-- Enums
create type user_role as enum ('learner', 'admin');
create type cno_status as enum ('pending', 'verified', 'rejected');
create type course_status as enum ('draft', 'published');
create type enrollment_status as enum ('active', 'completed');
create type quiz_scope as enum ('chapter', 'final');
create type question_type as enum ('single', 'multiple');

-- Profiles: one row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'learner',
  cno_registration_number text,
  cno_status cno_status not null default 'pending',
  cno_proof_path text,
  created_at timestamptz not null default now()
);

-- Content
create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  passing_score int not null default 80,
  status course_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  slug text not null,
  title text not null,
  "order" int not null,
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  unique (course_id, slug)
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  scope quiz_scope not null,
  parent_id uuid not null,          -- chapter_id when scope='chapter', course_id when scope='final'
  external_key text not null,       -- stable per-question key for idempotent seeding
  question text not null,
  options jsonb not null,           -- ["A","B","C","D"]
  correct jsonb not null,           -- [index,...] zero-based
  type question_type not null default 'single',
  "order" int not null,
  unique (scope, parent_id, external_key)
);

-- People & access
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_id uuid not null references courses(id) on delete restrict,
  start_date date,
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  cohort_id uuid references cohorts(id) on delete set null,
  status enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (profile_id, course_id)
);

-- Progress & results
create table chapter_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (enrollment_id, chapter_id)
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  quiz_scope quiz_scope not null,
  parent_id uuid not null,
  score numeric(5,2) not null,
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  issued_at timestamptz not null default now(),
  file_path text,
  unique (enrollment_id)
);

create index on chapters (course_id, "order");
create index on quiz_questions (scope, parent_id, "order");
create index on enrollments (profile_id);
create index on enrollments (course_id);
create index on chapter_progress (enrollment_id);
create index on quiz_attempts (enrollment_id);

-- Expose tables to PostgREST roles (required since auto_expose_new_tables is off).
-- anon gets no grants: this app is fully auth-gated. RLS (migration 0002) is the
-- row-level gate for `authenticated`; `service_role` bypasses RLS by design.
grant select, insert, update, delete on
  profiles, courses, chapters, quiz_questions,
  cohorts, enrollments, chapter_progress, quiz_attempts, certificates
  to authenticated, service_role;
