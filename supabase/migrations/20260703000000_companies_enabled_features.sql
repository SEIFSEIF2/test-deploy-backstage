-- Feature-flag toggles per workspace. Empty array = all optional
-- modules off; the wizard populates it on first run and Settings ›
-- Features lets admins flip individual keys later.
alter table "public"."companies"
  add column if not exists "enabled_features" text[] not null default '{}';

comment on column "public"."companies"."enabled_features" is
  'List of enabled feature keys (see lib/features/keys.ts). Modules read
   isFeatureEnabled(companyId, key) to decide whether to render.';
