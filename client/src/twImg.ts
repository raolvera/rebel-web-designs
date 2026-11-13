// X's image CDN (pbs.twimg.com) can send a lighter copy of any photo, as WebP:
//  - "360x360": fits in 360px (~30 KB), enough for a card on a normal screen
//  - "small":   fits in 680px (~100 KB), for sharp (retina) screens
//  - "large":   up to 2048px, for the full-screen view
// Shared by the cards (SagaCards) and the build (vite.config.ts), which
// preloads each card's first photo. Both must build the exact same strings
// or the browser downloads the photo twice.

function twBase(url?: string): string | undefined {
  return url?.match(/^(https:\/\/pbs\.twimg\.com\/media\/[^.?]+)/)?.[1];
}

export function twImg(url: string | undefined, size: "small" | "large"): string | undefined {
  const b = twBase(url);
  return b ? `${b}?format=webp&name=${size}` : url;
}

export function twSrcSet(url: string | undefined): string | undefined {
  const b = twBase(url);
  return b ? `${b}?format=webp&name=360x360 360w, ${b}?format=webp&name=small 680w` : undefined;
}

// How wide the card photo shows: up to ~300px on phones (stacked cards), about
// 240px beside the title on laptops and desktops.
export const CARD_IMG_SIZES = "(max-width: 639px) 300px, 240px";
