// Builds the vector index from the knowledge base.
// Run with: npm run seed
import "dotenv/config";
import { knowledge } from "./knowledge.js";
import { embed } from "../ai/provider.js";
import { saveIndex } from "./store.js";

async function main() {
  console.log(`Embedding ${knowledge.length} knowledge chunks...`);
  const records = [];
  for (const entry of knowledge) {
    const content = `${entry.title}\n${entry.text}`;
    const embedding = await embed(content);
    records.push({ id: entry.id, title: entry.title, text: entry.text, embedding });
    console.log(`  ok: ${entry.id}`);
  }
  saveIndex(records);
  console.log(`Saved index with ${records.length} records.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
