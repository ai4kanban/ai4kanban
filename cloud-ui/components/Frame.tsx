"use client";

// The frame these pages are drawn in (#322, #364).
//
// It is the app's window with everything that ACTS taken out. Around the board: the board's
// name and the release picker. Around a card: the board's name, the way back, and the way
// into the app for a machine that holds a copy of this workspace. Nothing else — no rail, no
// chat, no Create task — and the board page stays a read.
//
// The card page is the one that writes, and only the two decisions the card is waiting on:
// the buttons for those are the board's own (`kanban-ui/components/CardPage.tsx`), so nothing
// here draws one.
//
// The controls are the board's own (`kanban-ui/components/`), at the weight the app's own
// top row is drawn at, so a member recognises the screen they left the app on.

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { FiArrowLeft, FiUser } from "react-icons/fi";
import { LogoMark } from "@/components/Logo";
import { CHROME } from "@/components/chrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCopy } from "@/i18n/use-copy";
import type { ReleasePick } from "@/lib/release-pick";
import { accountAddress, accountName, type HostedAccount } from "../lib/cloud";
import type { HostedCopy } from "../lib/copy";

// The frame's own words. A context rather than a prop, so the shells that use it can be
// declared once at module scope — a shell built during a render is a new component type
// every render, and React would tear the whole board down and build it again.
const CopyContext = createContext<HostedCopy | null>(null);

export const CopyProvider = CopyContext.Provider;

/** The frame's words. Always there: every page under this frame provides them. */
export const useHostedCopy = (): HostedCopy => useContext(CopyContext)!;

/** Who the top row names (#575). Null wherever the account could not be read, and on the
 *  pages drawn for nobody — a refusal and a signed-out landing. */
const AccountContext = createContext<HostedAccount | null>(null);

export const AccountProvider = AccountContext.Provider;

/** Radix refuses an empty value, so No release carries one no version id can be — a release
 *  line is cut at an em dash, so an id can never hold one. */
const NONE = "—none—";

/**
 * The top row. The same 43px the app's own row is (`kanban-ui/components/Header.tsx`), so a
 * board opened here and a board opened in the app sit at the same height.
 *
 * `workspaceName` is left out where there is no board to name — a refusal must say nothing
 * about one. Sign out is on every one of them, because on a refusal it is the way out: sign
 * in again as the account the board belongs to. On the page a sign-out lands on it is the
 * way back IN instead, since there is no session left to end.
 */
