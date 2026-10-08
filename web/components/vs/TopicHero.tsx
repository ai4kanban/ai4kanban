import type { ReactNode } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { LogoMark } from "@/components/ui/Logo";
import type { VsSharedItem, VsTopicsHero } from "@/i18n/types";
import { Rich } from "../Rich";
import { framed, hairline, heroTop, panelStatic } from "../styles";
import { HeroBackdrop } from "./HeroBackdrop";
import { DraftsOurs, MemoryOurs, SetupOurs } from "./HeroVisuals";

// The title, then the three topics AI4Kanban wins, each drawn the same way:
// heading, verdict, one card with both sides and what they share. The rival's
// page supplies its name, mark and art.

type TopicKey = "setup" | "drafts" | "memory";
export type Rival = { name: string; mark: ReactNode; art: Record<TopicKey, ReactNode> };

const Badge = ({ win }: { win: boolean }) => (
  <span
    className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full ${
      win
        ? "bg-growth text-elev"
        : "bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)] text-muted"
    }`}
  >
    {win ? (
      <FiCheck className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
    ) : (
      <FiX className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
    )}
  </span>
);

function Topic({
  heading,
  verdict,
  ours,
  theirs,
  oursArt,
  theirsArt,
  shared,
  sharedLabel,
  rival,
}: {
  heading: string;
  verdict?: string;
  ours: string;
  theirs: string;
  oursArt: ReactNode;
  theirsArt: ReactNode;
  shared: VsSharedItem[];
  sharedLabel: string;
  rival: Rival;
}) {
  return (
    <div className="mt-16">
      <h2 className="text-2xl font-bold tracking-tight">{heading}</h2>
      {verdict && <p className="mt-2 text-lg text-muted">{verdict}</p>}
      <div className={`${panelStatic} ${framed} mt-6 overflow-hidden`}>
        <div className="grid sm:grid-cols-2">
          <div className="bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-elev))] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <LogoMark size="tag" />
              <span className="font-semibold text-ink">AI4Kanban</span>
              <Badge win />
            </div>
            <p className="mt-2 text-sm text-ink sm:min-h-[2.5rem]">{ours}</p>
            <div className="mt-2">{oursArt}</div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              {rival.mark}
              <span className="font-semibold text-muted">{rival.name}</span>
              <Badge win={false} />
            </div>
            <p className="mt-2 text-sm text-muted sm:min-h-[2.5rem]">{theirs}</p>
            <div className="mt-2">{theirsArt}</div>
          </div>
        </div>
        {shared.length > 0 && (
          <div className={`border-t px-5 py-5 sm:px-6 ${hairline}`}>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              {sharedLabel}
            </p>
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              {shared.map((item) => (
                <div key={item.title}>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <ul className="mt-2 space-y-2 text-sm text-muted">
                    {item.body.map((line) => (
                      <li key={line} className="flex items-start gap-1.5">
                        <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TopicHero({ c, rival }: { c: VsTopicsHero; rival: Rival }) {
  const topic = { sharedLabel: c.sharedLabel, rival };
  return (
    <section className={heroTop}>
      <div className="relative isolate py-16 text-center sm:py-20">
        <HeroBackdrop />
        {/* The one filled ember object on this page's hero — a mark, not a tint. */}
        <p className="mb-5 inline-block rounded-full border-2 border-border bg-accent-deep px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wider text-elev">
          {c.badge}
        </p>
        <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          <Rich>{c.title}</Rich>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          <Rich>{c.lead}</Rich>
        </p>
      </div>
      <Topic
        {...topic}
        {...c.setup}
        oursArt={<SetupOurs c={c.setup.art.ours} />}
        theirsArt={rival.art.setup}
      />
      <Topic
        {...topic}
        {...c.drafts}
        oursArt={<DraftsOurs c={c.drafts.art.ours} />}
        theirsArt={rival.art.drafts}
      />
      <Topic
        {...topic}
        {...c.memory}
        oursArt={<MemoryOurs c={c.memory.art.ours} />}
        theirsArt={rival.art.memory}
      />
    </section>
  );
}
