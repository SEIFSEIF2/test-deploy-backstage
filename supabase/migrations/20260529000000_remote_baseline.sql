


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."access_tier" AS ENUM (
    'admin',
    'lead',
    'member'
);


ALTER TYPE "public"."access_tier" OWNER TO "postgres";


CREATE TYPE "public"."activity_status" AS ENUM (
    'active',
    'away',
    'on_vacation',
    'left'
);


ALTER TYPE "public"."activity_status" OWNER TO "postgres";


CREATE TYPE "public"."external_ref_kind" AS ENUM (
    'issue',
    'pr',
    'commit',
    'doc',
    'link',
    'supabase',
    'github',
    'figma',
    'verbivore',
    'vercel',
    'bunny',
    'sentry',
    'gcloud',
    'stripe'
);


ALTER TYPE "public"."external_ref_kind" OWNER TO "postgres";


CREATE TYPE "public"."handoff_status" AS ENUM (
    'in_progress',
    'blocked',
    'ready_for_review',
    'done'
);


ALTER TYPE "public"."handoff_status" OWNER TO "postgres";


CREATE TYPE "public"."meeting_outcome" AS ENUM (
    'resolved',
    'partial',
    'needs_followup',
    'failed'
);


ALTER TYPE "public"."meeting_outcome" OWNER TO "postgres";


CREATE TYPE "public"."meeting_request_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'declined',
    'scheduled',
    'canceled',
    'completed'
);


ALTER TYPE "public"."meeting_request_status" OWNER TO "postgres";


CREATE TYPE "public"."project_kind" AS ENUM (
    'standard',
    'operations'
);


ALTER TYPE "public"."project_kind" OWNER TO "postgres";


CREATE TYPE "public"."relation_kind" AS ENUM (
    'blocked_by',
    'blocks',
    'parent',
    'sub_issue',
    'triage'
);


ALTER TYPE "public"."relation_kind" OWNER TO "postgres";


CREATE TYPE "public"."sprint_status" AS ENUM (
    'completed',
    'current',
    'upcoming'
);


ALTER TYPE "public"."sprint_status" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'urgent',
    'high',
    'medium',
    'low',
    'none'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'backlog',
    'unscoped',
    'todo',
    'in_progress',
    'in_review',
    'done',
    'canceled',
    'duplicate'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid", "p_timezone" "text" DEFAULT 'UTC') RETURNS "date"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_today date;
  v_claimed_id uuid;
begin
  v_today := (now() at time zone p_timezone)::date;

  update public.companies
  set last_due_warning_date = v_today
  where id = p_company_id
    and (last_due_warning_date is null or last_due_warning_date < v_today)
  returning id into v_claimed_id;

  if v_claimed_id is null then
    return null;
  end if;

  return (v_today + 1);
end;
$$;


ALTER FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid", "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_email_prefs_for_new_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.notification_email_prefs (member_id)
  values (new.id)
  on conflict (member_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."create_email_prefs_for_new_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid;
begin
  select tm.id into v_actor_id
    from public.team_members tm
    join auth.users u on u.id = tm.id
   where u.email = p_caller_email
   limit 1;
  insert into public.team_member_roles (user_id, role_id, assigned_by, assigned_at)
  values (p_target_user_id, p_role_id, v_actor_id, now())
  on conflict (user_id, role_id) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at;
  begin
    perform public.record_admin_action(
      p_caller_email,
      'permissions.assign_role',
      jsonb_build_object('user_id', p_target_user_id, 'role_id', p_role_id)
    );
  exception when undefined_function then
    null;
  end;
end;
$$;


ALTER FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.team_member_permission_overrides
   where user_id = p_target_user_id
     and workspace_id = p_workspace_id
     and resource = p_resource;
  begin
    perform public.record_admin_action(
      p_caller_email,
      'permissions.clear_override',
      jsonb_build_object(
        'user_id', p_target_user_id,
        'workspace_id', p_workspace_id,
        'resource', p_resource
      )
    );
  exception when undefined_function then
    null;
  end;
end;
$$;


ALTER FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.team_member_roles
   where user_id = p_target_user_id and role_id = p_role_id;
  begin
    perform public.record_admin_action(
      p_caller_email,
      'permissions.revoke_role',
      jsonb_build_object('user_id', p_target_user_id, 'role_id', p_role_id)
    );
  exception when undefined_function then
    null;
  end;
end;
$$;


ALTER FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid;
begin
  select tm.id into v_actor_id
    from public.team_members tm
    join auth.users u on u.id = tm.id
   where u.email = p_caller_email
   limit 1;
  insert into public.team_member_permission_overrides
    (user_id, workspace_id, resource, level, set_by, set_at)
  values
    (p_target_user_id, p_workspace_id, p_resource, p_level, v_actor_id, now())
  on conflict (user_id, workspace_id, resource) do update
    set level  = excluded.level,
        set_by = excluded.set_by,
        set_at = excluded.set_at;
  begin
    perform public.record_admin_action(
      p_caller_email,
      'permissions.set_override',
      jsonb_build_object(
        'user_id', p_target_user_id,
        'workspace_id', p_workspace_id,
        'resource', p_resource,
        'level', p_level
      )
    );
  exception when undefined_function then
    null;
  end;
end;
$$;


ALTER FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") RETURNS TABLE("workspace_id" "text", "resource" "text", "level" smallint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with role_union as (
    select g.workspace_id, g.resource, max(g.level) as level
    from public.team_member_roles r
    join public.permission_role_grants g on g.role_id = r.role_id
    where r.user_id = p_user_id
    group by g.workspace_id, g.resource
  ),
  overridden as (
    select
      coalesce(o.workspace_id, ru.workspace_id) as workspace_id,
      coalesce(o.resource,     ru.resource)     as resource,
      coalesce(o.level,        ru.level)        as level
    from role_union ru
    full outer join public.team_member_permission_overrides o
      on o.user_id = p_user_id
     and o.workspace_id = ru.workspace_id
     and o.resource = ru.resource
  )
  select workspace_id, resource, level::smallint
  from overridden
  where level > 0;
