import type { IconType } from "react-icons";
import {
  FiArchive,
  FiChevronDown,
  FiFileText,
  FiGitBranch,
  FiUser,
} from "react-icons/fi";
import { printFrame } from "@/components/home/Mat";
import { Figure } from "./kit";

// "Kanban Engineering is our term for that missing planning layer: the system
// that turns vague goals into requirements, routes unresolved decisions to a
// person, keeps dependencies and releases coherent, and preserves product
// context between sessions."
//
// One panel, because the sentence names one thing. The four clauses are what
// the layer does, not four layers, so they are four rows inside a single block
// rather than four pictures side by side.
//
// What keeps it a drawing instead of the sentence re-set as a list is what sits
// above and below it: a real vague goal going in, and a real card coming out
// with a scope, a dependency and a release on it. The rows are then the account
// of what happened in between.
//
// HTML rather than SVG, like `BottleneckShift` and the board in `ThreeLayers`:
// this figure is almost entirely words, and words in a scaled SVG stop being
// readable at the width a phone gives a post.

const JOBS: { icon: IconType; text: string }[] = [
  { icon: FiFileText, text: "Turns vague goals into requirements" },
  { icon: FiUser, text: "Routes unresolved decisions to a person" },
  { icon: FiGitBranch, text: "Keeps dependencies and releases coherent" },
  { icon: FiArchive, text: "Preserves product context between sessions" },
];

const label = "font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted";

// One centred column for all three blocks. The figure is a flow read top to
// bottom, so what has to line up is their left and right edges — a band that
// ran the full width of the print while the goal and the card sat centred in it
// read as three unrelated objects rather than one thing passing through.
const STEP = "mx-auto w-full max-w-sm";

function Down() {
  return (
    <div className="flex justify-center py-2 text-muted">
      <FiChevronDown size={16} aria-hidden="true" />
    </div>
  );
}

export function PlanningLayer() {
  return (
    <Figure
      single
      wash="emberMint"
      caption="One goal, one pass through the layer. What goes in is a sentence someone said; what comes out is a card with a scope, a dependency and a release on it. The four rows are the work in between — and the last of them is why the next goal does not start from nothing."
    >
      <div className={`${printFrame} bg-elev px-4 py-5 sm:px-6`}>
        <p className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
          The planning layer
        </p>

        {/* Going in: a goal in the state goals are actually in. Dashed, and the
            only italic on the page — it is quoted, not specified. */}
        <div
          className={`${STEP} rounded-xl border border-dashed border-muted px-4 py-3`}
        >
          <p className="text-center text-[0.85rem] italic leading-snug text-muted">
            &ldquo;make the board less manual&rdquo;
          </p>
        </div>
        <p className={`mt-1.5 text-center ${label}`}>a goal, as stated</p>

        <Down />

        {/* The layer itself: four rows and no box around them. The block the
            reader is meant to see here is the column, and a filled panel drawn
            on top of it is a second edge saying the same thing twice. Ember on
            the glyphs, because these four rows are the planning work the whole
            set draws in it. */}
        <ul className={`${STEP} space-y-2.5`}>
          {JOBS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-code text-accent-deep">
                <Icon size={13} aria-hidden="true" />
              </span>
              <span className="pt-0.5 text-[0.85rem] leading-snug text-ink">
                {text}
              </span>
            </li>
          ))}
        </ul>

        <Down />

        {/* Coming out: the same goal, now a card — and carrying the two things
            the third row is about. */}
        <div
          className={`${STEP} rounded-xl border border-border bg-elev px-3.5 py-3 shadow-[3px_3px_0_0_var(--color-ink)]`}
        >
          <p className="text-[0.85rem] leading-snug text-ink">
            <span className="mr-1.5 font-semibold text-accent-deep">#128</span>
            Propose tasks from a goal, one at a time
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["depends on #121", "v0.7"].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-code px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className={`mt-1.5 text-center ${label}`}>work an agent can build</p>
      </div>
    </Figure>
  );
}
