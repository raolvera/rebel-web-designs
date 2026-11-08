// Finds Star Wars photos of Anakin / the fall / Darth Vader on X for the intro
// cards. It does NOT change the site: it lists candidates (with thumbnails) so
// you can pick which ones the cards show.
//
// Modes (X_MODE):
//   posts  = (default) 1) the photos an account has posted or reposted
//            (X_USERNAME, default rebel_520), then 2) more Star Wars art from
//            the same artists, then 3) similar artists.
//   likes  = same, but step 1 reads YOUR likes. X only shows likes to the
//            account's own keys, so this needs 4 more secrets: X_API_KEY,
//            X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET. Likes are filtered
//            to true art (no AI, memes, toys, ads).
//   all    = search all of X for Star Wars artwork
//   recent = same search, last 7 days only
//
// Run it from GitHub: Actions -> "Find Star Wars edits on X" -> Run workflow.
// Cost: every post X returns is one paid read (about $0.005 each when this was
// written). Up to X_PAGES x 100 posts in step 1, and X_ARTIST_PAGES x 100 in
// step 2.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { FIELDS, isCorny, isCrude, isPolitical, isPromo, stageOf, toPosts, token, userKeys, xGet } from "./x-common.mjs";

const bearer = token();
if (!bearer) {
  // the action is useless without the secret: fail loudly
  console.error("::error::The X_BEARER_TOKEN secret is missing (Settings -> Secrets and variables -> Actions).");
  process.exit(1);
}

