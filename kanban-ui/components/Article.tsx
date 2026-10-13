"use client";

// A `.md`/`.mdx` asset drawn as an article (#1651): the header's title and dek, then the
// Markdown under it in the card body's own renderer. On a card page it folds at a fixed
// height; on its own page it is drawn in full.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { parseArticle } from "@/lib/article";
import type { ArticleFile } from "@/lib/mockup-tag";
import { Markdown } from "./Markdown";

const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";
const FOLD = 440;

/** The article and whether it is shown as source. */
export function useArticle(file: ArticleFile, src: string) {
  const [source, setSource] = useState(false);
  return { file, src, source, setSource };
}

export type ArticleState = ReturnType<typeof useArticle>;

/** The switch between the article and its file's text. */
export function SourceSwitch({ state }: { state: ArticleState }) {
  const c = useCopy().card.mockup;
  return (
    <button
      type="button"
      onClick={() => state.setSource((v) => !v)}
      className="shrink-0 cursor-pointer text-[12px] font-[600] text-nb-ink-soft hover:text-nb-accent-deep"
    >
      {state.source ? c.article : c.source}
    </button>
  );
}

/** The article, or the file's own text when the source is asked for. */
function ArticleText({ file, src, source }: { file: ArticleFile; src: string; source: boolean }) {
  const article = useMemo(() => parseArticle(file.text, src.toLowerCase().endsWith(".mdx")), [file, src]);
  if (source)
    return (
      <span
        className="block whitespace-pre-wrap break-words p-4 font-mono text-[11.5px] leading-[18px] text-nb-ink"
        style={{ background: "var(--color-nb-wash)" }}
      >
        {file.text}
      </span>
    );
  const folder = src.split("/")[1]!;
  return (
    <span className="block px-10 pb-8 pt-7">
      {article.title && (
        <span className="block text-[26px] font-[800] leading-[1.2] tracking-[-0.02em] text-nb-ink">{article.title}</span>
      )}
      {article.dek && <span className="mt-3 block text-[15.5px] leading-[1.55] text-nb-ink-soft">{article.dek}</span>}
      {(article.title || article.dek) && <span className="mt-6 block" style={{ borderTop: `1px solid ${HAIRLINE}` }} />}
      <Markdown body={article.body} articleFolder={folder} className="mt-2 text-[14.5px] leading-[1.7]" />
    </span>
  );
}

/** The article in full, for its own page. */
export function ArticleFull({ state }: { state: ArticleState }) {
  return (
    <div className="mx-auto max-w-[720px]">
      <ArticleText file={state.file} src={state.src} source={state.source} />
    </div>
  );
}

/** The article on a card page: folded at a fixed height until it is opened. */
export function ArticleFolded({ state }: { state: ArticleState }) {
  const c = useCopy().card.mockup;
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [tall, setTall] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTall(el.offsetHeight > FOLD + 40));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const folded = tall && !open;
  return (
    <span ref={box} className="block">
      <span className="relative block overflow-hidden" style={folded ? { height: FOLD } : undefined}>
        <span ref={inner} className="block">
          <ArticleText file={state.file} src={state.src} source={state.source} />
        </span>
        {folded && (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 block h-[120px]"
            style={{ background: "linear-gradient(to bottom, transparent, var(--color-nb-paper))" }}
          />
        )}
      </span>
      {tall && (
        <span className="flex justify-center pb-4 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              // Collapsing from the article's end would leave the page past it.
              if (open) requestAnimationFrame(() => box.current?.scrollIntoView({ block: "nearest" }));
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] bg-nb-wash px-3.5 py-1.5 text-[12.5px] font-[700] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]"
          >
            {open ? c.collapse : c.expand}
            {open ? <FiChevronUp aria-hidden size={14} /> : <FiChevronDown aria-hidden size={14} />}
          </button>
        </span>
      )}
    </span>
  );
}
