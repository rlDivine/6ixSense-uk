#!/usr/bin/env node
// Entrypoint for the localscan research pass. Not part of the Express app:
// server.js never imports this file, and running it does not start a server.
//
// Run it by hand, from inside api/, with OPENAI_API_KEY set and, if you want
// it to actually open a pull request rather than just print what it found,
// GITHUB_TOKEN as well:
//
//   OPENAI_API_KEY=... GITHUB_TOKEN=... node discover-seeds.js
//
// It is not scheduled. It was a Render Cron Job, but Render cron services
// have no free tier, so that block was removed from render.yaml rather than
// have a Blueprint sync quietly try to create a paid service. render.yaml
// keeps the exact block to restore if that cost is ever worth it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDiscovery } from "./sources/localscan-discover.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same no-dependency .env loader as server.js, so a local run can pick the
// keys up from api/.env instead of needing them inline every time.
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
