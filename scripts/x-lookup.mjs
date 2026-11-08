// Runs on every deploy (and once a day): looks up the posts you picked in
// scripts/x-picks.json and writes their latest view counts + images to
// client/public/x-posts.json, which the intro cards read.
// Cost: one paid read per picked post per run (about $0.005 each).
// Never fails the deploy: on any problem it logs a warning and the cards
// simply stay hidden.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { FIELDS, toPosts, token, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) process.exit(0);

let picks;
try {
  picks = JSON.parse(readFileSync(new URL("./x-picks.json", import.meta.url), "utf8"));
} catch {
  console.log("No scripts/x-picks.json - skipping.");
  process.exit(0);
}

const stages = ["anakin", "fall", "vader"];
const ids = [...new Set(stages.flatMap((s) => picks[s] ?? []))].slice(0, 100);
if (!ids.length) {
  console.log("No posts picked yet in scripts/x-picks.json - skipping.");
  process.exit(0);
}

try {
  const params = new URLSearchParams(FIELDS);
  params.set("ids", ids.join(","));
  const body = await xGet("/tweets", params, bearer);
  const byId = new Map(toPosts(body).map((p) => [p.id, p]));
  const posts = {};
  for (const s of stages) posts[s] = (picks[s] ?? []).map((id) => byId.get(id)).filter((p) => p && p.image);
  mkdirSync(new URL("../client/public/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../client/public/x-posts.json", import.meta.url),
    JSON.stringify({ updated: new Date().toISOString(), posts }),
  );
  console.log(`Wrote x-posts.json: ${stages.map((s) => `${s} ${posts[s].length}`).join(", ")}`);
} catch (e) {
  console.warn(`::warning::X lookup failed, cards stay hidden this deploy: ${e.message || e}`);
}
