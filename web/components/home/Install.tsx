import { CodeBlock } from "../CodeBlock";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import type { SiteCopy } from "@/i18n/types";

export function Install({ c }: { c: SiteCopy }) {
  const t = c.home.install;
  return (
    <section id="install" className="mt-24 scroll-mt-20">
      <SectionHeading num="01" {...t.heading} />
      <p className="text-ink">{t.lead}</p>
      {/* The prompt itself stays English — it's what the agent reads. */}
      <CodeBlock labels={c.shared.code}>{`Set up ai4kanban for this project. Read
https://ai4kanban.dev/INSTALL_PROMPT.txt
and follow it.`}</CodeBlock>
      <p className="text-muted">
        <Rich>{t.note}</Rich>
      </p>
    </section>
  );
}
