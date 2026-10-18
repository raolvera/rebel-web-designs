// Provider-agnostic AI layer for Rebel.
// Default: Ollama (local, free). Swappable to Groq or Gemini via AI_PROVIDER env var.
// No OpenAI, no Meta required (run Ollama with Mistral/Qwen).

const PROVIDER = (process.env.AI_PROVIDER || "ollama").toLowerCase();

/* ----------------------------- Ollama (local) ----------------------------- */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "mistral";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

async function ollamaChat(messages) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_CHAT_MODEL, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.message?.content ?? "";
}

async function ollamaEmbed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embedding;
}

/* ------------------------------ Groq (cloud) ------------------------------ */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "mistral-saba-24b";

async function groqChat(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_CHAT_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`Groq chat failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/* ----------------------------- Gemini (cloud) ----------------------------- */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-1.5-flash";

async function geminiChat(messages) {
  // Collapse system+user messages into a single Gemini "contents" request.
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const convo = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "assistant" ? "Rebel" : "User"}: ${m.content}`)
    .join("\n");
  const prompt = system ? `${system}\n\n${convo}` : convo;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini chat failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/* ----------------------- Local fallback embeddings ------------------------ */
// Groq/Gemini chat still need embeddings for RAG. To stay provider-light we
// always use Ollama for embeddings when available; otherwise a cheap hashing
// embedding keeps the demo working without any model at all.

function hashEmbed(text, dims = 256) {
  const vec = new Array(dims).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[Math.abs(h) % dims] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/* -------------------------------- Public API ------------------------------ */

export async function chat(messages) {
  switch (PROVIDER) {
    case "groq":
      return groqChat(messages);
    case "gemini":
      return geminiChat(messages);
    case "ollama":
    default:
      return ollamaChat(messages);
  }
}

export async function embed(text) {
  // Prefer Ollama embeddings; fall back to a local hashing embedding.
  try {
    return await ollamaEmbed(text);
  } catch {
    return hashEmbed(text);
  }
}

export const activeProvider = PROVIDER;
