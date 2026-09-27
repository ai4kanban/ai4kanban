// The plan panel on /settings (#1037). No script of its own: buying is a GET form to
// /billing/checkout, and billing a POST form to /billing/portal.

import type { ReactNode } from "react";
import { FiAlertCircle } from "react-icons/fi";
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
    <label className="flex cursor-pointer flex-col gap-1 rounded-[11px] border-[1.5px] border-nb-ink/25 bg-nb-paper px-3 py-2.5 has-[:checked]:border-nb-accent-deep has-[:checked]:bg-nb-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-nb-accent">
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

function Portal({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <form action="/billing/portal" method="post" className="shrink-0">
      <Button type="submit" size="sm" variant={accent ? "accent" : "ghost"} className="whitespace-nowrap">
        {label}
      </Button>
    </form>
  );
}

function Title({ name, period, seed }: { name: string; period?: string; seed?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-[18px] font-[800] tracking-[-0.01em] text-nb-ink">{name}</span>
      {period && <span className={CHIP}>{period}</span>}
      {seed && <span className={SEED_TAG}>{seed}</span>}
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
  portalFailed,
  refreshHref,
}: {
  copy: HostedCopy;
  language: Language;
  state: PlanState;
  billing: Billing | null;
  checkoutFailed: boolean;
  portalFailed: boolean;
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

  let body: ReactNode;
  switch (grant && (state === "free" || state === "expired") ? "gifted" : state) {
    case "gifted":
      body = (
        <>
          <div className="flex flex-col gap-1">
            <Title name={copy.pro} seed={copy.seed} />
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
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <Title name={copy.pro} period={period} />
              {date && <Line>{(state === "active" ? copy.renews : copy.ends).replace("{date}", date)}</Line>}
              {alsoGifted}
            </div>
            <Portal label={copy.manage} />
          </div>
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
      {body}
    </section>
  );
}
