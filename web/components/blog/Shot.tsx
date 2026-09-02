import { Figure } from "./figures/kit";
import { printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import { CDN } from "@/lib/site";
import board from "../../../screenshots/board.png";
import boardChat from "../../../screenshots/board-chat.png";
import cardQuestions from "../../../screenshots/card-questions.png";
import configurationRuntimes from "../../../screenshots/configuration-runtimes.png";
import memory from "../../../screenshots/memory.png";
import runs from "../../../screenshots/runs.png";
import taskGraph from "../../../screenshots/landing-figures/task-graph.png";

const sourceOverrides: Record<string, string> = {
  board: board.src,
  "board-chat": boardChat.src,
  "card-questions": cardQuestions.src,
  "configuration-runtimes": configurationRuntimes.src,
  memory: memory.src,
  runs: runs.src,
  "task-graph": taskGraph.src,
};

// Captures exported from `/shots/` come off that page with the mat and the
// print already on them, so they mount bare — a mat around one of these is a
// second mat.
const matted = new Set(["task-graph"]);

// A capture of the real app, mounted the way `SelfBoardProgress` mounts one and
// the landing page mounts every screenshot: a print on a watercolour mat, no
// frame of its own, nothing drawn on top of the capture.
//
// The rest of `figures/` is drawings, and that is still the rule — a claim about
// how something works is drawn to the site's grammar. This is the exception the
// rule already has: when the claim is *the product does this*, the honest
// picture is the product, and a drawing of it would be a smaller, prettier lie.
//
// Unlike a figure, this takes props, so it is not in the closed set every post
// can write. A page passes it through `BlogMdx`'s `extra`.
//
// Most captures live in the CDN's `shots/` prefix, so a Pages deploy never
// carries them (lib/site.ts). The key is the versioned file name — replacing a
// capture means uploading `-v2` and changing the caller, never overwriting.
// Source overrides keep canonical screenshots that already belong elsewhere in
// the repository in one place.

export function Shot({
  src,
  alt,
  caption,
  wash = "peachEmber",
}: {
  /** Versioned screenshot key; defaults to `<CDN>/shots/<key>.webp`. */
  src: string;
  alt: string;
  caption: string;
  wash?: WashName;
}) {
  const imageSrc = sourceOverrides[src] ?? `${CDN}/shots/${src}.webp`;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageSrc} alt={alt} className="block w-full" loading="lazy" />
  );

  if (matted.has(src)) {
    return (
      <figure>
        {image}
        <figcaption>{caption}</figcaption>
      </figure>
    );
  }

  return (
    <Figure single wash={wash} caption={caption}>
      <div className={`${printFrame} bg-elev`}>{image}</div>
    </Figure>
  );
}
