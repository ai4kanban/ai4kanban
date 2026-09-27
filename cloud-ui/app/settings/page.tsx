import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Avatar, Page as Frame } from "../../components/Frame";
import { PlanPanel, type PlanState } from "../../components/PlanPanel";
import {
  accountAddress,
  accountName,
  confirmCheckout,
  readAccount,
  readBilling,
  subscribed,
} from "../../lib/cloud";
import { getHostedCopy } from "../../lib/copy";
import { languageFor } from "../../lib/reader";
import { SESSION_COOKIE, decodeSession } from "../../lib/session";

// Settings, on the hosted pages, is the account (#575) and its plan (#1037): who this browser is
// signed in as, their Pro subscription, and where everything else lives. A board's own settings
// and a machine's are the app's.
export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const language = languageFor((await headers()).get("accept-language"));
  const copy = getHostedCopy(language);
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const returned = one("checkout") === "done";
  const here = `/settings${returned ? `?${new URLSearchParams({ checkout: "done", subscription_id: one("subscription_id") })}` : ""}`;

  // Signed out is a sign-in that comes back here, the same as a board page — a bookmark
  // opened on a new device lands on the page that was asked for.
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect(`/signin?next=${encodeURIComponent(here)}`);

  // Back from Creem: Cloud confirms the subscription before this page reads the plan.
  const [account, billing] = await Promise.all([
    readAccount(session.accessToken),
    returned && one("subscription_id")
      ? confirmCheckout(session.accessToken, one("subscription_id"))
      : readBilling(session.accessToken),
  ]);
  if (returned && billing && subscribed(billing)) redirect("/settings");
  const state: PlanState = !billing ? "failed" : returned ? "confirming" : billing.state;
  const name = account ? accountName(account) : "";
  const address = account ? accountAddress(account) : null;

  return (
    <Frame copy={copy} account={account}>
      <h1 className="text-[13px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
        {copy.settings}
      </h1>
      <div className="nb-panel-sm flex items-center gap-3 p-3">
        <Avatar account={account} className="size-[38px] rounded-[10px] text-[14px]" />
        <div className="flex min-w-0 flex-col">
          {/* An account that could not be read says so, rather than drawing a panel with
              nobody in it — this is the page a reader opened to see which account it is. */}
          {name || address ? (
            <>
              {name && <span className="truncate text-[15px] font-[700] text-nb-ink">{name}</span>}
              {address && (
                <span className="truncate text-[13px] font-[600] text-nb-ink-soft">{address}</span>
              )}
            </>
          ) : (
            <span className="text-[13px] font-[600] text-nb-ink-soft">
              {copy.accountUnavailable}
            </span>
          )}
        </div>
      </div>
      <PlanPanel
        copy={copy}
        language={language}
        state={state}
        billing={billing}
        checkoutFailed={one("checkout") === "failed"}
        portalFailed={one("portal") === "failed"}
        refreshHref={here}
      />
      <p className="text-[13px] leading-relaxed text-nb-ink-soft">{copy.settingsInApp}</p>
    </Frame>
  );
}
