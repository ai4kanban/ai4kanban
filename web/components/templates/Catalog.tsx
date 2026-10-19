"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { heroTop } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { Pager, Tab, Tabs } from "@/components/ui/Tabs";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import type { TemplatesCopy } from "@/i18n/templates/types";
import { localePath } from "@/lib/i18n";
import { clock, fetchCatalog, templatePath, type Category, type TemplateCard } from "@/lib/templates";
import { AccessTag, Duration, NoPreview, StateBox } from "./parts";

const PER_PAGE = 12;

// The catalog: a tab per category, twelve templates a page. Only the open tab's
// page is rendered, so only its covers load. The HTML holds what the build saw;
// the browser reads it again so it is always current.
export function Catalog({ locale, initial }: { locale: TemplatesLocale; initial: Category[] | null }) {
  const t = getTemplatesCopy(locale);
  const [categories, setCategories] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const grid = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetchCatalog().then(setCategories, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // `#<category>` picks the tab; a link back from a template carries it.
  useEffect(() => {
    const sync = () => {
      setPicked(decodeURIComponent(window.location.hash.slice(1)) || null);
      setPage(1);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const pick = (e: MouseEvent<HTMLAnchorElement>, category: string) => {
    e.preventDefault();
    window.history.replaceState(window.history.state, "", `#${category}`);
    setPicked(category);
    setPage(1);
  };
  const turn = (n: number) => {
    setPage(n);
    grid.current?.scrollIntoView({ block: "start" });
  };

  const open = categories?.find((c) => c.category === picked) ?? categories?.[0];

  return (
    <>
      <section className={`${heroTop} md:flex md:items-end md:justify-between md:gap-8`}>
        <div>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-3 text-lg text-muted">{t.lead}</p>
        </div>
        {categories && open && (
          <Tabs label={t.tabs} className="mt-6 shrink-0 md:mt-0">
            {categories.map(({ category, templates }) => (
              <Tab
                key={category}
                href={`#${category}`}
                on={category === open.category}
                count={templates.length}
                onClick={(e) => pick(e, category)}
              >
                {t.categories[category]?.name ?? category}
              </Tab>
            ))}
          </Tabs>
        )}
      </section>

      {open ? (
        <section>
          <div ref={grid} className="mt-8 grid scroll-mt-24 gap-x-8 gap-y-10 sm:grid-cols-2 md:mt-10 lg:grid-cols-3">
            {open.templates.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((tpl) => (
              <Tile key={tpl.name} locale={locale} t={t} category={open.category} tpl={tpl} />
            ))}
          </div>
          <Pager
            page={page}
            pages={Math.ceil(open.templates.length / PER_PAGE)}
            onPage={turn}
            label={t.pages}
            prev={t.prev}
            next={t.next}
          />
        </section>
      ) : (
        <section className="mt-10">
          {categories ? (
            <StateBox line={t.empty} />
          ) : failed ? (
            <StateBox line={t.unavailable}>
              <Button size="sm" onClick={load}>
                <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                {t.retry}
              </Button>
            </StateBox>
          ) : (
            <p className="text-muted">{t.loading}</p>
          )}
        </section>
      )}
    </>
  );
}

function Tile({
  locale,
  t,
  category,
  tpl,
}: {
  locale: TemplatesLocale;
  t: TemplatesCopy;
  category: string;
  tpl: TemplateCard;
}) {
  return (
    <a href={localePath(locale, templatePath(category, tpl.name))} className="group block no-underline">
      <div className="relative overflow-hidden rounded-xl bg-code">
        {tpl.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- a static export, and the image is Cloud's
          <img
            src={tpl.cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <NoPreview label={t.noPreview} aspect="aspect-[16/10]" />
        )}
        <span className="absolute left-2 top-2 flex">
          <AccessTag access={tpl.access} t={t} cover />
        </span>
        {tpl.duration ? <Duration>{clock(tpl.duration)}</Duration> : null}
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:text-accent-deep">
        {tpl.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[0.92rem] leading-relaxed text-muted">{tpl.summary}</p>
    </a>
  );
}
