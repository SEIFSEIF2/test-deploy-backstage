#!/usr/bin/env node
/**
 * Rasterize public/logos/verbivore-mark.svg into every PNG + ICO size
 * referenced by the app (favicon, apple-touch, PWA, maskable, shortcut)
 * plus the social share image (Open Graph / Twitter / LinkedIn).
 *
 * Run once whenever the brand mark changes:
 *   pnpm logos:generate
 *
 * Inputs:
 *   public/logos/verbivore-mark.svg         ← white-ground variant
 *                                             (PWA / apple-touch / OG)
 *   public/logos/verbivore-mark-filled.svg  ← brand-color-ground variant
 *                                             (favicon.ico, so the tab
 *                                             icon stays legible on any
 *                                             browser chrome)
 *
 * Outputs (overwritten):
 *   public/logos/favicon.ico                  (32px)
 *   public/logos/pwa-64x64.png                (64px)
 *   public/logos/shortcut-96x96.png           (96px)
 *   public/logos/apple-touch-icon-180x180.png (180px)
 *   public/logos/pwa-192x192.png              (192px)
 *   public/logos/pwa-512x512.png              (512px)
 *   public/logos/maskable-icon-512x512.png    (512px, no rounded clip)
 *   public/og/og-image.png                    (1200x630 social share)
 *
 * Maskable note: Android masking trims the icon to a circle/squircle/etc.
 * Our brand mark already has a rounded-square clip; for the maskable
 * variant we strip that clip so the OS gets a full-bleed white square
 * to mask. The carved violet dino sits dead-centre inside the
 * mandatory safe zone.
 *
 * OG note: 1200x630 is the Open Graph standard and is accepted by every
 * major platform (Facebook, LinkedIn, Slack, Discord, Twitter). The
 * composition is a centred badge mark + product name in a system font
 * — librsvg's font support is limited so we deliberately don't reach
 * for Fredoka here; the wordmark already carries the brand identity
 * elsewhere.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

// Tiny single-size PNG-embedded ICO. png-to-ico would auto-generate
// 7 sizes (16/24/32/48/64/128/256) and balloon the .ico to ~280 KB;
// we only need 32x32, and modern browsers prefer favicon.svg anyway.
// The ICO format is just an ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes)
// + the PNG payload, total 22 bytes of header.
function wrapPngInIco(pngBuf, size = 32) {
  const header = Buffer.alloc(22);
  // ICONDIR
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // image count
  // ICONDIRENTRY
  header.writeUInt8(size === 256 ? 0 : size, 6); // width (0 means 256)
  header.writeUInt8(size === 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette colors (0 = no palette)
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBuf.length, 14); // image data size
  header.writeUInt32LE(22, 18); // offset to image data
  return Buffer.concat([header, pngBuf]);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/logos/verbivore-mark.svg");
const SRC_FILLED = path.join(ROOT, "public/logos/verbivore-mark-filled.svg");
const DEST_DIR = path.join(ROOT, "public/logos");

const PNG_TARGETS = [
  { name: "pwa-64x64.png", size: 64 },
  { name: "shortcut-96x96.png", size: 96 },
  { name: "apple-touch-icon-180x180.png", size: 180 },
  { name: "pwa-192x192.png", size: 192 },
  { name: "pwa-512x512.png", size: 512 },
];

const sourceSvg = await readFile(SRC, "utf8");

// Maskable variant: strip the rounded-square clip so the icon is a
// full-bleed white square with the carved teal mark centred. Android
// masking will then crop the outer 10% safe zone as needed.
const maskableSvg = sourceSvg
  .replace(/rx="\d+"/, 'rx="0"')
  .replace(/<clipPath[^>]*>[\s\S]*?<\/clipPath>/, "")
  .replace(/clip-path="url\(#[^)]+\)"/, "");

async function rasterize(svgBuf, size, outPath) {
  await sharp(svgBuf, { density: 384 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${path.relative(ROOT, outPath)}`);
}

// Standard PNGs from the rounded-badge SVG.
const svgBuf = Buffer.from(sourceSvg);
for (const { name, size } of PNG_TARGETS) {
  await rasterize(svgBuf, size, path.join(DEST_DIR, name));
}

// Maskable: full-bleed square (no rounded clip).
await rasterize(
  Buffer.from(maskableSvg),
  512,
  path.join(DEST_DIR, "maskable-icon-512x512.png"),
);

// favicon.ico: single 32x32 PNG wrapped in a minimal ICO container.
// Sourced from the FILLED variant (brand-color ground, transparent
// letterform) because at 32px the white-ground version disappears
// against light browser tab chrome.
const filledSvg = await readFile(SRC_FILLED, "utf8");
const favPng = await sharp(Buffer.from(filledSvg), { density: 384 })
  .resize(32, 32, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(path.join(DEST_DIR, "favicon.ico"), wrapPngInIco(favPng, 32));
console.log("✓ public/logos/favicon.ico  (from verbivore-mark-filled.svg)");

// ----------------------------------------------------------------------
// OG / social share image (1200x630)
// ----------------------------------------------------------------------
//
// Extract just the path data + colour from the source mark so the OG
// SVG stays in lockstep with whatever colour the brand mark currently
// uses (Backstage violet today, future sub-brand hues). Falls back to
// Backstage violet if the regex can't find a fill.
const pathMatch = sourceSvg.match(/<path[^>]*\sd="([^"]+)"/);
const fillMatch = sourceSvg.match(/<path[^>]*\sfill="(#[0-9A-Fa-f]{3,8})"/);
if (!pathMatch) {
  throw new Error("Could not extract <path d=…> from verbivore-mark.svg");
}
const markPath = pathMatch[1];
const markFill = fillMatch?.[1] ?? "#948CC0";

// Layout maths (canvas 1200x630):
//   - Mark: 200x200, centred at (500, 165). Source viewBox is 463x464
//     so scale ≈ 0.432.
//   - Title: y=440, font-size 60, weight 600.
//   - Tagline: y=496, font-size 26, weight 400.
// System font stack — librsvg picks the first one available on the
// build host; on macOS that's typically SF Pro, on Linux DejaVu Sans.
const OG_BG = "#ECE7DB"; // brand cream (from the Sub-brand Logos doc)
const OG_INK = "#2A3534"; // brand ink
const OG_MUTED = "#5A5852"; // brand muted-ink
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${OG_BG}"/>
  <g transform="translate(500 165) scale(0.432)">
    <defs>
      <clipPath id="og-mark-clip"><rect width="463" height="464" rx="82"/></clipPath>
    </defs>
    <g clip-path="url(#og-mark-clip)">
      <rect width="463" height="464" fill="#FFFFFF"/>
      <path fill="${markFill}" fill-rule="evenodd" d="${markPath}"/>
    </g>
  </g>
  <text x="600" y="440" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        font-size="60" font-weight="600" fill="${OG_INK}"
        letter-spacing="-1">Verbivore Backstage</text>
  <text x="600" y="496" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
        font-size="26" font-weight="400" fill="${OG_MUTED}">Internal ops, planning, handoffs</text>
</svg>`;

const OG_DIR = path.join(ROOT, "public/og");
await mkdir(OG_DIR, { recursive: true });
await sharp(Buffer.from(ogSvg), { density: 192 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(path.join(OG_DIR, "og-image.png"));
console.log("✓ public/og/og-image.png");

console.log("\nDone. Commit the generated PNGs / ICO.");
