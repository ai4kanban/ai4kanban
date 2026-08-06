import type { Recipe } from "./recipes-content";
import { panel } from "../styles";

// One entry in the /recipes gallery. The whole card is a link into the recipe's
// own landing page. A flex column so the footer row — "View recipe" plus any
// brand chip — sits on a shared baseline across cards regardless of title or
// tagline length; the title row stays aligned instead of being pushed down by
// the badge.
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <a
      href={`/recipes/${recipe.slug}`}
      className={`${panel} group flex h-full flex-col p-6 no-underline`}
    >
      <div className="flex items-center gap-4">
        <span className="text-3xl leading-none" aria-hidden="true">
          {recipe.icon}
        </span>
        <h3 className="text-lg font-semibold leading-snug text-ink">
          {recipe.title}
        </h3>
      </div>

      <p className="mt-4 text-[0.95rem] text-muted">{recipe.tagline}</p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent-deep">
          View recipe
          <span className="transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </span>
        {recipe.brand && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-border bg-code px-2.5 py-1 text-[0.72rem] font-semibold text-muted">
            <img
              src={recipe.brand.logo}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 rounded-full"
            />
            Powered by {recipe.brand.name}
          </span>
        )}
      </div>
    </a>
  );
}
