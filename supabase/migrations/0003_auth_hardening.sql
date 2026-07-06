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
  using  (bucket_id = 'cno-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cno-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
