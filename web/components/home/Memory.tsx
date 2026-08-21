import { FiBookmark, FiPlayCircle, FiShield } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Mat } from "./Mat";
import { MemoryTree } from "./MemoryTree";
import { IconChip } from "../ui/IconChip";
import { panelInset } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// One icon per claim, in the order the copy lists them: what's kept, what's
// avoided, where the next run picks up.
const ICONS = [FiBookmark, FiShield, FiPlayCircle];

export function Memory({ c }: { c: HomeCopy["memory"] }) {
  return (
    <section id="memory" className="mt-28 scroll-mt-24">
      <SectionTitle num="03" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      {/* Two halves of one row, at the same width: the claims are what the
          memory is for and the listing is what it is, and neither outranks the
          other. The tree column being sized to its own content instead put the
          split wherever the longest note in the current language happened to
          land, which moved the seam between the two panels from language to
          language. The mat takes the half and the print sits centred on it —
          that is the mat's job, and a picture is allowed to have a margin. */}
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        {/* Three ranks per row so the panel isn't flat: a filled ember icon block
            anchors the left edge, the claim reads first, the evidence sits under
            it at a smaller size. The rows share the height evenly, which matches
            the tree beside them. */}
        {/* The two halves of the row arrive a beat apart, left then right —
            the claims are the sentence and the listing is the evidence for it,
            so they land in that order. */}
        <div
          data-reveal
          data-delay="1"
          className={`${panelInset} flex flex-col divide-y-2 divide-border `}
        >
          {c.cards.map((card, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={card.title}
                className="flex flex-1 items-center gap-4 px-6 py-5"
              >
                <IconChip icon={Icon} size="md" />
                <div>
                  <h3 className="text-[1.05rem] font-semibold leading-snug text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">
                    {card.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* The listing is mounted the way `Loop.tsx` mounts its shots: a
            watercolour mat, and the print laid on it — paper, soft shadow, no
            outline. It is the same object those are, a picture of the product's
            files, so it is mounted and not framed. The mat also gives the
            listing a margin of its own, which is what a terminal frame was
            doing before with an ink box. Centring the capped print is what lets
            the claims beside it set the height of the row. */}
        <Mat
          wash="mintSky"
          data-reveal
          data-delay="2"
          className="flex items-center justify-center p-4 sm:p-6"
        >
          <MemoryTree notes={c.tree} />
        </Mat>
      </div>
    </section>
  );
}
