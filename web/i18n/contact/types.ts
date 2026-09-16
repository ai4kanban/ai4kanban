import type { PageMeta } from "../types";

/**
 * The contact page (#785): one form for support and for custom agents, and a
 * pointer to training where that page is published.
 *
 * `{support}` is the support address, drawn as a link; `{email}` is the address
 * the visitor typed. Both stay as they are in every language, and so do the prices.
 */
export type ContactCopy = {
  meta: PageMeta;
  eyebrow: string;
  title: string;
  lead: string;
  reason: string;
  support: { name: string; body: string };
  customize: { name: string; body: string; price: string; per: string; note: string };
  email: string;
  message: string;
  workflow: string;
  workflowHint: string;
  submit: string;
  submitting: string;
  privacy: string;
  errors: {
    emailRequired: string;
    emailInvalid: string;
    emailTooLong: string;
    messageRequired: string;
    messageTooLong: string;
    workflowRequired: string;
    workflowTooLong: string;
  };
  limited: { title: string; body: string };
  unknown: { title: string; body: string };
  failed: { title: string; body: string };
  sent: { title: string; body: string; another: string };
  training: { title: string; body: string; cta: string };
};
