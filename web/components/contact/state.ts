// The contact form's values and the checks run before a submit (#785), shared
// with the seed partner application (#1039). The limits are the service's
// (`cloud/src/contact.ts`), so a message the page lets through is one the
// service takes.

export type Reason = "support" | "customize" | "seed";

export type Values = {
  reason: Reason;
  email: string;
  message: string;
  workflow: string;
  github: string;
};

export const EMPTY: Values = { reason: "support", email: "", message: "", workflow: "", github: "" };

export const MAX_EMAIL = 200;
export const MAX_TEXT = 5000;

export type FieldError = "required" | "invalid" | "tooLong";
export type FieldErrors = Partial<Record<"email" | "message" | "workflow" | "github", FieldError>>;

/** What a submit came back with, short of success. `unknown` is an answer that
 *  never arrived: a retry with the same `opId` is safe. */
export type Problem = "limited" | "unknown" | "failed";

export function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = "required";
  else if (email.length > MAX_EMAIL) errors.email = "tooLong";
  else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) errors.email = "invalid";

  const message = text(values.message);
  if (message) errors.message = message;

  if (values.reason === "customize") {
    const workflow = text(values.workflow);
    if (workflow) errors.workflow = workflow;
  }

  if (values.reason === "seed") {
    const github = githubOf(values.github);
    if (!github) errors.github = "required";
    else if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(github)) errors.github = "invalid";
  }
  return errors;
}

/** A GitHub username as typed, with or without its @. */
export const githubOf = (value: string) => value.trim().replace(/^@/, "");

function text(value: string): FieldError | undefined {
  const held = value.trim();
  if (!held) return "required";
  if (held.length > MAX_TEXT) return "tooLong";
  return undefined;
}
