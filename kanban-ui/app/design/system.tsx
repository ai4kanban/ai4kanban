"use client";

import { useState, type ReactNode } from "react";
import { FiPlus, FiSettings } from "react-icons/fi";
import { DialogButtons, RunningBadge, SessionLog } from "@/components/agent-shared";
import { BoardCard } from "@/components/BoardCard";
import { Button } from "@/components/button";
import {
  BlockedChip,
  CadenceSelect,
  GroupChip,
  LevelSelect,
  ModuleChip,
  PendingPill,
  PriorityChip,
  QuestionTagBadge,
  ReleaseSelect,
  RoiTag,
  StatusPill,
  TodoProgress,
  TrackChip,
} from "@/components/chips";
import { Dialog } from "@/components/Dialog";
import { DiffPane } from "@/components/Diff";
import { Logo, LogoMark } from "@/components/Logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contrast, flatten, format, verdict } from "@/lib/contrast";
import type { Card, DeliveryDiff, SessionView } from "@/lib/types";

// The page body. Everything drawn below is imported from the modules the board
// itself imports, or is a class out of app/globals.css — the two exceptions are
// marked where they appear, and both are patterns that live inline in the
// component that owns them and were never exported.
//
// See page.tsx for what this page is and why the split.

// ── The tokens ───────────────────────────────────────────────────────────────
// These mirror the `@theme` block in app/globals.css, which is the source of
// truth — they are restated here because the contrast math can't read a CSS
// variable. Change one there, change it here.

const INK = "#24231f";
const INK_SOFT = "#565550";
const CREAM = "#f7f7f4";
const PAPER = "#ffffff";
const WASH = "#f4f3ef";
const ACCENT = "#dd4f1e";
const ACCENT_DEEP = "#b83a12";
const ACCENT_SOFT = "#f7ddce";
const MINT = "#7fca9c";
const MINT_SOFT = "#e4f3ea";
const MINT_INK = "#2f6b46";
const SKY = "#7fb4e0";
const SKY_SOFT = "#e6f1fb";
const SKY_INK = "#2c5c86";
const LILAC = "#b199e0";
const LILAC_SOFT = "#efe9fb";
const LILAC_INK = "#5a3f92";
const PEACH = "#ec9a72";
const PEACH_SOFT = "#fbe9dd";
const PEACH_INK = "#8a4a28";

// Two surfaces the board mixes rather than names, so the table below can measure
// what a reader actually sees: the progress bar's track, and the hairline under
// the sticky header.
const TRACK = flatten(INK, PAPER, 0.12);
const HAIRLINE = flatten(INK, CREAM, 0.14);

// And the two the Diff tab mixes: the gutter a changed line's numbers sit in is
// its own band with the signal stirred back in, the way every diff view seats a
// gutter a step darker than the row.
const ADD_GUTTER = flatten(MINT, MINT_SOFT, 0.26);
const DEL_GUTTER = flatten(PEACH, PEACH_SOFT, 0.26);

const GROUPS: { title: string; note: string; tokens: { name: string; hex: string; use: string }[] }[] = [
  {
    title: "The ground",
    note: "Warm, not neutral, and never pure black or pure white as text — a cream page, white paper on it, a faint wash between them, charcoal ink over all three.",
    tokens: [
      { name: "nb-cream", hex: CREAM, use: "the page" },
      { name: "nb-paper", hex: PAPER, use: "a card, a dialog, a control" },
      { name: "nb-wash", hex: WASH, use: "a column header, a log body, an inset" },
      { name: "nb-ink", hex: INK, use: "every outline, every shadow, body text" },
      { name: "nb-ink-soft", hex: INK_SOFT, use: "meta, captions, a resting icon" },
    ],
  },
  {
    title: "The ember",
    note: "One accent, in three strengths. It marks the thing you are meant to press and the thing that is happening right now — nothing else earns it.",
    tokens: [
      { name: "nb-accent", hex: ACCENT, use: "a button fill, the mark, a live bar" },
      { name: "nb-accent-deep", hex: ACCENT_DEEP, use: "hover and press, and the ember that carries text" },
      { name: "nb-accent-soft", hex: ACCENT_SOFT, use: "the fill under that text — chips, warnings, a picked option" },
    ],
  },
  {
    title: "The signals",
    note: "Four pastels that mean something, each with a soft fill and an ink dark enough to read on it. A colour on this board is never decoration: mint is done, sky is neutral fact, lilac is a group or a schedule, peach is something in the way.",
    tokens: [
      { name: "nb-mint", hex: MINT, use: "done — a finished progress bar" },
      { name: "nb-mint-soft", hex: MINT_SOFT, use: "the ready pill, the module chip" },
      { name: "nb-mint-ink", hex: MINT_INK, use: "the text on those" },
      { name: "nb-sky", hex: SKY, use: "neutral — a stopped run" },
      { name: "nb-sky-soft", hex: SKY_SOFT, use: "the release chip, the cadence chip" },
      { name: "nb-sky-ink", hex: SKY_INK, use: "the text on those" },
      { name: "nb-lilac", hex: LILAC, use: "the recurring column's cast" },
      { name: "nb-lilac-soft", hex: LILAC_SOFT, use: "the group marker, the track chip" },
      { name: "nb-lilac-ink", hex: LILAC_INK, use: "the text on those" },
      { name: "nb-peach", hex: PEACH, use: "in the way — a blocker" },
      { name: "nb-peach-soft", hex: PEACH_SOFT, use: "the blocked marker, a warning box" },
      { name: "nb-peach-ink", hex: PEACH_INK, use: "the text on those, and an error line" },
    ],
  },
];

