import { FiArrowRight, FiCheck, FiSearch, FiZap } from "react-icons/fi";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panelInset, panelStatic } from "../styles";
import { stageOrder } from "./vs-multica-content";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

export function KanbanHeroDiagram({
  c,
}: {
  c: VsMulticaCopy["hero"];
}) {
  return (
    <div
      className="mb-4 rounded-lg border border-border bg-elev p-3"
      role="img"
      aria-label={c.oursDiagramAlt}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-deep text-elev">
          <FiSearch className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-accent-deep">
          {c.oursDiagramTop}
        </span>
      </div>
      <div className="ml-3.5 h-3 border-l-2 border-dashed border-border" />
      <div className="rounded-md border-2 border-border bg-code px-3 py-2 font-mono text-[0.65rem] font-semibold text-ink">
        {c.oursDiagramBottom}
      </div>
    </div>
  );
}

export function MulticaHeroDiagram({
  c,
}: {
  c: VsMulticaCopy["hero"];
}) {
  return (
    <div
      className="mb-4 rounded-lg border border-border bg-elev p-3"
      role="img"
      aria-label={c.theirsDiagramAlt}
    >
      <div className="rounded-md border-2 border-border bg-code px-3 py-2 font-mono text-[0.65rem] font-semibold text-ink">
        {c.theirsDiagramTop}
      </div>
      <div className="ml-3.5 h-3 border-l-2 border-dashed border-border" />
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-elev">
          <FiZap className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-ink">
          {c.theirsDiagramBottom}
        </span>
      </div>
    </div>
  );
}

export function MulticaLifecycle({
  c,
}: {
  c: VsMulticaCopy["boundary"];
}) {
  return (
    <section className="mt-24">
      <SectionHeading num="01" {...c.heading} />
      <p className="text-ink">
        <Rich>{c.lead}</Rich>
      </p>

      <div className={`${panelStatic} mt-7 overflow-hidden`}>
        <div className="hidden grid-cols-2 border-b-2 border-border font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] sm:grid">
          <div className="bg-accent-deep px-4 py-3 text-elev">{c.oursLabel}</div>
          <div className="bg-ink px-4 py-3 text-elev">{c.theirsLabel}</div>
        </div>

        <div className="relative hidden grid-cols-6 gap-0 px-6 py-8 sm:grid">
          <span
            className="absolute bottom-0 left-1/2 top-0 border-l-2 border-dashed border-border"
            aria-hidden="true"
          />
          {stageOrder.map((key, index) => {
            const ours = index < 3;
            return (
              <div key={key} className="relative flex items-center sm:block">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-border font-mono text-sm font-black ${
                    ours ? "bg-accent-deep text-elev" : "bg-ink text-elev"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {c.stages[key]}
                </p>
                {index < stageOrder.length - 1 && (
                  <FiArrowRight
                    className="absolute right-2 top-3 h-4 w-4 text-muted"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border bg-elev px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-ink">
            {c.handoffLabel}
          </span>
        </div>

        <div className="sm:hidden">
          {[
            {
              label: c.oursLabel,
              keys: stageOrder.slice(0, 3),
              tone: "bg-accent-deep",
              start: 0,
            },
            {
              label: c.theirsLabel,
              keys: stageOrder.slice(3),
              tone: "bg-ink",
              start: 3,
            },
          ].map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && (
                <div className="relative flex h-10 items-center justify-center border-y-2 border-dashed border-border bg-code">
                  <span className="rounded-full border-2 border-border bg-elev px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-ink">
                    {c.handoffLabel}
                  </span>
                </div>
              )}
              <div
                className={`${group.tone} px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-elev`}
              >
                {group.label}
              </div>
              <div className="space-y-3 p-4">
                {group.keys.map((key, offset) => {
                  const index = group.start + offset;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border font-mono text-xs font-black text-elev ${group.tone}`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        {c.stages[key]}
                      </p>
                      {offset < group.keys.length - 1 && (
                        <FiArrowRight
                          className="ml-auto h-4 w-4 rotate-90 text-muted"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panelInset} mt-5 flex items-start gap-3 p-5`}>
        <FiCheck className="mt-0.5 h-5 w-5 shrink-0 text-growth" aria-hidden="true" />
        <p className="text-[0.95rem] text-muted">
          <Rich code="wash">{c.principle}</Rich>
        </p>
      </div>
    </section>
  );
}
