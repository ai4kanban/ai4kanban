"use client";

import { useState, type ReactNode } from "react";
import { framed, panelStatic } from "@/components/styles";
import type { ContactCopy } from "@/i18n/contact/types";
import { newOpId, submitContact } from "./api";
import {
  EMPTY,
  validate,
  type FieldError,
  type FieldErrors,
  type Problem,
  type Reason,
  type Values,
} from "./state";

// The one client island on the contact page (#785). Nothing short of a message
// that landed clears what was typed.

const SUPPORT_EMAIL = "support@ai4kanban.dev";

const field =
  "mt-2 w-full rounded-lg border-2 border-border bg-elev px-3 py-2 text-sm font-normal " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const submitClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-border bg-accent px-6 py-3 font-bold text-elev no-underline shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-accent-deep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_var(--color-ink)]";

export function ContactForm({ t }: { t: ContactCopy }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [opId, setOpId] = useState(newOpId);
  const [fields, setFields] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  // Any edit is a new message, so it gets a new id.
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

  const another = () => {
    setValues((v) => ({ ...v, message: "", workflow: "" }));
    setOpId(newOpId());
    setSentTo(undefined);
  };

  if (sentTo) {
    const [before, after] = t.sent.body.split("{email}");
    return (
      <div role="status" className="rounded-xl bg-band p-8">
        <h2 className="text-2xl font-bold tracking-tight">{t.sent.title}</h2>
        <p className="mt-2 text-muted">
          {before}
          <span className="font-semibold break-all text-ink">{sentTo}</span>
          {after}
        </p>
        <button
          type="button"
          onClick={another}
          className="mt-6 cursor-pointer text-sm font-semibold underline underline-offset-4"
        >
          {t.sent.another}
        </button>
      </div>
    );
  }

  const customize = values.reason === "customize";
  const error = (name: keyof FieldErrors, messages: Record<FieldError, string>) =>
    fields[name] && messages[fields[name]];
  const shown = problem && { limited: t.limited, unknown: t.unknown, failed: t.failed }[problem];

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold">{t.reason}</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <ReasonOption value="support" current={values.reason} onPick={(reason) => edit({ reason })}>
            <span className="block font-bold">{t.support.name}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">{t.support.body}</span>
          </ReasonOption>
          <ReasonOption value="customize" current={values.reason} onPick={(reason) => edit({ reason })}>
            <span className="block font-bold">{t.customize.name}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">{t.customize.body}</span>
            <span className="mt-3 block">
              <span className="text-2xl font-bold tracking-tight text-ink">{t.customize.price}</span>
              <span className="text-sm text-muted">{t.customize.per}</span>
            </span>
            <span className="mt-1 block text-xs text-muted">{t.customize.note}</span>
          </ReasonOption>
        </div>
      </fieldset>

      <Field
        label={t.email}
        className="mt-5"
        error={error("email", {
          required: t.errors.emailRequired,
          invalid: t.errors.emailInvalid,
          tooLong: t.errors.emailTooLong,
        })}
      >
        {(invalid) => (
          <input
            className={field}
            type="email"
            autoComplete="email"
            value={values.email}
            aria-invalid={invalid}
            onChange={(event) => edit({ email: event.target.value })}
          />
        )}
      </Field>

      <Field
        label={t.message}
        error={error("message", {
          required: t.errors.messageRequired,
          invalid: t.errors.messageRequired,
          tooLong: t.errors.messageTooLong,
        })}
      >
        {(invalid) => (
          <textarea
            className={field}
            rows={4}
            value={values.message}
            aria-invalid={invalid}
            onChange={(event) => edit({ message: event.target.value })}
          />
        )}
      </Field>

      {customize && (
        <Field
          label={t.workflow}
          hint={t.workflowHint}
          error={error("workflow", {
            required: t.errors.workflowRequired,
            invalid: t.errors.workflowRequired,
            tooLong: t.errors.workflowTooLong,
          })}
        >
          {(invalid) => (
            <textarea
              className={field}
              rows={4}
              value={values.workflow}
              aria-invalid={invalid}
              onChange={(event) => edit({ workflow: event.target.value })}
            />
          )}
        </Field>
      )}

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

function ReasonOption({
  value,
  current,
  onPick,
  children,
}: {
  value: Reason;
  current: Reason;
  onPick: (value: Reason) => void;
  children: ReactNode;
}) {
  const on = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-3 p-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        on ? `${panelStatic} ${framed}` : "rounded-xl border-2 border-transparent bg-band"
      }`}
    >
      <input
        type="radio"
        name="reason"
        value={value}
        checked={on}
        onChange={() => onPick(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-border bg-elev"
      >
        {on && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="block">{children}</span>
    </label>
  );
}

function Field({
  label,
  hint,
  error,
  className = "mt-4",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (invalid: true | undefined) => ReactNode;
}) {
  return (
    <label className={`${className} block text-sm font-semibold`}>
      {label}
      {children(error ? true : undefined)}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-normal text-caution">{error}</span>}
    </label>
  );
}

function WithSupport({ text }: { text: string }) {
  const [before, after] = text.split("{support}");
  if (after === undefined) return <>{text}</>;
  return (
    <>
      {before}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-ink underline underline-offset-4">
        {SUPPORT_EMAIL}
      </a>
      {after}
    </>
  );
}
