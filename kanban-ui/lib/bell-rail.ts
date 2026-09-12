import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import {
  getBoardsAction,
  notificationCenterAction,
  openNotificationAction,
  readAllNotificationsAction,
} from "@/app/actions";
import { CHAT_MAX, CHAT_MIN, CHAT_W } from "./chat-rail";
import { useMatches } from "./media";
import type { NotificationAlert, NotificationCenter, WatchFill } from "./notifications";
import { notificationGroup, type CloudEventState, type NotificationGroup } from "./types";

// The bell's own state (#319): whether the rail is up, how wide it is, and the events it is
// showing — this board's, which is what the rules hand back.
//
// It sits in the window for the same two reasons the chat rail's does — the button is in
// the top row and the rail is down the right — with one more of its own: the right side
// holds ONE rail at a time, so opening this one folds the chat and the other way round.
// Something above both has to know that, and the window is what does.
//
// What is kept in the browser is how the user likes the rail. What is on it is not: the
// events are Cloud's, read through the board server, and the read marks are held on the
// machine so the bell agrees with itself in every window.

const OPEN_KEY = "kanban-ui.bell-open";
const WIDTH_KEY = "kanban-ui.bell-width";

/** What the rail opens at: wide enough for a card title on one line, narrow enough to leave
 *  the board the screen. The chat rail's range exactly (lib/chat-rail.ts), since they share
 *  the right side and a rail that changes width as you switch between them reads as a jump. */
export const BELL_W = CHAT_W;
export const BELL_MIN = CHAT_MIN;
export const BELL_MAX = CHAT_MAX;

/** Under this the window cannot hold the board between two rails, so the bell covers it. */
const OVERLAY_UNDER = "(width < 60rem)";

/** How often the center is re-read. Slower than the chat's, because nothing here is being
 *  typed: an event arrives on its own schedule and a second either way is not news. */
const OPEN_MS = 2_500;
const FOLDED_MS = 6_000;

/** The blank the bell draws until its first read lands. */
const NOTHING: NotificationCenter = {
  signedIn: false,
  enabled: false,
  boardId: "",
  release: "",
  silenced: false,
  rows: [],
  unread: 0,
  alerts: [],
};

export interface BellRail {
  open: boolean;
  /** The first read has landed. Until it does, nothing below is the account's answer — the
   *  blank says "not signed in" because that is what a blank says, and the rail draws that
   *  it is still looking rather than a state it has not been told. */
  ready: boolean;
  toggle(): void;
  fold(): void;
  /** Open it, wherever it stood — what the Dock badge's click asks for (#483). */
  unfold(): void;
  /** The window is too narrow for the rail to stand beside the board, so it covers it. */
  overlay: boolean;
  center: NotificationCenter;
  /** The scope change that filled the bell (#451), until the rail is folded. The server
   *  hands it out once, so it is held here — the switch is usually made with the rail down,
   *  and the line has to be there when it is opened. */
  filled: WatchFill | null;
  /** Open a row: mark it read, and go to that card. Also what a clicked system notification
   *  lands on, and those DO come from other boards — so it switches the app first when the
   *  event is not this board's. */
  openRow(eventId: string): Promise<void>;
  /** Mark one tab's rows read at once, or every tab's when no group is named. The rows stay;
   *  only the count empties. */
  readAll(group?: NotificationGroup): Promise<void>;
  /** Force a read now, rather than waiting out the tick already running. */
  refresh(): void;
  panel: ReturnType<typeof usePanelRef>;
  onLayoutChanged(layout: Layout, meta: LayoutChangedMeta): void;
  onDoubleClick(): void;
}

