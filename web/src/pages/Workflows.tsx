// `/workflows` (#2030): the official workflows under 已安装 / 全部 and a find box. An owner
// installs and uninstalls (asked first); a member only reads.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiCode, FiCopy, FiFileText, FiFilm, FiLayout, FiMonitor, FiPlus, FiSearch, FiShare2, FiTrash2 } from "react-icons/fi";
import { Button } from "@review/components/button";
import { HAIRLINE } from "@review/components/chrome";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T, workflowDescription, workflowName } from "../i18n";
import { useStore } from "../store";
import { WsMark } from "../components/Header";
import { Window } from "../components/Window";

const ICON = { size: 15, "aria-hidden": true } as const;
const ICONS: Record<string, ReactNode> = {
  wf_builtin_coding: <FiCode {...ICON} />,
  wf_builtin_hyperframes_video: <FiFilm {...ICON} />,
  wf_builtin_carousel_post: <FiShare2 {...ICON} />,
  wf_builtin_blog_post: <FiFileText {...ICON} />,
  wf_builtin_slide_deck: <FiMonitor {...ICON} />,
  wf_builtin_video_clone: <FiCopy {...ICON} />,
};

type Tab = "installed" | "all";

export function Workflows() {
  const store = useStore();
  const ws = store.ws;
  const owner = ws.role === "owner";
  const [list, setList] = useState<api.MarketplaceWorkflow[] | null>(null);
  const [tab, setTab] = useState<Tab>("installed");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    document.title = `${T.flows.title} · WildCrane`;
  }, []);
  useEffect(() => {
    setList(null);
    setAsking(null);
    setProblem(null);
    api.listMarketplace(ws.id).then(setList, () => setList([]));
  }, [ws.id]);

  const toggle = async (w: api.MarketplaceWorkflow) => {
    setBusy(w.id);
    setAsking(null);
    setProblem(null);
    try {
      const next = await (w.installed ? api.uninstallWorkflow : api.installWorkflow)(ws.id, w.id);
      setList((l) => l && l.map((x) => (x.id === w.id ? { ...x, installed: next.installed } : x)));
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      const text = code === "offline" ? T.errors.offline : code === "owner_only" ? T.ws.ownerOnly : w.installed ? T.errors.generic : T.flows.failed;
      setProblem({ id: w.id, text });
    } finally {
      setBusy(null);
    }
  };

  const all = list ?? [];
  const installed = all.filter((w) => w.installed);
  const tabs = !!list && installed.length < all.length;
  const q = query.trim().toLowerCase();
  const shown = (tab === "all" && tabs ? all : installed).filter((w) => !q || `${workflowName(w)}\n${workflowDescription(w)}`.toLowerCase().includes(q));

  return (
    <Window>
      <div className="h-full overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-8 max-md:px-4 max-md:py-5">
          <div className="flex flex-wrap items-center gap-3">
            <WsMark ws={ws} size={32} />
            <h1 className="text-[20px] font-[800] tracking-[-0.02em]">{T.flows.title}</h1>
            <label className="nb-field ml-auto flex h-9 w-[260px] items-center gap-2 rounded-[8px] border bg-nb-paper px-3 text-[13px] text-nb-ink-soft max-md:ml-0 max-md:w-full" style={{ borderColor: HAIRLINE }}>
              <FiSearch size={13} aria-hidden className="shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder={T.flows.find}
                aria-label={T.flows.find}
                className="min-w-0 flex-1 bg-transparent text-nb-ink placeholder:text-nb-ink-soft focus:outline-none max-md:text-[16px]"
              />
            </label>
          </div>
          <div className="flex flex-col gap-4">
            {tabs && (
              <div className="flex items-end gap-5 text-[13.5px]" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <div role="tablist" className="flex items-end gap-5">
                  {(
                    [
                      ["installed", T.flows.installed, installed.length],
                      ["all", T.flows.all, all.length],
                    ] as const
                  ).map(([k, label, n]) => {
                    const on = tab === k;
                    return (
                      <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)} className={cn("relative flex cursor-pointer items-center gap-1.5 pb-2", on ? "font-[700] text-nb-ink" : "text-nb-ink-soft")}>
                        {label}
                        <span className="font-[500] text-nb-ink-soft">{n}</span>
                        {on && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-nb-accent" />}
                      </button>
                    );
                  })}
                </div>
                {!owner && <span className="ml-auto min-w-0 truncate pb-2 text-[12.5px] text-nb-ink-soft">{T.flows.ownerInstalls}</span>}
              </div>
            )}
            {list && !shown.length && q && <p className="text-[13px] text-nb-ink-soft">{T.flows.noMatches}</p>}
            <div key={tab} className="a4k-reveal grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {shown.map((w) => {
                const name = workflowName(w);
                return (
                  <div key={w.id} className="nb-section relative flex min-h-[150px] flex-col gap-3 bg-nb-sheet p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-nb-wash text-nb-ink">{ICONS[w.id] ?? <FiLayout {...ICON} />}</span>
                      {owner && w.installed && (
                        <div className="relative">
                          <button
                            type="button"
                            disabled={busy === w.id}
                            aria-expanded={asking === w.id}
                            onClick={() => setAsking(asking === w.id ? null : w.id)}
                            className={cn("nb-focus inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-[600] leading-none text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink disabled:opacity-50", asking === w.id && "bg-nb-wash text-nb-ink")}
                            style={{ borderColor: HAIRLINE }}
                          >
                            <FiTrash2 aria-hidden />
                            {T.flows.uninstall}
                          </button>
                          {asking === w.id && <UninstallConfirm name={name} onCancel={() => setAsking(null)} onConfirm={() => void toggle(w)} />}
                        </div>
                      )}
                      {owner && !w.installed && (
                        <Button size="xs" disabled={busy === w.id} onClick={() => void toggle(w)}>
                          <FiPlus aria-hidden />
                          {T.flows.install}
                        </Button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-[700]">{name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-nb-ink-soft">{workflowDescription(w)}</div>
                      {problem?.id === w.id && <p className="mt-1.5 text-[12px] text-nb-peach-ink">{problem.text}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </Window>
  );
}

function UninstallConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => !box.current?.parentElement?.contains(e.target as Node) && onCancel();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [onCancel]);
  return (
    <div ref={box} role="dialog" className="nb-panel nb-pop origin-top-right absolute right-0 top-[calc(100%+6px)] z-20 w-[320px] max-w-[calc(100vw-2rem)] bg-nb-paper p-3">
      <p className="text-[13px] font-[700]">{T.flows.uninstallAsk(name)}</p>
      <p className="mt-1 text-[12px] leading-snug text-nb-ink-soft">{T.flows.uninstallBody}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          {T.flows.keep}
        </Button>
        <Button size="xs" onClick={onConfirm}>
          {T.flows.uninstall}
        </Button>
      </div>
    </div>
  );
}
