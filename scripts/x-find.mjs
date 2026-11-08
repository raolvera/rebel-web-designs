// Finds popular Star Wars fan edits of Anakin / the fall / Darth Vader on X,
// with politics filtered out, ranked by views. It does NOT change the site:
// it lists candidates so you can pick which ones the intro shows.
//
// Run it from GitHub: Actions -> "Find Star Wars edits on X" -> Run workflow.
// Cost: every post X returns is one paid read (about $0.005 each when this was
// written). PAGES x 100 posts are read per run.

import { appendFileSync, writeFileSync } from "node:fs";
import { FIELDS, isPolitical, stageOf, toPosts, token, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) process.exit(0);

const MODE = process.env.X_MODE === "all" ? "all" : "recent"; // recent = last 7 days
const PAGES = Math.min(10, Math.max(1, Number(process.env.X_PAGES) || 2));

// Star Wars edits with media; no reposts, replies or quotes; English.
const base =
  '(anakin OR vader OR "darth vader" OR "anakin skywalker") (edit OR edits OR fanedit OR #starwars OR #anakin OR #darthvader OR #anakinskywalker) has:media -is:retweet -is:reply -is:quote lang:en';
const exclude = [
  "trump", "biden", "harris", "kamala", "obama", "maga", "election", "vote", "democrat", "republican",
  "liberal", "conservative", "woke", "leftist", "politics", "political", "musk", "elon", "gop", "congress",
  "senate", "president", "immigration", "fascist", "communist", "zoomer", "boomer", "millennial", "maxxing",
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
    console.error(String(e.message || e));
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
  if (!p.image || isPolitical(p.text)) {
    dropped++;
    continue;
  }
  const s = stageOf(p.text);
  if (s) groups[s].push(p);
}
for (const k of Object.keys(groups)) groups[k] = groups[k].sort((a, b) => b.views - a.views).slice(0, 15);

writeFileSync("x-candidates.json", JSON.stringify({ query, mode: MODE, reads, groups }, null, 2));

// A readable table on the workflow run page.
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 90);
const fmt = (n) => n.toLocaleString("en-US");
let md = `## Star Wars edits on X (${MODE === "all" ? "full archive" : "last 7 days"})\n\n`;
md += `Read **${reads}** posts (about **$${(reads * 0.005).toFixed(2)}** at $0.005/read). `;
md += `Dropped ${dropped} with no image or political words.\n\n`;
const titles = { anakin: "Anakin (left card)", fall: "The fall (left card)", vader: "Darth Vader (right card)" };
for (const [k, list] of Object.entries(groups)) {
  md += `### ${titles[k]}\n\n`;
  if (!list.length) {
    md += "_Nothing found this run._\n\n";
    continue;
  }
  md += "| # | Views | Account | Post | ID |\n|---|---:|---|---|---|\n";
  list.forEach((p, i) => {
    md += `| ${i + 1} | ${fmt(p.views)} | @${p.username} | [${esc(p.text) || "(no text)"}](${p.url}) | \`${p.id}\` |\n`;
  });
  md += "\n";
}
md += "Pick the ones you like (or say \"use the top ones\") and they go into `scripts/x-picks.json`.\n";

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
