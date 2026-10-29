// The WildCrane Web app at app.wildcrane.ai: sign in first (review/'s flow), then the boards.

import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FiAlertCircle } from "react-icons/fi";
import { finishGitHub, onSession, pendingGitHubBack, readSession, signOut } from "@review/auth";
import { Failed, Loading, SIGN_IN_FAILED, SignIn } from "@review/components/Notice";
import { Logo } from "@review/components/Logo";
import * as api from "./api";
import { forgetAll } from "./lib/chat-images";
import { LANG, T } from "./i18n";
import { navigate, useLocation } from "./router";
import { StoreProvider, useStore } from "./store";
import { AlertsProvider } from "./alerts";
import { SettingsHost } from "./components/Settings";
import { FirstRun } from "./components/Welcome";
import { Archive } from "./pages/Archive";
import { Board } from "./pages/Board";
import { CardPage } from "./pages/CardPage";
import { DiscussionPage } from "./pages/Discussion";
import { Home } from "./pages/Home";
import { NewIdea } from "./pages/NewIdea";
import { ProjectSettings, WorkspaceSettings } from "./pages/Settings";
import { Stats } from "./pages/Stats";
import { TriagePage } from "./pages/Triage";
import { Workflows } from "./pages/Workflows";
import "./globals.css";
import "@review/markdown.css";

function Routes() {
  const { path } = useLocation();
  const task = /^\/tasks\/([^/]+)\/?$/.exec(path);
  const project = /^\/projects\/([^/]+)\/?$/.exec(path);
  const triage = /^\/projects\/([^/]+)\/triage\/?$/.exec(path);
  const settings = /^\/projects\/([^/]+)\/settings\/?$/.exec(path);
  const discussion = /^\/discussions\/([^/]+)\/?$/.exec(path);
  if (task) return <CardPage key={task[1]} taskKey={decodeURIComponent(task[1]!)} />;
  if (discussion) return <DiscussionPage key={discussion[1]} id={decodeURIComponent(discussion[1]!)} />;
  if (project) return <Board key={project[1]} projectId={decodeURIComponent(project[1]!)} />;
  if (triage) return <TriagePage key={triage[1]} projectId={decodeURIComponent(triage[1]!)} />;
  if (settings) return <ProjectSettings projectId={decodeURIComponent(settings[1]!)} />;
  if (path === "/new") return <NewIdea />;
  if (path === "/archive") return <Archive />;
  if (path === "/settings/workspace") return <WorkspaceSettings />;
  if (path === "/workflows") return <Workflows />;
  if (path === "/stats") return <Stats />;
  if (path === "/triage") return <OldTriage />;
  return <Home />;
}

/** `/triage` was workspace-wide; bookmarks of it land on the current project's. */
function OldTriage() {
  const store = useStore();
  const to = store.current ? `/projects/${encodeURIComponent(store.current.id)}/triage` : store.tasks ? "/" : null;
  useEffect(() => {
    if (to) navigate(to, true);
  }, [to]);
  return null;
}

type Boot = { kind: "loading" } | { kind: "sign-in" } | { kind: "refused" } | { kind: "failed"; offline: boolean } | { kind: "ok"; me: api.Me; workspaces: api.Workspace[] };

function App() {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const start = useCallback(async () => {
    if (!readSession()) {
      void forgetAll();
      return setBoot({ kind: "sign-in" });
    }
    try {
      const me = await api.readMe();
      if (!me.admitted) return setBoot({ kind: "refused" });
      const workspaces = await api.listWorkspaces();
      setBoot({ kind: "ok", me, workspaces });
    } catch (e) {
      const code = e instanceof api.ApiError ? e.code : "";
      if (code === "unauthenticated") {
        signOut();
        setBoot({ kind: "sign-in" });
      } else if (code === "not_admitted") setBoot({ kind: "refused" });
      else setBoot({ kind: "failed", offline: code === "offline" });
    }
  }, []);
  useEffect(() => {
    void start();
    return onSession(() => void start());
  }, [start]);

  switch (boot.kind) {
    case "loading":
      return <Loading />;
    case "sign-in":
      return <SignIn back={location.pathname + location.search} title={T.signIn.title} body={T.signIn.body} />;
    case "refused":
      return <Refused />;
    case "failed":
      return (
        <Failed
          offline={boot.offline}
          onRetry={() => {
            setBoot({ kind: "loading" });
            void start();
          }}
        />
      );
    case "ok":
      return (
        <StoreProvider key={boot.me.accountId} me={boot.me} workspaces={boot.workspaces}>
          <FirstRun account={boot.me.accountId}>
            <AlertsProvider>
              <SettingsHost />
              <Routes />
            </AlertsProvider>
          </FirstRun>
        </StoreProvider>
      );
  }
}

function Refused() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-nb-cream px-6 font-sans">
      <div className="nb-panel w-full max-w-[400px] bg-nb-paper p-7 text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-[14px] font-[700] text-nb-ink">
          <FiAlertCircle size={15} aria-hidden />
          {T.errors.notAdmitted}
        </p>
        <button type="button" onClick={signOut} className="nb-press mt-6 flex h-10 w-full cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper text-[14px] font-[700]">
          {T.errors.switchAccount}
        </button>
      </div>
    </main>
  );
}

/** `/auth/callback`: finish the GitHub sign-in, then back to where it started. */
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
  return failed ? <App /> : <Loading />;
}

document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";

createRoot(document.getElementById("root")!).render(<StrictMode>{location.pathname === "/auth/callback" ? <Callback /> : <App />}</StrictMode>);
