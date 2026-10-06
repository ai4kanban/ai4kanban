import * as covers from "./covers";
import type { BlogPost } from "@/lib/blog";

// A post's 16:10 cover: its image, its drawn cover, or — with neither — the
// logo's three columns, faint on the wash, so a coverless post never looks
// broken next to one that has a cover.
export function PostCover({ post }: { post: BlogPost }) {
  const frame = "aspect-[16/10] w-full overflow-hidden rounded-xl";
  if (post.featuredImage) {
    return (
      <img
        src={post.featuredImage}
        alt={post.featuredImageAlt ?? ""}
        loading="lazy"
        className={`${frame} object-cover`}
      />
    );
  }
  const Cover = post.featuredCover
    ? covers[post.featuredCover as keyof typeof covers]
    : undefined;
  if (Cover) {
    return (
      <div className={frame}>
        <Cover alt={post.featuredImageAlt ?? ""} />
      </div>
    );
  }
  return (
    <div className={`${frame} flex items-center justify-center bg-code`}>
      <svg viewBox="0 0 60 60" className="h-16 w-16 opacity-15" aria-hidden="true">
        <rect x={5} y={8} width={12} height={44} rx={3} className="fill-ink" />
        <rect x={24} y={8} width={12} height={35} rx={3} className="fill-ink" />
        <rect x={43} y={8} width={12} height={26} rx={3} className="fill-ink" />
      </svg>
    </div>
  );
}
