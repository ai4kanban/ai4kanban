import { CopyPrompt } from "./CopyPrompt";
import { SectionTitle } from "./SectionTitle";
import { Chip } from "../ui/Chip";
import { panelInset } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// The prompt itself stays English — it's what the agent reads, not what the
// reader reads, so it isn't copy.
const PROMPT = `Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.`;

export function Start({ c }: { c: HomeCopy["start"] }) {
  return (
    <section id="install" className="mt-28 scroll-mt-24">
      <SectionTitle num="05" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      <pre
        className={`${panelInset} mt-7 overflow-x-auto px-6 py-5 shadow-[8px_8px_0_0_var(--color-ink)]`}
      >
        <code className="font-mono text-sm leading-7 text-ink">{PROMPT}</code>
      </pre>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
        <CopyPrompt text={PROMPT} label={c.cta} copiedLabel={c.copied} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {c.notes.map((note) => (
            <Chip key={note}>{note}</Chip>
          ))}
        </div>
      </div>
    </section>
  );
}
