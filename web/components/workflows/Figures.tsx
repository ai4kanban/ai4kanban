import { LoopVideo } from "@/components/LoopVideo";
import { printFrame } from "@/components/home/Mat";
import { CDN } from "@/lib/site";
import { NearImage } from "./NearImage";

// The blocks a workflow page's MDX writes that Markdown can't: captures of the demo
// board on a band, and the text-versus-draft comparison. MDX props are strings only,
// so a capture is named by its CDN key under `shots/`; the sizes reserve its box.

const SIZES: Record<string, [number, number]> = {
  "coding-draft-v1": [1664, 1248],
  "coding-email-v1": [1582, 1186],
  "coding-preview-desktop-v1": [1584, 1084],
  "coding-preview-phone-v1": [1040, 1378],
  "coding-follow-ups-v1": [2560, 1440],
  "coding-key-points-v1": [1200, 674],
  "coding-questions-v1": [1200, 674],
  "coding-tools-v1": [1200, 674],
};

const band = "rounded-xl bg-band p-3 sm:p-6";

function Capture({ src, alt }: { src: string; alt: string }) {
  const [width, height] = SIZES[src];
  return (
    <div className={`${printFrame} bg-elev`}>
      <NearImage
        src={`${CDN}/shots/${src}.webp`}
        alt={alt}
        width={width}
        height={height}
        className="block h-auto w-full"
      />
    </div>
  );
}

/** One capture, or two side by side from `sm` up. `phone` narrows the second. */
export function Screens({
  src,
  alt,
  src2,
  alt2,
  phone = false,
}: {
  src: string;
  alt: string;
  src2?: string;
  alt2?: string;
  phone?: boolean;
}) {
  const cols = !src2 ? "" : phone ? "sm:grid-cols-[2fr_1fr] sm:items-end" : "sm:grid-cols-2";
  return (
    <figure className={`${band} grid gap-5 ${cols}`}>
      <Capture src={src} alt={alt} />
      {src2 && (
        <div className={phone ? "mx-auto w-3/5 sm:w-full" : ""}>
          <Capture src={src2} alt={alt2 ?? ""} />
        </div>
      )}
    </figure>
  );
}

/** A screen recording, played as a muted loop once it nears the viewport. */
export function Clip({ src, alt }: { src: string; alt: string }) {
  const [width, height] = SIZES[src];
  return (
    <figure className={band}>
      <div className={`${printFrame} bg-elev`}>
        <LoopVideo
          src={`${CDN}/shots/${src}.mp4`}
          poster={`${CDN}/shots/${src.replace(/-v(\d+)$/, "-poster-v$1")}.webp`}
          width={width}
          height={height}
          alt={alt}
          className="block w-full"
        />
      </div>
    </figure>
  );
}

// Pixel blocks for the drawn side: [left %, top %, size px].
const BLOCKS = [
  [4, 8, 22],
  [84, 12, 14],
  [13, 82, 12],
  [82, 76, 24],
  [94, 43, 10],
  [40, 90, 8],
];

/** The same brief twice: as a text description, and as the page it describes. */
export function DraftCompare({
  textLabel,
  designLabel,
  prompt,
  pageTitle,
  pageLead,
  pageButton,
  caption,
}: {
  textLabel: string;
  designLabel: string;
  prompt: string;
  pageTitle: string;
  pageLead: string;
  pageButton: string;
  caption: string;
}) {
  const label = "mb-3 text-sm font-semibold text-muted";
  const panel = "min-h-[250px] rounded-xl border border-ink/15 p-6";
  return (
    <figure className="mdx-block">
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div>
          <p className={label}>{textLabel}</p>
          <div className={`${panel} bg-elev text-base leading-[1.8]`}>{prompt}</div>
        </div>
        <div>
          <p className={label}>{designLabel}</p>
          <div className={`${panel} relative flex items-center justify-center overflow-hidden bg-bg`}>
            {BLOCKS.map(([x, y, size], n) => (
              <span
                key={n}
                aria-hidden="true"
                className="absolute opacity-60"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  background: n % 2 ? "#c9b6ed" : "#ec8253",
                }}
              />
            ))}
            <div className="relative text-center">
              <p className="text-2xl font-bold leading-tight tracking-tight">{pageTitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{pageLead}</p>
              <span className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white">
                {pageButton}
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="!text-left">{caption}</figcaption>
    </figure>
  );
}
