// Tiny in-memory vector store with cosine similarity.
// Good enough for a knowledge base of this size; swap for a real vector DB later.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, "index.json");

export function saveIndex(records) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(records), "utf8");
}

export function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return [];
  }
}

function cosine(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function topK(queryEmbedding, records, k = 3) {
  return records
    .map((r) => ({ ...r, score: cosine(queryEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
