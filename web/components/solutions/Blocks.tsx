import type { ReactNode } from "react";
import { FiArrowRight, FiBookOpen, FiDownload, FiTag } from "react-icons/fi";
import { ClosingCta } from "@/components/ClosingCta";
import { printFrame } from "@/components/home/Mat";
import { Button } from "@/components/ui/Button";
import { NearImage } from "@/components/workflows/NearImage";
import { CDN } from "@/lib/site";

// The tags /solutions/saas writes beyond the workflow page's figures.

/** The board view on a band. */
export function Board({ alt }: { alt: string }) {
  return (
    <figure className="rounded-xl bg-band p-3 sm:p-6">
      <div className={`${printFrame} bg-elev`}>
        <NearImage
          src={`${CDN}/ai4kanban-ui-v6-board-view.jpg`}
          alt={alt}
          width={2800}
          height={1720}
          className="block h-auto w-full"
        />
      </div>
    </figure>
  );
}

/** One quiet line naming the plan a feature needs. */
export function Plan({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[0.95rem] text-muted">
      <FiTag aria-hidden="true" className="mt-[0.35em] size-4 shrink-0 text-accent" />
      <span>{children}</span>
    </p>
  );
}

export function Action({ href, label }: { href: string; label: string }) {
  return (
    <p>
      <Button href={href} size="sm" className="mdx-action">
        {label}
        <FiArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </p>
  );
}

/** The closing panel, with the setup guide where GitHub usually sits. */
export function Closing({
  title,
  download,
  downloadHref,
  guide,
  note,
  children,
}: {
  title: string;
  download: string;
  downloadHref: string;
  guide: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <ClosingCta
      className="mdx-block mdx-inset"
      eyebrow="WildCrane for SaaS"
      title={title}
      note={note}
      actions={
        <>
          <Button href={downloadHref} variant="primary" size="sm" className="mdx-action">
            <FiDownload aria-hidden="true" className="size-4" />
            {download}
          </Button>
          <Button href="/docs" size="sm" className="mdx-action">
            <FiBookOpen aria-hidden="true" className="size-4" />
            {guide}
          </Button>
        </>
      }
    >
      {children}
    </ClosingCta>
  );
}