// Every pair the board puts in front of a reader. `size` is the bar it has to
// clear: body copy 4.5:1, anything you only need to see the shape of 3:1. The
// board sets no type big enough for the 3:1 large-text bar — its biggest is the
// 17px header — so every text row here is measured against 4.5.
const PAIRS: {
  fg: string;
  bg: string;
  label: string;
  size?: "body" | "non-text";
  where: string;
}[] = [
  { fg: INK, bg: CREAM, label: "ink on cream", where: "body text on the page" },
  { fg: INK_SOFT, bg: CREAM, label: "ink-soft on cream", where: "meta and captions on the page" },
  { fg: INK, bg: PAPER, label: "ink on paper", where: "a card title, a dialog" },
  { fg: INK_SOFT, bg: PAPER, label: "ink-soft on paper", where: "a card's meta row, a blurb under a label" },
  { fg: INK, bg: WASH, label: "ink on wash", where: "a column header, a log body" },
  { fg: INK_SOFT, bg: WASH, label: "ink-soft on wash", where: "the run log's mono tail" },
  {
    fg: PAPER,
    bg: ACCENT,
    label: "paper on accent",
    where:
      "the label on an ember button at rest — the one text pair under the bar. Hover deepens the fill and clears it; the mark's columns are shape, where 3:1 is the bar",
  },
  { fg: PAPER, bg: ACCENT_DEEP, label: "paper on accent-deep", where: "that same button, hovered" },
  { fg: ACCENT_DEEP, bg: CREAM, label: "accent-deep on cream", where: "the brand link on hover" },
  { fg: ACCENT_DEEP, bg: PAPER, label: "accent-deep on paper", where: "a card's #id, the tick in an open list" },
  {
    fg: ACCENT_DEEP,
    bg: ACCENT_SOFT,
    label: "accent-deep on accent-soft",
    where:
      "every ember chip: the running badge, a picked chip, the active view segment. Under the bar by 0.07 — the closest thing on this board to a fix worth making",
  },
  {
    fg: ACCENT,
    bg: CREAM,
    label: "accent on cream",
    size: "non-text",
    where: "the active tab's underline and the pulse dot — shape, never a label",
  },
  { fg: MINT_INK, bg: MINT_SOFT, label: "mint-ink on mint-soft", where: "the ready pill, a module chip" },
  { fg: SKY_INK, bg: SKY_SOFT, label: "sky-ink on sky-soft", where: "the release chip, the cadence chip" },
  { fg: LILAC_INK, bg: LILAC_SOFT, label: "lilac-ink on lilac-soft", where: "the group marker, a track chip" },
  { fg: PEACH_INK, bg: PEACH_SOFT, label: "peach-ink on peach-soft", where: "the blocked marker, a warning box" },
  { fg: PEACH_INK, bg: PAPER, label: "peach-ink on paper", where: "an error line beside a control" },
  { fg: CREAM, bg: INK, label: "cream on ink", where: "the hover tooltip" },
  { fg: INK, bg: MINT_SOFT, label: "ink on mint-soft", where: "the code on an added line in the Diff tab" },
  { fg: INK, bg: PEACH_SOFT, label: "ink on peach-soft", where: "the code on a removed line" },
  { fg: INK_SOFT, bg: ADD_GUTTER, label: `ink-soft on the added gutter (${ADD_GUTTER})`, where: "an added line's numbers" },
  { fg: INK_SOFT, bg: DEL_GUTTER, label: `ink-soft on the removed gutter (${DEL_GUTTER})`, where: "a removed line's numbers" },
  { fg: SKY_INK, bg: WASH, label: "sky-ink on wash", where: "a hunk header in the Diff tab" },
  {
    fg: ACCENT,
    bg: TRACK,
    label: "accent on the progress track",
    size: "non-text",
    where: `a card's todo bar in flight, against its own track (${TRACK})`,
  },
  {
    fg: MINT,
    bg: TRACK,
    label: "mint on the progress track",
    size: "non-text",
    where:
      "the same bar once every todo is ticked. It fails, and it stands: the count beside it reads 5/5, so the bar is never the only thing saying so",
  },
  {
    fg: HAIRLINE,
    bg: CREAM,
    label: "the header hairline on cream",
    size: "non-text",
    where:
      "ink at 14% under the sticky header, and the same idea at 12% under a tab strip. Not a control and not information — the header reads by its blur and its contents; the rule only hints at the edge",
  },
];

// ── The page's own furniture ─────────────────────────────────────────────────

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-6">
      {/* The board's own section head: the ember dot of a column heading, then
          the title. The dot is the whole job the bright ember does alone. */}
      <h2 className="flex items-baseline gap-2 text-[24px] font-[800] tracking-[-0.02em]">
        <span className="text-[12px]" style={{ color: "var(--color-nb-accent)" }} aria-hidden>
          ●
        </span>
        {title}
      </h2>
      {note && <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-nb-ink-soft">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Label({ children }: { children: string }) {
  return (
    <p className="mb-2.5 text-[10.5px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
      {children}
    </p>
  );
}

