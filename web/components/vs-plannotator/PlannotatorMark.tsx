// Plannotator's mascot from plannotator.ai/favicon.png, redrawn: a scalloped
// orange head wearing blue goggles.
const BUMPS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * 2 * Math.PI;
  return [32 + 24 * Math.cos(a), 32 + 24 * Math.sin(a)];
});

export function PlannotatorMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Plannotator" className={`shrink-0 ${className}`}>
      <g fill="#fb8c1a">
        <circle cx="32" cy="32" r="25" />
        {BUMPS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
        ))}
      </g>
      <rect x="2" y="26" width="60" height="6" rx="2" fill="#3a7bd5" />
      <rect x="11" y="20" width="42" height="20" rx="8" fill="#c4def8" stroke="#3a7bd5" strokeWidth="3" />
      <path d="M44 35l4-4" stroke="#f3b4c8" strokeWidth="2" strokeLinecap="round" />
      <g fill="#1b2559">
        <ellipse cx="25" cy="31" rx="2.6" ry="3.6" />
        <ellipse cx="39" cy="31" rx="2.6" ry="3.6" />
      </g>
      <path
        d="M20.5 24.5l7 2.5M43.5 24.5l-7 2.5M27 48q5 3.5 10 0"
        fill="none"
        stroke="#1b2559"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
