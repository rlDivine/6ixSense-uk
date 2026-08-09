// Generates the AppIcon PNGs (1024x1024, opaque, no alpha channel) from the
// same logo geometry the app draws in SwiftUI.
//
//   node tools/make_icon.js            # writes all three variants
//   node tools/make_icon.js <out.png> <light|dark|tinted>
//
// This is the portable twin of tools/make_icon.swift: same drawing, but it
// runs anywhere Node does rather than needing a Mac and CoreGraphics. It has
// no dependencies: the rasteriser and the PNG encoder are both below, and
// zlib comes from Node itself.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONSET = path.join(__dirname, "..", "Pulse", "Assets.xcassets", "AppIcon.appiconset");

const SIZE = 1024;
const SS = 4; // supersampling factor. 4x gives clean antialiased curves

// Canvas and logo colours per variant, matching make_icon.swift.
// An accent-fill tile with the mark knocked out in white, flat, no gradient
// and no shadow. Each variant uses its own theme's accent-fill, so the light
// tile is Pantone 186 and the dark one is the lifted red the dark interface
// uses behind white. The tinted variant has to be greyscale so iOS can
// recolour it with whatever tint the user has chosen.
const VARIANTS = {
  light:  { bg: [0xc8, 0x10, 0x2e], fg: [0xff, 0xff, 0xff], file: "icon_1024.png" },
  dark:   { bg: [0xd2, 0x1e, 0x3c], fg: [0xff, 0xff, 0xff], file: "icon_dark.png" },
  tinted: { bg: [0x00, 0x00, 0x00], fg: [0xd8, 0xd8, 0xd8], file: "icon_tinted.png" },
};

// ---- the logo, on its 24x24 grid ------------------------------------------
// "Proximity": a filled dot with two rising arcs above it. These numbers are
// the reference geometry documented in ios/Pulse/Design/Theme.swift
// (PulseLogoGeometry) and reproduced in ios/tools/make_icon.swift and
// api/public/icon.svg. Change one, change all four.
//
//   dot     centre (12, 17) radius 2.6, filled
//   arc 1   (7.6, 12.6) to (16.4, 12.6)  on radius 6.2
//   arc 2   (4.2, 8.9)  to (19.8, 8.9)   on radius 11
//   both arcs stroked at 2.1 with round caps
const DOT = { x: 12, y: 17, r: 2.6 };
const STROKE = 2.1;
const CAP = STROKE / 2;

/// Polar angle of p about c in degrees, normalised to 0 up to 360. Positive y
/// is downward here, the same as the SVG and the SwiftUI shape, so 270 is
/// straight up and a sweep over the top is an increasing range.
function angleOf(p, c) {
  const a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

/// The minor arc of `radius` running from `from` to `to` and bulging upward,
/// which is how the handoff's two SVG arc commands resolve. Both chords here
/// are horizontal, so the centre sits directly below the chord's midpoint.
function makeArc(from, to, radius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const half = Math.sqrt((dx * dx + dy * dy) / 4);
  const drop = Math.sqrt(radius * radius - half * half);
  const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + drop };
  return { c, r: radius, a0: angleOf(from, c), a1: angleOf(to, c), from, to };
}

const ARCS = [
  makeArc({ x: 7.6, y: 12.6 }, { x: 16.4, y: 12.6 }, 6.2),
  makeArc({ x: 4.2, y: 8.9 }, { x: 19.8, y: 8.9 }, 11),
];

/// Distance from (x,y) to the arc's centreline. Inside the angular range that
/// is the difference between the point's radius and the arc's; outside it the
/// nearest endpoint wins, which is exactly what a round cap is. Sampling this
/// distance field avoids approximating the curve with segments, so the arcs
/// stay true circles at any canvas size.
function arcDistance(x, y, arc) {
  const dx = x - arc.c.x;
  const dy = y - arc.c.y;
  let t = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (t < 0) t += 360;
  if (t >= arc.a0 && t <= arc.a1) return Math.abs(Math.hypot(dx, dy) - arc.r);
  return Math.min(
    Math.hypot(x - arc.from.x, y - arc.from.y),
    Math.hypot(x - arc.to.x, y - arc.to.y),
  );
}

/// True when the grid point (x,y) is inside the logo.
function inMark(x, y) {
  if (Math.hypot(x - DOT.x, y - DOT.y) <= DOT.r) return true;
  for (const arc of ARCS) {
    if (arcDistance(x, y, arc) <= CAP) return true;
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
      // Coverage by supersampling: how many of the SS by SS subsamples land
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
  if (!variant) throw new Error(`unknown variant "${name}", use light, dark or tinted`);
  fs.writeFileSync(out, encodePNG(render(variant), SIZE));
  console.log(`wrote ${out} (${name})`);
}
