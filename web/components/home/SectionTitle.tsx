// The landing page's section title: the H2 alone.
//
// It reveals on scroll here rather than in each of the five sections that draw
// it: a title is the first thing in its section every time, so it is always the
// undelayed step of that section's stagger. What follows it takes `data-delay`.
// See `Reveal.tsx` — nothing that carries `data-reveal` may contain something
// else that does, so a section never wraps this in one of its own.
// `brand` is drawn just before the product name "WildCrane" in the title.
export function SectionTitle({ title, brand }: { title: string; brand?: React.ReactNode }) {
  return (
    <div data-reveal className="mb-5">
      {/* Each clause stays whole, so a narrow screen breaks at the comma
          instead of orphaning the last character. */}
      <h2 className="whitespace-pre-line text-3xl font-bold tracking-tight sm:text-[2rem]">
        {title.split(/(?<=，)/).map((part) => {
          const at = brand ? part.indexOf("WildCrane") : -1;
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
