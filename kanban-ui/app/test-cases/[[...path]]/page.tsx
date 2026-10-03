import { notFound } from "next/navigation";
import { NoBoard, NoRules } from "@/components/NoBoard";
import { TestCasesPage, type TestCasesView } from "@/components/TestCases";
import { agentInfo, NO_AGENT } from "@/lib/agent";
import { readBoard } from "@/lib/board";
import { isDesktop } from "@/lib/desktop";
import { boardSearchStart, findRepoRoot, repoRoot } from "@/lib/paths";
import { moduleOrder, qaRoot } from "@/lib/qa";
import { listCases, readCase } from "@/lib/test-cases";
import type { Board } from "@/lib/types";

// The project's test cases (#1422): `/test-cases` for the modules, `/test-cases/<module>` for
// one module's cases and `/test-cases/<module>/<case>` for one case. A project with no module
// folders drops the middle step. Re-read on every request.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  if (!findRepoRoot()) return <NoBoard searchedFrom={boardSearchStart()} desktop={isDesktop()} />;

  let board: Board;
  try {
    board = await readBoard();
  } catch (e) {
    return <NoRules why={e instanceof Error ? e.message : String(e)} desktop={isDesktop()} />;
  }

  const root = qaRoot();
  const list = listCases(root, moduleOrder());
  if (!list) notFound();
  const segments = ((await params).path ?? []).map((s) => decodeURIComponent(s));
  const depth = list.flat ? 1 : 2;

  let view: TestCasesView | null = null;
  if (segments.length === 0) {
    view = list.flat ? { kind: "module", list, module: list.modules[0]! } : { kind: "modules", list };
  } else if (segments.length === 1 && !list.flat) {
    const picked = list.modules.find((m) => m.name === segments[0]);
    if (picked) view = { kind: "module", list, module: picked };
  } else if (segments.length === depth) {
    const file = readCase(root, segments);
    if (file) view = { kind: "case", list, file };
  }
  if (!view) notFound();

  const agent = await agentInfo().catch(() => NO_AGENT);
  return (
    <TestCasesPage
      view={view}
      openIds={board.openIds}
      agent={agent}
      projectRoot={repoRoot()}
      memoryOwners={board.memoryOwners}
      desktop={isDesktop()}
    />
  );
}
