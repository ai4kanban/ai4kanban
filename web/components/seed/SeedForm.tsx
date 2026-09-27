"use client";

import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { Field, WithSupport, submitClass } from "@/components/contact/ContactForm";
import { newOpId, submitContact } from "@/components/contact/api";
import {
  EMPTY,
  validate,
  type FieldError,
  type FieldErrors,
  type Problem,
  type Values,
} from "@/components/contact/state";
import type { SeedCopy } from "@/i18n/seed/types";

// The seed partner application (#1039): the contact form's `seed` reason, with
// its submit, retry and refusals. The message is how they plan to use it.

const box =
  "mt-2 w-full rounded-lg border border-muted/70 bg-band/30 px-3 py-[9px] text-sm font-normal " +
  "aria-[invalid=true]:border-caution";
const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const START: Values = { ...EMPTY, reason: "seed" };

export function SeedForm({ t }: { t: SeedCopy }) {
  const [values, setValues] = useState<Values>(START);
  const [opId, setOpId] = useState(newOpId);
  const [fields, setFields] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  const edit = (patch: Partial<Values>) => {
    setValues((v) => ({ ...v, ...patch }));
    setOpId(newOpId());
    setFields((f) => {
      const next = { ...f };
      for (const key of Object.keys(patch)) delete next[key as keyof FieldErrors];
      return next;
    });
    setProblem(undefined);
  };

  const submit = async () => {
    if (submitting) return;
    const errors = validate(values);
    setFields(errors);
    setProblem(undefined);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    const result = await submitContact(opId, values);
    setSubmitting(false);
    if (result.ok) setSentTo(values.email.trim());
    else setProblem(result.problem);
  };

  if (sentTo) {
    const [before, after] = t.sent.body.split("{email}");
    return (
      <div role="status" className="rounded-xl bg-band p-8 lg:rounded-none lg:bg-transparent lg:p-0">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-elev text-growth lg:bg-band">
          <FiCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-bold tracking-tight">{t.sent.title}</h2>
        <p className="mt-2 text-muted">
          {before}
          <span className="font-semibold break-all text-ink">{sentTo}</span>
          {after}
        </p>
      </div>
    );
  }

  const e = t.errors;
  const error = (name: keyof FieldErrors, messages: Record<FieldError, string>) =>
    fields[name] && messages[fields[name]];
  const githubError = error("github", {
    required: e.githubRequired,
    invalid: e.githubInvalid,
    tooLong: e.githubInvalid,
  });
  const shown = problem && { limited: t.limited, unknown: t.unknown, failed: t.failed }[problem];

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        label={t.email}
        className=""
        error={error("email", { required: e.emailRequired, invalid: e.emailInvalid, tooLong: e.emailTooLong })}
      >
        {(invalid) => (
          <input
            className={`${box} ${ring}`}
            type="email"
            autoComplete="email"
            value={values.email}
            aria-invalid={invalid}
            onChange={(event) => edit({ email: event.target.value })}
          />
        )}
      </Field>

      <Field label={t.github} hint={t.githubHint} error={githubError}>
        {(invalid) => (
          <span
            className={`${box} flex items-center gap-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
              invalid ? "border-caution" : ""
            }`}
          >
            <span className="text-muted">@</span>
            <input
              className="w-full bg-transparent outline-none"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={values.github}
              aria-invalid={invalid}
              onChange={(event) => edit({ github: event.target.value })}
            />
          </span>
        )}
      </Field>

      <Field
        label={t.use}
        hint={t.useHint}
        error={error("message", { required: e.useRequired, invalid: e.useRequired, tooLong: e.useTooLong })}
      >
        {(invalid) => (
          <textarea
            className={`${box} ${ring} block h-[104px] resize-y lg:h-[180px]`}
            value={values.message}
            aria-invalid={invalid}
            onChange={(event) => edit({ message: event.target.value })}
          />
        )}
      </Field>

      {shown && (
        <div role="alert" className="mt-5 rounded-lg bg-code p-4 text-sm">
          <p className="font-semibold">{shown.title}</p>
          <p className="mt-1 text-muted">
            <WithSupport text={shown.body} />
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? t.submitting : t.submit}
        </button>
        <a href="/privacy#sending-us-a-message" className="text-xs text-muted underline underline-offset-4">
          {t.privacy}
        </a>
      </div>
    </form>
  );
}
