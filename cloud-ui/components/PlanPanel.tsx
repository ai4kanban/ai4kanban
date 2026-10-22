// The plan panel on /settings (#1037). No script of its own: buying is a GET form to
// /billing/checkout, the trial a POST form to /billing/trial, billing one to /billing/portal,
// resuming one to /billing/resume.

import type { ReactNode } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";
import { Button } from "@/components/button";
import type { Language } from "@/lib/format/machine/types";
import type { Billing } from "../lib/cloud";
import type { HostedCopy } from "../lib/copy";

export type PlanState = Billing["state"] | "confirming" | "failed";

const CAPTION = "text-[11px] font-[700] uppercase leading-[14px] tracking-[0.1em]";
const CHIP =
  "rounded-[6px] bg-nb-ink/7 px-1.5 py-[3px] text-[10.5px] font-[700] uppercase leading-none tracking-[0.08em] text-nb-ink-soft";
const SEED_TAG = "rounded-[6px] bg-nb-mint-soft px-1.5 py-[3px] text-[11px] font-[700] leading-none text-nb-mint-ink";
const QUIET =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-nb-wash px-2.5 py-1.5 text-[12px] font-[700] text-nb-ink";

const PRICES = { monthly: "$15", yearly: "$120" } as const;

/** A date the way the reader's language writes it, in UTC so it matches Creem's. */
export const planDate = (iso: string | null, language: Language): string =>
  iso
    ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: language === "zh" ? "long" : "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(iso))
    : "";

function Choice({ copy, period }: { copy: HostedCopy; period: "monthly" | "yearly" }) {
  const yearly = period === "yearly";
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-[11px] border-[1.5px] border-nb-ink/25 bg-nb-paper px-3 py-2.5 has-[:checked]:border-nb-accent-deep has-[:checked]:bg-nb-accent-wash has-[:focus-visible]:outline-[1.5px] has-[:focus-visible]:-outline-offset-[1.5px] has-[:focus-visible]:outline-nb-ink">
      <input type="radio" name="period" value={period} defaultChecked={yearly} className="sr-only" />
      <span className="flex items-center justify-between gap-2 text-[12px] font-[700] text-nb-ink-soft">
        {yearly ? copy.yearly : copy.monthly}
        {yearly && <span className="text-nb-accent-deep">{copy.save}</span>}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[18px] font-[800] tracking-[-0.01em] text-nb-ink">{PRICES[period]}</span>
        <span className="text-[12px] font-[600] text-nb-ink-soft">{yearly ? copy.perYear : copy.perMonth}</span>
      </span>
    </label>
  );
}

function Buy({ copy, failed }: { copy: HostedCopy; failed: boolean }) {
  return (
    <form action="/billing/checkout" method="get" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Choice copy={copy} period="monthly" />
        <Choice copy={copy} period="yearly" />
      </div>
      {failed && (
        <p className="text-[12.5px] font-[700] text-nb-peach-ink" role="alert">
          {copy.checkoutFailed}
        </p>
      )}
      <Button type="submit" className="w-full">
        {copy.getPro}
      </Button>
    </form>
  );
}

function Trial({ copy, failed }: { copy: HostedCopy; failed: boolean }) {
  return (
    <form action="/billing/trial" method="post" className="flex flex-col gap-3">
      {failed && (
        <p className="text-[12.5px] font-[700] text-nb-peach-ink" role="alert">
          {copy.trialFailed}
        </p>
      )}
      <Button type="submit" className="w-full">
        {copy.startTrial}
      </Button>
    </form>
  );
}

function Portal({ label, accent, action = "/billing/portal" }: { label: string; accent?: boolean; action?: string }) {
  return (
    <form action={action} method="post" className="shrink-0">
      <Button type="submit" size="sm" variant={accent ? "accent" : "ghost"} className="whitespace-nowrap">
        {label}
      </Button>
    </form>
  );
}

function Title({ name, period, tag }: { name: string; period?: string; tag?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-[18px] font-[800] tracking-[-0.01em] text-nb-ink">{name}</span>
      {period && <span className={CHIP}>{period}</span>}
      {tag && <span className={SEED_TAG}>{tag}</span>}
    </span>
  );
}

const Line = ({ children }: { children: ReactNode }) => (
  <p className="text-[13px] font-[600] text-nb-ink-soft">{children}</p>
);

