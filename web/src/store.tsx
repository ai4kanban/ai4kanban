// What every screen reads: the signed-in account, its workspaces, the current one's projects,
// tasks, chats and triage items, the Runner's state and each task's card. Kept fresh by the event stream.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as api from "./api";
import { T } from "./i18n";
import { readCard, type CardInfo } from "./lib/card";
import { forgetAllBut } from "./lib/chat-images";
import { openStream, type Event } from "./stream";

const WS_KEY = "wildcrane.web.workspace";
const KNOWN_KEY = "wildcrane.web.known.";
const PROJECT_KEY = "wildcrane.web.project";

export interface Store {
  me: api.Me;
  workspaces: api.Workspace[];
  ws: api.Workspace;
  /** The current workspace's projects, `general` first. */
  projects: api.Project[];
  general: api.Project | null;
  /** The workspace's current project, kept in this browser; `general` unless another is picked. */
  current: api.Project | null;
  setCurrent: (id: string) => void;
  tasks: api.Task[] | null;
  chats: api.ChatRow[];
  /** Takes a closed chat off the list. */
  dropChat: (id: string) => void;
  /** The workspace's triage items: every open one, and the pages of sorted ones read so far. */
  triage: api.TriageItem[] | null;
  triageFailed: boolean;
  /** Every page of the last project's history read is in. */
  triageHistoryDone: boolean;
  patchTriage: (item: api.TriageItem) => void;
  /** Reads a project's history from its first page. */
  loadTriageHistory: (project: string) => Promise<void>;
  loadMoreTriageHistory: () => Promise<void>;
  runnerOnline: boolean | null;
  /** The computer the account last connected, null when it never named one. */
  runnerName: string | null;
  failed: string | null;
  setWorkspace: (id: string) => void;
  reloadWorkspaces: () => Promise<api.Workspace[]>;
  reload: () => void;
  patchTask: (task: api.Task) => void;
  cardOf: (task: api.Task) => CardInfo | undefined;
  rawCardOf: (task: api.Task) => api.Card | undefined;
  isNew: (task: api.Task) => boolean;
  markSeen: (task: string) => void;
  onEvent: (fn: (e: Event) => void) => () => void;
  projectName: (id: string | null | undefined) => string | undefined;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

type CardEntry = { version: number | null; raw?: api.Card; info?: CardInfo; loading?: boolean };

export function StoreProvider({ me, workspaces: first, children }: { me: api.Me; workspaces: api.Workspace[]; children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState(first);
  const [wsId, setWsId] = useState(() => {
    const saved = localStorage.getItem(WS_KEY);
    return first.find((w) => w.id === saved)?.id ?? first.find((w) => w.personal)?.id ?? first[0]!.id;
  });
  const ws = workspaces.find((w) => w.id === wsId) ?? workspaces.find((w) => w.personal) ?? workspaces[0]!;
  const [allProjects, setProjects] = useState<api.Project[]>([]);
  const [tasks, setTasks] = useState<api.Task[] | null>(null);
  const [listed, setListed] = useState<string | null>(null);
  const [chats, setChats] = useState<api.ChatRow[]>([]);
  const [triage, setTriage] = useState<api.TriageItem[] | null>(null);
  const [triageFailed, setTriageFailed] = useState(false);
  const [history, setHistory] = useState<{ project: string; next: string | null } | null>(null);
  const [runnerOnline, setRunner] = useState<boolean | null>(null);
  const [runnerName, setRunnerName] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [cards, setCards] = useState<Map<string, CardEntry>>(new Map());
  const [known, setKnown] = useState<Set<string> | null>(null);
  const listeners = useRef(new Set<(e: Event) => void>());

  const setWorkspace = useCallback((id: string) => {
    localStorage.setItem(WS_KEY, id);
    setWsId(id);
  }, []);

  const reloadWorkspaces = useCallback(async () => {
    const list = await api.listWorkspaces();
    setWorkspaces(list);
    return list;
  }, []);

  const loadRunner = useCallback(() => api.readRunner().then((r) => (setRunner(!!r?.connected), setRunnerName(r?.name ?? null)), () => {}), []);
  const loadChats = useCallback(
    () =>
      api.listChats(ws.id).then((p) => {
        setChats(p.data);
        if (p.next === null) void forgetAllBut(ws.id, p.data.flatMap((c) => c.discussion ?? []));
      }, () => {}),
    [ws.id],
  );
  const loadLists = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.listProjects(ws.id), api.listTasks(ws.id)]);
      setProjects(p);
      setTasks(t);
      setListed(ws.id);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof api.ApiError ? e.code : "error");
    }
  }, [ws.id]);

  const mergeTriage = useCallback((items: api.TriageItem[]) => {
    setTriage((was) => {
      const byId = new Map((was ?? []).map((i) => [i.id, i]));
      for (const i of items) byId.set(i.id, i);
      return [...byId.values()];
    });
  }, []);
  const patchTriage = useCallback((item: api.TriageItem) => mergeTriage([item]), [mergeTriage]);
  const loadTriage = useCallback(
    () =>
      api.listTriage(ws.id, "open").then(
        (open) => {
          // Whatever left `open` since keeps its newer copy, or drops out until history is read.
          setTriage((was) => [...open, ...(was ?? []).filter((i) => i.state !== "open" && !open.some((o) => o.id === i.id))]);
          setTriageFailed(false);
        },
        () => setTriageFailed(true),
      ),
    [ws.id],
  );
  const readHistory = useCallback(
    async (project: string, after: string | null) => {
      const page = await api.pageTriageHistory(ws.id, project, after);
      mergeTriage(page.data);
      // A late page of a project left behind does not move the one now read.
      setHistory((was) => (after === null || was?.project === project ? { project, next: page.next } : was));
    },
    [ws.id, mergeTriage],
  );
  const loadTriageHistory = useCallback((project: string) => readHistory(project, null), [readHistory]);
  const loadMoreTriageHistory = useCallback(() => (history?.next ? readHistory(history.project, history.next) : Promise.resolve()), [readHistory, history]);

  const reload = useCallback(() => {
    void loadLists();
    void loadChats();
    void loadRunner();
    void loadTriage();
  }, [loadLists, loadChats, loadRunner, loadTriage]);

  useEffect(() => {
    setTasks(null);
    setListed(null);
    setProjects([]);
    setChats([]);
    setTriage(null);
    setHistory(null);
    reload();
  }, [reload]);

  // Tasks the reader has seen: the ones there at the first visit, and every one opened since.
  useEffect(() => {
    if (!tasks) return;
    const key = KNOWN_KEY + ws.id;
    const saved = localStorage.getItem(key);
    if (saved === null) {
      const all = new Set(tasks.map((t) => t.id));
      localStorage.setItem(key, JSON.stringify([...all]));
      setKnown(all);
    } else setKnown(new Set(JSON.parse(saved) as string[]));
  }, [tasks === null, ws.id]);

  const markSeen = useCallback(
    (id: string) => {
      setKnown((was) => {
        if (!was || was.has(id)) return was;
        const next = new Set(was).add(id);
        localStorage.setItem(KNOWN_KEY + ws.id, JSON.stringify([...next].slice(-2000)));
        return next;
      });
    },
    [ws.id],
  );

  const patchTask = useCallback((task: api.Task) => {
    setTasks((list) => {
      if (!list) return list;
      const at = list.findIndex((t) => t.id === task.id);
      if (at < 0) return [task, ...list];
      const next = list.slice();
      next[at] = { ...list[at]!, ...task };
      return next;
    });
  }, []);

  // Cards follow each task's `card_version`, read once per version.
  const wanted = useRef(new Set<string>());
  const loadCard = useCallback((task: api.Task) => {
    const key = `${task.id}@${task.card_version}`;
    if (wanted.current.has(key)) return;
    wanted.current.add(key);
    api.readCard(task.id).then(
      (raw) => setCards((m) => new Map(m).set(task.id, { version: task.card_version, raw, info: readCard(raw, task.key) })),
      () => setCards((m) => new Map(m).set(task.id, { version: task.card_version })),
    );
  }, []);
  const cardEntry = (task: api.Task) => {
    const at = cards.get(task.id);
    if (task.card_version != null && (!at || at.version !== task.card_version)) queueMicrotask(() => loadCard(task));
    return at;
  };

  // The event stream: a changed task is patched in place; anything else reads its list again.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soon = useCallback(
    (fn: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fn, 400);
    },
    [],
  );
  useEffect(
    () =>
      openStream(
        (e) => {
          listeners.current.forEach((fn) => fn(e));
          if (e.type === "chat.updated" || e.type === "discussion.updated") return void loadChats();
          if (e.type.startsWith("alert.")) return;
          if (e.type.startsWith("workspace.") || e.type.startsWith("member.")) return void reloadWorkspaces().catch(() => {});
          if (e.workspace && e.workspace !== ws.id) return;
          if ((e.type === "task.updated" || e.type === "task.created" || e.type === "task.cancelled") && e.data?.object === "task") {
            patchTask(e.data as unknown as api.Task);
            void loadChats();
            return;
          }
          if ((e.type === "triage.created" || e.type === "triage.updated") && e.data?.object === "triage") return void patchTriage(e.data as unknown as api.TriageItem);
          soon(reload);
        },
        (live) => live && void loadRunner(),
      ),
    [ws.id, reload, loadChats, loadRunner, patchTask, patchTriage, reloadWorkspaces, soon],
  );

  // The Runner's lease is not an event: look again now and then, and when the tab comes back.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void loadRunner();
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadRunner]);

  const projects = useMemo(
    () => allProjects.map((p) => (p.general ? { ...p, name: T.general } : p)).sort((a, b) => Number(b.general) - Number(a.general)),
    [allProjects],
  );
  const general = projects.find((p) => p.general) ?? null;

  // Nothing saved yet takes the old browser-wide one if it is here; anything else falls to `general`.
  const [, bump] = useState(0);
  const setCurrent = useCallback(
    (id: string) => {
      if (localStorage.getItem(PROJECT_KEY + "." + ws.id) === id) return;
      localStorage.setItem(PROJECT_KEY + "." + ws.id, id);
      bump((n) => n + 1);
    },
    [ws.id],
  );
  const saved = localStorage.getItem(PROJECT_KEY + "." + ws.id);
  const current = projects.find((p) => p.id === (saved ?? localStorage.getItem(PROJECT_KEY))) ?? general;
  useEffect(() => {
    if (listed !== ws.id || !current) return;
    if (saved !== current.id) setCurrent(current.id);
    if (saved === null) localStorage.removeItem(PROJECT_KEY);
  }, [listed, ws.id, saved, current?.id]);

  const store: Store = {
    me,
    workspaces,
    ws,
    projects,
    general,
    current,
    setCurrent,
    tasks,
    chats,
    dropChat: (id) => setChats((was) => was.filter((c) => (c.discussion ?? c.task) !== id)),
    triage,
    triageFailed,
    triageHistoryDone: !!history && history.next === null,
    patchTriage,
    loadTriageHistory,
    loadMoreTriageHistory,
    runnerOnline,
    runnerName,
    failed,
    setWorkspace,
    reloadWorkspaces,
    reload,
    patchTask,
    cardOf: (t) => cardEntry(t)?.info,
    rawCardOf: (t) => cardEntry(t)?.raw,
    isNew: (t) => !!known && !known.has(t.id),
    markSeen,
    onEvent: (fn) => {
      listeners.current.add(fn);
      return () => void listeners.current.delete(fn);
    },
    projectName: (id) => projects.find((x) => x.id === id)?.name,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
