// Finds Star Wars photos of Anakin / the fall / Darth Vader on X for the intro
// cards. It does NOT change the site: it lists candidates (with thumbnails) so
// you can pick which ones the cards show.
//
// Modes (X_MODE):
//   likes  = the photos an account has liked (X_USERNAME, default rebel_520)
//   all    = search all of X for Star Wars artwork
//   recent = same search, last 7 days only
//
// Run it from GitHub: Actions -> "Find Star Wars edits on X" -> Run workflow.
// Cost: every post X returns is one paid read (about $0.005 each when this was
// written). Up to PAGES x 100 posts are read per run.

import { appendFileSync, writeFileSync } from "node:fs";
import { FIELDS, isCorny, isCrude, isPolitical, isPromo, stageOf, toPosts, token, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) {
  // the action is useless without the secret: fail loudly
  console.error("::error::The X_BEARER_TOKEN secret is missing (Settings -> Secrets and variables -> Actions).");
  process.exit(1);
}

const MODE = ["likes", "all", "recent"].includes(process.env.X_MODE) ? process.env.X_MODE : "likes";
const PAGES = Math.min(10, Math.max(1, Number(process.env.X_PAGES) || 5));
const USERNAME = (process.env.X_USERNAME || "rebel_520").replace(/^@/, "").trim();

function fail(msg) {
  console.error(`::error::${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## X request failed\n\n\`${msg}\`\n`);
  process.exit(1);
}

// ---------- where the posts come from ----------
let path;
let label;
const baseParams = new URLSearchParams(FIELDS);
if (MODE === "likes") {
  let user;
  try {
    user = await xGet(`/users/by/username/${encodeURIComponent(USERNAME)}`, new URLSearchParams(), bearer);
  } catch (e) {
    fail(`Couldn't find @${USERNAME}: ${e.message || e}`);
  }
  if (!user?.data?.id) fail(`Couldn't find @${USERNAME} on X.`);
  path = `/users/${user.data.id}/liked_tweets`;
  label = `photos liked by @${USERNAME}`;
} else {
  // Artwork only: Anakin / Vader art by artists and graphic designers. Photos
  // only (no video); no reposts, replies or quotes; English.
  const base =
    '(anakin OR vader OR "darth vader" OR "anakin skywalker") (art OR artwork OR fanart OR illustration OR poster OR "digital art" OR "concept art" OR #StarWarsArt OR #digitalart OR #conceptart OR #illustration) has:images -has:videos -is:retweet -is:reply -is:quote lang:en';
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
  baseParams.set("query", query);
  baseParams.set("sort_order", "relevancy");
  path = MODE === "all" ? "/tweets/search/all" : "/tweets/search/recent";
  label = MODE === "all" ? "Star Wars artwork, all time" : "Star Wars artwork, last 7 days";
}

// ---------- read the pages ----------
const seen = new Map();
let next;
let reads = 0;
for (let page = 0; page < PAGES; page++) {
  const params = new URLSearchParams(baseParams);
  params.set("max_results", "100");
  if (next) params.set(MODE === "likes" ? "pagination_token" : "next_token", next);
  let body;
  try {
    body = await xGet(path, params, bearer);
  } catch (e) {
    const msg = String(e.message || e);
    // nothing came back at all: fail the run (red X) so the reason is easy to see
    if (page === 0) fail(MODE === "likes" ? `Couldn't read @${USERNAME}'s likes: ${msg}` : msg);
    console.warn(`::warning::Stopped after page ${page}: ${msg}`);
    break;
  }
  reads += body.data?.length ?? 0;
  for (const p of toPosts(body)) seen.set(p.id, p);
  next = body.meta?.next_token;
  if (!next) break;
}

// ---------- sort into the cards ----------
const STAR_WARS = /star ?wars|anakin|vader|darth|skywalker|sith|jedi|lightsaber|empire|mustafar|obi[- ]?wan|padm[eé]|#starwars/i;
const groups = { anakin: [], fall: [], vader: [] };
const other = []; // liked photos whose caption doesn't say what they are
let dropped = 0;
for (const p of seen.values()) {
  // photos only, never video, never politics
  if (!p.image || p.isVideo || isPolitical(p.text) || isCrude(p.username)) {
    dropped++;
    continue;
  }
  // searches also drop corny posts and ads; your own likes are your call
  if (MODE !== "likes" && (isPromo(p.text) || isCorny(p.text))) {
    dropped++;
    continue;
  }
  const s = stageOf(p.text) ?? (STAR_WARS.test(p.text) ? "vader" : null);
  if (s) groups[s].push(p);
  else if (MODE === "likes") other.push(p);
}
// likes keep the order you liked them in (newest first); searches go by views
if (MODE !== "likes") for (const k of Object.keys(groups)) groups[k].sort((a, b) => b.views - a.views);
for (const k of Object.keys(groups)) groups[k] = groups[k].slice(0, 40);

writeFileSync("x-candidates.json", JSON.stringify({ mode: MODE, label, reads, groups, other: other.slice(0, 60) }, null, 2));

// ---------- a readable page with a thumbnail of every photo ----------
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 90);
const fmt = (n) => n.toLocaleString("en-US");
let md = `## Star Wars photos on X (${label})\n\n`;
md += `Read **${reads}** posts (about **$${(reads * 0.005).toFixed(2)}** at $0.005/read). `;
md += MODE === "likes"
  ? `Skipped ${dropped}: videos, no photo, politics, or crude account names.\n\n`
  : `Dropped ${dropped}: videos, no image, politics, ads, memes/toys/cosplay/AI, or crude account names.\n\n`;

function table(title, prefix, list) {
  let out = `### ${title}\n\n`;
  if (!list.length) return out + "_Nothing found this run._\n\n";
  out += "| # | Photo | Views | Account | Post | ID |\n|---|---|---:|---|---|---|\n";
  list.forEach((p, i) => {
    const thumb = `<a href="${p.url}"><img src="${p.image}" width="140" alt=""></a>`;
    out += `| **${prefix}${i + 1}** | ${thumb} | ${fmt(p.views)} | @${p.username} | [${esc(p.text) || "(no text)"}](${p.url}) | ${p.id} |\n`;
  });
  return out + "\n";
}
md += table("Anakin (left card)", "A", groups.anakin);
md += table("The fall (left card)", "F", groups.fall);
md += table("Darth Vader (right card)", "V", groups.vader);
if (MODE === "likes") {
  md += table("Other liked photos (no Star Wars words in the caption - pick any that are Star Wars)", "O", other.slice(0, 60));
}
md += "Tell Kiro the numbers of the photos you like (for example `A1, A4, F2, V3, O7`) and which card each goes on.\n";

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
