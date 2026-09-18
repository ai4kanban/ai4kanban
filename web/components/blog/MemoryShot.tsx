import { Figure } from "./figures/kit";
import { printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";
import { ShotMemory } from "@/components/shots/ShotMemory";

// The memory page, mounted the way `Shot` mounts a capture — same mat, same
// print, same caption. It is a drawing rather than a screenshot (#812): the
// claim is how memory is laid out, and a drawing of that stays right when the
// board's chrome moves and can be read at a phone's prose width.
//
// One picture, three pages: `alt` and `caption` come from the page, because the
// point each one makes about it differs.

export function MemoryShot({
  alt,
  caption,
  wash = "mintSky",
}: {
  alt: string;
  caption: string;
  wash?: WashName;
}) {
  return (
    <Figure single wash={wash} caption={caption}>
      {/* One image to a reader with a screen reader: the words inside are the
          drawing's furniture, not the page's text. */}
      <div className={`${printFrame} bg-elev`} role="img" aria-label={alt}>
        <ShotMemory />
      </div>
    </Figure>
  );
}
