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
const ICONSET = path.join(__dirname, "..", "VenTrack", "Assets.xcassets", "AppIcon.appiconset");

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
  dark:   { bg: [0xc8, 0x32, 0x4a], fg: [0xff, 0xff, 0xff], file: "icon_dark.png" },
  tinted: { bg: [0x00, 0x00, 0x00], fg: [0xd8, 0xd8, 0xd8], file: "icon_tinted.png" },
};

// ---- the logo, on its 24x24 grid ------------------------------------------
// "Beacon": a map pin with a pulse trace knocked out of it as a counter. These
// numbers are the reference geometry documented in ios/VenTrack/Design/Theme.swift
// (VenTrackLogoGeometry) and reproduced in ios/tools/make_icon.swift and
// api/public/icon.svg, plus the inline brand marks in api/public/index.html
// (the landing page) and api/webapp/index.html (the web app).
// Change one, change all six.
//
// The old mark was a stroke, so it could be rasterised from a distance field.
// This one is a filled outline built from two circular arcs, two cubics and a
// rounded tip, and there is no closed-form distance to a cubic. It is flattened
// to a dense polygon instead and tested with a crossing count. At 4000 segments
// the worst chord error on the 24 grid is far below one pixel at 1024.
const HEAD = { x: 12, y: 10, r: 8.2 };
const TIP_R = 1.1, TIP_HALF = 0.7, TIP_CHORD_Y = 22.3;
const TIP = { x: 12, y: TIP_CHORD_Y - Math.sqrt(TIP_R * TIP_R - TIP_HALF * TIP_HALF) };

const D = Math.PI / 180;
const arcPoints = (c, r, a0, a1, steps) => {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * D;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
};
const cubicPoints = (p0, c1, c2, p1, steps) => {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    });
  }
  return out;
};

const tipStart = (Math.atan2(TIP_CHORD_Y - TIP.y, -TIP_HALF) * 180) / Math.PI;
const tipEnd = (Math.atan2(TIP_CHORD_Y - TIP.y, TIP_HALF) * 180) / Math.PI;

/// The pin outline, anticlockwise on screen from the top of the crown.
const OUTLINE = [
  ...arcPoints(HEAD, HEAD.r, 270, 180, 1000),
  ...cubicPoints({ x: 3.8, y: 10 }, { x: 3.8, y: 15.9 }, { x: 11, y: 22 }, { x: 11.3, y: 22.3 }, 1000),
  ...arcPoints(TIP, TIP_R, tipStart, tipEnd, 200),
  ...cubicPoints({ x: 12.7, y: 22.3 }, { x: 13, y: 22 }, { x: 20.2, y: 15.9 }, { x: 20.2, y: 10 }, 1000),
  ...arcPoints(HEAD, HEAD.r, 0, -90, 1000),
];

/// The pulse trace, as a centreline stroked at a constant width. The handoff
/// supplies a ready made outline, but that outline is not a constant width
/// stroke: its left tail is 0.2 units thick and its right bar is 1.4, so it
/// read as a hairline running into a block. A stroked centreline is what it
/// was meant to be, and a distance field gives the round caps and joins for
/// free without flattening anything.
const TRACE = [
  { x: 6.6, y: 10.2 }, { x: 9.4, y: 10.2 }, { x: 10.9, y: 6.2 },
  { x: 12.9, y: 12.6 }, { x: 14, y: 9.4 }, { x: 17.4, y: 9.4 },
];
const TRACE_HALF = 1.5 / 2;

/// Distance from (x,y) to the segment ab.
function segDistance(x, y, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((x - a.x) * vx + (y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + t * vx), y - (a.y + t * vy));
}

/// Within half a stroke width of the centreline. Clamping t to the segment is
/// exactly what a round cap and a round join are, so nothing else is needed.
function onTrace(x, y) {
  for (let i = 1; i < TRACE.length; i++) {
    if (segDistance(x, y, TRACE[i - 1], TRACE[i]) <= TRACE_HALF) return true;
  }
  return false;
}

/// The x positions where the horizontal line at `y` crosses `poly`, sorted.
/// Computing these once per scanline is what keeps this tractable: a per pixel
/// point in polygon test against a 4000 segment outline, supersampled, is tens
/// of billions of operations and never finishes.
function crossings(y, poly) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y)) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
  }
  xs.sort((p, q) => p - q);
  return xs;
}

/// Odd number of crossings to the left means inside.
function insideAt(xs, x) {
  let c = 0;
  for (let i = 0; i < xs.length; i++) if (xs[i] < x) c++;
  return (c & 1) === 1;
}

/// Renders one variant to raw RGB bytes (3 per pixel, no alpha).
function render({ bg, fg }) {
  const px = new Uint8Array(SIZE * SIZE * 3);
  // Same framing as the Swift version: the 24-unit grid occupies 62% of the
  // canvas, centred, so the mark clears the home-screen mask's corners.
  const scale = (SIZE * 0.62) / 24;
  const centre = SIZE / 2;

  // Coverage by supersampling, exactly as before: the fraction of the SS by SS
  // subsamples inside the mark is the antialiasing. The loop is ordered by
  // subsample row rather than by pixel so each row's crossings are found once.
  const cov = new Float32Array(SIZE * SIZE);
  const rows = SIZE * SS;
  for (let r = 0; r < rows; r++) {
    const py = (r / SS) | 0;
    const cyp = py + ((r % SS) + 0.5) / SS;
    const gy = (cyp - centre) / scale + 12;
    const outline = crossings(gy, OUTLINE);
    if (outline.length === 0) continue;
    // Nothing outside the outline's own span can be inside it.
    const lo = Math.max(0, Math.floor((outline[0] - 12) * scale + centre) - 1);
    const hi = Math.min(SIZE - 1, Math.ceil((outline[outline.length - 1] - 12) * scale + centre) + 1);
    for (let pxi = lo; pxi <= hi; pxi++) {
      let hits = 0;
      for (let sx = 0; sx < SS; sx++) {
        const gx = (pxi + (sx + 0.5) / SS - centre) / scale + 12;
        if (insideAt(outline, gx) && !onTrace(gx, gy)) hits++;
      }
      if (hits) cov[py * SIZE + pxi] += hits;
    }
  }

  for (let i = 0; i < SIZE * SIZE; i++) {
    const a = cov[i] / (SS * SS);
    const o = i * 3;
    for (let c = 0; c < 3; c++) px[o + c] = Math.round(bg[c] * (1 - a) + fg[c] * a);
  }
  return px;
}

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
