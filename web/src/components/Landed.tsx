// Where a done task's work landed (#2109): the commit in the meta strip, and its diff below,
// read from the computer it landed on each time the page opens. After legacy kanban-ui's
// LandedBlock and DiffPane.

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiChevronRight, FiCopy, FiFile, FiSidebar } from "react-icons/fi";
import { useCopyText } from "@review/components/copy";
import * as api from "../api";
import { LANG, T } from "../i18n";

const RULE = "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)";
const MONO = { fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.55 } as const;
const ADD = { band: "var(--color-nb-mint-soft)", gutter: "color-mix(in srgb, var(--color-nb-mint) 26%, var(--color-nb-mint-soft))", ink: "var(--color-nb-mint-ink)" };
const DEL = { band: "var(--color-nb-peach-soft)", gutter: "color-mix(in srgb, var(--color-nb-peach) 26%, var(--color-nb-peach-soft))", ink: "var(--color-nb-peach-ink)" };

type Landing = NonNullable<api.Task["landing"]>;
type File = api.TaskDiff["files"][number];
type Row = { kind: "ctx" | "add" | "del" | "hunk"; a?: number; b?: number; text: string };

/** The meta strip's 提交: the short hash, a copy of the full one, and where it is. */
export function LandedCommit({ landing }: { landing: Landing }) {
  const { copied, copy } = useCopyText();
  const where = T.landed.where(landing.machine, landing.branch);
  return (
    <>
      <span className="inline-flex items-center gap-1 font-mono normal-case tracking-normal">
        {landing.commit.slice(0, 7)}
        <button type="button" title={T.landed.copy} aria-label={T.landed.copy} onClick={() => copy(landing.commit)} className="inline-flex size-4 cursor-pointer items-center justify-center rounded text-nb-ink-soft hover:text-nb-ink">
          {copied ? <FiCheck aria-hidden style={{ width: 10, height: 10 }} /> : <FiCopy aria-hidden style={{ width: 10, height: 10 }} />}
        </button>
      </span>
      {where && <span className="normal-case tracking-normal text-nb-ink-soft">{where}</span>}
    </>
  );
}

type State = { kind: "loading" } | { kind: "ready"; diff: api.TaskDiff } | { kind: "offline" | "gone" | "failed" };

