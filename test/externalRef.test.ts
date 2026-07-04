import { beforeEach, describe, expect, it, vi } from 'vitest'

// externalRef derives the workspace's own-brand domains from config.appUrl,
// which is read from env at module load — so tests that exercise that path
// stub the env and re-import the module fresh.
async function loadWithAppUrl(appUrl?: string) {
  vi.resetModules()
  if (appUrl) vi.stubEnv('NEXT_PUBLIC_APP_URL', appUrl)
  return import('@/lib/externalRef')
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('parseExternalRef', () => {
  it('classifies GitHub PRs, issues, commits, and bare repos', async () => {
    const { parseExternalRef } = await loadWithAppUrl()
    expect(
      parseExternalRef('https://github.com/acme/web/pull/42')
    ).toMatchObject({ kind: 'pr', repo: 'acme/web', identifier: '42' })
    expect(
      parseExternalRef('https://github.com/acme/web/issues/7')
    ).toMatchObject({ kind: 'issue', identifier: '7' })
    expect(
      parseExternalRef(
        'https://github.com/acme/web/commit/0123456789abcdef0123456789abcdef01234567'
      )
    ).toMatchObject({ kind: 'commit', identifier: '0123456' })
    expect(parseExternalRef('https://github.com/acme/web')).toMatchObject({
      kind: 'github',
      repo: 'acme/web'
    })
  })

  it('classifies known third-party surfaces', async () => {
    const { parseExternalRef } = await loadWithAppUrl()
    expect(
      parseExternalRef('https://www.figma.com/design/abc123/My%20File?node=1')
    ).toMatchObject({ kind: 'figma', identifier: 'My File' })
    expect(
      parseExternalRef('https://vercel.com/team/project-x/deployments')
    ).toMatchObject({ kind: 'vercel', identifier: 'project-x' })
    expect(parseExternalRef('https://acme.sentry.io/issues/')).toMatchObject({
      kind: 'sentry',
      identifier: 'acme'
    })
    expect(
      parseExternalRef('https://dashboard.stripe.com/acct_123abc/payments')
    ).toMatchObject({ kind: 'stripe', identifier: '123abc' })
    expect(parseExternalRef('https://cdn-zone.b-cdn.net/x.png')).toMatchObject({
      kind: 'bunny',
      identifier: 'cdn-zone'
    })
    expect(
      parseExternalRef('https://www.notion.so/acme/Spec-1')
    ).toMatchObject({ kind: 'doc' })
  })

  it('rejects non-http URLs and falls back to link', async () => {
    const { parseExternalRef } = await loadWithAppUrl()
    expect(parseExternalRef('ftp://example.com/file')).toBeNull()
    expect(parseExternalRef('not a url')).toBeNull()
    expect(parseExternalRef('https://random.example.org/page')).toMatchObject({
      kind: 'link'
    })
  })

  it('classifies sibling subdomains of the app URL as own-brand', async () => {
    const { parseExternalRef } = await loadWithAppUrl(
      'https://backstage.acme.com'
    )
    expect(parseExternalRef('https://learn.acme.com/course')).toMatchObject({
      kind: 'verbivore',
      identifier: 'learn.acme.com'
    })
    expect(parseExternalRef('https://acme.com')).toMatchObject({
      kind: 'verbivore'
    })
    // unrelated domains stay generic
    expect(parseExternalRef('https://acme.dev/x')).toMatchObject({
      kind: 'link'
    })
  })

  it('never claims own-brand when running on localhost', async () => {
    const { parseExternalRef } = await loadWithAppUrl()
    expect(parseExternalRef('https://sub.localhost.com/x')).toMatchObject({
      kind: 'link'
    })
  })
})

describe('isSelfHosted / labels', () => {
  it('treats the app host and localhost as internal', async () => {
    const { isSelfHosted } = await loadWithAppUrl('https://backstage.acme.com')
    expect(isSelfHosted('https://backstage.acme.com/dashboard/board')).toBe(
      true
    )
    expect(isSelfHosted('http://localhost:3000/dashboard')).toBe(true)
    expect(isSelfHosted('https://acme.com')).toBe(false)
  })

  it('labels the own host as the app itself and siblings with hostname', async () => {
    const { parseExternalRef, defaultExternalRefLabel } =
      await loadWithAppUrl('https://backstage.acme.com')
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'Backstage')
    const self = parseExternalRef('https://backstage.acme.com/dashboard')
    const sibling = parseExternalRef('https://learn.acme.com')
    expect(defaultExternalRefLabel(self!)).toBe('Backstage')
    expect(defaultExternalRefLabel(sibling!)).toContain('learn.acme.com')
  })
})
