"use client";

// ---- the drafts block on a marketing card (#411) ----------------------------
//
// It stands where a product card's delivery block stands, and it is the whole of what a
// marketing card's page adds: a tab strip over `source` and each chosen channel, that draft
// in an editor with an explicit save, Repurpose and Publish, and a strip saying how far
// every channel has got. Everything else on the page — the title, the toolbar, the
// questions, the body, the meta and the run log — is the page both boards share.
//
// A marketing card never has a delivery (`deliversWithGit()` is false on that solution), so
// this displaces nothing that would otherwise be drawn.
//
// Neither button acts on `source`: the source is the argument every channel is repurposed
// from, and it is neither repurposed nor published itself.
//
// The pane re-reads on the signals the page already has — tab focus, and a run on this card
// finishing — so a Repurpose lands in it with nothing to poll. What you have typed survives
// that re-read: a draft is editable in an editor at the same time, and the honest thing is
// to keep your words and say the file moved, not to throw either away.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit3, FiSend } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useActions } from "@/lib/screen";
import type { CardChannel, CardDrafts } from "@/lib/types";
import { Button, PanelAction } from "./button";
import { ChannelDot, ChannelMark, channelLabel, useChannelWord } from "./channels";
import { ConfirmationPopover } from "./confirm-popover";
import { Dialog } from "./Dialog";
import { DialogButtons } from "./agent-shared";
import { useOnTabFocus } from "./sessions";

/** The draft every channel is repurposed from. The board's own file name, not copy. */
const SOURCE = "source";

const NOTHING: CardDrafts = { dir: "", drafts: [] };

/** The URL a published piece went up at. Publish refuses without one, so every published
 *  channel has something for `memory/published.md` to key on. */
function PublishDialog({
  channel,
  url,
  busy,
  onClose,
  onConfirm,
}: {
  channel: string;
  url: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}) {
  const c = useCopy().card.drafts;
  const [value, setValue] = useState(url);
  return (
    <Dialog title={c.publishTitle(channelLabel(channel))} onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">{c.publishIntro}</p>
      <input
        className="w-full rounded-[10px] border border-nb-ink/25 bg-nb-paper px-3 py-2.5 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
        value={value}
        autoFocus
        placeholder={c.publishUrlPlaceholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !busy) onConfirm(value.trim());
        }}
      />
      <DialogButtons
        onClose={onClose}
        onConfirm={() => onConfirm(value.trim())}
        confirmLabel={c.publishConfirm}
        disabled={busy || !value.trim()}
      />
    </Dialog>
  );
}

