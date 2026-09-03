import type { HomeCopy } from "@/i18n/home/types";

// Why the product exists, in one statement and one paragraph, on the page's
// first band. It sits between the promise and the mechanism because a reader
// who does not accept the bottleneck has no reason to read the three steps.
//
// Two columns rather than a stack: the statement is a claim and the paragraph
// is its argument, and side by side the whole block is one screen's worth of
// reading instead of two. No top margin — the `Band` owns its own air.
export function Why({ c }: { c: HomeCopy["why"] }) {
  return (
    <section className="grid gap-6 lg:grid-cols-12 lg:gap-12">
      <h2
        data-reveal
        className="text-balance text-3xl font-bold leading-[1.2] tracking-tight sm:text-[2rem] lg:col-span-5"
      >
        {c.title}
      </h2>
      <p
        data-reveal
        data-delay="1"
        className="text-[1.05rem] leading-relaxed text-muted lg:col-span-7"
      >
        {c.body}
      </p>
    </section>
  );
}
