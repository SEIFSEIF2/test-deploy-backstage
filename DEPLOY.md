# Deploying Backstage

One click gets you a live Backstage tied to a fresh Supabase project.

## One-click: Vercel + Supabase

Use the Deploy button in the repo README, or paste this URL:

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSEIFSEIF4%2Fbackstage&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_APP_NAME,NEXT_PUBLIC_APP_URL,NEXT_PUBLIC_APP_EMAIL_DOMAIN,NEXT_PUBLIC_TIMEZONE&envDescription=Branding%20and%20timezone.%20Supabase%20variables%20are%20provisioned%20automatically%20by%20the%20integration.
```

What happens when you click:

1. Vercel clones the repo into your account.
2. The Supabase integration (`integration-ids=oac_...`) opens a modal
   to create a new Supabase project.
3. Supabase auto-writes `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
   into your Vercel env vars, per environment.
4. You fill in the four branding vars (name, url, email domain, timezone).
5. Vercel builds and deploys.

## After deploy

The Supabase integration only wires env vars. It does **not** run your
migrations. Two ways to apply them:

**Option A (easy)**: connect the Supabase CLI locally and push:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B**: open the Supabase SQL editor, paste
`supabase/migrations/*.sql` in order, run each.

Then create the first user via Supabase Auth (email + magic link or
password), and load your Vercel URL. First render sees
`companies.enabled_features = '{}'` and prompts the First-Run Wizard —
pick Solo / Small team / Full to bulk-enable modules.

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
