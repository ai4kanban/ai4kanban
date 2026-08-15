// Bespoke flat SVG spot illustrations — one per step of a recipe. Hand-authored
// vector (not icons, not raster) so they match the site's palette exactly,
// stay crisp at any size, weigh ~1KB, and need no image pipeline. Each scene is
// drawn on a 240×132 canvas and scales to the card width. Keyed by a step's `art`.

// Illustration palette — mirrors globals.css so the art reads as one system.
// Each scene is mounted on `bg-code`, so the fills below are read against the
// wash, not against paper.
const A = "#b83a12"; // the ember — `accent-deep`, so 2px strokes and labels hold
const AF = "rgba(221,79,30,0.15)"; // accent fill: the resting ember, a tint only here
const L = "#635a4e"; // linework — the muted ink
const LS = "#ded8cc"; // soft line — the dimmed half of a scene, on purpose
const C = "#ffffff"; // card fill (the paper, a step up from the code bg)
const MUT = "#8a8172"; // muted content bars
const GRN = "#2f6b46"; // growth
const YEL = "#bf8700"; // a warning dot; no token covers it

// ── See what changed ─────────────────────────────────────────────────────────
// A history spine: the newest entry (accent, green "new" dot) stands out from
// the older, dimmed cards below it.
function Orient() {
  return (
    <>
      <line x1="34" y1="30" x2="34" y2="104" stroke={LS} strokeWidth="2" strokeLinecap="round" />
      <circle cx="34" cy="37" r="5" fill={A} />
      <circle cx="34" cy="66" r="4" fill={C} stroke={L} strokeWidth="2" />
      <circle cx="34" cy="96" r="4" fill={C} stroke={L} strokeWidth="2" />
      <line x1="39" y1="37" x2="72" y2="42" stroke={A} strokeWidth="2" />
      {/* newest — highlighted */}
      <rect x="72" y="26" width="140" height="34" rx="7" fill={AF} stroke={A} strokeWidth="2" />
      <rect x="84" y="37" width="78" height="5" rx="2.5" fill={A} opacity="0.75" />
      <rect x="84" y="48" width="52" height="5" rx="2.5" fill={A} opacity="0.4" />
      <circle cx="199" cy="33" r="4" fill={GRN} />
      {/* older — dimmed */}
      <rect x="72" y="70" width="122" height="22" rx="6" fill={C} stroke={LS} strokeWidth="1.5" />
      <rect x="84" y="79" width="70" height="5" rx="2.5" fill={MUT} opacity="0.45" />
      <rect x="72" y="98" width="104" height="20" rx="6" fill={C} stroke={LS} strokeWidth="1.5" />
      <rect x="84" y="106" width="54" height="5" rx="2.5" fill={MUT} opacity="0.4" />
    </>
  );
}

// ── Suggest new tasks ────────────────────────────────────────────────────────
// A stack of existing cards with a fresh dashed card being added (+), a spark
// marking it as newly proposed.
function Propose() {
  return (
    <>
      <rect x="58" y="18" width="124" height="24" rx="6" fill={C} stroke={L} strokeWidth="2" />
      <rect x="70" y="27" width="64" height="4.5" rx="2" fill={MUT} opacity="0.55" />
      <rect x="70" y="35" width="40" height="4.5" rx="2" fill={MUT} opacity="0.35" />
      <rect x="58" y="48" width="124" height="24" rx="6" fill={C} stroke={L} strokeWidth="2" />
      <rect x="70" y="57" width="70" height="4.5" rx="2" fill={MUT} opacity="0.55" />
      <rect x="70" y="65" width="46" height="4.5" rx="2" fill={MUT} opacity="0.35" />
      {/* new, proposed card */}
      <rect x="58" y="80" width="124" height="30" rx="6" fill={AF} stroke={A} strokeWidth="2" strokeDasharray="6 4" />
      <line x1="70" y1="95" x2="82" y2="95" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="76" y1="89" x2="76" y2="101" stroke={A} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="92" y="91" width="56" height="4.5" rx="2" fill={A} opacity="0.7" />
      <rect x="92" y="99" width="34" height="4.5" rx="2" fill={A} opacity="0.4" />
      {/* spark */}
      <path d="M196 62 L198 71 L207 73 L198 75 L196 84 L194 75 L185 73 L194 71 Z" fill={A} />
    </>
  );
}

