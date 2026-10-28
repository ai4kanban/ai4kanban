import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ApiError, readShared, type Shared } from "./api";
import { finishGitHub, onSession, pendingGitHubBack, readSession, signOut } from "./auth";
import { CardPage } from "./components/CardPage";
import { Failed, Gone, Loading, NotInvited, SIGN_IN_FAILED, SignIn } from "./components/Notice";
import { COPY, LANG } from "./i18n";
import "./globals.css";
import "./markdown.css";

const POLL_MS = 20_000;

type State =
  | { kind: "loading" }
  | { kind: "ok"; shared: Shared }
  | { kind: "sign-in" }
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

function Review({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const shown = useRef(false);

  const load = useCallback(async () => {
    try {
      const shared = await readShared(token);
      shown.current = true;
      setState({ kind: "ok", shared });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "error";
      // A poll that fails keeps the page; the next one tries again.
      if (shown.current && (code === "offline" || code === "error" || (e instanceof ApiError && e.status >= 500))) return;
      shown.current = false;
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
      return <CardPage shared={state.shared} token={token} reload={load} />;
    case "sign-in":
      return <SignIn back={location.pathname} />;
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

/** `/auth/callback`: finish the GitHub sign-in, then back to the link it started from. */
let finishing: Promise<void> | null = null;

function Callback() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const back = pendingGitHubBack() ?? "/";
    finishing ??= finishGitHub().then(
      (to) => location.replace(to),
      () => {
        sessionStorage.setItem(SIGN_IN_FAILED, "1");
        history.replaceState(null, "", back);
        throw new Error("sign-in failed");
      },
    );
    finishing.catch(() => setFailed(true));
  }, []);
  return failed ? <App /> : <Loading label={COPY.signIn.signingIn} />;
}

function App() {
  const path = location.pathname;
  if (path === "/auth/callback") return <Callback />;
  const token = decodeURIComponent(path.replace(/^\/+|\/+$/g, ""));
  if (!token || token.includes("/")) return <Gone title={COPY.noLink.title} body={COPY.noLink.body} />;
  return <Review key={token} token={token} />;
}

document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
