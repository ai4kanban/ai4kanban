import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelStatic } from "../styles";
import type { VsVibeCopy } from "@/i18n/types";

// The crux of the whole page: these tools sit at different points in the loop.
// Say it as two plain panels so nobody mistakes one for a drop-in of the other.
function PurposePanel({
  tag,
  name,
  is,
  isnt,
}: {
  tag: string;
  name: string;
  is: string;
  isnt: string;
}) {
  return (
    <div className={`${panelStatic} bg-code p-6`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-xl" aria-hidden="true">
          {tag}
        </span>
        <h3 className="text-lg font-semibold text-ink">{name}</h3>
      </div>
      <p className="text-[0.95rem] text-ink">{is}</p>
      <p className="mt-3 text-[0.9rem] text-muted">{isnt}</p>
    </div>
  );
}

export function VkPurpose({ c }: { c: VsVibeCopy["purpose"] }) {
  return (
    <section className="mt-24">
      <SectionHeading num="03" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PurposePanel tag="🗂️" {...c.ours} />
        <PurposePanel tag="🎛️" {...c.theirs} />
      </div>

      <p className="mt-5 text-sm text-muted">{c.note}</p>
    </section>
  );
}
