// The setup page (#2132), after legacy kanban-ui/components/FirstRun.tsx and AgentProbe.tsx: full
// screen and not closable, two steps — connect a computer, then get an AI tool ready as the
// Global default. Home comes after both; a reload resumes at the step still undone.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FiAlertCircle, FiCheck, FiCopy, FiDownload, FiRefreshCw } from "react-icons/fi";
import { AgentMark } from "@review/components/agent-mark";
import { Button } from "@review/components/button";
import { LogoMark } from "@review/components/Logo";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { F } from "../first-run-i18n";
import { T } from "../i18n";
import { useNarrow } from "../lib/narrow";
import { CONNECTORS, INSTALL, LABEL, LOGIN, MARK, RUNTIMES_CHANGED } from "./Settings";

const RELEASES = "https://github.com/ai4kanban/ai4kanban/releases?q=desktop-v&expanded=true";
const OTHER_SYSTEMS = "https://github.com/ai4kanban/ai4kanban/tree/main/runner#readme";
const POLL_MS = 4000;
const ACCENT_BTN =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-nb-accent-soft px-2.5 py-1.5 text-[12px] font-[700] text-nb-accent-deep transition-[background-color,transform] duration-100 hover:bg-nb-accent/28 active:scale-[0.97] nb-focus disabled:cursor-not-allowed disabled:opacity-40";

const onlineRunner = (list: api.RuntimeList) => list.runners.find((x) => x.online) ?? null;
const defaultOf = (list: api.RuntimeList) => list.data.find((r) => r.default) ?? null;

/** An account with a computer and a ready default agent needs no setup. */
export function setupLooksDone(list: api.RuntimeList) {
  const def = defaultOf(list);
  return list.runners.length > 0 && !!def && list.connectors[def.connector] === "ready";
}

export function SetupPage({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | null>(null);
  useEffect(() => {
    api.listRuntimes().then(
      (list) => setStep(onlineRunner(list) ? 2 : 1),
      () => setStep(1),
    );
  }, []);
  if (step === null) return <Frame at={1} />;
  return step === 1 ? <ConnectStep onNext={() => setStep(2)} /> : <AgentStep onDone={onDone} />;
}

function Frame({ at, children }: { at: number; children?: ReactNode }) {
  const c = F.setup;
  const total = c.steps.length;
  const label = c.step(at, total);
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-nb-paper pt-[env(safe-area-inset-top)] font-sans text-nb-ink">
      <div className="flex shrink-0 items-center gap-2.5 px-9 pt-4 max-md:px-5">
        <LogoMark />
        <span className="text-[13.5px] font-[800]">{c.title}</span>
        <span className="ml-auto flex items-center gap-2 text-[12px] font-[700] text-nb-ink-soft" role="img" aria-label={label}>
          <span className="flex items-center gap-[6px]">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className="block size-[7px] rounded-full"
                style={{ background: i === at - 1 ? "var(--color-nb-accent)" : i < at - 1 ? "var(--color-nb-ink-soft)" : "color-mix(in srgb, var(--color-nb-ink) 20%, transparent)" }}
              />
            ))}
          </span>
          <span className="ml-0.5 tabular-nums">{label}</span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-9 max-md:px-6">
        <div className="w-full max-w-[720px] py-10 max-md:py-8">{children}</div>
      </div>
    </div>
  );
}

const Ask = ({ children }: { children: ReactNode }) => <p className="text-[30px] font-[800] leading-[1.22] tracking-[-0.01em] max-md:text-[26px]">{children}</p>;
const Under = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[15px] leading-[1.6] text-nb-ink-soft">{children}</p>;

function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    (text) =>
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }, () => {}),
  ];
}

// ---- 1 · the computer --------------------------------------------------------

const osName = () => {
  const ua = navigator.userAgent;
  return /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : null;
};

