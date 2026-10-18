import express from "express";
import { chat, embed, activeProvider } from "../ai/provider.js";
import { loadIndex, topK } from "../rag/store.js";
import { knowledge } from "../rag/knowledge.js";

const router = express.Router();

const SYSTEM_PROMPT = `You are Rebel — the AI assistant and mascot for Rebel Web Designs,
an Arizona-based studio run by a full-stack web developer, UX/UI specialist, and graphic
designer serving small businesses and individuals (web development, UX/UI, logos, flyers,
photo retouching, video, print). Brand voice: "Fuel your fire with Rebel Web Designs —
build a website that will last forever," crafted with the precision of an eagle and the
confidence of a legend.

You are a real, capable assistant with personality — not a script. You can chat naturally,
answer general questions, explain tech concepts, and have a bit of bold, warm, goth-edge
charisma. But you follow these hard rules without exception:

IDENTITY:
- Your name is Rebel and you are the AI assistant for this site. If asked "who is Rebel?",
  "who are you?", or "what are you?", answer in the FIRST PERSON — e.g. "I'm Rebel, the AI
  assistant for Rebel Web Designs. I can help with services, pricing, process, and point
  you to the arcade games." Then offer to help.
- Do NOT confuse yourself with the studio's owner. You are the assistant/mascot; the owner
  is the Arizona-based full-stack web developer, UX/UI specialist, and graphic designer.

ACCURACY (never hallucinate):
- For anything about THIS business — prices, packages, services, process, location,
  availability, the arcade games — state ONLY what the provided context supports.
- NEVER invent or guess prices, services, deadlines, discounts, guarantees, or facts
  about the studio. If the context does not cover it, say you are not sure and point the
  person to the Contact page or the Services/Pricing pages. Do not make things up.
- If you are genuinely unsure about a general fact, say so rather than guessing.

NO COMPETING OR COMPARING:
- NEVER compare Rebel Web Designs to, rank it against, name, recommend, or critique any
  other studio, freelancer, agency, tool, or competitor — including ones that offer the
  same services. Do not say "better than," "cheaper than," or benchmark against anyone.
- If asked who is better or to compare with a competitor, politely decline to compare and
  simply speak to what Rebel Web Designs does well. Sell our strengths, never knock others.

STYLE:
- Be concise and genuine. Avoid hype and empty superlatives. Reflect the rebel brand.
- No medical, legal, financial, or tax advice. For tax/legal questions, suggest a
  professional. (Arizona has Transaction Privilege Tax; defer specifics to an accountant.)
- Stay helpful, on-brand, and focused on getting the person to start a project or play the
  arcade.`;

// Fallback: if the index has not been built yet, retrieve by keyword overlap.
function keywordFallback(query, k = 3) {
  const q = query.toLowerCase();
  const terms = q.match(/[a-z0-9]+/g) || [];
  return knowledge
    .map((entry) => {
      const hay = `${entry.title} ${entry.text}`.toLowerCase();
      const score = terms.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const MAX_MESSAGE = 1500; // cap a single message
const MAX_HISTORY = 6; // most recent turns kept
const MAX_HISTORY_CONTENT = 1500;

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const message = body.message;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "message is required" });
    }
    if (message.length > MAX_MESSAGE) {
      return res.status(400).json({ error: "Message is too long." });
    }

    // Sanitize client-supplied history: must be an array, and ONLY user/assistant
    // roles are allowed. This blocks a client from forging a "system" message to
    // override Rebel's guardrails (prompt-injection hardening).
    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const safeHistory = rawHistory
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length > 0
      )
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CONTENT) }));

    // Retrieve relevant context (RAG).
    let context;
    const index = loadIndex();
    if (index.length > 0) {
      const qEmbedding = await embed(message);
      context = topK(qEmbedding, index, 3);
    } else {
      context = keywordFallback(message, 3);
    }

    const contextText = context
      .map((c) => `### ${c.title}\n${c.text}`)
      .join("\n\n");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Context about Rebel Web Designs:\n\n${contextText}`,
      },
      ...safeHistory,
      { role: "user", content: message },
    ];

    const reply = await chat(messages);
    res.json({ reply, sources: context.map((c) => c.title) });
  } catch (err) {
    console.error("chat error:", err.message);
    res.status(500).json({
      error:
        "Rebel could not reach its AI provider. If using Ollama, make sure it's running (ollama serve) and the model is pulled.",
      provider: activeProvider,
    });
  }
});

export default router;
