import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { sendChat } from "../api";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Yo, I'm Rebel 🤘 Ask me about services, pricing, or how a project works. What are you building?",
};

export default function RebelChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await sendChat(text, next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            e instanceof Error
              ? `⚠️ ${e.message}`
              : "⚠️ Something went wrong reaching my brain.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blood font-display text-xl font-bold text-white shadow-glow transition hover:scale-105 hover:bg-ember"
        aria-label="Chat with Rebel"
      >
        {open ? "✕" : "R"}
      </button>

      {/* Panel */}
      {open && (
        <div className="rise fixed bottom-24 right-6 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-coal shadow-card">
          <div className="flex items-center gap-3 border-b border-white/10 bg-ink/80 px-4 py-3">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-sm bg-gradient-to-br from-plate to-ash font-display font-bold text-ink">
              R
            </span>
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold text-silver">Rebel</div>
              <div className="flex items-center gap-1.5 text-[11px] text-ash">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                AI assistant · online
              </div>
            </div>
          </div>

          <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-gradient-to-br from-plate to-silver text-ink"
                      : "rounded-bl-sm border border-white/10 bg-steel text-silver"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-steel px-3.5 py-2 text-sm text-ash">
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 bg-ink/60 p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask Rebel anything…"
                className="flex-1 rounded-sm border border-white/10 bg-coal px-3 py-2 text-sm text-silver outline-none placeholder:text-ash focus:border-silver/60"
              />
              <button
                onClick={send}
                disabled={busy}
                className="rounded-sm bg-gradient-to-br from-plate to-silver px-3.5 py-2 text-sm font-semibold text-ink transition hover:from-white hover:to-plate disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ash"
      style={{ animationDelay: delay }}
    />
  );
}
