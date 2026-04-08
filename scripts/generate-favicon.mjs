/**
 * Generates favicon assets from public/logo.png
 * Run once: node scripts/generate-favicon.mjs
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const logoPath = resolve(root, 'public', 'logo.png');

// Generate PNG favicons at standard sizes
const sizes = [16, 32, 48, 96, 192];
for (const size of sizes) {
    await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(resolve(root, 'public', `favicon-${size}x${size}.png`));
    console.log(`✓ favicon-${size}x${size}.png`);
}

// Generate apple-touch-icon (180x180)
await sharp(logoPath)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(root, 'public', 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png (180x180)');

// Build a minimal .ico file (16x16 + 32x32 layers)
// ICO format: ICONDIR + ICONDIRENTRY[] + image data
const px16 = await sharp(logoPath)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

const px32 = await sharp(logoPath)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

// ICO header: reserved(2) + type(2) + count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);  // reserved
header.writeUInt16LE(1, 2);  // type: 1 = ICO
header.writeUInt16LE(2, 4);  // 2 images

// Each ICONDIRENTRY is 16 bytes
const entry16 = Buffer.alloc(16);
const entry32 = Buffer.alloc(16);

const dataOffset = 6 + 16 * 2; // header + 2 entries

entry16.writeUInt8(16, 0);          // width
entry16.writeUInt8(16, 1);          // height
entry16.writeUInt8(0, 2);           // color count (0 = > 256)
entry16.writeUInt8(0, 3);           // reserved
entry16.writeUInt16LE(1, 4);        // color planes
entry16.writeUInt16LE(32, 6);       // bits per pixel
entry16.writeUInt32LE(px16.length, 8);  // size
entry16.writeUInt32LE(dataOffset, 12);  // offset

entry32.writeUInt8(32, 0);
entry32.writeUInt8(32, 1);
entry32.writeUInt8(0, 2);
entry32.writeUInt8(0, 3);
entry32.writeUInt16LE(1, 4);
entry32.writeUInt16LE(32, 6);
entry32.writeUInt32LE(px32.length, 8);
entry32.writeUInt32LE(dataOffset + px16.length, 12);

const ico = Buffer.concat([header, entry16, entry32, px16, px32]);
writeFileSync(resolve(root, 'public', 'favicon.ico'), ico);
console.log('✓ favicon.ico (16x16 + 32x32)');

console.log('\nAll favicon assets generated in public/');
