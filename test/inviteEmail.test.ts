import { describe, expect, it } from 'vitest'
import { inviteMemberEmail } from '@/lib/email/templates'

// The attach variant (multi-workspace: invite lands on an existing
// account) must NEVER contain the default password — mailing shared
// credentials at a real inbox is the failure this guards against.

const base = {
  recipientName: 'Jane Doe',
  inviterName: 'Seif',
  companyName: 'Acme',
  accessTier: 'member' as const,
  loginEmail: 'jane@example.com',
  initialPassword: 'AStrong1!',
  acceptUrl: 'https://app.example.com/invite/tok',
  loginUrl: 'https://app.example.com/login',
  expiresAt: new Date(Date.now() + 14 * 86400000).toISOString()
}

describe('inviteMemberEmail', () => {
  it('legacy invites include the credentials block', () => {
    const { html, text } = inviteMemberEmail(base)
    expect(html).toContain('AStrong1!')
    expect(text).toContain('AStrong1!')
    expect(text).toContain('change your password')
  })

  it('attach invites never leak the default password', () => {
    const { html, text } = inviteMemberEmail({
      ...base,
      existingAccount: true
    })
    expect(html).not.toContain('AStrong1!')
    expect(text).not.toContain('AStrong1!')
    expect(html).toContain('existing account')
    expect(text).toContain('existing account')
  })

  it('escapes HTML in user-controlled fields', () => {
    const { html } = inviteMemberEmail({
      ...base,
      recipientName: '<img src=x onerror=alert(1)>',
      companyName: '<script>x</script>'
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).not.toContain('<img src=x')
  })
})