/** The three things to do, and the account's live state under them; moves on once a computer is online. */
function ConnectStep({ onNext }: { onNext: () => void }) {
  const c = F.setup.connect;
  const phone = useNarrow();
  const [machine, setMachine] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, copy] = useCopied();
  const check = useCallback(async () => {
    try {
      const found = onlineRunner(await api.listRuntimes());
      if (found) setMachine(found.name);
    } catch {
      // Still none: the next look tries again.
    }
  }, []);
  useEffect(() => {
    if (machine) {
      const t = setTimeout(onNext, 1200);
      return () => clearTimeout(t);
    }
    const t = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(t);
  }, [machine, check, onNext]);

  if (phone)
    return (
      <Frame at={1}>
        <Ask>{c.ask}</Ask>
        <Under>{c.phone}</Under>
        <div className="mt-7">
          <Button onClick={() => copy(location.origin)}>
            {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
            {copied ? c.copied : c.copyLink}
          </Button>
        </div>
      </Frame>
    );
  const os = osName();
  return (
    <Frame at={1}>
      <Ask>{c.ask}</Ask>
      <Under>{c.blurb}</Under>
      <ol className="mt-7 space-y-4">
        {c.todo.map((line, i) => (
          <li key={i} className="flex items-start gap-3 text-[14.5px] leading-[1.5]">
            <span className="grid size-[24px] shrink-0 place-items-center rounded-full bg-nb-sheet font-mono text-[12px] font-[800]">{i + 1}</span>
            <div className="min-w-0 pt-[2px]">
              {line}
              {i === 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Button onClick={() => window.open(RELEASES, "_blank", "noopener")}>
                    <FiDownload aria-hidden />
                    {os ? c.download(os) : c.downloadAny}
                  </Button>
                  <a href={OTHER_SYSTEMS} target="_blank" rel="noreferrer" className="text-[13px] font-[700] text-nb-ink-soft underline underline-offset-2 hover:text-nb-ink">
                    {c.other}
                  </a>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {machine ? (
        <p aria-live="polite" className="mt-8 flex items-center gap-2.5 rounded-[12px] bg-nb-mint-soft px-4 py-3 text-[13.5px] font-[700]">
          <FiCheck aria-hidden className="text-[16px]" />
          {c.connected(machine)}
        </p>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-[12px] bg-nb-sheet px-4 py-3">
          <span className="min-w-0 flex-1 text-[13.5px] font-[700] text-nb-ink-soft">{c.none}</span>
          <button
            type="button"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              await check();
              setChecking(false);
            }}
            className={ACCENT_BTN}
          >
            <FiRefreshCw className={cn("text-[13px]", checking && "animate-spin")} aria-hidden />
            {checking ? c.checking : c.recheck}
          </button>
        </div>
      )}
    </Frame>
  );
}

// ---- 2 · the agent -----------------------------------------------------------

/** The character from legacy AgentProbe.tsx, on its 12-unit grid. */
function AgentSprite() {
  const ink = "var(--color-nb-ink)";
  const paper = "var(--color-nb-paper)";
  const ember = "var(--color-nb-accent)";
  return (
    <svg viewBox="0 0 12 17" width={96} height={136} shapeRendering="crispEdges" aria-hidden>
      <style>{`@keyframes nbSpriteHop{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}@keyframes nbSpriteShadow{0%,100%{transform:scaleX(1);opacity:.22}50%{transform:scaleX(.66);opacity:.12}}.a4k-sprite{animation:nbSpriteHop .72s steps(1,end) infinite}.a4k-sprite-shadow{opacity:.22;transform-box:fill-box;transform-origin:center;animation:nbSpriteShadow .72s steps(1,end) infinite}@media (prefers-reduced-motion: reduce){.a4k-sprite,.a4k-sprite-shadow{animation:none}}`}</style>
      <rect className="a4k-sprite-shadow" x="3" y="16" width="6" height="1" fill={ink} />
      <g className="a4k-sprite">
        <rect x="5" y="0" width="2" height="1" fill={ember} />
        <rect x="5" y="1" width="2" height="1" fill={ink} />
        <rect x="2" y="2" width="8" height="5" fill={ink} />
        <rect x="3" y="3" width="6" height="3" fill={paper} />
        <rect x="4" y="4" width="1" height="1" fill={ember} />
        <rect x="7" y="4" width="1" height="1" fill={ember} />
        <rect x="5" y="7" width="2" height="1" fill={ink} />
        <rect x="0" y="9" width="1" height="3" fill={ink} />
        <rect x="11" y="9" width="1" height="3" fill={ink} />
        <rect x="2" y="8" width="8" height="5" fill={ink} />
        <rect x="3" y="9" width="6" height="3" fill={paper} />
        <rect x="4" y="10" width="4" height="1" fill={ember} />
        <rect x="3" y="13" width="2" height="2" fill={ink} />
        <rect x="7" y="13" width="2" height="2" fill={ink} />
      </g>
    </svg>
  );
}

type Phase = { kind: "looking" } | { kind: "found"; connector: api.Connector } | { kind: "pick" };

/** The first ready agent becomes the Global default and is tested; with none, the user picks one. */
function AgentStep({ onDone }: { onDone: () => void }) {
  const c = F.setup.agent;
  const [list, setList] = useState<api.RuntimeList | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "looking" });
  const [picked, setPicked] = useState<api.Connector | null>(null);
  const [testing, setTesting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, copy] = useCopied();
  const started = useRef(false);

  /** Make `connector` the Global default on the online computer and test it; true when it answers. */
  const tryConnector = useCallback(async (connector: api.Connector) => {
    setProblem(null);
    let current = await api.listRuntimes();
    const def = defaultOf(current);
    const runner = onlineRunner(current);
    if (!def || !runner) {
      setList(current);
      setProblem(c.offline);
      return false;
    }
    let passed = false;
    try {
      if (def.connector !== connector || def.runner !== runner.id)
        await api.updateRuntime(def.id, { connector, runner: runner.id, ...(def.connector !== connector && { model: null }) });
      const res = await api.testRuntime(def.id);
      const h = LABEL[connector];
      const s = ((res.elapsed_ms ?? 0) / 1000).toFixed(0);
      passed = res.result === "passed";
      if (res.result === "timeout") setProblem(T.test.timedOut(s));
      else if (res.result === "failed") setProblem(`${T.test.failed(h)} ${res.message ?? ""}`.trim());
    } catch (e) {
      setProblem(e instanceof api.ApiError && e.code === "runner_offline" ? c.offline : T.errors.generic);
    }
    window.dispatchEvent(new Event(RUNTIMES_CHANGED));
    current = await api.listRuntimes().catch(() => current);
    setList(current);
    if (passed) setPhase({ kind: "found", connector });
    return passed;
  }, [c]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      let first: api.RuntimeList;
      try {
        first = await api.listRuntimes();
      } catch {
        setPhase({ kind: "pick" });
        return;
      }
      setList(first);
      const ready = CONNECTORS.find((k) => first.connectors[k] === "ready");
      if (ready && (await tryConnector(ready))) return;
      setPicked(ready ?? CONNECTORS.find((k) => first.connectors[k] === "signed_out") ?? CONNECTORS.find((k) => k in first.connectors) ?? CONNECTORS[0]!);
      setPhase({ kind: "pick" });
    })();
  }, [tryConnector]);

  useEffect(() => {
    if (phase.kind !== "found") return;
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase.kind !== "pick")
    return (
      <Frame at={2}>
        <div className="flex flex-col items-center gap-6 text-center">
          <AgentSprite />
          {phase.kind === "found" ? (
            <div aria-live="polite">
              <p className="flex items-center justify-center gap-2 text-[17px] font-[700] leading-snug">
                <AgentMark harness={MARK[phase.connector]} size={18} />
                {c.found(LABEL[phase.connector])}
              </p>
              <p className="mt-2 text-[13px] text-nb-ink-soft">{c.foundNote}</p>
            </div>
          ) : (
            <p className="text-[15px] font-[700] text-nb-ink-soft">{c.looking}</p>
          )}
        </div>
      </Frame>
    );

  const shown = list && Object.keys(list.connectors).length ? CONNECTORS.filter((k) => k in list.connectors) : CONNECTORS;
  const stateOf = (k: api.Connector) => list?.connectors[k];
  const word = (k: api.Connector) => (stateOf(k) === "signed_out" ? T.runtimes.signedOut : stateOf(k) === "not_installed" ? T.runtimes.notInstalled : "");
  const test = async () => {
    if (!picked) return;
    setTesting(true);
    await tryConnector(picked);
    setTesting(false);
  };
  return (
    <Frame at={2}>
      <Ask>{c.ask}</Ask>
      <Under>{c.blurb}</Under>
      <div role="radiogroup" className="mt-6 rounded-[12px] bg-nb-sheet">
        {shown.map((k) => {
          const on = k === picked;
          const out = stateOf(k) === "signed_out";
          const command = out ? LOGIN[k] : INSTALL[k];
          return (
            <div key={k} className="border-t border-nb-ink/10 first:border-t-0">
              <button type="button" role="radio" aria-checked={on} onClick={() => setPicked(k)} className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left nb-focus">
                <span className={cn("grid size-[16px] shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-nb-accent" : "border-nb-ink/30")}>
                  {on && <span className="size-[8px] rounded-full bg-nb-accent" />}
                </span>
                <AgentMark harness={MARK[k]} size={16} />
                <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", on ? "font-[800]" : "font-[700]")}>{LABEL[k]}</span>
                {!on && word(k) && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-nb-peach-soft px-2 py-0.5 text-[11.5px] font-[700] text-nb-peach-ink">
                    <FiAlertCircle className="shrink-0 text-[11px]" aria-hidden />
                    {word(k)}
                  </span>
                )}
              </button>
              {on && word(k) && (
                <div className="px-3.5 pb-3.5">
                  <div className="rounded-[10px] bg-nb-peach-soft px-3 py-2.5">
                    <p className="flex items-center gap-2 text-[13px] font-[700] text-nb-peach-ink">
                      <FiAlertCircle className="shrink-0" aria-hidden />
                      {out ? c.signedOutHint(LABEL[k]) : c.notInstalledHint(LABEL[k])}
                    </p>
                    <div className="mt-2 flex items-center gap-2 max-md:flex-wrap">
                      <code className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-nb-paper py-1 pl-2.5 pr-1 font-mono text-[12.5px] text-nb-ink">
                        <span className="min-w-0 flex-1 truncate">{command}</span>
                        <button type="button" title={copied ? T.runtimes.copied : T.runtimes.copy} aria-label={copied ? T.runtimes.copied : T.runtimes.copy} onClick={() => copy(command)} className="grid size-[24px] shrink-0 cursor-pointer place-items-center rounded-[6px] text-nb-ink-soft hover:bg-nb-wash hover:text-nb-ink nb-focus">
                          {copied ? <FiCheck className="text-[13px] text-nb-mint-ink" aria-hidden /> : <FiCopy className="text-[13px]" aria-hidden />}
                        </button>
                      </code>
                      <button type="button" disabled={testing} onClick={() => void test()} className={ACCENT_BTN}>
                        <FiRefreshCw className={cn("text-[13px]", testing && "animate-spin")} aria-hidden />
                        {testing ? T.runtimes.rechecking : T.runtimes.recheck}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {problem && (
        <p aria-live="polite" className="mt-3 flex items-start gap-1.5 break-words text-[12.5px] font-[700] text-nb-peach-ink">
          <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
          <span className="min-w-0">{problem}</span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button disabled={!picked || testing} onClick={() => void test()}>
          {testing ? c.testing : c.test}
        </Button>
        {picked && <span className="text-[13px] text-nb-ink-soft">{c.testNote(LABEL[picked])}</span>}
      </div>
    </Frame>
  );
}
