// English copy for the pricing page — the source the Chinese file mirrors key for key.
import type { PricingCopy } from "./types";

const en: PricingCopy = {
  meta: {
    title: "AI4Kanban pricing — Free, Pro and seed partners",
    description:
      "AI4Kanban is free and open source. Pro adds email, slide deck and demo video workflows for $10 a month, billed yearly.",
  },
  hero: {
    eyebrow: "PRICING",
    title: "Free to run. Pro when you need more.",
    lead: "Every plan runs on your own computer, with your own coding agents.",
  },
  billing: { monthly: "Monthly", yearly: "Yearly", save: "Save 33%" },
  free: {
    name: "Free",
    price: "$0",
    tagline: "Apache 2.0 open source.",
    rows: [
      "Works with 8 coding agents",
      "Coding workflow with 7 agents",
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
    rows: ["Email workflow", "Slide deck workflow", "Demo video workflow", "Priority support"],
    button: "Coming soon",
  },
  seed: {
    name: "Seed partner",
    body: "Share redacted sessions with us to improve AI4Kanban. Accepted partners get 6 months of Pro, with no charge afterwards.",
    button: "Join the waitlist",
  },
  training: { name: "Training", button: "See training" },
};

export default en;
