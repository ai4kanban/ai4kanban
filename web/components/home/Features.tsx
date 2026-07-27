import { featureIcons, featureOrder } from "../content";
import { Rich } from "../Rich";
import { panel } from "../styles";
import type { HomeCopy } from "@/i18n/types";

export function Features({ c }: { c: HomeCopy }) {
  return (
    <section className="mt-20">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {featureOrder.map((key) => (
          <div key={key} className={`${panel} p-6`}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-border bg-code text-xl">
              <span aria-hidden="true">{featureIcons[key]}</span>
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              {c.features[key].title}
            </h3>
            <p className="text-[0.95rem] text-muted">{c.features[key].body}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-muted">
        <Rich>{c.featuresNote}</Rich>
      </p>
    </section>
  );
}
