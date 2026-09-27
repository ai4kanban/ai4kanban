import type { PageMeta } from "@/i18n/types";

/**
 * The seed partner application (#1039). The lead is the pricing page's seed
 * partner copy, so it is not repeated here. `{support}` and `{email}` are drawn
 * as the contact form draws them.
 */
export type SeedCopy = {
  meta: PageMeta;
  title: string;
  email: string;
  github: string;
  githubHint: string;
  use: string;
  useHint: string;
  submit: string;
  submitting: string;
  privacy: string;
  errors: {
    emailRequired: string;
    emailInvalid: string;
    emailTooLong: string;
    githubRequired: string;
    githubInvalid: string;
    useRequired: string;
    useTooLong: string;
  };
  limited: { title: string; body: string };
  unknown: { title: string; body: string };
  failed: { title: string; body: string };
  sent: { title: string; body: string };
};
