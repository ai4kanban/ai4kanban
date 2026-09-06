"use client";

// The board's team, in one pane (#422).
//
// Everyone working on your cards is here: the roles the board's own flows are run by, the
// specialists the command ships, then the ones this project added. One grid of characters,
// and a page under whichever one you select.
//
// It replaces two screens. The Spec agents tile listed the specialists and switched them;
// the Rules pane wrote a rule per FLOW, in a column of command names. A rule belongs to an
// agent now, so who works on your cards and how you train them are one list rather than two
// that never mentioned each other.
//
// What this pane knows: nothing. The names, what each one does, whether it may be switched
// off, the memory it owns and the settings it declares are the board's own roster, asked
// for when the pane opens — so an agent shipped later, or one this project adds, is drawn
// here with nothing in this file touched.
//
// The characters are PNGs under `public/agent-art/`, one per bundled agent, named by the
// agent. An agent with no art draws its first letter in the same pixel style, which is the
// normal state for an agent you add — never a broken image.

import { useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiPlus } from "react-icons/fi";
import {
  agentsAction,
  createAgentAction,
  saveAgentFileAction,
  setAgentRuleAction,
  setSpecAgentAction,
  setSpecAgentSettingAction,
} from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import type { AgentView, SpecAgentSettingView } from "@/lib/types";
import { CAPTION, Group, Loading, Note, QUIET_BTN, Switch } from "./settings";

