alter table "public"."companies"
  add column if not exists "logo_url" text;

comment on column "public"."companies"."logo_url" is
  'Public URL of the workspace logo. Uploaded via Settings > Appearance
   into the shared avatars bucket under path company/<company_id>/logo.<ext>.';
