# Deploying Backstage

One click gets you a live Backstage tied to a fresh Supabase project.

## One-click: Vercel + Supabase

Use the Deploy button in the repo README, or paste this URL:

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSEIFSEIF4%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_APP_NAME&envDescription=Your%20app%20name%20(e.g.%20Backstage).%20Everything%20else%20is%20configured%20post-deploy.
```

What happens when you click:

1. Vercel clones the repo into your account.
2. The Supabase integration (`integration-ids=oac_...`) opens a modal
   to create a new Supabase project.
3. Supabase auto-writes `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
   the `POSTGRES_URL` family into your Vercel env vars.
4. You type your app name.
5. Vercel builds. The build step (`scripts/migrate.mjs`) applies every
   SQL file in `supabase/migrations/` against the fresh database, then
   `next build` runs.

## After deploy

Open your Vercel URL. With an empty database you land on `/setup`:
one form creates your workspace and admin account. Log in, and the
First-Run Wizard prompts you to pick Solo / Small team / Full to
bulk-enable modules.

No CLI, no SQL editor, no manual seeding.

Migrations re-run on every deploy but are recorded in
`supabase_migrations.schema_migrations` (the same table the Supabase
CLI uses), so already-applied files are skipped and `supabase db push`
stays interchangeable with the build-time runner.

## Optional integrations

- **Google Calendar / Meet**: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
  in Vercel env vars. Add the redirect URI (see `.env.example`) to your
  Google Cloud OAuth client. Connect from `/dashboard/settings` as an admin.
- **Outbound email**: set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
  Leave blank to silently no-op email notifications; push notifications
  still work.

## Local dev

```bash
pnpm install
cp .env.example .env.local
# fill in Supabase URL + keys, plus any optional integrations
pnpm dev
```

Supabase local stack is optional — you can point `.env.local` at a
remote scratch project instead.
