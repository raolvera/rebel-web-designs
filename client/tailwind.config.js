/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0b",        // near-black base
        coal: "#121214",       // panel background
        steel: "#1b1b1f",      // raised surface
        silver: "#c9ccd1",     // primary light text
        plate: "#e9ebee",      // bright silver for buttons/surfaces
        ash: "#8a8d93",        // muted gray
        blood: "#c81028",      // crimson red accent (used sparingly)
        ember: "#e11331",      // bright crimson highlight (sparingly)
      },
      fontFamily: {
        // "Stand out but readable": Space Grotesk for display, Inter for body.
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(200, 16, 40, 0.4)",          // crimson glow (accent only)
        chromeGlow: "0 0 22px rgba(201, 204, 209, 0.28)", // silver glow (primary)
        silverRedGlow: "0 0 20px rgba(200, 16, 40, 0.45)", // red outer glow for silver CTAs
        card: "0 8px 30px rgba(0, 0, 0, 0.6)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(201,204,209,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,204,209,0.04) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
