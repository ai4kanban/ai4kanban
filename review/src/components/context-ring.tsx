// How full the model's context window is (#52), after legacy kanban-ui context-ring.tsx: one
// ring beside a chat's message box and in a run's header. Nothing is drawn unless both numbers
// are known.

/** `840`, `100k`, `1.2M`: rounded, since the ring gives a sense, not a count. */
export function shortTokens(n: number): string {
  if (n < 999.5) return String(Math.round(n));
  if (n < 999_500) return `${Math.round(n / 1_000)}k`;
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)}M`;
}

const R = 5.25;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ContextRing({
  context,
  tip,
}: {
  context: { used?: number; limit?: number } | null | undefined;
  tip: (used: string, limit: string) => string;
}) {
  const used = context?.used;
  const limit = context?.limit;
  if (!used || !limit) return null;
  // Over the window still reads full; the tip keeps the real numbers.
  const filled = Math.min(1, used / limit);
  const label = tip(shortTokens(used), shortTokens(limit));
  return (
    // A span, not a button: the run header that holds it is a button already.
    <span className="nb-tip nb-focus inline-flex shrink-0 rounded-full p-0.5" data-tip={label} aria-label={label} role="img" tabIndex={0}>
      <svg viewBox="0 0 14 14" className="size-[14px] -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r={R} fill="none" className="stroke-nb-ink/12" strokeWidth="2.5" />
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          className="stroke-nb-ink-soft"
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
        />
      </svg>
    </span>
  );
}
