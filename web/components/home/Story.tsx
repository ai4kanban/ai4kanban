import { SectionTitle } from "./SectionTitle";

// A section as words beside a line drawing. The drawing sits on the bare page, no mat; one
// image serves every locale. The words always lead in reading order; `flip` puts the
// drawing first on wide screens.
export function Story({
  title,
  body,
  note,
  art,
  flip = false,
}: {
  title: string;
  body: string[];
  note?: string;
  art: { src: string; alt: string; width: number; height: number; className?: string };
  flip?: boolean;
}) {
  return (
    <section className="mt-28 grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:col-start-2 lg:row-start-1" : ""}>
        <SectionTitle title={title} />
        {body.map((p) => (
          <p key={p} data-reveal data-delay="1" className="mt-4 text-[1.05rem] leading-[1.75] text-muted">
            {p}
          </p>
        ))}
        {note && <p className="mt-6 text-[0.85rem] leading-relaxed text-muted">{note}</p>}
      </div>
      <div data-reveal className={`px-2 sm:px-6 ${flip ? "lg:col-start-1 lg:row-start-1" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.src}
          alt={art.alt}
          width={art.width}
          height={art.height}
          loading="lazy"
          className={`h-auto w-full ${art.className ?? ""}`}
        />
      </div>
    </section>
  );
}
