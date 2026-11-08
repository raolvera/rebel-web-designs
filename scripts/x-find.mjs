// Finds popular Star Wars fan edits of Anakin / the fall / Darth Vader on X,
// with politics filtered out, ranked by views. It does NOT change the site:
// it lists candidates so you can pick which ones the intro shows.
//
// Run it from GitHub: Actions -> "Find Star Wars edits on X" -> Run workflow.
// Cost: every post X returns is one paid read (about $0.005 each when this was
// written). PAGES x 100 posts are read per run.

import { appendFileSync, writeFileSync } from "node:fs";
import { FIELDS, isCorny, isCrude, isPolitical, isPromo, stageOf, toPosts, token, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) {
  // the search action is useless without the secret: fail loudly
  console.error("::error::The X_BEARER_TOKEN secret is missing (Settings -> Secrets and variables -> Actions).");
  process.exit(1);
}

const MODE = process.env.X_MODE === "all" ? "all" : "recent"; // recent = last 7 days
const PAGES = Math.min(10, Math.max(1, Number(process.env.X_PAGES) || 2));

// Artwork only: Anakin / Vader art by artists and graphic designers. Photos
// only (no video); no reposts, replies or quotes; English.
const base =
  '(anakin OR vader OR "darth vader" OR "anakin skywalker") (art OR artwork OR fanart OR illustration OR poster OR "digital art" OR "concept art" OR #StarWarsArt OR #digitalart OR #conceptart OR #illustration) has:images -has:videos -is:retweet -is:reply -is:quote lang:en';
// Corny stuff first (it matters most here), then politics. The full lists
// are also checked again after the search, so nothing is missed.
const exclude = [
  "lol", "lmao", "meme", "funny", "toy", "figure", "lego", "funko", "cosplay", "ai", "aiart", "midjourney",
  "trump", "biden", "maga", "election", "democrat", "republican", "woke", "politics", "musk", "elon",
];
// X allows 512 characters per query; add as many exclusions as fit.
let query = base;
for (const w of exclude) {
  if ((query + ` -${w}`).length > 512) break;
  query += ` -${w}`;
}

const path = MODE === "all" ? "/tweets/search/all" : "/tweets/search/recent";
const seen = new Map();
let next;
let reads = 0;
for (let page = 0; page < PAGES; page++) {
  const params = new URLSearchParams(FIELDS);
  params.set("query", query);
  params.set("max_results", "100");
  params.set("sort_order", "relevancy");
  if (next) params.set(MODE === "all" ? "next_token" : "next_token", next);
  let body;
  try {
    body = await xGet(path, params, bearer);
  } catch (e) {
    const msg = String(e.message || e);
    if (page === 0) {
      // nothing came back at all: fail the run (red X) so the reason is easy to see
      console.error(`::error::${msg}`);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## X search failed\n\n\`${msg}\`\n`);
      process.exit(1);
    }
    console.warn(`::warning::Stopped after page ${page}: ${msg}`);
    break;
  }
  reads += body.data?.length ?? 0;
  for (const p of toPosts(body)) seen.set(p.id, p);
  next = body.meta?.next_token;
  if (!next) break;
}

const groups = { anakin: [], fall: [], vader: [] };
let dropped = 0;
for (const p of seen.values()) {
  if (!p.image || p.isVideo || isPolitical(p.text) || isPromo(p.text) || isCorny(p.text) || isCrude(p.username)) {
    dropped++;
    continue;
  }
  const s = stageOf(p.text);
  if (s) groups[s].push(p);
}
for (const k of Object.keys(groups)) groups[k] = groups[k].sort((a, b) => b.views - a.views).slice(0, 40);

writeFileSync("x-candidates.json", JSON.stringify({ query, mode: MODE, reads, groups }, null, 2));

// A readable table on the workflow run page.
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 90);
const fmt = (n) => n.toLocaleString("en-US");
let md = `## Star Wars edits on X (${MODE === "all" ? "full archive" : "last 7 days"})\n\n`;
md += `Read **${reads}** posts (about **$${(reads * 0.005).toFixed(2)}** at $0.005/read). `;
md += `Dropped ${dropped}: videos, no image, politics, ads, memes/toys/cosplay/AI, or crude account names.\n\n`;
const titles = { anakin: "Anakin (left card)", fall: "The fall (left card)", vader: "Darth Vader (right card)" };
for (const [k, list] of Object.entries(groups)) {
  md += `### ${titles[k]}\n\n`;
  if (!list.length) {
    md += "_Nothing found this run._\n\n";
    continue;
  }
  // A thumbnail of every photo, so you pick by how it actually looks.
  md += "| # | Photo | Views | Account | Post | ID |\n|---|---|---:|---|---|---|\n";
  list.forEach((p, i) => {
    const thumb = `<a href="${p.url}"><img src="${p.image}" width="140" alt=""></a>`;
    md += `| **${k[0].toUpperCase()}${i + 1}** | ${thumb} | ${fmt(p.views)} | @${p.username} | [${esc(p.text) || "(no text)"}](${p.url}) | ${p.id} |\n`;
  });
  md += "\n";
}
md += "Tell Kiro the numbers of the photos you like (for example `A1, A4, F2, V3, V7`) and they go on the cards.\n";

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
