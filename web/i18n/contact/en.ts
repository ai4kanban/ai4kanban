// English — the contact page. The source the other four mirror.
// Writing rules: `i18n/index.ts`.
import type { ContactCopy } from "./types";

const en: ContactCopy = {
  meta: {
    title: "Contact AI4Kanban — support and custom agents",
    description:
      "Get help with AI4Kanban, or have agent workflows built around how you work. One form, answered by email.",
    socialTitle: "Contact AI4Kanban",
  },
  eyebrow: "CONTACT",
  title: "Talk to us",
  lead: "Get help with AI4Kanban, or have agents built around your workflow.",
  reason: "What do you need?",
  support: {
    name: "Support",
    body: "Bugs, setup, or questions. Include your version and logs.",
  },
  customize: {
    name: "Customize agents",
    body: "Agent workflows tailored to how you work.",
    price: "$15",
    per: " / agent",
    note: "A 5-agent workflow is $75. Quote and payment by email.",
  },
  email: "Email",
  message: "Message",
  workflow: "Describe your workflow",
  workflowHint: "The steps, the tools involved, and what each agent should do.",
  submit: "Send message",
  submitting: "Sending…",
  privacy: "Privacy",
  errors: {
    emailRequired: "Enter your email address. Our reply goes there.",
    emailInvalid: "That does not look like an email address.",
    emailTooLong: "Use an email address of 200 characters or fewer.",
    messageRequired: "Write a message.",
    messageTooLong: "Keep the message to 5,000 characters or fewer.",
    workflowRequired: "Describe the workflow you want.",
    workflowTooLong: "Keep the description to 5,000 characters or fewer.",
  },
  limited: {
    title: "Too many messages from here",
    body: "What you wrote is kept. Try again later, or email {support}.",
  },
  unknown: {
    title: "We could not confirm it was sent",
    body: "What you wrote is kept. Send it again — it will not arrive twice.",
  },
  failed: {
    title: "Your message was not sent",
    body: "What you wrote is kept. Try again, or email {support}.",
  },
  sent: {
    title: "Message received",
    body: "We will reply to {email}.",
    another: "Send another message",
  },
  training: {
    title: "Training",
    body: "One-to-one guidance on your own project.",
    cta: "See training",
  },
};

export default en;
