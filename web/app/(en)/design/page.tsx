import type { ReactNode } from "react";
import {
  FiActivity,
  FiBookmark,
  FiBox,
  FiCopy,
  FiGithub,
  FiList,
} from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { IconChip } from "@/components/ui/IconChip";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { panel, panelInset, panelStatic } from "@/components/styles";
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
//   The ground is neutral — white paper on a light neutral page, near-black
//   ink. It is the ground every tool a developer already has open uses.
//
//   The blue is an object: a fill, a bar, a mark. Never a page, never a panel,
//   never an outline.
//
//   Every outline is ink, in every state. Hover moves the block, and on a
//   button it moves the fill.
//
//   `accent` is a shape. `accent-deep` is the only blue that carries a label.

export const metadata = {
  title: "Design system · AI4Kanban",
  robots: { index: false, follow: false },
};

// ── The tokens ───────────────────────────────────────────────────────────────
// These mirror the `@theme` block in app/globals.css, which is the source of
// truth — they are restated here because the contrast math runs at build time
// and can't read a CSS variable. Change one there, change it here.
//
// The neutrals are a three-step ramp — page, paper, wash — kept genuinely
// neutral so nothing on them casts a color, and light so the page reads bright.
// The azure is sampled off cdn.ai4kanban.dev/bloom-*.jpg, where the pigment
// lands between #5fa5f5 and #7ab2f3.
const BG = "#f5f6f8"; // the page
const ELEV = "#ffffff"; // paper — the panel fill
const CODE = "#edeff3"; // the wash — inset on a panel
const INK = "#191c22"; // every outline, every shadow, body text
const MUTED = "#4d5c73"; // leads, captions, nav links
const ACCENT = "#2f7ff5"; // the azure: fills and bars
const DEEP = "#12509e"; // the blue as text, and the blue you put a label on
const GROWTH = "#0f7350";
const CAUTION = "#b32438";

