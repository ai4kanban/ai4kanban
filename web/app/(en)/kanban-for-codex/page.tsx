import type { Metadata } from "next";
import {
  DESCRIPTION,
  KanbanForCodexPage,
  PATH,
  TITLE,
} from "@/components/kanban-for-codex/KanbanForCodexPage";
import { pageMetadata } from "@/lib/metadata";
import "../../blog-prose.css";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  translated: false,
});

export default function Page() {
  return <KanbanForCodexPage />;
}
