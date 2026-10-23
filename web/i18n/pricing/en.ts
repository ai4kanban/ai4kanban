// English copy for the pricing page — the source the Chinese file mirrors key for key.
import type { PricingCopy } from "./types";

const en: PricingCopy = {
  meta: {
    title: "WildCrane: Plans and pricing",
    description:
      "All WildCrane workflows are free. Pro adds templates for more polished results, AI credits and automatic idea screening. $10/month, billed yearly.",
  },
  hero: {
    eyebrow: "PRICING",
    title: "Plans and pricing",
    lead: "Every plan runs on your own computer, with your own AI tools.",
  },
  billing: { monthly: "Monthly", yearly: "Yearly", save: "Save 33%" },
  free: {
    name: "Free",
    price: "$0",
    tagline: "Apache 2.0 open source.",
    rows: [
      "Works with 8 coding agents",
      { text: "All 6 workflows", more: { list: ["Coding", "Slide deck", "Product video", "Social post", "Blog post", "Video clone"] } },
      "No limit on concurrent tasks",
      "Unlimited custom workflows and agents",
      "Email support",
    ],
    button: "Download",
  },
  pro: {
    name: "Pro",
    yearly: { price: "$120", per: "/ year", sub: "$10 a month, billed yearly" },
    monthly: { price: "$15", per: "/ month" },
    leadIn: "Everything in Free, plus:",
    rows: [
      "All Pro templates",
      "Automatic idea screening",
      "AI voiceover, image and music generation",
      {
        text: "5,000 AI credits a month",
        cue: "Credit costs",
        more: {
          note: "AI voiceover, image and music generation share your 5,000 monthly credits.",
          table: [
            ["Voiceover", "1 credit / second"],
            ["Image", "320 credits each"],
            ["Music", "160 credits / track"],
          ],
        },
      },
      "Priority support",
    ],
    button: "Start 7-day free trial",
  },
  seed: {
    name: "Seed partner",
    body: "Share redacted sessions with us to improve WildCrane. Accepted partners get 6 months of Pro, with no charge afterwards.",
    button: "Join the waitlist",
  },
  custom: {
    name: "Done-for-you agents",
    price: "$15",
    per: "/ agent",
    body: "Tell us your workflow. We build the agents for it.",
    button: "Describe your workflow",
  },
  training: { name: "Training", button: "See training" },
};

export default en;
