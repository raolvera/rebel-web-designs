// Finds Star Wars photos of Anakin / the fall / Darth Vader on X for the intro
// cards. It does NOT change the site: it lists candidates (with thumbnails) so
// you can pick which ones the cards show.
//
// Modes (X_MODE):
//   posts  = (default) 1) the photos an account has posted or reposted
//            (X_USERNAME, default rebel_520), then 2) more Star Wars art from
//            the same artists. (Likes can't be used: X only shows an account's
//            likes to that account's own login, not to an app token.)
//   all    = search all of X for Star Wars artwork
//   recent = same search, last 7 days only
//
// Run it from GitHub: Actions -> "Find Star Wars edits on X" -> Run workflow.
// Cost: every post X returns is one paid read (about $0.005 each when this was
// written). Up to X_PAGES x 100 posts in step 1, and X_ARTIST_PAGES x 100 in
// step 2.

import { appendFileSync, writeFileSync } from "node:fs";
import { FIELDS, isCorny, isCrude, isPolitical, isPromo, stageOf, toPosts, token, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) {
  // the action is useless without the secret: fail loudly
  console.error("::error::The X_BEARER_TOKEN secret is missing (Settings -> Secrets and variables -> Actions).");
  process.exit(1);
}

const MODE = ["posts", "all", "recent"].includes(process.env.X_MODE) ? process.env.X_MODE : "posts";
const PAGES = Math.min(10, Math.max(1, Number(process.env.X_PAGES) || 5));
const ARTIST_PAGES = Math.min(10, Math.max(0, Number(process.env.X_ARTIST_PAGES ?? 5)));
const USERNAME = (process.env.X_USERNAME || "rebel_520").replace(/^@/, "").trim();

function fail(msg) {
  console.error(`::error::${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## X request failed\n\n\`${msg}\`\n`);
  process.exit(1);
}

// Star Wars words (Anakin / Vader focused) used in the searches.
const SW_TERMS =
  '(anakin OR vader OR "darth vader" OR "anakin skywalker" OR "star wars" OR starwars OR sith OR #StarWarsArt OR #StarWars)';
const STAR_WARS = /star ?wars|anakin|vader|darth|skywalker|sith|jedi|lightsaber|empire|mustafar|obi[- ]?wan|padm[eé]|#starwars/i;

let reads = 0;

// Read up to `pages` pages of an X endpoint into `seen` (id -> post).
// `resolve` swaps reposts for the original post (photo, caption, artist).
async function readPages(path, baseParams, pages, pageParam, seen, tag, { resolve = false, failFirst = true } = {}) {
  let next;
  let got = 0;
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams(baseParams);
    params.set("max_results", "100");
    if (next) params.set(pageParam, next);
    let body;
    try {
      body = await xGet(path, params, bearer);
    } catch (e) {
      const msg = String(e.message || e);
      if (page === 0 && failFirst) fail(msg);
      console.warn(`::warning::Stopped after page ${page}: ${msg}`);
      return { got, error: msg };
    }
    reads += body.data?.length ?? 0;
    if (resolve) {
      // a repost (or a quote with no photo of its own) shows the ORIGINAL post
      const originals = new Map((body.includes?.tweets ?? []).map((t) => [t.id, t]));
      body = {
        ...body,
        data: (body.data ?? []).map((t) => {
          const ref = t.referenced_tweets?.find((r) => r.type === "retweeted" || r.type === "quoted");
          const orig = ref && originals.get(ref.id);
          const ownPhoto = t.attachments?.media_keys?.length;
          return orig && (ref.type === "retweeted" || !ownPhoto) ? orig : t;
        }),
      };
    }
    for (const p of toPosts(body)) {
      if (!seen.has(p.id)) {
        seen.set(p.id, { ...p, source: tag });
        got++;
      }
    }
    next = body.meta?.next_token;
    if (!next) break;
  }
  return { got };
}

const seen = new Map();
let label;
let artists = [];

