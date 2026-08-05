import { CopyPrompt } from "./CopyPrompt";
import { SectionTitle } from "./SectionTitle";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

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
        className={`${panelStatic} mt-7 overflow-x-auto bg-code px-6 py-5 shadow-[8px_8px_0_0_#010409]`}
      >
        <code className="font-mono text-sm leading-7 text-ink">{PROMPT}</code>
      </pre>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
        <CopyPrompt text={PROMPT} label={c.cta} copiedLabel={c.copied} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {c.notes.map((note) => (
            <span
              key={note}
              className="rounded-full border border-border bg-elev px-3 py-1 font-mono text-xs text-muted"
            >
              {note}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
