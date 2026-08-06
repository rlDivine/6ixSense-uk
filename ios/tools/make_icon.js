// Generates the AppIcon PNGs (1024×1024, opaque, no alpha channel) from the
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
// Flag blue tile, white logo. The tinted variant has to be greyscale so iOS
// can recolour it with whatever tint the user has chosen.
const VARIANTS = {
  light:  { bg: [0x01, 0x21, 0x69], fg: [0xff, 0xff, 0xff], file: "icon_1024.png" },
  dark:   { bg: [0x00, 0x14, 0x40], fg: [0xff, 0xff, 0xff], file: "icon_dark.png" },
  tinted: { bg: [0x00, 0x00, 0x00], fg: [0xd8, 0xd8, 0xd8], file: "icon_tinted.png" },
};

// ---- the logo, on its 24x24 grid ------------------------------------------
// These numbers are the reference geometry documented in
// ios/Pulse/Design/Theme.swift (PulseLogoGeometry) and reproduced in
// api/public/icon.svg. Change one, change all three.
const HEAD = { x: 12, y: 8.8, r: 5.6 };
const POINT = { x: 12, y: 20.8 };
const COUNTER_R = 2.4;

// The tail is the triangle between the point and the two places where a line
// from the point grazes the head. Because those lines are tangents, the
// triangle meets the circle without a kink, and the union of the two is the
// pin silhouette. Testing "inside circle or inside triangle" therefore gives
// exactly the same shape as the arc-and-lines outline the other two
// implementations draw, without any winding rules to get wrong.
const TANGENT_L = { x: 7.047, y: 11.413 };
const TANGENT_R = { x: 16.953, y: 11.413 };

/// Which side of the line a->b the point (x,y) falls on. Sign only.
function side(x, y, a, b) {
  return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
}

function inTriangle(x, y, a, b, c) {
  const d1 = side(x, y, a, b);
  const d2 = side(x, y, b, c);
  const d3 = side(x, y, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/// True when the grid point (x,y) is inside the logo.
function inMark(x, y) {
  const dHead = Math.hypot(x - HEAD.x, y - HEAD.y);
  if (dHead <= COUNTER_R) return false;          // the knocked-out counter
  if (dHead <= HEAD.r) return true;              // the head
  return inTriangle(x, y, TANGENT_L, POINT, TANGENT_R);   // the tail
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
  if (!variant) throw new Error(`unknown variant "${name}", use light, dark or tinted`);
  fs.writeFileSync(out, encodePNG(render(variant), SIZE));
  console.log(`wrote ${out} (${name})`);
}
