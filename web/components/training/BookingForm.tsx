"use client";

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

const field =
  "mt-2 w-full rounded-lg border-2 border-border bg-elev px-3 py-2 text-sm " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
          <Field
            label={t.form.name}
            error={fields?.name && t.form.nameRequired}
            value={form.name}
            onChange={(name) => onEdit({ name })}
            autoComplete="name"
          />
          <Field
            label={t.form.email}
            error={
              fields?.email === "required"
                ? t.form.emailRequired
                : fields?.email === "invalid"
                  ? t.form.emailInvalid
                  : undefined
            }
            value={form.email}
            onChange={(email) => onEdit({ email })}
            type="email"
            autoComplete="email"
          />
        </div>

        <label className="mt-4 block text-sm font-semibold">
          {t.form.service}
          <select
            className={field}
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
        </label>

        <label className="mt-4 block text-sm font-semibold">
          {t.form.project}
          <textarea
            className={field}
            rows={3}
            value={form.project}
            onChange={(event) => onEdit({ project: event.target.value })}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t.form.projectHint}</span>
        </label>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          {conflict ? (
            <Button variant="primary" onClick={onBack}>
              {t.form.conflictCta}
            </Button>
          ) : (
            // A native submit so Enter in a field works. Disabled while a submit
            // is in flight, which is what stops a second hold being attempted.
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-border bg-accent px-6 py-3 font-bold text-elev no-underline shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-accent-deep hover:shadow-[6px_6px_0_0_var(--color-ink)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)] disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              {submitting ? t.form.submitting : t.form.submit}
            </button>
          )}
          <a href="/privacy" className="text-xs text-muted underline underline-offset-4">
            {t.form.privacy}
          </a>
        </div>
      </form>
    </section>
  );
}

/** A labelled input with its complaint beside it rather than in a summary at the
 *  top — a reader fixing one field should not have to look away from it. */
function Field({
  label,
  error,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        className={field}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span className="mt-1 block text-xs font-normal text-caution">{error}</span>
      )}
    </label>
  );
}
