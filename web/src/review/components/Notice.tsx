// The bare page around the review: signing in, entering the emailed code, an account that was
// not invited, a link that no longer works, or a page that could not load.

import { useState } from "react";
import { FiAlertCircle, FiGithub, FiLink2, FiLock, FiWifiOff } from "react-icons/fi";
import { AuthError, sendCode, signInWithGitHub, signOut, verifyCode } from "../auth";
import { COPY } from "../i18n";
import { LogoMark } from "./Logo";

const HAIR = "border border-[color-mix(in_srgb,var(--color-nb-ink)_14%,transparent)]";
const BUTTON =
  "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[14.5px] font-[600] tracking-[-0.005em] transition-[background-color,opacity] disabled:cursor-default";
const PRIMARY = `${BUTTON} bg-nb-ink text-nb-cream shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_1px_2px_rgba(36,35,31,0.25)] hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_88%,white)] disabled:opacity-50`;
const SECONDARY = `${BUTTON} ${HAIR} bg-nb-paper text-nb-ink shadow-[0_1px_2px_rgba(36,35,31,0.06)] hover:bg-[color-mix(in_srgb,var(--color-nb-paper)_94%,var(--color-nb-ink))] disabled:opacity-60`;
const LINK = "flex min-h-[32px] cursor-pointer items-center hover:text-nb-ink disabled:cursor-default max-md:min-h-[44px]";
/** Set when a GitHub sign-in came back without finishing, so the page can say so. */
export const SIGN_IN_FAILED = "wildcrane.review.signin-failed";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS = "https://wildcrane.ai/terms";
const PRIVACY = "https://wildcrane.ai/privacy";

/** Cream, a dot grid fading out from the top, and one ember glow behind the crane. */
function Ground({ terms, children }: { terms?: boolean; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-nb-cream font-sans text-nb-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, #24231f 13%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-260px] left-1/2 h-[560px] w-[820px] -translate-x-1/2 rounded-full max-md:top-[-180px] max-md:h-[420px] max-md:w-[520px]"
        style={{ background: "radial-gradient(closest-side, rgba(221,79,30,0.16), rgba(221,79,30,0.05) 55%, transparent)" }}
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-10 max-md:justify-start max-md:pt-[18vh]">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
      {terms && <Terms />}
    </main>
  );
}

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div
    className={`flex size-14 items-center justify-center rounded-[16px] ${HAIR} bg-nb-paper shadow-[0_1px_2px_rgba(36,35,31,0.06),0_8px_24px_-6px_rgba(221,79,30,0.28)]`}
  >
    {children}
  </div>
);

function Head({ icon, title, body }: { icon?: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Tile>{icon ?? <LogoMark className="h-[30px] w-[32.3px]" />}</Tile>
      <h1 className="mt-7 text-[26px] leading-8 font-[650] tracking-[-0.02em] max-md:text-[24px]">{title}</h1>
      <div className="mt-2 text-[14.5px] leading-[22px] text-nb-ink-soft">{body}</div>
    </div>
  );
}

function Frame({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Ground>
      <Head icon={icon} title={title} body={body} />
      {children && <div className="mt-9">{children}</div>}
    </Ground>
  );
}

function Terms() {
  const [lead, terms, and, privacy, end] = COPY.signIn.terms;
  const link =
    "text-nb-ink-soft underline decoration-[color-mix(in_srgb,var(--color-nb-ink)_30%,transparent)] underline-offset-2 hover:text-nb-ink";
  return (
    <p className="relative px-6 pb-8 text-center text-[12.5px] leading-5 text-[color-mix(in_srgb,var(--color-nb-ink-soft)_85%,transparent)]">
      {lead}{" "}
      <a href={TERMS} target="_blank" rel="noopener noreferrer" className={link}>
        {terms}
      </a>{" "}
      {and}{" "}
      <a href={PRIVACY} target="_blank" rel="noopener noreferrer" className={link}>
        {privacy}
      </a>
      {end}
    </p>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-left text-[13px] leading-[19px] text-nb-accent-deep">
      {text}
    </p>
  ) : null;
}

/** Six boxes over one real input, so paste and one-time-code autofill still work. */
function CodeBoxes({ code, wrong, onChange }: { code: string; wrong: boolean; onChange: (code: string) => void }) {
  const [focused, setFocused] = useState(true);
  const box = wrong ? "border-[1.5px] border-nb-accent bg-nb-accent-wash" : `${HAIR} bg-nb-paper`;
  return (
    <div className="relative">
      <div aria-hidden className="flex justify-between gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const caret = focused && !wrong && i === code.length;
          return (
            <div
              key={i}
              className={`flex h-[54px] flex-1 items-center justify-center rounded-[10px] font-mono text-[22px] font-[600] shadow-[0_1px_2px_rgba(36,35,31,0.05)] ${box} ${caret ? "!border-[1.5px] !border-nb-ink" : ""}`}
            >
              {code[i] ?? (caret ? <span className="a4k-caret h-6 w-px bg-nb-ink" /> : null)}
            </div>
          );
        })}
      </div>
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label={COPY.signIn.codePlaceholder}
        aria-invalid={wrong}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 focus:outline-none"
      />
    </div>
  );
}