/** The 差异 block: the landed commit's diff, or one line saying why there is none. */
export function LandedDiff({ task, landing }: { task: string; landing: Landing }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    api.readDiff(task).then(
      (diff) => live && setState({ kind: "ready", diff }),
      (e) => {
        if (!live) return;
        const code = e instanceof api.ApiError ? e.code : "";
        setState({ kind: code === "machine_offline" ? "offline" : code === "commit_gone" ? "gone" : "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [task, landing.commit]);

  const line =
    state.kind === "loading" ? T.landed.loading
    : state.kind === "offline" ? T.landed.offline(landing.machine)
    : state.kind === "gone" ? T.landed.gone(landing.machine)
    : T.landed.failed;
  return (
    <div className="nb-section bg-nb-sheet">
      <div className="flex items-center gap-1 rounded-t-[14px] py-1.5 pl-1.5 pr-3.5">
        <span className="flex items-center gap-1.5 rounded-[8px] px-2 py-0.5 text-[12px] font-[700] max-md:h-11 max-md:px-3" style={{ background: "color-mix(in srgb, var(--color-nb-ink) 9%, transparent)" }}>
          {T.landed.diff}
        </span>
      </div>
      {state.kind === "ready" ? (
        <Changes diff={state.diff} />
      ) : (
        <div role="status" className="rounded-b-[14px] bg-nb-paper px-4 py-2.5 text-[12px] text-nb-ink-soft" style={{ borderTop: `1px solid ${RULE}` }}>
          {line}
        </div>
      )}
    </div>
  );
}

function Changes({ diff }: { diff: api.TaskDiff }) {
  const [tree, setTree] = useState(true);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const pane = useRef<HTMLDivElement>(null);
  const added = diff.files.reduce((n, f) => n + f.added, 0);
  const removed = diff.files.reduce((n, f) => n + f.removed, 0);
  const toggle = (path: string) =>
    setClosed((held) => {
      const next = new Set(held);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  const open = (i: number) => {
    setActive(i);
    const file = pane.current?.querySelector<HTMLElement>(`[data-file="${i}"]`);
    if (file && pane.current) pane.current.scrollTop = file.offsetTop;
  };
  return (
    <div className="overflow-hidden rounded-b-[14px] bg-nb-paper" style={{ borderTop: `1px solid ${RULE}` }}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5 text-[12px]" style={{ borderBottom: `1px solid ${RULE}` }}>
        <span className={LANG === "zh" ? "text-nb-ink-soft" : "font-mono text-nb-ink-soft"}>{T.landed.stat(diff.files.length, added, removed)}</span>
        {diff.truncated && <span className="text-nb-ink-soft">· {T.landed.tooLarge}</span>}
        {!diff.truncated && (
          <button
            type="button"
            title={tree ? T.landed.hideTree : T.landed.showTree}
            aria-label={tree ? T.landed.hideTree : T.landed.showTree}
            aria-pressed={tree}
            onClick={() => setTree((v) => !v)}
            className="ml-auto cursor-pointer rounded-[7px] p-1 text-[14px] text-nb-ink-soft hover:text-nb-ink max-md:hidden"
          >
            <FiSidebar aria-hidden />
          </button>
        )}
      </div>
      {diff.truncated ? (
        <div>
          {diff.files.map((f) => (
            <div key={f.path} className="flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: `1px solid ${RULE}` }}>
              <FiFile className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]" title={f.path}>{f.path}</span>
              <Counts add={f.added} del={f.removed} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex max-h-[420px]">
          {tree && (
            <div className="w-[188px] shrink-0 overflow-auto bg-nb-wash py-1.5 max-md:hidden" style={{ borderRight: `1px solid ${RULE}` }}>
              {diff.files.map((f, i) => (
                <button
                  key={f.path}
                  type="button"
                  title={f.path}
                  onClick={() => open(i)}
                  className="flex w-full cursor-pointer items-center gap-1.5 py-[3px] pl-3 pr-2 text-left text-[11.5px] leading-tight hover:bg-nb-sheet"
                  style={i === active ? { color: "var(--color-nb-accent-deep)", fontWeight: 700 } : undefined}
                >
                  <FiFile className="shrink-0 text-[11px]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{f.path.split("/").pop()}</span>
                  <Counts add={f.added} del={f.removed} />
                </button>
              ))}
            </div>
          )}
          <div ref={pane} className="relative min-w-0 flex-1 overflow-auto">
            {diff.files.map((f, i) => (
              <div key={f.path} data-file={i}>
                <FileHead file={f} open={!closed.has(f.path)} onToggle={() => toggle(f.path)} />
                {!closed.has(f.path) &&
                  (f.patch ? (
                    rowsOf(f.patch).map((row, n) => <Line key={n} row={row} />)
                  ) : f.binary ? (
                    <div className="px-3 py-1.5 text-[11.5px] text-nb-ink-soft">{T.landed.binary}</div>
                  ) : null)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Counts({ add, del }: { add: number; del: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-[700]">
      {add > 0 && <span style={{ color: ADD.ink }}>+{add}</span>}
      {del > 0 && <span style={{ color: DEL.ink }}>−{del}</span>}
    </span>
  );
}

function FileHead({ file, open, onToggle }: { file: File; open: boolean; onToggle: () => void }) {
  const Chevron = open ? FiChevronDown : FiChevronRight;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="sticky top-0 z-[2] flex w-full cursor-pointer items-center gap-2 bg-nb-wash px-3 py-1.5 text-left"
      style={{ borderBottom: `1px solid ${RULE}` }}
    >
      <Chevron className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-[600]" title={file.path}>{file.path}</span>
      {file.status === "added" && <span className="nb-chip" style={{ background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}>{T.landed.added}</span>}
      <Counts add={file.added} del={file.removed} />
    </button>
  );
}

function Line({ row }: { row: Row }) {
  if (row.kind === "hunk") {
    return <div className="px-3 py-1" style={{ ...MONO, background: "var(--color-nb-sky-soft)", color: "var(--color-nb-sky-ink)", overflowWrap: "anywhere" }}>{row.text}</div>;
  }
  const tone = row.kind === "add" ? ADD : row.kind === "del" ? DEL : null;
  return (
    <div className="flex" style={{ ...MONO, background: tone?.band }}>
      <span className="w-9 shrink-0 select-none pr-1.5 text-right text-nb-ink-soft" style={{ background: tone?.gutter }}>{row.a ?? ""}</span>
      <span className="w-9 shrink-0 select-none pr-1.5 text-right text-nb-ink-soft" style={{ background: tone?.gutter }}>{row.b ?? ""}</span>
      <span className="w-4 shrink-0 select-none text-center" style={{ color: tone?.ink }}>{row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap pr-3" style={{ overflowWrap: "anywhere" }}>{row.text}</span>
    </div>
  );
}

/** A file's hunks as rows, each line numbered on the side it is on. */
export function rowsOf(patch: string): Row[] {
  const rows: Row[] = [];
  let a = 0;
  let b = 0;
  for (const line of patch.replace(/\n$/, "").split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      a = Number(hunk[1]);
      b = Number(hunk[2]);
      rows.push({ kind: "hunk", text: line });
    } else if (line.startsWith("\\")) {
      continue;
    } else if (line.startsWith("+")) {
      rows.push({ kind: "add", b: b++, text: line.slice(1) });
    } else if (line.startsWith("-")) {
      rows.push({ kind: "del", a: a++, text: line.slice(1) });
    } else {
      rows.push({ kind: "ctx", a: a++, b: b++, text: line.slice(1) });
    }
  }
  return rows;
}
