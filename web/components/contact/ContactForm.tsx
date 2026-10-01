"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FiCheck } from "react-icons/fi";
import { hairline } from "@/components/styles";
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
// that landed clears what was typed. It fills two cells of the page's grid: the
// reasons in the left column and the form panel on the right.

const SUPPORT_EMAIL = "support@ai4kanban.dev";

// Every text box on this form and the seed form. No display class: each box adds its own.
const fieldBox = `mt-2 w-full rounded-lg border ${hairline} bg-elev px-3.5 py-2.5 text-[0.95rem] font-normal transition-shadow`;
export const field =
  `${fieldBox} outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 ` +
  "aria-[invalid=true]:not-focus:border-caution";
// A box wrapping its input with a prefix: it lights up as one piece.
export const fieldGroup =
  `${fieldBox} focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 ` +
  "has-[[aria-invalid=true]]:not-focus-within:border-caution";

// The right column; the receipt takes the same place and keeps a floor height so the page doesn't jump.
const panel = "rounded-2xl bg-band p-7 sm:p-9 lg:col-start-2 lg:row-span-3 lg:row-start-1";

export const submitClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-border bg-accent px-6 py-3 font-bold text-elev no-underline shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-accent-deep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_var(--color-ink)]";

export function ContactForm({ t }: { t: ContactCopy }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [opId, setOpId] = useState(newOpId);
  const [fields, setFields] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  // The pricing page links here with `?reason=customize`. Read after mount so the static page hydrates cleanly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reason") === "customize")
      setValues((v) => ({ ...v, reason: "customize" }));
  }, []);

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
      <div role="status" className={`${panel} flex min-h-[24rem] flex-col items-center justify-center text-center`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-elev">
          <FiCheck className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">{t.sent.title}</h2>
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
    <>
      <fieldset className="lg:col-start-1 lg:row-start-2 lg:mt-10">
        <legend className="text-sm font-semibold">{t.reason}</legend>
        <div className="mt-3 grid gap-3">
          <ReasonOption
            value="support"
            current={values.reason}
            onPick={(reason) => edit({ reason })}
            name={t.support.name}
          >
            {t.support.body}
          </ReasonOption>
          <ReasonOption
            value="customize"
            current={values.reason}
            onPick={(reason) => edit({ reason })}
            name={t.customize.name}
            tag={
              <span className="whitespace-nowrap text-sm text-muted">
                <span className="font-bold text-ink">{t.customize.price}</span>
                {t.customize.per}
              </span>
            }
          >
            {t.customize.body}
            {customize && <span className="mt-2 block text-xs">{t.customize.note}</span>}
          </ReasonOption>
        </div>
      </fieldset>

      <form
        noValidate
        className={panel}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label={t.email}
          className=""
          error={error("email", {
            required: t.errors.emailRequired,
            invalid: t.errors.emailInvalid,
            tooLong: t.errors.emailTooLong,
          })}
        >
          {(invalid) => (
            <input
              className={`${field} block h-11`}
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
          className="mt-5"
          error={error("message", {
            required: t.errors.messageRequired,
            invalid: t.errors.messageRequired,
            tooLong: t.errors.messageTooLong,
          })}
        >
          {(invalid) => (
            <textarea
              className={`${field} block resize-y leading-relaxed`}
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
            className="mt-5"
            error={error("workflow", {
              required: t.errors.workflowRequired,
              invalid: t.errors.workflowRequired,
              tooLong: t.errors.workflowTooLong,
            })}
          >
            {(invalid) => (
              <>
                <span className="mt-0.5 block text-xs font-normal text-muted">{t.workflowHint}</span>
                <textarea
                  className={`${field} block resize-y leading-relaxed`}
                  rows={4}
                  value={values.workflow}
                  aria-invalid={invalid}
                  onChange={(event) => edit({ workflow: event.target.value })}
                />
              </>
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

        <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
          <a href="/privacy#sending-us-a-message" className="text-xs text-muted underline underline-offset-4">
            {t.privacy}
          </a>
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </>
  );
}

// Picked: ink outline and hard shadow. Not picked: a hairline row.
function ReasonOption({
  value,
  current,
  onPick,
  name,
  tag,
  children,
}: {
  value: Reason;
  current: Reason;
  onPick: (value: Reason) => void;
  name: string;
  tag?: ReactNode;
  children: ReactNode;
}) {
  const on = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-3.5 rounded-xl border-2 bg-elev px-5 py-4 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        on ? "border-border shadow-[4px_4px_0_0_var(--color-ink)]" : hairline
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
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          on ? "border-accent" : "border-[color-mix(in_srgb,var(--color-ink)_30%,transparent)]"
        }`}
      >
        {on && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="block min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-bold">{name}</span>
          {tag}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{children}</span>
      </span>
    </label>
  );
}

export function Field({
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

export function WithSupport({ text }: { text: string }) {
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
