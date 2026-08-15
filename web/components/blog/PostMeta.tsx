import { formatDate, primaryCategory, type BlogPost } from "@/lib/blog";

// The line above every post title — its topic, the day it went up, and how long
// it takes to read. One component, so the card, the featured block and the post
// itself all say it the same way and in the same order.
//
// The topic is text in the deep ember rather than a filled pill: a pill on every
// card in a list is a row of ember blocks competing with the titles, and the
// meta line is a caption, not a control.
export function PostMeta({ post }: { post: BlogPost }) {
  const category = primaryCategory(post);

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
      {category && (
        <>
          <span className="font-semibold text-accent-deep">{category.label}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readMinutes} min read</span>
    </p>
  );
}
