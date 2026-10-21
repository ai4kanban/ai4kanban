"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { FiPlay, FiRefreshCw } from "react-icons/fi";
import { heroTop } from "@/components/styles";
import { Button } from "@/components/ui/Button";
import { Pager, Tab, Tabs } from "@/components/ui/Tabs";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import type { TemplatesCopy } from "@/i18n/templates/types";
import { localePath } from "@/lib/i18n";
import { clock, fetchCatalog, templatePath, type Category, type TemplateCard } from "@/lib/templates";
import { AccessTag, Bone, Duration, Img, NoPreview, Progress, StateBox, reducedMotion } from "./parts";

const PER_PAGE = 12;

// The catalog: a tab per category, twelve templates a page. Only the open tab's
// page is rendered, so only its covers load. The HTML holds what the build saw;
// the browser reads it again so it is always current. A motion's clip plays in its
// tile — under the pointer, or on a touch screen the tile nearest the middle — one
// at a time, and loads only then.
export function Catalog({ locale, initial }: { locale: TemplatesLocale; initial: Category[] | null }) {
  const t = getTemplatesCopy(locale);
  const [categories, setCategories] = useState(initial);
  const [fresh, setFresh] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetchCatalog().then(
      (c) => {
        setCategories(c);
        setFresh(true);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  // `#<category>` picks the tab; a link back from a template carries it.
  useEffect(() => {
    const sync = () => {
      setPicked(decodeURIComponent(window.location.hash.slice(1)) || null);
      setPage(1);
      setPlaying(null);
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
    setPlaying(null);
  };
  const turn = (n: number) => {
    setPage(n);
    setPlaying(null);
    grid.current?.scrollIntoView({ block: "start" });
  };

  // A tab the snapshot lacks waits for the fresh read, rather than flashing the first tab.
  const found = categories?.find((c) => c.category === picked);
  const waiting = !found && !!picked && !fresh && !failed;
  const open = found ?? (waiting ? undefined : categories?.[0]);
  const shown = open?.templates.slice((page - 1) * PER_PAGE, page * PER_PAGE) ?? [];
  const hover = useHover();

  // Without a pointer, the clip tile most in view plays.
  const clips = shown.filter((tpl) => tpl.clip).length;
  useEffect(() => {
    if (hover !== false || !clips || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.intersectionRatio);
        const best = [...seen].filter(([, r]) => r >= 0.75).sort((a, b) => b[1] - a[1])[0];
        setPlaying(best ? (best[0] as HTMLElement).dataset.clip! : null);
      },
      { threshold: [0, 0.75, 1] },
    );
    grid.current?.querySelectorAll("[data-clip]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [hover, clips, open, page]);

  return (
    <>
      <section className={`${heroTop} md:flex md:items-end md:justify-between md:gap-8`}>
        <div>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-3 text-lg text-muted">{t.lead}</p>
        </div>
        {categories && (open || waiting) ? (
          <Tabs label={t.tabs} className="mt-6 shrink-0 md:mt-0">
            {categories.map(({ category, templates }) => (
              <Tab
                key={category}
                href={`#${category}`}
                on={category === open?.category}
                count={templates.length}
                onClick={(e) => pick(e, category)}
              >
                {t.categories[category]?.name ?? category}
              </Tab>
            ))}
          </Tabs>
        ) : (
          !failed && (
            <div className="mt-6 flex shrink-0 items-center gap-6 py-2 md:mt-0" aria-hidden="true">
              {[3.5, 3, 3.5, 3.5, 3.5].map((w, i) => (
                <Bone key={i} className="h-4" style={{ width: `${w}rem` }} />
              ))}
            </div>
          )
        )}
      </section>

      {open ? (
        <section>
          <div
            ref={grid}
            className={`mt-8 grid scroll-mt-24 gap-x-8 gap-y-10 sm:grid-cols-2 md:mt-10 ${columns(open.category)}`}
          >
            {shown.map((tpl) => (
              <Tile
                key={tpl.name}
                locale={locale}
                t={t}
                category={open.category}
                tpl={tpl}
                playing={playing === tpl.name}
                onHover={
                  hover && tpl.clip
                    ? (on) => {
                        if (on && !reducedMotion()) setPlaying(tpl.name);
                        else setPlaying((p) => (p === tpl.name ? null : p));
                      }
                    : undefined
                }
              />
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
      ) : waiting || (!categories && !failed) ? (
        <Loading t={t} category={picked} />
      ) : (
        <section className="mt-10">
          {categories ? (
            <StateBox line={t.empty} />
          ) : (
            <StateBox line={t.unavailable}>
              <Button size="sm" onClick={load}>
                <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
                {t.retry}
              </Button>
            </StateBox>
          )}
        </section>
      )}
    </>
  );
}

const columns = (category: string) => (category === "carousel" ? "lg:grid-cols-4" : "lg:grid-cols-3");

// A motion is shown whole, as its clip frames it; a carousel stands portrait.
const tileAspect = (category: string) =>
  category === "motion" ? "aspect-video" : category === "carousel" ? "aspect-[3/4]" : "aspect-[16/10]";

/** One row of the tab's own tiles; two on a phone. */
function Loading({ t, category }: { t: TemplatesCopy; category: string | null }) {
  const c = category ?? "";
  return (
    <section aria-busy="true">
      <span className="sr-only">{t.loading}</span>
      <div className={`mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 md:mt-10 ${columns(c)}`}>
        {Array.from({ length: c === "carousel" ? 4 : 3 }, (_, i) => (
          <div key={i} className={i >= 2 ? "hidden lg:block" : ""}>
            <Bone className={`${tileAspect(c)} w-full rounded-xl`} />
            <Bone className="mt-4 h-5 w-3/4" />
            <Bone className="mt-2.5 h-3.5 w-full" />
            <Bone className="mt-2 h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Whether the screen has a pointer that hovers; null until the browser says. */
function useHover() {
  const [hover, setHover] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(hover: hover)");
    const sync = () => setHover(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  return hover;
}

function Tile({
  locale,
  t,
  category,
  tpl,
  playing,
  onHover,
}: {
  locale: TemplatesLocale;
  t: TemplatesCopy;
  category: string;
  tpl: TemplateCard;
  playing: boolean;
  onHover?: (on: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const v = video.current;
    if (!playing) setShown(false);
    else if (v) {
      v.muted = true;
      v.play().catch(() => undefined);
    }
  }, [playing]);
  const aspect = tileAspect(category);
  const fit =
    category === "motion"
      ? "object-contain"
      : "object-cover group-hover:scale-[1.02] motion-reduce:group-hover:scale-100";

  return (
    <a
      href={localePath(locale, templatePath(category, tpl.name))}
      className="group block no-underline"
      onPointerEnter={onHover && (() => onHover(true))}
      onPointerLeave={onHover && (() => onHover(false))}
    >
      <div className="relative overflow-hidden rounded-xl bg-code" data-clip={tpl.clip ? tpl.name : undefined}>
        {tpl.cover ? (
          <Img src={tpl.cover} lazy className={`${aspect} w-full ${fit}`} />
        ) : (
          <NoPreview label={t.noPreview} aspect={aspect} />
        )}
        {playing && tpl.clip && (
          <video
            ref={video}
            src={tpl.clip}
            muted
            loop
            playsInline
            onPlaying={() => setShown(true)}
            onError={() => setShown(false)}
            className={`absolute inset-0 h-full w-full object-contain ${shown ? "" : "opacity-0"}`}
          />
        )}
        <span className="absolute left-2 top-2 flex">
          <AccessTag access={tpl.access} t={t} cover />
        </span>
        {playing && shown ? (
          <Progress video={video} />
        ) : tpl.duration ? (
          <Duration>
            {tpl.clip && <FiPlay className="h-3 w-3 fill-elev" aria-hidden="true" />}
            {clock(tpl.duration)}
          </Duration>
        ) : null}
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:text-accent-deep">
        {tpl.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[0.92rem] leading-relaxed text-muted">{tpl.summary}</p>
    </a>
  );
}