$$;


ALTER FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_dashboard_remembered_accounts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.last_used_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_dashboard_remembered_accounts"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_logs" IS 'Audit feed of actions taken (entity_type + entity_id + actor + JSON metadata). Source for activity panels.';



CREATE TABLE IF NOT EXISTS "public"."app_secrets" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_reactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."comment_reactions" IS 'WhatsApp-style emoji reactions on task_comments. ADR 0041.';



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "owner_id" "uuid",
    "quick_meet_url" "text",
    "last_due_warning_date" "date"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON TABLE "public"."companies" IS 'Tenant root. One row per workspace (Verbivore). Everything else hangs off company_id.';



COMMENT ON COLUMN "public"."companies"."last_due_warning_date" IS 'Cursor for the lazy daily due-soon warning fan-out. The first dashboard
   load of the day (Europe/Malta) wins the atomic UPDATE and runs the
   scan + notify. ADR 0038.';



CREATE TABLE IF NOT EXISTS "public"."dashboard_remembered_accounts" (
    "device_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "encrypted_refresh_token" "text" NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_remembered_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."dashboard_remembered_accounts" IS 'Server-side encrypted refresh tokens for the dashboard''s multi-account switcher. Accessed only by the /api/accounts/* route handlers via the service role; RLS is enabled with no policies so direct anon/authenticated queries always fail.';



COMMENT ON COLUMN "public"."dashboard_remembered_accounts"."device_id" IS 'Opaque UUID held in the HttpOnly vbv_did cookie. Identifies the browser, not the user.';



COMMENT ON COLUMN "public"."dashboard_remembered_accounts"."encrypted_refresh_token" IS 'AES-256-GCM ciphertext of the Supabase refresh token, base64-encoded as iv(12) || authTag(16) || ciphertext.';



CREATE TABLE IF NOT EXISTS "public"."doc_projects" (
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doc_projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."doc_projects" IS 'Catalog of documentation namespaces for verbivore-docs. slug must match the top-level folder in content/.';



CREATE TABLE IF NOT EXISTS "public"."google_oauth_tokens" (
    "company_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "google_email" "text",
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."google_oauth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."handoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "from_member_id" "uuid",
    "to_member_id" "uuid",
    "status" "public"."handoff_status" DEFAULT 'in_progress'::"public"."handoff_status" NOT NULL,
    "what_it_is" "text",
    "current_status" "text",
    "done_so_far" "text",
    "still_left" "text",
    "file_links" "text",
    "gotchas" "text",
    "who_to_ask" "text",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."handoffs" OWNER TO "postgres";


COMMENT ON TABLE "public"."handoffs" IS 'Structured "here is where I left it" record attached to a task. Seven text fields plus from/to members and a status; is_complete is computed in TS.';



CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text"
);


ALTER TABLE "public"."labels" OWNER TO "postgres";


COMMENT ON TABLE "public"."labels" IS 'Per-company catalog of reusable task tags. name+color, scoped to company_id.';



CREATE TABLE IF NOT EXISTS "public"."meeting_attendees" (
    "meeting_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "picked_at" timestamp with time zone
);


ALTER TABLE "public"."meeting_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "agenda" "text",
    "duration_min" smallint DEFAULT 30 NOT NULL,
    "status" "public"."meeting_request_status" DEFAULT 'pending'::"public"."meeting_request_status" NOT NULL,
    "approved_by_id" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "decline_reason" "text",
    "calendar_event_id" "text",
    "meet_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposed_date" "date",
    "selected_starts_at" timestamp with time zone,
    "mode" "text" DEFAULT 'day'::"text" NOT NULL,
    "slots" "jsonb",
    "selected_slot_index" smallint,
    "goal" "text",
    "context" "text",
    "questions" "text",
    "pre_read" "text",
    "requestee_context" "text",
    "last_rescheduled_at" timestamp with time zone,
    "last_rescheduled_by_id" "uuid",
    "reschedule_reason" "text",
    "outcome" "public"."meeting_outcome",
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by_id" "uuid",
    "follow_up_meeting_id" "uuid",
    CONSTRAINT "meeting_requests_duration_check" CHECK (("duration_min" = ANY (ARRAY[15, 30, 45, 60, 90]))),
    CONSTRAINT "meeting_requests_mode_check" CHECK (("mode" = ANY (ARRAY['day'::"text", 'slots'::"text"]))),
    CONSTRAINT "meeting_requests_mode_data_check" CHECK (((("mode" = 'day'::"text") AND ("proposed_date" IS NOT NULL) AND ("slots" IS NULL)) OR (("mode" = 'slots'::"text") AND ("slots" IS NOT NULL) AND ("proposed_date" IS NULL) AND ("jsonb_typeof"("slots") = 'array'::"text") AND (("jsonb_array_length"("slots") >= 1) AND ("jsonb_array_length"("slots") <= 3)))))
);


ALTER TABLE "public"."meeting_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_tasks" (
    "meeting_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "linked_by_id" "uuid",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meeting_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_email_prefs" (
    "member_id" "uuid" NOT NULL,
    "mentions" boolean DEFAULT true NOT NULL,
    "assigned" boolean DEFAULT true NOT NULL,
    "meetings" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_email_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_step_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'done'::"text" NOT NULL,
    "note" "text",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_by" "uuid"
);


ALTER TABLE "public"."onboarding_step_completions" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_step_completions" IS 'Per-member completion state for each onboarding step. Status: done | removed | na | blocked. ADR 0039.';



CREATE TABLE IF NOT EXISTS "public"."onboarding_step_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'tooling'::"text" NOT NULL,
    "target_tiers" "public"."access_tier"[] DEFAULT ARRAY['member'::"public"."access_tier"] NOT NULL,
    "target_skills" "text"[],
    "tool_key" "text",
    "admin_invite_url" "text",
    "member_help_url" "text",
    "is_required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."onboarding_step_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_step_templates" IS 'Per-company onboarding checklist items. Filtered per-member by access_tier and skill labels at query time. ADR 0039.';



CREATE TABLE IF NOT EXISTS "public"."permission_role_grants" (
    "role_id" "text" NOT NULL,
    "workspace_id" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "level" smallint NOT NULL,
    CONSTRAINT "permission_role_grants_level_check" CHECK ((("level" >= 0) AND ("level" <= 4)))
);


ALTER TABLE "public"."permission_role_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_roles" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_preset" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_external_refs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "kind" "public"."external_ref_kind" NOT NULL,
    "url" "text" NOT NULL,
    "label" "text",
    "created_by" "uuid",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_external_refs" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_external_refs" IS 'External URLs attached to a whole project (brief docs, brand guides, audit trackers). Project-scoped sibling of task_external_refs.';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "kind" "public"."project_kind" DEFAULT 'standard'::"public"."project_kind" NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "github_repo" "text",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."projects" IS 'A container for tasks. kind=standard for real projects, kind=operations for the standing "Operations" lane that holds non-project work.';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "endpoint" "text" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_room_presence" (
    "company_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quick_room_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sprint_tasks" (
    "sprint_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "carried_from_sprint_id" "uuid",
    "carry_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."sprint_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."sprint_tasks" IS 'Join table: which tasks are committed to which sprint.';



CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "doc_url" "text",
    "status" "public"."sprint_status" DEFAULT 'upcoming'::"public"."sprint_status" NOT NULL,
    "from_date" "date" NOT NULL,
    "to_date" "date" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "goal" "text",
    "started_at" timestamp with time zone,
    "started_by" "uuid",
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "shipped_count" integer,
    "carried_count" integer
);


ALTER TABLE "public"."sprints" OWNER TO "postgres";


COMMENT ON TABLE "public"."sprints" IS 'Time-boxed planning window on a project. number is unique per project; status is upcoming/current/completed.';



CREATE TABLE IF NOT EXISTS "public"."task_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "uploaded_by" "uuid",
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "storage_path" "text" NOT NULL
);


ALTER TABLE "public"."task_attachments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."task_attachments"."storage_path" IS 'Object path inside the task-attachments bucket: <company_id>/<task_id>/<uuid>.<ext>';



CREATE TABLE IF NOT EXISTS "public"."task_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."task_checklist_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_checklist_items" IS 'Sub-items inside a task. Ordered by sort_order, ticked via is_done.';



CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "mentions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp(6) with time zone
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_comments" IS 'Discussion thread on a task. Supports @mentions (text[]) and edit tracking via edited_at.';



CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "kind" "public"."relation_kind" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_dependencies" IS 'Directed relations between tasks (blocked_by, blocks, parent, sub_issue, triage). Used to render the dependency graph on the task detail.';



CREATE TABLE IF NOT EXISTS "public"."task_external_refs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "kind" "public"."external_ref_kind" NOT NULL,
    "url" "text" NOT NULL,
    "label" "text",
    "created_by" "uuid",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_external_refs" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_external_refs" IS 'External URLs attached to a single task (GitHub issue/PR, commit, doc, generic link).';



CREATE TABLE IF NOT EXISTS "public"."task_labels" (
    "task_id" "uuid" NOT NULL,
    "label_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_labels" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_labels" IS 'Join table: which labels are applied to which tasks.';



CREATE TABLE IF NOT EXISTS "public"."task_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_reactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_reactions" IS 'WhatsApp-style emoji reactions on tasks themselves. ADR 0041.';



CREATE TABLE IF NOT EXISTS "public"."task_watchers" (
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_watchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."task_status" DEFAULT 'backlog'::"public"."task_status" NOT NULL,
    "priority" "public"."task_priority" DEFAULT 'none'::"public"."task_priority" NOT NULL,
    "ref" "text",
    "seq_number" integer,
    "sort_order" integer,
    "assignee_id" "uuid",
    "lead_id" "uuid",
    "due_date" "date",
    "created_by" "uuid",
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'A unit of work on a project. Drives the six-column board (backlog, unscoped, todo, in_progress, in_review, done) plus the side states canceled and duplicate.';



COMMENT ON COLUMN "public"."tasks"."deleted_at" IS 'Soft-delete tombstone. NULL = live; non-null = trashed and hidden from every app read except /dashboard/trash.';



COMMENT ON COLUMN "public"."tasks"."deleted_by" IS 'team_members.id of whoever soft-deleted this task. SET NULL on member removal.';



CREATE TABLE IF NOT EXISTS "public"."team_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "access_tier" "public"."access_tier" DEFAULT 'member'::"public"."access_tier" NOT NULL,
    "token" "text" NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "contact_email" "text" NOT NULL
);


ALTER TABLE "public"."team_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_member_doc_projects" (
    "member_id" "uuid" NOT NULL,
    "project_slug" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid"
);


ALTER TABLE "public"."team_member_doc_projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_member_doc_projects" IS 'Per-member allow-list for verbivore-docs project visibility. Admin/lead bypass this; members only see rows that exist here.';



CREATE TABLE IF NOT EXISTS "public"."team_member_permission_overrides" (
    "user_id" "uuid" NOT NULL,
    "workspace_id" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "level" smallint NOT NULL,
    "set_by" "uuid",
    "set_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_member_permission_overrides_level_check" CHECK ((("level" >= 0) AND ("level" <= 4)))
);


ALTER TABLE "public"."team_member_permission_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_member_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "text" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_member_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "slug" "text",
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "social_instagram" "text",
    "social_linkedin" "text",
    "social_whatsapp" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "profile_theme" "text" DEFAULT 'dark'::"text",
    "access_tier" "public"."access_tier" DEFAULT 'member'::"public"."access_tier" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "role_focus" "text",
    "timezone" "text",
    "work_style" "text",
    "headline" "text",
    "work_links" "jsonb",
    "skills" "jsonb",
    "onboarding_step" integer DEFAULT 0 NOT NULL,
    "last_seen_at" timestamp with time zone,
    "activity_status" "public"."activity_status" DEFAULT 'active'::"public"."activity_status" NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'People on the team. id mirrors auth.users.id (Supabase Auth bridge, no DB FK). Carries the access tier (admin/lead/member) and profile fields.';



COMMENT ON COLUMN "public"."team_members"."contact_email" IS 'Personal email for notifications. Different from email, which is the @verbivore.app login used by Supabase Auth.';



COMMENT ON COLUMN "public"."team_members"."role_focus" IS 'One-liner role/focus (e.g., "Full-stack", "Transcription"). Drives teammate filtering and handoff routing.';



COMMENT ON COLUMN "public"."team_members"."timezone" IS 'IANA time zone (e.g., "Europe/Paris"). Drives cross-team handoffs.';



COMMENT ON COLUMN "public"."team_members"."work_style" IS 'Free-text "how you work best". Helps teammates collaborate.';



COMMENT ON COLUMN "public"."team_members"."headline" IS 'Tagline that leads the public profile. One sentence. Distinct from bio.';



COMMENT ON COLUMN "public"."team_members"."work_links" IS 'Array of {label, url} pairs. GitHub, personal site, Dribbble, etc. Optional onboarding step.';



COMMENT ON COLUMN "public"."team_members"."skills" IS 'Self-rated skills: array of { label, level } where level is 1..5 (Beginner..Expert). Free-form labels.';



COMMENT ON COLUMN "public"."team_members"."onboarding_step" IS 'High-water mark of the onboarding wizard step the member has completed. See decision 0029.';



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_secrets"
    ADD CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_member_id_emoji_key" UNIQUE ("comment_id", "member_id", "emoji");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "company_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "company_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "crew_member_company_id_email_key" UNIQUE ("company_id", "email");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "crew_member_company_id_slug_key" UNIQUE ("company_id", "slug");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "crew_member_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "cycle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "cycle_project_id_number_key" UNIQUE ("project_id", "number");



ALTER TABLE ONLY "public"."sprint_tasks"
    ADD CONSTRAINT "cycle_task_pkey" PRIMARY KEY ("sprint_id", "task_id");



ALTER TABLE ONLY "public"."dashboard_remembered_accounts"
    ADD CONSTRAINT "dashboard_remembered_accounts_pkey" PRIMARY KEY ("device_id", "user_id");



ALTER TABLE ONLY "public"."doc_projects"
    ADD CONSTRAINT "doc_projects_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_task_id_key" UNIQUE ("task_id");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "label_company_id_name_key" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "label_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("meeting_id", "member_id");



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_tasks"
    ADD CONSTRAINT "meeting_tasks_pkey" PRIMARY KEY ("meeting_id", "task_id");



ALTER TABLE ONLY "public"."notification_email_prefs"
    ADD CONSTRAINT "notification_email_prefs_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_member_id_template_id_key" UNIQUE ("member_id", "template_id");



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_step_templates"
    ADD CONSTRAINT "onboarding_step_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_role_grants"
    ADD CONSTRAINT "permission_role_grants_pkey" PRIMARY KEY ("role_id", "workspace_id", "resource");



ALTER TABLE ONLY "public"."permission_roles"
    ADD CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "project_company_id_name_key" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."project_external_refs"
    ADD CONSTRAINT "project_external_ref_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("endpoint");



ALTER TABLE ONLY "public"."quick_room_presence"
    ADD CONSTRAINT "quick_room_presence_pkey" PRIMARY KEY ("company_id", "member_id");



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_item_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependency_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."task_external_refs"
    ADD CONSTRAINT "task_external_ref_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_label_pkey" PRIMARY KEY ("task_id", "label_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_reactions"
    ADD CONSTRAINT "task_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_reactions"
    ADD CONSTRAINT "task_reactions_task_id_member_id_emoji_key" UNIQUE ("task_id", "member_id", "emoji");



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("task_id", "member_id");



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_member_doc_projects"
    ADD CONSTRAINT "team_member_doc_projects_pkey" PRIMARY KEY ("member_id", "project_slug");



ALTER TABLE ONLY "public"."team_member_permission_overrides"
    ADD CONSTRAINT "team_member_permission_overrides_pkey" PRIMARY KEY ("user_id", "workspace_id", "resource");



ALTER TABLE ONLY "public"."team_member_roles"
    ADD CONSTRAINT "team_member_roles_pkey" PRIMARY KEY ("user_id", "role_id");



CREATE INDEX "activity_log_company_id_idx" ON "public"."activity_logs" USING "btree" ("company_id");



CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "public"."activity_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "comment_reactions_comment_idx" ON "public"."comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "comment_reactions_member_idx" ON "public"."comment_reactions" USING "btree" ("member_id");



CREATE INDEX "dashboard_remembered_accounts_device_idx" ON "public"."dashboard_remembered_accounts" USING "btree" ("device_id", "last_used_at" DESC);



CREATE INDEX "handoff_company_id_idx" ON "public"."handoffs" USING "btree" ("company_id");



CREATE INDEX "handoff_to_member_id_idx" ON "public"."handoffs" USING "btree" ("to_member_id");



CREATE INDEX "meeting_attendees_member_idx" ON "public"."meeting_attendees" USING "btree" ("member_id");



CREATE INDEX "meeting_requests_company_status_idx" ON "public"."meeting_requests" USING "btree" ("company_id", "status");



CREATE INDEX "meeting_requests_follow_up_meeting_id_idx" ON "public"."meeting_requests" USING "btree" ("follow_up_meeting_id") WHERE ("follow_up_meeting_id" IS NOT NULL);



CREATE INDEX "meeting_requests_proposed_date_idx" ON "public"."meeting_requests" USING "btree" ("proposed_date");



CREATE INDEX "meeting_requests_requester_idx" ON "public"."meeting_requests" USING "btree" ("requester_id", "status");



CREATE INDEX "meeting_tasks_task_id_idx" ON "public"."meeting_tasks" USING "btree" ("task_id");



CREATE INDEX "onboarding_completions_member_idx" ON "public"."onboarding_step_completions" USING "btree" ("member_id");



CREATE INDEX "onboarding_completions_template_idx" ON "public"."onboarding_step_completions" USING "btree" ("template_id");



CREATE INDEX "onboarding_step_templates_company_idx" ON "public"."onboarding_step_templates" USING "btree" ("company_id") WHERE ("archived_at" IS NULL);



CREATE INDEX "project_external_ref_project_id_idx" ON "public"."project_external_refs" USING "btree" ("project_id");



CREATE INDEX "push_subscriptions_member_idx" ON "public"."push_subscriptions" USING "btree" ("member_id");



CREATE INDEX "quick_room_presence_company_heartbeat_idx" ON "public"."quick_room_presence" USING "btree" ("company_id", "last_heartbeat");



CREATE INDEX "sprint_tasks_carry_count_idx" ON "public"."sprint_tasks" USING "btree" ("sprint_id", "carry_count" DESC) WHERE ("carry_count" > 0);



CREATE INDEX "task_assignee_id_idx" ON "public"."tasks" USING "btree" ("assignee_id");



CREATE INDEX "task_attachments_company_idx" ON "public"."task_attachments" USING "btree" ("company_id");



CREATE INDEX "task_attachments_task_idx" ON "public"."task_attachments" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "task_comment_task_id_idx" ON "public"."task_comments" USING "btree" ("task_id");



CREATE INDEX "task_company_id_idx" ON "public"."tasks" USING "btree" ("company_id");



CREATE INDEX "task_external_ref_task_id_idx" ON "public"."task_external_refs" USING "btree" ("task_id");



CREATE INDEX "task_lead_id_idx" ON "public"."tasks" USING "btree" ("lead_id");



CREATE INDEX "task_project_id_idx" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "task_reactions_member_idx" ON "public"."task_reactions" USING "btree" ("member_id");



CREATE INDEX "task_reactions_task_idx" ON "public"."task_reactions" USING "btree" ("task_id");



CREATE INDEX "task_status_idx" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "task_watchers_member_id_idx" ON "public"."task_watchers" USING "btree" ("member_id");



CREATE INDEX "tasks_company_active_idx" ON "public"."tasks" USING "btree" ("company_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "tasks_company_trash_idx" ON "public"."tasks" USING "btree" ("company_id", "deleted_at" DESC) WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "team_invites_company_idx" ON "public"."team_invites" USING "btree" ("company_id");



CREATE UNIQUE INDEX "team_invites_pending_email_idx" ON "public"."team_invites" USING "btree" ("company_id", "lower"("email")) WHERE ("accepted_at" IS NULL);



CREATE INDEX "team_invites_pending_idx" ON "public"."team_invites" USING "btree" ("company_id", "accepted_at") WHERE ("accepted_at" IS NULL);



CREATE INDEX "team_member_doc_projects_member_idx" ON "public"."team_member_doc_projects" USING "btree" ("member_id");



CREATE INDEX "team_members_last_seen_at_idx" ON "public"."team_members" USING "btree" ("last_seen_at" DESC);



CREATE OR REPLACE TRIGGER "handoffs_set_updated_at" BEFORE UPDATE ON "public"."handoffs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "team_member_email_prefs_default" AFTER INSERT ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."create_email_prefs_for_new_member"();



CREATE OR REPLACE TRIGGER "touch_dashboard_remembered_accounts" BEFORE UPDATE ON "public"."dashboard_remembered_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_dashboard_remembered_accounts"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "crew_member_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "cycle_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "cycle_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_tasks"
    ADD CONSTRAINT "cycle_task_cycle_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_tasks"
    ADD CONSTRAINT "cycle_task_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_remembered_accounts"
    ADD CONSTRAINT "dashboard_remembered_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."handoffs"
    ADD CONSTRAINT "handoff_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "label_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_follow_up_meeting_id_fkey" FOREIGN KEY ("follow_up_meeting_id") REFERENCES "public"."meeting_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_last_rescheduled_by_id_fkey" FOREIGN KEY ("last_rescheduled_by_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_requests"
    ADD CONSTRAINT "meeting_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_tasks"
    ADD CONSTRAINT "meeting_tasks_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meeting_tasks"
    ADD CONSTRAINT "meeting_tasks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_tasks"
    ADD CONSTRAINT "meeting_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_email_prefs"
    ADD CONSTRAINT "notification_email_prefs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_step_completions"
    ADD CONSTRAINT "onboarding_step_completions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_step_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_step_templates"
    ADD CONSTRAINT "onboarding_step_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permission_role_grants"
    ADD CONSTRAINT "permission_role_grants_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."permission_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "project_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_external_refs"
    ADD CONSTRAINT "project_external_ref_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_external_refs"
    ADD CONSTRAINT "project_external_ref_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_external_refs"
    ADD CONSTRAINT "project_external_ref_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_room_presence"
    ADD CONSTRAINT "quick_room_presence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_room_presence"
    ADD CONSTRAINT "quick_room_presence_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_tasks"
    ADD CONSTRAINT "sprint_tasks_carried_from_sprint_id_fkey" FOREIGN KEY ("carried_from_sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_checklist_items"
    ADD CONSTRAINT "task_checklist_item_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependency_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependency_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_external_refs"
    ADD CONSTRAINT "task_external_ref_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_external_refs"
    ADD CONSTRAINT "task_external_ref_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_external_refs"
    ADD CONSTRAINT "task_external_ref_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_label_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_label_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_reactions"
    ADD CONSTRAINT "task_reactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_reactions"
    ADD CONSTRAINT "task_reactions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_watchers"
    ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invites"
    ADD CONSTRAINT "team_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_member_doc_projects"
    ADD CONSTRAINT "team_member_doc_projects_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_member_doc_projects"
    ADD CONSTRAINT "team_member_doc_projects_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_doc_projects"
    ADD CONSTRAINT "team_member_doc_projects_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "public"."doc_projects"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_permission_overrides"
    ADD CONSTRAINT "team_member_permission_overrides_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_member_permission_overrides"
    ADD CONSTRAINT "team_member_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_member_roles"
    ADD CONSTRAINT "team_member_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_member_roles"
    ADD CONSTRAINT "team_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."permission_roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."team_member_roles"
    ADD CONSTRAINT "team_member_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_select_company" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "team_members"."company_id"
   FROM "public"."team_members"
  WHERE ("team_members"."id" = "auth"."uid"()))));



ALTER TABLE "public"."app_secrets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth read doc_projects" ON "public"."doc_projects" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_remembered_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."handoffs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead manage assignments" ON "public"."team_member_doc_projects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"]))))));



