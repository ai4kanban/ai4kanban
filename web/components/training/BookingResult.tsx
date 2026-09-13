"use client";

import type { TrainingCopy } from "@/i18n/training/types";
import { calendarFile, downloadCalendar } from "./ics";
import type { Booking, Manage } from "./state";
import { slotLabel } from "./week";

// What a booking looks like once it exists, and how it is given back (#683).
//
// The whole page is written in the zone the booking was made from, which is the
// zone stored with it — a reader opening the manage link from a phone in another
// country still sees the time they booked.
//
// It says the details are on their way, never that they arrived: mail is queued
// and retried on the service (`cloud/src/training-mail.ts`), and the page has no
// way to know and no business claiming.

export function BookingResult({
  t,
  locale,
  booking,
  manage,
  cancelling,
  onCancel,
  onBackToWeek,
}: {
  t: TrainingCopy;
  locale: string;
  booking: Booking;
  /** Absent when the booking was restored from a link that has since been used,
   *  and on a cancelled one — there is nothing left to manage. */
  manage?: Manage;
  cancelling: boolean;
  onCancel: () => void;
  onBackToWeek: () => void;
}) {
  const cancelled = booking.state === "cancelled";
  const zone = booking.timezone;
  const startsAt = new Date(booking.slot_at);
  const service =
    booking.service === "single" ? t.form.serviceSingle : t.form.serviceMonthly;
  const price = `$${Math.round(booking.price_cents / 100)}`;

  return (
    <section className="mx-auto mt-12 max-w-xl">
      <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
        {t.result.eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-bold tracking-tight">
        {cancelled ? t.result.cancelledTitle : t.result.title}
      </h2>
      <p className="mt-4 text-muted">{cancelled ? t.result.cancelledLead : t.result.lead}</p>

      <dl className="mt-7 space-y-5 rounded-xl bg-band p-6 text-sm">
        <Row label={t.result.service}>{service.replace("{price}", price)}</Row>
        <Row label={t.result.when}>
          {slotLabel(startsAt, zone, locale)}
          <span className="mt-1 block font-normal text-muted">
            {t.booking.zoneNote.replace("{zone}", zone)}
          </span>
        </Row>
        <Row label={t.result.reference}>
          <span className="font-mono">{booking.reference}</span>
        </Row>
      </dl>

      {cancelled ? (
        <button
          type="button"
          onClick={onBackToWeek}
          className="mt-6 cursor-pointer text-sm underline underline-offset-4"
        >
          {t.result.backToWeek}
        </button>
      ) : (
        <>
          <p className="mt-6 text-sm leading-relaxed text-muted">
            {t.result.next.replace("{email}", booking.email)}
          </p>

          <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4 text-sm">
            <button
              type="button"
              onClick={() =>
                downloadCalendar(
                  booking.reference,
                  calendarFile({
                    reference: booking.reference,
                    startsAt,
                    summary: t.meta.socialTitle ?? t.meta.title,
                    description: `${t.result.reference}: ${booking.reference}`,
                  }),
                )
              }
              className="cursor-pointer font-semibold underline underline-offset-4"
            >
              {t.result.calendar}
            </button>

            {/* Cancelling is two presses on purpose: the disclosure says what it
                costs, and the button inside it is the one that does it. */}
            {manage && (
              <details className="text-muted">
                <summary className="cursor-pointer underline underline-offset-4">
                  {t.result.cancel}
                </summary>
                <p className="mt-4">{t.result.cancelWarning}</p>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={onCancel}
                  className="mt-3 cursor-pointer font-semibold text-ink underline underline-offset-4 disabled:cursor-wait disabled:opacity-60"
                >
                  {cancelling ? t.result.cancelling : t.result.cancelConfirm}
                </button>
              </details>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}
