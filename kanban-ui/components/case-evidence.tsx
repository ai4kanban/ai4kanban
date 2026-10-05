"use client";

// A test case's evidence drawn where its link is (#1422): a screenshot, a text file opened in
// place, or a line saying the file is gone.

import { createContext, useContext, useState } from "react";
import { FiAlertCircle, FiChevronDown, FiChevronUp, FiFileText } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { Evidence } from "@/lib/test-cases";
import { HAIRLINE } from "./chrome";
import { ExpandableImage } from "./image-preview";

export interface CaseFiles {
  files: Record<string, Evidence>;
  /** Where the case folder's files are served — `/test-case-file/<module>/<case>`. */
  base: string;
  /** None of them is on this computer: the case says so once, not at every link. */
  none: boolean;
}

export const CaseFilesContext = createContext<CaseFiles | null>(null);

/** Lines a text file shows before it is opened in full. */
const FOLDED = 12;

export const fileUrl = (base: string, target: string) => `${base}/${target.replace(/^\.\//, "")}`;

function TextFile({ name, text, lines }: { name: string; text: string; lines: number }) {
  const c = useCopy().rail.testCases;
  const [open, setOpen] = useState(false);
  const long = lines > FOLDED;
  const shown = long && !open ? text.split("\n").slice(0, FOLDED).join("\n") : text;
  return (
    <div className="my-2.5 overflow-hidden rounded-[9px]" style={{ border: `1px solid ${HAIRLINE}` }}>
      <div className="flex h-[30px] items-center gap-1.5 bg-nb-sheet px-2.5 font-mono text-[11.5px] text-nb-ink-soft">
        <FiFileText size={12} className="shrink-0" aria-hidden />
        <span className="truncate">{name}</span>
      </div>
      {/* Not a <pre>: the prose scope frames every <pre> as a code block. */}
      <div className="whitespace-pre-wrap break-all px-3 py-2.5 font-mono text-[11.5px] leading-[1.6]">{shown}</div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-[30px] w-full cursor-pointer items-center gap-1 px-2.5 text-[11.5px] font-[700] text-nb-ink-soft hover:text-nb-ink"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
        >
          {open ? <FiChevronUp size={13} aria-hidden /> : <FiChevronDown size={13} aria-hidden />}
          {open ? c.fold : c.showAll(lines)}
        </button>
      )}
    </div>
  );
}

// A node remarkCaseFiles made, by the name `evidence`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EvidenceNode(props: any) {
  const c = useCopy().rail.testCases;
  const ctx = useContext(CaseFilesContext);
  const target = props["data-target"] as string;
  const alt = (props["data-alt"] as string | undefined) ?? "";
  const ev = ctx?.files[target];
  if (!ctx || !ev) return null;
  if (ev.kind === "missing") {
    if (ctx.none) return null;
    return (
      <p className="my-2.5 flex items-center gap-1.5 rounded-[9px] bg-nb-peach-soft px-2.5 py-2 text-[12px] font-[600] text-nb-peach-ink">
        <FiAlertCircle size={13} className="shrink-0" aria-hidden />
        <span className="min-w-0 break-all">{c.missing(target)}</span>
      </p>
    );
  }
  if (ev.kind === "text") return <TextFile name={target} text={ev.text} lines={ev.lines} />;
  return (
    <figure className="my-2.5">
      <ExpandableImage src={fileUrl(ctx.base, target)} alt={alt} className="block" hint />
      {alt && <figcaption className="mt-1 text-[11.5px] text-nb-ink-soft">{alt}</figcaption>}
    </figure>
  );
}
