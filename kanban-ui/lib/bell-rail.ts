import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import {
  notificationCenterAction,
  openNotificationAction,
  readAllNotificationsAction,
} from "@/app/actions";
import type { NotificationAlert, NotificationCenter } from "./notifications";

// The bell's own state (#319): whether the rail is up, how wide it is, and the events it is
// showing.
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

/** What the rail opens at: wide enough for two lines of a card title, narrow enough to
 *  leave the board the screen. Deliberately the chat rail's own range, since they share the
 *  right side and a user who widened one meant "this side is this wide". */
export const BELL_W = 292;
export const BELL_MIN = 248;
export const BELL_MAX = 480;

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
  namesBoards: false,
  rows: [],
  unread: 0,
  alerts: [],
};

export interface BellRail {
  open: boolean;
  toggle(): void;
  fold(): void;
  /** The window is too narrow for the rail to stand beside the board, so it covers it. */
  overlay: boolean;
  center: NotificationCenter;
  /** Open a row: mark it read, and go to that card — switching the app to that board first
   *  when the row belongs to another one. */
  openRow(eventId: string): Promise<void>;
  /** Mark every row read at once. The rows stay; only the count empties. */
  readAll(): Promise<void>;
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
  const overlay = useMatches(OVERLAY_UNDER);
  const { panel, onLayoutChanged, onDoubleClick } = useWidth();
  const kickRef = useRef<() => void>(() => {});
  // Held in a ref so the poll below never restarts when the app's handler changes identity.
  const alertsRef = useRef(onAlerts);
  alertsRef.current = onAlerts;

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
        // Handed out once. Nothing is raised later to make up for a window that was focused
        // when one arrived — that is the whole of the second interruption's rule.
        if (next.alerts.length > 0) alertsRef.current?.(next.alerts);
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
      onOpenCard(where.taskId);
    },
    [onOpenCard, projectRoot],
  );

  // The click empties the count here first: the marks are written on the machine and the
  // next poll is up to 2.5s away, which is long enough to look like the button missed.
  const readAll = useCallback(async () => {
    setCenter((was) => ({ ...was, rows: was.rows.map((r) => ({ ...r, unread: false })), unread: 0 }));
    await readAllNotificationsAction();
    kickRef.current();
  }, []);

  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
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
    try {
      window.localStorage.setItem(OPEN_KEY, "0");
    } catch {
      // storage unavailable
    }
  }, []);

  return {
    open,
    toggle,
    fold,
    overlay,
    center,
    openRow,
    readAll,
    refresh: () => kickRef.current(),
    panel,
    onLayoutChanged,
    onDoubleClick,
  };
}

// --- switching the app to another board --------------------------------------
// A row can name a board this window is not showing. Opening it switches the app to that
// project and lands on the card, which is the one click the bell costs.

interface AppBridge {
  openProject(dir: string): Promise<string | null>;
}

function bridge(): AppBridge | null {
  if (typeof window === "undefined") return null;
  const app = (window as { ai4kanban?: Partial<AppBridge> }).ai4kanban;
  return app?.openProject ? (app as AppBridge) : null;
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

/** A media query, as a boolean that follows the window. */
function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const read = () => setMatches(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [query]);
  return matches;
}
