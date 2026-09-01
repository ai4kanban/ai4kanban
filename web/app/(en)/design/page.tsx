import type { ReactNode } from "react";
import {
  FiActivity,
  FiBookmark,
  FiBox,
  FiCopy,
  FiGithub,
  FiList,
} from "react-icons/fi";
import { Band } from "@/components/Band";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconChip } from "@/components/ui/IconChip";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Mat, printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import {
  framed,
  panel,
  panelBare,
  panelInset,
  panelStatic,
} from "@/components/styles";
import { contrast, format, verdict } from "@/lib/contrast";

// Every token and every block the site ships, on one screen, with the measured
// contrast of each pair it puts in front of a reader. Nothing here declares a
// style of its own that a page doesn't: the blocks are imported from
// components/ui and components/styles.ts, and the colors are read from the same
// `@theme` in app/globals.css. Add a pair to the table below whenever you add a
// surface — color was being decided from memory here, and a tint that reads fine
// as a class name turned out to be a 1.31:1 hairline on the page.
//
// The theme in four lines:
//
//   The page is white and mostly stays white; the warm off-white is a band
//   under one section, and the mat under a picture. The ink is the board's own
//   near-black (kanban-ui/app/globals.css).
//
//   The ember is an object: a fill, a bar, a mark. Never a page, never a panel,
//   never an outline.
//
//   The hard ink shadow is what makes a block. The outline is the exception —
//   every button, and the one panel that has to read as primary — and when it
//   is there it is ink, in every state. Hover moves the block, and on a button
//   it moves the fill.
//
//   `accent` is the ember at rest. `accent-deep` is what it darkens to under
//   the pointer, and the only cut of it that can be read as prose.

export const metadata = {
  title: "Design system · AI4Kanban",
  robots: { index: false, follow: false },
};

// ── The tokens ───────────────────────────────────────────────────────────────
// These mirror the `@theme` block in app/globals.css, which is the source of
// truth — they are restated here because the contrast math runs at build time
// and can't read a CSS variable. Change one there, change it here.
//
// The page and paper are the same white; `band` is the warm the page steps to
// under one section, and `code` the wash a block sinks to. The ink and the
// ember are the board's own values, so the site and the app are one product.
const BG = "#ffffff"; // the page
const BAND = "#f8f5ef"; // the warm band — a section ground, used sparingly
const ELEV = "#ffffff"; // paper — the panel fill
const CODE = "#f0ebe1"; // the wash — inset on a panel
const INK = "#24231f"; // every outline, every shadow, body text
const MUTED = "#635a4e"; // leads, captions, nav links
const ACCENT = "#dd4f1e"; // the ember: fills, bars, the mark
const DEEP = "#b83a12"; // the pressed ember, and the ember a word can sit on
const GROWTH = "#2f6b46";
const CAUTION = "#9e1b45";

const TOKENS = [
  { name: "bg", hex: BG, use: "the page — white, and most of it stays white" },
  { name: "band", hex: BAND, use: "the warm band — one section's ground, and the mat under a picture" },
  { name: "elev", hex: ELEV, use: "paper — the panel fill" },
  { name: "code", hex: CODE, use: "the wash — inset on a panel" },
  { name: "border / ink", hex: INK, use: "every outline, every shadow, body text" },
  { name: "muted", hex: MUTED, use: "leads, captions, nav links" },
  { name: "accent", hex: ACCENT, use: "the resting ember — fills, bars, glyphs, the mark" },
  { name: "accent-deep", hex: DEEP, use: "the pressed ember, and the ember as text" },
  { name: "growth", hex: GROWTH, use: "a win on the comparison pages" },
  { name: "caution", hex: CAUTION, use: "a loss on the comparison pages" },
];

