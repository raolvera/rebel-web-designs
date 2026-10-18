import express from "express";
import Stripe from "stripe";
import { packages } from "../data/packages.js";

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Expose the catalog so the frontend and backend agree on prices.
router.get("/packages", (_req, res) => {
  res.json(packages.map(({ priceId, ...pub }) => pub));
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env to enable payments.",
      });
    }

    const { packageId } = req.body || {};
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: "Unknown package" });
    if (!pkg.buyable || pkg.priceCents == null) {
      return res.status(400).json({ error: "This package is quote-only. Please request a quote." });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pkg.priceCents,
            product_data: {
              name: pkg.name,
              description: pkg.description,
            },
          },
        },
      ],
      success_url: `${clientUrl}/?checkout=success`,
      cancel_url: `${clientUrl}/?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout error:", err.message);
    res.status(500).json({ error: "Could not create checkout session." });
  }
});

export default router;
