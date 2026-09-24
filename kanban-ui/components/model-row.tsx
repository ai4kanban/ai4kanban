// One model id, drawn the same wherever the board offers one — under the Model box in
// Configuration, and on a chat's own row.
//
// The two lists hold the same ids already (a runtime's Model box in agent/resolve.ts); this is so
// they read the same as well. Ids are mono because that is what they are: something you
// retype, not something you read.

import { FiCheck } from "react-icons/fi";

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
