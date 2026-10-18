import type { Package, ChatMessage } from "./types";

const BASE = "/api";

export async function getPackages(): Promise<Package[]> {
  const res = await fetch(`${BASE}/packages`);
  if (!res.ok) throw new Error("Failed to load packages");
  return res.json();
}

export async function startCheckout(packageId: string): Promise<void> {
  const res = await fetch(`${BASE}/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  if (data.url) window.location.href = data.url;
}

export async function sendChat(
  message: string,
  history: ChatMessage[]
): Promise<{ reply: string; sources?: string[] }> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Chat failed");
  return data;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}