// Every pair the theme puts in front of a reader. `size` is the bar it has to
// clear: body copy 4.5:1, large type and anything you only need to see the
// shape of 3:1.
const PAIRS: {
  fg: string;
  bg: string;
  label: string;
  size?: "body" | "large" | "non-text";
  where: string;
}[] = [
  { fg: INK, bg: BG, label: "ink on bg", where: "headings, body" },
  { fg: MUTED, bg: BG, label: "muted on bg", where: "leads, captions" },
  { fg: INK, bg: BAND, label: "ink on band", where: "headings, body in a banded section" },
  { fg: MUTED, bg: BAND, label: "muted on band", where: "leads, captions in a banded section" },
  { fg: DEEP, bg: BAND, label: "accent-deep on band", where: "eyebrows, links in a banded section" },
  { fg: INK, bg: ELEV, label: "ink on elev", where: "text on a panel" },
  { fg: MUTED, bg: ELEV, label: "muted on elev", where: "secondary text on a panel" },
  { fg: INK, bg: CODE, label: "ink on code", where: "terminals, inset panels" },
  { fg: MUTED, bg: CODE, label: "muted on code", where: "the losing half of a comparison row" },
  { fg: DEEP, bg: BG, label: "accent-deep on bg", where: "eyebrows, links" },
  { fg: DEEP, bg: ELEV, label: "accent-deep on elev", where: "column heads, prose links on a panel" },
  { fg: DEEP, bg: CODE, label: "accent-deep on code", where: "tree dirs, terminal accents — the tightest of the three, and what caps how bright accent-deep can go" },
  { fg: ELEV, bg: DEEP, label: "elev on accent-deep", where: "a chip's label, and the primary button held under the pointer" },
  { fg: ELEV, bg: INK, label: "elev on ink", where: "footer body, dark blocks" },
  {
    fg: ACCENT,
    bg: BG,
    label: "accent block vs bg",
    size: "non-text",
    where: "how far the ember separates from the page as a shape",
  },
  {
    fg: DEEP,
    bg: BG,
    label: "accent-deep block vs bg",
    size: "non-text",
    where: "the same for the deep ember — this is why the CTA is filled with it",
  },
  {
    fg: ELEV,
    bg: ACCENT,
    label: "elev on accent · glyphs",
    size: "non-text",
    where:
      "the logo's white glyph and the paper mark on an icon block — drawing, not prose, so the bar is 3:1",
  },
  {
    fg: ELEV,
    bg: ACCENT,
    label: "elev on accent · the CTA label",
    where:
      "the one pair on the site that is knowingly short, and the only one. The primary button rests on the ember the board's own Create task rests on; filling it with accent-deep bought 2.4 points and cost the page its mood. No brighter ember clears 4.5:1 — accent-deep already sits at that ceiling. The label is bold, the block is outlined and shadowed, and colour is never its only marker.",
  },
  { fg: GROWTH, bg: BG, label: "growth on bg", where: "a win" },
  { fg: CAUTION, bg: BG, label: "caution on bg", where: "a loss" },
];

// ── The page's own furniture ─────────────────────────────────────────────────

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-8">
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {note && (
        <p className="mt-2.5 max-w-3xl text-[0.95rem] leading-relaxed text-muted">
          {note}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: string }) {
  return (
    <p className="mb-2.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted">
      {children}
    </p>
  );
}

// The five paintings the landing page mounts its screenshots on, drawn by the
// same module the page draws them with. They are here so the palette can be
// judged against the artwork it has to sit next to rather than against a memory
// of it — and so the set can be read as a set: five two-pigment washes on
// alternating diagonals, and the one warm paper under all of them, which is what
// gives a mat an edge on a white page and gives its white print something to sit
// against.
const MATS: { name: WashName; note: string }[] = [
  { name: "emberLilac", note: "hero — the brand pair, and the only one that moves" },
  { name: "mintSky", note: "loop 01, and the memory tree" },
  { name: "peachEmber", note: "loop 02, and the iteration diagram" },
  { name: "skyLilac", note: "loop 03" },
  { name: "emberMint", note: "loop 04 — the ember lands last" },
];

