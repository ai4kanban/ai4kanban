// The bare page around the review: signing in, entering the emailed code, an account that was
// not invited, a link that no longer works, or a page that could not load.

import { useState } from "react";
import { FiAlertCircle, FiGithub, FiLink2, FiLock, FiWifiOff } from "react-icons/fi";
import { AuthError, sendCode, signInWithGitHub, signOut, verifyCode } from "../auth";
import { COPY } from "../i18n";
import { Logo } from "./Logo";

const FIELD = "color-mix(in srgb, var(--color-nb-ink) 25%, transparent)";
const PRIMARY =
  "nb-press flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-nb-ink text-[14px] font-[700] disabled:cursor-default disabled:opacity-60 max-md:h-11";
/** Set when a GitHub sign-in came back without finishing, so the page can say so. */
export const SIGN_IN_FAILED = "wildcrane.review.signin-failed";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Frame({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: React.ReactNode; children?: React.ReactNode }) {
  const brand = !icon;
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-nb-cream px-6 py-10 font-sans">
      <div className="nb-panel w-full max-w-[400px] bg-nb-paper p-7 text-center max-md:p-6">
        {icon ?? (
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
        )}
        <h1 className={`${brand ? "mt-6" : "mt-4"} text-[18px] font-[800] text-nb-ink`}>{title}</h1>
        <div className="mt-1.5 text-[13.5px] leading-5 text-nb-ink-soft">{body}</div>
        {children}
      </div>
    </main>
  );
}

const Mark = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-nb-peach-soft text-nb-peach-ink">{children}</div>
);

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-left text-[12.5px] leading-[18px] text-nb-peach-ink">
      {text}
    </p>
  ) : null;
}

const say = (e: unknown) => {
  const c = COPY.signIn;
  if (!(e instanceof AuthError)) return c.failed;
  return { bad_code: c.badCode, rate_limited: c.tooMany, offline: COPY.errors.offline, failed: c.failed }[e.kind];
};

/** Email and a 6-digit code, or GitHub; `back` is where GitHub returns to. */
export function SignIn({ back, title, body }: { back: string; title?: string; body?: string }) {
  const c = COPY.signIn;
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(() => {
    const failed = sessionStorage.getItem(SIGN_IN_FAILED);
    sessionStorage.removeItem(SIGN_IN_FAILED);
    return failed ? c.failed : null;
  });
  const [resent, setResent] = useState(false);

  const send = async (again = false) => {
    const to = email.trim();
    if (!EMAIL.test(to)) return setProblem(c.badEmail);
    setBusy(true);
    setProblem(null);
    try {
      await sendCode(to);
      setStep("code");
      setResent(again);
    } catch (e) {
      setProblem(say(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setProblem(c.badCode);
    setBusy(true);
    setProblem(null);
    try {
      await verifyCode(email.trim(), code);
    } catch (e) {
      setProblem(say(e));
      setBusy(false);
    }
  };

  if (step === "code")
    return (
      <Frame icon={null} title={c.codeTitle} body={c.codeBody(email.trim())}>
        <form
          className="mt-6 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setProblem(null);
            }}
            placeholder={c.codePlaceholder}
            aria-label={c.codePlaceholder}
            className="nb-field flex h-10 w-full rounded-[10px] border bg-nb-paper px-3 text-center font-mono text-[16px] tracking-[0.4em] text-nb-ink placeholder:font-sans placeholder:tracking-normal placeholder:text-nb-ink-soft focus:outline-none max-md:h-11"
            style={{ borderColor: FIELD }}
          />
          <Problem text={problem} />
          <button type="submit" disabled={busy} className={`${PRIMARY} bg-nb-accent text-white`}>
            {busy ? c.verifying : c.submit}
          </button>
          <div className="flex justify-center gap-4 pt-1 text-[13px] font-[600] text-nb-ink-soft">
            <button type="button" disabled={busy} onClick={() => void send(true)} className="cursor-pointer hover:text-nb-ink max-md:min-h-[44px]">
              {resent ? c.resent : c.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setProblem(null);
              }}
              className="cursor-pointer hover:text-nb-ink max-md:min-h-[44px]"
            >
              {c.changeEmail}
            </button>
          </div>
        </form>
      </Frame>
    );

  return (
    <Frame icon={null} title={title ?? c.title} body={body ?? c.body}>
      <form
        className="mt-6 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setProblem(null);
          }}
          placeholder={c.emailPlaceholder}
          aria-label={c.emailPlaceholder}
          className="nb-field flex h-10 w-full rounded-[10px] border bg-nb-paper px-3 text-left text-[14px] text-nb-ink placeholder:text-nb-ink-soft focus:outline-none max-md:h-11 max-md:text-[16px]"
          style={{ borderColor: FIELD }}
        />
        <Problem text={problem} />
        <button type="submit" disabled={busy} className={`${PRIMARY} bg-nb-accent text-white`}>
          {busy ? c.sending : c.sendCode}
        </button>
        <div className="flex items-center gap-3 py-1 text-[12.5px] text-nb-ink-soft">
          <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--color-nb-ink)_12%,transparent)]" />
          {c.or}
          <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--color-nb-ink)_12%,transparent)]" />
        </div>
        <button type="button" onClick={() => void signInWithGitHub(back)} className={`${PRIMARY} bg-nb-paper text-nb-ink`}>
          <FiGithub size={16} aria-hidden />
          {c.github}
        </button>
      </form>
    </Frame>
  );
}

export function NotInvited({ email }: { email: string }) {
  const c = COPY.notInvited;
  return (
    <Frame
      icon={
        <Mark>
          <FiLock size={17} aria-hidden />
        </Mark>
      }
      title={c.title}
      body={c.body(email)}
    >
      <button type="button" onClick={signOut} className={`${PRIMARY} mt-6 bg-nb-paper text-nb-ink`}>
        {c.switch}
      </button>
    </Frame>
  );
}

export function Gone({ title = COPY.gone.title, body = COPY.gone.body }: { title?: string; body?: string }) {
  return (
    <Frame
      icon={
        <Mark>
          <FiLink2 size={18} aria-hidden />
        </Mark>
      }
      title={title}
      body={body}
    />
  );
}

/** A page that did not load: offline, or anything else, with the way to try again. */
export function Failed({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const c = COPY.errors;
  return (
    <Frame
      icon={<Mark>{offline ? <FiWifiOff size={17} aria-hidden /> : <FiAlertCircle size={17} aria-hidden />}</Mark>}
      title={offline ? c.offlineTitle : c.loadFailed}
      body={offline ? c.offlineBody : c.loadFailedBody}
    >
      <button type="button" onClick={onRetry} className={`${PRIMARY} mt-6 bg-nb-paper text-nb-ink`}>
        {c.retry}
      </button>
    </Frame>
  );
}

/** While the page or a sign-in is on its way: the brand alone, quiet. */
export function Loading({ label }: { label?: string }) {
  return (
    <main role="status" aria-busy="true" aria-label={label} className="flex min-h-[100dvh] items-center justify-center bg-nb-cream">
      <span className="a4k-breathe">
        <Logo size="lg" />
      </span>
    </main>
  );
}
