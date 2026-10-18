export interface Package {
  id: string;
  lane: string; // "Front-End" | "Branding" | "Full-Stack" | "Custom"
  name: string;
  description: string;
  priceCents?: number; // absent for quote-only custom tier
  fromPrice?: boolean; // show "from $X"
  tag: string;
  popular?: boolean;
  features: string[];
  buyable?: boolean; // false = "request a quote" card
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
