import { Fragment, type ReactNode } from "react";

// Copy lives in the language files as plain strings so a translator only ever
// edits text, never JSX. The few bits of inline markup the copy needs are
// written with a tiny Markdown subset and rendered here:
//
//   `code`      a code chip          **bold**   emphasised run
//   *italic*    an <em>              \n         a line break
//
// Anything richer (links, diagrams, buttons) stays in the component — those are
// layout, not words.

const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\n)/g;

/** Code chips sit on two different backgrounds across the site. */
const CODE_CLASS = {
  accent:
    "rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[0.9em] text-ink",
  plain: "rounded bg-code px-1 py-0.5 font-mono text-[0.9em] text-ink",
} as const;

export type RichProps = {
  children: string;
  /** Which surface the code chips sit on. */
  code?: keyof typeof CODE_CLASS;
};

export function rich(text: string, code: keyof typeof CODE_CLASS = "accent") {
  return text.split(TOKEN).map((part, i) => {
    if (part === "\n") return <br key={i} />;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className={CODE_CLASS[code]}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <span key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders one copy string with its inline markup. */
export function Rich({ children, code = "accent" }: RichProps): ReactNode {
  return <>{rich(children, code)}</>;
}
