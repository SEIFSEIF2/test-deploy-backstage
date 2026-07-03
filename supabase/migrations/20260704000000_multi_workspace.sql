-- Multi-workspace accounts: decouple the auth account (user_id) from the
-- membership row (id). team_members.id stays the PK every FK references
-- (tasks.assignee_id, poll_votes.member_id, push_subscriptions.member_id,
-- companies.owner_id); existing rows keep id == user_id, new memberships
-- get their own id. RLS policies that pinned team_members.id = auth.uid()
-- are rewritten in the same migration so realtime reads never break.

-- 1. Column + backfill + constraints
alter table public.team_members add column if not exists user_id uuid;
update public.team_members set user_id = id where user_id is null;
alter table public.team_members alter column user_id set not null;
alter table public.team_members alter column id set default gen_random_uuid();
create unique index if not exists team_members_user_company_uidx
  on public.team_members (user_id, company_id);
create index if not exists team_members_user_id_idx
  on public.team_members (user_id);

-- 2. RLS rewrites (id = auth.uid() -> user_id = auth.uid())

drop policy if exists "activity_logs_select_company" on public.activity_logs;
create policy "activity_logs_select_company" on public.activity_logs
  for select to authenticated
  using (company_id in (select company_id from public.team_members
                        where user_id = (select auth.uid())));

drop policy if exists "quick_room_presence_select_company" on public.quick_room_presence;
create policy "quick_room_presence_select_company" on public.quick_room_presence
  for select to authenticated
  using (company_id in (select company_id from public.team_members
                        where user_id = (select auth.uid())));

drop policy if exists "task_attachments_select_company" on public.task_attachments;
create policy "task_attachments_select_company" on public.task_attachments
  for select to authenticated
  using (company_id in (select company_id from public.team_members
                        where user_id = (select auth.uid())));

drop policy if exists "task_comments_select_company" on public.task_comments;
create policy "task_comments_select_company" on public.task_comments
  for select to authenticated
  using (company_id in (select company_id from public.team_members
                        where user_id = (select auth.uid())));

-- The inner assignee/watcher comparisons must now target the membership
-- row id (tm.id), not the auth uid.
drop policy if exists "tasks_select_scoped" on public.tasks;
create policy "tasks_select_scoped" on public.tasks
  for select to authenticated
  using (exists (
    select 1 from public.team_members tm
    where tm.user_id = (select auth.uid())
      and tm.company_id = tasks.company_id
      and (tm.access_tier in ('admin', 'lead')
        or tasks.assignee_id = tm.id
        or exists (select 1 from public.task_watchers w
                   where w.task_id = tasks.id and w.member_id = tm.id))));

drop policy if exists "member read own assignments" on public.team_member_doc_projects;
create policy "member read own assignments" on public.team_member_doc_projects
  for select to authenticated
  using (member_id in (select id from public.team_members
                       where user_id = (select auth.uid())));

drop policy if exists "lead manage assignments" on public.team_member_doc_projects;
create policy "lead manage assignments" on public.team_member_doc_projects
  to authenticated
  using (exists (select 1 from public.team_members
                 where user_id = (select auth.uid())
                   and access_tier in ('admin', 'lead')))
  with check (exists (select 1 from public.team_members
                      where user_id = (select auth.uid())
                        and access_tier in ('admin', 'lead')));

drop policy if exists "lead read all assignments" on public.team_member_doc_projects;
create policy "lead read all assignments" on public.team_member_doc_projects
  for select to authenticated
  using (exists (select 1 from public.team_members
                 where user_id = (select auth.uid())
                   and access_tier in ('admin', 'lead')));

drop policy if exists "lead write doc_projects" on public.doc_projects;
create policy "lead write doc_projects" on public.doc_projects
  to authenticated
  using (exists (select 1 from public.team_members
                 where user_id = (select auth.uid())
                   and access_tier in ('admin', 'lead')))
  with check (exists (select 1 from public.team_members
                      where user_id = (select auth.uid())
                        and access_tier in ('admin', 'lead')));

drop policy if exists "team_members_select_own" on public.team_members;
create policy "team_members_select_own" on public.team_members
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "team_members_update_own" on public.team_members;
create policy "team_members_update_own" on public.team_members
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
