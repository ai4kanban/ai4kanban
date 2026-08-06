import type { IconType } from "react-icons";
import {
  FiActivity,
  FiArrowRight,
  FiBookmark,
  FiBox,
  FiFileText,
  FiList,
  FiMessageSquare,
  FiSearch,
  FiTag,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Chip } from "../ui/Chip";
import { IconChip } from "../ui/IconChip";
import { panelInset, panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// Drive continuous product iteration — an architecture diagram rather than a set
// of claims: outside information flows in on the left, AI4Kanban sits in the
// middle as a three-tier bento, product and release iteration come out on the
// right.
//
// The three tiers are context (top), the skill that plans and drives (middle),
// and what runs and stores the work (bottom). Those tier names are never drawn —
// vertical position already says it — so the diagram stays nouns and arrows.
//
// Surfaces run the way they do in the memory section: the middle panel is sunk
// into the wash (`panelInset`) and every node on it is a raised `bg-elev` tile,
// so the nodes read lighter than the panel they sit on. The blue is an object
// here and never a tint: the skill bar is filled with it, and so is every icon
// block, each carrying a paper glyph. The two washed tiles holding the agent
// marks stay neutral on purpose — those are near-black artwork and need a ground
// of their own to be seen at all.

// One icon per node, in the order the copy lists them. Icons aren't language.
const INPUT_ICONS: IconType[] = [
  FiMessageSquare,
  FiSearch,
  FiFileText,
  FiUsers,
];
const CONTEXT_ICONS: IconType[] = [FiBookmark, FiList, FiBox, FiActivity];
const OUTPUT_ICONS: IconType[] = [FiTrendingUp, FiTag];

// The agents the board can run. Claude Code and Codex use their own marks; the
// rest share one generic glyph. No names in the block — the logos carry it.
const AGENT_LOGOS = [
  { src: "/agents/claude.svg", alt: "Claude Code" },
  { src: "/agents/codex.svg", alt: "Codex" },
];

// A node on either side of the diagram: icon left, noun right. Plain `panel`
// fill, so the flanks sit above the page rather than sinking below it.
function SideNode({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div className={`${panelStatic} flex items-center gap-3 px-3 py-2.5`}>
      <IconChip icon={Icon} />
      {/* `break-words` is the guard: the columns are sized for the longest
          English noun, and Spanish runs longer ("Conversaciones"). */}
      <span className="min-w-0 break-words text-[0.9rem] leading-snug text-ink">
        {label}
      </span>
    </div>
  );
}

// Points right once the diagram is laid out in a row; on a narrow screen the
// flow stacks and the same arrow turns to point down.
function FlowArrow() {
  return (
    <span className="flex items-center justify-center self-center py-1 lg:py-0">
      <FiArrowRight
        aria-hidden="true"
        className="h-5 w-5 rotate-90 text-accent-deep lg:rotate-0"
      />
    </span>
  );
}

function ColumnLabel({ children }: { children: string }) {
  return (
    <span className="mb-2.5 block font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted">
      {children}
    </span>
  );
}

export function Iterate({ c }: { c: HomeCopy["iterate"] }) {
  return (
    <section className="mt-28">
      <SectionTitle num="04" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      {/* Both sides are sized to their nouns — wide enough for the longest of
          them in any language on one line — so the middle keeps the width it
          needs for a four-across row; the arrow columns take what they ask for.
          The side columns stretch to the middle's height so all three labels
          start on the same line, and each node group centers in what's left. */}
      <div className="mt-9 grid gap-3 lg:grid-cols-[minmax(0,11.5rem)_auto_minmax(0,1fr)_auto_minmax(0,11.5rem)] lg:gap-5">
        <div className="flex flex-col">
          <ColumnLabel>{c.inputsLabel}</ColumnLabel>
          <div className="grid flex-1 grid-cols-2 content-center gap-2.5 sm:grid-cols-4 lg:grid-cols-1">
            {c.inputs.map((label, i) => (
              <SideNode key={label} icon={INPUT_ICONS[i]} label={label} />
            ))}
          </div>
        </div>

        <FlowArrow />

        <div className={`${panelInset} px-4 py-4 sm:px-5`}>
          <span className="block font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
            AI4Kanban
          </span>

          {/* Tier one: what the board already knows about the project. */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {c.context.map((label, i) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2.5 rounded-lg border-2 border-border bg-elev px-2 py-3.5 text-center"
              >
                <IconChip icon={CONTEXT_ICONS[i]} />
                <span className="text-[0.85rem] leading-snug text-ink">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Tier two: the one thing that plans and drives — the widest filled
              block in the diagram, since everything above and below meets here.
              Same fill as the primary button, `accent-deep` with a paper label,
              in the same ink frame. It was `bg-accent/15`, which is the one thing
              it must not be: a blue diluted until it is a grey reads as a tile
              that failed to load, not as the piece the rest connect to. */}
          <div className="mt-2.5 rounded-lg border-2 border-border bg-accent-deep px-4 py-3.5 text-center font-mono text-[0.95rem] font-semibold text-elev">
            {c.skill}
          </div>

          {/* Tier three: what runs the work, and where the work is stored. The
              two are separate blocks so Markdown never reads as an agent. */}
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center justify-center gap-5 rounded-lg border-2 border-border bg-elev px-4 py-3">
              {AGENT_LOGOS.map((logo) => (
                // Each mark keeps its own brand colors, so it gets an outlined
                // tile of its own rather than being dropped straight onto the
                // panel — the same frame the ellipsis beside them sits in.
                <span
                  key={logo.src}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border bg-code shadow-[2px_2px_0_0_var(--color-ink)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="h-6 w-6"
                    loading="lazy"
                  />
                </span>
              ))}
              {/* Dashed, and the only unfilled tile — an ellipsis, not a third
                  mark. The board runs Claude Code and Codex today, so anything
                  logo-shaped here would claim an agent that doesn't ship. */}
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-border bg-code pb-1.5 font-mono text-xl leading-none text-muted"
                role="img"
                aria-label={c.otherAgents}
              >
                <span aria-hidden="true">…</span>
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-border bg-elev px-4 py-3">
              <span className="text-[0.85rem] text-muted">{c.storage}</span>
              <Chip tone="solid">Markdown</Chip>
            </div>
          </div>
        </div>

        <FlowArrow />

        <div className="flex flex-col">
          <ColumnLabel>{c.outputsLabel}</ColumnLabel>
          <div className="grid flex-1 grid-cols-2 content-center gap-2.5 lg:grid-cols-1">
            {c.outputs.map((label, i) => (
              <SideNode key={label} icon={OUTPUT_ICONS[i]} label={label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
