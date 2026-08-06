// Numbered eyebrow + H2, with an accent bar so sections are scannable at a
// glance and read as ordered chapters instead of one uniform wall. The bar
// carries no text, which is the one job the bright azure does on its own — the
// eyebrow beside it is `accent-deep`, the blue you can actually read.
export function SectionHeading({
  num,
  eyebrow,
  title,
}: {
  num: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          {num} · {eyebrow}
        </span>
      </div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}
