import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { FiAlertTriangle, FiEdit3, FiInfo, FiZap } from "react-icons/fi";
import { framed, panelStatic } from "@/components/styles";

// The blocks a post can write that aren't prose and aren't a figure: the two
// summary panels, the callout, a sourced quote, and the FAQ. Every name here is
// in scope inside an MDX body — `BlogMdx.tsx` hands the set to the compiler —
// so a post writes the tag with no import.
//
// Each block opens with the site's eyebrow: an ember mark, then the label in
// `accent-deep`, the cut of the ember you can read (`SectionHeading.tsx`). The
// two summary panels are raised paper with the ink frame, because a summary is
// the one block in a body that outranks the prose around it. A callout is bare
// wash — a step down the ramp, not a second object — so it reads as a side note
// rather than competing with the panel above it.
//
// Their spacing and their inner type live in `app/blog-prose.css` with the rest
// of the body's rhythm: the stylesheet owns the gaps between blocks, so a block
// that set its own would be overridden by it anyway.

function Label({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon ?? (
        <span
          className="h-4 w-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
        {children}
      </span>
    </div>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
      className={`mdx-block ${panelStatic} ${framed} px-6 py-5`}
    >
      <Label>{label}</Label>
      <div className="mdx-body mt-3">{children}</div>
    </aside>
  );
}

/** The opening summary. One per post, above the first heading. */
export function TLDR({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return <Summary label={title ?? "TL;DR"}>{children}</Summary>;
}

/** The same panel as a list — either from `items` or from Markdown bullets. */
export function KeyTakeaways({
  children,
  items,
  title,
}: {
  children?: ReactNode;
  items?: string[];
  title?: string;
}) {
  return (
    <Summary label={title ?? "Key takeaways"}>
      {items && items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        children
      )}
    </Summary>
  );
}

type CalloutType = "note" | "tip" | "warning" | "info";

// A callout's kind is its label and its glyph. There is no tinted variant: the
// site has one accent and it is never a panel fill.
const CALLOUTS = {
  note: { label: "Note", Icon: FiEdit3 },
  tip: { label: "Tip", Icon: FiZap },
  warning: { label: "Heads up", Icon: FiAlertTriangle },
  info: { label: "Info", Icon: FiInfo },
} as const satisfies Record<CalloutType, { label: string; Icon: typeof FiInfo }>;

export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}) {
  const { label, Icon } = CALLOUTS[type] ?? CALLOUTS.note;
  return (
    <aside
      aria-label={title ?? label}
      className="mdx-block mdx-inset rounded-xl bg-code px-6 py-5"
    >
      <Label icon={<Icon aria-hidden="true" className="size-4 text-accent" />}>
        {title ?? label}
      </Label>
      <div className="mdx-body mt-3">{children}</div>
    </aside>
  );
}

/** A `>` blockquote with an attribution under it. `source` links the byline. */
export function Quote({
  byline,
  children,
  source,
}: {
  byline?: string;
  children: ReactNode;
  source?: string;
}) {
  return (
    <figure className="mdx-block mdx-quote">
      <blockquote>{children}</blockquote>
      {byline ? (
        <figcaption>
          {"— "}
          <cite className="not-italic">
            {source ? (
              <a href={source} target="_blank" rel="noopener">
                {byline}
              </a>
            ) : (
              byline
            )}
          </cite>
        </figcaption>
      ) : null}
    </figure>
  );
}

type FAQItemProps = { question: string; children: ReactNode };

// A marker. `FAQ` reads the props off its children and draws the rows itself;
// rendering nothing here keeps a stray `<FAQItem>` outside an `<FAQ>` from
// spilling its answer into the prose.
export function FAQItem(props: FAQItemProps) {
  void props;
  return null;
}

// The answer text for the FAQPage node, which takes a string and not markup.
function plainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement(node)) {
    return plainText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/**
 * The post's FAQ, and the FAQPage markup for it. Only direct `<FAQItem>`
 * children count — prose between them is dropped, because anything in the
 * section that isn't a question and its answer is not in the structured data
 * either, and a page that says two different things is worse than one section.
 */
export function FAQ({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const items: { question: string; answer: ReactNode; text: string }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Partial<FAQItemProps>;
    if (typeof props.question !== "string") return;
    items.push({
      question: props.question,
      answer: props.children,
      text: plainText(props.children).trim(),
    });
  });

  if (items.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.text },
    })),
  };

  const heading = title ?? "Frequently asked questions";

  return (
    <section className="mdx-block mdx-faq" aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.question}>
            <details className="group">
              <summary>
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="text-lg font-normal text-accent-deep transition-transform duration-150 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="mdx-body">{item.answer}</div>
            </details>
          </li>
        ))}
      </ul>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  );
}