// ── Tidy the board's notes ───────────────────────────────────────────────────
// A note whose stale lower lines are trimmed away along a dashed cut, scissors
// at the cut.
function Prune() {
  return (
    <>
      <rect x="66" y="16" width="108" height="100" rx="9" fill={C} stroke={L} strokeWidth="2" />
      <rect x="80" y="28" width="52" height="6" rx="3" fill={MUT} opacity="0.7" />
      <rect x="80" y="44" width="80" height="5" rx="2.5" fill={MUT} opacity="0.55" />
      <rect x="80" y="55" width="66" height="5" rx="2.5" fill={MUT} opacity="0.55" />
      <rect x="80" y="66" width="74" height="5" rx="2.5" fill={MUT} opacity="0.55" />
      {/* trimmed away — faded */}
      <rect x="80" y="88" width="70" height="5" rx="2.5" fill={MUT} opacity="0.22" />
      <rect x="80" y="99" width="52" height="5" rx="2.5" fill={MUT} opacity="0.22" />
      {/* cut line + scissors */}
      <line x1="56" y1="79" x2="176" y2="79" stroke={A} strokeWidth="1.5" strokeDasharray="5 4" />
      <g stroke={A} strokeWidth="1.6" fill={C}>
        <circle cx="184" cy="75" r="3.2" />
        <circle cx="184" cy="83" r="3.2" />
        <line x1="181.5" y1="76.5" x2="170" y2="79" fill="none" />
        <line x1="181.5" y1="81.5" x2="170" y2="79" fill="none" />
      </g>
    </>
  );
}

