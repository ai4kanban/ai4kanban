"use client";

// AI4Kanban Cloud — the account this MACHINE signs in as (#326).
//
// It sits below the sections that settle this board, separated from them by a rule, because
// it is not a board setting: one sign-in covers every project the app has open and every
// terminal on the machine, and it is held outside every repository.
//
// The sign-in happens in three places and no fewer. This pane asks the board server for the
// consent URL — the secret half of it never leaves the machine — the app opens that URL in
// the user's own browser, and the answer comes back to the app over its own URL scheme and
// is handed here to be exchanged. So the pane needs the app: in a plain browser there is no
// scheme to come back to, and it says so instead of offering a button that cannot finish.
//
// Four states, one per answer a sign-in can come back with: not signed in, signed in and
// admitted, signed in and not admitted, and expired. What the service refuses is shown in
// the service's own words — Cloud writes its refusals to be read as they stand, and a copy
// of them here would be a second thing to keep true.
//
// The not-admitted state is the one with something to do in it (#327), and it reads as one
// column: the refusal, the code box, **Request an invite** under a hairline, and Sign out
// last. Whoever was handed a code meets the box immediately; whoever has none pays one short
// line of reading before the button.
//
// Two more things live under the admitted state (#319), and the line between them is the
// line this section already draws. **Notifications for this board** belongs to the board:
// signing in turns them on — they are not a setting — so what is shown is what they do and
// how wide they watch: every release, or one. The **silencing** switch belongs to the MACHINE and sits
// with the sign-in, because the interruptions it stops arrive from every board — a per-board
// switch would be reachable only by opening that project first.

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiBell, FiBellOff, FiCheck, FiKey, FiLogOut, FiMail } from "react-icons/fi";
import { SiGithub } from "react-icons/si";
import {
  boardNotificationsAction,
  cloudAccountAction,
  setBoardServerAction,
  finishCloudSignInAction,
  notificationCenterAction,
  redeemCloudInvitationAction,
  requestCloudInviteAction,
  setSilencedAction,
  signOutOfCloudAction,
  startCloudSignInAction,
  watchReleaseAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { ALL_RELEASES, type BoardNotifications } from "@/lib/notifications";
import type { CloudAccount } from "@/lib/types";
import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** The published pages the terms say signing in confirms you have read. */
const PRIVACY_URL = "https://ai4kanban.dev/privacy";
const TERMS_URL = "https://ai4kanban.dev/terms";

interface AppBridge {
  openExternal(url: string): Promise<void>;
  onCloudCallback(fn: (url: string) => void): () => void;
}

function bridge(): AppBridge | null {
  if (typeof window === "undefined") return null;
  const app = (window as { ai4kanban?: Partial<AppBridge> }).ai4kanban;
  return app?.openExternal && app.onCloudCallback ? (app as AppBridge) : null;
}

export function CloudPanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.cloud;
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [busy, setBusy] = useState(false);
  // The sign-in is out in the browser and we are waiting for it to come back.
  const [waiting, setWaiting] = useState(false);
  const inApp = typeof window !== "undefined" && !!bridge();

  const load = useCallback(async () => {
    setAccount(await cloudAccountAction());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The answer the app caught on its URL scheme. Exchanged here, on the server that holds
  // the session — the app never sees a token.
  useEffect(() => {
    const app = bridge();
    if (!app) return;
    return app.onCloudCallback((url) => {
      void (async () => {
        setWaiting(false);
        setBusy(true);
        try {
          const done = await finishCloudSignInAction(url);
          if (!done.ok) onError?.(done.error || c.finishFailed);
          await load();
        } finally {
          setBusy(false);
        }
      })();
    });
  }, [load, onError, c]);

  const signIn = async () => {
    const app = bridge();
    if (!app || busy) return;
    setBusy(true);
    try {
      const start = await startCloudSignInAction();
      if (!start.ok) return onError?.(start.error);
      await app.openExternal(start.url);
      setWaiting(true);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const done = await signOutOfCloudAction();
      if (!done.ok) onError?.(done.error || c.signOutFailed);
      setWaiting(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">{c.title}</h3>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-nb-ink-soft">{c.blurb}</p>
      </div>

      {!account ? (
        <p className="text-[13px] text-nb-ink-soft">{c.checking}</p>
      ) : account.state === "signed-in" ? (
        <SignedIn account={account} busy={busy} onSignOut={() => void signOut()} />
      ) : account.state === "not-admitted" ? (
        <NotAdmitted
          account={account}
          busy={busy}
          onDone={load}
          onError={onError}
          onSignOut={() => void signOut()}
        />
      ) : (
        <SignedOut
          account={account}
          inApp={inApp}
          busy={busy}
          waiting={waiting}
          onSignIn={() => void signIn()}
          onSignOut={() => void signOut()}
        />
      )}

      {account?.error && (
        <Note>{c.unreachable(account.error)}</Note>
      )}
    </div>
  );
}

// --- signed in and admitted ---------------------------------------------------

function SignedIn({
  account,
  busy,
  onSignOut,
}: {
  account: CloudAccount;
  busy: boolean;
  onSignOut: () => void;
}) {
  const c = useCopy().configuration.cloud;
  return (
    <>
      <div className="flex items-center gap-3.5 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-4 py-3.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]">
        <Avatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-[800] text-nb-ink">
            {account.name || account.handle || c.signedIn}
            <SiGithub className="shrink-0 text-nb-ink-soft" size={13} aria-label="GitHub" />
          </p>
          {account.handle && (
            <p className="mt-[3px] font-mono text-[11.5px] font-[700] text-nb-ink">
              @{account.handle}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onSignOut}>
          <FiLogOut size={13} aria-hidden />
          {c.signOut}
        </Button>
      </div>

      <Silencer />

      <Notifications />

      <p className="border-t border-nb-ink/12 pt-3.5 text-[12px] leading-relaxed text-nb-ink-soft">
        {c.signOutNote}
      </p>
    </>
  );
}

// --- the machine's one silencing switch (#319) --------------------------------
// It sits with the sign-in rather than with the board's own settings below: what it stops
// arrives from every board Cloud is on for, and the bell keeps filling either way.

function Silencer() {
  const c = useCopy().configuration.cloud;
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void notificationCenterAction().then((center) => setOn(center.silenced));
  }, []);

  const flip = async () => {
    if (busy || on === null) return;
    setBusy(true);
    try {
      const done = await setSilencedAction(!on);
      if (done.ok) setOn(!on);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-[10px] bg-nb-wash px-4 py-3.5">
      <span className="mt-[1px] shrink-0 text-nb-ink-soft">
        {on ? <FiBellOff size={15} aria-hidden /> : <FiBell size={15} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-[800] text-nb-ink">{c.silence.title}</p>
        <p className="mt-[3px] text-[11.5px] leading-[16px] text-nb-ink-soft">{c.silence.blurb}</p>
      </div>
      <Switch
        on={on === true}
        busy={busy || on === null}
        onFlip={() => void flip()}
        label={c.silence.title}
      />
    </div>
  );
}

// --- this board's own notifications (#319) ------------------------------------
// Signed in means on: a board raises its events the moment this machine has an account,
// so there is nothing to switch here — only which open release it watches, since a `ready`
// task in another release, or promised to none, is not what the user asked to be told about.

function Notifications() {
  const c = useCopy().configuration.cloud.notifications;
  const [state, setState] = useState<BoardNotifications | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setState(await boardNotificationsAction()), []);
  useEffect(() => {
    void load();
  }, [load]);

  const move = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const done = await run();
      if (!done.ok) setError(done.error ?? c.saveFailed);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  return (
    <div className="rounded-[10px] border border-nb-ink/12 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[12.5px] font-[800] text-nb-ink">{c.title}</p>
        <p className="mt-[3px] max-w-[52ch] text-[11.5px] leading-[16px] text-nb-ink-soft">
          <Rich>{c.blurb}</Rich>
        </p>
      </div>

      {/* How wide this board watches. `All` is always there — it needs no release to exist —
          so the only empty answer left is a board resting on a release that closed, which
          shows the placeholder and the same prompt the rail gives where the filling stopped. */}
      {state.enabled && (
        <div className="mt-3 flex items-center gap-2.5 border-t border-nb-ink/12 pt-3">
          <span className="text-[12px] font-[700] text-nb-ink">{c.watching}</span>
          <Select
            value={state.release || undefined}
            disabled={busy}
            onValueChange={(release) => void move(() => watchReleaseAction(release))}
          >
            <SelectTrigger
              aria-label={c.watching}
              className="h-8 w-auto rounded-[8px] py-0 font-mono text-[12px] font-[700]"
            >
              <SelectValue placeholder={c.pickRelease} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RELEASES} className="font-mono text-[12px]">
                {c.allReleases}
              </SelectItem>
              {state.releases.map((release) => (
                <SelectItem key={release} value={release} className="font-mono text-[12px]">
                  {release}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="min-w-0 flex-1 text-[11.5px] leading-[16px] text-nb-ink-soft">
            {state.release === ALL_RELEASES
              ? c.anyRelease
              : state.release
                ? c.onlyThisRelease
                : c.releaseClosed}
          </span>
        </div>
      )}

      {/* Which machine runs this board's work (#318). Only once the board is raising events:
          a board that raises none has no approvals to run. */}
      {state.enabled && <ServerRow state={state} busy={busy} onMove={move} />}

      {error && (
        <p className="mt-2 text-[11.5px] leading-[16px] text-nb-peach-ink" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

// --- which machine runs this board's work (#318) ------------------------------
// A board attaches exactly one server, so this is a switch and — where another machine holds
// the board — the one move that takes it over. The refusal is never shown on its own: the
// case that reaches it is a home directory restored onto a new machine, where the machine
// holding the board is exactly the one that has gone.

function ServerRow({
  state,
  busy,
  onMove,
}: {
  state: BoardNotifications;
  busy: boolean;
  onMove: (run: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
}) {
  const c = useCopy().configuration.cloud.server;
  const { server } = state;
  const elsewhere = server.attached && !server.here;

  return (
    <div className="mt-3 border-t border-nb-ink/12 pt-3">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-[800] text-nb-ink">{c.title}</p>
          <p className="mt-[3px] max-w-[52ch] text-[11.5px] leading-[16px] text-nb-ink-soft">
            {elsewhere ? <Rich>{c.heldBy(server.machineName)}</Rich> : c.blurb}
          </p>
        </div>
        {elsewhere ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onMove(() => setBoardServerAction(true, true))}>
            {busy ? c.moving : c.moveHere}
          </Button>
        ) : (
          <Switch
            on={server.here}
            busy={busy}
            onFlip={() => void onMove(() => setBoardServerAction(!server.here))}
            label={server.here ? c.switchOn : c.switchOff}
          />
        )}
      </div>
    </div>
  );
}

/** The section's one switch shape, so the machine's silencing and the board's server read as
 *  one control used twice rather than two that happen to look alike. */
function Switch({
  on,
  busy,
  onFlip,
  label,
}: {
  on: boolean;
  busy: boolean;
  onFlip: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onFlip}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full border-[1.5px] border-nb-ink transition-colors disabled:opacity-50 ${
        busy ? "cursor-default" : "cursor-pointer"
      }`}
      style={{ background: on ? "var(--color-nb-accent)" : "var(--color-nb-paper)" }}
    >
      <span
        aria-hidden
        className="absolute top-[2px] size-[15px] rounded-full border-[1.5px] border-nb-ink transition-[left]"
        style={{ left: on ? 18 : 2, background: "var(--color-nb-paper)" }}
      />
    </button>
  );
}

// --- not signed in, or expired ------------------------------------------------

function SignedOut({
  account,
  inApp,
  busy,
  waiting,
  onSignIn,
  onSignOut,
}: {
  account: CloudAccount;
  inApp: boolean;
  busy: boolean;
  waiting: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const c = useCopy().configuration.cloud;
  const expired = account.state === "expired";

  return (
    <>
      {expired ? (
        <Note title={c.expired}>{c.expiredBody}</Note>
      ) : (
        <div className="rounded-[10px] bg-nb-wash px-4 py-3.5">
          <p className="text-[13px] font-[800] text-nb-ink">{c.inviteOnly}</p>
          <p className="mt-1 max-w-[58ch] text-[12.5px] leading-relaxed text-nb-ink-soft">
            {c.inviteOnlyBody}
          </p>
        </div>
      )}

      {/* What Cloud does and does not do, before the sign-in rather than after it. */}
      <Boundary />

      <div className="flex flex-wrap items-center gap-3">
        {inApp ? (
          <Button size="sm" disabled={busy || !account.configured} onClick={onSignIn}>
            <SiGithub size={14} aria-hidden />
            {expired ? c.signInAgain : c.signIn}
          </Button>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">{c.needsApp}</p>
        )}
        {expired && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onSignOut}>
            <FiLogOut size={13} aria-hidden />
            {c.signOut}
          </Button>
        )}
        {waiting && (
          <span className="text-[12px] text-nb-ink-soft">{c.waiting}</span>
        )}
      </div>

      {!account.configured && account.message && <Note>{account.message}</Note>}
    </>
  );
}

// --- signed in and not admitted (#327) ----------------------------------------
// Two doors, one under the other: the code box first, because whoever was handed a code has
// nothing to read, and **Request an invite** under a hairline for whoever has none. Both
// press once and then re-read the account, so what is drawn next is the service's answer.

function NotAdmitted({
  account,
  busy,
  onDone,
  onError,
  onSignOut,
}: {
  account: CloudAccount;
  busy: boolean;
  onDone: () => Promise<void>;
  onError?: (msg: string) => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  /** The service's own words for the last code we tried. Cleared as soon as it is retyped.
   *  Only a code lands here — a request that fails has no box to sit under, so it goes to
   *  the pane's own error line. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [working, setWorking] = useState<"redeem" | "request" | null>(null);
  const held = busy || working !== null;
  const c = useCopy().configuration.cloud;

  const redeem = async () => {
    if (held || !code.trim()) return;
    setWorking("redeem");
    setRefusal(null);
    try {
      const done = await redeemCloudInvitationAction(code);
      // A redemption moves the pane to the admitted state on the spot, so there is nothing
      // to say on success — the pane it drew is gone.
      if (!done.ok) setRefusal(done.error);
      else await onDone();
    } finally {
      setWorking(null);
    }
  };

  const request = async () => {
    if (held) return;
    setWorking("request");
    try {
      const done = await requestCloudInviteAction();
      if (!done.ok) onError?.(done.error);
      else await onDone();
    } finally {
      setWorking(null);
    }
  };

  return (
    <>
      <Note title={c.notAdmitted}>
        {account.handle && (
          <>
            <Rich code="font-mono text-[11.5px] font-[700]">{c.signedInAs(account.handle)}</Rich>{" "}
          </>
        )}
        {account.message}
      </Note>

      <div className="rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-4 py-3.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]">
        <p className="flex items-center gap-2 text-[13px] font-[800] text-nb-ink">
          <FiKey size={14} aria-hidden />
          {c.haveCode}
        </p>
        <form
          className="mt-2.5 flex items-center gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void redeem();
          }}
        >
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setRefusal(null);
            }}
            spellCheck={false}
            autoComplete="off"
            aria-label={c.codeLabel}
            aria-invalid={refusal ? true : undefined}
            placeholder={c.codeExample}
            className={`h-9 min-w-0 flex-1 rounded-[9px] border-[1.5px] bg-nb-paper px-3 font-mono text-[13px] font-[700] tracking-[0.06em] text-nb-ink outline-none placeholder:font-[500] placeholder:tracking-normal placeholder:text-nb-ink-soft/50 ${
              refusal ? "border-nb-peach-ink" : "border-nb-ink"
            }`}
          />
          <Button size="sm" type="submit" disabled={held || !code.trim()}>
            {working === "redeem" ? c.redeeming : c.redeem}
          </Button>
        </form>
        {refusal ? (
          <div
            className="mt-2 flex items-start gap-2 rounded-[8px] bg-nb-peach-soft px-3 py-2"
            role="status"
          >
            <FiAlertCircle className="mt-[1px] shrink-0 text-nb-peach-ink" size={12} aria-hidden />
            <span className="text-[11.5px] leading-[16px] text-nb-ink">{refusal}</span>
          </div>
        ) : (
          <p className="mt-2 text-[11.5px] leading-[16px] text-nb-ink-soft">{c.oneCode}</p>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-nb-ink/12 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-[800] text-nb-ink">{c.noCode}</p>
          <p className="mt-[3px] text-[11.5px] leading-[16px] text-nb-ink-soft">{c.noCodeBody}</p>
        </div>
        {account.inviteRequestedAt ? (
          <span className="flex h-[34px] shrink-0 items-center gap-2 rounded-[9px] bg-nb-mint-soft px-3 text-[12px] font-[700] text-nb-mint-ink">
            <FiCheck size={12} aria-hidden />
            {c.asked(asked(account.inviteRequestedAt, c.askedUndated))}
          </span>
        ) : (
          <Button size="sm" variant="ghost" disabled={held} onClick={() => void request()}>
            <FiMail size={13} aria-hidden />
            {working === "request" ? c.asking : c.requestInvite}
          </Button>
        )}
      </div>

      <div>
        <Button size="sm" variant="ghost" disabled={held} onClick={onSignOut}>
          <FiLogOut size={13} aria-hidden />
          Sign out
        </Button>
      </div>
    </>
  );
}

/** When the request went in, in the shortest form that still says which day. */
function asked(at: string, undated: string): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return undated;
  return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** What Cloud is for, and what it never receives. Said here because in 0.8.0 this pane is
 *  the only place Cloud is ever offered; #317 extends it to onboarding. */
function Boundary() {
  const c = useCopy().configuration.cloud;
  return (
    <div className="rounded-[10px] border border-nb-ink/12 px-4 py-3.5">
      <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-nb-ink-soft">{c.boundary}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-nb-ink-soft">
        {c.terms}{" "}
        <Link href={PRIVACY_URL}>{c.privacyLink}</Link>
        {c.termsAnd}
        <Link href={TERMS_URL}>{c.termsLink}</Link>
        {c.termsEnd}
      </p>
    </div>
  );
}

/** A link out of the board: in the app it opens the user's browser, because a desktop window
 *  must never navigate away from the board. */
function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-[700] text-nb-accent-deep underline underline-offset-2"
      onClick={(e) => {
        const app = bridge();
        if (!app) return;
        e.preventDefault();
        void app.openExternal(href);
      }}
    >
      {children}
    </a>
  );
}

/** The account's own picture, drawn from the bytes this machine holds (the board's rules
 *  fetch it once) — with the initials underneath, so a machine that never got one shows a
 *  name rather than a hole. */
function Avatar({ account }: { account: CloudAccount }) {
  const initials = (account.name || account.handle || "?")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-nb-wash text-[14px] font-[800] text-nb-ink"
      aria-hidden
    >
      {initials || "?"}
      {account.avatarData && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatarData} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/** The pane's one attention band — a refusal, an expiry, a Cloud that cannot be reached. */
function Note({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[9px] bg-nb-peach-soft px-3.5 py-3" role="status">
      <FiAlertCircle className="mt-[2px] shrink-0 text-nb-peach-ink" size={14} aria-hidden />
      <div className="min-w-0">
        {title && <p className="text-[12.5px] font-[800] text-nb-peach-ink">{title}</p>}
        <p className={`text-[12px] leading-relaxed text-nb-ink ${title ? "mt-1" : ""}`}>{children}</p>
      </div>
    </div>
  );
}