const TOKENS = [
  { name: "bg", hex: BG, use: "the page — a light neutral, no cast" },
  { name: "elev", hex: ELEV, use: "paper — the panel fill" },
  { name: "code", hex: CODE, use: "the wash — inset on a panel" },
  { name: "border / ink", hex: INK, use: "every outline, every shadow, body text" },
  { name: "muted", hex: MUTED, use: "leads, captions, nav links" },
  { name: "accent", hex: ACCENT, use: "fills and bars" },
  { name: "accent-deep", hex: DEEP, use: "the blue as text, and under a label" },
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
  { fg: INK, bg: ELEV, label: "ink on elev", where: "text on a panel" },
  { fg: MUTED, bg: ELEV, label: "muted on elev", where: "secondary text on a panel" },
  { fg: INK, bg: CODE, label: "ink on code", where: "terminals, inset panels" },
  { fg: MUTED, bg: CODE, label: "muted on code", where: "the losing half of a comparison row" },
  { fg: DEEP, bg: BG, label: "accent-deep on bg", where: "eyebrows, links" },
  { fg: DEEP, bg: ELEV, label: "accent-deep on elev", where: "icons, column heads" },
  { fg: DEEP, bg: CODE, label: "accent-deep on code", where: "tree dirs, terminal accents" },
  { fg: ELEV, bg: DEEP, label: "elev on accent-deep", where: "the label on every blue fill" },
  { fg: ELEV, bg: INK, label: "elev on ink", where: "footer body, dark blocks" },
  {
    fg: ACCENT,
    bg: BG,
    label: "accent block vs bg",
    size: "non-text",
    where: "how far the azure separates from the page as a shape",
  },
  {
    fg: DEEP,
    bg: BG,
    label: "accent-deep block vs bg",
    size: "non-text",
    where: "the same for the deep blue — this is why the CTA is filled with it",
  },
  {
    fg: ELEV,
    bg: ACCENT,
    label: "elev on accent",
    size: "large",
    where: "a primary button held on hover, where the fill brightens",
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

// The mats the landing page mounts its screenshots on. They are on the page so
// the palette can be judged against the artwork it has to sit next to, rather
// than against a memory of it: the blue is taken from these, and the paper
// under them is why the page is white.
const BLOOMS = [1, 2, 3, 4].map((n) => `https://cdn.ai4kanban.dev/bloom-${n}.jpg`);

export default function DesignPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          What the site ships
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Design system</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          Every token and every block, rendered from the modules the pages
          import, with every pair measured rather than eyeballed.
        </p>

        <Section
          id="tone"
          title="The tone we're matching"
          note="The watercolour mats under the landing page's screenshots: white paper, one clean azure, nothing dusty in it. The blue below is sampled off these, and the paper under them is the argument for a white page."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BLOOMS.map((src) => (
              <div key={src} className={`${panelStatic} overflow-hidden`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
                <div className="flex" aria-hidden="true">
                  {[BG, CODE, ACCENT, DEEP].map((hex) => (
                    <span
                      key={hex}
                      className="h-7 flex-1 border-t-2 border-border"
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.9rem] text-muted">
            Each strip under a mat is the page, the wash, the azure and the deep
            blue — the four values that have to belong to that picture.
          </p>
        </Section>

        <Section
          id="palette"
          title="Palette"
          note="A neutral three-step ramp — page, paper, wash — plus near-black ink and one azure in two strengths. Nine values, and only two of them are coloured."
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
          note="components/ui/Logo.tsx — the square block and the name, on one line. The block is the page's rule at mark size: the deep blue fill, the ink outline, the hard ink shadow. The glyph is a board reduced to three columns that step down as work leaves it, in paper white, because a filled blue block carries a paper glyph or it carries nothing."
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
                    the deep blue and never a tint of it. */}
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
                      src="/logo-mark.svg"
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
                no fonts should take the mark and set the name itself.
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          note="components/ui/Button.tsx — one block, two fills, an ink outline in every state. Hover lifts the block, grows the shadow and changes the fill: the primary brightens to the azure, the paper one drops to the wash."
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
          title="Panels"
          note="components/styles.ts — the same frame at two fills. Hover moves the card and grows the shadow; the outline and the shadow stay ink, so a card and a button carry the same weight."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`${panel} p-5`}>
              <p className="font-mono text-[0.85rem] font-semibold">panel</p>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
                Paper, ink outline, 4px ink shadow. Lifts on hover — try it.
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
        </Section>

        <Section
          id="icons"
          title="Icons and chips"
          note="components/ui/IconChip.tsx and Chip.tsx. Both are filled, and a blue one is filled with accent-deep so it can carry a paper glyph or a paper label."
        >
          <div className={`${panelStatic} space-y-7 px-6 py-6`}>
            <div>
              <Label>iconChip · blue / ink · sm and md</Label>
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
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { t: "Decision history", i: FiBookmark },
                  { t: "Requirements", i: FiList },
                  { t: "Project modules", i: FiBox },
                  { t: "Run history", i: FiActivity },
                ].map((n) => (
                  <div
                    key={n.t}
                    className="flex flex-col items-center gap-2.5 rounded-lg border-2 border-border bg-elev px-2 py-3.5 text-center"
                  >
                    <IconChip icon={n.i} />
                    <span className="text-[0.85rem] leading-snug">{n.t}</span>
                  </div>
                ))}
              </div>
              {/* The one filled blue block on a screen: the piece everything
                  above and below it connects to. */}
              <div className="mt-2.5 rounded-lg border-2 border-border bg-accent-deep px-4 py-3.5 text-center font-mono text-[0.95rem] font-semibold text-elev">
                AI4Kanban Skill
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="heading"
          title="Section heading"
          note="components/SectionHeading.tsx — an azure bar, the number in mono, then the H2. The bar carries no text, which is the one job the bright azure does on its own."
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
          <div className="rounded-xl border-2 border-border bg-ink px-6 py-8 text-sm text-elev/70">
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
