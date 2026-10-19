"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import { localePath } from "@/lib/i18n";
import { clock, fetchCatalog, templatePath, type Category } from "@/lib/templates";
import { AccessTag, Duration, NoPreview, StateBox } from "./parts";

// The catalog, one section per category, every template in it. The HTML holds
// what the build saw; the browser reads it again so it is always current.
export function Catalog({ locale, initial }: { locale: TemplatesLocale; initial: Category[] | null }) {
  const t = getTemplatesCopy(locale);
  const [categories, setCategories] = useState(initial);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchCatalog().then(setCategories, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // A link back from a template names its section; the section may only exist
  // once the read lands.
  const scrolled = useRef(false);
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!categories || !id || scrolled.current) return;
    scrolled.current = true;
    document.getElementById(id)?.scrollIntoView();
  }, [categories]);

  if (!categories) {
    if (!failed) return <p className="mt-10 text-muted">{t.loading}</p>;
    return (
      <section className="mt-10">
        <StateBox line={t.unavailable}>
          <Button size="sm" onClick={load}>
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            {t.retry}
          </Button>
        </StateBox>
      </section>
    );
  }
  if (categories.length === 0) {
    return (
      <section className="mt-10">
        <StateBox line={t.empty} />
      </section>
    );
  }

  return categories.map(({ category, templates }) => (
    <section key={category} id={category} className="mt-12 scroll-mt-24">
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink">{t.categories[category]?.title ?? category}</h2>
        <span className="text-sm text-muted">{t.count(templates.length)}</span>
      </div>
      <div className="mt-5 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <a
            key={tpl.name}
            href={localePath(locale, templatePath(category, tpl.name))}
            className="group block no-underline"
          >
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
        ))}
      </div>
    </section>
  ));
}
