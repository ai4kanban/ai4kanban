// Hero art for /workflows/coding: drafts land on the task card, the user approves them,
// then the builder starts. One 12s CSS loop that opens on its telling frame (both drafts approved,
// building), so a still render, the moment before CSS runs and reduced motion all show that frame.

const INK = "#24231f";
const MUTED = "#635a4e";
const ACCENT = "#dd4f1e";
const GROWTH = "#2f6b46";
const LINE = "#e4ddd0";

const MOTION = `
.ch * { transform-box: fill-box }
.ch-cursor, .ch-chip-review, .ch-chip-ok { opacity: 0 }
@media (prefers-reduced-motion: no-preference) {
  .ch-d1 { animation: ch-in1 12s steps(1) -10.2s infinite }
  .ch-d2 { animation: ch-in2 12s steps(1) -10.2s infinite }
  .ch-q { animation: ch-in2 12s steps(1) -10.2s infinite }
  .ch-ok1 { animation: ch-ok1 12s steps(1) -10.2s infinite; transform-origin: center }
  .ch-ok2 { animation: ch-ok2 12s steps(1) -10.2s infinite; transform-origin: center }
  .ch-pick { animation: ch-pick 12s steps(1) -10.2s infinite }
  .ch-cursor { animation: ch-cursor 12s steps(14) -10.2s infinite }
  .ch-chip-review { animation: ch-review 12s steps(1) -10.2s infinite }
  .ch-chip-ok { animation: ch-okchip 12s steps(1) -10.2s infinite }
  .ch-chip-build { animation: ch-build 12s steps(1) -10.2s infinite }
  .ch-bot { animation: ch-bob 12s steps(1) -10.2s infinite }
  .ch-code { animation: ch-code 12s steps(8) -10.2s infinite; transform-origin: left }
  .ch-code:nth-of-type(2) { animation-delay: -10.4s }
  .ch-code:nth-of-type(3) { animation-delay: -10.6s }
  .ch-code:nth-of-type(4) { animation-delay: -10.8s }
}
@keyframes ch-in1 {
  0%, 8% { opacity: 0; transform: translateX(-120px) }
  10% { opacity: 1; transform: translateX(-80px) }
  12% { transform: translateX(-40px) }
  14% { transform: translateX(-15px) }
  16%, 94% { opacity: 1; transform: none }
  96%, 100% { opacity: 0 }
}
@keyframes ch-in2 {
  0%, 18% { opacity: 0; transform: translateX(-120px) }
  20% { opacity: 1; transform: translateX(-80px) }
  22% { transform: translateX(-40px) }
  24% { transform: translateX(-15px) }
  26%, 94% { opacity: 1; transform: none }
  96%, 100% { opacity: 0 }
}
@keyframes ch-ok1 { 0%, 41% { transform: scale(0) } 42%, 94% { transform: scale(1) } 96%, 100% { transform: scale(0) } }
@keyframes ch-ok2 { 0%, 50% { transform: scale(0) } 51%, 94% { transform: scale(1) } 96%, 100% { transform: scale(0) } }
@keyframes ch-pick { 0%, 58% { opacity: 0 } 59%, 94% { opacity: 1 } 96%, 100% { opacity: 0 } }
@keyframes ch-cursor {
  0%, 30% { opacity: 0; transform: translate(470px, 190px) }
  34% { opacity: 1; transform: translate(320px, 110px) }
  38% { transform: translate(244px, 56px) }
  40% { transform: translate(246px, 58px) }
  42% { transform: translate(244px, 56px) }
  47% { transform: translate(404px, 56px) }
  49% { transform: translate(406px, 58px) }
  51% { transform: translate(404px, 56px) }
  56% { transform: translate(376px, 156px) }
  58% { transform: translate(378px, 158px) }
  60% { opacity: 1; transform: translate(376px, 156px) }
  66%, 100% { opacity: 0; transform: translate(470px, 190px) }
}
@keyframes ch-review { 0%, 26% { opacity: 0 } 27%, 63% { opacity: 1 } 64%, 100% { opacity: 0 } }
@keyframes ch-okchip { 0%, 63% { opacity: 0 } 64%, 71% { opacity: 1 } 72%, 100% { opacity: 0 } }
@keyframes ch-build { 0%, 71% { opacity: 0 } 72%, 94% { opacity: 1 } 96%, 100% { opacity: 0 } }
@keyframes ch-bob {
  0%, 72% { transform: none }
  74%, 78%, 82%, 86%, 90% { transform: translateY(-4px) }
  76%, 80%, 84%, 88%, 92%, 100% { transform: none }
}
@keyframes ch-code { 0%, 74% { transform: scaleX(0) } 84%, 94% { transform: scaleX(1) } 96%, 100% { transform: scaleX(0) } }
`;

const label = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10, fill: MUTED };

function Bot({ name, x, y, title }: { name: string; x: number; y: number; title: string }) {
  return (
    <g>
      <image href={`/agent-art/${name}.png`} x={x} y={y} width={60} height={60} style={{ imageRendering: "pixelated" }} />
      <text x={x + 30} y={y + 72} textAnchor="middle" style={label}>{title}</text>
    </g>
  );
}

