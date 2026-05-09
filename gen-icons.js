// Generates icon-192.png and icon-512.png using only built-in Node modules
// (writes minimal valid PNGs with the app's colour scheme via raw pixel data + zlib)
const zlib = require('zlib');
const fs   = require('fs');

function makePNG(size) {
  const bg   = [15, 17, 23];       // #0f1117
  const blue = [79, 142, 247];      // #4f8ef7
  const lite = [126, 184, 255];     // #7eb8ff

  // --- pixel buffer ---
  const pixels = Buffer.alloc(size * size * 4);

  function set(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  }

  function fill(r, g, b) {
    for (let i = 0; i < size * size * 4; i += 4) {
      pixels[i]=r; pixels[i+1]=g; pixels[i+2]=b; pixels[i+3]=255;
    }
  }

  // Anti-aliased circle helper
  function circle(cx, cy, rad, r, g, b) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x-cx)**2 + (y-cy)**2);
        const aa = Math.max(0, Math.min(1, rad - d + 0.5));
        if (aa > 0) {
          const i = (y * size + x) * 4;
          pixels[i]   = Math.round(pixels[i]   * (1-aa) + r * aa);
          pixels[i+1] = Math.round(pixels[i+1] * (1-aa) + g * aa);
          pixels[i+2] = Math.round(pixels[i+2] * (1-aa) + b * aa);
          pixels[i+3] = 255;
        }
      }
    }
  }

  // Rounded-rect helper
  function roundRect(x0, y0, w, h, rad, r, g, b) {
    for (let y = y0; y < y0+h; y++) {
      for (let x = x0; x < x0+w; x++) {
        const rx = Math.max(x0+rad-x, x-(x0+w-rad), 0);
        const ry = Math.max(y0+rad-y, y-(y0+h-rad), 0);
        const d  = Math.sqrt(rx*rx + ry*ry);
        const aa = Math.max(0, Math.min(1, rad - d + 0.5));
        if (aa > 0) {
          const i = (y * size + x) * 4;
          pixels[i]   = Math.round(pixels[i]   * (1-aa) + r * aa);
          pixels[i+1] = Math.round(pixels[i+1] * (1-aa) + g * aa);
          pixels[i+2] = Math.round(pixels[i+2] * (1-aa) + b * aa);
          pixels[i+3] = 255;
        }
      }
    }
  }

  // Draw flame shape using a point-in-polygon / parametric approach
  function inFlame(px, py, cx, cy, s) {
    // normalise to -1..1 coords centred on flame
    const nx = (px - cx) / s;
    const ny = (py - cy) / s;   // positive = down
    // outer boundary: roughly a teardrop pointing up
    // upper teardrop: |x| <= sqrt(max(0, 0.9 - (y+0.4)^2 * 1.6))
    const yt = ny + 0.3;
    const outer = Math.sqrt(Math.max(0, 0.85 - yt*yt * 1.7));
    if (Math.abs(nx) > outer) return false;
    // bottom cutoff
    if (ny > 0.65) return false;
    // top: must be above y = -0.9
    if (ny < -0.9) return false;
    return true;
  }

  function inFlameInner(px, py, cx, cy, s) {
    const nx = (px - cx) / s;
    const ny = (py - cy) / s;
    const yt = ny + 0.0;
    const outer = Math.sqrt(Math.max(0, 0.25 - yt*yt * 2.5));
    if (Math.abs(nx) > outer) return false;
    if (ny > 0.2 || ny < -0.65) return false;
    return true;
  }

  const s = size;
  const cx = s / 2;
  const cy = s / 2 - s * 0.04;
  const flameScale = s * 0.28;

  // --- draw ---
  fill(...bg);

  // rounded square background (fill whole canvas with bg already done; add subtle lighter bg circle)
  roundRect(0, 0, s, s, s * 0.21, ...bg);

  // Outer flame
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (inFlame(x, y, cx, cy, flameScale)) {
        set(x, y, ...blue);
      }
    }
  }
  // Inner highlight
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (inFlameInner(x, y, cx, cy + s*0.04, flameScale * 0.72)) {
        const i = (y * s + x) * 4;
        pixels[i]   = Math.round(pixels[i]   * 0.35 + lite[0] * 0.65);
        pixels[i+1] = Math.round(pixels[i+1] * 0.35 + lite[1] * 0.65);
        pixels[i+2] = Math.round(pixels[i+2] * 0.35 + lite[2] * 0.65);
      }
    }
  }

  // Plate line at bottom
  const plateY  = Math.round(cy + flameScale * 1.05);
  const plateX0 = Math.round(cx - flameScale * 0.85);
  const plateX1 = Math.round(cx + flameScale * 0.85);
  const lineW   = Math.max(2, Math.round(s * 0.025));
  for (let dx = plateX0; dx <= plateX1; dx++) {
    for (let t = -Math.floor(lineW/2); t <= Math.floor(lineW/2); t++) {
      set(dx, plateY + t, ...blue);
    }
  }

  // --- encode PNG ---
  // Raw image data: each row is filter byte (0x00 = None) + RGBA pixels
  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter = None
    pixels.copy(raw, y * rowLen + 1, y * size * 4, (y+1) * size * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  function u32be(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }
  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const len   = u32be(data.length);
    const crcBuf = Buffer.concat([typeB, data]);
    const crc   = u32be(crc32(crcBuf));
    return Buffer.concat([len, typeB, data, crc]);
  }

  // CRC-32
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const IHDR_data = Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 2, 0, 0, 0])   // bit depth=8, colorType=2 (RGB)
  ]);
  // Rebuild as RGB (drop alpha channel since colorType=2)
  const rawRGB = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    rawRGB[y * (1 + size*3)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size*3) + 1 + x*3;
      rawRGB[dst]   = pixels[src];
      rawRGB[dst+1] = pixels[src+1];
      rawRGB[dst+2] = pixels[src+2];
    }
  }
  const compRGB = zlib.deflateSync(rawRGB, { level: 6 });

  const IHDR_data2 = Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 2, 0, 0, 0])
  ]);

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', IHDR_data2),
    chunk('IDAT', compRGB),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync('icon-192.png', makePNG(192));
fs.writeFileSync('icon-512.png', makePNG(512));
console.log('Generated icon-192.png and icon-512.png');
