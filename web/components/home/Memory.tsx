import { FiBookmark, FiPlayCircle, FiShield } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Mat } from "./Mat";
import { MemoryTree } from "./MemoryTree";
import { IconChip } from "../ui/IconChip";
import type { HomeCopy } from "@/i18n/home/types";

// One icon per claim, in the order the copy lists them: what's kept, what's
// avoided, where the next run picks up.
const ICONS = [FiBookmark, FiShield, FiPlayCircle];

export function Memory({ c }: { c: HomeCopy["memory"] }) {
  return (
    <section id="memory" className="mt-28 scroll-mt-24">
      <SectionTitle num="02" title={c.title} />
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
          language. */}
      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        {/* The claims are a list, not an object to act on, so the block is bare:
            a step off the white page and nothing else. It carried the hard
            shadow and ink rules before, which put brutalist weight on the one
            thing in the section nobody clicks. Spacing separates the rows now —
            the rows still share the height evenly, which matches the tree.
            The fill is `band`, the mat's own ground, so the two halves of the
            row read as one surface with a picture painted on one end. */}
        {/* The two halves of the row arrive a beat apart, left then right —
            the claims are the sentence and the listing is the evidence for it,
            so they land in that order. */}
        <div
          data-reveal
          data-delay="1"
          className="flex flex-col rounded-xl bg-band px-6 py-3 sm:px-8"
        >
          {c.cards.map((card, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={card.title}
                className="flex flex-1 items-start gap-4 py-5"
              >
                {/* The mark belongs to the claim, so it starts on the claim's
                    line rather than floating beside the whole row. */}
                <IconChip icon={Icon} className="mt-0.5" />
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
            files, so it is mounted and not framed. The mat's own padding is the
            print's margin, and it is a share of the mat rather than a fixed
            step, so the print grows with the column instead of sitting as a
            small card in the middle of a wide one. */}
        <Mat
          wash="mintSky"
          data-reveal
          data-delay="2"
          className="flex items-center justify-center p-[6%]"
        >
          {/* Capped only while the mat has the whole column to itself — a
              listing this short run to 70rem is a row of two far-apart columns.
              From `lg` the mat is half the row and the print takes all of it. */}
          <MemoryTree
            notes={c.tree}
            className="mx-auto max-w-[30rem] lg:max-w-none"
          />
        </Mat>
      </div>
    </section>
  );
}
