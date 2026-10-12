// The landing page's section marker: an accent bar, the section's number in
// mono, then the H2. Same idea as the shared `SectionHeading`, minus the eyebrow —
// this page's sections carry a title and nothing else.
//
// It reveals on scroll here rather than in each of the five sections that draw
// it: a title is the first thing in its section every time, so it is always the
// undelayed step of that section's stagger. What follows it takes `data-delay`.
// See `Reveal.tsx` — nothing that carries `data-reveal` may contain something
// else that does, so a section never wraps this in one of its own.
// `brand` is drawn just before the product name "AI4Kanban" in the title.
export function SectionTitle({ num, title, brand }: { num: string; title: string; brand?: React.ReactNode }) {
  return (
    <div data-reveal className="mb-5">
      <div className="flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-mono text-xs font-semibold tracking-[0.25em] text-accent-deep">
          {num}
        </span>
      </div>
      {/* Each clause stays whole, so a narrow screen breaks at the comma
          instead of orphaning the last character. */}
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[2rem]">
        {title.split(/(?<=，)/).map((part) => {
          const at = brand ? part.indexOf("AI4Kanban") : -1;
          return (
            <span key={part} className="inline-block">
              {at < 0 ? part : (
                <>
                  {part.slice(0, at)}
                  <span className="whitespace-nowrap">
                    <span className="mr-[0.25em]">{brand}</span>
                    {part.slice(at)}
                  </span>
                </>
              )}
            </span>
          );
        })}
      </h2>
    </div>
  );
}
