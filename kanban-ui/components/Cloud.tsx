"use client";

// Notifications — where a card that needs you reaches you, and the account it reaches you
// through (#326). Named for the job in the nav; Cloud is the plumbing, and is said in the
// sentences rather than on the tab.
//
// Three captioned groups, the same shape General is built from (components/settings.tsx):
// **Account** — who this machine acts as, and the silencing switch that holds for every
// board on it. **Where it posts** — one row per chat. **This board** — the release it
// watches and the machine that runs its work. One row is one decision, so the sign-in, a
// connection and a switch all read off the same left edge.
//
// The sign-in is not a board setting: one sign-in covers every project the app has open and
// every terminal on the machine, and it is held outside every repository. That is what the
// note under the first group says.
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
// of them here would be a second thing to keep true. The not-admitted state keeps the same
// account row and adds one asking row (#327): approving is the whole of getting in (#350),
// so there is one ask here and nothing to paste back.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FiBell, FiBellOff, FiLogOut, FiMail } from "react-icons/fi";
import { SiGithub } from "react-icons/si";
import {
  boardNotificationsAction,
  cloudAccountAction,
  disconnectLarkAction,
  disconnectSlackAction,
  setBoardServerAction,
  finishCloudSignInAction,
  notificationCenterAction,
  requestCloudInviteAction,
  setSilencedAction,
  larkChatsAction,
  larkStateAction,
  setLarkChatAction,
  setSlackChannelAction,
  signOutOfCloudAction,
  slackConversationsAction,
  slackStateAction,
  startCloudSignInAction,
  startLarkConnectAction,
  startSlackConnectAction,
  watchReleaseAction,
} from "@/app/actions";
import { useLanguage } from "@/components/language";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { BoardNotifications } from "@/lib/notifications";
import {
  ALL_RELEASES,
  LANGUAGE_TAGS,
  type CloudAccount,
  type Language,
  type LarkChat,
  type LarkCloud,
  type LarkState,
  type SlackConversation,
  type SlackState,
} from "@/lib/types";
import { LarkMark, SlackMark } from "./brands";
import { Button } from "./button";
import {
  Alert,
  CAPTION,
  Group,
  Loading,
  MARK,
  Note,
  Panel,
  QUIET_BTN,
  Row,
  Status,
  Switch,
} from "./settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** The published pages the terms say signing in confirms you have read. */
const PRIVACY_URL = "https://ai4kanban.dev/privacy";
const TERMS_URL = "https://ai4kanban.dev/terms";

/** The answers this pane takes off the app's URL scheme: a finished sign-in, and a finished
 *  connection to either chat. The card link is the window's and arrives elsewhere (#320). */
