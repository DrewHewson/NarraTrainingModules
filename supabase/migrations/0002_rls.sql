-- Admin check
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Enable RLS everywhere
alter table profiles enable row level security;
alter table courses enable row level security;
alter table chapters enable row level security;
alter table quiz_questions enable row level security;
alter table cohorts enable row level security;
alter table enrollments enable row level security;
alter table chapter_progress enable row level security;
alter table quiz_attempts enable row level security;
alter table certificates enable row level security;

-- profiles: self read/update; admins all
create policy profiles_self_select on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update
  using (id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()))
  );
create policy profiles_admin_write on profiles for insert
  with check (is_admin());

-- courses/chapters: enrolled learners read published; admins all
-- NOTE: courses/chapters/quiz_questions have no learner- or admin-facing write
-- policies by design. Content is file-seeded via the service-role key (bypasses
-- RLS). If an admin authoring UI is added later, add is_admin() write policies then.
create policy courses_read on courses for select
  using (
    is_admin() or (
      status = 'published' and exists (
        select 1 from enrollments e
        where e.course_id = courses.id and e.profile_id = auth.uid()
      )
    )
  );
create policy chapters_read on chapters for select
  using (
    is_admin() or exists (
      select 1 from enrollments e
      join courses co on co.id = e.course_id
      where e.course_id = chapters.course_id
        and e.profile_id = auth.uid()
        and co.status = 'published'
    )
  );

-- quiz_questions: ADMIN ONLY on the base table (contains the answer key).
-- Learners never touch this table directly; they read quiz_questions_public.
create policy quiz_questions_admin_only on quiz_questions for select
  using (is_admin());

-- cohorts: admin only
create policy cohorts_admin on cohorts for all
  using (is_admin()) with check (is_admin());

-- enrollments: learner reads own; admin all
create policy enrollments_read on enrollments for select
  using (profile_id = auth.uid() or is_admin());
create policy enrollments_admin_write on enrollments for all
  using (is_admin()) with check (is_admin());

-- chapter_progress: learner manages own via their enrollment
create policy progress_own on chapter_progress for all
  using (
    is_admin() or exists (
      select 1 from enrollments e
      where e.id = chapter_progress.enrollment_id and e.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from enrollments e
      where e.id = chapter_progress.enrollment_id and e.profile_id = auth.uid()
    )
  );

-- quiz_attempts: learner reads own; inserts happen server-side (service role) so no learner insert policy
create policy attempts_read_own on quiz_attempts for select
  using (
    is_admin() or exists (
      select 1 from enrollments e
      where e.id = quiz_attempts.enrollment_id and e.profile_id = auth.uid()
    )
  );

-- certificates: learner reads own; admin all
create policy certificates_read on certificates for select
  using (
    is_admin() or exists (
      select 1 from enrollments e
      where e.id = certificates.enrollment_id and e.profile_id = auth.uid()
    )
  );

-- Answer-hiding view for learner-facing question reads.
-- security_invoker = false: the view runs with its owner's rights and BYPASSES
-- the admin-only RLS on quiz_questions. The answer key column `correct` is simply
-- not selected, so it can never reach a learner. Row visibility is enforced by the
-- WHERE clause below (enrollment check), NOT by base-table RLS.
create view quiz_questions_public
with (security_invoker = false, security_barrier = true)
as
  select q.id, q.scope, q.parent_id, q.question, q.options, q.type, q."order"
  from quiz_questions q
  where
    is_admin()
    or (q.scope = 'chapter' and exists (
      select 1 from chapters c
      join enrollments e on e.course_id = c.course_id
      where c.id = q.parent_id and e.profile_id = auth.uid()
    ))
    or (q.scope = 'final' and exists (
      select 1 from enrollments e
      where e.course_id = q.parent_id and e.profile_id = auth.uid()
    ));

grant select on quiz_questions_public to authenticated;
