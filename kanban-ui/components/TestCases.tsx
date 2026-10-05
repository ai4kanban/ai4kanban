"use client";

// The project's test cases, read (#1422) — `docs/qa/`, three pages deep: a card per module, a
// card per case in one module, and one case. Drawn in the archive's frame, and re-read from disk
// on every visit and refresh. The one write is sending a feedback note to triage (#1459).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiInbox, FiMessageCircle } from "react-icons/fi";
import { sendFeedbackAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { CaseFile, CaseList, CaseModule, CaseSummary } from "@/lib/test-cases";
import type { AgentInfo, MemoryOwner } from "@/lib/types";
import type { CaseFiles } from "./case-evidence";
import { HAIRLINE } from "./chrome";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { Markdown } from "./Markdown";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { reloadSignalsRow } from "./signals-row";
import { Window } from "./Window";

export type TestCasesView =
  | { kind: "modules"; list: CaseList }
  | { kind: "module"; list: CaseList; module: CaseModule }
  | { kind: "case"; list: CaseList; file: CaseFile; sent: boolean[] };

const SOFT = { background: "var(--color-nb-sheet)", color: "var(--color-nb-ink-soft)" };
const GREY = { background: "color-mix(in srgb, var(--color-nb-ink) 7%, transparent)" };
const LABEL = "text-[10.5px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft";

const pad = (n: number) => String(n).padStart(2, "0");
const day = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const hrefOf = (...parts: string[]) => ["/test-cases", ...parts.filter(Boolean).map(encodeURIComponent)].join("/");

export function TestCasesPage({
  view,
  openIds,
  agent,
  projectRoot,
  memoryOwners,
  desktop,
}: {
  view: TestCasesView;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  memoryOwners: MemoryOwner[];
  desktop: boolean;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  // A run that rewrites a case shows on the page once it finishes, as on the archive.
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
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentTestCases
        memoryOwners={memoryOwners}
        running={runningCardIds(sessions)}
        header={<Header agent={agent} projectRoot={projectRoot} desktop={desktop} />}
      >
        <div className="h-full overflow-y-auto">
          <RunningNotice desktop={desktop} />
          <main className="mx-auto w-full max-w-[840px] px-6 py-6 max-md:px-4 max-md:py-4">
            {view.kind === "modules" && <Modules list={view.list} />}
            {view.kind === "module" && <Cases list={view.list} module={view.module} />}
            {view.kind === "case" && <CaseView list={view.list} file={view.file} sent={view.sent} />}
          </main>
        </div>
      </Window>
    </OpenIdsProvider>
  );
}

function Modules({ list }: { list: CaseList }) {
  const c = useCopy().rail.testCases;
  return (
    <>
      <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">{c.row}</h1>
      <p className="mt-1 text-[12px] text-nb-ink-soft">{c.summary(list.total, list.modules.length)}</p>
      <div className="mt-5 grid grid-cols-2 gap-5 pb-1 pr-1 max-md:mt-4 max-md:grid-cols-1 max-md:gap-3.5">
        {list.modules.map((m) => (
          <Link key={m.name} href={hrefOf(m.name)} className="nb-panel-sm nb-press flex flex-col p-4 text-left">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[16px] font-[800] leading-tight">{m.name}</span>
              <span className="nb-chip" style={GREY}>
                {c.cases(m.cases.length)}
              </span>
              <FiChevronRight size={16} className="shrink-0 text-nb-ink-soft" aria-hidden />
            </span>
            <span className={`mb-1 mt-3.5 ${LABEL}`}>{c.latest}</span>
            <span className="flex flex-col">
              {m.cases.slice(0, 3).map((k, i) => (
                <span
                  key={k.slug}
                  className="flex h-[30px] items-center gap-3 text-[12.5px]"
                  style={{ borderTop: i ? `1px solid ${HAIRLINE}` : undefined }}
                >
                  <span className="min-w-0 flex-1 truncate">{k.title}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">{day(k.updated)}</span>
                </span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

function NotesChip({ count }: { count: number }) {
  const c = useCopy().rail.testCases;
  return (
    <span className="nb-chip" title={c.notesTip} style={SOFT}>
      <FiMessageCircle style={{ width: 10, height: 10, flex: "0 0 auto" }} aria-hidden />
      {c.notes(count)}
    </span>
  );
}

function CaseCard({ k }: { k: CaseSummary }) {
  const c = useCopy().rail.testCases;
  return (
    <Link href={hrefOf(k.module, k.slug)} className="nb-panel-sm nb-press flex flex-col p-3 text-left">
      {k.steps > 0 && (
        <span className="mb-1.5 truncate text-[11px] font-[700] text-nb-ink-soft">{c.proof(k.steps, k.shots, k.logs)}</span>
      )}
      <span className="line-clamp-2 text-[13px] font-[700] leading-[18px]">{k.title}</span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-3">
        <NotesChip count={k.notes} />
        <span className="font-mono text-[11px] tabular-nums text-nb-ink-soft" title={`${c.updated} ${day(k.updated)}`}>
          {day(k.updated)}
        </span>
      </span>
    </Link>
  );
}

function Cases({ list, module }: { list: CaseList; module: CaseModule }) {
  const c = useCopy().rail.testCases;
  return (
    <>
      {!list.flat && (
        <Link href="/test-cases" className="mb-1 inline-flex items-center gap-1 text-[12px] font-[600] text-nb-ink-soft hover:text-nb-ink">
          <FiChevronLeft size={13} aria-hidden />
          <span className="underline decoration-dotted underline-offset-2">{c.row}</span>
        </Link>
      )}
      <h1 className={`text-[20px] font-[800] leading-tight tracking-[-0.02em] ${list.flat ? "" : "font-mono"}`}>
        {list.flat ? c.row : module.name}
      </h1>
      <p className="mt-1 text-[12px] text-nb-ink-soft">{c.cases(module.cases.length)}</p>
      <div className="mt-5 grid grid-cols-3 gap-4 pb-1 pr-1 max-md:mt-4 max-md:grid-cols-1 max-md:gap-3">
        {module.cases.map((k) => (
          <CaseCard key={k.slug} k={k} />
        ))}
      </div>
    </>
  );
}

const crumb = "underline decoration-dotted underline-offset-2 hover:text-nb-ink";

function CaseView({ list, file, sent }: { list: CaseList; file: CaseFile; sent: boolean[] }) {
  const c = useCopy().rail.testCases;
  const caseFiles: CaseFiles = useMemo(
    () => ({
      files: file.evidence,
      none: Object.values(file.evidence).length > 0 && Object.values(file.evidence).every((e) => e.kind === "missing"),
      base: ["/test-case-file", ...[file.module, file.slug].filter(Boolean).map(encodeURIComponent)].join("/"),
    }),
    [file.evidence, file.module, file.slug],
  );
  const labels = { setup: c.setup, steps: c.steps, feedback: c.feedback } as const;
  return (
    <>
      <p className="mb-0.5 truncate text-[11px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        <Link href="/test-cases" className={crumb}>
          {c.row}
        </Link>
        {!list.flat && (
          <>
            {" · "}
            <Link href={hrefOf(file.module)} className={crumb}>
              {file.module}
            </Link>
          </>
        )}
      </p>
      <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">{file.title}</h1>
      <p className="mt-1 break-all font-mono text-[11.5px] text-nb-ink-soft">{file.relPath}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="nb-chip" title={`${c.updated} ${day(file.updated)}`} style={SOFT}>
          <FiClock style={{ width: 10, height: 10, flex: "0 0 auto" }} aria-hidden />
          {day(file.updated)}
        </span>
        {caseFiles.none && (
          <span className="nb-chip" style={{ background: "var(--color-nb-peach-soft)", color: "var(--color-nb-peach-ink)" }}>
            <FiAlertCircle style={{ width: 10, height: 10, flex: "0 0 auto" }} aria-hidden />
            {c.noEvidence}
          </span>
        )}
        {file.feedback && (
          <a
            href="#feedback"
            className="nb-chip"
            style={{ background: "var(--color-nb-accent-wash)", color: "var(--color-nb-accent-deep)" }}
          >
            <FiMessageCircle style={{ width: 10, height: 10, flex: "0 0 auto" }} aria-hidden />
            {c.notes(file.notes)}
            <FiChevronDown style={{ width: 10, height: 10, flex: "0 0 auto" }} aria-hidden />
          </a>
        )}
      </div>

      {file.intro && <Markdown body={file.intro} caseFiles={caseFiles} className="mt-5" />}
      {file.sections.map((s, i) =>
        s.kind === "feedback" && file.feedback ? (
          <Feedback key={i} rows={file.feedback} caseFiles={caseFiles} segments={[file.module, file.slug].filter(Boolean)} sent={sent} />
        ) : s.kind === "other" ? (
          <Markdown key={i} body={`${s.heading}\n\n${s.body}`} caseFiles={caseFiles} className="mt-6" />
        ) : (
          <section key={i}>
            <h2 className={`mb-2 mt-6 ${LABEL}`}>{labels[s.kind as keyof typeof labels]}</h2>
            <Markdown body={s.body} caseFiles={caseFiles} />
          </section>
        ),
      )}
    </>
  );
}

function Feedback({
  rows,
  caseFiles,
  segments,
  sent,
}: {
  rows: NonNullable<CaseFile["feedback"]>;
  caseFiles: CaseFiles;
  segments: string[];
  sent: boolean[];
}) {
  const c = useCopy().rail.testCases;
  return (
    <section id="feedback" className="nb-section mt-6 scroll-mt-4 bg-nb-sheet px-4 pb-1.5 pt-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={LABEL}>{c.feedback}</h2>
        <span className="nb-chip" style={GREY}>
          {rows.notes.length}
        </span>
        <span className="ml-auto text-[11.5px] text-nb-ink-soft">{c.feedbackBy}</span>
      </div>
      {rows.lead && <Markdown body={rows.lead} caseFiles={caseFiles} className="mt-2.5 text-[13px]" />}
      <ul className="mt-2.5 flex flex-col">
        {rows.notes.map((n, i) => (
          <NoteRow key={i} note={n} index={i} caseFiles={caseFiles} segments={segments} sent={!!sent[i]} />
        ))}
      </ul>
    </section>
  );
}

const CHIP_TEXT = { textTransform: "none", letterSpacing: 0 } as const;

function NoteRow({
  note,
  index,
  caseFiles,
  segments,
  sent: sentBefore,
}: {
  note: NonNullable<CaseFile["feedback"]>["notes"][number];
  index: number;
  caseFiles: CaseFiles;
  segments: string[];
  sent: boolean;
}) {
  const c = useCopy().rail.testCases;
  const router = useRouter();
  const [sent, setSent] = useState(sentBefore);
  const [error, setError] = useState("");
  const [sending, startSending] = useTransition();
  useEffect(() => setSent(sentBefore), [sentBefore]);
  const send = () =>
    startSending(async () => {
      const done = await sendFeedbackAction(segments, index).catch(() => ({ ok: false, error: c.sendFailed }));
      if (done.ok) {
        setError("");
        setSent(true);
        router.refresh();
        reloadSignalsRow();
      } else setError(done.error || c.sendFailed);
    });
  // Shown on hover at desktop width, always on a phone, and kept while sending or after a failure.
  const shown = error || sending ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100";
  return (
    <li
      className={`group grid gap-x-5 py-3 max-md:flex max-md:flex-col max-md:gap-1 ${note.title ? "grid-cols-[208px_1fr_auto]" : "grid-cols-[1fr_auto]"}`}
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
    >
      {note.title && <Markdown body={`**${note.title}**`} className="text-[13px] leading-[1.5]" />}
      <div>
        <Markdown body={note.body} caseFiles={caseFiles} className="text-[13px] leading-[1.65] text-nb-ink-soft" />
        {error && <p className="mt-1 text-[12px] font-[600] text-nb-peach-ink">{error}</p>}
      </div>
      <div className="self-start max-md:mt-1">
        {sent ? (
          <span
            className="nb-chip whitespace-nowrap"
            style={{ ...CHIP_TEXT, background: "var(--color-nb-mint-soft)", color: "var(--color-nb-mint-ink)" }}
          >
            <FiCheck style={{ width: 10, height: 10 }} aria-hidden />
            {c.sent}
          </span>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className={`nb-chip cursor-pointer whitespace-nowrap transition-opacity disabled:cursor-wait disabled:opacity-60 ${shown}`}
            style={{
              ...CHIP_TEXT,
              background: "var(--color-nb-paper)",
              color: "var(--color-nb-ink)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-nb-ink) 22%, transparent)",
            }}
          >
            <FiInbox style={{ width: 11, height: 11 }} aria-hidden />
            {c.send}
          </button>
        )}
      </div>
    </li>
  );
}
