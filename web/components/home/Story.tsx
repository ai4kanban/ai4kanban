import type { ReactNode } from "react";
import { SectionTitle } from "./SectionTitle";

// A section as words beside a scene. The scene sits on the bare page, no mat; one scene serves
// every locale. The words always lead in reading order; `flip` puts the scene first on wide
// screens. `className` adds to the section, e.g. a tighter top margin under another story.
export function Story({
  title,
  body,
  scene,
  flip = false,
  className = "",
}: {
  title: string;
  body: string[];
  scene: ReactNode;
  flip?: boolean;
  className?: string;
}) {
  return (
    <section className={`mt-28 ${className} grid items-center gap-8 lg:grid-cols-2 lg:gap-14`}>
      <div className={flip ? "lg:col-start-2 lg:row-start-1" : ""}>
        <SectionTitle title={title} />
        {body.map((p) => (
          <p key={p} data-reveal data-delay="1" className="mt-4 text-[1.05rem] leading-[1.75] text-muted">
            {p}
          </p>
        ))}
      </div>
      <div data-reveal className={`px-2 sm:px-6 ${flip ? "lg:col-start-1 lg:row-start-1" : ""}`}>
        {scene}
      </div>
    </section>
  );
}
