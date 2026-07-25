import { FiChevronDown } from "react-icons/fi";
import { GITHUB_URL } from "./content";

// The comparison pages this dropdown lists. "vs GitHub Issues" is the first;
// more land here later — add a row and the menu grows.
const comparisons: { href: string; title: string }[] = [
  { href: "/vs-github-issues", title: "vs GitHub Issues" },
  { href: "/vs-hermes-kanban", title: "vs Hermes Agent Kanban" },
  { href: "/vs-vibe-kanban", title: "vs Vibe Kanban" },
];

function CompareMenu() {
  return (
    <details className="group relative [&_summary]:list-none">
      <summary className="flex cursor-pointer items-center gap-1 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        Compare
        <FiChevronDown
          className="h-3 w-3 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="absolute left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border-2 border-border bg-elev p-1.5 shadow-[4px_4px_0_0_#010409]">
        {comparisons.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="block rounded-md px-3 py-2 text-[0.9rem] font-medium text-ink no-underline transition-colors hover:bg-accent/10"
          >
            {c.title}
          </a>
        ))}
        <p className="px-3 py-2 text-xs text-muted/70">More comparisons soon…</p>
      </div>
    </details>
  );
}

export function Header() {
  return (
    <header className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-6 py-5 sm:flex-row">
      <a href="/" className="text-lg font-bold text-ink no-underline">
        🗂️ kanban <span className="font-normal text-muted">skill</span>
      </a>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.95rem] text-muted">
        <a href="/#install" className="transition-colors hover:text-ink">
          Install
        </a>
        <a href="/#board" className="transition-colors hover:text-ink">
          Using it
        </a>
        <a href="/#ui" className="transition-colors hover:text-ink">
          Board UI
        </a>
        <a href="/#deeper" className="transition-colors hover:text-ink">
          Features
        </a>
        <a href="/recipes" className="transition-colors hover:text-ink">
          Recipes
        </a>
        <CompareMenu />
        <a
          href={GITHUB_URL}
          rel="noopener"
          className="transition-colors hover:text-ink"
        >
          GitHub ↗
        </a>
      </nav>
    </header>
  );
}
