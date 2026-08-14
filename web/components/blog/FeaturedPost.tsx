import { PostMeta } from "./PostMeta";
import { panel, framed } from "../styles";
import { postPath, type BlogPost } from "@/lib/blog";

// The newest post, at the top of the index. The one framed panel on the page —
// the outline is what says *this one*, and the rows below it are bare, so the
// pair reads as a lead story over a list rather than as two kinds of card.
//
// The cover is optional and most posts won't have one. When there is one it is
// bare inside the card: a raised block is one object, so nothing in it draws a
// second shadow or a second outline.
export function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <a href={postPath(post)} className={`${panel} ${framed} group block p-6 no-underline sm:p-8`}>
      <div
        className={
          post.featuredImage
            ? "grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,42%)]"
            : ""
        }
      >
        <div>
          <PostMeta post={post} />
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-ink transition-colors group-hover:text-accent-deep sm:text-3xl">
            {post.title}
          </h2>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
            {post.excerpt}
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent-deep">
            Read the post
            <span className="transition-transform duration-150 group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </div>

        {post.featuredImage && (
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt}
            className="order-first aspect-[16/10] w-full rounded-lg object-cover sm:order-none"
          />
        )}
      </div>
    </a>
  );
}
