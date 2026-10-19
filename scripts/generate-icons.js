/**
 * BearBox Icon Generator
 * Generates PNG icon files (16, 32, 48, 128) using pure Node.js and zlib.
 * Creates a charming, high-contrast BearBox bear face on a rounded gradient box.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createBearBoxIconPNG(size) {
  // RGBA buffer (size x size x 4)
  const buffer = Buffer.alloc(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rectangle / badge background
      // Primary blue: #2563eb (37, 99, 235) to #1d4ed8 (29, 78, 216)
      const cornerR = size * 0.22;
      const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
      const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
      const distFromCorner = Math.sqrt(dx * dx + dy * dy);

      if (distFromCorner > cornerR) {
        // Transparent outside badge
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
        continue;
      }

      // Base badge gradient
      const grad = y / size;
      let r = Math.round(37 + (20 - 37) * grad);
      let g = Math.round(99 + (60 - 99) * grad);
      let b = Math.round(235 + (220 - 235) * grad);
      let a = 255;

      // Antialiasing on badge edges
      if (distFromCorner > cornerR - 1) {
        const edgeAlpha = Math.max(0, Math.min(1, cornerR - distFromCorner));
        a = Math.round(255 * edgeAlpha);
      }

      // Draw Bear Elements:
      // Left ear
      const leftEarDist = Math.hypot(x - (cx - size * 0.22), y - (cy - size * 0.22));
      // Right ear
      const rightEarDist = Math.hypot(x - (cx + size * 0.22), y - (cy - size * 0.22));
      const earR = size * 0.14;
      const innerEarR = size * 0.08;

      const isEar = leftEarDist < earR || rightEarDist < earR;
      const isInnerEar = leftEarDist < innerEarR || rightEarDist < innerEarR;

      // Bear head
      const headDist = Math.hypot(x - cx, y - (cy + size * 0.04));
      const headR = size * 0.28;
      const isHead = headDist < headR;

      // Bear muzzle
      const muzzleDist = Math.hypot((x - cx) * 1.15, y - (cy + size * 0.12));
      const muzzleR = size * 0.13;
      const isMuzzle = muzzleDist < muzzleR;

      // Bear nose
      const noseDist = Math.hypot((x - cx) * 1.3, y - (cy + size * 0.08));
      const noseR = size * 0.045;
      const isNose = noseDist < noseR;

      // Eyes
      const leftEyeDist = Math.hypot(x - (cx - size * 0.11), y - (cy + size * 0.01));
      const rightEyeDist = Math.hypot(x - (cx + size * 0.11), y - (cy + size * 0.01));
      const eyeR = Math.max(size * 0.038, 1);
      const isEye = leftEyeDist < eyeR || rightEyeDist < eyeR;

      // Render bear features with crisp colors
      if (isNose) {
        // Dark navy nose
        r = 15;
        g = 23;
        b = 42;
      } else if (isEye) {
        // Dark navy eyes
        r = 15;
        g = 23;
        b = 42;
      } else if (isMuzzle) {
        // Soft creamy white snout
        r = 241;
        g = 245;
        b = 249;
      } else if (isInnerEar) {
        // Soft warm inner ear
        r = 147;
        g = 197;
        b = 253; // soft sky blue accent
      } else if (isHead || isEar) {
        // Clean white bear silhouette
        r = 255;
        g = 255;
        b = 255;
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  return encodePNG(size, size, buffer);
}

// Encode uncompressed/deflated raw RGBA buffer into standard PNG format
function encodePNG(width, height, rgbaBuffer) {
  // Prepend filter byte (0 = None) for each scanline
  const scanlineLength = width * 4;
  const rawData = Buffer.alloc(height * (scanlineLength + 1));

  for (let y = 0; y < height; y++) {
    const rawOffset = y * (scanlineLength + 1);
    rawData[rawOffset] = 0; // Filter: None
    rgbaBuffer.copy(rawData, rawOffset + 1, y * scanlineLength, (y + 1) * scanlineLength);
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth: 8
  ihdrData.writeUInt8(6, 9); // color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // compression method: 0
  ihdrData.writeUInt8(0, 11); // filter method: 0
  ihdrData.writeUInt8(0, 12); // interlace method: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcTarget);
  chunk.writeUInt32BE(crc >>> 0, 8 + length);
  return chunk;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const outputDir = path.resolve('public/icons');
fs.mkdirSync(outputDir, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const pngBuf = createBearBoxIconPNG(size);
  const outPath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated: ${outPath} (${size}x${size}, ${pngBuf.length} bytes)`);
}

console.log('All BearBox icons successfully generated!');
