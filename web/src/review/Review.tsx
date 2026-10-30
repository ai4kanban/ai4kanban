// The review page at `/s/<token>`: read only by the link, comments for an invited guest. A
// workspace member goes to the task page instead.

import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "../router";
import { ApiError, readShared, type Shared } from "./api";
import { onSession, readSession, signOut } from "./auth";
import { CardPage } from "./components/CardPage";
import { Failed, Gone, Loading, NotInvited, SIGN_IN_FAILED, SignIn } from "./components/Notice";
import { COPY } from "./i18n";

const POLL_MS = 20_000;

type State =
  | { kind: "loading" }
  | { kind: "ok"; shared: Shared }
  | { kind: "sign-in" }
  | { kind: "sign-in-from-link"; shared: Shared }
  | { kind: "not-invited"; email: string }
  | { kind: "gone" }
  | { kind: "failed"; offline: boolean };

/** The signed-in email, from the session or its token. */
function signedInEmail(): string {
  const s = readSession();
  if (s?.email) return s.email;
  try {
    return (JSON.parse(atob(s!.access_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string }).email ?? "";
  } catch {
    return "";
  }
}

export function Review({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const shown = useRef(false);

  const load = useCallback(async () => {
    try {
      const shared = await readShared(token);
      if (shared.role === "owner" || shared.role === "member") return navigate(`/tasks/${encodeURIComponent(shared.task.id)}`, true);
      const failed = !shared.me && sessionStorage.getItem(SIGN_IN_FAILED) !== null;
      // A read from before signing in must not close the sign-in page that overtook it.
      setState((s) => (!shared.me && (failed || s.kind === "sign-in-from-link") ? { kind: "sign-in-from-link", shared } : { kind: "ok", shared }));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "error";
      // A poll that fails keeps the page; the next one tries again.
      if (shown.current && (code === "offline" || code === "error" || (e instanceof ApiError && e.status >= 500))) return;
      if (code === "link_invalid" || code === "link_expired" || code === "link_revoked" || code === "not_found") setState({ kind: "gone" });
      else if (code === "sign_in_required") setState({ kind: "sign-in" });
      else if (code === "unauthenticated") {
        signOut();
        setState({ kind: "sign-in" });
      } else if (code === "not_invited") setState({ kind: "not-invited", email: signedInEmail() });
      else setState({ kind: "failed", offline: code === "offline" });
    }
  }, [token]);

  useEffect(() => {
    void load();
    return onSession(() => void load());
  }, [load]);

  useEffect(() => {
    shown.current = state.kind === "ok";
    if (state.kind !== "ok") return;
    const tick = () => document.visibilityState === "visible" && void load();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [state.kind, load]);

  useEffect(() => {
    document.title = state.kind === "ok" ? `${state.shared.task.title} · WildCrane` : "WildCrane";
  }, [state]);

  switch (state.kind) {
    case "loading":
      return <Loading />;
    case "ok":
      return <CardPage shared={state.shared} token={token} reload={load} onSignIn={() => setState({ kind: "sign-in-from-link", shared: state.shared })} />;
    case "sign-in":
      return <SignIn back={location.pathname} />;
    case "sign-in-from-link":
      return <SignIn back={location.pathname} title={COPY.signIn.fromLink.title} body={COPY.signIn.fromLink.body} onLeave={() => setState({ kind: "ok", shared: state.shared })} />;
    case "not-invited":
      return <NotInvited email={state.email} />;
    case "gone":
      return <Gone />;
    case "failed":
      return (
        <Failed
          offline={state.offline}
          onRetry={() => {
            setState({ kind: "loading" });
            void load();
          }}
        />
      );
  }
}
