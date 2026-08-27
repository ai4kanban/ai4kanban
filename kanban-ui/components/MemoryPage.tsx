"use client";

// One memory file, read (#129, #130) — the project's copy, or a module's. The rail's Memory
// panel opens these; the file itself is drawn here, in the body, because a rail row is a
// couple of hundred pixels wide and these files run close to 200 lines.
//
// Everything on it is read-only. The board never opens the file in an editor and never
// starts a run from here — reading it, and copying its path so the fix can happen where
// files are fixed, is all this page does.
//
// The heading is the panel's own words for the file, not its name: the panel calls the row
// Settled decisions, and a page headed `decisions.md` would read as a different thing. The
// path under it carries the file name anyway.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy, FiMoreHorizontal } from "react-icons/fi";
import { useRouter } from "next/navigation";
import type { RailCopy } from "@/i18n/rail/types";
import { useCopy } from "@/i18n/use-copy";
import { memoryKey } from "@/lib/memory-panel";
import type { AgentInfo, MemoryFile, MemoryModule } from "@/lib/types";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { Markdown } from "./Markdown";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Window } from "./Window";

/** How long "Copied" stays up — long enough to be read, short enough not to be furniture. */
const COPIED_MS = 1600;

export function MemoryPage({
  file,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  desktop,
}: {
  file: MemoryFile;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().rail;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);

  // The file keeps up on its own, on the two triggers a card page uses: a run finishing, and
  // the window being focused again. The app has no file watcher, so a file the user edits
  // themselves catches up on the second of those. Nothing is started from this page, so
  // there is no run of our own to hear about.
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  return (
    // A memory line often names a card — `#129` — and linkifying those is what makes this
    // page a way into the work rather than a wall of text.
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentMemory={memoryKey(file.module, file.name)}
        memoryModules={memoryModules}
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            onError={setError}
            goalWritten={goalWritten}
            desktop={desktop}
          />
        }
      >
        <div className="h-full overflow-y-auto">
          <RunningNotice desktop={desktop} />

          <main className="mx-auto w-full max-w-[840px] px-6 py-6">
            {error && (
              <div
                className="nb-panel-sm mb-4 p-3 text-[13px]"
                style={{ background: "var(--color-nb-peach-soft)" }}
              >
                {error}
              </div>
            )}

            <div className="mb-4 flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                {/* Whose memory this is. The four labels are the same for every set, so
                    without the module's name over it a module's page and the project's read
                    as the same page (#130). */}
                {file.module && (
                  <p className="mb-0.5 truncate text-[11px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
                    {file.module}
                  </p>
                )}
                <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">
                  {c.memory.files[file.name as keyof RailCopy["memory"]["files"]] ?? file.label}
                </h1>
                <p className="mt-1 break-all font-mono text-[12px] text-nb-ink-soft">
                  {file.relPath}
                </p>
              </div>
              <PathMenu file={file} />
            </div>

            <div className="nb-panel-sm p-5">
              {file.written ? (
                <Markdown body={file.text} />
              ) : (
                // The row stays on a board that has never written this file, so the page has
                // to say why it is empty. An empty panel would read as a failed read.
                <p className="text-[13px] leading-relaxed text-nb-ink-soft">
                  {c.memoryPage.unwritten}
                </p>
              )}
            </div>
          </main>
        </div>
      </Window>
    </OpenIdsProvider>
  );
}

/** The ⋯ beside the heading: the file's two paths, to paste. Copying a path is how a user
 *  gets from a wrong line to the file that holds it — the board itself never opens it.
 *
 *  Both forms are offered because they are pasted at different things: the relative one is
 *  what a coding agent working in this repo is given, the full one is what an editor or a
 *  terminal somewhere else wants. */
function PathMenu({ file }: { file: MemoryFile }) {
  const c = useCopy().rail.memoryPage;
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = (text: string, said: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(said))
      // No clipboard permission, or no clipboard at all. The path is on screen above to
      // select by hand, and saying the copy worked when it didn't would be worse than
      // saying nothing.
      .catch(() => {});
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {copied && (
        <span
          className="nb-chip inline-flex items-center gap-1"
          style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}
        >
          <FiCheck aria-hidden className="size-[1em]" />
          {c.copied(copied)}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={c.menu}
            title={c.menu}
            className="grid size-7 cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] hover:text-nb-ink"
          >
            <FiMoreHorizontal aria-hidden style={{ width: 15, height: 15 }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2" onSelect={() => copy(file.path, c.path)}>
            <FiCopy aria-hidden className="size-[1em] shrink-0" />
            {c.copyPath}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onSelect={() => copy(file.relPath, c.relativePath)}
          >
            <FiCopy aria-hidden className="size-[1em] shrink-0" />
            {c.copyRelative}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
