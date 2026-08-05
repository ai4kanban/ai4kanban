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
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

// Drive continuous product iteration — an architecture diagram rather than a set
// of claims: outside information flows in on the left, AI4Kanban sits in the
// middle as a three-tier bento, product and release iteration come out on the
// right.
//
// The three tiers are context (top), the skill that plans and drives (middle),
// and what runs and stores the work (bottom). Those tier names are never drawn —
// vertical position already says it — so the diagram stays nouns and arrows.
//
// Surfaces run the way they do in the memory section: the middle panel is the
// dark canvas (`bg-code`) and every node on it is a raised `bg-elev` tile, so
// the nodes read lighter than the page instead of darker. The lift comes from
// small blocks — an accent chip behind each icon, the skill bar in accent, and
// two pale tiles carrying the agent marks, which are near-black artwork and
// need a light ground to be seen at all.

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

// Every icon in the diagram sits in one of these: a small accent-tinted block,
// the lightest thing on a node. Repeating it is what keeps the three columns
// reading as one drawing.
function IconChip({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent/10 text-accent">
      <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
    </span>
  );
}

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
        className="h-5 w-5 rotate-90 text-accent/80 lg:rotate-0"
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

        <div
          className={`${panelStatic} border-accent/50 bg-code px-4 py-4 sm:px-5`}
        >
          <span className="block font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            AI4Kanban
          </span>

          {/* Tier one: what the board already knows about the project. */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {c.context.map((label, i) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2.5 rounded-md border-2 border-border bg-elev px-2 py-3.5 text-center"
              >
                <IconChip icon={CONTEXT_ICONS[i]} />
                <span className="text-[0.85rem] leading-snug text-ink">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Tier two: the one thing that plans and drives — the brightest band
              in the diagram, since everything above and below meets here. */}
          <div className="mt-2.5 rounded-md border-2 border-accent/60 bg-accent/15 px-4 py-3.5 text-center font-mono text-[0.95rem] font-semibold text-accent">
            {c.skill}
          </div>

          {/* Tier three: what runs the work, and where the work is stored. The
              two are separate blocks so Markdown never reads as an agent. */}
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center justify-center gap-5 rounded-md border-2 border-border bg-elev px-4 py-3">
              {AGENT_LOGOS.map((logo) => (
                // The marks are their own brand colors on near-black, so each
                // gets a pale tile to sit on rather than being dropped straight
                // onto the panel, where the Codex mark would vanish.
                <span
                  key={logo.src}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-ink shadow-[2px_2px_0_0_#010409]"
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
                className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-dashed border-accent/30 bg-accent/[0.07] pb-1.5 font-mono text-xl leading-none text-accent/70"
                role="img"
                aria-label={c.otherAgents}
              >
                <span aria-hidden="true">…</span>
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-border bg-elev px-4 py-3">
              <span className="text-[0.85rem] text-muted">{c.storage}</span>
              <span className="rounded border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-[0.8rem] text-accent">
                Markdown
              </span>
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
