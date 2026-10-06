"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Topic = { slug: string; label: string };
type Item = { slug: string; categories: string[]; tile: ReactNode };

type Props = {
  topics: Topic[];
  featured: ReactNode;
  /** Every post, newest first; the first one is the featured post. */
  items: Item[];
};

// The topic tabs, the featured post and the grid. The pick lives in
// `?topic=`; under All the newest post is featured and left out of the grid,
// under a topic the featured slot goes and the grid holds every match.
export function TopicFilter(props: Props) {
  const topic = useSearchParams().get("topic");
  return <TopicView {...props} topic={topic} />;
}

/** The static render: All. `TopicFilter`'s Suspense fallback, and what shows without JavaScript. */
export function TopicView({
  topics,
  featured,
  items,
  topic,
}: Props & { topic: string | null }) {
  const active = topics.some((t) => t.slug === topic) ? topic : null;
  const shown = active
    ? items.filter((i) => i.categories.includes(active))
    : items.slice(1);

  const tab = (label: string, slug: string | null) => {
    const on = slug === active;
    return (
      <Link
        key={label}
        href={slug ? `/blog?topic=${slug}` : "/blog"}
        scroll={false}
        aria-current={on ? "page" : undefined}
        className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold no-underline transition-colors ${
          on ? "bg-ink text-elev" : "text-muted hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* The rule stays on the column; only the tabs scroll past its edges on a phone. */}
      <nav aria-label="Topics" className="mt-6 border-b-2 border-border pb-3 sm:mt-8">
        <div className="-mx-6 flex items-center gap-1.5 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {tab("All", null)}
          {topics.map((t) => tab(t.label, t.slug))}
        </div>
      </nav>

      {!active && <section className="mt-8 sm:mt-10">{featured}</section>}

      {shown.length > 0 && (
        <section
          className={
            active
              ? "mt-8 sm:mt-10"
              : "mt-10 border-t-2 border-border pt-8 sm:mt-14 sm:pt-10"
          }
        >
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
            {shown.map((i) => (
              <div key={i.slug}>{i.tile}</div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
