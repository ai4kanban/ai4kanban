// The Settings dialog's switcher menus, workspace and project (#2191). A row that can be renamed
// shows ⋯ on hover; its 重命名 turns the row's name into text typed over in place. Enter or a click
// elsewhere saves, Esc gives up, an empty name is not saved.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FiCheck, FiEdit3, FiMoreHorizontal } from "react-icons/fi";
import { POPUP_PANEL } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";

export const POPUP_ROW = "relative flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 pr-8 text-left text-[13px] font-[600] text-nb-ink hover:bg-nb-wash";

export type SwitcherItem = {
  id: string;
  name: string;
  /** The row's mark; `renaming` while its row is the light grey one being typed in. */
  mark: (renaming: boolean) => ReactNode;
  /** A quiet word at the row's end, hidden while its ⋯ shows. */
  side?: ReactNode;
  renamable: boolean;
};

type Renaming = { id: string; was: string; typed: string };

export function SwitcherMenu({
  box, label, items, current, row, empty, className, onPick, onRename, onClose,
}: {
  /** The trigger and this menu: a press outside it closes the menu. */
  box: RefObject<HTMLElement | null>;
  label: string;
  items: SwitcherItem[];
  current: string | null;
  /** Extra classes on each row. */
  row?: string;
  empty?: ReactNode;
  className?: string;
  onPick: (id: string) => void;
  onRename: (id: string, name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState<{ id: string; top: number } | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const live = useRef(renaming);
  live.current = renaming;
  const rename = useRef(onRename);
  rename.current = onRename;

  const save = (r: Renaming) => {
    const name = r.typed.trim();
    if (!name || name === r.was) return;
    rename.current(r.id, name).catch((e) => setProblem(e instanceof api.ApiError && e.code === "offline" ? T.errors.offline : e instanceof api.ApiError && e.code === "owner_only" ? T.ws.ownerOnly : T.errors.generic));
  };
  const commit = () => {
    const r = live.current;
    live.current = null;
    setRenaming(null);
    if (r) save(r);
  };
  const cancel = () => {
    live.current = null;
    setRenaming(null);
  };

  // A rename still open when the menu closes is saved.
  useEffect(() => () => void (live.current && save(live.current)), []);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const at = e.target as Node;
      if (!box.current?.contains(at)) return onClose();
      if (!(at instanceof Element && at.closest("[data-more]"))) setMore(null);
    };
    // Capture, so Esc closes the innermost thing open before the dialog under it.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (live.current) cancel();
      else if (more) setMore(null);
      else onClose();
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [box, more, onClose]);

  return (
    <div ref={panel} role="listbox" aria-label={label} className={cn(POPUP_PANEL, "nb-pop flex flex-col", className)}>
      <div className="flex max-h-[min(360px,50vh)] flex-col overflow-y-auto p-1" onScroll={() => setMore(null)}>
        {items.map((it) =>
          renaming?.id === it.id ? (
            <div key={it.id} className={cn(POPUP_ROW, row, "cursor-text bg-nb-wash pr-2.5 hover:bg-nb-wash")}>
              {it.mark(true)}
              <input
                type="text"
                value={renaming.typed}
                onChange={(e) => setRenaming({ ...renaming, typed: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && commit()}
                onBlur={commit}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={T.ws.name}
                autoFocus
                maxLength={80}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent p-0 text-[13px] font-[600] text-nb-ink outline-none max-md:text-[16px]"
              />
            </div>
          ) : (
            <div key={it.id} className="group relative">
              <button type="button" role="option" aria-selected={it.id === current} onClick={() => onPick(it.id)} className={cn(POPUP_ROW, row)}>
                {it.mark(false)}
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                {it.side && <span className={cn("shrink-0", it.renamable && "group-hover:invisible", more?.id === it.id && "invisible")}>{it.side}</span>}
                {it.id === current && (
                  <span className={cn("absolute right-2.5 flex items-center text-nb-accent-deep", it.renamable && "group-hover:invisible", more?.id === it.id && "invisible")}>
                    <FiCheck size={13} aria-hidden />
                  </span>
                )}
              </button>
              {it.renamable && (
                <button
                  type="button"
                  data-more
                  aria-label={T.ws.more}
                  aria-expanded={more?.id === it.id}
                  onClick={(e) => {
                    const top = e.currentTarget.getBoundingClientRect().bottom - panel.current!.getBoundingClientRect().top + 4;
                    setMore(more?.id === it.id ? null : { id: it.id, top });
                  }}
                  className={cn(
                    "absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-ink/8 hover:text-nb-ink nb-focus",
                    more?.id === it.id ? "bg-nb-ink/8 text-nb-ink" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                  )}
                >
                  <FiMoreHorizontal size={14} aria-hidden />
                </button>
              )}
            </div>
          ),
        )}
        {items.length === 0 && empty}
      </div>
      {problem && <p className="px-3 pb-2 text-[12px] text-nb-peach-ink">{problem}</p>}
      {more && (
        <div data-more role="menu" className={cn(POPUP_PANEL, "nb-pop origin-top-right absolute right-1.5 z-40 flex w-[150px] flex-col p-1")} style={{ top: more.top }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const it = items.find((i) => i.id === more.id);
              setMore(null);
              setProblem(null);
              if (it) setRenaming({ id: it.id, was: it.name, typed: it.name });
            }}
            className={cn(POPUP_ROW, "pr-2.5")}
          >
            <FiEdit3 size={13} className="shrink-0" aria-hidden />
            {T.ws.rename}
          </button>
        </div>
      )}
    </div>
  );
}