const say = (e: unknown) => {
  const c = COPY.signIn;
  if (!(e instanceof AuthError)) return c.failed;
  return { bad_code: c.badCode, rate_limited: c.tooMany, offline: COPY.errors.offline, failed: c.failed }[e.kind];
};

/** GitHub, or email and a 6-digit code; `back` is where GitHub returns to, `onLeave` gives up on signing in. */
export function SignIn({ back, title, body, onLeave }: { back: string; title?: string; body?: string; onLeave?: () => void }) {
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
      <Ground terms>
        <Head
          title={c.codeTitle}
          body={
            <>
              {c.codeSent[0]}
              <span className="font-[600] text-nb-ink">{email.trim()}</span>
              {c.codeSent[1]}
            </>
          }
        />
        <form
          className="mt-9 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <CodeBoxes
            code={code}
            wrong={!!problem}
            onChange={(next) => {
              setCode(next);
              setProblem(null);
            }}
          />
          <Problem text={problem} />
          <div className="pt-1">
            <button type="submit" disabled={busy || code.length < 6} className={PRIMARY}>
              {busy ? c.verifying : c.submit}
            </button>
          </div>
          <div className="flex justify-center gap-5 pt-2 text-[13.5px] font-[550] text-nb-ink-soft">
            <button type="button" disabled={busy} onClick={() => void send(true)} className={LINK}>
              {resent ? c.resent : c.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setProblem(null);
              }}
              className={LINK}
            >
              {c.changeEmail}
            </button>
          </div>
        </form>
      </Ground>
    );

  return (
    <Ground terms>
      <Head title={title ?? c.title} body={body ?? c.body} />
      <form
        className="mt-9 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <button type="button" onClick={() => void signInWithGitHub(back)} className={PRIMARY}>
          <FiGithub size={17} aria-hidden />
          {c.github}
        </button>
        <div className="flex items-center gap-3 py-1.5 text-[12.5px] text-nb-ink-soft">
          <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]" />
          {c.or}
          <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)]" />
        </div>
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
          aria-invalid={!!problem}
          className={`h-11 w-full rounded-[10px] ${HAIR} bg-nb-paper px-3.5 text-[15px] text-nb-ink shadow-[0_1px_2px_rgba(36,35,31,0.04)_inset] transition-[border-color,box-shadow] placeholder:text-[color-mix(in_srgb,var(--color-nb-ink-soft)_70%,transparent)] focus:border-nb-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-nb-ink)_8%,transparent)] focus:outline-none max-md:text-[16px]`}
        />
        <Problem text={problem} />
        <button type="submit" disabled={busy} className={SECONDARY}>
          {busy ? c.sending : c.sendCode}
        </button>
        {onLeave && (
          <div className="flex justify-center pt-2 text-[13.5px] font-[550] text-nb-ink-soft">
            <button type="button" onClick={onLeave} className={LINK}>
              {c.fromLink.back}
            </button>
          </div>
        )}
      </form>
    </Ground>
  );
}

export function NotInvited({ email }: { email: string }) {
  const c = COPY.notInvited;
  return (
    <Frame icon={<FiLock size={22} aria-hidden className="text-nb-ink" />} title={c.title} body={c.body(email)}>
      <button type="button" onClick={signOut} className={SECONDARY}>
        {c.switch}
      </button>
    </Frame>
  );
}

export function Gone({ title = COPY.gone.title, body = COPY.gone.body }: { title?: string; body?: string }) {
  return <Frame icon={<FiLink2 size={22} aria-hidden className="text-nb-ink" />} title={title} body={body} />;
}

/** A page that did not load: offline, or anything else, with the way to try again. */
export function Failed({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const c = COPY.errors;
  const Icon = offline ? FiWifiOff : FiAlertCircle;
  return (
    <Frame icon={<Icon size={22} aria-hidden className="text-nb-ink" />} title={offline ? c.offlineTitle : c.loadFailed} body={offline ? c.offlineBody : c.loadFailedBody}>
      <button type="button" onClick={onRetry} className={SECONDARY}>
        {c.retry}
      </button>
    </Frame>
  );
}

/** While the page or a sign-in is on its way: the crane alone, quiet. */
export function Loading({ label }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Ground>
        <div className="flex justify-center">
          <span className="a4k-breathe">
            <Tile>
              <LogoMark className="h-[30px] w-[32.3px]" />
            </Tile>
          </span>
        </div>
      </Ground>
    </div>
  );
}
