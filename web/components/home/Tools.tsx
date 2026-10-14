import { SectionTitle } from "./SectionTitle";
import type { HomeCopy } from "@/i18n/home/types";

// The eight harnesses in `cli/src/lib/agent/harnesses/`, each its mark and its name.
const HARNESSES = [
  { name: "Claude Code", src: "/agents/claude.svg" },
  { name: "Codex", src: "/agents/codex.svg" },
  { name: "Cursor", src: "/agents/cursor.svg" },
  { name: "OpenCode", src: "/agents/opencode.svg" },
  { name: "DSH", src: "/agents/dsh.svg" },
  { name: "ZCode", src: "/agents/zcode.svg" },
  { name: "Grok Build", src: "/agents/grok.svg" },
  { name: "Kimi Code", src: "/agents/kimi.svg" },
];

export function Tools({ c }: { c: HomeCopy["tools"] }) {
  return (
    <section className="mt-28">
      <SectionTitle num="05" title={c.title} />
      <p data-reveal data-delay="1" className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.body}
      </p>
      <ul data-reveal data-delay="2" className="mt-10 grid grid-cols-4 gap-x-3 gap-y-6 lg:grid-cols-8">
        {HARNESSES.map((h) => (
          <li key={h.name} className="flex flex-col items-center gap-2.5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-band">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.src} alt="" className="h-7 w-7" />
            </span>
            <span className="text-xs font-medium leading-tight text-ink sm:text-sm">{h.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