export function AgentsPanel({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.agents;
  const [agents, setAgents] = useState<AgentView[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Which agent's page is open. The pane opens with none: the grid is the answer to "who
  // works on this board", and a page opened for you is a page you did not ask for.
  const [picked, setPicked] = useState("");
  // What the two boxes hold right now, by agent, so selecting another tile never loses an
  // edit that has not been saved yet.
  const [rules, setRules] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  // The agent whose rule was saved last, for the quiet `Saved` beside the caption.
  const [savedRule, setSavedRule] = useState("");
  // Why the board refused an `AGENT.md`, and whose. It holds the page open on that agent:
  // an agent left with a file the catalog cannot read drops out of the roster into the
  // problems list, with no way back into it from here.
  const [refusal, setRefusal] = useState<{ agent: string; why: string } | null>(null);
  // What is being saved right now, by the thing being saved: an agent's name for its
  // switch, `name/key` for one of its settings.
  const [saving, setSaving] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  // Focus the new agent's `AGENT.md` box once, when Add a specialist lands on it — the
  // whole point of the button is to carry straight on into writing the prompt.
  const [focusFile, setFocusFile] = useState(false);

  // The roster, and the boxes seeded from it. Read when the pane opens, and again after a
  // specialist is added — the board decides what the new agent's file says, so the pane
  // takes its answer rather than assembling one.
  const load = async (): Promise<void> => {
    const res = await agentsAction();
    setAgents(res.agents);
    setProblems(res.problems);
    setLoadError(res.error ?? null);
    setLoaded(true);
    if (!res.agents) return;
    setRules(Object.fromEntries(res.agents.map((a) => [a.name, a.rule])));
    setFiles(Object.fromEntries(res.agents.filter((a) => a.file).map((a) => [a.name, a.file!.text])));
  };

  useEffect(() => {
    void load();
  }, []);

  // Saving what a page holds when it is left. Read off a ref rather than off the render the
  // callback was made in, because one of the callers below fires as the pane is coming
  // apart. Unchanged text writes nothing, so calling it twice for one edit is free.
  //
  // A rule is free text, so a failure is only ever the board's — it goes to the dialog's
  // error strip. An `AGENT.md` can be wrong, and that answer belongs on the agent's own
  // page, which is why leaving can be refused.
  const latest = useRef({ agents, rules, files, onError, c });
  latest.current = { agents, rules, files, onError, c };
  const leave = useRef(async (name: string): Promise<boolean> => {
    const box = latest.current;
    const agent = box.agents?.find((a) => a.name === name);
    if (!agent) return true;

    const rule = (box.rules[name] ?? "").trim();
    if (rule !== agent.rule) {
      const res = await setAgentRuleAction(name, rule);
      if (res.ok) {
        setAgents((all) => all?.map((a) => (a.name === name ? { ...a, rule } : a)) ?? all);
        setSavedRule(name);
      } else {
        box.onError?.(res.error || box.c.ruleFailed(name));
      }
    }

    const text = box.files[name];
    if (agent.file && text !== undefined && text !== agent.file.text) {
      const res = await saveAgentFileAction(name, text);
      if (!res.ok) {
        setRefusal({ agent: name, why: res.error || box.c.ruleFailed(name) });
        return false;
      }
      setAgents((all) => all?.map((a) => (a.name === name ? { ...a, file: { ...a.file!, text } } : a)) ?? all);
    }
    // Past the save, the box and the file say the same thing — written just now, or put back
    // to what was already there. Either way nothing is unsaved, so a refusal still on screen
    // would be telling the user their text is lost while it is sitting in the file.
    if (agent.file) setRefusal((was) => (was?.agent === name ? null : was));
    return true;
  });

  // Save the page being left, whether or not a blur comes: selecting another tile blurs the
  // box, but closing the dialog takes it off screen with the caret still in it. A refusal at
  // that point drops the text — the file keeps its last accepted version, so the pane can
  // never leave an agent broken behind it.
  useEffect(() => {
    if (!picked) return;
    const write = leave.current;
    return () => {
      void write(picked);
    };
  }, [picked]);

  // One page at a time: another tile swaps the page, the open tile closes it. A refused
  // `AGENT.md` holds the selection where it is, with the reason showing.
  const select = async (name: string) => {
    if (!picked) return setPicked(name);
    if (!(await leave.current(picked))) return;
    setPicked(picked === name ? "" : name);
  };

  // Flip one switch: on screen at once, saved behind it, and put back if the save fails. A
  // switch that silently didn't land is a setting the user can't trust.
  const flip = async (agent: AgentView, on: boolean) => {
    setAgents((all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: on } : a)) ?? all);
    setSaving((names) => [...names, agent.name]);
    try {
      const res = await setSpecAgentAction(agent.name, on);
      if (!res.ok) {
        setAgents((all) => all?.map((a) => (a.name === agent.name ? { ...a, enabled: !on } : a)) ?? all);
        onError?.(res.error || (on ? c.flipFailedOn : c.flipFailedOff)(agentTitle(agent.name)));
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== agent.name));
    }
  };

  // Pick one of an agent's settings (#257) — the switch's own behaviour, for the same reason.
  const pick = async (agent: AgentView, key: string, value: string) => {
    const was = agent.values?.[key] ?? "";
    if (value === was) return;
    const put = (v: string) =>
      setAgents(
        (all) => all?.map((a) => (a.name === agent.name ? { ...a, values: { ...a.values, [key]: v } } : a)) ?? all,
      );
    const token = `${agent.name}/${key}`;
    put(value);
    setSaving((names) => [...names, token]);
    try {
      const res = await setSpecAgentSettingAction(agent.name, key, value);
      if (!res.ok) {
        put(was);
        onError?.(res.error || c.saveFailed(agentTitle(agent.name)));
      }
    } finally {
      setSaving((names) => names.filter((n) => n !== token));
    }
  };

  // Opening the new tile leaves the page that is open, so a refused `AGENT.md` holds the
  // selection here the way selecting another character does.
  const openAdd = async () => {
    if (picked && !(await leave.current(picked))) return;
    setAdding(true);
  };

  // Add a specialist finishes on the new agent's own page, with its `AGENT.md` box focused:
  // an agent whose file is still the template is an agent that does nothing.
  const create = async (name: string): Promise<string> => {
    const res = await createAgentAction(name);
    if (!res.ok) return res.error || c.saveFailed(name);
    setAdding(false);
    await load();
    setPicked(res.agent ?? name);
    setFocusFile(true);
    return "";
  };

  const agent = agents?.find((a) => a.name === picked);

  return (
    <Group
      title={c.title}
      action={
        agents && !adding ? (
          <button type="button" className={QUIET_BTN} onClick={() => void openAdd()}>
            <FiPlus aria-hidden />
            {c.add}
          </button>
        ) : undefined
      }
    >
      {loadError && <Note icon={<FiAlertCircle />}>{loadError}</Note>}
      {!loaded && <Loading>{c.loading}</Loading>}
      {loaded && !loadError && agents === null && <Note icon={<FiAlertCircle />}>{c.tooOld}</Note>}

      {agents && (
        <>
          {/* Roles first, then the specialists the command ships, then this project's own
              — one grid, in the board's own order. Fixed tracks, so a short roster leaves
              empty ones rather than stretching its tiles. */}
          <div className="grid grid-cols-5 gap-3 max-sm:grid-cols-3">
            {agents.map((a) => (
              <Tile
                key={a.name}
                agent={a}
                held={a.name === picked}
                busy={saving.includes(a.name)}
                onOpen={() => void select(a.name)}
                onFlip={(next) => flip(a, next)}
              />
            ))}
            {adding && <NewTile onCreate={create} onCancel={() => setAdding(false)} />}
          </div>

          {agent && (
            <Page
              agent={agent}
              rule={rules[agent.name] ?? ""}
              file={files[agent.name]}
              saved={savedRule === agent.name}
              refusal={refusal && refusal.agent === agent.name ? refusal.why : ""}
              focusFile={focusFile}
              onFocused={() => setFocusFile(false)}
              onRule={(text) => {
                setRules((all) => ({ ...all, [agent.name]: text }));
                setSavedRule("");
              }}
              onFile={(text) => setFiles((all) => ({ ...all, [agent.name]: text }))}
              onLeave={() => void leave.current(agent.name)}
              onPick={(key, value) => void pick(agent, key, value)}
              busy={(key) => saving.includes(`${agent.name}/${key}`)}
            />
          )}

          {problems.length > 0 && (
            <Note icon={<FiAlertCircle />}>
              {c.problems}
              {problems.map((problem) => (
                <span key={problem} className="mt-1 block">
                  {problem}
                </span>
              ))}
            </Note>
          )}
          <Note>{c.blurb}</Note>
        </>
      )}
    </Group>
  );
}

