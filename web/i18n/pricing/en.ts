// English copy for the pricing page — the source the Chinese file mirrors key for key.
import type { PricingCopy } from "./types";

const en: PricingCopy = {
  meta: {
    title: "AI4Kanban: Plans and pricing",
    description:
      "AI4Kanban: an agent workspace for indie hackers. Coding is free; Pro adds slides, product videos, social posts, blogs and video clones. $10/month, billed yearly.",
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
      "Coding workflow with 8 agents",
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
      "Slide deck workflow",
      "Product video workflow",
      "Social post workflow",
      "Blog post workflow",
      "Video clone workflow",
      "Auto-screened ideas — you decide only the unclear ones",
      "5,000 AI credits a month — voiceover uses 1 per second, a generated image 320, a music track 160",
      "Priority support",
    ],
    button: "Get Pro",
  },
  seed: {
    name: "Seed partner",
    body: "Share redacted sessions with us to improve AI4Kanban. Accepted partners get 6 months of Pro, with no charge afterwards.",
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