const MODE = ["both", "posts", "likes", "all", "recent"].includes(process.env.X_MODE) ? process.env.X_MODE : "both";
// both / posts / likes all start from YOUR photos, then find similar art
const FROM_YOU = MODE === "both" || MODE === "posts" || MODE === "likes";
let likesNote = ""; // why likes were skipped, shown at the top of the results
const PAGES = Math.min(10, Math.max(1, Number(process.env.X_PAGES) || 5));
const ARTIST_PAGES = Math.min(10, Math.max(0, Number(process.env.X_ARTIST_PAGES ?? 5)));
const SIMILAR_PAGES = Math.min(10, Math.max(0, Number(process.env.X_SIMILAR_PAGES ?? 5)));
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
async function readPages(path, baseParams, pages, pageParam, seen, tag, { resolve = false, failFirst = true, auth = bearer } = {}) {
  let next;
  let got = 0;
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams(baseParams);
    params.set("max_results", "100");
    if (next) params.set(pageParam, next);
    let body;
    try {
      body = await xGet(path, params, auth);
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
let tags = [];

if (FROM_YOU) {
  const doPosts = MODE !== "likes";
  const doLikes = MODE !== "posts";
  const parts = [];

  if (doPosts) {
    // ---------- step 1a: what @USERNAME posted / reposted ----------
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
    parts.push(`@${USERNAME}'s posts + reposts`);
  }

  if (doLikes) {
    // ---------- step 1b: YOUR likes (needs your own account's keys) ----------
    // In "both" mode a likes problem doesn't stop the run: your posts and
    // reposts still come through, and the reason shows at the top.
    const skip = (why) => {
      if (MODE === "likes") fail(why);
      likesNote = `**Your likes were skipped:** ${why}`;
    };
    const keys = userKeys();
    if (!keys) {
      skip(
        "they need your own account's keys. Add these 4 repository secrets: X_API_KEY, X_API_SECRET (the API Key + Secret), X_ACCESS_TOKEN, X_ACCESS_SECRET (Keys and tokens -> Access Token and Secret -> Generate).",
      );
    } else {
      let me;
      try {
        me = await xGet("/users/me", new URLSearchParams({ "user.fields": "username" }), keys);
      } catch (e) {
        skip(`your account keys didn't work: ${e.message || e}`);
      }
      if (me?.data?.id) {
        const r = await readPages(`/users/${me.data.id}/liked_tweets`, new URLSearchParams(FIELDS), PAGES, "pagination_token", seen, "liked", {
          auth: keys,
          failFirst: MODE === "likes",
        });
        if (r.error && !r.got) skip(`X said: ${r.error}`);
        else parts.push(`@${me.data.username}'s likes (true art only)`);
      } else if (me) skip("your account keys didn't return an account.");
    }
  }
  label = `${parts.join(" + ") || "nothing"}, the same artists, and similar artists`;

  // ---------- step 2: more Star Wars art from those artists ----------
  const mine = [...seen.values()].filter((p) => p.image && !p.isVideo);
  const swAuthors = mine.filter((p) => STAR_WARS.test(p.text)).map((p) => p.username);
  // art accounts often post with no caption: if none matched, use every artist you shared
  const pool = swAuthors.length ? swAuthors : mine.map((p) => p.username);
  artists = [...new Set(pool.filter((u) => u && u.toLowerCase() !== USERNAME.toLowerCase()))];

  if (artists.length && ARTIST_PAGES > 0) {
    // one query per batch of artists that fits X's 512-character limit.
    // Their reposts are included: artists repost other artists in the same
    // style, which finds NEW artists (marked "similar artist").
    const tail = ` ${SW_TERMS} has:images -has:videos -is:reply`;
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
      q.set("tweet.fields", `${q.get("tweet.fields")},referenced_tweets`);
      q.set("expansions", `${q.get("expansions")},referenced_tweets.id,referenced_tweets.id.attachments.media_keys,referenced_tweets.id.author_id`);
      q.set("query", `(${b.map((x) => `from:${x}`).join(" OR ")})${tail}`);
      q.set("sort_order", "relevancy");
      const pages = Math.min(perBatch, budget);
      budget -= pages;
      // all-time first; if that's not allowed on this account, last 7 days
      let r = await readPages("/tweets/search/all", q, pages, "next_token", seen, "artist", { failFirst: false, resolve: true });
      if (r.error && !r.got) r = await readPages("/tweets/search/recent", q, pages, "next_token", seen, "artist", { failFirst: false, resolve: true });
    }
    // a repost by one of your artists, of someone else's work = a similar artist
    const known = new Set(artists.map((a) => a.toLowerCase()));
    for (const p of seen.values()) if (p.source === "artist" && !known.has(p.username.toLowerCase())) p.source = "similar";
  }

  // ---------- step 3: other artists using the same hashtags ----------
  if (SIMILAR_PAGES > 0) {
    const counts = new Map();
    for (const p of seen.values()) {
      if (!p.image || p.isVideo || !STAR_WARS.test(p.text) || isPolitical(p.text) || isCorny(p.text)) continue;
      for (const m of p.text.matchAll(/#(\w{3,40})/g)) {
        const t = m[1].toLowerCase();
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    // the most-used tags; skip any that are political or corny themselves
    tags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .filter((t) => !isPolitical(`#${t} ${t}`) && !isCorny(t) && !isPromo(t))
      .slice(0, 10);
    if (!tags.length) tags = ["starwarsart", "digitalart", "conceptart", "illustration"];
    let query = `(${tags.map((t) => `#${t}`).join(" OR ")}) ${SW_TERMS} has:images -has:videos -is:retweet -is:reply -is:quote`;
    // leave out artists already found, so these are NEW people
    for (const u of [USERNAME, ...artists]) {
      if ((query + ` -from:${u}`).length > 512) break;
      query += ` -from:${u}`;
    }
    for (const w of ["lol", "meme", "toy", "figure", "cosplay", "ai", "aiart", "midjourney"]) {
      if ((query + ` -${w}`).length > 512) break;
      query += ` -${w}`;
    }
    const q = new URLSearchParams(FIELDS);
    q.set("query", query);
    q.set("sort_order", "relevancy");
    let r = await readPages("/tweets/search/all", q, SIMILAR_PAGES, "next_token", seen, "similar", { failFirst: false });
    if (r.error && !r.got) await readPages("/tweets/search/recent", q, SIMILAR_PAGES, "next_token", seen, "similar", { failFirst: false });
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
// photos already on the cards don't need picking again
const onCards = new Set();
try {
  const picks = JSON.parse(readFileSync(new URL("./x-picks.json", import.meta.url), "utf8"));
  for (const k of ["anakin", "fall", "vader"]) for (const id of picks[k] ?? []) onCards.add(id);
} catch {
  /* no picks yet */
}
const groups = { anakin: [], fall: [], vader: [] };
const other = []; // your photos whose caption doesn't say what they are
let dropped = 0;
for (const p of seen.values()) {
  if (onCards.has(p.id)) continue;
  // photos only, never video
  if (!p.image || p.isVideo) {
    dropped++;
    continue;
  }
  // Your own posts, reposts and likes are your call: no other filters.
  // Strangers' posts (same/similar artists, searches) still drop politics,
  // crude accounts, memes/toys/cosplay/AI and ads.
  const yours = p.source === "yours" || p.source === "liked";
  if (!yours && (isPolitical(p.text) || isCrude(p.username) || isPromo(p.text) || isCorny(p.text))) {
    dropped++;
    continue;
  }
  const s = stageOf(p.text) ?? (STAR_WARS.test(p.text) ? "vader" : null);
  if (s) groups[s].push(p);
  else if (p.source === "yours" || p.source === "liked") other.push(p);
}
// your reposts first, then your likes (both in your order), then the rest by views
for (const k of Object.keys(groups)) {
  groups[k] = [
    ...groups[k].filter((p) => p.source === "yours"),
    ...groups[k].filter((p) => p.source === "liked"),
    ...groups[k].filter((p) => p.source !== "yours" && p.source !== "liked").sort((a, b) => b.views - a.views),
  ].slice(0, 60);
}
// same order for the uncaptioned ones
other.sort((a, b) => (a.source === b.source ? 0 : a.source === "yours" ? -1 : 1));

writeFileSync("x-candidates.json", JSON.stringify({ mode: MODE, label, reads, artists, tags, groups, other: other.slice(0, 60) }, null, 2));

// ---------- a readable page with a thumbnail of every photo ----------
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 90);
const fmt = (n) => n.toLocaleString("en-US");
let md = `## Star Wars photos on X (${label})\n\n`;
if (likesNote) md += `> ⚠️ ${likesNote}\n\n`;
md += `Read **${reads}** posts (about **$${(reads * 0.005).toFixed(2)}** at $0.005/read). `;
md += `Skipped ${dropped}: videos and posts with no photo (and, from other artists only, politics, crude accounts, memes/toys/cosplay/AI, ads). Your posts, reposts and likes aren't filtered. Photos already on the cards aren't listed.\n\n`;
if (FROM_YOU) {
  md += artists.length
    ? `Artists found in your shares: ${artists.slice(0, 30).map((a) => `@${a}`).join(", ")}${artists.length > 30 ? ` and ${artists.length - 30} more` : ""}.\n\n`
    : "_No artists found in your shares, so there was nothing more to search._\n\n";
  if (tags.length) md += `Similar artists were found with these hashtags: ${tags.map((t) => `#${t}`).join(" ")}.\n\n`;
}

function table(title, prefix, list) {
  let out = `### ${title}\n\n`;
  if (!list.length) return out + "_Nothing found this run._\n\n";
  out += "| # | Photo | From | Views | Account | Post | ID |\n|---|---|---|---:|---|---|---|\n";
  list.forEach((p, i) => {
    const thumb = `<a href="${p.url}"><img src="${p.image}" width="140" alt=""></a>`;
    const from = { yours: "you reposted", liked: "you liked", artist: "same artist", similar: "similar artist" }[p.source] ?? "search";
    out += `| **${prefix}${i + 1}** | ${thumb} | ${from} | ${fmt(p.views)} | @${p.username} | [${esc(p.text) || "(no text)"}](${p.url}) | ${p.id} |\n`;
  });
  return out + "\n";
}
md += table("Anakin (left card)", "A", groups.anakin);
md += table("The fall (left card)", "F", groups.fall);
md += table("Darth Vader (right card)", "V", groups.vader);
if (FROM_YOU) {
  md += table("Other photos you reposted or liked (no Star Wars words in the caption - pick any that are Star Wars)", "O", other.slice(0, 80));
}
md += "Tell Kiro the numbers of the photos you like (for example `A1, A4, F2, V3, O7`), and for O picks which card each goes on.\n";

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
