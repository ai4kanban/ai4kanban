import Link from "next/link";
import { FiFolder } from "react-icons/fi";
import type { AgentInfo } from "@/lib/types";
import { Configuration } from "./Configuration";
import { CreateTask } from "./CreateTask";
import { Sessions } from "./sessions";

// Shared header for the board and the card detail page — identical on both: the
// brand links home (the board), and the Create-task action and Configuration gear
// sit on the right. Create task is self-contained (see CreateTask) so both pages
// get it without threading any session state through the header. `projectRoot` is
// the repo the server is driving (holds docs/kanban/) — shown as a small badge so
// you can tell at a glance which board this is. `autoRefine` seeds the
// Configuration dialog's switch; `onError` lets a save failure surface where the
// page already shows errors, across its top.
export function Header({
  agent,
  projectRoot,
  autoRefine,
  onError,
}: {
  agent: AgentInfo;
  projectRoot: string;
  autoRefine: boolean;
  onError?: (msg: string) => void;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 backdrop-blur-sm"
      style={{
        background: "color-mix(in srgb, var(--color-nb-cream) 90%, transparent)",
        borderBottom: "1.5px solid color-mix(in srgb, var(--color-nb-ink) 14%, transparent)",
      }}
    >
      <div className="flex items-baseline gap-3">
        <Link
          href="/"
          className="text-[17px] font-[800] tracking-[-0.02em] hover:text-nb-accent-deep"
        >
          🗂️ Kanban
        </Link>
        <span
          title={`${projectRoot}/docs/kanban`}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-nb-ink-soft"
          style={{
            background: "color-mix(in srgb, var(--color-nb-ink) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-nb-ink) 12%, transparent)",
          }}
        >
          <FiFolder className="shrink-0 opacity-70" size={12} />
          {projectRoot}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Sessions />
        <Configuration agent={agent} autoRefine={autoRefine} onError={onError} />
        <CreateTask />
      </div>
    </header>
  );
}
