'use client'

import { useCallback, useMemo, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { useDashTheme } from './theme'

// ──────────────────────────────────────────────────────────────────────────
// Brand assets and palette
// ──────────────────────────────────────────────────────────────────────────

const DINO_PATH =
  'M34 23 L21 36 L11 51 L4 67 L2 82 L0 83 L0 195 L20 179 L38 167 L66 152 L85 145 L114 140 L135 141 L146 144 L151 144 L171 151 L194 163 L218 179 L256 208 L258 208 L274 220 L276 220 L294 231 L310 237 L315 237 L325 240 L348 240 L358 237 L363 237 L382 229 L400 218 L410 207 L414 199 L417 188 L417 168 L414 156 L408 149 L404 149 L399 152 L386 152 L375 149 L371 146 L370 143 L371 138 L369 136 L370 129 L381 116 L387 115 L391 112 L395 112 L403 115 L412 115 L415 121 L428 135 L440 158 L444 176 L444 195 L440 215 L434 228 L434 231 L421 250 L404 266 L385 279 L359 292 L356 292 L344 298 L340 298 L328 303 L319 304 L300 309 L295 314 L294 341 L297 354 L298 374 L300 380 L314 394 L314 397 L311 401 L305 400 L300 402 L280 403 L276 398 L276 377 L274 372 L260 352 L259 341 L261 336 L261 330 L258 326 L254 326 L250 329 L242 339 L241 365 L242 373 L245 381 L259 396 L261 401 L259 403 L247 403 L246 404 L244 403 L224 403 L221 402 L217 398 L216 388 L212 380 L204 355 L203 341 L205 337 L205 332 L202 329 L196 327 L182 326 L170 322 L151 322 L134 326 L135 329 L134 344 L131 359 L126 372 L126 379 L143 400 L141 402 L129 402 L128 403 L121 402 L90 403 L87 400 L89 383 L89 362 L86 344 L87 337 L86 329 L82 329 L78 333 L73 349 L65 366 L65 375 L71 387 L71 394 L63 398 L56 396 L45 397 L31 395 L27 391 L27 382 L33 371 L31 361 L31 349 L35 332 L23 327 L2 327 L0 328 L0 382 L2 383 L4 398 L9 410 L15 421 L24 433 L31 440 L46 451 L58 457 L80 463 L383 463 L405 457 L418 450 L429 442 L441 430 L454 410 L460 393 L462 378 L462 88 L460 73 L455 61 L455 58 L448 45 L439 33 L425 20 L404 8 L387 3 L371 2 L370 0 L92 0 L91 2 L81 2 L59 8 L45 15 Z'

const BRAND_DEFAULTS = {
  main: '#6BBBB4',
  backstage: '#948CC0',
  dashboard: '#74A4C9',
  docs: '#CBA86B'
} as const

type ToolKey = keyof typeof BRAND_DEFAULTS

interface Tool {
  key: ToolKey
  nm: string
  tag: string
  role: string
  badge: 'check' | 'bars' | 'lines' | null
  url: string
}

const TOOLS: Tool[] = [
  { key: 'main',      nm: 'verbivore', tag: '',          role: 'Main · learn.verbivore.app', badge: null,    url: 'learn.verbivore.app' },
  { key: 'backstage', nm: 'verbivore', tag: 'backstage', role: 'Team tasks · Linear-style',  badge: 'check', url: 'backstage.verbivore.app' },
  { key: 'dashboard', nm: 'verbivore', tag: 'dashboard', role: 'Frontend metrics',           badge: 'bars',  url: 'dashboard.verbivore.app' },
  { key: 'docs',      nm: 'verbivore', tag: 'docs',      role: 'Developer docs',             badge: 'lines', url: 'docs.verbivore.app' }
]

interface Direction {
  n: 1 | 2 | 3 | 4
  name: string
  blurb: string
  note: string
  rec?: boolean
}

const DIRS: Direction[] = [
  { n: 1, name: 'Colour family', rec: true,
    blurb: 'Keep the dino white, swap the badge colour. One muted sibling hue per tool — violet, blue, amber — all tuned to sit beside the brand teal.',
    note: 'cheapest for the eye to decode, and survives down to a 16px favicon.' },
  { n: 2, name: 'Teal + symbol badge',
    blurb: 'Stay 100% on brand teal everywhere, and clip a small corner badge — a task check, a chart, doc lines — onto each tool. Most "Verbivore", least loud.',
    note: 'very on-brand, but at favicon size the badge shrinks away and they all read teal.' },
  { n: 3, name: 'One colour, four weights',
    blurb: 'No new colours at all. Differentiate by treatment: solid, outline, duotone, and deep-inverted — same teal, different "weight".',
    note: 'maximally cohesive — but outline/duotone get subtle when tiny.' },
  { n: 4, name: 'Colour + badge',
    blurb: 'Belt & suspenders: the per-tool colour from Direction 1 plus the glyph from Direction 2. Redundant on purpose, so it never fails in a dense tab strip.',
    note: 'the most bulletproof for crowded sidebars and tab rows.' }
]

// ─── colour helpers ────────────────────────────────────────────────────
// Match the standalone explorer's mechanical darken (≈ 46% lightness) so
// the deep companion colour stays in lockstep with the user's picks.
function darken(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const f = 0.46
  const to = (c: number) =>
    Math.round(c * f).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}

// ─── per-direction mark options for a given tool ────────────────────────

interface MarkOpts {
  sq: string
  dino: string
  ink?: string
  accent: string
  swatch: string
  badge?: 'check' | 'bars' | 'lines' | null
  badgeBg?: string
  border?: string
}

function optsFor(
  dir: 1 | 2 | 3 | 4,
  t: Tool,
  colors: Record<ToolKey, string>
): MarkOpts {
  const base = colors[t.key]
  const dark = darken(base)
  const TEAL = colors.main
  const TEAL_DARK = darken(TEAL)
  if (dir === 1) {
    return { sq: base, dino: '#fff', ink: dark, accent: base, swatch: base.toUpperCase() }
  }
  if (dir === 2) {
    return {
      sq: TEAL, dino: '#fff', badge: t.badge, badgeBg: dark,
      ink: TEAL_DARK, accent: base, swatch: 'teal + ' + t.key
    }
  }
  if (dir === 3) {
    const treatments: Record<ToolKey, Partial<MarkOpts>> = {
      main:      { sq: TEAL,      dino: '#fff' },
      backstage: { sq: '#fff',    dino: TEAL, border: TEAL },
      dashboard: { sq: TEAL,      dino: TEAL_DARK },
      docs:      { sq: TEAL_DARK, dino: TEAL }
    }
    const swatchLabel: Record<ToolKey, string> = {
      main: 'solid', backstage: 'inverse', dashboard: 'duotone', docs: 'deep'
    }
    return {
      ...treatments[t.key],
      ink: TEAL_DARK, accent: TEAL, swatch: swatchLabel[t.key]
    } as MarkOpts
  }
  // dir 4
  return {
    sq: base, dino: '#fff', badge: t.badge, badgeBg: dark,
    ink: dark, accent: base, swatch: base.toUpperCase()
  }
}

// ─── sketch-style cute accessory per tool ───────────────────────────────
// SVG glyph drawn in 463×464 space so it composites cleanly with the dino
// path at any scale. Mirrors the standalone explorer + Export Pack.
function accessoryFor(key: ToolKey, stroke: string): string {
  const sf = `filter="url(#sk)"`
  switch (key) {
    case 'main':
      return `<g fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" ${sf}>
        <path d="M398 80 L447 100 L398 120 L349 100 Z" fill="${stroke}"/>
        <path d="M372 110 L372 124 Q398 138 424 124 L424 110" fill="${stroke}"/>
        <circle cx="398" cy="100" r="3.5" fill="#fff" stroke="none"/>
        <path d="M398 100 L447 100 L450 134"/>
        <circle cx="450" cy="140" r="6" fill="${stroke}" stroke="none"/>
      </g>`
    case 'backstage':
      return `<g fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" ${sf}>
        <rect x="98" y="126" width="64" height="82" rx="9" fill="#fff"/>
        <path d="M120 126 L120 118 Q130 110 140 118 L140 126" fill="#fff"/>
        <path d="M109 150 l9 9 15 -17" stroke-width="6.5"/>
        <path d="M111 178 L150 178 M111 192 L139 192" stroke-width="5.5"/>
      </g>`
    case 'dashboard':
      return `<g fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" ${sf}>
        <rect x="100" y="112" width="64" height="46" rx="7" fill="#fff"/>
        <g stroke-width="6"><path d="M118 144 L118 136 M132 144 L132 128 M146 144 L146 132"/></g>
        <path d="M94 158 L170 158 L182 174 L82 174 Z" fill="#fff"/>
        <path d="M120 166 L144 166" stroke-width="5"/>
      </g>`
    case 'docs':
      return `<g fill="none" stroke="${stroke}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" ${sf}>
        <path d="M86 178 Q110 162 130 168 L130 132 Q110 126 86 142 Z" fill="#fff"/>
        <path d="M174 178 Q150 162 130 168 L130 132 Q150 126 174 142 Z" fill="#fff"/>
        <path d="M97 150 L120 147 M97 162 L120 159" stroke-width="4.5"/>
        <path d="M140 147 L163 150 M140 159 L163 162" stroke-width="4.5"/>
      </g>`
  }
}

function tinyBadge(type: 'check' | 'bars' | 'lines', bg: string): string {
  const cx = 356, cy = 358, r = 98
  let g = ''
  if (type === 'check')
    g = `<path d="M${cx - 48} ${cy} L${cx - 14} ${cy + 34} L${cx + 52} ${cy - 40}" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`
  if (type === 'bars')
    g = `<g fill="#fff"><rect x="${cx - 48}" y="${cy - 2}" width="24" height="42" rx="6"/><rect x="${cx - 12}" y="${cy - 28}" width="24" height="68" rx="6"/><rect x="${cx + 24}" y="${cy - 48}" width="24" height="88" rx="6"/></g>`
  if (type === 'lines')
    g = `<g fill="#fff"><rect x="${cx - 48}" y="${cy - 36}" width="96" height="19" rx="9.5"/><rect x="${cx - 48}" y="${cy - 5}" width="96" height="19" rx="9.5"/><rect x="${cx - 48}" y="${cy + 26}" width="62" height="19" rx="9.5"/></g>`
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="#fff" stroke-width="16"/>${g}`
}

const SK_FILTER =
  '<filter id="sk" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>'

// ─── mark renderers ─────────────────────────────────────────────────────
// Preview marks use a CSS-clipped div for the rounded corners so the dino
// hole shows through the dino-coloured background. Self-contained SVGs
// (export path) wrap everything in an SVG <clipPath> instead.

function Mark({
  opts, toolKey, accessory, dir, size = '100%'
}: {
  opts: MarkOpts
  toolKey: ToolKey
  accessory: boolean
  dir: 1 | 2 | 3 | 4
  size?: number | string
}) {
  const stroke = opts.ink ?? darken(opts.sq || '#fff')
  const showAcc = accessory && dir === 1
  const showBadge = opts.badge && !showAcc
  const accSvg = showAcc ? accessoryFor(toolKey, stroke) : ''
  const badgeSvg = showBadge ? tinyBadge(opts.badge!, opts.badgeBg!) : ''
  const borderSvg = opts.border
    ? `<rect x="13" y="13" width="437" height="438" rx="70" fill="none" stroke="${opts.border}" stroke-width="26"/>`
    : ''
  const inner =
    `<svg viewBox="0 0 463 464" style="display:block;width:100%;height:100%" xmlns="http://www.w3.org/2000/svg">
      <defs>${SK_FILTER}</defs>
      <path d="${DINO_PATH}" fill="${opts.sq}" fill-rule="evenodd"/>
      ${borderSvg}${badgeSvg}${accSvg}
    </svg>`
  return (
    <div
      style={{
        background: opts.dino,
        borderRadius: '18.4%',
        position: 'relative',
        overflow: 'hidden',
        width: size,
        height: size,
        flexShrink: 0
      }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

// ─── standalone SVG file builder (for the zip) ──────────────────────────

function buildSvgFile(
  dir: 1 | 2 | 3 | 4,
  t: Tool,
  colors: Record<ToolKey, string>,
  accessory: boolean
): string {
  const o = optsFor(dir, t, colors)
  const stroke = o.ink ?? darken(o.sq || '#fff')
  const showAcc = accessory && dir === 1
  const acc = showAcc ? accessoryFor(t.key, stroke) : ''
  const bdg = !showAcc && o.badge ? tinyBadge(o.badge, o.badgeBg!) : ''
  const border = o.border
    ? `<rect x="13" y="13" width="437" height="438" rx="70" fill="none" stroke="${o.border}" stroke-width="26"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 463 464" width="512" height="512" role="img" aria-label="Verbivore ${t.key} · direction ${dir}">
<defs>
  ${SK_FILTER}
  <clipPath id="r"><rect width="463" height="464" rx="82"/></clipPath>
</defs>
<g clip-path="url(#r)">
  <rect width="463" height="464" fill="${o.dino}"/>
  <path d="${DINO_PATH}" fill="${o.sq}" fill-rule="evenodd"/>
  ${border}${bdg}${acc}
</g>
</svg>`
}

// ─── tiny inline zip writer (STORE method, no deps) ─────────────────────

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tbl[i] = c >>> 0
  }
  return tbl
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface ZipEntry { name: string; data: Uint8Array }

function buildZip(files: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const sz = f.data.length
    const lh = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(lh.buffer)
    dv.setUint32(0, 0x04034b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 0, true)
    dv.setUint16(8, 0, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0x21, true)
    dv.setUint32(14, crc, true)
    dv.setUint32(18, sz, true)
    dv.setUint32(22, sz, true)
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true)
    lh.set(nameBytes, 30)
    parts.push(lh, f.data)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, sz, true)
    cv.setUint32(24, sz, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += lh.length + f.data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const cdOffset = offset
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdOffset, true)
  ev.setUint16(20, 0, true)
  // TS lib.dom narrowed BlobPart to ArrayBufferView<ArrayBuffer>, which
  // Uint8Array<ArrayBufferLike> doesn't satisfy without a copy. Cast — the
  // runtime accepts plain Uint8Arrays unchanged.
  return new Blob([...parts, ...central, eocd] as BlobPart[], {
    type: 'application/zip'
  })
}

// ──────────────────────────────────────────────────────────────────────────
// Panel
// ──────────────────────────────────────────────────────────────────────────

export default function BrandPanel() {
  const { t, mode } = useDashTheme()
  const [direction, setDirection] = useState<1 | 2 | 3 | 4>(1)
  const [accessory, setAccessory] = useState(true)
  const [colors, setColors] = useState<Record<ToolKey, string>>({ ...BRAND_DEFAULTS })
  const [status, setStatus] = useState<string>('')

  const accent = useMemo(
    () => optsFor(direction, TOOLS[1], colors).accent,
    [direction, colors]
  )

  const reset = useCallback(() => {
    setColors({ ...BRAND_DEFAULTS })
    setDirection(1)
    setAccessory(true)
  }, [])

  const exportPack = useCallback(async () => {
    try {
      setStatus('Building 16 SVGs…')
      const enc = new TextEncoder()
      const files: ZipEntry[] = []
      for (let dir = 1; dir <= 4; dir++) {
        for (const tool of TOOLS) {
          const svg = buildSvgFile(dir as 1 | 2 | 3 | 4, tool, colors, accessory)
          files.push({
            name: `svg/dir${dir}/verbivore-${tool.key}.svg`,
            data: enc.encode(svg)
          })
        }
      }
      const readme =
`Verbivore sub-brand logo pack
=============================

Exported from Backstage · /dashboard/settings/brand
Direction: 0${direction} · accessories: ${accessory ? 'on' : 'off'}
Colours: main ${colors.main} · backstage ${colors.backstage} · dashboard ${colors.dashboard} · docs ${colors.docs}

Folder layout
-------------
  svg/dir1/   colour family       (recommended)
  svg/dir2/   teal + symbol badge
  svg/dir3/   one colour, four weights
  svg/dir4/   colour + badge

  Each folder has four 512x512 SVGs:
      verbivore-main.svg       (learn.verbivore.app)
      verbivore-backstage.svg  (backstage.verbivore.app)
      verbivore-dashboard.svg  (dashboard.verbivore.app)
      verbivore-docs.svg       (docs.verbivore.app)

Drop into each site (example: backstage)
----------------------------------------
  <link rel="icon" type="image/svg+xml" href="/verbivore-backstage.svg">
`
      files.push({ name: 'README.txt', data: enc.encode(readme) })

      setStatus('Zipping…')
      const blob = buildZip(files)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `verbivore-sub-brands-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      setStatus(`Exported ${files.length} files`)
      setTimeout(() => setStatus(''), 4000)
    } catch (err) {
      setStatus(
        'Error: ' + (err instanceof Error ? err.message : 'unknown error')
      )
    }
  }, [colors, direction, accessory])

  const isDark = mode === 'dark'
  // The brand artwork was designed against the cream/paper palette. In dark
  // mode we shift to a faintly tinted surface so the white-grounded marks
  // stop glowing against pure black.
  const cardBg = isDark ? '#1d2a29' : '#FBFAF6'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(42,53,52,0.12)'
  const cardMutedInk = isDark ? '#9DB5B2' : '#6B7472'
  const cardInk = isDark ? '#EDEFEC' : '#2A3534'

  const active = DIRS.find((d) => d.n === direction)!

  return (
    <div className={`h-full overflow-y-auto p-6 ${t.text}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-medium text-lg" style={{ fontFamily: '"Fredoka", system-ui, sans-serif' }}>
              Verbivore sub-brands
            </h2>
            <p className={`mt-1 text-[11px] tracking-[0.12em] uppercase ${t.textMuted}`}>
              one dino · four front doors
            </p>
          </div>
        </header>

        <p className={`max-w-2xl text-sm leading-relaxed ${t.textMuted}`}>
          Same brontosaurus, same rounded badge - but each internal tool gets a
          distinct, instantly-readable identity so a row of tabs or a sidebar
          never leaves you guessing. Tweak the colours and accessories, then
          export the SVG pack.
        </p>

        {/* Palette chips */}
        <section className={`rounded-2xl border p-5 ${t.border} ${t.surface}`}>
          <h3 className={`mb-4 text-[11px] font-medium tracking-[0.14em] uppercase ${t.textMuted}`}>
            Core palette
          </h3>
          <div className="flex flex-wrap gap-6">
            {[
              { n: 'Brand · main', v: colors.main },
              { n: 'Brand · deep', v: darken(colors.main) },
              { n: 'Backstage',    v: colors.backstage },
              { n: 'Dashboard',    v: colors.dashboard },
              { n: 'Docs',         v: colors.docs }
            ].map((c) => (
              <div key={c.n} className="flex items-center gap-2.5">
                <div
                  className="size-8 rounded-lg"
                  style={{ background: c.v, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
                />
                <div className="text-[11px] leading-tight">
                  <span className={`block ${t.text}`}>{c.n}</span>
                  <span className={t.textMuted}>{c.v.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Customizer */}
        <section className={`rounded-2xl border p-5 ${t.border} ${t.surface}`}>
          <h3 className={`mb-4 flex items-center gap-3 text-[11px] font-medium tracking-[0.14em] uppercase ${t.textMuted}`}>
            <span>Customize · then export</span>
            <span className={`h-px flex-1 ${t.border} border-t`} />
          </h3>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className={`mb-2 text-[10px] tracking-[0.1em] uppercase ${t.textMuted}`}>
                Default direction
              </div>
              <div className={`inline-flex flex-wrap gap-1 rounded-xl p-1 ${t.surfaceMuted}`}>
                {DIRS.map((d) => (
                  <button
                    key={d.n}
                    onClick={() => setDirection(d.n)}
                    aria-pressed={direction === d.n}
                    className={`rounded-lg px-2.5 py-1 text-[11px] tracking-wide transition ${
                      direction === d.n
                        ? `${t.surface} ${t.text} shadow-sm`
                        : t.textMuted
                    }`}
                  >
                    0{d.n} {d.name.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={`mb-2 text-[10px] tracking-[0.1em] uppercase ${t.textMuted}`}>
                Accessories
              </div>
              <div className={`inline-flex gap-1 rounded-xl p-1 ${t.surfaceMuted}`}>
                {([
                  { v: true,  label: 'With cute items' },
                  { v: false, label: 'Plain' }
                ] as const).map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => setAccessory(opt.v)}
                    aria-pressed={accessory === opt.v}
                    className={`rounded-lg px-3 py-1 text-[11px] tracking-wide transition ${
                      accessory === opt.v
                        ? `${t.surface} ${t.text} shadow-sm`
                        : t.textMuted
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className={`mb-2 text-[10px] tracking-[0.1em] uppercase ${t.textMuted}`}>
                Per-tool colours
              </div>
              <div className="flex flex-wrap gap-4">
                {TOOLS.map((tool) => (
                  <label
                    key={tool.key}
                    className={`flex items-center gap-2 text-[11px] ${t.text}`}
                  >
                    <input
                      type="color"
                      value={colors[tool.key]}
                      onChange={(e) =>
                        setColors((c) => ({ ...c, [tool.key]: e.target.value }))
                      }
                      className={`size-8 cursor-pointer rounded-md border bg-transparent p-0.5 ${t.border}`}
                    />
                    {tool.key}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={exportPack}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-medium text-white transition hover:bg-teal-800"
            >
              <Download className="size-3.5" />
              Export pack (.zip)
            </button>
            <button
              onClick={reset}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] ${t.border} ${t.tab}`}
            >
              <RotateCcw className="size-3" />
              Reset to brand defaults
            </button>
            <span className={`text-[11px] ${t.textMuted}`}>
              Bundles 16 SVGs (4 directions × 4 tools) + a README.
            </span>
            {status && (
              <span className="text-[11px] text-teal-600 dark:text-teal-300">
                {status}
              </span>
            )}
          </div>
        </section>

        {/* Direction tabs */}
        <div
          className={`flex flex-wrap gap-1 border-b ${t.border}`}
        >
          {DIRS.map((d) => (
            <button
              key={d.n}
              role="tab"
              onClick={() => setDirection(d.n)}
              aria-selected={direction === d.n}
              className={`relative px-4 py-3 text-sm transition ${
                direction === d.n ? t.text : t.textMuted
              }`}
              style={{ fontFamily: '"Fredoka", system-ui, sans-serif', fontWeight: 500 }}
            >
              <span className="mr-1.5 text-[11px] opacity-60" style={{ fontFamily: 'ui-monospace, monospace' }}>
                0{d.n}
              </span>
              {d.name}
              {d.rec && (
                <span className="ml-2 rounded-full bg-teal-500/90 px-1.5 py-0.5 text-[9px] tracking-wider text-teal-950">
                  RECOMMENDED
                </span>
              )}
              {direction === d.n && (
                <span
                  className="absolute right-3 bottom-[-1px] left-3 h-[3px] rounded-full"
                  style={{ background: accent }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Active direction panel */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <h3 className={`text-xl ${t.text}`} style={{ fontFamily: '"Fredoka", system-ui, sans-serif', fontWeight: 600 }}>
              0{active.n} · {active.name}
            </h3>
            <p className={`mt-1 text-sm ${t.textMuted}`}>{active.blurb}</p>
          </div>
          <p
            className="max-w-[230px] text-base leading-snug"
            style={{ fontFamily: '"Caveat", cursive', color: accent }}
          >
            <span className="mr-1 opacity-55" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>✎</span>
            {active.note}
          </p>
        </div>

        {/* Family grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TOOLS.map((tool) => {
            const o = optsFor(direction, tool, colors)
            return (
              <div
                key={tool.key}
                className="flex flex-col items-center rounded-2xl px-5 pt-6 pb-5 text-center"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  outline: tool.key === 'main'
                    ? `2px dashed ${isDark ? 'rgba(237,239,236,0.18)' : 'rgba(42,53,52,0.18)'}`
                    : undefined,
                  outlineOffset: tool.key === 'main' ? -2 : undefined
                }}
              >
                <div style={{ width: 108, height: 108, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.10))' }}>
                  <Mark opts={o} toolKey={tool.key} accessory={accessory} dir={direction} />
                </div>
                <div className="mt-4 text-base" style={{ fontFamily: '"Fredoka", system-ui, sans-serif', fontWeight: 600, color: cardInk }}>
                  {tool.nm}
                  {tool.tag && (
                    <span className="ml-1 font-medium" style={{ color: o.ink }}>
                      {tool.tag}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: cardMutedInk, fontFamily: 'ui-monospace, monospace' }}>
                  {tool.role}
                </div>
                <div
                  className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] tracking-wide"
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    background: `color-mix(in oklab, ${o.accent} 20%, transparent)`,
                    color: o.ink
                  }}
                >
                  {o.swatch}
                </div>
              </div>
            )
          })}
        </div>

        {/* Favicon scale (backstage as example) */}
        <div
          className="flex flex-wrap items-end gap-5 rounded-2xl px-5 py-4"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          {[64, 32, 24, 16].map((px) => {
            const o = optsFor(direction, TOOLS[1], colors)
            return (
              <div key={px} className="flex flex-col items-center gap-1.5">
                <div style={{ width: px, height: px }}>
                  <Mark opts={o} toolKey={TOOLS[1].key} accessory={accessory} dir={direction} />
                </div>
                <span className="text-[9px]" style={{ color: cardMutedInk, fontFamily: 'ui-monospace, monospace' }}>
                  {px}px
                </span>
              </div>
            )
          })}
          <span
            className="ml-2 text-lg"
            style={{ fontFamily: '"Caveat", cursive', color: accent }}
          >
            still legible →
          </span>
        </div>

        {/* Lockups */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TOOLS.map((tool) => {
            const o = optsFor(direction, tool, colors)
            return (
              <div
                key={tool.key}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <Mark opts={o} toolKey={tool.key} accessory={accessory} dir={direction} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg leading-none" style={{ fontFamily: '"Fredoka", system-ui, sans-serif', fontWeight: 600, color: o.ink }}>
                    {tool.nm}
                  </div>
                  <span
                    className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] tracking-wide lowercase"
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      background: `color-mix(in oklab, ${o.accent} 22%, transparent)`,
                      color: o.ink
                    }}
                  >
                    {tool.tag || 'main'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Context: browser tab strip + sidebar rail */}
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
          >
            <div
              className="px-5 pt-4 text-[10px] tracking-[0.1em] uppercase"
              style={{ color: cardMutedInk, fontFamily: 'ui-monospace, monospace' }}
            >
              The tab test · can you tell them apart?
            </div>
            <div className="p-4">
              <div
                className="rounded-t-xl px-3 pt-3"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(42,53,52,0.06)' }}
              >
                <div className="mb-2 flex gap-1.5">
                  <i className="size-2.5 rounded-full" style={{ background: 'rgba(127,127,127,0.4)' }} />
                  <i className="size-2.5 rounded-full" style={{ background: 'rgba(127,127,127,0.4)' }} />
                  <i className="size-2.5 rounded-full" style={{ background: 'rgba(127,127,127,0.4)' }} />
                </div>
                <div className="flex gap-1">
                  {TOOLS.map((tool, i) => {
                    const o = optsFor(direction, tool, colors)
                    const name = tool.tag
                      ? tool.tag[0].toUpperCase() + tool.tag.slice(1)
                      : 'Verbivore'
                    const isActive = i === 1
                    return (
                      <div
                        key={tool.key}
                        className="flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-[12px] whitespace-nowrap"
                        style={{
                          background: isActive
                            ? cardBg
                            : isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(42,53,52,0.04)',
                          color: isActive ? cardInk : cardMutedInk,
                          fontWeight: isActive ? 600 : 400
                        }}
                      >
                        <div style={{ width: 17, height: 17, flexShrink: 0 }}>
                          <Mark opts={o} toolKey={tool.key} accessory={accessory} dir={direction} />
                        </div>
                        <span>{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-b-xl px-4 py-3"
                style={{ background: cardBg }}
              >
                <div
                  className="flex h-6 flex-1 items-center gap-2 rounded-full px-3 text-[11px]"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(42,53,52,0.06)',
                    color: cardMutedInk,
                    fontFamily: 'ui-monospace, monospace'
                  }}
                >
                  <div style={{ width: 13, height: 13, flexShrink: 0 }}>
                    <Mark
                      opts={optsFor(direction, TOOLS[1], colors)}
                      toolKey={TOOLS[1].key}
                      accessory={accessory}
                      dir={direction}
                    />
                  </div>
                  <span>{TOOLS[1].url}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
          >
            <div
              className="px-5 pt-4 text-[10px] tracking-[0.1em] uppercase"
              style={{ color: cardMutedInk, fontFamily: 'ui-monospace, monospace' }}
            >
              App switcher / sidebar rail
            </div>
            <div className="flex gap-4 p-4">
              <div
                className="flex flex-col items-center gap-3 rounded-2xl px-2.5 py-3"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(42,53,52,0.06)' }}
              >
                {TOOLS.map((tool, i) => {
                  const o = optsFor(direction, tool, colors)
                  return (
                    <div key={tool.key} className="relative">
                      {i === 0 && (
                        <span
                          className="absolute top-1/2 -left-[10px] h-5 w-1 -translate-y-1/2 rounded-sm"
                          style={{ background: accent }}
                        />
                      )}
                      <div style={{ width: 40, height: 40 }}>
                        <Mark opts={o} toolKey={tool.key} accessory={accessory} dir={direction} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-1 flex-col gap-2 pt-1">
                {TOOLS.map((tool, i) => {
                  const o = optsFor(direction, tool, colors)
                  const name = tool.tag
                    ? tool.tag[0].toUpperCase() + tool.tag.slice(1)
                    : 'Home'
                  return (
                    <div
                      key={tool.key}
                      className="flex items-center gap-2.5 text-[13px]"
                      style={{
                        color: i === 0 ? cardInk : cardMutedInk,
                        fontWeight: i === 0 ? 600 : 400
                      }}
                    >
                      <div style={{ width: 24, height: 24, flexShrink: 0 }}>
                        <Mark opts={o} toolKey={tool.key} accessory={accessory} dir={direction} />
                      </div>
                      <span>{name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation footer */}
        <footer
          className="flex flex-wrap items-start gap-6 rounded-2xl p-6"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div style={{ width: 56, height: 56, flexShrink: 0 }}>
            <Mark
              opts={{ sq: colors.main, dino: '#fff', accent: colors.main, swatch: '' }}
              toolKey="main"
              accessory={accessory}
              dir={1}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base" style={{ fontFamily: '"Fredoka", system-ui, sans-serif', fontWeight: 600, color: cardInk }}>
              Recommendation
            </h4>
            <p className="mt-2 text-sm" style={{ color: cardMutedInk }}>
              Ship <b style={{ color: cardInk }}>Direction 1 (Colour family)</b>{' '}
              as the default - a single hue per tool is the cheapest thing for
              the eye to decode and it scales perfectly down to a 16px favicon,
              which is exactly where the confusion bites. Keep the main app on
              <b style={{ color: cardInk }}> teal</b> so it stays &quot;home base.&quot;
            </p>
            <p className="mt-2 text-sm" style={{ color: cardMutedInk }}>
              If you want belt-and-suspenders clarity in dense tab strips, use{' '}
              <b style={{ color: cardInk }}>Direction 4 (Colour + badge)</b>.{' '}
              <b style={{ color: cardInk }}>Direction 3</b> is the move if
              you&apos;d rather not introduce any new colour at all.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