function Chip({ cls, fill, text }: { cls: string; fill: string; text: string }) {
  return (
    <g className={cls}>
      <rect x={326} y={12} width={80} height={18} fill={fill} />
      <text x={366} y={25} textAnchor="middle" style={{ ...label, fontSize: 9, fontWeight: 700, fill: "#fff" }}>{text}</text>
    </g>
  );
}

function Check({ cls, x, y }: { cls: string; x: number; y: number }) {
  return (
    <g className={cls}>
      <rect x={x} y={y} width={20} height={20} fill={GROWTH} stroke={INK} strokeWidth={2} />
      <path d={`M${x + 4} ${y + 10} l4 4 l8 -8`} fill="none" stroke="#fff" strokeWidth={3} />
    </g>
  );
}

// The drawing is English in every language; `label` is what a screen reader hears.
export function CodingHeroArt({ label: aria }: { label: string }) {
  return (
    <svg
      viewBox="0 0 504 184"
      className="ch h-auto w-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label={aria}
    >
      <style>{MOTION}</style>

      {/* Three equal columns, 16 apart: drafting bots, the task card, the builder at its monitor */}
      <Bot name="ui-designer" x={2} y={4} title="Designer" />
      <Bot name="copywriting" x={2} y={96} title="Copywriter" />

      <rect x={84} y={8} width={340} height={172} fill={INK} />
      <rect x={80} y={4} width={340} height={172} fill="#fff" stroke={INK} strokeWidth={2} />
      <text x={94} y={26} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, fill: INK }}>Invite members</text>
      <text x={94} y={41} style={{ ...label, fontSize: 9 }}>#12</text>
      <Chip cls="ch-chip-review" fill={ACCENT} text="REVIEW" />
      <Chip cls="ch-chip-ok" fill={GROWTH} text="APPROVED" />
      <Chip cls="ch-chip-build" fill={INK} text="BUILDING" />

      {/* Draft 1: the invite page */}
      <g className="ch-d1">
        <rect x={94} y={52} width={152} height={86} fill="#fff" stroke={ACCENT} strokeWidth={2} />
        <text x={101} y={65} style={{ ...label, fontSize: 8, fill: ACCENT }}>PAGE</text>
        <rect x={114} y={74} width={112} height={8} fill={INK} />
        <rect x={114} y={88} width={112} height={6} fill={LINE} />
        <rect x={114} y={98} width={90} height={6} fill={LINE} />
        <rect x={145} y={114} width={50} height={12} fill={ACCENT} />
        <Check cls="ch-ok1" x={234} y={44} />
      </g>

      {/* Draft 2: the invite email */}
      <g className="ch-d2">
        <rect x={254} y={52} width={152} height={86} fill="#fff" stroke={ACCENT} strokeWidth={2} />
        <text x={261} y={65} style={{ ...label, fontSize: 8, fill: ACCENT }}>EMAIL</text>
        <rect x={268} y={74} width={90} height={7} fill={INK} />
        <rect x={268} y={88} width={124} height={5} fill={LINE} />
        <rect x={268} y={97} width={110} height={5} fill={LINE} />
        <rect x={268} y={106} width={118} height={5} fill={LINE} />
        <rect x={268} y={118} width={46} height={10} fill={ACCENT} />
        <Check cls="ch-ok2" x={394} y={44} />
      </g>

      {/* A question the user answers */}
      <g className="ch-q">
        <text x={94} y={159} style={{ ...label, fill: INK }}>Default role?</text>
        <rect x={290} y={146} width={52} height={18} fill="#fff" stroke={LINE} strokeWidth={2} />
        <text x={316} y={159} textAnchor="middle" style={{ ...label, fontSize: 9 }}>Admin</text>
        <rect x={346} y={146} width={60} height={18} fill="#fff" stroke={INK} strokeWidth={2} />
        <g className="ch-pick">
          <rect x={346} y={146} width={60} height={18} fill={ACCENT} />
        </g>
        <text x={376} y={159} textAnchor="middle" style={{ ...label, fontSize: 9, fill: INK }}>Member</text>
      </g>

      <g className="ch-bot">
        <Bot name="builder" x={442} y={4} title="Builder" />
      </g>

      {/* The builder's monitor: bezel, screen of code, stand */}
      <rect x={441} y={97} width={62} height={46} fill="#fff" stroke={INK} strokeWidth={2} />
      <rect x={446} y={102} width={52} height={36} fill={INK} />
      <g>
        <rect className="ch-code" x={451} y={108} width={26} height={4} fill={ACCENT} />
        <rect className="ch-code" x={457} y={116} width={34} height={4} fill="#9fc7a9" />
        <rect className="ch-code" x={457} y={124} width={24} height={4} fill="#9fc7a9" />
        <rect className="ch-code" x={451} y={132} width={16} height={4} fill={ACCENT} />
      </g>
      <rect x={466} y={144} width={12} height={10} fill={INK} />
      <rect x={456} y={154} width={32} height={4} fill={INK} />

      {/* The user's cursor */}
      <path className="ch-cursor" d="M0 0 v18 l5 -5 l4 8 l3 -1 l-4 -8 h7 z" fill="#fff" stroke={INK} strokeWidth={2} />
    </svg>
  );
}
