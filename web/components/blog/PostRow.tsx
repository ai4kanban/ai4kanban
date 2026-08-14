import { PostMeta } from "./PostMeta";
import { postPath, type BlogPost } from "@/lib/blog";

// One post in the list under the featured one. A row, not a card: the list is a
// composite, so its parts are bare and what separates them is the 2px ink rule
// the list draws between them — the same rule the comparison tables use.
export function PostRow({ post }: { post: BlogPost }) {
  return (
    <a href={postPath(post)} className="group block py-7 no-underline">
      <PostMeta post={post} />
      <h3 className="mt-2.5 text-xl font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-accent-deep">
        {post.title}
      </h3>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-muted">
        {post.excerpt}
      </p>
    </a>
  );
}
