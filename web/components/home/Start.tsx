import { FiDownload } from "react-icons/fi";
import { CopyPrompt } from "./CopyPrompt";
import { SectionTitle } from "./SectionTitle";
import { Rich } from "../Rich";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { panelInset } from "../styles";
import { localeHref, type Locale } from "@/lib/i18n";
import type { HomeCopy } from "@/i18n/home/types";

// The prompt itself stays English — it's what the agent reads, not what the
// reader reads, so it isn't copy.
const PROMPT = `Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt and follow it.`;

export function Start({ c, locale }: { c: HomeCopy["start"]; locale: Locale }) {
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

      {/* The other way in: the board as an app you download (#175). It sits
          under the prompt rather than beside it because the two are alternatives
          and a reader picks one. The retired `npx ai4kanban-ui` way isn't named
          here or anywhere on the site — see `pages/DownloadPage.tsx`. */}
      <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-lg font-bold">{c.app.title}</h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
            <Rich>{c.app.body}</Rich>
          </p>
        </div>
        <div className="shrink-0">
          <Button href={localeHref(locale, "/download")}>
            <FiDownload className="h-4 w-4" aria-hidden="true" />
            {c.app.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
