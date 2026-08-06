// Generates the AppIcon PNGs (1024×1024, opaque, no alpha channel) from the
// same PulseMark geometry the app draws in SwiftUI.
//
//   node tools/make_icon.js            # writes all three variants
//   node tools/make_icon.js <out.png> <light|dark|tinted>
//
// This is the portable twin of tools/make_icon.swift: same drawing, but it
// runs anywhere Node does rather than needing a Mac and CoreGraphics. It has
// no dependencies — the rasteriser and the PNG encoder are both below, and
// zlib comes from Node itself.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONSET = path.join(__dirname, "..", "Pulse", "Assets.xcassets", "AppIcon.appiconset");

const SIZE = 1024;
const SS = 4; // supersampling factor — 4× gives clean antialiased curves

// Canvas and mark colours per variant, matching make_icon.swift.
const VARIANTS = {
  light:  { bg: [0x14, 0x16, 0x1e], fg: [0xff, 0x62, 0x51], file: "icon_1024.png" },
  dark:   { bg: [0x0a, 0x0c, 0x11], fg: [0xff, 0x62, 0x51], file: "icon_dark.png" },
  tinted: { bg: [0x00, 0x00, 0x00], fg: [0xd8, 0xd8, 0xd8], file: "icon_tinted.png" },
};

// ---- the mark, on its 24×24 grid ------------------------------------------
const RING_OUTER = 11.0;
const RING_INNER = 8.6;
const TRACE_WIDTH = 1.7;
const TRACE = [
  [6.0, 12.0], [9.0, 12.0], [10.7, 7.8], [13.3, 16.2], [15.0, 12.0], [18.0, 12.0],
];

/// Signed distance from (x,y) to the segment a→b, in grid units.
function distToSegment(x, y, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = x - a[0], wy = y - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = wx - t * vx, dy = wy - t * vy;
  return Math.hypot(dx, dy);
}

/// True when the grid point (x,y) is inside the mark. Round caps and joins fall
/// out of using distance-to-segment: every point within half the stroke width
/// of the polyline is inside, which is exactly what a round-capped stroke is.
function inMark(x, y) {
  const r = Math.hypot(x - 12, y - 12);
  if (r <= RING_OUTER && r >= RING_INNER) return true;
  const half = TRACE_WIDTH / 2;
  for (let i = 0; i < TRACE.length - 1; i++) {
    if (distToSegment(x, y, TRACE[i], TRACE[i + 1]) <= half) return true;
  }
  return false;
}

/// Renders one variant to raw RGB bytes (3 per pixel, no alpha).
function render({ bg, fg }) {
  const px = new Uint8Array(SIZE * SIZE * 3);
  // Same framing as the Swift version: the 24-unit grid occupies 62% of the
  // canvas, centred, so the mark clears the home-screen mask's corners.
  const scale = (SIZE * 0.62) / 24;
  const centre = SIZE / 2;

  for (let py = 0; py < SIZE; py++) {
    for (let pxi = 0; pxi < SIZE; pxi++) {
      // Coverage by supersampling: how many of the SS×SS subsamples land
      // inside the mark. That fraction is the antialiasing.
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const cxp = pxi + (sx + 0.5) / SS;
          const cyp = py + (sy + 0.5) / SS;
          const gx = (cxp - centre) / scale + 12;
          const gy = (cyp - centre) / scale + 12;
          if (inMark(gx, gy)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const o = (py * SIZE + pxi) * 3;
      for (let c = 0; c < 3; c++) {
        px[o + c] = Math.round(bg[c] * (1 - a) + fg[c] * a);
      }
    }
  }
  return px;
}

// ---- minimal PNG encoder (truecolour, 8-bit, no alpha) ---------------------
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function encodePNG(rgb, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type 2 = truecolour RGB, no alpha
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  // One filter byte (0 = None) per scanline, then the row's RGB bytes.
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- main -----------------------------------------------------------------
const [argOut, argVariant] = process.argv.slice(2);
const jobs = argOut
  ? [[argVariant || "light", argOut]]
  : Object.entries(VARIANTS).map(([name, v]) => [name, path.join(ICONSET, v.file)]);

for (const [name, out] of jobs) {
  const variant = VARIANTS[name];
  if (!variant) throw new Error(`unknown variant "${name}" — use light, dark or tinted`);
  fs.writeFileSync(out, encodePNG(render(variant), SIZE));
  console.log(`wrote ${out} (${name})`);
}
