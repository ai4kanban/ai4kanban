import { FiGitBranch, FiTerminal, FiUnlock } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { IconChip } from "../ui/IconChip";
import { Rich } from "../Rich";
import type { HomeCopy } from "@/i18n/home/types";

// What memory earns you, and what the board is built on — one block, because
// they are one argument: the project's decisions accumulate, and they
// accumulate in your repository under a licence you keep.
//
// It replaced a file-tree tour of the memory folder. The listing showed what
// memory *is*, which is the manual's job; the landing page only has to say what
// it buys the reader.
const ICONS = [FiUnlock, FiGitBranch, FiTerminal];

export function Trust({ c }: { c: HomeCopy["trust"] }) {
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

      {/* Bare, on the mat's own warm ground: three facts to check, not an
          object to act on. Spacing and the ramp step separate them — a hard
          shadow here would put brutalist weight on the one block in the section
          nobody clicks. */}
      <div
        data-reveal
        data-delay="2"
        className="mt-9 grid gap-x-8 gap-y-7 rounded-xl bg-band px-6 py-7 sm:px-8 md:grid-cols-3"
      >
        {c.items.map((item, i) => (
          <div key={item.title} className="flex items-start gap-4">
            <IconChip icon={ICONS[i]} className="mt-0.5" />
            <div>
              <h3 className="text-[1.05rem] font-semibold leading-snug text-ink">
                {item.title}
              </h3>
              <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">
                <Rich>{item.body}</Rich>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