// --- one agent in the grid ---------------------------------------------------

// The character, the name and the state it is in. The switch sits in the tile's corner,
// over it but OUTSIDE its select target, so flipping it never opens or closes a page. A
// role has no switch: a board without a planner plans nothing. A paused agent keeps its
// character, greyed, and keeps its page.
//
// Two lines are reserved for the name, so `Technology selection` wraps in full and every
// tile keeps one height. Nothing here is ever cut off.
function Tile({
  agent,
  held,
  busy,
  onOpen,
  onFlip,
}: {
  agent: AgentView;
  held: boolean;
  busy: boolean;
  onOpen: () => void;
  onFlip: (next: boolean) => Promise<void>;
}) {
  const c = useCopy().configuration.agents;
  const title = agentTitle(agent.name);
  const off = !agent.enabled;
  return (
    <div
      // No frame: the tile is a plate on the pane, and the ember wash is what says which one
      // is open.
      className={`relative rounded-[12px] ${held ? "bg-nb-accent-soft" : "bg-nb-sheet"}`}
    >
      {agent.switchable && (
        <span className="absolute right-[7px] top-[7px] z-10 scale-[0.62] origin-top-right">
          <Switch on={agent.enabled} busy={busy} label={(agent.enabled ? c.switchOn : c.switchOff)(title)} onFlip={onFlip} />
        </span>
      )}
      <button
        type="button"
        aria-expanded={held}
        aria-label={c.open(title)}
        onClick={onOpen}
        className="flex h-[108px] w-full cursor-pointer flex-col items-center rounded-[11px] px-2 pb-1.5 pt-[7px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent"
      >
        <span className={`flex h-[48px] items-end ${off ? "opacity-30 grayscale" : ""}`}>
          <Character name={agent.name} />
        </span>
        <span
          className={`mt-[5px] flex h-[28px] w-full items-start justify-center text-center text-[12.5px] font-[700] leading-[14px] break-words ${
            off ? "text-nb-ink-soft" : "text-nb-ink"
          }`}
        >
          {title}
        </span>
        <span className={`${CAPTION} mt-auto text-[10px] tracking-[0.08em] text-nb-ink-soft`}>
          {!agent.switchable ? c.alwaysOn : off ? c.paused : c.enabled}
        </span>
      </button>
    </div>
  );
}

