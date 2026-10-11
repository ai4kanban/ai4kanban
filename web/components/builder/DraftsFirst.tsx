import { ACCENT, Bot, Figure, INK, Kid, MUTED, Sketch } from "./kit";

const CAPTION = "You settle the key drafts. The agent builds the rest.";

const line = { fill: "none", stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const };

// The person settles the key draft and cuts the extra page; the agent builds the rest.
export function DraftsFirst() {
  return (
    <Figure caption={CAPTION}>
      <svg viewBox="0 0 640 340" className="block w-full" role="img" aria-label={CAPTION}>
        <rect width={640} height={340} fill="#fff" />
        <Sketch id="sk-drafts">
          <Kid x={78} y={180} arm="point" mood="happy" />

          {/* the key draft: approved */}
          <rect {...line} fill="#fff" x={150} y={70} width={150} height={120} rx={8} />
          <path {...line} stroke={MUTED} strokeWidth={6} d="M168 94 L250 94" />
          <rect {...line} strokeWidth={2.5} stroke={MUTED} x={168} y={108} width={52} height={36} rx={4} />
          <rect {...line} strokeWidth={2.5} stroke={MUTED} x={230} y={108} width={52} height={36} rx={4} />
          <path {...line} stroke={MUTED} strokeWidth={5} d="M168 162 L270 162" />
          <circle {...line} stroke={ACCENT} fill="#fff" cx={296} cy={72} r={18} />
          <path {...line} stroke={ACCENT} strokeWidth={4} d="M287 72 L294 80 L306 64" />

          {/* an extra page nobody asked for: cut */}
          <rect {...line} stroke={MUTED} fill="#fff" x={186} y={214} width={90} height={70} rx={6} strokeDasharray="7 7" />
          <path {...line} stroke={ACCENT} strokeWidth={4} d="M206 230 L256 270 M256 230 L206 270" />

          {/* hand-off */}
          <path {...line} d="M318 130 Q360 120 392 150" />
          <path {...line} d="M382 144 L394 152 L384 162" />

          {/* the agent builds the rest */}
          <Bot x={450} y={226} />
          {[0, 1, 2].map((i) => (
            <rect key={i} {...line} fill="#fff" x={510 + i * 10} y={110 + i * 34} width={86} height={58} rx={6} />
          ))}
          <path {...line} stroke={MUTED} strokeWidth={5} d="M534 194 L590 194 M534 210 L574 210" />
          <path stroke={INK} strokeWidth={2} d="M20 332 L620 332" opacity={0.25} />
        </Sketch>
      </svg>
    </Figure>
  );
}
