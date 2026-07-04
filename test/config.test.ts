import { beforeEach, describe, expect, it, vi } from 'vitest'

// config.ts reads env at module load; re-import per case.
async function loadConfig(tz?: string) {
  vi.resetModules()
  if (tz !== undefined) vi.stubEnv('NEXT_PUBLIC_TIMEZONE', tz)
  return import('@/lib/config')
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('config.timezone', () => {
  it('falls back to UTC for garbage values instead of crashing Intl', async () => {
    // '-' is what a confused deployer typed into the Vercel env screen;
    // it crashed every Intl.DateTimeFormat call in the app once.
    const { config } = await loadConfig('-')
    expect(config.timezone).toBe('UTC')
    expect(() =>
      new Intl.DateTimeFormat('en-US', { timeZone: config.timezone }).format()
    ).not.toThrow()
  })

  it('keeps valid IANA timezones', async () => {
    const { config } = await loadConfig('Europe/Malta')
    expect(config.timezone).toBe('Europe/Malta')
  })

  it('defaults to UTC when unset', async () => {
    const { config } = await loadConfig()
    expect(config.timezone).toBe('UTC')
  })
})

describe('quick room window', () => {
  it('always returns a well-formed window, even with a bad timezone env', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_TIMEZONE', '-')
    const { isQuickRoomOpen } = await import('@/lib/quickRoom')
    const w = isQuickRoomOpen(new Date('2026-07-01T12:00:00Z'))
    expect(typeof w.open).toBe('boolean')
    expect(w.label.length).toBeGreaterThan(0)
  })
})
