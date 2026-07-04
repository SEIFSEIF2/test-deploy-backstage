-- Remove dormant surfaces that shipped in the baseline but were never
-- wired into the app (audited 2026-07-04: zero readers in app code):
--   - dashboard_remembered_accounts: abandoned device account-switcher
--   - permission_* / team_member_roles / *_overrides + dashboard_admin_*
--     functions: an RBAC system that was never enforced; authz is
--     access_tier in app code
--   - doc_projects / team_member_doc_projects: docs-access feature that
--     never grew an interface
-- Dropping tables also drops their RLS policies and triggers.

drop table if exists public.team_member_doc_projects cascade;
drop table if exists public.doc_projects cascade;
drop table if exists public.dashboard_remembered_accounts cascade;
drop table if exists public.team_member_permission_overrides cascade;
drop table if exists public.team_member_roles cascade;
drop table if exists public.permission_role_grants cascade;
drop table if exists public.permission_roles cascade;

drop function if exists public.dashboard_admin_assign_role(
  p_caller_email text, p_target_user_id uuid, p_role_id text);
drop function if exists public.dashboard_admin_revoke_role(
  p_caller_email text, p_target_user_id uuid, p_role_id text);
drop function if exists public.dashboard_admin_clear_permission_override(
  p_caller_email text, p_target_user_id uuid, p_workspace_id text, p_resource text);
drop function if exists public.dashboard_admin_set_permission_override(
  p_caller_email text, p_target_user_id uuid, p_workspace_id text, p_resource text, p_level smallint);
drop function if exists public.team_member_effective_permissions(p_user_id uuid);
drop function if exists public.touch_dashboard_remembered_accounts();
