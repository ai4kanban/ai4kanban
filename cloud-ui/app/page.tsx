import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NoticePage, Page as Frame } from "../components/Frame";
import { readWorkspaces } from "../lib/cloud";
import { getHostedCopy } from "../lib/copy";
import { languageFor } from "../lib/reader";
import { SESSION_COOKIE, SIGNED_OUT, SIGN_IN_FAILED, decodeSession } from "../lib/session";

// `cloud.ai4kanban.dev` itself, so a device holding no link still gets to the board.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));

  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    // Where a sign-out and a sign-in that did not finish land — the two signed-out pages that
    // do not start a sign-in. A browser whose GitHub session is live finishes a consent screen
    // without asking, so sending either one on would hand back the session Sign out just
    // ended, or retry the sign-in that just failed until the browser gave up.
    const asked = await searchParams;
    if (SIGN_IN_FAILED in asked) {
      return (
        <NoticePage copy={copy} signedOut>
          {copy.signInFailed}
        </NoticePage>
      );
    }
    if (SIGNED_OUT in asked) {
      return (
        <NoticePage copy={copy} signedOut>
          {copy.signedOut}
        </NoticePage>
      );
    }
    redirect("/signin?next=%2F");
  }

  const read = await readWorkspaces(session.accessToken);
  if (!read.ok) return <NoticePage copy={copy}>{copy.unavailable}</NoticePage>;

  const workspaces = read.value;
  // One workspace is not a list: the reader came here to open their board, so open it.
  if (workspaces.length === 1) redirect(`/${workspaces[0]!.id}`);
  // None is a plain sentence, never a refusal: an account with nothing to open has not been
  // turned away, and an account we have not admitted to the preview reaches none either.
  if (workspaces.length === 0) return <NoticePage copy={copy}>{copy.noWorkspace}</NoticePage>;

  return (
    <Frame copy={copy}>
      <h1 className="text-[13px] font-[700] uppercase tracking-[0.08em] text-nb-ink-soft">
        {copy.chooseWorkspace}
      </h1>
      <ul className="flex flex-col gap-2">
        {workspaces.map((w) => (
          <li key={w.id}>
            <Link
              href={`/${w.id}`}
              className="nb-panel-sm flex min-h-[48px] items-center px-3 text-[15px] font-[700] text-nb-ink hover:bg-nb-wash"
            >
              {w.name}
            </Link>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
