import { Figure } from "./kit";
import { printFrame } from "@/components/home/Mat";

// "This is why the bottleneck is moving from coding to project planning."
//
// One change, start to finish, drawn as the stages it passes through, twice —
// and the two runs share a print, an origin and a scale, so the reader compares
// them by running an eye down the page. Two panels side by side could not do
// that: the whole claim is that one block collapses and the two in front of it
// do not, and a claim about length has to be measured against the same ruler.
//
// It is the only figure in the set built out of HTML rather than SVG, and for
// the same reason. The blocks are proportions of the row, which is what a
// percentage width already is, so the drawing holds its meaning at any width
// while the words inside it reflow and stay words — where a scaled SVG would
// land a 12px label at 6px on a phone. Nothing here is a shape that a `<rect>`
// would draw better.
//
// There is no axis and there are no numbers on it. We do not have that data,
// and a labelled axis would claim we did; the caption says the proportions are
// illustrative, and the figure says nothing the caption cannot support.

// The stages, in order. The first two are the planning the post is about; the
// third is the one AI made cheap.
//
// One word each, so the row reads as three steps of one process rather than
// three captions — and so every block holds its name on a single line at every
// width. A block is about 87px wide on a phone; a two-word stage name broke
// over three lines in it and turned a bar chart into a paragraph.
const STAGES = ["Planning", "Clarification", "Coding"];

// Widths as a share of the first row's total, so the second row is short by
// exactly what it saved. Planning is identical in both — that is the claim.
const ROWS = [
  { label: "Before coding agents", widths: [28, 28, 44], constraint: [2, 2] },
  { label: "With coding agents", widths: [28, 28, 4], constraint: [0, 1] },
];

// Narrower than this and a block has no room for its own name, so the name
// moves out beside it — which is also the clearest way to draw "there is almost
// nothing here".
const TOO_NARROW = 8;

// Both rows and both brackets are laid on one hundred-column grid with no gap
// of its own, and a block's gutter is its own right margin. That is what makes
// the four measurements in this figure comparable: a column is the same width
// in every one of them, so a block that spans 27 of them is the same length in
// both rows and the bracket under it starts exactly where it starts.
//
// Percentages inside a flex row cannot do that. `27% + 27% + 46%` plus two
// gutters is wider than the row, so flex quietly shrinks all three — and the
// bracket, measured off the same percentages but not shrunk, ran past the block
// it was under.
const COLUMNS = 100;
const GUTTER = 6;
const TRACK = { gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` };

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

// One warm ramp across the row: the wash for the two planning stages, and a
// step down to `muted` for coding, the block whose length is the news. Full ink
// was the first try and it was a hole in the page — pale, pale, near-black is
// not a ramp, it is a slab, and it took the eye off the length of the thing and
// put it on the darkness of it. `muted` is the same warm family as the wash it
// sits beside, and paper on it clears 6.5:1.
//
// Ember appears once per row and only as the constraint marker. It is the
// post's subject, not a third stage colour, and a filled ember block is the one
// thing here that could not carry a word at the site's contrast bar anyway.
const TONE = ["bg-code text-ink", "bg-code text-ink", "bg-muted text-elev"];

function Row({ label, widths, constraint }: (typeof ROWS)[number]) {
  const [first, last] = constraint;
  const offset = sum(widths.slice(0, first));
  const span = sum(widths.slice(first, last + 1));

  return (
    <div>
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>

      <div className="mt-2.5 grid" style={TRACK}>
        {widths.map((w, i) => (
          <div
            key={STAGES[i]}
            style={{ gridColumn: `span ${w}`, marginRight: GUTTER }}
            className={`flex min-h-12 items-center justify-center rounded-md px-1.5 text-center text-[0.7rem] font-medium leading-snug sm:px-2 sm:text-[0.82rem] ${TONE[i]}`}
          >
            {w < TOO_NARROW ? "" : STAGES[i]}
          </div>
        ))}
        {/* A block too narrow to hold its own name keeps it beside itself,
            in the run of empty row the collapse left behind. */}
        {widths.some((w) => w < TOO_NARROW) && (
          <span
            style={{ gridColumn: `span ${COLUMNS - sum(widths)}` }}
            className="flex items-center pl-1.5 text-[0.7rem] text-muted sm:text-[0.82rem]"
          >
            {STAGES[widths.findIndex((w) => w < TOO_NARROW)]}
          </span>
        )}
      </div>

      {/* The constraint, bracketed under the stages it covers. Colour cannot
          carry this on its own — ember means planning across the whole set, not
          "the problem" — so the claim is a word on the site's chip. The rule is
          one element on the same grid, so it runs unbroken over the gutter
          between two blocks when the constraint covers both. */}
      <div className="mt-1.5 grid" style={TRACK}>
        <div
          style={{ gridColumn: `${offset + 1} / span ${span}`, marginRight: GUTTER }}
          className="flex flex-col items-center"
        >
          <div className="h-0.5 w-full rounded-full bg-accent-deep" />
          <span className="mt-1.5 rounded-full bg-accent-deep px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-elev">
            Bottleneck
          </span>
        </div>
      </div>
    </div>
  );
}

export function BottleneckShift() {
  return (
    <Figure
      single
      wash="emberLilac"
      caption="One change, start to finish, at the same scale in both rows. Coding collapses; the planning and clarification in front of it do not, so they become most of what is left — and the constraint moves with them. Proportions are illustrative."
    >
      <div className={`${printFrame} space-y-7 bg-elev px-4 py-5 sm:px-6`}>
        {ROWS.map((row) => (
          <Row key={row.label} {...row} />
        ))}
      </div>
    </Figure>
  );
}