CREATE POLICY "lead read all assignments" ON "public"."team_member_doc_projects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"]))))));



CREATE POLICY "lead write doc_projects" ON "public"."doc_projects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"]))))));



ALTER TABLE "public"."meeting_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member read own assignments" ON "public"."team_member_doc_projects" FOR SELECT TO "authenticated" USING (("member_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."notification_email_prefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission_role_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_external_refs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quick_room_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quick_room_presence_select_company" ON "public"."quick_room_presence" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "team_members"."company_id"
   FROM "public"."team_members"
  WHERE ("team_members"."id" = "auth"."uid"()))));



ALTER TABLE "public"."sprint_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_attachments_select_company" ON "public"."task_attachments" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "team_members"."company_id"
   FROM "public"."team_members"
  WHERE ("team_members"."id" = "auth"."uid"()))));



ALTER TABLE "public"."task_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_comments_select_company" ON "public"."task_comments" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "team_members"."company_id"
   FROM "public"."team_members"
  WHERE ("team_members"."id" = "auth"."uid"()))));



ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_external_refs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_watchers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_select_scoped" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."id" = "auth"."uid"()) AND ("tm"."company_id" = "tasks"."company_id") AND (("tm"."access_tier" = ANY (ARRAY['admin'::"public"."access_tier", 'lead'::"public"."access_tier"])) OR ("tasks"."assignee_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."task_watchers" "w"
          WHERE (("w"."task_id" = "tasks"."id") AND ("w"."member_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."team_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_member_doc_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_member_permission_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_member_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_select_own" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "team_members_update_own" ON "public"."team_members" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quick_room_presence";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_comments";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_due_warning_run"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_email_prefs_for_new_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_email_prefs_for_new_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_email_prefs_for_new_member"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_admin_assign_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_admin_clear_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_admin_revoke_role"("p_caller_email" "text", "p_target_user_id" "uuid", "p_role_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_admin_set_permission_override"("p_caller_email" "text", "p_target_user_id" "uuid", "p_workspace_id" "text", "p_resource" "text", "p_level" smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."team_member_effective_permissions"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_dashboard_remembered_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_dashboard_remembered_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_dashboard_remembered_accounts"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."app_secrets" TO "anon";
GRANT ALL ON TABLE "public"."app_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."app_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_remembered_accounts" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_remembered_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_remembered_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."doc_projects" TO "anon";
GRANT ALL ON TABLE "public"."doc_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_projects" TO "service_role";



GRANT ALL ON TABLE "public"."google_oauth_tokens" TO "anon";
GRANT ALL ON TABLE "public"."google_oauth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."google_oauth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."handoffs" TO "anon";
GRANT ALL ON TABLE "public"."handoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."handoffs" TO "service_role";



GRANT ALL ON TABLE "public"."labels" TO "anon";
GRANT ALL ON TABLE "public"."labels" TO "authenticated";
GRANT ALL ON TABLE "public"."labels" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_attendees" TO "anon";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_requests" TO "anon";
GRANT ALL ON TABLE "public"."meeting_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_requests" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_tasks" TO "anon";
GRANT ALL ON TABLE "public"."meeting_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."notification_email_prefs" TO "anon";
GRANT ALL ON TABLE "public"."notification_email_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_email_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_step_completions" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_step_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_step_completions" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_step_templates" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_step_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_step_templates" TO "service_role";



GRANT ALL ON TABLE "public"."permission_role_grants" TO "anon";
GRANT ALL ON TABLE "public"."permission_role_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_role_grants" TO "service_role";



GRANT ALL ON TABLE "public"."permission_roles" TO "anon";
GRANT ALL ON TABLE "public"."permission_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_roles" TO "service_role";



GRANT ALL ON TABLE "public"."project_external_refs" TO "anon";
GRANT ALL ON TABLE "public"."project_external_refs" TO "authenticated";
GRANT ALL ON TABLE "public"."project_external_refs" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."quick_room_presence" TO "anon";
GRANT ALL ON TABLE "public"."quick_room_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_room_presence" TO "service_role";



GRANT ALL ON TABLE "public"."sprint_tasks" TO "anon";
GRANT ALL ON TABLE "public"."sprint_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."sprint_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."sprints" TO "anon";
GRANT ALL ON TABLE "public"."sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."sprints" TO "service_role";



GRANT ALL ON TABLE "public"."task_attachments" TO "anon";
GRANT ALL ON TABLE "public"."task_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_external_refs" TO "anon";
GRANT ALL ON TABLE "public"."task_external_refs" TO "authenticated";
GRANT ALL ON TABLE "public"."task_external_refs" TO "service_role";



GRANT ALL ON TABLE "public"."task_labels" TO "anon";
GRANT ALL ON TABLE "public"."task_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."task_labels" TO "service_role";



GRANT ALL ON TABLE "public"."task_reactions" TO "anon";
GRANT ALL ON TABLE "public"."task_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."task_watchers" TO "anon";
GRANT ALL ON TABLE "public"."task_watchers" TO "authenticated";
GRANT ALL ON TABLE "public"."task_watchers" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_invites" TO "anon";
GRANT ALL ON TABLE "public"."team_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invites" TO "service_role";



GRANT ALL ON TABLE "public"."team_member_doc_projects" TO "anon";
GRANT ALL ON TABLE "public"."team_member_doc_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."team_member_doc_projects" TO "service_role";



GRANT ALL ON TABLE "public"."team_member_permission_overrides" TO "anon";
GRANT ALL ON TABLE "public"."team_member_permission_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."team_member_permission_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."team_member_roles" TO "anon";
GRANT ALL ON TABLE "public"."team_member_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."team_member_roles" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































