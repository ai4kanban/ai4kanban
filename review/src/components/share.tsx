// The owner's Share button and the panel it opens, in legacy ui/popover.tsx's POPUP_PANEL and
// POPUP_ROW. One link per task: copy it, pick who can open it, revoke it. The people
// invited belong to the task (#2027): every link of it admits them, to comment, so a row has no
// permission, only a remove. Revoking asks in the panel's own footer.

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiCopy, FiGlobe, FiLock, FiShare2, FiX } from "react-icons/fi";
import { addGuest, createLink, removeGuest, revokeLink, updateLink, type Guest, type Link } from "../api";
import { LANG, type Copy } from "../i18n";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Avatar } from "./chat";
import { HAIRLINE, QUIET } from "./chrome";
import { useCopyText } from "./copy";
import { Menu, POPUP_PANEL } from "./menu";

const CAP = "text-[11px] font-[700] text-nb-ink-soft";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A link's token is its last path segment, on the review page and in WildCrane Web alike. */
const tokenOf = (url: string) => decodeURIComponent(new URL(url, location.origin).pathname.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "") || null;

/** `quiet`: borderless, as in the card page's title row. */
export function ShareButton({ label, open, onClick, quiet }: { label: string; open?: boolean; onClick: () => void; quiet?: boolean }) {
  const inner = (
    <>
      <FiShare2 className="text-[13px]" aria-hidden />
      <span className="max-md:hidden">{label}</span>
    </>
  );
  const lit = open ? { background: "var(--color-nb-accent-soft)" } : undefined;
  return quiet ? (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={label} title={label} className={cn(QUIET, "max-md:w-7 max-md:px-0")} style={lit}>
      {inner}
    </button>
  ) : (
    <Button variant="ghost" size="xs" onClick={onClick} aria-expanded={open} aria-label={label} className="max-md:h-9 max-md:w-9 max-md:px-0" style={lit}>
      {inner}
    </Button>
  );
}

/** The button and its panel; the panel closes on Esc or a click outside. */
type PanelProps = {
  c: Copy["share"];
  link: Link;
  task: string;
  guests: Guest[];
  expires: string;
  onChanged: () => void;
  /** The link's address; this page's own when left out. */
  url?: string;
  /** A new link replaced a revoked one; this page goes to it when left out. */
  onRenewed?: (link: Link & { url: string }) => void;
};

export function Share(props: PanelProps) {
  const { c } = props;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <ShareButton label={c.button} open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[60] max-md:fixed max-md:inset-x-3 max-md:top-14">
          <SharePanel {...props} />
        </div>
      )}
    </div>
  );
}

