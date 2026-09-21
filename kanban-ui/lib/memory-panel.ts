import { useCallback, useEffect, useState } from "react";

const KEY = "kanban-ui.memory-open";

/** Where one memory file lives in the panel, and in an address: the file's own name for the
 *  board's own record, `<agent>/<name>` for one an agent keeps (#130, #805). It is what a row
 *  links to and what says which row is lit, so the two can never disagree. */
export function memoryKey(agent: string, name: string): string {
  return agent ? `${agent}/${name}` : name;
}

/** The agent a key belongs to, or "" for the board's own record. */
export function memoryAgentOf(key: string | null): string {
  const at = key?.indexOf("/") ?? -1;
  return at > 0 ? key!.slice(0, at) : "";
}

/** An owner's files as the panel draws them (#959): each entry file with the files split out
 *  into its folder, named by their path under it — `feedback/recipes/tour` is `recipes/tour`
 *  under `feedback`, so the tree never grows past two levels. */
export function memoryTree(files: string[]): { name: string; kids: { name: string; label: string }[] }[] {
  const top = files.filter((name) => !name.includes("/"));
  return top.map((name) => ({
    name,
    kids: files
      .filter((kid) => kid.startsWith(`${name}/`))
      .map((kid) => ({ name: kid, label: kid.slice(name.length + 1) })),
  }));
}

/** Where a relative `.md` link in one memory file lands, as a memory key — or null when it
 *  names no file that owner holds. Resolved against the folder the file sits in. */
export function memoryLinkKey(href: string, agent: string, from: string, files: string[]): string | null {
  const [target] = href.split("#");
  if (!target?.endsWith(".md")) return null;
  let path: string;
  try {
    path = decodeURI(target);
  } catch {
    return null;
  }
  const parts = from.split("/").slice(0, -1);
  for (const part of path.slice(0, -3).split("/")) {
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  const name = parts.join("/");
  return files.includes(name) ? memoryKey(agent, name) : null;
}

// Whether the rail's Memory panel is expanded, remembered across reloads (#129).
//
// Kept in the browser like the rail's width, and not keyed by project: whether you keep
// memory open is a habit about the window, not something one board says.
//
// Landing on a memory file opens it whatever it was left at, so the highlighted row is on
// screen however you got there — a reload, Back, a pasted address. That is tied to ARRIVING
// at a file rather than to being on one, so collapsing the panel while reading a memory page
// still collapses it; the next file you open expands it again.
export function useMemoryPanel(
  /** The memory file this page is showing, as a key, or null. */
  active: string | null,
): { open: boolean; toggle: () => void; animate: boolean } {
  // Closed for the first render, always: localStorage is client-only, so a remembered
  // `true` read during the render would desync hydration. It lands a frame later.
  const [open, setOpen] = useState(false);
  // Whether opening and closing should slide. The remembered state lands after the first
  // render, and a panel that was already open should be found open rather than watched
  // opening, so the slide is switched on the frame after that.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(KEY) === "1";
    } catch {
      // storage unavailable — the panel opens closed and lasts as long as the window does
    }
    if (saved) setOpen(true);
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  return { open, toggle, animate };
}

/** Which owners are expanded (#130, #805). Any number can be open at once, and nothing is
 *  remembered across reloads: the rail's own chrome — its width, the panel being open — is
 *  the only view state the board keeps.
 *
 *  Open to begin with: every owner that has written something, and the one holding the file
 *  you landed on. An agent that has remembered nothing has one line to show, so it starts
 *  folded away rather than spending two rows saying nothing.
 *
 *  A memory file is a page of its own, so a reload can land inside an owner, and its row has
 *  to be on screen for the highlight to mean anything. That holds on a client navigation
 *  too, hence the effect beside the seeded initial state. */
export function useOpenOwners(
  active: string,
  written: string[],
): {
  isOpen: (agent: string) => boolean;
  toggle: (agent: string) => void;
} {
  const [open, setOpen] = useState<string[]>(() => [...new Set([...written, ...(active ? [active] : [])])]);

  useEffect(() => {
    if (active) setOpen((was) => (was.includes(active) ? was : [...was, active]));
  }, [active]);

  const toggle = useCallback((agent: string) => {
    setOpen((was) => (was.includes(agent) ? was.filter((m) => m !== agent) : [...was, agent]));
  }, []);

  return { isOpen: (agent) => open.includes(agent), toggle };
}
