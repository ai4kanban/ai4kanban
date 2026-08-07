import { LogoMark } from "@/components/ui/Logo";
import type { ReactNode } from "react";
import { Rich } from "../Rich";
import { panelInset } from "../styles";
import type { SiteCopy, VsHero } from "@/i18n/types";

// The compact two-chip header every comparison page opens with: it states the
// framing before any detail — two different tools, not two takes on one. The
// Hermes page passes a diagram into each chip via `oursExtra` / `theirsExtra`.

function Chip({
  tag,
  name,
  body,
  extra,
}: {
  tag: ReactNode;
  name: string;
  body: string;
  extra?: ReactNode;
}) {
  return (
    <div className={`${panelInset} flex-1 p-5`}>
      {extra}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {tag}
        </span>
        <span className="font-semibold text-ink">{name}</span>
      </div>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}

export function VsHeroSection({
  c,
  shared,
  theirsTag,
  oursExtra,
  theirsExtra,
}: {
  c: VsHero;
  shared: SiteCopy["shared"];
  theirsTag: ReactNode;
  oursExtra?: ReactNode;
  theirsExtra?: ReactNode;
}) {
  return (
    <section className="mt-12 text-center">
      {/* The one filled blue object on this page's hero — a mark, not a tint. */}
      <p className="mb-5 inline-block rounded-full border-2 border-border bg-accent-deep px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-elev">
        {c.badge}
      </p>
      <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
        <Rich>{c.title}</Rich>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
        <Rich>{c.lead}</Rich>
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-3 text-left sm:flex-row">
        <Chip tag={<LogoMark size="xs" />} name={c.ours.name} body={c.ours.body} extra={oursExtra} />
        <div className="hidden items-center justify-center px-1 font-mono text-sm font-semibold text-muted sm:flex">
          {shared.vs}
        </div>
        <Chip
          tag={theirsTag}
          name={c.theirs.name}
          body={c.theirs.body}
          extra={theirsExtra}
        />
      </div>
    </section>
  );
}