export function SharePanel({ c, link: initial, task, guests, expires, onChanged, url: address, onRenewed }: PanelProps) {
  const [link, setLink] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const { copied, copy } = useCopyText();
  const [emails, setEmails] = useState(() => guests.map((g) => g.email));
  const [unsent, setUnsent] = useState<string | null>(null);
  const url = address ?? location.href.replace(/[?#].*$/, "");

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    setUnsent(null);
    try {
      await work();
    } catch {
      setProblem(c.failed);
    } finally {
      setBusy(false);
    }
  };
  const save = (access: Link["access"]) =>
    run(async () => {
      const next = await updateLink(link.id, { access });
      setLink((l) => ({ ...l, ...next }));
      onChanged();
    });
  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL.test(email)) return setProblem(c.badEmail);
    setDraft("");
    if (emails.includes(email)) return;
    void run(async () => {
      const { mail } = await addGuest(task, email, { share_token: tokenOf(url), lang: LANG });
      setEmails((list) => [...list, email]);
      if (mail === "failed") setUnsent(email);
      onChanged();
    });
  };
  const remove = (email: string) =>
    run(async () => {
      await removeGuest(task, email);
      setEmails((list) => list.filter((e) => e !== email));
      onChanged();
    });

  if (revoked) {
    return (
      <div className={cn(POPUP_PANEL, "w-[360px] p-4 max-md:w-auto")}>
        <p className="text-[13px] font-[700]">{c.revokedTitle}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-nb-ink-soft">{c.revokedBody}</p>
        <Button
          size="xs"
          className="mt-3"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const next = await createLink(task, { access: link.access });
              if (onRenewed) onRenewed(next);
              else location.assign(new URL(next.url, location.origin).pathname);
            })
          }
        >
          {c.renew}
        </Button>
        {problem && <p className="mt-2 text-[12px] text-nb-peach-ink">{problem}</p>}
      </div>
    );
  }
  const anyone = link.access === "link";
  return (
    <div className={cn(POPUP_PANEL, "flex w-[360px] flex-col max-md:w-auto")} aria-busy={busy || undefined}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-[8px] bg-nb-wash px-2.5 py-1.5 font-mono text-[12px] text-nb-ink-soft">{url.replace(/^https?:\/\//, "")}</span>
          <Button size="xs" onClick={() => copy(url)}>
            {copied ? <FiCheck className="text-[13px]" aria-hidden /> : <FiCopy className="text-[13px]" aria-hidden />}
            {copied ? c.copied : c.copy}
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={CAP}>{c.access}</span>
          <Menu
            trigger={({ open, onClick }) => (
              <button
                type="button"
                onClick={onClick}
                aria-expanded={open}
                disabled={busy}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[8px] border-[1.5px] border-nb-ink/15 px-2.5 py-1.5 text-left text-[13px] font-[600] hover:bg-nb-wash"
              >
                {anyone ? <FiGlobe className="text-[13px]" aria-hidden /> : <FiLock className="text-[13px]" aria-hidden />}
                <span className="flex-1">{anyone ? c.link : c.invited}</span>
                <FiChevronDown className="text-[13px] text-nb-ink-soft" aria-hidden />
              </button>
            )}
            items={(["invited", "link"] as const).map((access) => ({
              key: access,
              className: "justify-between",
              onSelect: () => {
                if (access !== link.access) void save(access);
              },
              body: (
                <>
                  <span className="inline-flex items-center gap-2">
                    {access === "link" ? <FiGlobe size={13} aria-hidden /> : <FiLock size={13} aria-hidden />}
                    {access === "link" ? c.link : c.invited}
                  </span>
                  {access === link.access && <FiCheck size={12} aria-hidden />}
                </>
              ),
            }))}
          />
          {anyone && <p className="text-[12px] leading-relaxed text-nb-peach-ink">{c.linkHint}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={CAP}>{c.emails}</span>
          <input
            type="email"
            value={draft}
            disabled={busy}
            onChange={(e) => {
              setDraft(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={c.addEmail}
            aria-label={c.emails}
            className="nb-field rounded-[8px] border-[1.5px] border-nb-ink/15 px-2.5 py-1.5 text-[13px] placeholder:text-nb-ink-soft/70 focus:outline-none max-md:text-[16px]"
          />
          {emails.length > 0 && (
            <ul className="flex flex-col">
              {emails.map((email) => (
                <li key={email} className="group flex items-center gap-2 rounded-[7px] px-1 py-1.5 hover:bg-nb-wash">
                  <Avatar who={email} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{email}</span>
                  <button
                    type="button"
                    onClick={() => remove(email)}
                    disabled={busy}
                    aria-label={`${c.remove} ${email}`}
                    title={c.remove}
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-nb-ink-soft opacity-0 hover:bg-nb-ink/[0.06] hover:text-nb-ink focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                  >
                    <FiX className="text-[13px]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] leading-relaxed text-nb-ink-soft">{c.peopleHint}</p>
        </div>
        {problem && <p className="-mt-2 text-[12px] text-nb-peach-ink">{problem}</p>}
        {unsent && !problem && <p className="-mt-2 text-[12px] leading-relaxed text-nb-peach-ink">{c.mailFailed(unsent)}</p>}
      </div>

      <div className="flex min-h-[48px] items-center gap-2 border-t px-4 py-2.5" style={{ borderColor: HAIRLINE }}>
        {confirm ? (
          <>
            <span className="flex-1 text-[12px] leading-snug text-nb-ink">{c.confirmBody}</span>
            <Button variant="ghost" size="xs" onClick={() => setConfirm(false)}>
              {c.cancel}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              style={{ color: "var(--color-nb-accent-deep)", borderColor: "var(--color-nb-accent-deep)" }}
              onClick={() =>
                run(async () => {
                  await revokeLink(link.id);
                  setRevoked(true);
                })
              }
            >
              {c.revoke}
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-[12px] text-nb-ink-soft">{c.expires(expires)}</span>
            <button type="button" onClick={() => setConfirm(true)} className="cursor-pointer rounded-[6px] px-1.5 py-1 text-[12px] font-[700] text-nb-accent-deep hover:bg-nb-accent-soft/60">
              {c.revoke}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