// Add a specialist finishes here: the tile the new agent will occupy asks for its name, and
// a name already taken — by a bundled agent, by a role, or by a folder already under
// `docs/kanban/agents/` — is refused right in this cell, so the pane never creates the clash
// it would then have to report as a problem.
function NewTile({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => Promise<string>;
  onCancel: () => void;
}) {
  const c = useCopy().configuration.agents;
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setWhy(await onCreate(name.trim()));
    setBusy(false);
  };

  return (
    <div className="flex min-h-[108px] flex-col rounded-[12px] bg-nb-sheet px-2 pb-1.5 pt-[7px]">
      <span className={`${CAPTION} text-[10px] tracking-[0.08em] text-nb-ink-soft`}>{c.newAgent}</span>
      <input
        autoFocus
        value={name}
        disabled={busy}
        spellCheck={false}
        aria-label={c.newAgent}
        placeholder={c.namePlaceholder}
        onChange={(e) => {
          setName(e.target.value);
          setWhy("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
          if (e.key === "Escape") onCancel();
        }}
        className="mt-[5px] w-full rounded-[8px] bg-nb-paper px-2 py-[3px] font-mono text-[11.5px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent disabled:cursor-wait"
      />
      <span className="mt-[3px] block text-[10.5px] leading-[13px] text-nb-ink-soft">{why || c.nameHint}</span>
      <span className="mt-auto flex items-center gap-1.5 pt-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="cursor-pointer rounded-[7px] bg-nb-accent px-2 py-[3px] text-[11px] font-[800] text-nb-paper disabled:cursor-wait disabled:opacity-60"
        >
          {c.create}
        </button>
        <button type="button" onClick={onCancel} className="cursor-pointer px-1 text-[11px] font-[700] text-nb-ink-soft">
          {c.cancel}
        </button>
      </span>
    </div>
  );
}

// --- the page under the grid -------------------------------------------------

