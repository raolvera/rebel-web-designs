import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import checkoutRouter from "./routes/checkout.js";
import chatRouter from "./routes/chat.js";
import { activeProvider } from "./ai/provider.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// In production, require CLIENT_URL to be set (don't silently fall back to localhost).
if (isProd && !process.env.CLIENT_URL) {
  console.error("FATAL: CLIENT_URL must be set in production (CORS origin).");
  process.exit(1);
}
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: clientUrl }));
// Small body limit — the chat/checkout payloads are tiny; blocks payload DoS.
app.use(express.json({ limit: "16kb" }));

// Rate limiting — protect the expensive AI + Stripe endpoints from abuse.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 chat messages/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Slow down — too many messages. Try again in a minute." },
});
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Try again shortly." },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: activeProvider });
});

app.use("/api/create-checkout-session", checkoutLimiter);
app.use("/api/chat", chatLimiter);

app.use("/api", checkoutRouter);
app.use("/api/chat", chatRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Rebel server listening on http://localhost:${PORT}`);
  console.log(`AI provider: ${activeProvider}`);
});
