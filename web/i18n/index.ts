// Every word the site renders. One folder per page, one file per language
// inside it: `home/fr.ts` is the landing page in French, `shared/en.ts` the
// chrome every page reuses. The shape lives beside the words, in each folder's
// `types.ts`, and `types.ts` here joins them into `SiteCopy`.
//
// English is the source of truth — write new copy in `<page>/en.ts` first, then
// run `/translate-sync`. It diffs English from the commit in
// `synced-commit.txt` and re-expresses whatever moved in the other four.
//
// How to write a string here:
//
// - Inline markup is the subset `components/Rich.tsx` renders: `` `code` ``,
//   **bold**, *italic*, and \n for a line break. Anything richer is layout and
//   belongs in the component. Keep markup and `{placeholders}` byte-identical
//   across languages.
// - Product names, file names, paths, track names, shell commands and URLs stay
//   exactly as they are in every language.
// - Punctuation follows the target language: full-width ，。；：？（） for
//   Chinese and Japanese, ¿ ¡ for Spanish. French takes a narrow no-break space
//   (U+202F) before ; ! ? and a no-break space (U+00A0) before : and inside
//   « » — invisible in the file, but already there; match the neighbouring
//   lines.
// - Chinese wording follows docs/kanban/memory/goal.md: 自主拆解、循环澄清、
//   需求、决策可追溯、自进化、交付闭环。书面语，不用口语化的说法。
// - Register is plain and professional, never slangy, in every language.
import type { Locale } from "@/lib/i18n";
import type { SiteCopy } from "./types";
import shared from "./shared";
import home from "./home";
import vsGithub from "./vs-github-issues";
import vsHermes from "./vs-hermes-kanban";
import vsVibe from "./vs-vibe-kanban";
import vsLinear from "./vs-linear";
import vsMultica from "./vs-multica";

/** Every word the site renders, in one language. */
export function getCopy(locale: Locale): SiteCopy {
  return {
    shared: shared[locale],
    home: home[locale],
    vsGithub: vsGithub[locale],
    vsHermes: vsHermes[locale],
    vsVibe: vsVibe[locale],
    vsLinear: vsLinear[locale],
    vsMultica: vsMultica[locale],
  };
}
