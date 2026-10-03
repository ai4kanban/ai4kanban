import { qaRoot } from "@/lib/qa";
import { serveCaseFile } from "@/lib/test-cases";

// One image or text file from a test case's folder (#1422). Only `docs/qa/` is served; a path
// that climbs out of it is no such file.

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    return serveCaseFile(qaRoot(), path.map((s) => decodeURIComponent(s)));
  } catch {
    return new Response(null, { status: 404 });
  }
}