const SIGNED_IN = "ai4kanban://cloud/signed-in";
const SLACK_CONNECTED = "ai4kanban://cloud/slack-connected";
const LARK_CONNECTED = "ai4kanban://cloud/lark-connected";

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
  // Bumped when a finished connection comes back on the scheme, so that connector's row
  // re-reads what the service now holds. One counter each: the two rows are answered
  // separately, and a shared one would redraw the row nobody was waiting on.
  const [slackTick, setSlackTick] = useState(0);
  const [larkTick, setLarkTick] = useState(0);
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
      if (url.startsWith(LARK_CONNECTED)) {
        setLarkTick((n) => n + 1);
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
    <div className="flex flex-col gap-6">
      {!account ? (
        <Loading>{c.checking}</Loading>
      ) : account.state === "signed-in" ? (
        <SignedIn
          account={account}
          busy={busy}
          inApp={inApp}
          slackTick={slackTick}
          larkTick={larkTick}
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

      {account?.error && <Alert>{c.unreachable(account.error)}</Alert>}
    </div>
  );
}

// --- signed in and admitted ---------------------------------------------------

function SignedIn({
  account,
  busy,
  inApp,
  slackTick,
  larkTick,
  onError,
  onSignOut,
}: {
  account: CloudAccount;
  busy: boolean;
  /** Connecting a chat needs the app for the same reason signing in does: the consent
   *  screen comes back on a URL scheme only the app answers. */
  inApp: boolean;
  /** Bumped when a finished connection came back on that scheme. */
  slackTick: number;
  larkTick: number;
  onError?: (msg: string) => void;
  onSignOut: () => void;
}) {
  const c = useCopy().configuration.cloud;
  return (
    <>
      <Group title={c.account}>
        <Panel>
          <AccountRow account={account} busy={busy} onSignOut={onSignOut} />
          <Silencer />
        </Panel>
        {/* One sign-in covers every project on this machine — said under the card, because
            it is a fact about the row above rather than something to change. */}
        <Note>{c.blurb}</Note>
      </Group>

      <Group title={c.wherePosts}>
        <Panel>
          <Slack inApp={inApp} reload={slackTick} onError={onError} />
          <Lark inApp={inApp} reload={larkTick} onError={onError} />
        </Panel>
      </Group>

      <Notifications />
    </>
  );
}

/** Who this machine acts as. The same row whether or not the account is admitted, so the
 *  two states differ only in what is under it. */
function AccountRow({
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
    <Row
      icon={<Avatar account={account} />}
      label={
        <span className="flex items-center gap-2">
          {account.name || account.handle || c.signedIn}
          <SiGithub className="shrink-0 text-nb-ink-soft" size={13} aria-label="GitHub" />
        </span>
      }
      hint={
        account.handle && (
          <span className="font-mono text-[11.5px] font-[700] text-nb-ink">@{account.handle}</span>
        )
      }
    >
      <button type="button" className={QUIET_BTN} disabled={busy} onClick={onSignOut}>
        <FiLogOut size={13} aria-hidden />
        {c.signOut}
      </button>
    </Row>
  );
}

// --- the machine's one silencing switch (#319) --------------------------------
// In the account's group rather than the board's: what it stops arrives from every board,
// and the bell keeps filling either way.

function Silencer() {
  const c = useCopy().configuration.cloud;
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    void notificationCenterAction().then((center) => setOn(center.silenced));
  }, []);

  // Flipped on screen before it is written, and put back only if the write refused: the
  // switch is the whole of the feedback, so one that waits reads as one that missed the press.
  const flip = async (next: boolean) => {
    setOn(next);
    const done = await setSilencedAction(next);
    if (!done.ok) setOn(!next);
  };

  return (
    <Row
      icon={
        <span className="text-nb-ink-soft">
          {on ? <FiBellOff size={MARK} aria-hidden /> : <FiBell size={MARK} aria-hidden />}
        </span>
      }
      label={c.silence.title}
      hint={c.silence.blurb}
    >
      <Switch on={on} label={c.silence.title} onFlip={flip} />
    </Row>
  );
}

// --- the row both chats wear -------------------------------------------------
// Slack and Lark differ in what they call things and in which service answers; the row is
// one shape — the settings kit's, with the platform's mark at its left edge. The platform
// and the way in or out on the row's own line, what to do or what went wrong as its hint,
// and — once connected — where it posts under it.

function Connector({
  mark,
  title,
  aside,
  blurb,
  action,
  note,
  children,
}: {
  mark: ReactNode;
  title: string;
  /** Beside the title in soft ink — who connected it. */
  aside?: string | null;
  /** What to do next, or the service's own words about why there is nothing to do. */
  blurb?: string | null;
  /** The way in or out, at the end of the title's line. */
  action?: ReactNode;
  /** A refusal, under everything else. */
  note?: ReactNode;
  /** Where it posts, once there is a connection. */
  children?: ReactNode;
}) {
  return (
    <Row
      icon={mark}
      label={
        <span className="flex items-baseline gap-2">
          {title}
          {aside && (
            <span className="truncate text-[12px] font-[600] text-nb-ink-soft">{aside}</span>
          )}
        </span>
      }
      hint={blurb}
      below={
        (children || note) && (
          <>
            {children}
            {note}
          </>
        )
      }
    >
      {action}
    </Row>
  );
}

