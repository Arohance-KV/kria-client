/**
 * Generates public/og-image.png (1200x630) for Kria Sports social sharing.
 * Run once: node scripts/generate-og-image.mjs
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Read and base64-encode the logo so it can be embedded in the SVG
const logoPath = resolve(root, 'public', 'logo.png');
const logoBase64 = readFileSync(logoPath).toString('base64');
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

const W = 1200;
const H = 630;
const ORANGE = '#F97316';

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Radial glow behind the logo area -->
    <radialGradient id="glow" cx="75%" cy="45%" r="55%">
      <stop offset="0%"  stop-color="${ORANGE}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <!-- Left-edge subtle gradient so text pops -->
    <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>

    <!-- Bottom vignette -->
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="60%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
    </linearGradient>

    <clipPath id="logoClip">
      <rect x="720" y="80" width="420" height="470" rx="24"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#000000"/>

  <!-- Subtle dot-grid texture via repeating pattern -->
  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1" fill="${ORANGE}" opacity="0.08"/>
  </pattern>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>

  <!-- Orange ambient glow -->
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Thin horizontal rule -->
  <rect x="80" y="320" width="520" height="2" fill="${ORANGE}" opacity="0.4" rx="1"/>

  <!-- Logo — large, right-leaning -->
  <image
    href="${logoDataUrl}"
    x="700" y="60"
    width="440" height="510"
    preserveAspectRatio="xMidYMid meet"
    opacity="0.95"
  />

  <!-- Left fade so text always readable -->
  <rect width="${W}" height="${H}" fill="url(#leftFade)"/>
  <!-- Bottom vignette -->
  <rect width="${W}" height="${H}" fill="url(#bottomFade)"/>

  <!-- Orange accent bar (left edge) -->
  <rect x="80" y="140" width="6" height="200" fill="${ORANGE}" rx="3"/>

  <!-- KRIA wordmark -->
  <text
    x="112" y="278"
    font-family="Arial Black, Impact, sans-serif"
    font-weight="900"
    font-size="148"
    letter-spacing="-4"
    fill="${ORANGE}"
    dominant-baseline="auto"
  >KRIA</text>

  <!-- SPORTS -->
  <text
    x="115" y="356"
    font-family="Arial Black, Impact, sans-serif"
    font-weight="900"
    font-size="72"
    letter-spacing="18"
    fill="#FFFFFF"
    opacity="0.92"
  >SPORTS</text>

  <!-- Tagline -->
  <text
    x="115" y="430"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="400"
    font-size="26"
    letter-spacing="1"
    fill="#9CA3AF"
  >Tournament Management &amp; Auction Platform</text>

  <!-- Domain badge -->
  <rect x="114" y="475" width="200" height="44" rx="22" fill="${ORANGE}" opacity="0.12"/>
  <rect x="114" y="475" width="200" height="44" rx="22" fill="none" stroke="${ORANGE}" stroke-width="1.5" opacity="0.5"/>
  <text
    x="214" y="503"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="600"
    font-size="20"
    fill="${ORANGE}"
    text-anchor="middle"
  >kria.club</text>
</svg>
`.trim();

const outputPath = resolve(root, 'public', 'og-image.png');

await sharp(Buffer.from(svg))
  .png({ quality: 95, compressionLevel: 8 })
  .toFile(outputPath);

console.log(`✓ OG image generated → public/og-image.png (${W}×${H})`);
