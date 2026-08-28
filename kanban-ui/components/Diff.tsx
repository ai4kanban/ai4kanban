"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiSidebar } from "react-icons/fi";
import type { CardCopy } from "@/i18n/card/types";
import { useCopy } from "@/i18n/use-copy";
import { fileTree, parseDiff, type DiffFile, type DiffNode, type DiffRow } from "@/lib/diff";
import type { DeliveryDiff } from "@/lib/types";

// ---- the Diff tab (#305) -----------------------------------------------------
//
// What the delivery changed, laid out to be *reviewed*: the changed files as a tree
// on the left, and one continuous listing on the right — a file header, its hunks,
// and every line numbered on both sides. Clicking a file jumps the listing to it;
// scrolling the listing moves the mark in the tree.
//
// The server reads the diff and caps it, so nothing here fetches or truncates. It
// arrives as git's own text and is parsed in `lib/diff.ts`.
//
// One raised block, per design.md: the tree and the listing are regions inside the
// delivery block, told apart by wash and a quiet rule rather than frames of their
// own. Ink stays rationed — mint says added, peach says removed, sky heads a hunk,
// and ember marks only the file being read.

/** A changed line's skin: the band behind it, the darker gutter its numbers sit
 *  in, and the ink of its sign — the seating every diff view gives a gutter. */
const TONE = {
  add: {
    band: "var(--color-nb-mint-soft)",
    gutter: "color-mix(in srgb, var(--color-nb-mint) 26%, var(--color-nb-mint-soft))",
    ink: "var(--color-nb-mint-ink)",
    sign: "+",
  },
  del: {
    band: "var(--color-nb-peach-soft)",
    gutter: "color-mix(in srgb, var(--color-nb-peach) 26%, var(--color-nb-peach-soft))",
    ink: "var(--color-nb-peach-ink)",
    sign: "−",
  },
} as const;

const RULE = "color-mix(in srgb, var(--color-nb-ink) 12%, transparent)";
const MONO = { fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.55 } as const;

/** What a file's header says about it when it is not a plain edit — its colours
 *  here, its word in `i18n/card`. */
const STATUS: Partial<Record<DiffFile["status"], { key: "added" | "deleted" | "renamed"; bg: string; ink: string }>> = {
  added: { key: "added", bg: "var(--color-nb-mint-soft)", ink: "var(--color-nb-mint-ink)" },
  deleted: { key: "deleted", bg: "var(--color-nb-peach-soft)", ink: "var(--color-nb-peach-ink)" },
  renamed: { key: "renamed", bg: "var(--color-nb-sky-soft)", ink: "var(--color-nb-sky-ink)" },
};

