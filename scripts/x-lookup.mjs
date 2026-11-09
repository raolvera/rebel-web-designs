// Runs on every deploy (and every 30 minutes): looks up the posts you picked
// in scripts/x-picks.json and writes their latest view counts + images to
// client/public/x-posts.json, which the intro cards read.
// Cost: one paid read per picked post (about $0.005 each), billed once per
// UTC day per post, so re-reading the same posts later that day is free.
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
  // photos only (no video), and skip any post that was deleted
  for (const s of stages) posts[s] = (picks[s] ?? []).map((id) => byId.get(id)).filter((p) => p && p.image && !p.isVideo);

  // Credit the original creator, never the site owner's account:
  //  - "credits" in x-picks.json: post id -> the artist's handle (shown instead)
  //  - otherwise a photo the owner uploaded themselves shows no name
  // (Reposts and likes are already the original post, so they credit the artist.)
  const owner = String(picks.owner ?? "").replace(/^@/, "").toLowerCase();
  const credits = picks.credits ?? {};
  for (const s of stages) {
    for (const p of posts[s]) {
      const c = credits[p.id];
      if (c) {
        p.username = String(c).replace(/^@/, "");
        p.author = "";
      } else if (owner && p.username.toLowerCase() === owner) {
        p.username = "";
        p.author = "";
      }
    }
  }
  // Leave out photos listed in "skipPhotos" (post id -> photo numbers, 1 = first),
  // e.g. a photo that's a duplicate of art already on a card.
  const skip = picks.skipPhotos ?? {};
  for (const s of stages) {
    for (const p of posts[s]) {
      const drop = skip[p.id];
      if (!Array.isArray(drop) || !p.images?.length) continue;
      p.images = p.images.filter((_, i) => !drop.includes(i + 1));
      p.image = p.images[0];
    }
    posts[s] = posts[s].filter((p) => p.image);
  }

  mkdirSync(new URL("../client/public/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../client/public/x-posts.json", import.meta.url),
    JSON.stringify({ updated: new Date().toISOString(), posts }),
  );
  console.log(`Wrote x-posts.json: ${stages.map((s) => `${s} ${posts[s].length}`).join(", ")}`);
} catch (e) {
  console.warn(`::warning::X lookup failed, cards stay hidden this deploy: ${e.message || e}`);
}
