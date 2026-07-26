import { CodeBlock } from "../CodeBlock";
import { RecipeArt } from "./RecipeArt";
import { SectionHeading } from "../SectionHeading";
import type { Recipe } from "./recipes-content";
import { panel, panelStatic } from "../styles";

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 rounded-lg border-2 border-border px-5 py-2.5 font-semibold text-ink no-underline shadow-[4px_4px_0_0_#010409] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[6px_6px_0_0_var(--color-accent)]"
    >
      ↓ {label}
    </a>
  );
}

// The full landing page for a single recipe, driven entirely by its data plus
// the raw Markdown read at build time. Server component — CodeBlock handles the
// interactive copy.
export function RecipeLanding({
  recipe,
  markdown,
}: {
  recipe: Recipe;
  markdown: string;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mt-10">
        <a
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm text-muted no-underline transition-colors hover:text-ink"
        >
          ← All recipes
        </a>

        <h1 className="mt-6 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
          <span aria-hidden="true">{recipe.icon}</span>
          {recipe.title}
        </h1>

        {recipe.brand && (
          <a
            href={recipe.brand.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-code px-3 py-1.5 text-sm no-underline transition-colors hover:border-accent/50"
          >
            <img
              src={recipe.brand.logo}
              alt={`${recipe.brand.name} logo`}
              className="h-6 w-6 rounded-full"
            />
            <span className="text-muted">
              Powered by{" "}
              <span className="font-semibold text-ink">{recipe.brand.name}</span>
            </span>
          </a>
        )}

        <p className="mt-5 text-lg text-muted">{recipe.summary}</p>

        {/* Add it — every way to bring the card onto your board */}
        <div className="mt-8">
          <p className="mb-2 text-sm font-semibold text-ink">
            Add it to your board
          </p>
          <CodeBlock>{recipe.installPrompt}</CodeBlock>
          <p className="mt-3 text-sm text-muted">
            Paste that and Claude pulls the card by URL, files it under{" "}
            <code className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
              docs/kanban/todo/recurring/
            </code>
            , and runs it on the cadence you choose. Prefer to work offline? Grab
            the file or copy it in full below.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DownloadButton href={recipe.mdFile} label="Download the card (.md)" />
            <a
              href="#card"
              className="text-sm text-accent no-underline hover:underline"
            >
              Copy the full card ↓
            </a>
          </div>
        </div>

        {/* Prerequisite note */}
        <div className={`${panelStatic} mt-8 bg-code p-5`}>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">Prerequisite:</span>{" "}
            <a href="/#install" className="text-accent no-underline hover:underline">
              ai4kanban
            </a>{" "}
            installed in your repo. New here? Install the skill first, then paste
            the prompt above.
          </p>
          {recipe.brand && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
              <span className="font-semibold text-ink">
                Also requires {recipe.brand.name}:
              </span>{" "}
              this recipe runs on{" "}
              <a
                href={recipe.brand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent no-underline hover:underline"
              >
                {recipe.brand.name}
              </a>
              , so you&apos;ll need {recipe.brand.requires}. Without it the card
              installs fine but has nothing to pull.
            </p>
          )}
        </div>
      </section>

      {/* ── What it does (key steps, as cards) ───────────────────────────── */}
      <section className="mt-24">
        <SectionHeading num="01" eyebrow="What it does" title="One run, step by step" />
        <p className="text-ink">
          This card is a recurring task — it never gets checked off and filed
          away. Instead, you run it again and again (say, every morning), and each
          time it does a little upkeep on your board. Here&apos;s what one run does.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {recipe.does.map((s) => (
            <div key={s.title} className={`${panel} overflow-hidden p-0`}>
              <div className="flex h-44 items-center justify-center border-b-2 border-border bg-code py-5">
                <RecipeArt art={s.art} />
              </div>
              <div className="p-6">
                <h3 className="text-[1.05rem] font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          If you still have questions from a previous run waiting for an answer, it
          holds off and skips the run — so it never piles new work onto a board
          that&apos;s waiting on you.
        </p>
      </section>

      {/* ── The full card (copy, at the bottom) ──────────────────────────── */}
      <section id="card" className="mt-24 scroll-mt-20">
        <SectionHeading num="02" eyebrow="The card" title="Copy the full card" />
        <p className="text-ink">
          The whole recipe is one Markdown file. Copy it, drop it into your board,
          and reshape it to your project — the priority, the cap, and the cadence
          are all yours to change.
        </p>
        <div className="mt-6">
          <CodeBlock>{markdown}</CodeBlock>
          <DownloadButton href={recipe.mdFile} label="Download the card (.md)" />
        </div>
      </section>
    </main>
  );
}
