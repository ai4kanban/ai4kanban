// The hero's ground: a quiet dot grid with a few cards gliding along lanes, like
// work crossing a board. The middle is masked clear so the title never sits on
// motion; with reduced motion the cards hold still. Phones skip it: the text
// spans the full width there, so any card would cross it.
const LANES = [
  { top: 14, t: 26, o: 0, ember: true },
  { top: 30, t: 34, o: -14, ember: false },
  { top: 50, t: 30, o: -6, ember: false },
  { top: 70, t: 38, o: -22, ember: true },
  { top: 86, t: 28, o: -18, ember: false },
];

const MOTION = `
.hb-card { left: calc(var(--x) * 1%) }
@keyframes hb-drift { from { left: -6% } to { left: 104% } }
@media (prefers-reduced-motion: no-preference) {
  .hb-card { animation: hb-drift var(--t) linear var(--o) infinite }
}
`;

export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 hidden sm:block left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_25%,#000_75%,transparent)]"
    >
      <style>{MOTION}</style>
      <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_srgb,var(--color-ink)_16%,transparent)_1px,transparent_1px)] bg-[size:18px_18px] [mask-image:radial-gradient(ellipse_32%_50%_at_50%_50%,transparent_40%,#000_100%)]" />
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_34%_60%_at_50%_50%,transparent_70%,#000_100%)]">
        {LANES.flatMap((lane, i) =>
          [0, 1].map((k) => (
            <span
              key={`${i}-${k}`}
              className={`hb-card absolute flex h-4 w-14 items-center gap-1 rounded-[5px] border bg-elev px-1.5 ${lane.ember && k === 0 ? "border-border shadow-[2px_2px_0_0_var(--color-ink)]" : "border-[color-mix(in_srgb,var(--color-ink)_22%,transparent)]"}`}
              style={{
                top: `${lane.top}%`,
                ["--t" as string]: `${lane.t}s`,
                ["--o" as string]: `${lane.o - k * lane.t / 2}s`,
                ["--x" as string]: `${(i * 23 + k * 50) % 100}`,
              }}
            >
              <span className={`h-2 w-1 rounded-sm ${lane.ember && k === 0 ? "bg-accent" : "bg-[color-mix(in_srgb,var(--color-ink)_22%,transparent)]"}`} />
              <span className="h-1 flex-1 rounded-full bg-[color-mix(in_srgb,var(--color-ink)_12%,transparent)]" />
            </span>
          )),
        )}
      </div>
    </div>
  );
}
