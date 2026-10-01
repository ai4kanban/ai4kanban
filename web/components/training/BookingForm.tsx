"use client";

import { Field, field, submitClass } from "@/components/contact/ContactForm";
import { Button } from "@/components/ui/Button";
import type { TrainingCopy } from "@/i18n/training/types";
import type { FieldErrors, FormValues, Problem, ServiceId } from "./state";
import type { PlacedSlot } from "./week";
import { slotLabel } from "./week";

// The details, once an hour has been chosen (#683).
//
// One final button, and it is the same one whatever went wrong last time: the
// service answers a repeat of a submission with the booking it already made, so
// "try again" is the same press as "confirm" and is labelled for what the reader
// is doing rather than for our retry mechanism. The one case with a different
// button is a conflict — that hour is somebody else's now, and the only move
// left is back to the week.
//
// Nothing here is ever cleared by a failure. What was typed is the component's
// caller's state (`state.ts`), and every transition into this screen keeps it.

export function BookingForm({
  t,
  locale,
  zone,
  slot,
  form,
  problem,
  fields,
  submitting,
  onEdit,
  onSubmit,
  onBack,
}: {
  t: TrainingCopy;
  locale: string;
  zone: string;
  slot: PlacedSlot;
  form: FormValues;
  problem?: Problem;
  fields?: FieldErrors;
  submitting: boolean;
  onEdit: (patch: Partial<FormValues>) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const conflict = problem?.kind === "conflict";
  const price = (service: ServiceId) => (service === "single" ? "$99" : "$349");

  return (
    <section className="mx-auto mt-4 max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-ink"
      >
        {t.form.back}
      </button>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">{t.form.title}</h2>

      {/* The hour, restated in the reader's own words. The coach's clock is
          nowhere on this page. */}
      <div className="mt-5 rounded-xl bg-elev px-5 py-4">
        <p className="font-semibold">{slotLabel(slot.startsAt, zone, locale)}</p>
        <p className="mt-1 text-sm text-muted">{t.booking.zoneNote.replace("{zone}", zone)}</p>
      </div>

      {problem && (
        <div role="alert" className="mt-4 rounded-lg bg-code p-4 text-sm">
          <p className="font-semibold">
            {conflict
              ? t.form.conflictTitle
              : problem.kind === "unknown"
                ? t.form.unknownTitle
                : t.form.refusedTitle}
          </p>
          <p className="mt-1 text-muted">
            {conflict
              ? t.form.conflictBody
              : problem.kind === "unknown"
                ? t.form.unknownBody
                : problem.message}
          </p>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!conflict) onSubmit();
        }}
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={t.form.name} className="" error={fields?.name && t.form.nameRequired}>
            {(invalid) => (
              <input
                className={`${field} block h-11`}
                type="text"
                autoComplete="name"
                value={form.name}
                aria-invalid={invalid}
                onChange={(event) => onEdit({ name: event.target.value })}
              />
            )}
          </Field>
          <Field
            label={t.form.email}
            className=""
            error={
              fields?.email === "required"
                ? t.form.emailRequired
                : fields?.email === "invalid"
                  ? t.form.emailInvalid
                  : undefined
            }
          >
            {(invalid) => (
              <input
                className={`${field} block h-11`}
                type="email"
                autoComplete="email"
                value={form.email}
                aria-invalid={invalid}
                onChange={(event) => onEdit({ email: event.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label={t.form.service}>
          {() => (
            <select
              className={`${field} block h-11`}
              value={form.service}
              onChange={(event) => onEdit({ service: event.target.value as ServiceId })}
            >
              <option value="single">
                {t.form.serviceSingle.replace("{price}", price("single"))}
              </option>
              <option value="monthly">
                {t.form.serviceMonthly.replace("{price}", price("monthly"))}
              </option>
            </select>
          )}
        </Field>

        <Field label={t.form.project} hint={t.form.projectHint}>
          {() => (
            <textarea
              className={`${field} block resize-y leading-relaxed`}
              rows={3}
              value={form.project}
              onChange={(event) => onEdit({ project: event.target.value })}
            />
          )}
        </Field>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          {conflict ? (
            <Button variant="primary" onClick={onBack}>
              {t.form.conflictCta}
            </Button>
          ) : (
            // A native submit so Enter in a field works. Disabled while a submit
            // is in flight, which is what stops a second hold being attempted.
            <button type="submit" disabled={submitting} className={submitClass}>
              {submitting ? t.form.submitting : t.form.submit}
            </button>
          )}
          <a href="/terms#training" className="text-xs text-muted underline underline-offset-4">
            {t.form.terms}
          </a>
          <a href="/privacy" className="text-xs text-muted underline underline-offset-4">
            {t.form.privacy}
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">{t.form.seller}</p>
      </form>
    </section>
  );
}
