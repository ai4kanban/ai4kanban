import { soloTrackOrder, soloTrackWeights } from "../content";
import { Rich } from "../Rich";
import { SectionHeading } from "../SectionHeading";
import { panel } from "../styles";
import type { HomeCopy, SoloTrackKey } from "@/i18n/types";

// Each track's share, rendered as one segment of the proportion bar and as a
// matching swatch on its card — a distinct hue per track type so "these are
// different kinds of work" reads before the words do.
const trackColor: Record<SoloTrackKey, { bar: string; text: string }> = {
  growth: { bar: "bg-growth", text: "text-growth" },
  validation: { bar: "bg-validation", text: "text-validation" },
  building: { bar: "bg-building", text: "text-building" },
};

export function Presets({ c }: { c: HomeCopy }) {
  const t = c.presets;
  return (
    <section id="solo" className="mt-24 scroll-mt-20">
      <SectionHeading num="04" {...t.heading} />
      <p className="text-ink">{t.lead}</p>

      {/* Proportion bar */}
      <div className="mt-8 flex h-4 w-full overflow-hidden rounded-md border-2 border-border">
        {soloTrackOrder.map((key) => (
          <div
            key={key}
            className={trackColor[key].bar}
            style={{ width: soloTrackWeights[key] }}
            title={`${key} ${soloTrackWeights[key]}`}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {soloTrackOrder.map((key) => (
          <div key={key} className={`${panel} p-6`}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-sm ${trackColor[key].bar}`}
                aria-hidden="true"
              />
              {/* The track name is the folder name under todo/ — never translated. */}
              <h3 className="text-lg font-semibold">{key}</h3>
              <span
                className={`ml-auto font-mono text-sm font-semibold ${trackColor[key].text}`}
              >
                {soloTrackWeights[key]}
              </span>
            </div>
            <p className="text-[0.95rem] text-muted">{t.tracks[key].body}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm text-muted">
        <Rich>{t.note}</Rich>
      </p>
    </section>
  );
}
