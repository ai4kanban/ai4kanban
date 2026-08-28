"use client";

// Notifications — where a card that needs you reaches you, and the account it reaches you
// through (#326). Named for the job in the nav; Cloud is the plumbing, and is said in the
// sentences rather than on the tab.
//
// It sits below the sections that settle this board, separated from them by a rule, because
// the sign-in is not a board setting: one sign-in covers every project the app has open and
// every terminal on the machine, and it is held outside every repository.
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
// The admitted state is one column in two tiers, and no prose explaining what a notification
// is — the tab already said it. Above: what holds for the account and the machine — who you
// are, the silencing switch, and Slack. Below a **This board** caption: what only this board
// settles — the release it watches and the machine that runs its work.

import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiBell, FiBellOff, FiCheck, FiKey, FiLogOut, FiMail } from "react-icons/fi";
import { FaSlack } from "react-icons/fa";
import { SiGithub } from "react-icons/si";
import {
  boardNotificationsAction,
  cloudAccountAction,
  disconnectSlackAction,
  setBoardServerAction,
  finishCloudSignInAction,
  notificationCenterAction,
  redeemCloudInvitationAction,
  requestCloudInviteAction,
  setSilencedAction,
  setSlackChannelAction,
  signOutOfCloudAction,
  slackConversationsAction,
  slackStateAction,
  startCloudSignInAction,
  startSlackConnectAction,
  watchReleaseAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { BoardNotifications } from "@/lib/notifications";
import { ALL_RELEASES, type CloudAccount, type SlackConversation, type SlackState } from "@/lib/types";
import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** The published pages the terms say signing in confirms you have read. */
const PRIVACY_URL = "https://ai4kanban.dev/privacy";
const TERMS_URL = "https://ai4kanban.dev/terms";

/** The two answers this pane takes off the app's URL scheme: a finished sign-in, and a
 *  finished Slack connection. The card link is the window's and arrives elsewhere (#320). */
const SIGNED_IN = "ai4kanban://cloud/signed-in";
const SLACK_CONNECTED = "ai4kanban://cloud/slack-connected";

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
  // Bumped when a finished Slack connection comes back on the scheme, so the Slack row
  // re-reads what the service now holds.
  const [slackTick, setSlackTick] = useState(0);
  const inApp = typeof window !== "undefined" && !!bridge();

  const load = useCallback(async () => {
    setAccount(await cloudAccountAction());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The two answers the app caught on its URL scheme, told apart by what each one says: a
  // finished sign-in is exchanged here, on the server that holds the session — the app never
  // sees a token — and a finished Slack connection is only a signal to look again (#320).
  useEffect(() => {
    const app = bridge();
    if (!app) return;
    return app.onCloudCallback((url) => {
      if (url.startsWith(SLACK_CONNECTED)) {
        setSlackTick((n) => n + 1);
        return;
      }
      if (!url.startsWith(SIGNED_IN)) return;
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
        <SignedIn
          account={account}
          busy={busy}
          inApp={inApp}
          slackTick={slackTick}
          onError={onError}
          onSignOut={() => void signOut()}
        />
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
  inApp,
  slackTick,
  onError,
  onSignOut,
}: {
  account: CloudAccount;
  busy: boolean;
  /** Connecting Slack needs the app for the same reason signing in does: the consent
   *  screen comes back on a URL scheme only the app answers. */
  inApp: boolean;
  /** Bumped when a finished connection came back on that scheme. */
  slackTick: number;
  onError?: (msg: string) => void;
  onSignOut: () => void;
}) {
  const c = useCopy().configuration.cloud;
  return (
    <>
      <div className="flex items-center gap-3.5 rounded-[10px] border border-nb-ink/12 bg-nb-paper px-4 py-3.5">
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

      <Slack inApp={inApp} reload={slackTick} onError={onError} />

      <Notifications />
    </>
  );
}

// --- the machine's one silencing switch (#319) --------------------------------
// Above the board's tier: what it stops arrives from every board, and the bell keeps filling
// either way.

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

// --- the account's one Slack destination (#320) -------------------------------
// One destination for the ACCOUNT, so it sits in the tier above the board's: every board
// posts to it with its own name on each message.
//
// Two states and one band. Before connecting it is one line and a button, because there is
// nothing yet to describe. Connected, it is the workspace, the conversation it posts to and
// the way out — and when Slack has refused us, the band says so here, where the connection
// was made, since messages failing into silence read as no work waiting.

function Slack({
  inApp,
  reload,
  onError,
}: {
  inApp: boolean;
  reload: number;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.cloud.slack;
  const [state, setState] = useState<SlackState | null>(null);
  const [working, setWorking] = useState<"connect" | "save" | "disconnect" | null>(null);
  const [waiting, setWaiting] = useState(false);

  const load = useCallback(async () => setState(await slackStateAction()), []);
  useEffect(() => {
    void load();
  }, [load, reload]);
  // A connection that came back on the scheme is one this pane was waiting for.
  useEffect(() => {
    if (reload > 0) setWaiting(false);
  }, [reload]);

  const connect = async () => {
    const app = bridge();
    if (!app || working) return;
    setWorking("connect");
    try {
      const start = await startSlackConnectAction();
      if (!start.ok) return onError?.(start.error || c.connectFailed);
      await app.openExternal(start.url);
      setWaiting(true);
    } finally {
      setWorking(null);
    }
  };

  const move = async (what: "save" | "disconnect", run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (working) return;
    setWorking(what);
    try {
      const done = await run();
      if (!done.ok) onError?.(done.error || (what === "save" ? c.saveFailed : c.disconnectFailed));
      await load();
    } finally {
      setWorking(null);
    }
  };

  if (!state) {
    return <p className="text-[12px] text-nb-ink-soft">{c.checking}</p>;
  }

  const { connection } = state;
  const busy = working !== null;

  if (!connection) {
    return (
      <div className="flex items-center gap-3.5 rounded-[10px] bg-nb-wash px-4 py-3.5">
        <FaSlack className="shrink-0 text-nb-ink-soft" size={15} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-[800] text-nb-ink">{c.title}</p>
          {/* Cloud's own words first. A service that could not be reached answers no
              connection and no app either, and reading that as "this service carries no
              Slack app" would tell the user to change something that is not wrong. */}
          <p className="mt-[3px] max-w-[52ch] text-[11.5px] leading-[16px] text-nb-ink-soft">
            {state.error
              ? state.error
              : !state.configured
                ? c.unavailable
                : !inApp
                  ? c.needsApp
                  : waiting
                    ? c.waiting
                    : c.blurb}
          </p>
        </div>
        {state.configured && inApp && (
          <Button size="sm" disabled={busy} onClick={() => void connect()}>
            {working === "connect" ? c.connecting : c.connect}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-nb-ink/12 px-4 py-3.5">
      <div className="flex items-center gap-4">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-[800] text-nb-ink">
          <FaSlack className="shrink-0 text-nb-ink-soft" size={13} aria-hidden />
          {connection.teamName || c.title}
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void move("disconnect", disconnectSlackAction)}
        >
          {working === "disconnect" ? c.disconnecting : c.disconnect}
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2.5 border-t border-nb-ink/12 pt-3">
        <span className="text-[12px] font-[700] text-nb-ink">{c.postsTo}</span>
        <Destination
          connection={connection}
          busy={busy}
          onPick={(conversation) =>
            void move("save", () => setSlackChannelAction(conversation.id, conversation.name))
          }
        />
        <span className="min-w-0 flex-1 text-[11.5px] leading-[16px] text-nb-ink-soft">
          {c.everyBoard}
        </span>
      </div>

      {connection.revoked && (
        <div className="mt-3">
          <Note title={c.refused}>{connection.lastError}</Note>
        </div>
      )}
    </div>
  );
}

/** The conversation picker. Slack is asked only when the list is opened: a pane that read
 *  the workspace's channels every time it was drawn would spend a Slack call on somebody
 *  who came to read the sign-in. */
function Destination({
  connection,
  busy,
  onPick,
}: {
  connection: NonNullable<SlackState["connection"]>;
  busy: boolean;
  onPick: (conversation: SlackConversation) => void;
}) {
  const c = useCopy().configuration.cloud.slack;
  const [conversations, setConversations] = useState<SlackConversation[] | null>(null);
  const [reading, setReading] = useState(false);

  const read = async () => {
    if (conversations || reading) return;
    setReading(true);
    try {
      const answer = await slackConversationsAction();
      setConversations(answer.ok ? answer.conversations : []);
    } finally {
      setReading(false);
    }
  };

  // The one it already posts to is always in the list, whether or not Slack answered: the
  // picker must show where messages go even when the workspace cannot be read this second.
  const offered = conversations ?? [];
  const known = connection.channelId
    ? offered.some((conversation) => conversation.id === connection.channelId)
    : true;
  const list = known
    ? offered
    : [{ id: connection.channelId, name: connection.channelName, direct: false }, ...offered];

  return (
    <Select
      value={connection.channelId || undefined}
      disabled={busy}
      onOpenChange={(open) => open && void read()}
      onValueChange={(id) => {
        const picked = list.find((conversation) => conversation.id === id);
        if (picked) onPick(picked);
      }}
    >
      {/* The name is drawn here rather than by `SelectValue`, which reads it off the item
          that is selected: the list is only fetched when the picker is opened, so until then
          there is no item to read and the trigger would say "pick one" over a destination
          that is already set. */}
      <SelectTrigger
        aria-label={c.postsTo}
        className={`h-8 w-auto max-w-[24ch] rounded-[8px] py-0 text-[12px] font-[700] ${
          connection.channelName ? "" : "text-nb-ink-soft/60"
        }`}
      >
        <span className="truncate">{connection.channelName || c.pickChannel}</span>
      </SelectTrigger>
      <SelectContent>
        {list.length === 0 ? (
          <p className="px-2 py-1.5 text-[11.5px] leading-[16px] text-nb-ink-soft">
            {reading ? c.loadingChannels : c.noChannels}
          </p>
        ) : (
          list.map((conversation) => (
            <SelectItem key={conversation.id} value={conversation.id} className="text-[12px]">
              {conversation.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// --- this board's own tier (#319) ---------------------------------------------
// Signed in means on: a board raises its events the moment this machine has an account, so
// there is nothing to switch here — only which open release it watches, since a `ready` task
// in another release, or promised to none, is not what the user asked to be told about.
//
// A caption carries the scope that a paragraph used to. Rules too old to answer draw no
// caption either: an empty heading reads worse than nothing.

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

  if (!state?.enabled) return null;

  return (
    <div>
      <p className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">
        {c.title}
      </p>

      <div className="mt-2 rounded-[10px] border border-nb-ink/12 px-4 py-3.5">
        {/* How wide this board watches. `All` is always there — it needs no release to exist —
            so the only empty answer left is a board resting on a release that closed, which
            shows the placeholder and the same prompt the rail gives where the filling stopped. */}
        <div className="flex items-center gap-2.5">
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

        {/* Which machine runs this board's work (#318). */}
        <ServerRow state={state} busy={busy} onMove={move} />

        {error && (
          <p className="mt-2 text-[11.5px] leading-[16px] text-nb-peach-ink" role="status">
            {error}
          </p>
        )}
      </div>
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

      {/* What that machine runs the board's runtimes as (#345). A board that names no
          runtimes reports none, and this whole block is then absent. */}
      {server.runtimes.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] font-[700] uppercase tracking-[0.06em] text-nb-ink-soft">{c.runsAs}</p>
          <ul className="mt-1 space-y-[2px]">
            {server.runtimes.map((runtime) => (
              <li
                key={runtime.name}
                className="flex items-baseline gap-2 font-mono text-[11.5px] leading-[17px]"
              >
                <span className="w-[104px] shrink-0 truncate font-[700] text-nb-ink">{runtime.name}</span>
                <span className="min-w-0 flex-1 truncate text-nb-ink-soft">
                  {runtime.model ? `${runtime.harness}, ${runtime.model}` : runtime.harness}
                </span>
                {runtime.fallback && <span className="shrink-0 text-nb-ink-soft">{c.notBound}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
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

      <div className="rounded-[10px] border border-nb-ink/12 bg-nb-paper px-4 py-3.5">
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
            className={`h-9 min-w-0 flex-1 rounded-[9px] border bg-nb-paper px-3 font-mono text-[13px] font-[700] tracking-[0.06em] text-nb-ink outline-none placeholder:font-[500] placeholder:tracking-normal placeholder:text-nb-ink-soft/50 ${
              refusal ? "border-nb-peach-ink" : "border-nb-ink/25"
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
