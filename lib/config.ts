// Single env-driven config surface. Consumers import from here instead of
// reading process.env directly so OSS forks can rebrand without hunting
// hardcoded strings.
//
// Defaults make the app runnable with zero env config as "Backstage" on
// UTC. Set NEXT_PUBLIC_* to override for prod.

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Backstage',
  appTagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ??
    'Team ops in one place.',
  emailDomain: process.env.NEXT_PUBLIC_APP_EMAIL_DOMAIN ?? 'example.com',
  timezone: process.env.NEXT_PUBLIC_TIMEZONE ?? 'UTC',
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000',
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'
} as const

export type AppConfig = typeof config
