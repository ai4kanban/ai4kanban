// Every word the board UI renders. One folder per surface, one file per language
// inside it: `board/en.ts` is the board screen in English, `board/zh.ts` the same
// screen in Simplified Chinese. The shape lives beside the words in each folder's
// `types.ts`, and `types.ts` here joins them into `UiCopy`.
//
// English is the source of truth. `synced-commit.txt` records the commit the
// Chinese was written from, so a later English edit is found by diffing against
// that marker and re-expressed with the same `translator` skill that wrote it.
//
// How to write a string here:
//
// - A client component asks with `useCopy()` (i18n/use-copy.ts). Server components
//   and `lib/` call `getCopy(await machineLanguage())` — `machineCopy()` in
//   lib/language.ts is that pair in one call.
// - A sentence that takes a value is a function, not a template with holes:
//   `(path: string) => \`Installed at ${path}.\``. A language that spells the
//   sentence in another order rewrites the body and keeps the signature.
// - Extract whole sentences, never grammar. The component still branches on count;
//   each branch takes its own key holding a whole sentence. A key holding `"s"` or
//   `"are"` cannot be translated.
// - Product names, file names, paths, track names, shell commands and URLs are not
//   copy. They stay in the component, and stay English in every language.
// - Punctuation follows the target language: full-width ，。；：？（） in Chinese.
// - Chinese wording follows docs/kanban/memory/goal.md: 自主拆解、循环澄清、需求、
//   决策可追溯、自进化、交付闭环。书面语，不用口语化的说法。
// - Structure that isn't language — icons, colours, order — stays in the component
//   and is joined to this copy by key.
// - A sentence with a code chip or a bolded run in it stays ONE key: write the
//   markup as `code` and **bold** and draw it with `<Rich>` (i18n/rich.tsx).
// - `shared` holds only what more than one surface says. A word one screen says
//   lives in that screen's folder, however short it is.
import type { Language } from "@/lib/types";
import type { UiCopy } from "./types";
import board from "./board";
import card from "./card";
import chat from "./chat";
import chips from "./chips";
import chrome from "./chrome";
import configuration from "./configuration";
import messages from "./messages";
import notifications from "./notifications";
import rail from "./rail";
import runs from "./runs";
import setup from "./setup";
import shared from "./shared";

/** Every word the board UI renders, in one language. */
export function getCopy(language: Language): UiCopy {
  return {
    shared: shared[language],
    chips: chips[language],
    chrome: chrome[language],
    board: board[language],
    card: card[language],
    runs: runs[language],
    chat: chat[language],
    setup: setup[language],
    configuration: configuration[language],
    rail: rail[language],
    notifications: notifications[language],
    messages: messages[language],
  };
}
