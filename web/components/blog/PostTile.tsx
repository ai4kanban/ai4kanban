import { PostCover } from "./PostCover";
import { PostMeta } from "./PostMeta";
import { postPath, type BlogPost } from "@/lib/blog";

// One post in the index grid.
export function PostTile({ post }: { post: BlogPost }) {
  return (
    <a href={postPath(post)} className="group block no-underline">
      <PostCover post={post} />
      <div className="mt-4">
        <PostMeta post={post} />
        <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent-deep">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-[0.92rem] leading-relaxed text-muted">
          {post.excerpt}
        </p>
      </div>
    </a>
  );
}
