import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react(), cspMeta()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