export function DiffPane({ diff }: { diff: DeliveryDiff }) {
  const c = useCopy().card.diff;
  const { nodes, files } = useMemo(() => fileTree(parseDiff(diff.diff)), [diff.diff]);
  const [active, setActive] = useState(0);
  const [showTree, setShowTree] = useState(true);
  const [closed, setClosed] = useState<ReadonlySet<number>>(() => new Set());
  const listing = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const tree = useRef<HTMLDivElement>(null);

  // Keep the marked file in the tree in sight, by moving the tree and nothing
  // else — `scrollIntoView` would take the page with it while the user is
  // reading the listing.
  useEffect(() => {
    const pane = tree.current;
    const row = pane?.querySelector<HTMLElement>(`[data-file="${active}"]`);
    if (!pane || !row) return;
    if (row.offsetTop < pane.scrollTop) pane.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > pane.scrollTop + pane.clientHeight) {
      pane.scrollTop = row.offsetTop + row.offsetHeight - pane.clientHeight;
    }
  }, [active]);

  // A tree earns its width from the second file onwards.
  const withTree = showTree && files.length > 1;

  const jump = (index: number) => {
    const pane = listing.current;
    const section = sections.current[index];
    if (pane && section) pane.scrollTop = section.offsetTop;
    setActive(index);
  };

  // Which file is being read: the last one whose header has passed the top edge.
  // Measured a frame at a time — every check reads forty offsets, and a scroll
  // fires far more often than a frame draws.
  const pending = useRef(0);
  const onScroll = () => {
    if (pending.current) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0;
      const top = (listing.current?.scrollTop ?? 0) + 4;
      let seen = 0;
      sections.current.forEach((section, i) => {
        if (section && section.offsetTop <= top) seen = i;
      });
      setActive(seen);
    });
  };

  const toggleFile = (index: number) =>
    setClosed((was) => {
      const next = new Set(was);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    // Paper over the delivery section's tint, parted from the tab strip by a hairline —
    // an ink rule here would be the only border left on the card page.
    <div className="bg-nb-paper" style={{ borderTop: `1px solid ${RULE}` }}>
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5 text-[12px]"
        style={{ borderBottom: `1px solid ${RULE}` }}
      >
        {diff.uncommitted && (
          <span
            className="nb-chip"
            style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}
          >
            {c.uncommitted}
          </span>
        )}
        <span className="font-mono text-nb-ink-soft">{diff.note || diff.stat}</span>
        {/* The stat counts the whole tree, so a cut-off diff would otherwise look complete.
            The git command that prints the rest used to sit in a foot below; the block's
            own foot already names the branch, which is what a reader needs to go look. */}
        {diff.truncated && (
          <span className="text-nb-ink-soft" title={c.truncatedHint}>
            {c.truncated}
          </span>
        )}
        {files.length > 1 && (
          <button
            type="button"
            onClick={() => setShowTree((on) => !on)}
            aria-pressed={showTree}
            className="nb-tip ml-auto cursor-pointer rounded-[7px] p-1 text-[14px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink"
            data-tip={showTree ? c.hideTree : c.showTree}
            aria-label={showTree ? c.hideTree : c.showTree}
          >
            <FiSidebar aria-hidden />
          </button>
        )}
      </div>

      {files.length === 0 ? (
        // Nothing parsed: either there is no diff at all, or it is in a shape this
        // does not read. Git's own text beats an empty frame.
        diff.diff ? (
          <pre className="m-0 max-h-[420px] overflow-auto px-4 py-3 text-nb-ink-soft" style={MONO}>
            {diff.diff}
          </pre>
        ) : null
      ) : (
        // Tall enough to review in, never taller than the diff it holds.
        <div className="flex max-h-[clamp(320px,60vh,620px)]">
          {withTree && (
            <div
              ref={tree}
              className="relative w-[188px] shrink-0 overflow-auto bg-nb-wash py-1.5"
              style={{ borderRight: `1px solid ${RULE}` }}
            >
              <Tree nodes={nodes} active={active} onPick={jump} depth={0} />
            </div>
          )}
          <div ref={listing} onScroll={onScroll} className="relative min-w-0 flex-1 overflow-y-auto">
            {files.map((file, index) => (
              <FileSection
                key={`${file.path}-${index}`}
                copy={c}
                file={file}
                open={!closed.has(index)}
                onToggle={() => toggleFile(index)}
                ref={(node) => {
                  sections.current[index] = node;
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- the tree ----------------------------------------------------------------

function Tree({
  nodes,
  active,
  onPick,
  depth,
}: {
  nodes: DiffNode[];
  active: number;
  onPick: (index: number) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) =>
        node.kind === "dir" ? (
          <Dir key={node.path} dir={node} active={active} onPick={onPick} depth={depth} />
        ) : (
          <button
            key={`${node.file.path}-${node.index}`}
            type="button"
            data-file={node.index}
            onClick={() => onPick(node.index)}
            title={node.file.path}
            className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11.5px] leading-tight"
            style={{
              paddingLeft: 10 + depth * 11,
              background: node.index === active ? "var(--color-nb-accent-soft)" : undefined,
              color: node.index === active ? "var(--color-nb-accent-deep)" : "var(--color-nb-ink)",
              fontWeight: node.index === active ? 700 : 400,
            }}
          >
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <Counts file={node.file} />
          </button>
        ),
      )}
    </>
  );
}

function Dir({
  dir,
  active,
  onPick,
  depth,
}: {
  dir: Extract<DiffNode, { kind: "dir" }>;
  active: number;
  onPick: (index: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        title={dir.path}
        aria-expanded={open}
        className="flex w-full items-center gap-1 py-[3px] pr-2 text-left text-[11.5px] leading-tight font-[600] text-nb-ink-soft hover:text-nb-ink"
        style={{ paddingLeft: 4 + depth * 11 }}
      >
        {open ? (
          <FiChevronDown className="shrink-0 text-[12px]" aria-hidden />
        ) : (
          <FiChevronRight className="shrink-0 text-[12px]" aria-hidden />
        )}
        <span className="min-w-0 truncate">{dir.name}</span>
      </button>
      {open && <Tree nodes={dir.children} active={active} onPick={onPick} depth={depth + 1} />}
    </>
  );
}

/** How much a file moved, as two counts. Small, but it is what makes a list of
 *  forty files scannable — the big one is visible without opening it. */
function Counts({ file }: { file: DiffFile }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-[700]">
      {file.added > 0 && <span style={{ color: "var(--color-nb-mint-ink)" }}>+{file.added}</span>}
      {file.removed > 0 && <span style={{ color: "var(--color-nb-peach-ink)" }}>&minus;{file.removed}</span>}
    </span>
  );
}

// ---- one file ----------------------------------------------------------------

function FileSection({
  copy,
  file,
  open,
  onToggle,
  ref,
}: {
  copy: CardCopy["diff"];
  file: DiffFile;
  open: boolean;
  onToggle: () => void;
  ref: (node: HTMLElement | null) => void;
}) {
  const slash = file.path.lastIndexOf("/");
  const status = STATUS[file.status];
  // The gutter is sized to the file's own last line, so a short file does not pay
  // for a long one's five digits.
  const digits = Math.max(2, String(lastLine(file.rows)).length);
  const cell = `calc(${digits}ch + 12px)`;

  return (
    <section ref={ref} style={{ borderBottom: `1px solid ${RULE}` }}>
      <div
        className="sticky top-0 z-[2] flex items-center gap-2 bg-nb-wash px-3 py-1.5"
        style={{ borderBottom: `1px solid ${RULE}` }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={file.from ? `${file.from} → ${file.path}` : file.path}
        >
          {open ? (
            <FiChevronDown className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
          ) : (
            <FiChevronRight className="shrink-0 text-[12px] text-nb-ink-soft" aria-hidden />
          )}
          <span className="truncate font-mono text-[11.5px]">
            {slash >= 0 && <span className="text-nb-ink-soft">{file.path.slice(0, slash + 1)}</span>}
            <span className="font-[700] text-nb-ink">{file.path.slice(slash + 1)}</span>
          </span>
        </button>
        {status && (
          <span className="nb-chip shrink-0" style={{ background: status.bg, color: status.ink }}>
            {copy[status.key]}
          </span>
        )}
        <Counts file={file} />
      </div>

      {open &&
        (file.binary ? (
          <p className="px-4 py-2 text-[11.5px] text-nb-ink-soft">{copy.binary}</p>
        ) : file.rows.length === 0 ? (
          <p className="px-4 py-2 text-[11.5px] text-nb-ink-soft">{copy.noLines}</p>
        ) : (
          // The scroller is the file, not the pane: a long line slides under a file
          // header that stays put, and the numbers stay pinned to the left edge.
          <div className="overflow-x-auto" style={MONO}>
            <div style={{ width: "max-content", minWidth: "100%" }}>
              {file.rows.map((row, i) => (
                <Line key={i} copy={copy} row={row} cell={cell} />
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}

function Line({ copy, row, cell }: { copy: CardCopy["diff"]; row: DiffRow; cell: string }) {
  if (row.kind === "hunk") {
    return (
      <div
        className="w-full bg-nb-wash px-3 py-[3px]"
        style={{ color: "var(--color-nb-sky-ink)", borderBlock: `1px solid ${RULE}` }}
      >
        <span className="sticky left-3 whitespace-pre">{row.text}</span>
      </div>
    );
  }
  const tone = row.kind === "add" ? TONE.add : row.kind === "del" ? TONE.del : null;
  return (
    <div className="flex w-full" style={{ background: tone?.band }}>
      <span
        aria-hidden
        className="sticky left-0 z-[1] flex shrink-0 select-none"
        style={{ background: tone?.gutter ?? "var(--color-nb-paper)" }}
      >
        <span className="pr-1.5 pl-2 text-right text-nb-ink-soft" style={{ width: cell }}>
          {row.old ?? ""}
        </span>
        <span className="pr-1.5 text-right text-nb-ink-soft" style={{ width: cell }}>
          {row.new ?? ""}
        </span>
        <span className="w-[15px] text-center font-[700]" style={{ color: tone?.ink }}>
          {tone?.sign ?? " "}
        </span>
      </span>
      {/* The gutter is hidden from a reader that cannot see it — two line numbers
          per row is noise — so the sign it carries is said in a word instead. */}
      <span className="whitespace-pre pr-3 pl-2 text-nb-ink">
        {tone && <span className="sr-only">{row.kind === "add" ? copy.lineAdded : copy.lineRemoved}</span>}
        {row.text || " "}
      </span>
    </div>
  );
}

/** The highest line number a file reaches, for sizing its number columns. */
function lastLine(rows: DiffRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    const n = Math.max(row.old ?? 0, row.new ?? 0);
    if (n) return n;
  }
  return 0;
}
