import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LANDING_HTML, CTA_PLACEHOLDER, ctaHtml, landingPage } from "../landing.js";

test("the landing page carries exactly one call-to-action placeholder", () => {
  // If this ever hits zero the substitution silently becomes a no-op and the
  // page ships with no way to reach the App Store, which nothing else catches:
  // String.replace on a missing needle returns the original string happily.
  const hits = LANDING_HTML.split(CTA_PLACEHOLDER).length - 1;
  assert.equal(hits, 1);
});

test("no placeholder survives into the rendered page", () => {
  for (const env of [{}, { APP_STORE_URL: "https://apps.apple.com/gb/app/id1" }]) {
    assert.ok(!landingPage(env).includes("{{"), "an unsubstituted placeholder reached the output");
  }
});

test("with no APP_STORE_URL the call to action is not a link", () => {
  for (const env of [{}, { APP_STORE_URL: "" }, { APP_STORE_URL: "   " }]) {
    const html = landingPage(env);
    assert.match(html, /class="cta pending"/);
    assert.ok(!/<a class="cta"/.test(html), "rendered a link with no url to point it at");
  }
});

test("with APP_STORE_URL set the call to action links to it", () => {
  const url = "https://apps.apple.com/gb/app/ventrack/id123456789";
  const html = landingPage({ APP_STORE_URL: url });
  assert.ok(html.includes(`<a class="cta" href="${url}">`));
  assert.ok(!html.includes("cta pending"));
});

test("a url with a quote in it cannot break out of the href", () => {
  const nasty = 'https://example.com/" onmouseover="alert(1)';
  const html = ctaHtml(nasty);
  assert.ok(!html.includes('onmouseover="'), "the attribute was escaped out of");
  assert.ok(html.includes("&quot;"));
});

test("the web app is not sitting in the directory that is served publicly", () => {
  // public/ is served wholesale by express.static. The web app moved to
  // webapp/ precisely so it is not reachable; dropping a file back into
  // public/ would put the whole product back on the open web for free.
  const served = fs.readdirSync(new URL("../public", import.meta.url));
  for (const leaked of ["app.js", "styles.css", "manifest.json"]) {
    assert.ok(!served.includes(leaked), `${leaked} is back in public/ and would be served`);
  }
});

test("the pages the App Store listing links to are still served", () => {
  const served = fs.readdirSync(new URL("../public", import.meta.url));
  for (const required of ["privacy.html", "support.html", "index.html", "icon.svg"]) {
    assert.ok(served.includes(required), `public/${required} is missing`);
  }
});

test("the service worker left behind is a kill switch, not a cache", () => {
  // Every browser that ever opened the old site holds a cache-first worker.
  // This file is the only thing that can undo it, so it has to keep
  // unregistering and must never start caching again.
  const sw = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /registration\.unregister\(\)/);
  assert.match(sw, /caches\.delete/);
  assert.ok(!/addEventListener\(\s*["']fetch["']/.test(sw), "a fetch handler is back in sw.js");
});