export function PlanPanel({
  copy,
  language,
  state,
  billing,
  checkoutFailed,
  trialFailed,
  portalFailed,
  resumeFailed,
  alreadySubscribed,
  refreshHref,
}: {
  copy: HostedCopy;
  language: Language;
  state: PlanState;
  billing: Billing | null;
  checkoutFailed: boolean;
  trialFailed: boolean;
  portalFailed: boolean;
  resumeFailed: boolean;
  /** Back from Get Pro while already subscribed (#1682). */
  alreadySubscribed: boolean;
  refreshHref: string;
}) {
  const period = billing?.period ? (billing.period === "yearly" ? copy.yearly : copy.monthly) : undefined;
  const date = planDate(billing?.periodEnd ?? null, language);
  const grant = planDate(billing?.grantEnd ?? null, language);
  // Beside a subscription, the grant is one more line; alone, it is the plan.
  const alsoGifted = grant && (
    <p className="flex items-center gap-1.5 text-[13px] font-[600] text-nb-mint-ink">
      <span className="size-1.5 shrink-0 rounded-full bg-nb-mint" aria-hidden />
      {copy.giftedToo.replace("{date}", grant)}
    </p>
  );
  const portalError = portalFailed && (
    <p className="text-[12.5px] font-[700] text-nb-peach-ink" role="alert">
      {copy.portalFailed}
    </p>
  );
  const resumable = state === "canceled" && !!billing?.resumable;
  const unpaid = state === "free" || state === "expired";
  const trialEnd = unpaid && !grant ? (billing?.trialEnd ?? null) : null;
  const days = trialEnd ? daysLeft(trialEnd) : 0;
  const shown = trialEnd ? "trialing" : unpaid && billing?.mayTrial ? "untried" : grant && unpaid ? "gifted" : state;

  // Back from Get Pro or the pricing page's trial button (#1937), say why nothing started.
  const subscribed = state === "active" || state === "canceled" || state === "pastDue";
  const notice =
    subscribed && (alreadySubscribed || trialFailed) ? (
      <p
        className="flex items-center gap-2 rounded-[10px] bg-nb-mint-soft px-3 py-2 text-[12.5px] font-[700] text-nb-mint-ink"
        role="status"
      >
        <FiCheckCircle className="shrink-0" size={14} aria-hidden />
        {resumable ? copy.stillActive : copy.alreadyPro}
      </p>
    ) : (
      trialFailed &&
      (shown === "free" || shown === "expired") && (
        <p
          className="flex items-center gap-2 rounded-[10px] bg-nb-wash px-3 py-2 text-[12.5px] font-[700] text-nb-ink"
          role="status"
        >
          <FiInfo className="shrink-0" size={14} aria-hidden />
          {copy.trialUsed}
        </p>
      )
    );

  let body: ReactNode;
  switch (shown) {
    case "untried":
      body = (
        <>
          <Title name={copy.free} />
          <Trial copy={copy} failed={trialFailed} />
        </>
      );
      break;
    case "trialing":
      body = (
        <div className="flex flex-col gap-1">
          <Title name={copy.pro} tag={copy.trial} />
          <Line>
            <span className="font-[700] text-nb-ink">
              {days === 1 ? copy.trialLeftOne : copy.trialLeft.replace("{days}", String(days))}
            </span>
            {" · "}
            {copy.trialEnds.replace("{date}", planDate(trialEnd, language))}
          </Line>
        </div>
      );
      break;
    case "gifted":
      body = (
        <>
          <div className="flex flex-col gap-1">
            <Title name={copy.pro} tag={copy.seed} />
            <Line>{copy.gifted.replace("{date}", grant)}</Line>
          </div>
          <Buy copy={copy} failed={checkoutFailed} />
        </>
      );
      break;
    case "free":
      body = (
        <>
          <Title name={copy.free} />
          <Buy copy={copy} failed={checkoutFailed} />
        </>
      );
      break;
    case "expired":
      body = (
        <>
          <div className="flex flex-col gap-1">
            <Title name={copy.free} />
            {date && <Line>{copy.ended.replace("{date}", date)}</Line>}
          </div>
          <Buy copy={copy} failed={checkoutFailed} />
        </>
      );
      break;
    case "active":
    case "canceled":
      body = (
        <>
          <div
            className={`flex flex-col items-start gap-3 ${resumable ? "" : "sm:flex-row sm:items-center sm:justify-between"}`}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <Title name={copy.pro} period={period} />
              {date && <Line>{(state === "active" ? copy.renews : copy.ends).replace("{date}", date)}</Line>}
              {alsoGifted}
            </div>
            {resumable ? (
              <div className="flex shrink-0 items-center gap-2">
                <Portal label={copy.resume} accent action="/billing/resume" />
                <Portal label={copy.manage} />
              </div>
            ) : (
              <Portal label={copy.manage} />
            )}
          </div>
          {resumable && resumeFailed && (
            <p className="text-[12.5px] font-[700] text-nb-peach-ink" role="alert">
              {copy.resumeFailed}
            </p>
          )}
          {portalError}
        </>
      );
      break;
    case "pastDue":
      body = (
        <>
          <div className="flex flex-col gap-1">
            <Title name={copy.pro} period={period} />
            {alsoGifted}
          </div>
          <div
            className="flex flex-col gap-3 rounded-[10px] bg-nb-peach-soft px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <FiAlertCircle className="mt-[2px] shrink-0 text-nb-peach-ink" size={14} aria-hidden />
              <div className="min-w-0">
                <p className="text-[12.5px] font-[800] text-nb-peach-ink">{copy.paymentFailed}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-nb-ink">{copy.updatePaymentBody}</p>
              </div>
            </div>
            <div className="ml-6 self-start sm:ml-0 sm:self-auto">
              <Portal label={copy.updatePayment} accent />
            </div>
          </div>
          {portalError}
        </>
      );
      break;
    case "confirming":
      body = (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-[600] text-nb-ink" aria-live="polite">
            <span className="size-1.5 shrink-0 rounded-full bg-nb-accent-deep" aria-hidden />
            {copy.confirming}
          </p>
          <a href={refreshHref} className={QUIET}>
            {copy.refresh}
          </a>
        </div>
      );
      break;
    case "failed":
      body = <Line>{copy.planUnavailable}</Line>;
      break;
  }

  return (
    <section className="nb-panel-sm flex flex-col gap-3 p-4">
      <h2 className={`${CAPTION} text-nb-ink-soft`}>{copy.plan}</h2>
      {notice}
      {body}
    </section>
  );
}

function daysLeft(end: string): number {
  return Math.max(1, Math.ceil((Date.parse(end) - Date.now()) / 86_400_000));
}
