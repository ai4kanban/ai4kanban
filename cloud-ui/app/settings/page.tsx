import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Avatar, Page as Frame } from "../../components/Frame";
import { accountAddress, accountName, readAccount } from "../../lib/cloud";
import { getHostedCopy } from "../../lib/copy";
import { languageFor } from "../../lib/reader";
import { SESSION_COOKIE, decodeSession } from "../../lib/session";

// Settings, on the hosted pages, is the account and nothing else (#575): who this browser is
// signed in as, and where everything else lives. A board's own settings and a machine's are
// the app's, and nothing here is writable.
export const dynamic = "force-dynamic";

export default async function Page() {
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));

  // Signed out is a sign-in that comes back here, the same as a board page — a bookmark
  // opened on a new device lands on the page that was asked for.
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/signin?next=%2Fsettings");

  const account = await readAccount(session.accessToken);
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
      <p className="text-[13px] leading-relaxed text-nb-ink-soft">{copy.settingsInApp}</p>
    </Frame>
  );
}
