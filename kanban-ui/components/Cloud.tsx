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

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCheck, FiHome, FiLogOut, FiRefreshCw } from "react-icons/fi";
import { SiGithub } from "react-icons/si";
import {
  cloudAccountAction,
  finishCloudSignInAction,
  signOutOfCloudAction,
  startCloudSignInAction,
} from "@/app/actions";
import type { CloudAccount } from "@/lib/types";
import { Button } from "./button";

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
          if (!done.ok) onError?.(done.error || "that sign-in did not complete");
          await load();
        } finally {
          setBusy(false);
        }
      })();
    });
  }, [load, onError]);

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
      if (!done.ok) onError?.(done.error || "couldn't sign out");
      setWaiting(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[17px] font-[800] tracking-[-0.02em] text-nb-ink">Cloud</h3>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-nb-ink-soft">
          The account this machine signs in as. One sign-in covers every project you open and
          every terminal on it.
        </p>
      </div>

      {!account ? (
        <p className="text-[13px] text-nb-ink-soft">Checking this machine…</p>
      ) : account.state === "signed-in" ? (
        <SignedIn account={account} busy={busy} onSignOut={() => void signOut()} />
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
        <Note>
          Cloud could not be reached: {account.error}. Nothing on this board is affected.
        </Note>
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
  return (
    <>
      <div className="flex items-center gap-3.5 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-4 py-3.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]">
        <Avatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-[800] text-nb-ink">
            {account.name || account.handle || "Signed in"}
            <SiGithub className="shrink-0 text-nb-ink-soft" size={13} aria-label="GitHub" />
          </p>
          {account.handle && (
            <p className="mt-[3px] font-mono text-[11.5px] font-[700] text-nb-ink">
              @{account.handle}
            </p>
          )}
          <p className="mt-[3px] text-[11.5px] leading-[16px] text-nb-ink-soft">
            Slack names this handle when it acts for you.
          </p>
        </div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onSignOut}>
          <FiLogOut size={13} aria-hidden />
          Sign out
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] bg-nb-wash px-4 py-3.5">
        {/* Only when Cloud actually said so this minute — an unreachable service is not a
            refusal, but it is not a confirmation either. */}
        {!account.error && (
          <Fact icon={<FiCheck className="text-nb-mint-ink" size={14} aria-hidden />}>
            <b className="font-[800]">Admitted to the preview.</b> Cloud takes this account’s work.
          </Fact>
        )}
        <Fact icon={<FiRefreshCw className="text-nb-ink-soft" size={14} aria-hidden />}>
          <b className="font-[800]">Renews on its own</b> — a delivery already running is never
          interrupted, and the sign-in survives a restart.
        </Fact>
        <Fact icon={<FiHome className="text-nb-ink-soft" size={14} aria-hidden />}>
          <b className="font-[800]">Kept on this machine</b>, at{" "}
          <code className="font-mono text-[11.5px] font-[700]">{account.sessionFile}</code> — never
          inside your repository, so <code className="font-mono text-[11.5px] font-[700]">akb</code>{" "}
          in a terminal acts as this account too.
        </Fact>
      </div>

      <p className="border-t border-nb-ink/12 pt-3.5 text-[12px] leading-relaxed text-nb-ink-soft">
        Signing out stops this machine sending to Cloud. Nothing already on the board is touched,
        and signing back in picks the same account up.
      </p>
    </>
  );
}

// --- not signed in, not admitted, expired -------------------------------------

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
  const refused = account.state === "not-admitted";
  const expired = account.state === "expired";

  return (
    <>
      {refused && (
        <Note title="This account is not in the preview yet.">
          {account.handle && (
            <>
              You are signed in as{" "}
              <code className="font-mono text-[11.5px] font-[700]">@{account.handle}</code>.{" "}
            </>
          )}
          {account.message}
        </Note>
      )}

      {expired && (
        <Note title="Your Cloud sign-in expired.">
          Nothing was lost. Sign in again and whatever was waiting to send carries on.
        </Note>
      )}

      {!refused && !expired && (
        <div className="rounded-[10px] bg-nb-wash px-4 py-3.5">
          <p className="text-[13px] font-[800] text-nb-ink">Cloud is an invite-only preview.</p>
          <p className="mt-1 max-w-[58ch] text-[12.5px] leading-relaxed text-nb-ink-soft">
            Sign in with GitHub and we will say straight away whether your account is in it.
          </p>
        </div>
      )}

      {/* What Cloud does and does not do, before the sign-in rather than after it. */}
      {!refused && <Boundary />}

      <div className="flex flex-wrap items-center gap-3">
        {!refused &&
          (inApp ? (
            <Button size="sm" disabled={busy || !account.configured} onClick={onSignIn}>
              <SiGithub size={14} aria-hidden />
              {expired ? "Sign in again" : "Sign in with GitHub"}
            </Button>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">
              Signing in needs the AI4Kanban app — the consent screen comes back to it. Open this
              project there once, and every terminal on this machine is signed in with it.
            </p>
          ))}
        {(refused || expired) && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onSignOut}>
            <FiLogOut size={13} aria-hidden />
            Sign out
          </Button>
        )}
        {waiting && (
          <span className="text-[12px] text-nb-ink-soft">
            Waiting for the consent screen in your browser…
          </span>
        )}
      </div>

      {!account.configured && account.message && !refused && (
        <Note>{account.message}</Note>
      )}
    </>
  );
}

/** What Cloud is for, and what it never receives. Said here because in 0.8.0 this pane is
 *  the only place Cloud is ever offered; #317 extends it to onboarding. */
function Boundary() {
  return (
    <div className="rounded-[10px] border border-nb-ink/12 px-4 py-3.5">
      <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-nb-ink-soft">
        Cloud relays this board’s questions and review requests, and the decisions made on them.
        It never receives your repository, never runs an agent, and never reads a card the board
        has not published.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-nb-ink-soft">
        Signing in confirms you have read the{" "}
        <Link href={PRIVACY_URL}>Privacy Policy</Link> and the <Link href={TERMS_URL}>Terms of
        Service</Link>. GitHub is asked for your name and handle and nothing else — no repository
        access.
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

function Avatar({ account }: { account: CloudAccount }) {
  const initials = (account.name || account.handle || "?")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border-[1.5px] border-nb-ink bg-nb-wash text-[14px] font-[800] text-nb-ink"
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-start gap-2.5">
      <span className="mt-[2px] shrink-0">{icon}</span>
      <span className="text-[12.5px] leading-[18px] text-nb-ink">{children}</span>
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