export function DraftsBlock({
  cardId,
  channels,
  /** Bumped whenever a run on this card finishes — a repurpose writes its draft and this is
   *  how it arrives in the pane. */
  reload,
  onWritten,
  onError,
}: {
  cardId: number;
  channels: CardChannel[];
  reload: number;
  /** The card itself moved — a channel's status changed, so the page re-reads it. */
  onWritten: () => void;
  onError: (why: string) => void;
}) {
  const c = useCopy().card.drafts;
  const t = useCopy();
  const word = useChannelWord();
  const actions = useActions();

  const [tab, setTab] = useState<string>(SOURCE);
  const [read, setRead] = useState<CardDrafts>(NOTHING);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [replace, setReplace] = useState("");
  const repurposeRef = useRef<HTMLSpanElement>(null);

  // What the file said when this pane last read it. It is what "the file moved underneath"
  // is measured against, and what an untouched pane adopts on a re-read.
  const onDisk = useRef("");
  const dirty = text !== onDisk.current;
  const moved = read.drafts.find((d) => d.name === tab)?.text;
  const outOfStep = dirty && moved !== undefined && moved !== onDisk.current;

  const load = useCallback(async () => {
    if (!actions) return;
    setRead(await actions.readDrafts(cardId));
  }, [actions, cardId]);

  useEffect(() => {
    void load();
  }, [load, reload]);
  useOnTabFocus(() => void load());

  // Take up what was read, unless the user has typed something this would throw away. The
  // tab changing always takes it up: nothing typed is carried from one draft to another.
  const tabRef = useRef(tab);
  useEffect(() => {
    const now = read.drafts.find((d) => d.name === tab)?.text ?? "";
    const switched = tabRef.current !== tab;
    tabRef.current = tab;
    if (switched || text === onDisk.current) {
      onDisk.current = now;
      setText(now);
    }
    // `text` is deliberately not a dependency: this runs on what was READ, not on typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, tab]);

  // A tab that has gone — a channel taken off the card while the page sat open — falls back
  // to the source rather than leaving the strip pointing at nothing.
  useEffect(() => {
    if (tab !== SOURCE && !channels.some((ch) => ch.name === tab)) setTab(SOURCE);
  }, [channels, tab]);

  const channel = channels.find((ch) => ch.name === tab);
  const draft = read.drafts.find((d) => d.name === tab);
  // The file this pane writes, named even before it exists: the first save is what makes it.
  const path = draft?.path ?? (read.dir ? `${read.dir}/${tab}.md` : "");

  const save = async () => {
    if (!actions) return;
    setSaving(true);
    const res = await actions.saveDraft(cardId, tab, text);
    setSaving(false);
    if (res.error) return onError(res.error);
    onDisk.current = text;
    setRead(res);
  };

  const repurpose = async (again: boolean) => {
    if (!actions || !channel) return;
    setBusy(true);
    const res = await actions.repurpose(cardId, channel.name, again);
    setBusy(false);
    setReplace("");
    if (res.ok) return onWritten();
    // A draft that is already written is a question, not a refusal: the command's own words
    // are the confirmation's, and answering it runs the same repurpose with `again`. Its
    // last sentence names the flag to type, and the button IS that flag — so it comes off.
    if (res.kind === "draft-exists") return setReplace(withoutFlag(res.error) || c.replaceBody);
    onError(res.error ?? c.repurposeFailed);
  };

  const publish = async (url: string) => {
    if (!actions || !channel) return;
    setBusy(true);
    const res = await actions.setChannelStatus(cardId, channel.name, "published", url);
    setBusy(false);
    // A refusal leaves the dialog open on the URL that was typed: the link is the one thing
    // here nobody wants to find again.
    if (!res.ok) return onError(res.error ?? c.publishFailed);
    setPublishing(false);
    onWritten();
  };

  // Rules older than this block can neither read a draft nor write one, so the block is the
  // reason rather than an empty editor — which would read as a topic nobody has written for.
  if (read.error) {
    return <div className="nb-section bg-nb-sheet px-4 py-3.5 text-[12.5px] text-nb-ink-soft">{read.error}</div>;
  }

  return (
    <div className="nb-section bg-nb-sheet">
      {/* The strip: `source`, then one tab per chosen channel, then the block's own two
          actions. Both are off on `source` — it is neither repurposed nor published. */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-[14px] py-1.5 pl-1.5 pr-3.5">
        <Tab label={SOURCE} on={tab === SOURCE} onClick={() => setTab(SOURCE)} />
        {channels.map((ch) => (
          <Tab
            key={ch.name}
            label={channelLabel(ch.name)}
            on={tab === ch.name}
            onClick={() => setTab(ch.name)}
            mark={<ChannelMark name={ch.name} status={ch.status} size={13} />}
            dot={<ChannelDot status={ch.status} size={6} />}
          />
        ))}
        <span className="relative ml-auto flex items-center gap-2" ref={repurposeRef}>
          <PanelAction
            icon={<FiEdit3 className="text-[13px]" aria-hidden />}
            label={c.repurpose}
            title={channel ? c.repurposeHint : c.notOnSource}
            disabled={!actions || !channel || busy}
            onClick={() => void repurpose(false)}
          />
          <PanelAction
            icon={<FiSend className="text-[13px]" aria-hidden />}
            label={c.publish}
            title={channel ? c.publishHint : c.notOnSource}
            disabled={!actions || !channel || busy}
            onClick={() => setPublishing(true)}
          />
          <ConfirmationPopover
            open={!!replace}
            anchorRef={repurposeRef}
            align="right"
            title={c.replaceTitle}
            description={replace}
            cancelLabel={t.shared.cancel}
            confirmLabel={c.replaceConfirm}
            busy={busy}
            onDismiss={() => setReplace("")}
            onConfirm={() => void repurpose(true)}
          />
        </span>
      </div>

      {/* The draft itself, on paper: chrome sits on the block's ground, the thing you read
          and edit sits on the page's. It rounds the block's foot on a topic with no channels,
          where there is no status strip under it to do so. */}
      <div className={`border-t border-nb-ink/12 bg-nb-paper${channels.length ? "" : " rounded-b-[14px]"}`}>
        <textarea
          value={text}
          spellCheck={false}
          disabled={!actions}
          onChange={(e) => setText(e.target.value)}
          placeholder={c.empty}
          className="block h-[296px] max-md:h-[240px] w-full resize-y bg-transparent px-4 py-3.5 font-mono text-[12.5px] leading-[19px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:-outline-offset-2 focus:outline-nb-accent"
        />
        {/* The save, on the field it belongs to, with the file it writes named beside it. */}
        <div className="flex items-center justify-between gap-4 border-t border-nb-ink/12 px-4 py-2">
          <span className="min-w-0 truncate font-mono text-[11.5px] text-nb-ink-soft" title={path}>
            {path}
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {outOfStep ? (
              <span className="text-[11.5px] font-[700]" style={{ color: "var(--color-nb-peach-ink)" }}>
                {c.movedUnderneath}
              </span>
            ) : dirty ? (
              <span className="text-[11.5px] font-[700]" style={{ color: "var(--color-nb-accent-deep)" }}>
                {c.unsaved}
              </span>
            ) : null}
            <Button size="xs" disabled={!actions || saving || !dirty} onClick={() => void save()}>
              {saving ? t.shared.saving : t.shared.save}
            </Button>
          </span>
        </div>
      </div>

      {/* How far every chosen channel has got, and where the published ones went up. */}
      {channels.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-b-[14px] border-t border-nb-ink/12 px-3.5 py-2.5 text-[11.5px] text-nb-ink-soft">
          {channels.map((ch) => (
            <span key={ch.name} className="inline-flex min-w-0 items-center gap-1.5">
              <ChannelMark name={ch.name} status={ch.status} size={13} />
              <ChannelDot status={ch.status} size={6} />
              <span className="font-[700] text-nb-ink">{word(ch.status)}</span>
              {ch.url && (
                <a
                  href={ch.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate font-mono text-[11px] underline decoration-dotted underline-offset-2 hover:text-nb-ink"
                >
                  {ch.url}
                </a>
              )}
            </span>
          ))}
        </div>
      )}

      {publishing && channel && (
        <PublishDialog
          channel={channel.name}
          url={channel.url}
          busy={busy}
          onClose={() => setPublishing(false)}
          onConfirm={(url) => void publish(url)}
        />
      )}
    </div>
  );
}

/** The refusal without the line telling a terminal which flag to add. */
const withoutFlag = (why: string | undefined): string => (why ?? "").split("Add `--again`")[0]!.trim();

/** One tab: the channel's mark, its name, and how far it has got. `source` carries none of
 *  the three — it is the argument, not a destination. */
function Tab({
  label,
  on,
  mark,
  dot,
  onClick,
}: {
  label: string;
  on: boolean;
  mark?: React.ReactNode;
  dot?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-0.5 max-md:h-11 max-md:px-3 text-[12px] font-[700] transition-colors${
        on ? "" : " hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_5%,transparent)]"
      }`}
      style={
        on
          ? { background: "color-mix(in srgb, var(--color-nb-ink) 9%, transparent)" }
          : { color: "var(--color-nb-ink-soft)" }
      }
    >
      {mark}
      {label}
      {dot}
    </button>
  );
}