// Everything the selected agent is: the rule you write for it, the files it remembers in,
// the settings it declares, and — for an agent this project added — the whole of its
// `AGENT.md`, frontmatter included. A bundled agent shows no such box: its file ships inside
// the command.
//
// Each box saves itself when it is left, with no pane-wide Save button, the way every other
// setting in this dialog already behaves.
function Page({
  agent,
  rule,
  file,
  saved,
  refusal,
  focusFile,
  onFocused,
  onRule,
  onFile,
  onLeave,
  onPick,
  busy,
}: {
  agent: AgentView;
  rule: string;
  file: string | undefined;
  saved: boolean;
  /** Why the board refused this agent's `AGENT.md`, or empty. */
  refusal: string;
  focusFile: boolean;
  onFocused: () => void;
  onRule: (text: string) => void;
  onFile: (text: string) => void;
  onLeave: () => void;
  onPick: (key: string, value: string) => void;
  busy: (key: string) => boolean;
}) {
  const c = useCopy().configuration.agents;
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focusFile) return;
    box.current?.focus();
    onFocused();
  }, [focusFile, onFocused]);

  return (
    <div className="mt-3 border-t border-nb-ink/10 pt-3">
      <div className="mb-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13.5px] font-[800] text-nb-ink">{agentTitle(agent.name)}</span>
          <span className="min-w-0 text-[11.5px] text-nb-ink-soft">{sentence(agent.gloss)}</span>
          {agent.file && (
            <span className="min-w-0 font-mono text-[11px] text-nb-ink-soft">
              {c.yours} · {agent.file.path}
            </span>
          )}
        </div>
        {/* A specialist is asked for by its own trigger, so the page says when — a role is
            called by its flows and has nothing to say here. */}
        {agent.when && (
          <p className="mt-0.5 max-w-[80ch] text-[11.5px] leading-snug text-nb-ink-soft">
            <span className="font-[700]">{c.runsWhen}</span> {clause(agent.when.replace(/^use when\s+/i, ""))}
          </p>
        )}
      </div>

      <div className="flex items-start gap-4 max-sm:flex-col">
        <div className="min-w-0 flex-1">
          <Cap
            right={
              saved && (
                <span className="flex items-center gap-1 text-[11px] font-[700] text-nb-mint-ink">
                  <FiCheck aria-hidden />
                  {c.saved}
                </span>
              )
            }
          >
            {c.rule}
          </Cap>
          <textarea
            key={`rule/${agent.name}`}
            value={rule}
            onChange={(e) => onRule(e.target.value)}
            onBlur={onLeave}
            spellCheck={false}
            aria-label={c.ruleLabel(agent.name)}
            placeholder={c.rulePlaceholder(agent.name)}
            className="h-[64px] w-full resize-none rounded-[10px] bg-nb-wash px-3 py-2 text-[12px] leading-[17px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
          />

          {agent.memory.length > 0 && (
            <div className="mt-3">
              <Cap>{c.remembers}</Cap>
              <div className="flex flex-col gap-1">
                {agent.memory.map((file: string) => (
                  <div
                    key={file}
                    className="flex items-center justify-between gap-2 rounded-[9px] bg-nb-sheet px-3 py-[5px]"
                  >
                    <span className="min-w-0 truncate font-mono text-[11.5px] text-nb-ink-soft">{file}</span>
                    <span className="shrink-0 rounded-[5px] bg-nb-ink/7 px-1.5 py-[2px] text-[9.5px] font-[800] uppercase tracking-[0.08em] text-nb-ink-soft">
                      {c.readOnly}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agent.settings.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {agent.settings.map((setting: SpecAgentSettingView) => (
                <SettingLine
                  key={setting.key}
                  setting={setting}
                  value={agent.values?.[setting.key] ?? setting.default}
                  off={!agent.enabled}
                  busy={busy(setting.key)}
                  onPick={(value) => onPick(setting.key, value)}
                />
              ))}
            </div>
          )}
        </div>

        {agent.file && (
          <div className="w-[330px] shrink-0 max-sm:w-full">
            <Cap>{c.file}</Cap>
            <textarea
              ref={box}
              key={`file/${agent.name}`}
              value={file ?? ""}
              onChange={(e) => onFile(e.target.value)}
              onBlur={onLeave}
              spellCheck={false}
              aria-label={c.fileLabel(agent.name)}
              className="h-[132px] w-full resize-none rounded-[10px] bg-nb-wash px-2.5 py-2 font-mono text-[11px] leading-[15px] text-nb-ink focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
            />
            {/* The board reads the text the way its catalog reads an agent. A save it would
                refuse keeps every word of it, keeps this page open, and says what is wrong. */}
            {refusal && (
              <p className="mt-2 flex items-start gap-2 rounded-[9px] bg-nb-peach-soft px-2.5 py-[7px] text-[11.5px] leading-[16px] text-nb-peach-ink">
                <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
                <span className="min-w-0">
                  {c.notSaved} {refusal}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Cap({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-[5px] flex items-center justify-between gap-2">
      <span className={`${CAPTION} text-nb-ink-soft`}>{children}</span>
      {right}
    </div>
  );
}

// --- the characters ----------------------------------------------------------

// The art is one PNG per agent at `public/agent-art/<name>.png`, drawn on a shared canvas
// with a shared pixel size — `agent-art.md` beside `design.md` is the recipe. An agent with
// no file of its own draws its first letter instead, in the same style, so the pane is
// never a row of broken images and two art-less agents still differ.
function Character({ name }: { name: string }) {
  const [art, setArt] = useState(true);
  useEffect(() => setArt(true), [name]);
  if (!art) return <Letter name={name} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/agent-art/${name}.png`}
      alt=""
      width={48}
      height={48}
      onError={() => setArt(false)}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// The palette's five inks, picked by the agent's name — so two agents without art are two
// different colours and stay the colour they were.
const INKS = [
  "var(--color-nb-sky-ink)",
  "var(--color-nb-lilac-ink)",
  "var(--color-nb-mint-ink)",
  "var(--color-nb-peach-ink)",
  "var(--color-nb-accent-deep)",
];

// A 5x7 letter, each cell drawn as a 2x2 block on the same 16x16 canvas the art uses, at
// the same pixel size — the letter reads as one of the characters rather than as text that
// wandered into the grid.
const GLYPHS: Record<string, string> = {
  a: "01110 10001 10001 11111 10001 10001 10001",
  b: "11110 10001 10001 11110 10001 10001 11110",
  c: "01110 10001 10000 10000 10000 10001 01110",
  d: "11110 10001 10001 10001 10001 10001 11110",
  e: "11111 10000 10000 11110 10000 10000 11111",
  f: "11111 10000 10000 11110 10000 10000 10000",
  g: "01110 10001 10000 10111 10001 10001 01111",
  h: "10001 10001 10001 11111 10001 10001 10001",
  i: "11111 00100 00100 00100 00100 00100 11111",
  j: "00111 00010 00010 00010 00010 10010 11110",
  k: "10011 10110 11100 11000 11100 10110 10011",
  l: "10000 10000 10000 10000 10000 10000 11111",
  m: "10001 11011 11111 10101 10001 10001 10001",
  n: "10001 11001 11101 10111 10011 10001 10001",
  o: "01110 10001 10001 10001 10001 10001 01110",
  p: "11110 10001 10001 11110 10000 10000 10000",
  q: "01110 10001 10001 10001 10101 10010 01101",
  r: "11110 10001 10001 11110 11100 10110 10011",
  s: "01111 10000 10000 01110 00001 00001 11110",
  t: "11111 00100 00100 00100 00100 00100 00100",
  u: "10001 10001 10001 10001 10001 10001 01110",
  v: "11011 11011 11011 01110 01110 00100 00100",
  w: "10001 10001 10001 10101 10101 11111 10001",
  x: "11011 11011 01110 00100 01110 11011 11011",
  y: "11011 11011 01110 00100 00100 00100 00100",
  z: "11111 00011 00110 00100 01100 11000 11111",
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "00100 01100 00100 00100 00100 00100 01110",
  "2": "01110 10001 00001 00010 00100 01000 11111",
  "3": "11111 00010 00100 00010 00001 10001 01110",
  "4": "10010 10010 10010 11111 00010 00010 00010",
  "5": "11111 10000 11110 00001 00001 10001 01110",
  "6": "00110 01000 10000 11110 10001 10001 01110",
  "7": "11111 00011 00110 00100 00100 00100 00100",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00010 01100",
};

function Letter({ name }: { name: string }) {
  const rows = (GLYPHS[name[0]?.toLowerCase() ?? ""] ?? GLYPHS.a!).split(" ");
  const ink = INKS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % INKS.length]!;
  return (
    <svg width={48} height={48} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      {rows.map((row, y) =>
        [...row].map((on, x) =>
          on === "1" ? <rect key={`${x}-${y}`} x={3 + x * 2} y={1 + y * 2} width={2} height={2} fill={ink} /> : null,
        ),
      )}
    </svg>
  );
}

// --- one setting on an agent's page ------------------------------------------

// A line saying what the setting is set to and what that choice costs, and a Change that
// opens the choices in place.
//
// Folded by default, because the answer is the thing worth reading. Open, every choice says
// its own cost in the agent's own words, so a pick is made by comparing rather than by
// trying one.
//
// A switched-off agent keeps its settings, greyed and still working: setting an agent you
// have paused is how it is ready for the day you switch it back on.
function SettingLine({
  setting,
  value,
  off,
  busy,
  onPick,
}: {
  setting: SpecAgentSettingView;
  /** The choice in effect — the saved one, or the setting's own default. */
  value: string;
  off: boolean;
  /** A save for this setting is in flight. */
  busy: boolean;
  onPick: (value: string) => void;
}) {
  const copy = useCopy().configuration.agents;
  const [open, setOpen] = useState(false);
  const picked = setting.choices.find((c) => c.value === value);
  const shown = picked?.label ?? value;

  return (
    <div className={`rounded-[10px] bg-nb-sheet px-3 py-2 ${off ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Closed, the line carries the cost too — that is the whole answer, and it wraps
            rather than trailing off in an ellipsis. Open, the cost is dropped: every
            choice below says its own, and repeating the picked one says it twice. */}
        <p
          className={`min-w-0 text-[12px] leading-relaxed text-nb-ink-soft [&_strong]:font-[700] ${
            off ? "[&_strong]:text-nb-ink-soft" : "[&_strong]:text-nb-ink"
          }`}
        >
          <Rich>
            {!open && picked?.cost
              ? copy.settingWithCost(setting.label, shown, picked.cost)
              : copy.setting(setting.label, shown)}
          </Rich>
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-[1px] text-[12px] font-[700] text-nb-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
        >
          {copy.change}
          <FiChevronDown
            aria-hidden
            className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div
          role="radiogroup"
          aria-label={setting.label}
          className="mt-2.5 flex flex-col gap-1 border-t border-nb-ink/14 pt-2.5"
        >
          {setting.choices.map((choice) => {
            const on = choice.value === value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy}
                onClick={() => onPick(choice.value)}
                className="flex cursor-pointer items-start gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-nb-wash focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-nb-accent disabled:cursor-wait disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className={`mt-[3px] flex size-[13px] shrink-0 items-center justify-center rounded-full ${
                    on ? "bg-nb-accent" : "bg-nb-ink/20"
                  }`}
                >
                  {on && <span className="size-[4px] rounded-full bg-nb-paper" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12px] ${on ? "font-[800] text-nb-ink" : "font-[700] text-nb-ink"}`}>
                    {choice.label}
                  </span>
                  <span className="block text-[12px] leading-relaxed text-nb-ink-soft">{choice.cost}</span>
                </span>
              </button>
            );
          })}
          {setting.help && <p className="mt-1 px-2 text-[12px] leading-relaxed text-nb-ink-soft">{setting.help}</p>}
        </div>
      )}
    </div>
  );
}

function agentTitle(name: string): string {
  const words = name.split("-");
  return words.map((word, index) => (index === 0 ? sentenceStart(displayWord(word)) : displayWord(word))).join(" ");
}

function displayWord(word: string): string {
  return word.toLowerCase() === "ui" ? "UI" : word;
}

function sentence(text: string): string {
  return clause(sentenceStart(text.trim()));
}

// The `Runs when` line reads on from its label, so it keeps the agent's own capitalisation
// rather than being sentence-cased into "Runs when A card changes…".
function clause(text: string): string {
  const value = text.trim();
  return !value || /[.!?]$/.test(value) ? value : `${value}.`;
}

function sentenceStart(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
