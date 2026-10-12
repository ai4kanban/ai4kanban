"use client";

// A `.md`/`.mdx` asset drawn as an article (#1651): the header's title and dek, then the
// Markdown under it in the card body's own renderer. The caption row switches language and
// source and downloads the file. On a card page it folds at a fixed height; on its own page
// it is drawn in full.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiChevronUp, FiDownload, FiGlobe } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { languageName, parseArticle } from "@/lib/article";
import type { ArticleFile } from "@/lib/mockup-tag";
import { Markdown } from "./Markdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

const HAIRLINE = "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)";
const FOLD = 440;

/** Which language is shown and whether as source. Starts on the file the tag names. */
export function useArticle(files: ArticleFile[], src: string) {
  const [at, setAt] = useState(src);
  const [source, setSource] = useState(false);
  const file = files.find((f) => f.src === at) ?? files[0]!;
  return { files, file, setAt, source, setSource };
}

export type ArticleState = ReturnType<typeof useArticle>;

const nameOf = (lang: string | null) => (lang ? (languageName(lang) ?? lang) : "");

/** The right end of the caption row: language, the source switch, download. */
export function ArticleControls({ state }: { state: ArticleState }) {
  const c = useCopy().card.mockup;
  const { files, file, setAt, source, setSource } = state;
  const name = file.src.split("/").pop()!;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-x-2.5">
      {files.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={c.language}
              className="inline-flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[12px] font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink"
            >
              <FiGlobe aria-hidden size={13} />
              {nameOf(file.lang)}
              <FiChevronDown aria-hidden size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {files.map((f) => (
              <DropdownMenuItem key={f.src} className="justify-between gap-3" onSelect={() => setAt(f.src)}>
                {nameOf(f.lang)}
                {f.src === file.src && <FiCheck aria-hidden size={12} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        type="button"
        onClick={() => setSource((v) => !v)}
        className="shrink-0 cursor-pointer text-[12px] font-[600] text-nb-ink-soft hover:text-nb-accent-deep"
      >
        {source ? c.article : c.source}
      </button>
      <a
        href={file.href}
        download={name}
        data-tip={c.download}
        aria-label={c.download}
        className="nb-tip nb-tip-below relative inline-flex size-6 items-center justify-center rounded-[6px] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-accent-deep"
      >
        <FiDownload aria-hidden size={13} />
      </a>
    </span>
  );
}

/** The article, or the file's own text when the source is asked for. */
function ArticleText({ file, source }: { file: ArticleFile; source: boolean }) {
  const article = useMemo(() => parseArticle(file.text, file.src.toLowerCase().endsWith(".mdx")), [file]);
  if (source)
    return (
      <span
        className="block whitespace-pre-wrap break-words p-4 font-mono text-[11.5px] leading-[18px] text-nb-ink"
        style={{ background: "var(--color-nb-wash)" }}
      >
        {file.text}
      </span>
    );
  const folder = file.src.split("/")[1]!;
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
      <ArticleText file={state.file} source={state.source} />
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
          <ArticleText file={state.file} source={state.source} />
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
