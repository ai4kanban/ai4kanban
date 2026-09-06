// One model id, drawn the same wherever the board offers one — under the Model box in
// Configuration, and on a chat's own row.
//
// The two lists hold the same ids already (`modelsKnown` in agent/resolve.ts); this is so
// they read the same as well. Ids are mono because that is what they are: something you
// retype, not something you read.

import { FiCheck } from "react-icons/fi";

/** The frame a row wears in a list that isn't a Radix menu — Configuration's, which sits in
 *  the field rather than in a portal. A menu item brings its own. */
export const MODEL_ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left";

/** `tag` is the one thing a list may say about an id beyond its name, and it is the board's
 *  own business rather than the model's: which of them this board runs. Nothing here
 *  describes a model — that is the provider's job, not ours. */
export function ModelRow({ id, picked, tag }: { id: string; picked: boolean; tag?: string }) {
  return (
    <>
      <span className="w-[13px] shrink-0">
        {picked && <FiCheck size={12} className="text-nb-accent" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-[400] text-nb-ink">{id}</span>
      {tag && <span className="shrink-0 text-[10.5px] font-[400] text-nb-ink-soft">{tag}</span>}
    </>
  );
}
