"use client";

// Configuration → Global memory (#1575): folders of material several agents share. The list
// on the left, the open one beside it, laid out as the Workflows pane is. A built-in memory's
// rules ship with the board and are read-only; the board's own are created, edited and
// deleted here.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiPlus, FiTrash2 } from "react-icons/fi";

import {
  createGlobalMemoryAction,
  deleteGlobalMemoryAction,
  globalMemoriesAction,
  saveGlobalMemoryAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { useAgentName } from "@/lib/agent-name";
import type { GlobalMemoryView } from "@/lib/types";
import { Character, CopyPath } from "./Agents";
import { ConfirmationPopover } from "./confirm-popover";
import { ACCENT_BTN, CAPTION, CONTROL, DANGER_BTN, Loading, Note, QUIET_BTN } from "./settings";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NEW = ":new";

/** The global memories, read when a screen showing them mounts — unless `wanted` is false. */
export function useGlobalMemories(wanted = true) {
  const [memories, setMemories] = useState<GlobalMemoryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    const res = await globalMemoriesAction();
    setMemories(res.memories);
    setError(res.error ?? null);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (wanted) void reload();
  }, [reload, wanted]);
  return { memories, error, loaded, reload };
}

/** The global memories one agent names, split into those that exist and those that don't. */
export function useAgentMemories(declared: string[] = []) {
  const { memories } = useGlobalMemories(declared.length > 0);
  if (!memories) return { known: [], missing: [] };
  return {
    known: memories.filter((one) => declared.includes(one.name)),
    missing: declared.filter((name) => !memories.some((one) => one.name === name)),
  };
}

/** The global memories row on an agent's page, each opening its page. */
export function AgentMemoryLinks({ memories, onOpen }: { memories: GlobalMemoryView[]; onOpen: (name: string) => void }) {
  const c = useCopy().configuration.agents;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-[3px]">
      {memories.map((one) => (
        <button
          key={one.name}
          type="button"
          title={c.openMemory(one.title)}
          onClick={() => onOpen(one.name)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-nb-wash py-1 pl-1.5 pr-2 hover:bg-nb-canvas focus-visible:outline-2 focus-visible:outline-nb-accent"
        >
          <FiBookOpen aria-hidden className="shrink-0 text-[12px] text-nb-ink-soft" />
          <span className="text-[12px] font-[700] text-nb-ink underline decoration-nb-ink/25 underline-offset-2">{one.title}</span>
        </button>
      ))}
    </div>
  );
}