export function useBellRail({
  /** The project this window is showing, so a row that names another board is known for
   *  one and switches the app to it. */
  projectRoot,
  /** Called with the alerts the server handed out, so the app can raise them. Absent
   *  outside the desktop app, where there is nothing to raise. */
  onAlerts,
  /** Go to a card on this board. */
  onOpenCard,
}: {
  projectRoot: string;
  onAlerts?(alerts: NotificationAlert[]): void;
  onOpenCard(taskId: number): void;
}): BellRail {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<NotificationCenter>(NOTHING);
  const [ready, setReady] = useState(false);
  const [filled, setFilled] = useState<WatchFill | null>(null);
  const overlay = useMatches(OVERLAY_UNDER);
  const { panel, onLayoutChanged, onDoubleClick } = useWidth();
  const kickRef = useRef<() => void>(() => {});
  // Which board of the project this window is showing (#407). Read once after mount rather
  // than threaded down as a prop: it is one string, the same on every screen of a window.
  const boardRef = useRef<string | null>(null);
  // Held in a ref so the poll below never restarts when the app's handler changes identity.
  const alertsRef = useRef(onAlerts);
  alertsRef.current = onAlerts;

  useEffect(() => {
    let live = true;
    void getBoardsAction()
      .then((answer) => live && (boardRef.current = answer.board))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // The fold, remembered across reloads. Read after mount for the usual reason —
  // localStorage is client-only, and reading it during the first render desyncs hydration.
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      // storage unavailable — the bell opens folded, which is how it opens anyway
    }
  }, []);

  // The one read every screen makes. It is also what opens the account's Realtime
  // connection on the server, so the poll is what keeps the bell live rather than a
  // second thing to start.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = async () => {
      let next: NotificationCenter | null = null;
      try {
        next = await notificationCenterAction();
      } catch {
        // A read that failed is a read the next tick makes again. The rows on screen stay
        // where they are: they are the last thing that was true, which beats emptying the
        // bell over one bad second.
      }
      if (!alive) return;
      if (next) {
        setCenter(next);
        setReady(true);
        // Handed out once. Nothing is raised later to make up for a window that was focused
        // when one arrived — that is the whole of the second interruption's rule.
        if (next.alerts.length > 0) alertsRef.current?.(next.alerts);
        // Handed out once too, and held until the rail is folded: the switch is made in
        // Configuration, so the bell is usually down when the line arrives.
        if (next.filled) setFilled(next.filled);
      }
      timer = setTimeout(() => void read(), open ? OPEN_MS : FOLDED_MS);
    };
    kickRef.current = () => {
      if (timer) clearTimeout(timer);
      void read();
    };
    void read();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [open]);

  const openRow = useCallback(
    async (eventId: string) => {
      const where = await openNotificationAction(eventId);
      kickRef.current();
      // A board no longer on this machine has nowhere to go. The row is marked read and
      // stays put, saying so, rather than opening whatever card wears that number on the
      // board in front of the user — the checkout can come back.
      if (!where?.boardPath) return;
      if (!samePath(where.boardPath, projectRoot)) {
        await switchProject(where.boardPath, where.taskId);
        return;
      }
      // The same project can hold a second board (#407), and #12 there is not #12 here.
      const open = boardRef.current;
      if (where.boardDir && open && !samePath(where.boardDir, open)) {
        await switchBoard(where.boardDir);
        return;
      }
      onOpenCard(where.taskId);
    },
    [onOpenCard, projectRoot],
  );

  // The click empties the count here first: the marks are written on the machine and the
  // next poll is up to 2.5s away, which is long enough to look like the button missed.
  const readAll = useCallback(async (group?: NotificationGroup) => {
    setCenter((was) => {
      const tabOf = (r: { state: string }) => notificationGroup(r.state as CloudEventState);
      const rows = was.rows.map((r) => (!group || tabOf(r) === group ? { ...r, unread: false } : r));
      // The bell counts `todo` alone, so emptying the landed tab leaves the number where it is.
      return { ...was, rows, unread: rows.filter((r) => r.unread && tabOf(r) === "todo").length };
    });
    await readAllNotificationsAction(group);
    kickRef.current();
  }, []);

  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      // Folding is reading it: the line said why those rows arrived quietly, and they are
      // still there to look at.
      if (!next) setFilled(null);
      try {
        window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable — the fold lasts as long as the window does
      }
      return next;
    });
  }, []);

  const fold = useCallback(() => {
    setOpen(false);
    setFilled(null);
    try {
      window.localStorage.setItem(OPEN_KEY, "0");
    } catch {
      // storage unavailable
    }
  }, []);

  const unfold = useCallback(() => {
    setOpen(true);
    try {
      window.localStorage.setItem(OPEN_KEY, "1");
    } catch {
      // storage unavailable — the rail stays up as long as the window does
    }
  }, []);

  return {
    open,
    ready,
    toggle,
    fold,
    unfold,
    overlay,
    center,
    filled,
    openRow,
    readAll,
    refresh: () => kickRef.current(),
    panel,
    onLayoutChanged,
    onDoubleClick,
  };
}

// --- switching the app to another board --------------------------------------
// The rail is this board's, but a system notification is not: it comes from whichever board
// raised it. Clicking one switches the app to that project and lands on the card.

interface AppBridge {
  openProject(dir: string): Promise<string | null>;
  openBoard?(dir: string): Promise<string | null>;
}

function bridge(): AppBridge | null {
  if (typeof window === "undefined") return null;
  const app = (window as { ai4kanban?: Partial<AppBridge> }).ai4kanban;
  return app?.openProject ? (app as AppBridge) : null;
}

/** Put another board of the project already open in front — the window already on it, or
 *  this one when none is (#495). In a browser there is no app to hand it over to, and the
 *  row does nothing rather than opening the wrong board's card of that number.
 *
 *  Exported for the card link a message carries, which lands on the same board as a bell
 *  row that names one (#320) — one move, not two that look alike. */
export async function switchBoard(boardDir: string): Promise<void> {
  await bridge()?.openBoard?.(boardDir);
}

/** Two paths naming one folder. A board's path is written down as the machine resolved it,
 *  so this is a comparison rather than a resolution. */
export const samePath = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/** Open another project and land on the card. The card to open travels in the address the
 *  new server is asked for, because the window is about to be pointed at a different one.
 *
 *  Exported because the card link a Slack message carries lands in exactly the same place
 *  as a bell row that names another board (#320) — one move, not two that look alike. */
export async function switchProject(boardPath: string, taskId: number): Promise<void> {
  const app = bridge();
  if (!app) return;
  const url = await app.openProject(boardPath);
  if (!url) return;
  window.location.href = `${url.replace(/\/+$/, "")}/${taskId}`;
}

// --- the shared bits ----------------------------------------------------------

function useWidth() {
  const panel = usePanelRef();
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(WIDTH_KEY));
    } catch {
      // storage unavailable — open at the default
    }
    if (saved > 0) panel.current?.resize(saved);
  }, [panel]);

  const onLayoutChanged = useCallback(
    (_layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      requestAnimationFrame(() => {
        const px = panel.current?.getSize().inPixels;
        if (px) save(px);
      });
    },
    [panel],
  );

  return { panel, onLayoutChanged, onDoubleClick: useCallback(() => save(BELL_W), []) };
}

function save(px: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(px)));
  } catch {
    // storage unavailable — the width lasts as long as the window does
  }
}