// A row of specimens on paper, the way most of this page shows its blocks.
function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

// ── Stand-ins the board would otherwise read off disk ────────────────────────
// A card and a session, shaped exactly as lib/types.ts declares them, so the
// real BoardCard and SessionLog can be rendered rather than redrawn.

const CARD: Card = {
  id: 42,
  revision: "design-page",
  title: "Give the board a design page",
  track: "ui",
  priority: "high",
  roi: "med",
  status: "ready",
  release: "v0.6",
  blocked_by: [17],
  related: [],
  questions: [{ text: "[user] Does /design ship in the desktop app, or stay a dev-only route?" }],
  verify: ["open /design in the desktop app and check every specimen still draws"],
  modules: ["board"],
  last_run: "",
  cadence: "",
  schedule: null,
  relPath: "ui/42-give-the-board-a-design-page.md",
  body: "",
  todos: { total: 5, done: 2 },
  isGroup: false,
  recurring: false,
  nextRun: "",
  openBlockers: [{ id: 17, title: "Port the contrast helper" }],
};

const GROUP_CARD: Card = {
  ...CARD,
  id: 43,
  title: "Rework the release picker",
  status: "todo",
  priority: "med",
  roi: "high",
  questions: [],
  blocked_by: [],
  openBlockers: [],
  isGroup: true,
  todos: { total: 4, done: 4 },
};

const LIVE_SESSION: SessionView = {
  sessionId: "design-live",
  cardId: 43,
  action: "clarify",
  status: "running",
  startedAt: 0,
};

const DONE_SESSION: SessionView = {
  sessionId: "design-done",
  cardId: 42,
  action: "implement",
  status: "done",
  startedAt: 0,
  endedAt: 0,
  durationMs: 252_000,
  costUsd: 0.42,
  model: "claude-opus-5",
  usage: { input: 18_402, cacheCreation: 12_900, cacheRead: 141_233, output: 3_114 },
  ok: true,
  code: 0,
  tail: "> Read app/globals.css\n> Write app/design/page.tsx\n> Bash: pnpm typecheck",
  result:
    "Added `/design` and the contrast helper it needs.\n\n- `app/design/page.tsx` — the route and its title\n- `lib/contrast.ts` — ported from the site\n\nOne pair is under the bar: white on the resting ember, at 4.03:1.",
};

// A delivery's diff, small enough to read whole and wide enough to carry all
// three of the marks a file header can wear: an edit, a new file, a move.
const DIFF_SPECIMEN: DeliveryDiff = {
  id: "design",
  stat: "3 files changed, 6 insertions(+), 2 deletions(-)",
  diff: `diff --git a/lib/contrast.ts b/lib/contrast.ts
index 1111111..2222222 100644
--- a/lib/contrast.ts
+++ b/lib/contrast.ts
@@ -12,7 +12,9 @@ export function contrast(fg: string, bg: string): number {
 const channel = (c: number): number =>
   c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

-export const verdict = (ratio: number) => ratio >= 4.5
+export const verdict = (ratio: number, size: Size = 'body') =>
+  ratio >= (size === 'body' ? 4.5 : 3)
+
 export const format = (ratio: number): string => \`\${ratio.toFixed(2)}:1\`
diff --git a/lib/size.ts b/lib/size.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/lib/size.ts
@@ -0,0 +1,2 @@
+/** The bar a pair has to clear. */
+export type Size = 'body' | 'non-text'
diff --git a/app/design/page.tsx b/app/design/system.tsx
similarity index 98%
rename from app/design/page.tsx
rename to app/design/system.tsx
index 4444444..5555555 100644
--- a/app/design/page.tsx
+++ b/app/design/system.tsx
@@ -1,3 +1,3 @@
-export default function DesignPage() {
+export function DesignSystem() {
   return <main />
 }
`,
};