export function TopRow({
  workspaceName,
  back,
  signedOut,
  readOnly = true,
  children,
}: {
  workspaceName?: string;
  /** Where the row leads. The board itself on a card page; nothing on the board. */
  back?: string;
  /** This is the page a sign-out landed on. */
  signedOut?: boolean;
  /** Whether this page really is a read. False on a card the board is raising a decision for
   *  (#364), where the mark would be saying the opposite of the two buttons under it. */
  readOnly?: boolean;
  children?: ReactNode;
}) {
  const copy = useHostedCopy();
  return (
    <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[7px] max-md:pb-1 max-md:pt-[3px]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href="/"
          aria-label={copy.title}
          className="flex shrink-0 items-center justify-center max-md:-ml-1 max-md:size-9"
        >
          <LogoMark />
        </Link>
        {back && (
          <Link
            href={back}
            className="flex shrink-0 items-center gap-1.5 text-[12px] font-[700] text-nb-ink-soft hover:text-nb-ink"
          >
            <FiArrowLeft size={13} aria-hidden />
            {copy.backToBoard}
          </Link>
        )}
        {workspaceName !== undefined && (
          <span className="min-w-0 truncate text-[12px] font-[700] text-nb-ink">{workspaceName}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {workspaceName !== undefined && readOnly && <ReadOnlyMark />}
        {signedOut ? <SignIn /> : <AccountMenu />}
      </div>
    </header>
  );
}

/** Says what these pages are, once, quietly: a board with no controls on it reads as a board
 *  whose controls failed to load unless something says otherwise. */
function ReadOnlyMark() {
  const copy = useHostedCopy();
  return (
    <span className="hidden rounded-[8px] bg-nb-wash px-2 py-1 text-[10px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft sm:inline">
      {copy.readOnly}
    </span>
  );
}

const WAY_OUT =
  "flex h-7 cursor-pointer items-center rounded-[8px] bg-nb-paper px-2.5 text-[12px] font-[700] text-nb-ink max-md:h-9";

/**
 * The way into the app, offered on a card page (#364).
 *
 * A workspace card's chat link lands every reader here rather than on `ai4kanban://`, because
 * a redirect cannot tell whether the machine asking has the app and guessing wrong on a phone
 * is the failure this page exists to remove. This is what that costs a desktop reader back: a
 * machine holding a copy of the workspace opens the card in the app, and one without it does
 * nothing — which is why it is an offer rather than a redirect.
 */
export function OpenInApp({ workspace, card }: { workspace: string; card: number }) {
  const copy = useHostedCopy();
  return (
    <a href={`ai4kanban://card/${encodeURIComponent(workspace)}/${card}`} className={`${WAY_OUT} ${CHROME}`}>
      {copy.openInApp}
    </a>
  );
}

/**
 * The account, on every signed-in page (#575) — the avatar, and under it who this is,
 * Settings and the way out.
 *
 * It is drawn whether or not the account could be read: the reader IS signed in, so the way
 * out has to be on the page, and an unread account costs the identity block rather than the
 * menu.
 *
 * Sign out stays a form rather than becoming a link: signing a reader out is a change, and a
 * link somebody else put on a page must not be able to make it. `SameSite=Lax` carries the
 * cookie on a link and not on a cross-site POST, which is what makes that true.
 */
function AccountMenu() {
  const copy = useHostedCopy();
  const account = useContext(AccountContext);
  const name = account ? accountName(account) : "";
  const address = account ? accountAddress(account) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={copy.account}
          className={`size-7 shrink-0 cursor-pointer overflow-hidden rounded-[8px] bg-nb-paper max-md:size-9 ${CHROME}`}
        >
          <Avatar account={account} className="size-full rounded-none text-[11px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        {account && (name || address) && (
          <>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <Avatar account={account} />
              <span className="flex min-w-0 flex-col">
                {name && <span className="truncate text-[13px] font-[700] text-nb-ink">{name}</span>}
                {address && (
                  <span className="truncate text-[11px] font-[600] text-nb-ink-soft">{address}</span>
                )}
              </span>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/settings">{copy.settings}</Link>
        </DropdownMenuItem>
        <form action="/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              {copy.signOut}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The account's picture, its initials under that, and a neutral mark under both — so a
 *  provider that attests no picture shows a name, and an account that could not be read at
 *  all still shows something a reader can aim at. */
export function Avatar({
  account,
  className = "size-[26px] rounded-[8px] text-[11px]",
}: {
  account: HostedAccount | null;
  className?: string;
}) {
  const initials = (account ? accountName(account) : "")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-nb-ink/8 font-[800] text-nb-ink ${className}`}
      aria-hidden
    >
      {initials || <FiUser className="size-[55%]" />}
      {account?.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatarUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/** A link, because starting a sign-in changes nothing until the reader comes back from the
 *  consent screen with a code — and the route it leads to is one of the two open ones. */
function SignIn() {
  const copy = useHostedCopy();
  return (
    <Link href="/signin" className={`${WAY_OUT} ${CHROME}`}>
      {copy.signIn}
    </Link>
  );
}

/**
 * Which release the board is showing. The app's picker (`ReleasePicker.tsx`) is the app's: it
 * makes, fills, drops and closes a version, and every one of those is a write. This is the
 * half a reader gets — what to look at, and nothing that changes anything.
 */
export function Releases({
  releases,
  goals,
  counts,
  value,
  onChange,
}: {
  releases: string[];
  goals: Record<string, string>;
  counts: Record<string, number>;
  value: ReleasePick;
  onChange: (r: ReleasePick) => void;
}) {
  const c = useCopy().board.release;
  return (
    <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger aria-label={c.which} className="h-7 w-[168px] text-[12px] font-[700] max-md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{c.none(counts[""] ?? 0)}</SelectItem>
        {releases.map((id) => (
          <SelectItem key={id} value={id}>
            <span className="flex flex-col items-start">
              {`${id} (${counts[id] ?? 0})`}
              {goals[id] && (
                <span className="max-w-[42ch] truncate text-[11px] font-[400] text-nb-ink-soft">
                  {goals[id]}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A whole page that is one sentence: a refusal, a service that could not answer, a card the
 * board does not have, or an account with no workspace yet. One shape for all of them, so
 * what tells them apart is the sentence and nothing else.
 *
 * `workspaceName` and `back` are for the one of those that happens on a board the reader can
 * already see — a card id it does not hold — where the way back belongs on the page.
 */
export function NoticePage({
  copy,
  account = null,
  workspaceName,
  back,
  signedOut,
  children,
}: {
  copy: HostedCopy;
  account?: HostedAccount | null;
  workspaceName?: string;
  back?: string;
  signedOut?: boolean;
  children: ReactNode;
}) {
  return (
    <Page copy={copy} account={account} workspaceName={workspaceName} back={back} signedOut={signedOut}>
      <p className="text-[15px] leading-relaxed text-nb-ink">{children}</p>
    </Page>
  );
}

/** The page every screen that is not a board is drawn on: the top row, and one column under
 *  it that fills the height. */
export function Page({
  copy,
  account = null,
  workspaceName,
  back,
  signedOut,
  children,
}: {
  copy: HostedCopy;
  account?: HostedAccount | null;
  workspaceName?: string;
  back?: string;
  signedOut?: boolean;
  children: ReactNode;
}) {
  return (
    <CopyProvider value={copy}>
      <AccountProvider value={account}>
        <div className="flex min-h-dvh flex-col">
          <TopRow workspaceName={workspaceName} back={back} signedOut={signedOut} />
          <main className="mx-auto flex w-full max-w-[52ch] flex-1 flex-col justify-center gap-4 px-6">
            {children}
          </main>
        </div>
      </AccountProvider>
    </CopyProvider>
  );
}
