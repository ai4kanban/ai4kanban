// The reference cover: a card crossing a three-column board. Motion is inline
// `@keyframes` behind `prefers-reduced-motion: no-preference`, the way `MARCH`
// in `figures/kit.tsx` does it. With motion off the card rests in the middle
// column, which reads as a board on its own.

const W = 320;
const H = 200;
const COL = { y: 40, w: 88, h: 136, gap: 12 };
const COL_X = [20, 20 + COL.w + COL.gap, 20 + 2 * (COL.w + COL.gap)];
const STEP = COL.w + COL.gap;

const MOTION = `
@keyframes cvr-cardflow {
  0%, 20% { transform: translateX(${-STEP}px) }
  35%, 60% { transform: translateX(0) }
  75%, 100% { transform: translateX(${STEP}px) }
}
@media (prefers-reduced-motion: no-preference) {
  .cvr-cardflow { animation: cvr-cardflow 6s ease-in-out infinite alternate }
}
`;

function Card({ x, y, bars }: { x: number; y: number; bars: number[] }) {
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={72} height={34} rx={6} className="fill-border" />
      <rect x={x} y={y} width={72} height={34} rx={6} className="fill-elev stroke-border" strokeWidth={1.2} />
      {bars.map((w, i) => (
        <rect key={i} x={x + 8} y={y + 10 + i * 9} width={w} height={5} rx={2.5} className="fill-border" opacity={0.17} />
      ))}
    </g>
  );
}

export function CardFlow({ alt }: { alt: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label={alt}>
      <style>{MOTION}</style>
      <rect width={W} height={H} className="fill-band" />
      {COL_X.map((x, i) => (
        <g key={i}>
          <rect x={x} y={COL.y} width={COL.w} height={COL.h} rx={8} className="fill-code" />
          <rect x={x + 8} y={COL.y - 16} width={i === 1 ? 36 : 28} height={6} rx={3} className="fill-muted" opacity={0.5} />
        </g>
      ))}
      <Card x={COL_X[0] + 8} y={COL.y + 54} bars={[48, 32]} />
      <Card x={COL_X[2] + 8} y={COL.y + 54} bars={[52, 28]} />
      <Card x={COL_X[2] + 8} y={COL.y + 98} bars={[40, 44]} />
      <g className="cvr-cardflow">
        <rect x={COL_X[1] + 6} y={COL.y + 8} width={76} height={38} rx={7} className="fill-accent" />
        <Card x={COL_X[1] + 8} y={COL.y + 10} bars={[50, 36]} />
      </g>
    </svg>
  );
}
