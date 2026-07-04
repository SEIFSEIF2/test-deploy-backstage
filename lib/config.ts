// Single env-driven config surface. Consumers import from here instead of
// reading process.env directly so OSS forks can rebrand without hunting
// hardcoded strings.
//
// Defaults make the app runnable with zero env config as "Backstage" on
// UTC. Set NEXT_PUBLIC_* to override for prod.

// A bad NEXT_PUBLIC_TIMEZONE (typo, or "-" typed into the Vercel deploy
// screen) must not crash every Intl call in the app — fall back to UTC.
function validTimezone(tz: string | undefined): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Backstage',
  appTagline: process.env.NEXT_PUBLIC_APP_TAGLINE ?? 'Team ops in one place.',
  emailDomain: process.env.NEXT_PUBLIC_APP_EMAIL_DOMAIN ?? 'example.com',
  timezone: validTimezone(process.env.NEXT_PUBLIC_TIMEZONE),
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com'
} as const

export type AppConfig = typeof config