if (MODE === "posts") {
  // ---------- step 1: what @USERNAME posted / reposted ----------
  let user;
  try {
    user = await xGet(`/users/by/username/${encodeURIComponent(USERNAME)}`, new URLSearchParams(), bearer);
  } catch (e) {
    fail(`Couldn't find @${USERNAME}: ${e.message || e}`);
  }
  if (!user?.data?.id) fail(`Couldn't find @${USERNAME} on X.`);
  const p1 = new URLSearchParams(FIELDS);
  p1.set("tweet.fields", `${p1.get("tweet.fields")},referenced_tweets`);
  p1.set("expansions", `${p1.get("expansions")},referenced_tweets.id,referenced_tweets.id.attachments.media_keys,referenced_tweets.id.author_id`);
  await readPages(`/users/${user.data.id}/tweets`, p1, PAGES, "pagination_token", seen, "yours", { resolve: true });
  label = `@${USERNAME}'s Star Wars shares + more art from the same artists`;

  // ---------- step 2: more Star Wars art from those artists ----------
  const mine = [...seen.values()].filter((p) => p.image && !p.isVideo);
  const swAuthors = mine.filter((p) => STAR_WARS.test(p.text)).map((p) => p.username);
  // art accounts often post with no caption: if none matched, use every artist you shared
  const pool = swAuthors.length ? swAuthors : mine.map((p) => p.username);
  artists = [...new Set(pool.filter((u) => u && u.toLowerCase() !== USERNAME.toLowerCase()))];

  if (artists.length && ARTIST_PAGES > 0) {
    // one query per batch of artists that fits X's 512-character limit
    const tail = ` ${SW_TERMS} has:images -has:videos -is:retweet -is:reply`;
    const batches = [];
    let cur = [];
    for (const a of artists) {
      const test = `(${[...cur, a].map((x) => `from:${x}`).join(" OR ")})${tail}`;
      if (test.length > 512 && cur.length) {
        batches.push(cur);
        cur = [a];
      } else cur.push(a);
    }
    if (cur.length) batches.push(cur);
    const perBatch = Math.max(1, Math.floor(ARTIST_PAGES / batches.length));
    let budget = ARTIST_PAGES;
    for (const b of batches) {
      if (budget <= 0) break;
      const q = new URLSearchParams(FIELDS);
      q.set("query", `(${b.map((x) => `from:${x}`).join(" OR ")})${tail}`);
      q.set("sort_order", "relevancy");
      const pages = Math.min(perBatch, budget);
      budget -= pages;
      // all-time first; if that's not allowed on this account, last 7 days
      let r = await readPages("/tweets/search/all", q, pages, "next_token", seen, "artist", { failFirst: false });
      if (r.error && !r.got) r = await readPages("/tweets/search/recent", q, pages, "next_token", seen, "artist", { failFirst: false });
    }
  }
} else {
  // ---------- search all of X for Star Wars artwork ----------
  const base =
    '(anakin OR vader OR "darth vader" OR "anakin skywalker") (art OR artwork OR fanart OR illustration OR poster OR "digital art" OR "concept art" OR #StarWarsArt OR #digitalart OR #conceptart OR #illustration) has:images -has:videos -is:retweet -is:reply -is:quote lang:en';
  const exclude = [
    "lol", "lmao", "meme", "funny", "toy", "figure", "lego", "funko", "cosplay", "ai", "aiart", "midjourney",
    "trump", "biden", "maga", "election", "democrat", "republican", "woke", "politics", "musk", "elon",
  ];
  let query = base;
  for (const w of exclude) {
    if ((query + ` -${w}`).length > 512) break;
    query += ` -${w}`;
  }
  const q = new URLSearchParams(FIELDS);
  q.set("query", query);
  q.set("sort_order", "relevancy");
  await readPages(MODE === "all" ? "/tweets/search/all" : "/tweets/search/recent", q, PAGES, "next_token", seen, "search");
  label = MODE === "all" ? "Star Wars artwork, all time" : "Star Wars artwork, last 7 days";
}

// ---------- sort into the cards ----------
const groups = { anakin: [], fall: [], vader: [] };
const other = []; // your shared photos whose caption doesn't say what they are
let dropped = 0;
for (const p of seen.values()) {
  // photos only, never video, never politics
  if (!p.image || p.isVideo || isPolitical(p.text) || isCrude(p.username)) {
    dropped++;
    continue;
  }
  // everything you didn't share yourself also drops corny posts and ads
  if (p.source !== "yours" && (isPromo(p.text) || isCorny(p.text))) {
    dropped++;
    continue;
  }
  const s = stageOf(p.text) ?? (STAR_WARS.test(p.text) ? "vader" : null);
  if (s) groups[s].push(p);
  else if (p.source === "yours") other.push(p);
}
// your own shares first (in your order), then the rest by views
for (const k of Object.keys(groups)) {
  groups[k] = [
    ...groups[k].filter((p) => p.source === "yours"),
    ...groups[k].filter((p) => p.source !== "yours").sort((a, b) => b.views - a.views),
  ].slice(0, 50);
}

writeFileSync("x-candidates.json", JSON.stringify({ mode: MODE, label, reads, artists, groups, other: other.slice(0, 60) }, null, 2));

// ---------- a readable page with a thumbnail of every photo ----------
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 90);
const fmt = (n) => n.toLocaleString("en-US");
let md = `## Star Wars photos on X (${label})\n\n`;
md += `Read **${reads}** posts (about **$${(reads * 0.005).toFixed(2)}** at $0.005/read). `;
md += `Skipped ${dropped}: videos, no photo, politics, crude account names, or (not from you) memes/toys/cosplay/AI/ads.\n\n`;
if (MODE === "posts") {
  md += artists.length
    ? `Artists found in your shares: ${artists.slice(0, 30).map((a) => `@${a}`).join(", ")}${artists.length > 30 ? ` and ${artists.length - 30} more` : ""}.\n\n`
    : "_No artists found in your shares, so there was nothing more to search._\n\n";
}

function table(title, prefix, list) {
  let out = `### ${title}\n\n`;
  if (!list.length) return out + "_Nothing found this run._\n\n";
  out += "| # | Photo | From | Views | Account | Post | ID |\n|---|---|---|---:|---|---|---|\n";
  list.forEach((p, i) => {
    const thumb = `<a href="${p.url}"><img src="${p.image}" width="140" alt=""></a>`;
    const from = p.source === "yours" ? "you" : p.source === "artist" ? "same artist" : "search";
    out += `| **${prefix}${i + 1}** | ${thumb} | ${from} | ${fmt(p.views)} | @${p.username} | [${esc(p.text) || "(no text)"}](${p.url}) | ${p.id} |\n`;
  });
  return out + "\n";
}
md += table("Anakin (left card)", "A", groups.anakin);
md += table("The fall (left card)", "F", groups.fall);
md += table("Darth Vader (right card)", "V", groups.vader);
if (MODE === "posts") {
  md += table("Other photos you shared (no Star Wars words in the caption - pick any that are Star Wars)", "O", other.slice(0, 60));
}
md += "Tell Kiro the numbers of the photos you like (for example `A1, A4, F2, V3, O7`), and for O picks which card each goes on.\n";

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