export function DesignSystem() {
  // Live state for the controls that only exist as controls — a select with
  // nothing to change is a picture of a select.
  const [level, setLevel] = useState("high");
  const [release, setRelease] = useState("v0.6");
  const [cadence, setCadence] = useState("1d at 09:30");
  const [agent, setAgent] = useState("claude-code");
  const [tab, setTab] = useState<"describe" | "propose">("describe");
  const [pick, setPick] = useState("board");
  const [dialog, setDialog] = useState(false);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="nb-tag">
        <span style={{ color: "var(--color-nb-accent)" }}>●</span>
        What the board ships
      </p>
      <h1 className="mt-3 text-[34px] font-[800] leading-[1.1] tracking-[-0.03em]">Design system</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-nb-ink-soft">
        Every token and every block, rendered from the modules the board imports,
        with every pair measured rather than eyeballed. Soft neo-brutalism: a warm
        cream ground, ink outlines, hard offset shadows, one ember, and blocks that
        move when you press them.
      </p>

      <Section
        id="palette"
        title="Palette"
        note="Seventeen values in three families — a warm ground, one ember in three strengths, and four meaning pastels. The ground is the whole page; the ember is rationed; a pastel only ever appears where it means the thing it means."
      >
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <Label>{g.title}</Label>
              <p className="mb-3 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">{g.note}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.tokens.map((t) => (
                  <div key={t.name} className="nb-panel-sm overflow-hidden">
                    <div
                      className="h-14 border-b-[1.5px] border-nb-ink"
                      style={{ background: t.hex }}
                    />
                    <div className="px-3.5 py-2.5">
                      <p className="font-mono text-[12.5px] font-[700]">{t.name}</p>
                      <p className="font-mono text-[11px] text-nb-ink-soft">{t.hex}</p>
                      <p className="mt-1 text-[12.5px] leading-snug text-nb-ink-soft">{t.use}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="contrast"
        title="Contrast"
        note="WCAG 2.1, measured at build time by lib/contrast.ts. Body copy needs 4.5:1; anything you only need to see the shape of needs 3:1. The board sets nothing large enough for the 3:1 large-text bar, so every text row here is held to 4.5 — its 10px bold chips included. Add a pair whenever you add a surface, and leave the failures in: two of them are known and argued for below."
      >
        <div className="nb-panel divide-y-[1.5px] divide-nb-ink/12">
          {PAIRS.map((p) => {
            const ratio = contrast(p.fg, p.bg);
            const v = verdict(ratio, p.size ?? "body");
            return (
              <div
                key={p.label}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3"
              >
                <span
                  className="flex h-10 w-20 shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-nb-ink text-[15px] font-[700]"
                  style={{ background: p.bg, color: p.fg }}
                >
                  Ag
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[12.5px]">{p.label}</span>
                  <span className="block text-[12.5px] leading-snug text-nb-ink-soft">{p.where}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="font-mono text-[12.5px] tabular-nums">{format(ratio)}</span>
                  <span
                    className="nb-chip"
                    style={{
                      background: v.passes ? "var(--color-nb-mint-soft)" : "var(--color-nb-peach-soft)",
                      color: v.passes ? "var(--color-nb-mint-ink)" : "var(--color-nb-peach-ink)",
                    }}
                  >
                    {v.passes ? (v.aaa ? "AAA" : "AA") : `under ${v.min}:1`}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        id="mark"
        title="The mark"
        note="components/Logo.tsx — the site's geometry in this app's colour: a square block carrying three board columns that share a top and step down as work leaves the board. It is filled with nb-accent and wears no frame and no shadow, unlike every other filled block here. A button is 40px tall and can carry a 1.5px hairline; at 22px the same line is a seventh of the width and turns the ember muddy. On cream the fill finds its own edge."
      >
        <div className="nb-panel px-5 py-5">
          <Label>at the sizes the app actually draws it</Label>
          {/* items-end, not the shared Row: the sizes are read against a common
              baseline, so the marks sit on one line and grow upward. */}
          <div className="flex flex-wrap items-end gap-5">
            {/* Written out rather than built from a number: Tailwind reads the
                class names in the source, so a template literal produces no CSS
                at all. */}
            {[
              { px: 16, cls: "h-[16px] w-[16px]" },
              { px: 22, cls: "h-[22px] w-[22px]" },
              { px: 32, cls: "h-[32px] w-[32px]" },
              { px: 48, cls: "h-[48px] w-[48px]" },
            ].map((s) => (
              <span key={s.px} className="text-center">
                <LogoMark className={s.cls} />
                <span className="mt-1.5 block font-mono text-[10.5px] text-nb-ink-soft">{s.px}</span>
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Label>the lockup, at its three scales</Label>
            <div className="flex flex-wrap items-center gap-6">
              <Logo size="sm" />
              <Logo size="md" />
              <Logo size="lg" />
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
            The tab icon in app/layout.tsx is the same three columns as a data URI —
            the board runs from a local server with no public/, so the favicon is
            inlined rather than served.
          </p>
        </div>
      </Section>

      <Section
        id="buttons"
        title="Buttons"
        note="components/button.tsx — one cva matrix: two fills (the ember CTA, the paper ghost) across two scales (a dialog's md, a toolbar's sm). Both wear the 1.5px ink frame and the hard offset shadow in every state, and both move: the block lifts a pixel on hover and settles a pixel on click, with the shadow growing and collapsing under it. A disabled button keeps its resting shadow and does neither — the press effects are gated behind enabled:."
      >
        <div className="nb-panel space-y-6 px-5 py-5">
          <div>
            <Label>accent / ghost · md — the dialog footer</Label>
            <Row>
              <Button>Create task</Button>
              <Button variant="ghost">Cancel</Button>
            </Row>
          </div>
          <div>
            <Label>accent / ghost · sm — a toolbar and a meta row</Label>
            <Row>
              <Button size="sm">
                <FiPlus aria-hidden />
                New release
              </Button>
              <Button variant="ghost" size="sm">
                <FiSettings aria-hidden />
                Configure
              </Button>
            </Row>
          </div>
          <div>
            <Label>disabled — flat, no lift, no settle</Label>
            <Row>
              <Button disabled>Implement anyway</Button>
              <Button variant="ghost" disabled>
                Resume
              </Button>
            </Row>
          </div>
          <div>
            <Label>risky — the confirm that goes against what the board just said</Label>
            <Row>
              <Button variant="ghost" className="border-nb-peach-ink text-nb-peach-ink">
                Stop run
              </Button>
              <Button variant="ghost" className="border-nb-peach-ink text-nb-peach-ink">
                Implement anyway
              </Button>
            </Row>
            <p className="mt-2.5 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
              It drops the ember for blocker ink, so the only CTA-weight mark in the
              row is Cancel — the safe way out is the one the eye lands on. Paired
              with disabled until the warning box is ticked, so no single click ever
              reaches a run the board advised against. Where the dialog offers a way
              out that isn&apos;t risky — <strong>Schedule</strong>, which starts
              nothing until the blocker is done — that one takes the ember the confirm
              gave up, and sits last.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="surfaces"
        title="Surfaces"
        note="app/globals.css. A block is a 1.5px ink outline, a radius, and a 3px hard offset shadow — no blur, no grey, one direction. There is no second elevation: a thing either is a block or it is a fill on the ground. nb-outline is the frame without the shadow, for something inside a block that would otherwise be a block on a block."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="nb-panel p-4">
            <p className="font-mono text-[12.5px] font-[700]">.nb-panel</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-nb-ink-soft">
              16px radius. A dialog, a run panel, the block a section is built
              around.
            </p>
          </div>
          <div className="nb-panel-sm nb-press p-4">
            <p className="font-mono text-[12.5px] font-[700]">.nb-panel-sm .nb-press</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-nb-ink-soft">
              13px radius, and it moves — this is a board card. Hover it.
            </p>
          </div>
          <div className="nb-outline bg-nb-paper p-4">
            <p className="font-mono text-[12.5px] font-[700]">.nb-outline</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-nb-ink-soft">
              14px radius, framed, flat. The run log window, an option row, a
              cadence box.
            </p>
          </div>
        </div>

        <div className="mt-7">
          <Label>the wash — a column header, and what a card looks like under it</Label>
          {/* The real column: 300px, and the wash is the header alone — a 32px
              chip at a 10px radius, no frame and no shadow, with the cards on the
              window's paper below it. Filling the whole column put a box inside
              the body's paper panel and a framed card inside that. */}
          <div className="flex gap-8 overflow-x-auto">
            <section className="flex w-[300px] shrink-0 flex-col">
              <div className="mb-3 flex h-8 items-center justify-between rounded-[10px] bg-nb-wash px-2.5">
                <h4 className="nb-tag">
                  <span style={{ color: "var(--color-nb-accent)" }}>●</span>
                  ui
                </h4>
                <span className="text-[12px] text-nb-ink-soft">2</span>
              </div>
              {/* The cards are the real BoardCard. Each is a link to /42 and /43,
                  which are cards this board almost certainly does not have — so
                  the wrapper swallows the click. Everything else about them,
                  including the press, is exactly what a column draws. */}
              <div
                className="flex flex-col gap-3 pl-px pr-1 pt-px pb-1"
                onClick={(e) => e.preventDefault()}
              >
                <BoardCard card={CARD} onOpenLog={() => {}} />
                <BoardCard
                  card={GROUP_CARD}
                  liveSession={LIVE_SESSION}
                  onOpenLog={() => {}}
                  selected
                  onSelect={() => {}}
                />
              </div>
            </section>
            <section className="flex w-[300px] shrink-0 flex-col">
              <div className="mb-3 flex h-8 items-center justify-between rounded-[10px] bg-[color-mix(in_srgb,var(--color-nb-lilac)_16%,var(--color-nb-wash))] px-2.5">
                <h4 className="nb-tag">
                  <span style={{ color: "var(--color-nb-lilac-ink)" }}>●</span>
                  recurring
                </h4>
                <span className="text-[12px] text-nb-ink-soft">0</span>
              </div>
              <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>
              <p className="mt-3 text-[12px] leading-relaxed text-nb-ink-soft">
                A lilac cast over the same wash — these cards repeat instead of
                finishing. Faint on purpose: it says &ldquo;these behave
                differently&rdquo;, not &ldquo;look here&rdquo;. The bullet goes
                lilac with it: an ember dot would be the only warm thing on the
                band, and read as a warning.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-7">
          <Label>the radii, and what wears each</Label>
          <div className="nb-outline overflow-hidden bg-nb-paper">
            {[
              { r: "16px", what: ".nb-panel — a dialog, a run panel" },
              { r: "14px", what: ".nb-outline — the log window, an option row" },
              { r: "13px", what: ".nb-panel-sm — a card" },
              { r: "11px / 9px", what: "a button, md and sm" },
              { r: "10px", what: "a text input, a select trigger, an open list" },
              { r: "7px", what: "an option row, a pick chip, a list item" },
              { r: "6px", what: "a meaning chip, the tooltip, a 22px icon button" },
            ].map((x, i) => (
              <div
                key={x.r}
                className={`flex items-center gap-3.5 px-4 py-2 text-[12.5px] ${i > 0 ? "border-t-[1.5px] border-nb-ink/12" : ""}`}
              >
                <span
                  className="h-7 w-12 shrink-0 border-[1.5px] border-nb-ink bg-nb-wash"
                  style={{ borderRadius: x.r.split(" / ")[0] }}
                  aria-hidden
                />
                <span className="w-24 shrink-0 font-mono tabular-nums">{x.r}</span>
                <span className="text-nb-ink-soft">{x.what}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <Label>the scrim and the dialog — .nb-scrim, portaled to the body</Label>
          <Row>
            <Button variant="ghost" onClick={() => setDialog(true)}>
              Open a dialog
            </Button>
          </Row>
          <p className="mt-2.5 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
            Ink at 42% over the page. The panel is a plain nb-panel with a 1.5px
            ink rule under its title; Escape and a click on the scrim close it, a
            click on the panel does not. It renders at the document root because
            the sticky header&apos;s backdrop-filter would otherwise become the
            containing block for a fixed scrim and trap it inside the header.
          </p>
          {dialog && (
            <Dialog title="A dialog" onClose={() => setDialog(false)}>
              <p className="mb-3 text-[13px] leading-relaxed text-nb-ink-soft">
                The one-liner that says what the agent will do sits here, in ink-soft
                13px, under the bold ink title. Then the input, then the buttons.
              </p>
              <textarea
                className="w-full resize-y rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper px-3 py-2.5 text-[14px] text-nb-ink placeholder:text-nb-ink-soft/60 focus:outline-2 focus:outline-offset-1 focus:outline-nb-accent"
                rows={3}
                placeholder="What do you want to happen?"
              />
              <DialogButtons
                onClose={() => setDialog(false)}
                confirmLabel="Create task"
                onConfirm={() => setDialog(false)}
              />
            </Dialog>
          )}
        </div>
      </Section>

      <Section
        id="chips"
        title="Chips and markers"
        note="components/chips.tsx — .nb-chip is borderless by design: a card already carries three or four of these, and a frame on each would draw a row of boxes inside a box. Meaning comes from the fill, and every one of them is 10px bold uppercase, so the row reads as one strip of facts rather than a set of competing labels. It is deliberately the smallest type the board sets: a chip annotates the card title and must never rival it."
      >
        <div className="nb-panel space-y-6 px-5 py-5">
          <div>
            <Label>priority and roi — the hero signal, and the one below it</Label>
            <Row>
              <PriorityChip value="high" />
              <PriorityChip value="med" />
              <PriorityChip value="low" />
              <RoiTag value="high" />
              <RoiTag value="low" />
            </Row>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
              Same three-level scale, deliberately not the same weight: roi drops
              the fill for a dot so it reads one rung down instead of mirroring
              priority as a second identical pill.
            </p>
          </div>
          <div>
            <Label>stage — what the card is, when nothing is running on it</Label>
            <Row>
              <StatusPill status="ready" />
              <StatusPill status="ready" detailed />
              <StatusPill status="implementing" />
              <PendingPill label="implement · waiting on #17" />
              <PendingPill label="refine · waiting on #17" detailed />
              <span className="text-[12.5px] text-nb-ink-soft">
                todo draws nothing — the board stays quiet until a card is vetted
                or in flight
              </span>
            </Row>
            <p className="mt-2.5 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
              <strong>pending</strong> is not a fourth stage — the card keeps the one
              it had, and the queue still groups it there. It stands in for the pill
              while a run is queued behind the card&apos;s blockers, in the peach the
              board gives everything that is in the way, and the hover carries what
              will run and what it waits for.
            </p>
          </div>
          <div>
            <Label>markers — icon-only, named on hover</Label>
            <Row>
              <GroupChip />
              <BlockedChip blockers={[{ id: 17, title: "Port the contrast helper" }]} />
              <RunningBadge label="implementing" />
              <TodoProgress done={2} total={5} />
              <TodoProgress done={5} total={5} />
              <TodoProgress done={3} total={8} width={120} />
            </Row>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
              A running badge always replaces the stage pill — one mark per card,
              never both — and names which action is in flight rather than saying
              &ldquo;running&rdquo;.
            </p>
          </div>
          <div>
            <Label>where a card came from and what it touches</Label>
            <Row>
              <TrackChip track="ui" />
              <TrackChip track="blockers" />
              <TrackChip track="recurring" />
              <ModuleChip module="board" />
              <ModuleChip module="skill" />
            </Row>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
              Lilac for the kind of effort, mint for the part of the product it
              lands in — two chips that would read as one thing in one colour. The
              two reserved folders say so: peach for blockers, a repeat icon for
              recurring.
            </p>
          </div>
          <div>
            <Label>an open question, and who owns it</Label>
            <div className="max-w-xl text-[13px] font-[700] leading-[19px]">
              <p>
                <QuestionTagBadge tag="user" />
                Does /design ship in the desktop app, or stay a dev-only route?
              </p>
              <p className="mt-1.5">
                <QuestionTagBadge tag={null} />
                Should the contrast table read its tokens from globals.css?
              </p>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
              Borderless, like roi: every list this marks already sits inside a
              panel, and a filled pill in there is a box pasted on a box. It leads
              the question inline so the text wraps back under it.
            </p>
          </div>
          <div>
            <Label>the tooltip — .nb-tip plus a data-tip string</Label>
            <Row>
              <span
                className="nb-tip nb-chip"
                tabIndex={0}
                data-tip="a small dark bubble, on hover or keyboard focus"
                style={{ background: "var(--color-nb-sky-soft)", color: "var(--color-nb-sky-ink)" }}
              >
                hover me
              </span>
              <span className="text-[12.5px] text-nb-ink-soft">
                Un-cased on purpose, so the tip reads as a sentence even off an
                uppercase chip.
              </span>
            </Row>
          </div>
          <div>
            <Label>the highlighter — .nb-mark</Label>
            <p className="max-w-xl text-[14px] leading-relaxed">
              A soft ember swipe under a phrase, for the{" "}
              <span className="nb-mark">one clause that carries the sentence</span>{" "}
              — a band, not a fill, so the ink still reads as ink.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="controls"
        title="Controls"
        note="components/ui/select.tsx is the board's one dropdown — Radix, restyled, so the open list is an ink-framed paper panel on every platform rather than the OS menu. It has two looks: the settings-pane box, and the same trigger dressed down to chip size, where the meaning fill is the only chrome. These are live — pick something."
      >
        <div className="nb-panel space-y-6 px-5 py-5">
          <div>
            <Label>the box — a settings pane, a dialog</Label>
            <div className="max-w-xs">
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-code" hint={<span className="text-[11px] text-nb-ink-soft">the default</span>}>
                    Claude Code
                  </SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="cursor">Cursor</SelectItem>
                  <SelectItem value="opencode">OpenCode</SelectItem>
                  <SelectItem value="dsh">DeepSeek Harness</SelectItem>
                  <SelectItem value="zcode">ZCode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>the same trigger at chip size — a card&apos;s editable meta</Label>
            <Row>
              <LevelSelect value={level} onChange={setLevel} />
              <ReleaseSelect value={release} releases={["v0.6", "v0.7"]} onChange={setRelease} />
              <LevelSelect value={level} disabled onChange={() => {}} />
            </Row>
          </div>
          <div>
            <Label>the cadence control — three pieces read as one sentence</Label>
            <CadenceSelect value={cadence} onChange={setCadence} />
            <p className="mt-2.5 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
              The count is a box, not a list — real jobs want 5 minutes or 12 hours,
              and a list long enough to cover them is worse than typing two digits.
              The time of day appears only for days, the one interval it can mean
              anything for. &ldquo;No cadence&rdquo; is an entry in the unit list
              rather than a clear button beside it: taking a schedule off is the
              same kind of decision as setting one.
            </p>
          </div>
          <div>
            {/* Replicas, not imports: the tab strip and the pick chips live as
                local consts in components/agent-shared.tsx (TABS, PICK_CHIP) and
                were never exported. Change them there and change them here. */}
            <Label>the tab strip — a hairline under both, an ember lap under the live one</Label>
            <div className="mb-4 flex max-w-md gap-5 border-b border-nb-ink/12" role="tablist">
              {(
                [
                  { key: "describe", label: "Describe a task" },
                  { key: "propose", label: "Propose tasks" },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={`relative cursor-pointer pb-2 text-[13.5px] tracking-[-0.01em] transition-colors ${
                      active ? "font-[800] text-nb-ink" : "font-[600] text-nb-ink-soft hover:text-nb-ink"
                    }`}
                  >
                    {t.label}
                    {active && (
                      <span
                        className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-nb-accent"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <Label>the pick chips — a tap target, a step up from a meta chip</Label>
            <Row>
              {["board", "skill", "site"].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={pick === m}
                  onClick={() => setPick(m)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 py-[5px] text-[12px] font-[700] uppercase leading-none tracking-[0.04em] transition-[color,background-color,opacity] ${
                    pick === m
                      ? "bg-nb-accent-soft text-nb-accent-deep"
                      : "bg-nb-wash text-nb-ink-soft hover:text-nb-ink"
                  }`}
                >
                  {m}
                </button>
              ))}
            </Row>
          </div>
          <div>
            <Label>the two-segment switch — one choice with two answers</Label>
            <div
              role="group"
              aria-label="Board layout"
              className="inline-flex h-9 items-center gap-0.5 rounded-[9px] border-[1.5px] border-nb-ink bg-nb-paper p-0.5 shadow-[2px_2px_0_0_var(--color-nb-ink)]"
            >
              {(["Board", "Queue"] as const).map((v, i) => (
                <span
                  key={v}
                  className="inline-flex h-full items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-[700]"
                  style={{
                    background: i === 0 ? "var(--color-nb-accent-soft)" : "transparent",
                    color: i === 0 ? "var(--color-nb-accent-deep)" : "var(--color-nb-ink-soft)",
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
            <p className="mt-2.5 max-w-3xl text-[12.5px] leading-relaxed text-nb-ink-soft">
              The filled segment says which view is on without a second mark, and
              the group shares the 36px frame of the header&apos;s other controls so
              the row still reads as one strip. Below sm the labels go
              screen-reader-only and the icons carry it — nothing is removed, and
              every tap target keeps its size.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="run"
        title="The run log"
        note="components/agent-shared.tsx — the one artifact every place that shows a run reuses: the card page, the board overlay, the runs panel. An ink-framed window with a gradient title bar, the run's facts in one middot row, and a wash body sunk into it. A live run tails its raw event stream in mono; a finished one leads with the agent's final message as markdown and folds the events it streamed on the way into a collapsed row above."
      >
        <SessionLog session={DONE_SESSION} flush />
      </Section>

      <Section
        id="diff"
        title="The diff"
        note="components/Diff.tsx — what a delivery changed, laid out to be reviewed. The changed files are a tree on the left and one continuous listing on the right: a file header that sticks while its hunks pass under it, both line numbers pinned to the left edge, and a band per changed line. Mint is added and peach is removed, sky heads a hunk, and the ember marks only the file being read."
      >
        <div className="nb-panel overflow-hidden">
          <DiffPane diff={DIFF_SPECIMEN} />
        </div>
      </Section>

      <Section
        id="type"
        title="Type"
        note="System sans throughout, at hard pixel sizes rather than a scale — the board is a dense tool, and each of these is the size its job needs. Weights do the hierarchy: 800 for a title, 700 for a label or a chip, 600 for a ghost button and a list row, 400 for prose. Titles carry negative tracking; anything uppercase carries positive."
      >
        <div className="nb-panel divide-y-[1.5px] divide-nb-ink/12">
          {[
            { cls: "text-[34px] font-[800] tracking-[-0.03em]", spec: "34 / 800 / -0.03em", what: "this page's title, and nothing in the board" },
            { cls: "text-[17px] font-[800] tracking-[-0.02em]", spec: "17 / 800 / -0.02em", what: "the brand in the header — the largest type the board sets" },
            { cls: "text-[15px] font-[800] tracking-[-0.02em]", spec: "15 / 800", what: "a dialog title" },
            { cls: "text-[13px] font-[700] tracking-[-0.01em]", spec: "13 / 700", what: "a card title" },
            { cls: "text-[14px]", spec: "14 / 400", what: "a button label, a select, an input" },
            { cls: "text-[13px] leading-relaxed", spec: "13 / 400", what: "dialog copy, an open question" },
            { cls: "text-[12.5px] leading-relaxed", spec: "12.5 / 400", what: "an option row, a warning box" },
            { cls: "text-[12px] text-nb-ink-soft", spec: "12 / 400", what: "a count, a blurb under a label" },
            { cls: "text-[11px] text-nb-ink-soft tabular-nums", spec: "11 / 400 tabular", what: "a run's duration and cost" },
            { cls: "text-[10px] font-[700] uppercase tracking-[0.04em]", spec: "10 / 700 / 0.04em", what: "every meaning chip" },
            { cls: "text-[11px] font-[700] uppercase tracking-[0.12em]", spec: "11 / 700 / 0.12em", what: ".nb-tag — a section kicker" },
            { cls: "font-mono text-[12px] text-nb-ink-soft", spec: "mono 12", what: "the agent's event tail" },
          ].map((t) => (
            <div key={t.spec} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className={`block truncate ${t.cls}`}>The quick brown fox</span>
                <span className="mt-1 block text-[12px] text-nb-ink-soft">{t.what}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">{t.spec}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="motion"
        title="Motion"
        note="Short, mechanical, and always about a thing you touched. 120ms is the house transition; nothing eases longer than a third of a second, and nothing moves that you did not act on — except the one pulse that says an agent is working."
      >
        <div className="nb-panel space-y-6 px-5 py-5">
          <div>
            <Label>.nb-press — lift 1px on hover, settle 1px on click</Label>
            <Row>
              <span className="nb-panel-sm nb-press inline-block cursor-pointer px-4 py-3 text-[13px] font-[700]">
                press me
              </span>
              <span className="text-[12.5px] text-nb-ink-soft">
                The shadow grows to 4px under the lift and collapses to 1px under
                the press, so the block reads as a physical thing rather than a
                rectangle that changed colour.
              </span>
            </Row>
          </div>
          <div>
            <Label>nbPulse — a live agent, 1.1s in and out</Label>
            <Row>
              <span className="size-[7px] rounded-full bg-nb-accent-deep animate-[nbPulse_1.1s_ease-in-out_infinite]" />
              <RunningBadge label="refining" />
              <span className="text-[12.5px] text-nb-ink-soft">
                The only thing on the board that moves on its own.
              </span>
            </Row>
          </div>
          <div>
            <Label>the rest, by name</Label>
            <ul className="max-w-3xl space-y-1.5 text-[12.5px] leading-relaxed text-nb-ink-soft">
              <li>
                <span className="font-mono text-nb-ink">nbPopIn</span> · 130ms — an
                open select list settles down from 3px above its trigger, so it
                reads as dropping out of the trigger rather than blinking in.
              </li>
              <li>
                <span className="font-mono text-nb-ink">nbFadeIn / nbFadeOut</span> ·
                100ms — a scrim, a closing list.
              </li>
              <li>
                <span className="font-mono text-nb-ink">nbSlideInRight / nbSlideOutRight</span>{" "}
                — the runs sheet coming in from the edge.
              </li>
              <li>
                <span className="font-mono text-nb-ink">active:scale-90</span> · 100ms
                — a bare icon button (a dialog close, a stop ✕), which has no shadow
                to collapse and so shrinks instead.
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <p className="mt-14 text-[12.5px] leading-relaxed text-nb-ink-soft">
        Tokens and classes: app/globals.css. Blocks: components/. The site&apos;s
        own system, in the azure this app trades for the ember, is at{" "}
        <a
          className="font-[700] text-nb-accent-deep hover:underline"
          href="https://ai4kanban.dev/design"
        >
          ai4kanban.dev/design
        </a>
        .
      </p>
    </main>
  );
}
