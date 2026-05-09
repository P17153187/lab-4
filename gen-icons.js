// Generates all app icon PNGs using only built-in Node modules
const zlib = require('zlib');
const fs   = require('fs');

function makePNG(size) {
  const bg = [15, 17, 23];         // #0f1117
  const track  = [26, 35, 64];     // #1a2340
  const blue   = [79, 142, 247];   // #4f8ef7
  const purple = [139, 92, 246];   // #8b5cf6
  const pink   = [244, 114, 182];  // #f472b6
  const fork   = [221, 222, 255];  // #ddeeff

  const pixels = Buffer.alloc(size * size * 4);
  const s = size;
  const cx = s / 2, cy = s / 2;

  function set(x, y, r, g, b, alpha = 1) {
    if (x < 0 || x >= s || y < 0 || y >= s) return;
    const i = (y * s + x) * 4;
    const a = alpha;
    pixels[i]   = Math.round(pixels[i]   * (1 - a) + r * a);
    pixels[i+1] = Math.round(pixels[i+1] * (1 - a) + g * a);
    pixels[i+2] = Math.round(pixels[i+2] * (1 - a) + b * a);
    pixels[i+3] = 255;
  }

  // Fill background
  for (let i = 0; i < s * s * 4; i += 4) {
    pixels[i] = bg[0]; pixels[i+1] = bg[1]; pixels[i+2] = bg[2]; pixels[i+3] = 255;
  }

  // Rounded rect mask (cut corners)
  const rr = Math.round(s * 0.22);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = Math.max(rr - x, x - (s - 1 - rr), 0);
      const dy = Math.max(rr - y, y - (s - 1 - rr), 0);
      if (Math.sqrt(dx * dx + dy * dy) > rr) {
        const i = (y * s + x) * 4;
        pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = 0;
      }
    }
  }

  // Ring drawing
  // Segments (in degrees, starting from top = -90°):
  // blue:   0°  → 108°  (66/220 * 360)
  // purple: 108° → 252° (88/220 * 360)
  // pink:   252° → 324° (44/220 * 360)
  // gap:    324° → 360°
  const R  = s * 0.35;   // ring radius
  const SW = s * 0.08;   // stroke width
  const r0 = R - SW / 2;
  const r1 = R + SW / 2;

  const segments = [
    { start: -90,    end: 18,     color: blue   },
    { start: 18,     end: 162,    color: purple },
    { start: 162,    end: 234,    color: pink   },
  ];

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r0 - 1 || dist > r1 + 1) continue;

      let angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
      if (angle < -90) angle += 360; // shift so -90 maps to 0 base

      // ring edge anti-alias
      const edgeAA = Math.min(
        Math.max(0, Math.min(1, dist - r0 + 0.5)),
        Math.max(0, Math.min(1, r1 - dist + 0.5))
      );

      // check track
      let col = track;
      for (const seg of segments) {
        if (angle >= seg.start && angle < seg.end) { col = seg.color; break; }
      }

      set(x, y, col[0], col[1], col[2], edgeAA);
    }
  }

  // Fork drawing (scaled to icon size)
  // Reference coords (100-unit space): tines at x=43,47.5,52.5,57 from y=36..47
  // crossbar y=47 x=43..57, neck to x=50 y=53, handle to y=66
  const sc = s / 100;

  function line(x1, y1, x2, y2, sw, col) {
    // Bresenham-style with anti-aliasing, perpendicular thickness
    const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    if (len === 0) return;
    const steps = Math.ceil(len * 2);
    const hw = sw / 2;
    // perpendicular direction
    const px = -(y2-y1)/len, py = (x2-x1)/len;
    for (let t = 0; t <= steps; t++) {
      const bx = x1 + (x2-x1)*t/steps;
      const by = y1 + (y2-y1)*t/steps;
      // draw across perpendicular
      for (let p = -Math.ceil(hw+1); p <= Math.ceil(hw+1); p++) {
        const fx = bx + px * p, fy = by + py * p;
        const ix = Math.round(fx), iy = Math.round(fy);
        const dist = Math.abs(p);
        const aa = Math.max(0, Math.min(1, hw - dist + 0.5));
        if (aa > 0) set(ix, iy, col[0], col[1], col[2], aa);
      }
    }
  }

  const tw = s * 0.022; // thin stroke width (2.2 scaled)
  const hw = s * 0.028; // handle stroke width (2.8 scaled)

  // 4 tines
  line(43*sc, 36*sc, 43*sc,   47*sc, tw, fork);
  line(47.5*sc, 36*sc, 47.5*sc, 47*sc, tw, fork);
  line(52.5*sc, 36*sc, 52.5*sc, 47*sc, tw, fork);
  line(57*sc, 36*sc, 57*sc,   47*sc, tw, fork);
  // crossbar
  line(43*sc, 47*sc, 57*sc, 47*sc, tw, fork);
  // neck taper
  line(46*sc, 47*sc, 50*sc, 53*sc, tw, fork);
  line(54*sc, 47*sc, 50*sc, 53*sc, tw, fork);
  // handle
  line(50*sc, 53*sc, 50*sc, 66*sc, hw, fork);

  // Encode PNG
  const rawRGB = Buffer.alloc(s * (1 + s * 3));
  for (let y = 0; y < s; y++) {
    rawRGB[y * (1 + s*3)] = 0;
    for (let x = 0; x < s; x++) {
      const src = (y * s + x) * 4;
      const dst = y * (1 + s*3) + 1 + x*3;
      rawRGB[dst]   = pixels[src];
      rawRGB[dst+1] = pixels[src+1];
      rawRGB[dst+2] = pixels[src+2];
    }
  }
  const comp = zlib.deflateSync(rawRGB, { level: 6 });

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
  function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b; }
  function chunk(type, data) {
    const tb = Buffer.from(type, 'ascii');
    return Buffer.concat([u32(data.length), tb, data, u32(crc32(Buffer.concat([tb, data])))]);
  }

  const ihdr = Buffer.concat([u32(s), u32(s), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', comp),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// PWA icons
fs.writeFileSync('icon-192.png', makePNG(192));
fs.writeFileSync('icon-512.png', makePNG(512));

// Android mipmap icons
fs.writeFileSync('android-build/res/mipmap-mdpi/ic_launcher.png',   makePNG(48));
fs.writeFileSync('android-build/res/mipmap-hdpi/ic_launcher.png',   makePNG(72));
fs.writeFileSync('android-build/res/mipmap-xhdpi/ic_launcher.png',  makePNG(96));
fs.writeFileSync('android-build/res/mipmap-xxhdpi/ic_launcher.png', makePNG(144));

console.log('Icons generated.');
