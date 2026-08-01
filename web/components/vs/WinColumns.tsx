import type { ReactNode } from "react";
import { panel } from "../styles";

// "Where each one wins" — two columns of cards, shared by all comparison
// pages. Each card is an emoji, a self-descriptive title, and one paragraph.

export type WinItem = { key: string; icon: string; title: string; body: string };

function WinColumn({
  heading,
  tag,
  items,
}: {
  heading: string;
  tag: ReactNode;
  items: WinItem[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="text-lg font-semibold text-ink">{heading}</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {items.map((it) => (
          <div key={it.key} className={`${panel} p-5`}>
            <div className="mb-2 flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-code text-lg"
                aria-hidden="true"
              >
                {it.icon}
              </span>
              <h4 className="font-semibold text-ink">{it.title}</h4>
            </div>
            <p className="text-[0.9rem] text-muted">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WinColumns({
  oursHeading,
  oursTag,
  ours,
  theirsHeading,
  theirsTag,
  theirs,
}: {
  oursHeading: string;
  oursTag: ReactNode;
  ours: WinItem[];
  theirsHeading: string;
  theirsTag: ReactNode;
  theirs: WinItem[];
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
      <WinColumn heading={oursHeading} tag={oursTag} items={ours} />
      <WinColumn heading={theirsHeading} tag={theirsTag} items={theirs} />
    </div>
  );
}
