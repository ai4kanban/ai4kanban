// Each built-in workflow's icon, by id; everything else gets FiLayout. Add a new built-in here.

import { FiCode, FiCopy, FiFileText, FiFilm, FiLayout, FiMonitor, FiShare2 } from "react-icons/fi";
import type { IconBaseProps, IconType } from "react-icons";

const ICONS: Record<string, IconType> = {
  wf_builtin_coding: FiCode,
  wf_builtin_hyperframes_video: FiFilm,
  wf_builtin_carousel_post: FiShare2,
  wf_builtin_blog_post: FiFileText,
  wf_builtin_slide_deck: FiMonitor,
  wf_builtin_video_clone: FiCopy,
};

export function workflowIcon(id: string | undefined, props: IconBaseProps) {
  const Icon = (id && ICONS[id]) || FiLayout;
  return <Icon aria-hidden {...props} />;
}