export default function DesignPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          What the site ships
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Design system</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          Every token and every block, rendered from the modules the pages
          import, with every pair measured rather than eyeballed.
        </p>

        <Section
          id="washes"
          title="The washes"
          note="Every watercolour under a landing-page screenshot, painted rather than downloaded (components/home/washes.ts). Two pigments per mat, on a diagonal that flips from one mat to the next, with the paper left empty through the middle where the print sits. Nothing you have to read ever sits on pigment, which is what buys a page whose palette is otherwise four colours five two-colour paintings."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MATS.map((m) => (
              <div key={m.name}>
                {/* The mat exactly as a page mounts one: bare, with a print
                    laid on it. The print here is blank paper, because what is
                    being judged is the ground under a screenshot. */}
                <Mat wash={m.name} className="p-5">
                  <div className={`${printFrame} h-24 bg-elev`} />
                </Mat>
                <p className="mt-2 font-mono text-[0.8rem] text-ink">{m.name}</p>
                <p className="text-[0.85rem] leading-snug text-muted">
                  {m.note}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[0.9rem] leading-relaxed text-muted">
            The pigments are saturated cuts of the colours the board tints its
            cards with, so the site&apos;s artwork and the product&apos;s chips
            come out of one box. They are not tokens — a wash is illustration,
            and a value that can never touch type does not belong in a table
            that exists to be measured.
          </p>
        </Section>

        <Section
          id="palette"
          title="Palette"
          note="A white page and its paper, the warm band a section can step to, and the wash a block sinks to — plus a warm near-black ink and one ember in two strengths. Ten values, and only two of them are coloured."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOKENS.map((t) => (
              <div key={t.name} className={`${panelStatic} overflow-hidden`}>
                <div
                  className="h-16 border-b-2 border-border"
                  style={{ background: t.hex }}
                />
                <div className="px-4 py-3">
                  <p className="font-mono text-[0.85rem] font-semibold text-ink">
                    {t.name}
                  </p>
                  <p className="font-mono text-xs text-muted">{t.hex}</p>
                  <p className="mt-1.5 text-[0.85rem] leading-snug text-muted">
                    {t.use}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="contrast"
          title="Contrast"
          note="WCAG 2.1. Body copy needs 4.5:1; large type and anything you only need to see the shape of needs 3:1. Add a pair here whenever you add a surface."
        >
          <div className={`${panelStatic} divide-y-2 divide-border`}>
            {PAIRS.map((p) => {
              const ratio = contrast(p.fg, p.bg);
              const v = verdict(ratio, p.size ?? "body");
              return (
                <div
                  key={p.label}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3"
                >
                  <span
                    className="flex h-11 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-border font-semibold"
                    style={{ background: p.bg, color: p.fg }}
                  >
                    Ag
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[0.85rem] text-ink">
                      {p.label}
                    </span>
                    <span className="block text-[0.85rem] leading-snug text-muted">
                      {p.where}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[0.85rem] text-ink">
                      {format(ratio)}
                    </span>
                    <span
                      className={`rounded-full border-2 px-2.5 py-0.5 font-mono text-[0.7rem] font-semibold ${
                        v.passes
                          ? "border-border bg-growth text-elev"
                          : "border-caution text-caution"
                      }`}
                    >
                      {v.passes ? (v.aaa ? "AAA" : "AA") : `FAILS ${v.min}:1`}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          id="logo"
          title="The logo"
          note="components/ui/Logo.tsx — the square block and the name, on one line. It is the bright ember, the same fill the board's own mark takes, and it is the one place on the site the shadow is doubled: the deep ember one step out, the ink two, so the block reads as lit twice rather than as a swatch with a drop. The glyph is a board reduced to three columns that step down as work leaves it, in paper white, because a filled ember block carries a paper glyph or it carries nothing."
        >
          <div className={`${panelStatic} space-y-7 px-6 py-6`}>
            <div>
              <Label>logo · sm / md / lg</Label>
              <div className="flex flex-wrap items-end gap-8">
                <Logo size="sm" />
                <Logo size="md" />
                <Logo size="lg" />
              </div>
            </div>
            <div>
              <Label>mark alone · on paper, on the wash, on the ink</Label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-4 rounded-lg border-2 border-border bg-elev px-5 py-4">
                  <LogoMark size="sm" />
                  <LogoMark size="md" />
                  <LogoMark size="lg" />
                </span>
                <span className="flex items-center gap-4 rounded-lg border-2 border-border bg-code px-5 py-4">
                  <LogoMark size="md" />
                </span>
                {/* On the ink the outline is the ground, so the block is read
                    by its fill and its glyph alone — which is why the fill is
                    the ember at full strength and never a tint of it. */}
                <span className="flex items-center gap-4 rounded-lg border-2 border-border bg-ink px-5 py-4 text-elev">
                  <Logo size="md" tone="ink" />
                </span>
              </div>
            </div>
            <div>
              <Label>at the sizes a favicon and a tab actually get</Label>
              <div className="flex flex-wrap items-end gap-4">
                {[16, 20, 24, 32].map((px) => (
                  <span key={px} className="text-center">
                    <img
                      src="/favicon.svg"
                      alt=""
                      width={px}
                      height={px}
                      style={{ width: px, height: px }}
                    />
                    <span className="mt-2 block font-mono text-[0.7rem] text-muted">
                      {px}
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-muted">
                public/logo-mark.svg and public/logo.svg are the same geometry
                as the component, for anywhere off the site. The mark is pure
                shape; the lockup sets the name in live text, so a renderer with
                no fonts should take the mark and set the name itself. The row
                above is public/favicon.svg — the same mark, double offset and
                all. The board app is the one place that drops it, because a
                22px block in its own header can&apos;t carry one.
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          note="components/ui/Button.tsx — one block, two fills, and the 2px ink outline in every state. The button is the one thing that carries the outline by default, which is what separates it from the panels around it: a panel is lifted, a button is lifted and drawn. Hover lifts it further, grows the shadow and changes the fill — the primary brightens to the ember, the paper one drops to the wash."
        >
          <div className={`${panelStatic} space-y-7 px-6 py-6`}>
            <div>
              <Label>primary / secondary · md</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Start with one prompt</Button>
                <Button>View on GitHub ↗</Button>
              </div>
            </div>
            <div>
              <Label>primary / secondary · sm</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">
                  <FiCopy className="h-4 w-4" aria-hidden="true" />
                  Copy setup prompt
                </Button>
                <Button size="sm">
                  <FiGithub className="h-4 w-4" aria-hidden="true" />
                  GitHub
                </Button>
              </div>
            </div>
            <div>
              <Label>icon — the phone header, where a label won&apos;t fit</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="icon" aria-label="Copy">
                  <FiCopy className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button size="icon" aria-label="GitHub">
                  <FiGithub className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div>
              <Label>hover, held open</Label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex -translate-x-0.5 -translate-y-0.5 items-center justify-center rounded-lg border-2 border-border bg-accent px-6 py-3 font-semibold text-elev shadow-[6px_6px_0_0_var(--color-ink)]">
                  Start with one prompt
                </span>
                <span className="inline-flex -translate-x-0.5 -translate-y-0.5 items-center justify-center rounded-lg border-2 border-border bg-code px-6 py-3 font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)]">
                  View on GitHub ↗
                </span>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="panels"
          title="Surfaces"
          note="components/styles.ts — two styles, raised and bare, with nothing between them. A block either takes the 4px hard ink shadow, or it takes nothing at all and is separated by the step it sits on in the ramp. The 2px ink outline is not part of either: it is a modifier, `framed`, and by default only a button wears it. There is no 1px grey in the system — that is the compromise that makes a page look busy and undesigned at once, and once it exists every block gets one. Raised is for a block that is an object on the page: a card, the one surface a section is built around. Everything else is bare."
        >
          <Label>style 1 · raised — 4px hard ink shadow, no outline</Label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`${panel} p-5`}>
              <p className="font-mono text-[0.85rem] font-semibold">panel</p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                Paper on the page, lifted by the ink shadow. Lifts further on
                hover — try it.
              </p>
            </div>
            <div className={`${panelStatic} p-5`}>
              <p className="font-mono text-[0.85rem] font-semibold">panelStatic</p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                The same block with no hover, for a card that isn&apos;t
                clickable.
              </p>
            </div>
            <div className={`${panelInset} p-5`}>
              <p className="font-mono text-[0.85rem] font-semibold">panelInset</p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                Filled with the wash, for a block sunk into the page. Which of
                two cards matters is said with this ramp, not with a border.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <Label>
              the modifier · framed — the outline back on, for the primary one
            </Label>
            {/* The pair is the whole argument: the same block twice, and the
                outline only says "this one" while the block beside it isn't
                saying it too. Frame both and neither is being pointed at. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`${panelStatic} p-5`}>
                <p className="font-mono text-[0.85rem] font-semibold">
                  panelStatic
                </p>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                  The default. A handful of these on a screen still read as a
                  handful of blocks.
                </p>
              </div>
              <div className={`${panelStatic} ${framed} p-5`}>
                <p className="font-mono text-[0.85rem] font-semibold">
                  panelStatic + framed
                </p>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                  One per screen. It composes because no panel string sets a
                  border — the fill is the thing you can&apos;t append.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Label>
              style 2 · bare — no border, no shadow, separated by the ramp
            </Label>
            {/* Shown on the wash, because that is the point: a bare block is
                only a block when it lands on the step next to its ground. */}
            <div className="rounded-xl bg-code p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className={`${panelBare} p-5`}>
                  <p className="font-mono text-[0.85rem] font-semibold">
                    panelBare
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                    Paper, cut out of whatever it sits on. Every part of a
                    composite: a node in a diagram, a tile in a grid, a row in a
                    list.
                  </p>
                </div>
                <div className="rounded-xl bg-accent p-5 text-elev">
                  <p className="font-mono text-[0.85rem] font-semibold">
                    a filled block
                  </p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed opacity-80">
                    Read by its fill, so it is never framed — an ink outline
                    would only make it weigh the same as the tiles beside it.
                  </p>
                </div>
                <Mat wash="skyLilac" className="min-h-28" >
                  <span className="sr-only">A wash, bare</span>
                </Mat>
              </div>
            </div>
            <p className="mt-3 text-[0.9rem] text-muted">
              The block those three sit in is <code>panelBareInset</code> — the
              wash, bare, on the page. Artwork is bare for a second reason: an
              ink box around a watercolour is a frame around a picture, and four
              down a column read as four boxes, which is why the mats in{" "}
              <code>components/home/Loop.tsx</code> carry none.
            </p>
          </div>
        </Section>

        <Section
          id="bands"
          title="Bands"
          note="components/Band.tsx — the page is white and stays white, so the warm is a ground one section steps to, two or three times down a page. A band is not a surface: no outline, no shadow, and a raised panel sits on it exactly as it sits on the page. Its edges dissolve in the mats' own pixels rather than starting on a rule — a line across the page announces a boundary, and this one has nothing to announce. Shown inset here; on a real page it runs the full viewport."
        >
          <Band>
            <p className="max-w-3xl text-[0.95rem] leading-relaxed text-muted">
              Give a band to a section that needs paper to read as paper — a
              comparison whose winning column is the brighter one has nothing to
              be brighter than on white — or to the section that closes a page.
              A band that runs into the ink footer drops its lower edge: the
              footer is already the hardest edge on the site.
            </p>
            <div className={`${panelStatic} mt-6 p-5`}>
              <p className="font-mono text-[0.85rem] font-semibold">
                panelStatic, on a band
              </p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                Paper again, and read by its fill as well as its shadow. This is
                what a band buys.
              </p>
            </div>
          </Band>
        </Section>

        <Section
          id="icons"
          title="Icons and chips"
          note="components/ui/IconChip.tsx and Chip.tsx. Both are filled at full strength. The icon block takes the resting ember — a glyph is drawing, so 3:1 — and the chip takes accent-deep, because a chip carries a word."
        >
          <div className={`${panelStatic} space-y-7 px-6 py-6`}>
            <div>
              <Label>iconChip · ember / ink · sm and md</Label>
              <div className="flex flex-wrap items-center gap-3">
                <IconChip icon={FiBookmark} />
                <IconChip icon={FiActivity} tone="ink" />
                <IconChip icon={FiBookmark} size="md" />
                <IconChip icon={FiActivity} tone="ink" size="md" />
              </div>
            </div>
            <div>
              <Label>chip · neutral / solid</Label>
              <div className="flex flex-wrap items-center gap-2.5">
                <Chip>Node.js 18+</Chip>
                <Chip>Just provide the project goal</Chip>
                <Chip tone="solid">Markdown</Chip>
              </div>
            </div>
            <div>
              <Label>a node, as the diagrams draw it</Label>
              {/* Nothing here is framed and nothing casts a shadow — a diagram
                  is twenty parts, and twenty ink frames nested three deep draw
                  a grid of boxes over the top of the flow the picture is for.
                  Every edge in it is a change of fill instead. */}
              <div className="rounded-xl bg-code p-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { t: "Decision history", i: FiBookmark },
                    { t: "Requirements", i: FiList },
                    { t: "Project modules", i: FiBox },
                    { t: "Run history", i: FiActivity },
                  ].map((n) => (
                    <div
                      key={n.t}
                      className="flex flex-col items-center gap-2.5 rounded-lg bg-elev px-2 py-3.5 text-center"
                    >
                      <IconChip icon={n.i} />
                      <span className="text-[0.85rem] leading-snug">{n.t}</span>
                    </div>
                  ))}
                </div>
                {/* The one filled ember block on a screen: the piece
                    everything above and below it connects to, and the only
                    thing in the diagram that raises its voice. */}
                <div className="mt-2.5 rounded-lg bg-accent px-4 py-3.5 text-center font-mono text-[0.95rem] font-bold text-elev">
                  AI4Kanban Skill
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="heading"
          title="Section heading"
          note="components/SectionHeading.tsx — an ember bar, the number in mono, then the H2. The bar carries no text, which is the one job the bright ember does on its own."
        >
          <div className={`${panelStatic} px-6 py-6`}>
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
                04 · Iteration
              </span>
            </div>
            <h3 className="mt-3 text-3xl font-bold tracking-tight">
              Drive continuous product iteration
            </h3>
            <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
              It brings your goals, code, and project memory together to manage
              work from planning through completion.
            </p>
          </div>
        </Section>

        <Section
          id="dark"
          title="The dark band"
          note="The site footer: the palette inverted rather than a new colour — the ink as the ground, the paper as the type."
        >
          {/* Bare, like the real one: the band bleeds to both edges of the
              viewport, so it has no outside to draw. */}
          <div className="rounded-xl bg-ink px-6 py-8 text-sm text-elev/70">
            <p className="text-center">
              GitHub · Documentation · Recipes · Apache License 2.0
            </p>
            <p className="mt-3 text-center text-elev/30">
              elev/70 for body · elev/30 for separators
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}
