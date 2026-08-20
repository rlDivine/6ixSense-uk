// Renders the static copy of the marketing site.
//
// `public/index.html` is a TEMPLATE, not a finished page: it carries a {{CTA}}
// placeholder that the running server substitutes per request via landing.js.
// Serving the file as it sits on disk therefore puts the literal text {{CTA}}
// on the page where the App Store button belongs, which on the marketing URL
// given to Apple is not a small blemish.
//
// So the static host gets a rendered copy rather than the template, and it is
// rendered by landing.js, the same code the server uses. A second
// implementation here would be a second thing to keep in step, and the whole
// point of publishing from api/public is that there is one source.
//
// Usage:  node build-site.js <output-file>
// APP_STORE_URL is read from the environment, exactly as in the server, so an
// unset value produces the "Coming soon to the App Store" label rather than a
// dead link.
import fs from "node:fs";
import { landingPage } from "./landing.js";

const out = process.argv[2];
if (!out) {
  console.error("usage: node build-site.js <output-file>");
  process.exit(1);
}

fs.writeFileSync(out, landingPage());
console.log(`Rendered the landing page to ${out}`);
