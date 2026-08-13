#!/usr/bin/env node
// Entrypoint for the monthly localscan research job. Not part of the Express
// app: server.js never imports this file, and running it does not start a
// server. Invoked by the ventrack-uk-localscan-discover Cron Job in
// render.yaml, which runs `node discover-seeds.js` on a schedule instead of
// the image's default `node server.js`.
//
// Safe to run by hand too, for a manual check: `node discover-seeds.js` from
// inside api/, with OPENAI_API_KEY set and, if you want it to actually open a
// pull request rather than just print what it found, GITHUB_TOKEN as well.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDiscovery } from "./sources/localscan-discover.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same no-dependency .env loader as server.js, for a local manual run.
// Render's Cron Job gets its environment from the dashboard, same as the web
// service, so this is a no-op there.
try {
  const envFile = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env file, which is fine on Render */ }

const { prUrl, regionsSearched, candidatesFound } = await runDiscovery();

console.log(`[localscan-discover] searched ${regionsSearched} region(s), found ${candidatesFound} candidate(s)`);
if (prUrl) console.log(`[localscan-discover] opened ${prUrl}`);
else if (candidatesFound === 0) console.log("[localscan-discover] nothing new this run");
