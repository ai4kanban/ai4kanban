import { PostCover } from "./PostCover";
import { PostMeta } from "./PostMeta";
import { postPath, type BlogPost } from "@/lib/blog";

// The newest post, bare on the page: cover on the column's left edge, text
// ending on its right edge, so both line up with the header.
export function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <a
      href={postPath(post)}
      className="group grid items-center gap-6 no-underline sm:grid-cols-[minmax(0,58%)_minmax(0,1fr)] sm:gap-10"
    >
      <PostCover post={post} />
      <div>
        <PostMeta post={post} />
        <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-ink transition-colors group-hover:text-accent-deep sm:text-[2rem]">
          {post.title}
        </h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
          {post.excerpt}
        </p>
      </div>
    </a>
  );
}