// ── Keep the priority list short ─────────────────────────────────────────────
// A ranked list: the top items (accent tags) sit above a dashed cap; the
// overflow is demoted (yellow tag, down chevron) below it.
function Cap() {
  const kept = [20, 39, 58];
  const demoted = [90, 109];
  return (
    <>
      {kept.map((y) => (
        <g key={`k${y}`}>
          <rect x="44" y={y} width="152" height="15" rx="4" fill={C} stroke={L} strokeWidth="1.8" />
          <rect x="50" y={y + 4} width="6" height="7" rx="1.5" fill={A} />
          <rect x="64" y={y + 5} width="96" height="4.5" rx="2" fill={MUT} opacity="0.6" />
        </g>
      ))}
      {/* the cap */}
      <line x1="40" y1="80" x2="188" y2="80" stroke={A} strokeWidth="1.5" strokeDasharray="5 4" />
      <circle cx="197" cy="80" r="8" fill={AF} stroke={A} strokeWidth="1.5" />
      <text x="197" y="83.5" fontFamily="ui-monospace, monospace" fontSize="9" fontWeight="700" fill={A} textAnchor="middle">
        6
      </text>
      {demoted.map((y) => (
        <g key={`d${y}`} opacity="0.7">
          <rect x="44" y={y} width="152" height="15" rx="4" fill={C} stroke={LS} strokeWidth="1.5" />
          <rect x="50" y={y + 4} width="6" height="7" rx="1.5" fill={YEL} opacity="0.85" />
          <rect x="64" y={y + 5} width="72" height="4.5" rx="2" fill={MUT} opacity="0.4" />
          <path d={`M180 ${y + 4} l4 4 l4 -4`} fill="none" stroke={A} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </>
  );
}

// ── Push top cards forward ───────────────────────────────────────────────────
// A card advances from a vague dashed sketch to a detailed, done-checked card,
// a double chevron carrying the forward motion across the gap between them. Both
// cards share a vertical center (y=69) so the motion reads as one straight push.
function Advance() {
  return (
    <>
      {/* vague sketch — left */}
      <rect x="26" y="46" width="58" height="46" rx="7" fill="none" stroke={L} strokeWidth="2" strokeDasharray="6 4" />
      <rect x="38" y="66" width="34" height="5" rx="2.5" fill={MUT} opacity="0.4" />
      {/* forward motion — double chevron centered in the gap */}
      <path d="M104 60 l9 9 l-9 9" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      <path d="M118 60 l9 9 l-9 9" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* concrete — right */}
      <rect x="150" y="40" width="64" height="58" rx="8" fill={AF} stroke={A} strokeWidth="2" />
      <rect x="160" y="52" width="44" height="5" rx="2.5" fill={A} opacity="0.8" />
      <rect x="160" y="63" width="40" height="4.5" rx="2.25" fill={A} opacity="0.5" />
      <rect x="160" y="73" width="44" height="4.5" rx="2.25" fill={A} opacity="0.5" />
      <rect x="160" y="83" width="30" height="4.5" rx="2.25" fill={A} opacity="0.4" />
      <circle cx="208" cy="46" r="7.5" fill={GRN} />
      <path d="M204.5 46 l2.4 2.4 l4 -4.4" fill="none" stroke={C} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// ── Raise questions for human input ──────────────────────────────────────────
// The open-questions log: instead of stopping to ask, the run writes each
// question down as a line under a dated heading. A hollow yellow ring marks each
// as still open — awaiting the human's async answer, folded in on the next run.
function Questions() {
  const rows = [
    { y: 66, w: 92 },
    { y: 90, w: 68 },
  ];
  return (
    <>
      {/* open-questions note */}
      <rect x="44" y="20" width="152" height="92" rx="9" fill={C} stroke={L} strokeWidth="2" />
      {/* header — a "?" badge and the day's heading */}
      <circle cx="64" cy="39" r="9" fill={AF} stroke={A} strokeWidth="2" />
      <text x="64" y="43.5" fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" fill={A} textAnchor="middle">
        ?
      </text>
      <rect x="80" y="36" width="64" height="6" rx="3" fill={A} opacity="0.75" />
      <line x1="56" y1="55" x2="184" y2="55" stroke={LS} strokeWidth="1.5" />
      {/* each written-down question, still open (hollow yellow ring = awaiting you) */}
      {rows.map(({ y, w }) => (
        <g key={y}>
          <circle cx="62" cy={y} r="4" fill="none" stroke={YEL} strokeWidth="2" />
          <rect x="76" y={y - 2.5} width={w} height="5" rx="2.5" fill={MUT} opacity="0.6" />
          <rect x="76" y={y + 7} width={w * 0.5} height="4.5" rx="2.25" fill={MUT} opacity="0.35" />
        </g>
      ))}
    </>
  );
}

// ── Pull the flagged competitors ─────────────────────────────────────────────
// A source feed node (dist0's "d") pulls ranked competitor cards, each tagged
// with its mention count — the products people named in Reddit threads.
function Pull() {
  const rows = [
    { y: 28, bar: 66, n: "12" },
    { y: 58, bar: 52, n: "7" },
    { y: 88, bar: 36, n: "3" },
  ];
  return (
    <>
      {/* source feed node */}
      <circle cx="38" cy="66" r="18" fill={AF} stroke={A} strokeWidth="2" />
      <text x="38" y="73" fontFamily="ui-monospace, monospace" fontSize="20" fontWeight="700" fill={A} textAnchor="middle">
        d
      </text>
      {/* pull motion */}
      <line x1="60" y1="66" x2="82" y2="66" stroke={LS} strokeWidth="2" strokeDasharray="5 4" />
      <path d="M80 61 l6 5 l-6 5" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* ranked competitor cards + mention-count pills */}
      {rows.map(({ y, bar, n }) => (
        <g key={y}>
          <rect x="92" y={y} width="124" height="20" rx="5" fill={C} stroke={L} strokeWidth="1.8" />
          <rect x="102" y={y + 7.5} width={bar} height="5" rx="2.5" fill={MUT} opacity="0.55" />
          <rect x="186" y={y + 4} width="22" height="12" rx="6" fill={AF} stroke={A} strokeWidth="1.3" />
          <text x="197" y={y + 13} fontFamily="ui-monospace, monospace" fontSize="8" fontWeight="700" fill={A} textAnchor="middle">
            {n}
          </text>
        </g>
      ))}
    </>
  );
}

// ── Normalize and dedup ──────────────────────────────────────────────────────
// Two dashed inputs fold along curved connectors into one solid, accented card —
// a competitor's feature met with your board, resolved into one line.
function Merge() {
  return (
    <>
      {/* variant cards */}
      <rect x="24" y="26" width="80" height="26" rx="6" fill="none" stroke={L} strokeWidth="1.8" strokeDasharray="6 4" />
      <rect x="36" y="36" width="48" height="5" rx="2.5" fill={MUT} opacity="0.5" />
      <rect x="24" y="80" width="80" height="26" rx="6" fill="none" stroke={L} strokeWidth="1.8" strokeDasharray="6 4" />
      <rect x="36" y="90" width="36" height="5" rx="2.5" fill={MUT} opacity="0.5" />
      {/* merge connectors */}
      <path d="M104 39 C 128 39, 128 66, 150 66" fill="none" stroke={A} strokeWidth="2" />
      <path d="M104 93 C 128 93, 128 66, 150 66" fill="none" stroke={A} strokeWidth="2" />
      <path d="M148 61 l6 5 l-6 5" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* merged card */}
      <rect x="158" y="49" width="58" height="34" rx="7" fill={AF} stroke={A} strokeWidth="2" />
      <rect x="168" y="59" width="38" height="5" rx="2.5" fill={A} opacity="0.75" />
      <rect x="168" y="69" width="26" height="4.5" rx="2.25" fill={A} opacity="0.45" />
    </>
  );
}

// ── Sort real from false positive ────────────────────────────────────────────
// A competitor card forks two ways: up to an accent check (real competitor),
// down to a dimmed × (false positive the pipeline over-matched).
function Triage() {
  return (
    <>
      {/* incoming card */}
      <rect x="20" y="51" width="60" height="30" rx="7" fill={C} stroke={L} strokeWidth="2" />
      <rect x="30" y="61" width="40" height="5" rx="2.5" fill={MUT} opacity="0.6" />
      <rect x="30" y="71" width="26" height="4.5" rx="2.25" fill={MUT} opacity="0.4" />
      {/* fork */}
      <path d="M80 61 C 108 61, 110 36, 136 36" fill="none" stroke={A} strokeWidth="2" />
      <path d="M80 71 C 108 71, 110 98, 136 98" fill="none" stroke={LS} strokeWidth="2" />
      {/* real → check */}
      <circle cx="154" cy="36" r="13" fill={AF} stroke={A} strokeWidth="2" />
      <path d="M148 36 l4 4 l8 -8" fill="none" stroke={A} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="174" y="33" width="42" height="6" rx="3" fill={A} opacity="0.6" />
      {/* false positive → × */}
      <circle cx="154" cy="98" r="13" fill={C} stroke={LS} strokeWidth="2" />
      <path d="M149 93 l10 10 M159 93 l-10 10" stroke={MUT} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="174" y="95" width="30" height="6" rx="3" fill={MUT} opacity="0.35" />
    </>
  );
}

// ── One file per competitor ──────────────────────────────────────────────────
// The competitor's own file under a magnifier, one line pulled out and highlighted.
function Study() {
  return (
    <>
      {/* study doc */}
      <rect x="50" y="16" width="112" height="100" rx="9" fill={C} stroke={L} strokeWidth="2" />
      <rect x="64" y="30" width="56" height="6" rx="3" fill={A} opacity="0.7" />
      <rect x="64" y="46" width="84" height="5" rx="2.5" fill={MUT} opacity="0.5" />
      <rect x="64" y="57" width="76" height="5" rx="2.5" fill={MUT} opacity="0.5" />
      <rect x="64" y="68" width="82" height="5" rx="2.5" fill={MUT} opacity="0.5" />
      <rect x="64" y="94" width="46" height="5" rx="2.5" fill={MUT} opacity="0.35" />
      {/* magnifier */}
      <circle cx="150" cy="84" r="22" fill={AF} stroke={A} strokeWidth="2.5" />
      <rect x="136" y="82" width="26" height="4.5" rx="2.25" fill={A} opacity="0.8" />
      <line x1="166" y1="100" x2="182" y2="116" stroke={A} strokeWidth="3.5" strokeLinecap="round" />
    </>
  );
}

// ── List every feature a competitor offers ───────────────────────────────────
// A tree walked out from the competitor's site: the features you already have
// carry a green check dot; the gap is flagged — an accent dashed card and a
// marker flag.
function Scan() {
  return (
    <>
      {/* root site node */}
      <rect x="28" y="20" width="44" height="18" rx="5" fill={C} stroke={L} strokeWidth="1.8" />
      <rect x="37" y="27" width="26" height="4.5" rx="2.25" fill={MUT} opacity="0.6" />
      {/* branch spine */}
      <path d="M50 38 L50 108" stroke={LS} strokeWidth="1.8" fill="none" />
      <line x1="50" y1="56" x2="84" y2="56" stroke={LS} strokeWidth="1.8" />
      <line x1="50" y1="82" x2="84" y2="82" stroke={LS} strokeWidth="1.8" />
      <line x1="50" y1="108" x2="84" y2="108" stroke={LS} strokeWidth="1.8" />
      {/* existing assets */}
      <rect x="84" y="47" width="72" height="18" rx="5" fill={C} stroke={L} strokeWidth="1.8" />
      <rect x="94" y="54" width="46" height="4.5" rx="2.25" fill={MUT} opacity="0.55" />
      <circle cx="150" cy="56" r="3.5" fill={GRN} />
      <rect x="84" y="73" width="72" height="18" rx="5" fill={C} stroke={L} strokeWidth="1.8" />
      <rect x="94" y="80" width="40" height="4.5" rx="2.25" fill={MUT} opacity="0.55" />
      <circle cx="150" cy="82" r="3.5" fill={GRN} />
      {/* the gap — an asset you don't have yet */}
      <rect x="84" y="99" width="72" height="18" rx="5" fill={AF} stroke={A} strokeWidth="1.8" strokeDasharray="5 4" />
      <rect x="94" y="106" width="34" height="4.5" rx="2.25" fill={A} opacity="0.6" />
      {/* flag on the gap */}
      <path d="M166 98 L166 118" stroke={A} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M166 100 l12 3.5 l-12 3.5 Z" fill={AF} stroke={A} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  );
}

// ── File ideas and set a cadence ─────────────────────────────────────────────
// The cadence ladder, most→least frequent (daily→weekly→monthly→never). The
// active rung is accent with a clock; the arrow marks the drift toward "never".
function Cadence() {
  const rows = [
    { y: 22, on: false },
    { y: 48, on: true },
    { y: 74, on: false },
    { y: 100, on: false },
  ];
  return (
    <>
      {/* the ladder spine + "slower over time" arrow */}
      <line x1="40" y1="30" x2="40" y2="106" stroke={LS} strokeWidth="2" strokeLinecap="round" />
      <path d="M35 100 l5 6 l5 -6" fill="none" stroke={L} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {rows.map(({ y, on }) => (
        <g key={y}>
          <circle cx="40" cy={y + 8} r={on ? 6 : 4} fill={on ? A : C} stroke={on ? A : L} strokeWidth="2" />
          <rect x="58" y={y} width="118" height="16" rx="5" fill={on ? AF : C} stroke={on ? A : LS} strokeWidth={on ? 2 : 1.5} />
          <rect x="68" y={y + 5.5} width={on ? 72 : 52} height="5" rx="2.5" fill={on ? A : MUT} opacity={on ? 0.7 : 0.4} />
        </g>
      ))}
      {/* clock on the active rung */}
      <circle cx="198" cy="56" r="12" fill={AF} stroke={A} strokeWidth="2" />
      <line x1="198" y1="56" x2="198" y2="49" stroke={A} strokeWidth="2" strokeLinecap="round" />
      <line x1="198" y1="56" x2="203" y2="59" stroke={A} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

const SCENES: Record<string, () => React.ReactElement> = {
  orient: Orient,
  propose: Propose,
  prune: Prune,
  cap: Cap,
  advance: Advance,
  questions: Questions,
  pull: Pull,
  merge: Merge,
  triage: Triage,
  study: Study,
  scan: Scan,
  cadence: Cadence,
};

export function RecipeArt({ art }: { art: string }) {
  const Scene = SCENES[art] ?? Orient;
  return (
    <svg
      viewBox="0 0 240 132"
      className="block h-full w-auto max-w-full"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <Scene />
    </svg>
  );
}