export function MemoriesPanel({
  openOn = "",
  onOpened,
  onError,
}: {
  /** The memory to open on, from an agent page's link. */
  openOn?: string;
  onOpened?: () => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration;
  const m = c.memories;
  const { memories, error, loaded, reload } = useGlobalMemories();
  const [picked, setPicked] = useState("");

  useEffect(() => {
    if (!openOn || !memories?.some((one) => one.name === openOn)) return;
    setPicked(openOn);
    onOpened?.();
  }, [openOn, memories, onOpened]);
  useEffect(() => {
    if (picked === NEW || memories?.some((one) => one.name === picked)) return;
    if (memories?.length) setPicked(memories[0]!.name);
  }, [memories, picked]);

  if (!loaded) return <Loading>{m.loading}</Loading>;
  if (error) return <Note icon={<FiAlertCircle />}>{error}</Note>;
  if (!memories) return <Note icon={<FiAlertCircle />}>{m.tooOld}</Note>;

  const held = memories.find((one) => one.name === picked);
  return (
    <div className="flex h-full min-h-0 items-stretch gap-6 max-sm:flex-col">
      <div className="flex w-[292px] shrink-0 flex-col border-r border-nb-ink/10 pr-6 max-sm:w-full max-sm:border-r-0 max-sm:pr-0">
        <div className="mb-2 flex h-[26px] items-center gap-2 pl-2.5 pr-1.5">
          <span className={`${CAPTION} shrink-0 text-nb-ink-soft/70`}>{c.section.memories}</span>
          <span className="h-px flex-1 bg-nb-ink/10" />
          <button
            type="button"
            aria-label={m.add}
            title={m.add}
            onClick={() => setPicked(NEW)}
            className="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[7px] bg-nb-canvas text-nb-ink hover:bg-nb-wash focus-visible:outline-2 focus-visible:outline-nb-accent"
          >
            <FiPlus aria-hidden strokeWidth={2.5} className="text-[13px]" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {memories.map((one) => (
            <ListRow key={one.name} title={one.title} builtIn={one.builtIn} held={one.name === picked} onOpen={() => setPicked(one.name)} />
          ))}
          {picked === NEW && <ListRow title={m.newTitle} held />}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {picked === NEW ? (
          <NewPage
            taken={memories.map((one) => one.name)}
            onCancel={() => setPicked("")}
            onCreated={async (name) => {
              await reload();
              setPicked(name);
            }}
          />
        ) : (
          held && (
            <Page
              key={held.name}
              memory={held}
              onError={onError}
              onSaved={reload}
              onDeleted={async () => {
                setPicked("");
                await reload();
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

function ListRow({ title, builtIn, held, onOpen }: { title: string; builtIn?: boolean; held: boolean; onOpen?: () => void }) {
  const m = useCopy().configuration.memories;
  return (
    <button
      type="button"
      aria-current={held}
      onClick={onOpen}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-[7px] text-left focus-visible:outline-2 focus-visible:outline-nb-accent ${
        held ? "bg-nb-accent-soft" : "hover:bg-nb-sheet"
      }`}
    >
      <FiBookOpen aria-hidden className={`shrink-0 text-[13px] ${held ? "text-nb-accent-deep" : "text-nb-ink-soft"}`} />
      <span className={`min-w-0 flex-1 truncate text-[12.5px] font-[700] leading-[16px] ${held ? "text-nb-accent-deep" : "text-nb-ink"}`}>
        {title}
      </span>
      {builtIn && <span className="shrink-0 text-[11px] text-nb-ink-soft">{m.builtIn}</span>}
    </button>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-center gap-6">
      <span className="w-[120px] shrink-0 text-[12.5px] font-[700] text-nb-ink">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Page({
  memory,
  onError,
  onSaved,
  onDeleted,
}: {
  memory: GlobalMemoryView;
  onError?: (msg: string) => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const m = useCopy().configuration.memories;
  const nameOf = useAgentName();
  const [rules, setRules] = useState(memory.rules);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  const save = async () => {
    setBusy(true);
    const res = await saveGlobalMemoryAction(memory.name, memory.description, rules);
    setBusy(false);
    if (!res.ok) return onError?.(res.error ?? "");
    setSaved(true);
    await onSaved();
  };
  const remove = async () => {
    setBusy(true);
    const res = await deleteGlobalMemoryAction(memory.name);
    setBusy(false);
    setAsking(false);
    if (!res.ok) return onError?.(res.error ?? "");
    await onDeleted();
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-h-[24px] items-baseline gap-2">
            <span className="text-[14px] font-[800] text-nb-ink">{memory.title}</span>
            {memory.builtIn && <span className="text-[11px] text-nb-ink-soft">{m.builtIn}</span>}
          </div>
          <p className="mt-0.5 max-w-[60ch] text-[12px] leading-snug text-nb-ink-soft">{memory.gloss}</p>
        </div>
        {!memory.builtIn && (
          <span ref={anchor} className="relative shrink-0">
            <button type="button" className={DANGER_BTN} disabled={busy} onClick={() => setAsking(true)}>
              <FiTrash2 aria-hidden />
              {m.del}
            </button>
            <ConfirmationPopover
              open={asking}
              anchorRef={anchor}
              align="right"
              confirm="filled"
              title={m.confirmTitle(memory.title)}
              description={m.confirmBody(memory.agents.length)}
              cancelLabel={m.cancel}
              confirmLabel={m.del}
              busy={busy}
              onDismiss={() => setAsking(false)}
              onConfirm={() => void remove()}
            />
          </span>
        )}
      </div>

      <hr className="shrink-0 border-nb-ink/10" />
      <div className="flex shrink-0 flex-col gap-2">
        <Fact label={m.folder}>
          <span className="flex min-w-0 items-center gap-1.5 text-nb-ink-soft">
            <code className="min-w-0 select-text truncate font-mono text-[11.5px]">{memory.folder}</code>
            <CopyPath path={memory.folder} />
          </span>
        </Fact>
        <Fact label={m.agents}>
          {memory.agents.length ? (
            memory.agents.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-[8px] bg-nb-wash py-0.5 pl-1 pr-2">
                <Character name={a} size={20} />
                <span className="text-[12px] font-[700] text-nb-ink">{nameOf(a)}</span>
              </span>
            ))
          ) : (
            <span className="text-[12px] text-nb-ink-soft">{m.noAgents}</span>
          )}
        </Fact>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <h4 className="shrink-0 text-[13.5px] font-[800] leading-tight text-nb-ink">{m.rules}</h4>
        {memory.builtIn ? (
          <pre className="mt-2 min-h-0 w-full flex-1 overflow-auto whitespace-pre-wrap rounded-[10px] bg-nb-wash px-3 py-2.5 font-mono text-[12px] leading-[19px] text-nb-ink-soft">
            {/* Its source is hard-wrapped; the pane wraps it itself. */}
            {memory.rules.replace(/\n {2}/g, " ")}
          </pre>
        ) : (
          <textarea
            value={rules}
            onChange={(e) => {
              setRules(e.target.value);
              setSaved(false);
            }}
            spellCheck={false}
            aria-label={m.rules}
            className="mt-2 min-h-[160px] w-full flex-1 resize-none rounded-[10px] bg-nb-wash px-3 py-2.5 font-mono text-[12px] leading-[19px] text-nb-ink focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
          />
        )}
        <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
          <p className="text-[11.5px] text-nb-ink-soft">{memory.builtIn ? m.rulesBuiltIn : saved ? m.saved : ""}</p>
          {!memory.builtIn && (
            <button type="button" className={ACCENT_BTN} disabled={busy || rules === memory.rules} onClick={() => void save()}>
              {m.save}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function NewPage({
  taken,
  onCancel,
  onCreated,
}: {
  taken: string[];
  onCancel: () => void;
  onCreated: (name: string) => Promise<void>;
}) {
  const m = useCopy().configuration.memories;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState("");
  const wanted = name.trim();
  const clash = taken.includes(wanted);
  const bad = !!wanted && !NAME.test(wanted);
  const ready = !!wanted && !clash && !bad && !!description.trim() && !busy;

  const create = async () => {
    setBusy(true);
    const res = await createGlobalMemoryAction(wanted, description, rules);
    setBusy(false);
    if (!res.ok) return setRefusal(res.error ?? "");
    await onCreated(wanted);
  };

  return (
    <form
      className="flex h-full min-w-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void create();
      }}
    >
      <span className="text-[14px] font-[800] text-nb-ink">{m.newTitle}</span>
      <hr className="shrink-0 border-nb-ink/10" />
      <label className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-[700] text-nb-ink">{m.name}</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setRefusal("");
          }}
          spellCheck={false}
          placeholder="customer-interviews"
          className={`${CONTROL} font-mono text-[13px] ${clash || bad ? "outline-2 outline-offset-1 outline-nb-peach" : ""}`}
        />
        <span className={`text-[11.5px] ${clash || bad ? "font-[700] text-nb-peach-ink" : "text-nb-ink-soft"}`}>
          {clash ? m.nameTaken : m.nameHint}
        </span>
      </label>
      <label className="flex shrink-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-[700] text-nb-ink">{m.description}</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={m.descriptionHint}
          className={`${CONTROL} text-[13px]`}
        />
      </label>
      <label className="flex min-h-0 flex-1 flex-col gap-1.5">
        <span className="text-[12.5px] font-[700] text-nb-ink">{m.rules}</span>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          spellCheck={false}
          className={`${CONTROL} min-h-[120px] flex-1 resize-none font-mono text-[12px] leading-[19px]`}
        />
        <span className="text-[11.5px] text-nb-ink-soft">{m.rulesHint}</span>
      </label>
      {refusal && <p className="text-[12px] text-nb-peach-ink">{refusal}</p>}
      <div className="flex shrink-0 justify-end gap-2">
        <button type="button" className={QUIET_BTN} onClick={onCancel}>
          {m.cancel}
        </button>
        <button type="submit" className={ACCENT_BTN} disabled={!ready}>
          {m.create}
        </button>
      </div>
    </form>
  );
}
