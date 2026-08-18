import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The marketing page, with the one part of it that is not static: the call to
// action. It is a separate module from server.js purely so it can be tested
// without booting a listener.
//
// Read once at import rather than per request. The file is a few kB and never
// changes while the process is alive; a redeploy is what picks up an edit.
export const LANDING_HTML = fs.readFileSync(
  path.join(__dirname, "public", "index.html"),
  "utf8"
);

export const CTA_PLACEHOLDER = "{{CTA}}";

// Minimal escaping for the one value that reaches an href. APP_STORE_URL is
// set by whoever runs the service rather than by a visitor, so this is belt
// and braces, but a stray quote would otherwise break out of the attribute.
export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ctaHtml(url) {
  const clean = (url || "").trim();
  if (!clean) {
    // No link at all rather than a dead one. The page goes live before the
    // app is on sale, and a button that goes nowhere is worse than a label.
    return `<span class="cta pending">Coming soon to the App Store</span>`;
  }
  return `<a class="cta" href="${escapeAttr(clean)}">Download on the App Store</a>`;
}

// env is a parameter rather than a read of process.env so a test can drive it.
export function landingPage(env = process.env) {
  return LANDING_HTML.replace(CTA_PLACEHOLDER, ctaHtml(env.APP_STORE_URL));
}
