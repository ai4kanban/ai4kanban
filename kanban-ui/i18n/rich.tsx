import { Fragment, type ReactNode } from "react";

// Copy is plain strings, so a translator only ever edits text. The inline markup
// a sentence needs is written in a tiny Markdown subset and rendered here:
//
//   `code`      a code chip        **bold**   a bolded run
//
// That is what keeps a sentence whole: `**v1** is closed, but its changelog was
// not written` is one key, not a bold span and a fragment after it. Anything
// richer — links, buttons, panels — is layout and stays in the component.
//
// The same subset and the same job as `web/components/Rich.tsx`.

const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*)/g;

/** Renders one copy string with its inline markup. `code` is the class the chips
 *  take, for the few places a code chip has to look like the rest of its block. */
export function Rich({ children, code }: { children: string; code?: string }): ReactNode {
  return (
    <>
      {children.split(TOKEN).map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className={code}>
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
