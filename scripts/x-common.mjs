// Shared helpers for the X (Twitter) API scripts. Uses Node's built-in fetch,
// so there is nothing to install. The token comes from the X_BEARER_TOKEN
// environment variable (a GitHub Actions secret) and is never printed.

export const API = "https://api.x.com/2";

// Fields we ask X for on every post.
export const FIELDS = new URLSearchParams({
  "tweet.fields": "public_metrics,author_id,attachments,created_at,lang",
  expansions: "attachments.media_keys,author_id",
  "media.fields": "type,url,preview_image_url",
  "user.fields": "name,username",
});

export function token() {
  const t = process.env.X_BEARER_TOKEN;
  if (!t) {
    console.log("X_BEARER_TOKEN is not set - skipping (no X data fetched).");
    return null;
  }
  return t;
}

export async function xGet(path, params, bearer) {
  const url = `${API}${path}?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.detail || body?.title || JSON.stringify(body).slice(0, 300);
    throw new Error(`X API ${res.status}: ${msg}`);
  }
  return body;
}

// Turn an X API response into simple post objects for the site.
export function toPosts(body) {
  const media = new Map((body.includes?.media ?? []).map((m) => [m.media_key, m]));
  const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));
  return (body.data ?? []).map((t) => {
    const user = users.get(t.author_id) ?? {};
    const m = (t.attachments?.media_keys ?? []).map((k) => media.get(k)).find(Boolean);
    const isVideo = m?.type === "video" || m?.type === "animated_gif";
    return {
      id: t.id,
      url: `https://x.com/${user.username ?? "i"}/status/${t.id}`,
      text: t.text ?? "",
      author: user.name ?? "",
      username: user.username ?? "",
      views: t.public_metrics?.impression_count ?? 0,
      likes: t.public_metrics?.like_count ?? 0,
      image: m ? (isVideo ? m.preview_image_url : m.url ?? m.preview_image_url) : undefined,
      isVideo,
    };
  });
}

// Anything political gets dropped, even if the search let it through.
const POLITICAL =
  /\b(trump|biden|harris|kamala|obama|maga|election|elections|vote|voting|democrat|democrats|republican|republicans|liberal|liberals|conservative|conservatives|woke|leftist|leftists|politic\w*|musk|elon|gop|dnc|congress|senate|president|immigra\w*|border|fascis\w*|communis\w*|socialis\w*|zoomer\w*|boomer\w*|millennial\w*|gen ?z|maxxing|propaganda|far[- ]right|far[- ]left|the left|the right|redpill\w*|groyper\w*|trad|tradwife|anakin[- ]?posting|they stole)\b/i;
// Words from the political "Anakin" meme trend that slipped through before.
const TREND =
  /\b(midterm\w*|chud\w*|kirk|soros|soro'?s|cuck\w*|gigachad|anakinwasright|hail ?the ?empire|long ?live ?the ?empire|longlivetheempire|virgin|prophesied)\b/i;
// Ads and shop posts, not edits: crypto tokens, listings, pre-orders, unboxings.
const PROMO =
  /(\$[a-z]{2,}\b|\btoken\b|\bsolana\b|\bairdrop\b|\blisting\b|\bpre[- ]?order\w*|\bunboxing\b|\bnew arrival\b|\blive at\b)/i;
// Account names that shouldn't show on a business site.
const CRUDE = /(dick|cuck|porn|nsfw|fuck|shit|cum|sex|nazi|hitler)/i;

// Corny / not-art: jokes and memes, toys and figures, cosplay, AI-made images,
// crossover gags. Only real artwork from artists and designers should show.
const CORNY =
  /(\b(lol|lmao|lmfao|meme\w*|funny|joke\w*|shitpost\w*|toys?|figures?|figuarts|hot toys|lego|funko|unboxing|cosplay\w*|cosplayer\w*|ai|aiart|ai art|ai[- ]generated|midjourney|kling|stable diffusion|dall-?e|sora|grok|batman|will smith|hockey|burglar|homesick|crossover)\b|😂|🤣|💀)/i;

export const isPolitical = (text) => POLITICAL.test(text) || TREND.test(text);
export const isCorny = (text) => CORNY.test(text);
export const isPromo = (text) => PROMO.test(text);
export const isCrude = (username) => CRUDE.test(username || "");

// Which card a post belongs on: Anakin, the fall, or Darth Vader.
export function stageOf(text) {
  const t = text.toLowerCase();
  const fall =
    /mustafar|high ground|order 66|revenge of the sith|\bfall\b|dark side|becom(es|ing) (darth )?vader|anakin (to|into) vader|transformation|you were my brother|i hate you|younglings/.test(t);
  const anakin = /anakin|hayden|chosen one|padm[eé]|podrac|skywalker/.test(t) && !/luke skywalker/.test(t);
  const vader = /vader|darth|sith lord|rogue one|hallway|i am your father|death star/.test(t);
  if (fall || (anakin && vader)) return "fall";
  if (anakin) return "anakin";
  if (vader) return "vader";
  return null;
}
