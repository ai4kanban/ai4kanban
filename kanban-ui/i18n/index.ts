// Every word the board UI renders. One folder per surface, one file per language
// inside it: `board/en.ts` is the board screen in English. The shape lives beside
// the words in each folder's `types.ts`, and `types.ts` here joins them into
// `UiCopy`.
//
// English is the source of truth. #336 adds `zh.ts` beside each `en.ts` and turns
// this file into a picker; until then there is one language and nothing to choose.
//
// How to write a string here:
//
// - A client component asks with `useCopy()` (i18n/use-copy.ts). Server components
//   and `lib/` import `copy` from here.
// - A sentence that takes a value is a function, not a template with holes:
//   `(path: string) => \`Installed at ${path}.\``. A language that spells the
//   sentence in another order rewrites the body and keeps the signature.
// - Extract whole sentences, never grammar. The component still branches on count;
//   each branch takes its own key holding a whole sentence. A key holding `"s"` or
//   `"are"` cannot be translated.
// - Product names, file names, paths, track names, shell commands and URLs are not
//   copy. They stay in the component.
// - Structure that isn't language — icons, colours, order — stays in the component
//   and is joined to this copy by key.
// - A sentence with a code chip or a bolded run in it stays ONE key: write the
//   markup as `code` and **bold** and draw it with `<Rich>` (i18n/rich.tsx).
// - `shared` holds only what more than one surface says. A word one screen says
//   lives in that screen's folder, however short it is.
import type { UiCopy } from "./types";
import board from "./board/en";
import card from "./card/en";
import chat from "./chat/en";
import chips from "./chips/en";
import chrome from "./chrome/en";
import configuration from "./configuration/en";
import messages from "./messages/en";
import rail from "./rail/en";
import runs from "./runs/en";
import setup from "./setup/en";
import shared from "./shared/en";

/** Every word the board UI renders, in one language. */
export const copy: UiCopy = {
  shared,
  chips,
  chrome,
  board,
  card,
  runs,
  chat,
  setup,
  configuration,
  rail,
  messages,
};