/** Where a connected chat posts, read as one sentence: label, picker, then where that
 *  destination lives. One row for both. */
function PostsTo({ label, picker, after }: { label: string; picker: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-[13px] font-[700] text-nb-ink">{label}</span>
      {picker}
      {after && (
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5 truncate text-[13px] text-nb-ink-soft">
          {after}
        </span>
      )}
    </div>
  );
}

/** The destination picker, for both. The service is asked only when the list is opened: a
 *  pane that read every channel each time it was drawn would spend a call on somebody who
 *  came to read the sign-in. */
function Picker<T extends { id: string; name: string }>({
  label,
  id,
  name,
  fallback,
  busy,
  placeholder,
  loading,
  empty,
  read,
  onPick,
}: {
  label: string;
  /** What it posts to now — the pick not yet written, or what the connection holds. */
  id: string;
  name: string;
  /** That same destination as an option, for a list the service has not answered yet. */
  fallback: T;
  busy: boolean;
  placeholder: string;
  loading: string;
  empty: string;
  read: () => Promise<T[]>;
  onPick: (one: T) => void;
}) {
  const [options, setOptions] = useState<T[] | null>(null);
  const [reading, setReading] = useState(false);

  const ask = async () => {
    if (options || reading) return;
    setReading(true);
    try {
      setOptions(await read());
    } finally {
      setReading(false);
    }
  };

  // The one it already posts to is always in the list, whether or not the service answered:
  // the picker must show where messages go even when the workspace cannot be read this second.
  const offered = options ?? [];
  const list = !id || offered.some((one) => one.id === id) ? offered : [fallback, ...offered];

  return (
    <Select
      value={id || undefined}
      disabled={busy}
      onOpenChange={(open) => open && void ask()}
      onValueChange={(picked) => {
        const one = list.find((option) => option.id === picked);
        if (one) onPick(one);
      }}
    >
      {/* The name is drawn here rather than by `SelectValue`, which reads it off the item
          that is selected: the list is only fetched when the picker is opened, so until then
          there is no item to read and the trigger would say "pick one" over a destination
          that is already set. */}
      <SelectTrigger
        aria-label={label}
        className={`h-8 w-auto max-w-[24ch] rounded-[8px] py-0 text-[13px] font-[700] ${
          name ? "" : "text-nb-ink-soft/60"
        }`}
      >
        <span className="truncate">{name || placeholder}</span>
      </SelectTrigger>
      <SelectContent>
        {list.length === 0 ? (
          <p className="px-2 py-1.5 text-[12.5px] leading-[18px] text-nb-ink-soft">
            {reading ? loading : empty}
          </p>
        ) : (
          list.map((one) => (
            <SelectItem key={one.id} value={one.id} className="text-[13px]">
              {one.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// --- the account's one Slack destination (#320) -------------------------------
// One destination for the ACCOUNT, so it sits in the tier above the board's: every board
// posts to it with its own name on each message.
//
// Not connected, the band is the platform and a button. Connected, it is one line saying where
// it posts — the conversation and the workspace it is in — and the way out; and when Slack has
// refused us, the band says so
// here, where the connection was made, since messages failing into silence read as no work
// waiting.

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
  const saving = useCopy().configuration.cloud.saving;
  const [state, setState] = useState<SlackState | null>(null);
  const [working, setWorking] = useState<"connect" | "save" | "disconnect" | null>(null);
  const [waiting, setWaiting] = useState(false);
  // The conversation just picked, drawn until Cloud has answered — the save is a round trip
  // to the service, and a picker that keeps showing the old room reads as one that refused.
  const [picked, setPicked] = useState<SlackConversation | null>(null);

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
      setPicked(null);
      setWorking(null);
    }
  };

  if (!state) {
    return <Connector mark={<SlackMark size={MARK} />} title={c.title} blurb={c.checking} />;
  }

  const { connection } = state;
  const busy = working !== null;

  if (!connection) {
    return (
      <Connector
        mark={<SlackMark size={MARK} />}
        title={c.title}
        // Cloud's own words first. A service that could not be reached answers no connection
        // and no app either, and reading that as "this service carries no Slack app" would
        // tell the user to change something that is not wrong.
        blurb={
          state.error
            ? state.error
            : !state.configured
              ? c.unavailable
              : !inApp
                ? c.needsApp
                : waiting
                  ? c.waiting
                  : c.blurb
        }
        action={
          state.configured &&
          inApp && (
            <Button size="sm" disabled={busy} onClick={() => void connect()}>
              {working === "connect" ? c.connecting : c.connect}
            </Button>
          )
        }
      />
    );
  }

  const shown = picked ?? {
    id: connection.channelId,
    name: connection.channelName,
    direct: false,
  };

  return (
    <Connector
      mark={<SlackMark size={MARK} />}
      title={c.title}
      action={
        <button
          type="button"
          className={QUIET_BTN}
          disabled={busy}
          onClick={() => void move("disconnect", disconnectSlackAction)}
        >
          {working === "disconnect" ? c.disconnecting : c.disconnect}
        </button>
      }
      note={connection.revoked && <Alert title={c.refused}>{connection.lastError}</Alert>}
    >
      <PostsTo
        label={c.postsTo}
        // The workspace belongs to the destination, not to the platform: read together they
        // say the whole address in one line, the two names carrying it in strong ink.
        after={
          working === "save" ? (
            saving
          ) : (
            <>
              {c.inWorkspace.before}
              <span className="truncate font-[700] text-nb-ink">{connection.teamName}</span>
              {c.inWorkspace.after}
            </>
          )
        }
        picker={
          <Picker
            label={c.postsTo}
            id={shown.id}
            name={shown.name}
            fallback={shown}
            busy={busy}
            placeholder={c.pickChannel}
            loading={c.loadingChannels}
            empty={c.noChannels}
            read={async () => {
              const answer = await slackConversationsAction();
              return answer.ok ? answer.conversations : [];
            }}
            onPick={(conversation) => {
              setPicked(conversation);
              void move("save", () => setSlackChannelAction(conversation.id, conversation.name));
            }}
          />
        }
      />
    </Connector>
  );
}

// Nothing to connect to until the app is published, so the band offers no way in (#361).
// Flip this back to false once it is.
const LARK_COMING_SOON = true;

// --- the account's one Lark destination (#351) --------------------------------
// Beside Slack rather than instead of it: an account may have both connected, and the first
// press settles the event.
//
// Before connecting it is one line and one button per cloud, because 飞书 and Lark
// international are two platforms and only the person knows which they are in. The line is
// the one thing that stops a connection finishing — an administrator installs the app in the
// organisation first, and that happens in Lark rather than here. Connected, it is the platform,
// who connected it, the chat it posts to and the way out — the cloud is named only where it
// matters, on the two connect buttons and in a refusal.

function Lark({
  inApp,
  reload,
  onError,
}: {
  inApp: boolean;
  reload: number;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.cloud.lark;
  const saving = useCopy().configuration.cloud.saving;
  const [state, setState] = useState<LarkState | null>(null);
  const [working, setWorking] = useState<"connect" | "save" | "disconnect" | null>(null);
  // Which cloud is being connected. Two buttons stand here, and one that said "Connecting…"
  // on both would name the wrong platform to whoever pressed the other.
  const [connecting, setConnecting] = useState<LarkCloud | null>(null);
  const [waiting, setWaiting] = useState(false);
  // The chat just picked, drawn until Cloud has answered — the save is a round trip to the
  // service, and a picker that keeps showing the old group reads as one that refused.
  const [picked, setPicked] = useState<LarkChat | null>(null);

  const load = useCallback(async () => setState(await larkStateAction()), []);
  useEffect(() => {
    void load();
  }, [load, reload]);
  // A connection that came back on the scheme is one this pane was waiting for.
  useEffect(() => {
    if (reload > 0) setWaiting(false);
  }, [reload]);

  const connect = async (cloud: LarkCloud) => {
    const app = bridge();
    if (!app || working) return;
    setWorking("connect");
    setConnecting(cloud);
    try {
      const start = await startLarkConnectAction(cloud);
      if (!start.ok) return onError?.(start.error || c.connectFailed);
      await app.openExternal(start.url);
      setWaiting(true);
    } finally {
      setConnecting(null);
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
      setPicked(null);
      setWorking(null);
    }
  };

  if (!state) {
    return <Connector mark={<LarkMark size={MARK} />} title={c.title} blurb={c.checking} />;
  }

  const { connection } = state;
  const offered = state.clouds.filter((one) => one.configured);
  const busy = working !== null;

  if (!connection) {
    if (LARK_COMING_SOON) {
      // On the title's line, where the way in would be: one line for a band with nothing to do.
      return (
        <Connector
          mark={<LarkMark size={MARK} />}
          title={c.title}
          action={
            <span className="shrink-0 text-[12.5px] font-[600] text-nb-ink-soft">
              {c.comingSoon}
            </span>
          }
        />
      );
    }
    return (
      <Connector
        mark={<LarkMark size={MARK} />}
        title={c.title}
        // Cloud's own words first. A service that could not be reached answers no connection
        // and no cloud either, and reading that as "this service carries no Lark app" would
        // tell the user to change something that is not wrong.
        blurb={
          state.error
            ? state.error
            : offered.length === 0
              ? c.unavailable
              : !inApp
                ? c.needsApp
                : waiting
                  ? c.waiting
                  : c.install
        }
        action={
          inApp &&
          offered.map((one) => (
            <Button key={one.cloud} size="sm" disabled={busy} onClick={() => void connect(one.cloud)}>
              {connecting === one.cloud ? c.connecting : c.connect(one.name)}
            </Button>
          ))
        }
      />
    );
  }

  const shown = picked ?? {
    id: connection.destinationId,
    name: connection.destinationName,
    direct: connection.direct,
  };

  return (
    <Connector
      mark={<LarkMark size={MARK} />}
      title={c.title}
      aside={connection.userName && c.connectedBy(connection.userName)}
      action={
        <button
          type="button"
          className={QUIET_BTN}
          disabled={busy}
          onClick={() => void move("disconnect", disconnectLarkAction)}
        >
          {working === "disconnect" ? c.disconnecting : c.disconnect}
        </button>
      }
      note={
        connection.revoked && (
          <Alert title={c.refused(connection.cloudName)}>{connection.lastError}</Alert>
        )
      }
    >
      <PostsTo
        label={c.postsTo}
        after={working === "save" ? saving : undefined}
        picker={
          <Picker
            label={c.postsTo}
            id={shown.id}
            name={shown.name}
            fallback={shown}
            busy={busy}
            placeholder={c.pickChat}
            loading={c.loadingChats}
            empty={c.noChats}
            read={async () => {
              const answer = await larkChatsAction();
              return answer.ok ? answer.chats : [];
            }}
            onPick={(chat) => {
              setPicked(chat);
              void move("save", () => setLarkChatAction(chat));
            }}
          />
        }
      />
    </Connector>
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
  const saving = useCopy().configuration.cloud.saving;
  const [state, setState] = useState<BoardNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What was just picked, drawn before the board has answered. A write here reaches a file
  // and then Cloud, which is long enough that a control redrawn only on the answer reads as
  // a control that did not take the press. Cleared once the board has been re-read, so what
  // is on screen after a refusal is what the board actually holds.
  const [pending, setPending] = useState<Partial<Pick<BoardNotifications, "release">> & { here?: boolean }>({});
  const busy = Object.keys(pending).length > 0;

  const load = useCallback(async () => setState(await boardNotificationsAction()), []);
  useEffect(() => {
    void load();
  }, [load]);

  const move = async (
    shown: { release: string } | { here: boolean },
    run: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    if (busy) return;
    setPending(shown);
    setError(null);
    try {
      const done = await run();
      if (!done.ok) setError(done.error ?? c.saveFailed);
      await load();
    } finally {
      setPending({});
    }
  };

  if (!state?.enabled) return null;

  const release = pending.release ?? state.release;

  return (
    <Group title={c.title}>
      <Panel>
        {/* How wide this board watches. `All` is always there — it needs no release to exist —
            so the only empty answer left is a board resting on a release that closed, which
            shows the placeholder and the same prompt the rail gives where the filling stopped. */}
        <Row
          label={c.watching}
          hint={
            pending.release !== undefined
              ? saving
              : release === ALL_RELEASES
                ? c.anyRelease
                : release
                  ? c.onlyThisRelease
                  : c.releaseClosed
          }
        >
          <Select
            value={release || undefined}
            disabled={busy}
            onValueChange={(picked) => void move({ release: picked }, () => watchReleaseAction(picked))}
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
              {state.releases.map((option) => (
                <SelectItem key={option} value={option} className="font-mono text-[12px]">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        {/* Which machine runs this board's work (#318). */}
        <ServerRow state={state} here={pending.here ?? state.server.here} busy={busy} onMove={move} />
      </Panel>

      {error && <Alert>{error}</Alert>}
    </Group>
  );
}

// --- which machine runs this board's work (#318) ------------------------------
// A board attaches exactly one server, so this is a switch and — where another machine holds
// the board — the one move that takes it over. The refusal is never shown on its own: the
// case that reaches it is a home directory restored onto a new machine, where the machine
// holding the board is exactly the one that has gone.

function ServerRow({
  state,
  here,
  busy,
  onMove,
}: {
  state: BoardNotifications;
  /** The switch's position — what was just pressed until the board answers. */
  here: boolean;
  busy: boolean;
  onMove: (
    shown: { release: string } | { here: boolean },
    run: () => Promise<{ ok: boolean; error?: string }>,
  ) => Promise<void>;
}) {
  const c = useCopy().configuration.cloud.server;
  const { server } = state;
  // Read off the board's own answer rather than the optimistic one: switching this board off
  // would otherwise read for a moment as a board another machine holds, and swap the switch
  // for **Move it here** while the detach was still in flight.
  const elsewhere = server.attached && !server.here;

  return (
    <Row
      label={c.title}
      hint={elsewhere ? <Rich>{c.heldBy(server.machineName)}</Rich> : c.blurb}
      // What that machine runs the board's runtimes as (#345). A board that names no
      // runtimes reports none, and this whole block is then absent.
      below={
        server.runtimes.length > 0 && (
          <>
            <p className={`${CAPTION} text-nb-ink-soft`}>{c.runsAs}</p>
            <ul className="mt-1 space-y-[2px]">
              {server.runtimes.map((runtime) => (
                <li
                  key={runtime.name}
                  className="flex items-baseline gap-2 font-mono text-[11.5px] leading-[17px]"
                >
                  <span className="w-[104px] shrink-0 truncate font-[700] text-nb-ink">
                    {runtime.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-nb-ink-soft">
                    {runtime.model ? `${runtime.harness}, ${runtime.model}` : runtime.harness}
                  </span>
                  {runtime.fallback && (
                    <span className="shrink-0 text-nb-ink-soft">{c.notBound}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      }
    >
      {elsewhere ? (
        <button
          type="button"
          className={QUIET_BTN}
          disabled={busy}
          onClick={() => void onMove({ here: true }, () => setBoardServerAction(true, true))}
        >
          {busy ? c.moving : c.moveHere}
        </button>
      ) : (
        <Switch
          on={here}
          busy={busy}
          onFlip={(next) => onMove({ here: next }, () => setBoardServerAction(next))}
          label={here ? c.switchOn : c.switchOff}
        />
      )}
    </Row>
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
    <Group title={c.account}>
      <Panel>
        {/* One row, whichever end it is: what this state is, and the one way out of it. In a
            browser there is no scheme for the consent screen to come back on, so the row
            says that instead of offering a button that cannot finish. */}
        <Row
          label={expired ? c.expired : c.inviteOnly}
          hint={inApp ? (expired ? c.expiredBody : c.inviteOnlyBody) : c.needsApp}
        >
          {inApp && (
            <>
              {expired && (
                <button type="button" className={QUIET_BTN} disabled={busy} onClick={onSignOut}>
                  <FiLogOut size={13} aria-hidden />
                  {c.signOut}
                </button>
              )}
              <Button size="sm" disabled={busy || !account.configured} onClick={onSignIn}>
                <SiGithub size={14} aria-hidden />
                {expired ? c.signInAgain : c.signIn}
              </Button>
            </>
          )}
        </Row>
      </Panel>

      {waiting && <Note>{c.waiting}</Note>}
      {!account.configured && account.message && <Alert>{account.message}</Alert>}

      {/* What Cloud does and does not do, before the sign-in rather than after it. */}
      <Boundary />
    </Group>
  );
}

// --- signed in and not admitted (#327, #350) ----------------------------------
// One ask: the refusal, the line saying how we answer, and the button. Pressing it re-reads
// the account, so what is drawn next is the service's answer. An approval admits the account
// on our side, so the pane reaches the admitted state the next time it reads.

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
  const language = useLanguage();
  const [working, setWorking] = useState(false);
  const held = busy || working;
  const c = useCopy().configuration.cloud;

  const request = async () => {
    if (held) return;
    setWorking(true);
    try {
      const done = await requestCloudInviteAction();
      if (!done.ok) onError?.(done.error);
      else await onDone();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Group title={c.account}>
      <Panel>
        {/* The same account row the admitted state wears — it already says who is signed in
            and how to stop being — so the two states differ only in the row under it. */}
        <AccountRow account={account} busy={held} onSignOut={onSignOut} />

        <Row
          label={c.notAdmitted}
          hint={
            <>
              {account.message} {c.howWeAnswer}
            </>
          }
        >
          {account.inviteRequestedAt ? (
            <Status ready>{c.asked(asked(account.inviteRequestedAt, c.askedUndated, language))}</Status>
          ) : (
            <Button size="sm" disabled={held} onClick={() => void request()}>
              <FiMail size={13} aria-hidden />
              {working ? c.asking : c.requestInvite}
            </Button>
          )}
        </Row>
      </Panel>
    </Group>
  );
}

/** When the request went in, in the shortest form that still says which day — dated in
 *  the language the app is set to rather than in the browser's own. */
function asked(at: string, undated: string, language: Language): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return undated;
  return when.toLocaleDateString(LANGUAGE_TAGS[language], { month: "short", day: "numeric" });
}

/** What Cloud is for, and what it never receives. Said here because in 0.8.0 this pane is
 *  the only place Cloud is ever offered; #317 extends it to onboarding. */
function Boundary() {
  const c = useCopy().configuration.cloud;
  return (
    <>
      <Note>{c.boundary}</Note>
      <Note>
        {c.terms} <Link href={PRIVACY_URL}>{c.privacyLink}</Link>
        {c.termsAnd}
        <Link href={TERMS_URL}>{c.termsLink}</Link>
        {c.termsEnd}
      </Note>
    </>
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
      className="relative grid size-[26px] shrink-0 place-items-center overflow-hidden rounded-[8px] bg-nb-ink/8 text-[11px] font-[800] text-nb-ink"
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
