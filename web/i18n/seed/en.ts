// English copy for the seed partner page — the source the Chinese file mirrors key for key.
import type { SeedCopy } from "./types";

const en: SeedCopy = {
  meta: {
    title: "Become an AI4Kanban seed partner",
    description:
      "Share redacted sessions to improve AI4Kanban. Accepted partners get 6 months of Pro, with no charge afterwards.",
  },
  title: "Become a seed partner",
  email: "Email",
  github: "GitHub username",
  githubHint: "Pro goes on this account.",
  use: "How do you plan to use AI4Kanban?",
  useHint: "A sentence or two is enough.",
  submit: "Apply",
  submitting: "Sending…",
  privacy: "Privacy",
  errors: {
    emailRequired: "Enter your email. Our reply goes there.",
    emailInvalid: "That email address does not look right.",
    emailTooLong: "Keep the email under 200 characters.",
    githubRequired: "Enter your GitHub username.",
    githubInvalid: "That GitHub username does not look right.",
    useRequired: "Tell us how you plan to use it.",
    useTooLong: "Keep it under 5000 characters.",
  },
  limited: {
    title: "Too many attempts",
    body: "Your application is kept. Try again shortly, or email {support}.",
  },
  unknown: {
    title: "We could not confirm it arrived",
    body: "Your application is kept. Sending it again is safe — it will not arrive twice.",
  },
  failed: {
    title: "Your application was not sent",
    body: "Your application is kept. Try again, or email {support}.",
  },
  sent: {
    title: "Application received",
    body: "Each one is reviewed by hand. We will reply to {email}.",
  },
};

export default en;
