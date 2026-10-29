// The computer a task runs on (#2196): yours, or one a teammate shares with the workspace. Shown only
// when a shared one is on offer; an offline shared one cannot be picked.

import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiMonitor } from "react-icons/fi";
import { Menu } from "@review/components/menu";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";
import { useStore } from "../store";

/** The computers holding `project`: yours first, then the shared ones. `def` is what runs with no pick:
 *  yours, else the first shared one online. */
export function useComputers(project: string | undefined) {
  const store = useStore();
  const [runners, setRunners] = useState<api.WorkspaceRunner[]>([]);
  useEffect(() => {
    if (!store.ws.personal) api.listRunners(store.ws.id).then(setRunners, () => {});
  }, [store.ws.id]);
  const me = store.me.accountId;
  const here = runners.filter((r) => project && r.projects.includes(project));
  const mine = here.filter((r) => r.owner_account === me);
  const shared = here.filter((r) => r.owner_account !== me && r.shared);
  const list = [...mine, ...shared];
  const def = mine[0] ?? shared.find((r) => r.connected);
  return { list: shared.length ? list : [], def, me };
}

export function ComputerMenu({ c, value, onPick, up }: { c: ReturnType<typeof useComputers>; value: string | null; onPick: (machine: string) => void; up?: boolean }) {
  const { list, def, me } = c;
  if (!list.length) return null;
  const now = list.find((r) => r.machine === value) ?? def;
  const name = (r: api.WorkspaceRunner) => r.name || T.runners.unnamed;
  return (
    <Menu
      panel={cn("w-[260px]", up && "top-auto bottom-[calc(100%+4px)]")}
      trigger={({ open, onClick }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          aria-label={T.runners.title}
          className={cn("flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 font-[600] hover:bg-nb-ink/[0.06]", open && "bg-nb-ink/[0.06]")}
        >
          <FiMonitor size={13} className="shrink-0 text-nb-ink-soft" aria-hidden />
          <span className="truncate">{now ? name(now) : T.runners.title}</span>
          <FiChevronDown size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
        </button>
      )}
      items={list.map((r) => {
        const mine = r.owner_account === me;
        const off = !mine && !r.connected;
        return {
          key: r.machine,
          onSelect: () => !off && onPick(r.machine),
          className: off ? "cursor-default hover:bg-transparent" : undefined,
          body: (
            <>
              <span className={cn("min-w-0 flex-1 truncate", off && "text-nb-ink-soft")}>{name(r)}</span>
              <span className="shrink-0 text-[11.5px] font-[500] text-nb-ink-soft">{off ? T.runners.offline : mine ? T.runners.yours : T.runners.sharedBy(r.owner)}</span>
              <span className="flex w-[13px] shrink-0 justify-end text-nb-accent-deep">{r.machine === now?.machine && <FiCheck size={13} aria-hidden />}</span>
            </>
          ),
        };
      })}
    />
  );
}
