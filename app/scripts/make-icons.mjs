// Generates PNG app icons (no dependencies): deep-teal square, white horizon wave and a sun dot.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(out, { recursive: true });

function render(size, { maskable }) {
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);
  const teal = [15, 107, 99];
  const white = [255, 255, 255];
  const radius = maskable ? 0 : size * 0.22;
  const scale = maskable ? 0.72 : 0.86; // safe zone for maskable icons
  const cx = size / 2;
  const amp = size * 0.1 * scale;
  const half = size * 0.36 * scale;
  const thick = size * 0.055 * scale;
  const f = (x) => size * 0.56 + amp * Math.sin(((x - (cx - half)) / (2 * half)) * Math.PI * 2);
  const df = (x) => amp * Math.cos(((x - (cx - half)) / (2 * half)) * Math.PI * 2) * ((Math.PI * 2) / (2 * half));
  const dot = { x: cx + half * 0.38, y: size * 0.33 * (maskable ? 1.08 : 1), r: size * 0.07 * scale };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          // rounded-square coverage
          let inside = true;
          if (radius > 0) {
            const qx = Math.max(radius - x, x - (size - radius), 0);
            const qy = Math.max(radius - y, y - (size - radius), 0);
            inside = qx * qx + qy * qy <= radius * radius;
          }
          if (!inside) continue;
          let col = teal;
          if (x >= cx - half && x <= cx + half) {
            const d = Math.abs(y - f(x)) / Math.sqrt(1 + df(x) ** 2);
            if (d <= thick / 2) col = white;
          }
          // round caps, like the SVG icon (stroke-linecap: round), so the wave ends are crisp and soft
          for (const ex of [cx - half, cx + half]) if ((x - ex) ** 2 + (y - f(ex)) ** 2 <= (thick / 2) ** 2) col = white;
          if ((x - dot.x) ** 2 + (y - dot.y) ** 2 <= dot.r ** 2) col = white;
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 4;
      const cov = a / 255;
      buf[o] = cov ? Math.round(r / cov) : 0;
      buf[o + 1] = cov ? Math.round(g / cov) : 0;
      buf[o + 2] = cov ? Math.round(b / cov) : 0;
      buf[o + 3] = Math.round(a / n);
    }
  }
  return buf;
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
  writeFileSync(join(out, name), png(size, render(size, { maskable })));
  console.log('wrote', name);
}
writeFileSync(join(out, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0F6B63"/><path d="M96 296 C 150 224, 214 224, 256 276 S 346 330, 416 256" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round"/><circle cx="318" cy="168" r="30" fill="#fff"/></svg>\n`);
console.log('wrote icon.svg');
