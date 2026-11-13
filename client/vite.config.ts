import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { CARD_IMG_SIZES, twImg, twSrcSet } from "./src/twImg";

// Content Security Policy for the built site. GitHub Pages can't send custom
// response headers, so it goes in a <meta> tag instead. Only added to the
// build: the dev server needs inline scripts for hot reload.
// Allowed outside sources: the YouTube player (Media Player), X photos on the
// Star Wars cards, and the Rebel Runner name list. Fonts are self-hosted.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: https://pbs.twimg.com https://i.ytimg.com",
  "media-src 'self' https://video.twimg.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self' https://randomuser.me",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

// The Star Wars cards' photos come from x-posts.json (written by the deploy
// just before the build), so the browser normally only learns about them once
// the app has loaded. The build already knows each card's FIRST photo, so it
// names those two in the page's <head> and the browser starts on them right
// away. Same srcset/sizes as the cards (src/twImg.ts), so nothing downloads
// twice. No x-posts.json (local builds) = no preload, nothing breaks.
type Post = { image?: string; images?: string[] };
function firstPhotos(): string[] {
  try {
    const d = JSON.parse(readFileSync(new URL("./public/x-posts.json", import.meta.url), "utf8")) as {
      posts?: Record<string, Post[] | undefined>;
    };
    const first = (list?: Post[]) => list?.[0]?.images?.[0] ?? list?.[0]?.image;
    // left card opens on the first Anakin photo (or the fall, if no Anakin);
    // right card on the first Vader photo
    return [first(d.posts?.anakin) ?? first(d.posts?.fall), first(d.posts?.vader)].filter((u): u is string => !!u);
  } catch {
    return [];
  }
}

function preloadCardPhotos(): Plugin {
  return {
    name: "rwd-preload-card-photos",
    apply: "build",
    transformIndexHtml() {
      return firstPhotos()
        .map((u) => ({ href: twImg(u, "small"), srcset: twSrcSet(u) }))
        .filter((p) => p.srcset)
        .map((p) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            as: "image",
            href: p.href,
            imagesrcset: p.srcset,
            imagesizes: CARD_IMG_SIZES,
            fetchpriority: "high",
            referrerpolicy: "no-referrer",
          },
          injectTo: "head" as const,
        }));
    },
  };
}

function cspMeta(): Plugin {
  return {
    name: "rwd-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }];
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta(), preloadCardPhotos()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
