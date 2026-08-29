import type { ReactNode } from "react";
import { Band } from "@/components/Band";
import { Header } from "@/components/Header";
import { SectionHeading } from "@/components/SectionHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { Chip } from "@/components/ui/Chip";
import {
  column,
  heroTop,
  panelBare,
  panelBareInset,
} from "@/components/styles";
import { getCopy } from "@/i18n";
import { jsonLd, webPage } from "@/lib/schema";

// What AI4Kanban Cloud is, on a page of its own (#349).
//
// Cloud used to be named on this site only by the privacy and terms pages, so
// the first invited person learned what they had been given from a data policy
// and a contract. This page is the product description those two now point at.
//
// English-only, like the legal pages and the blog — so its words live here
// rather than in `i18n/cloud/`, and the route carries `translated: false`, no
// `TRANSLATED_PATHS` entry, and a hand-written line in `app/sitemap.ts`.
//
// Every sentence describes the 0.8.0 relay (#325) and the app's own sign-in
// pane, not the team workspace the live legal pages still describe — agreeing
// with those would put the same wrong product on a third page. It is short and
// plain on purpose: a later release rewrites it as Cloud's landing page.

export const PATH = "/cloud";

export const TITLE =
  "AI4Kanban Cloud — decide from your desktop, Slack or Lark, run on your own machine";

export const DESCRIPTION =
  "Cloud carries a board's requests for judgment to the desktop notification center and to Slack and Lark, and hands your decision back to your own machine to run. The board, the repository and the agent never leave it. An invite-only preview.";

export const SOCIAL =
  "A card ready for review, a question only you can answer — Cloud brings both to your desktop and to Slack or Lark. Your own machine still does the work.";

const schema = jsonLd(webPage(PATH, TITLE, DESCRIPTION));

const c = getCopy("en");

const linkClass = "text-accent-deep no-underline hover:underline";

/** A word the board uses, quoted as the board writes it. Wash on paper — never
 *  put one inside a wash tile, where it has nothing to sit against. */
function Term({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap rounded bg-code px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
      {children}
    </code>
  );
}

/** A list line: a bold lead, then the rest of it. */
function Point({ lead, children }: { lead: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>
        <span className="font-semibold text-ink">{lead}</span>
        {children ? <span className="text-muted"> — {children}</span> : null}
      </span>
    </li>
  );
}

/** One leg of the relay. Wash on the white page, so it is a tile and not a card. */
function Step({
  num,
  where,
  children,
}: {
  num: string;
  where: string;
  children: ReactNode;
}) {
  return (
    <div className={`${panelBareInset} p-5`}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
        {num} · {where}
      </p>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function CloudPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" />
      <main>
        {/* ── What it does, in one screen ─────────────────────────────────── */}
        <div className={column}>
          <section className={heroTop}>
            <Chip tone="solid">Invite-only preview</Chip>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              Answer your board from anywhere.
            </h1>
            <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
              AI4Kanban runs on your machine and stops when it needs you: a card
              ready for review, or a question only you can answer. Cloud carries
              those two moments to your desktop and to Slack or Lark, records
              what you decide, and hands it back to your own machine to run.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Step num="01" where="Your board">
                A card reaches{" "}
                <span className="font-mono text-ink">ready</span>, or asks a
                question only you can answer.
              </Step>
              <Step num="02" where="Cloud">
                The same event reaches the app&apos;s notification center and
                the Slack or Lark conversation you connect.
              </Step>
              <Step num="03" where="Your machine">
                Your decision comes back, and the board builds or resolves the
                card where it has always run.
              </Step>
            </div>

            <p className="mt-8 max-w-2xl text-[0.95rem] leading-relaxed text-muted">
              <span className="font-semibold text-ink">
                Nothing is sent until you sign in.
              </span>{" "}
              Cloud is off until you sign in with GitHub inside the app. The
              boards you open on that machine then raise their events, and each
              one watches what you pick — every release, or one. Sign out and
              the machine sends nothing.
            </p>
          </section>
        </div>

        {/* ── The boundary, both halves at once ───────────────────────────── */}
        <Band>
          <SectionHeading
            num="01"
            eyebrow="Boundary"
            title="What stays here, and what an event carries"
          />
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className={`${panelBare} p-6`}>
              <h3 className="text-lg font-bold">Stays on your machine</h3>
              <ul className="mt-4 space-y-3 text-[0.95rem] leading-relaxed">
                <Point lead="The board">
                  every card is a Markdown file in your own repository.
                </Point>
                <Point lead="The repository">
                  Cloud is never given access to it.
                </Point>
                <Point lead="The agent, and the work it does">
                  every run happens here.
                </Point>
              </ul>
              <p className="mt-5 text-sm text-muted">
                Cloud stores no board, runs no agent, and reads no repository.
              </p>
            </div>

            <div className={`${panelBare} p-6`}>
              <h3 className="text-lg font-bold">Goes with each event</h3>
              <ul className="mt-4 space-y-3 text-[0.95rem] leading-relaxed">
                <Point lead="The card's number and title" />
                <Point lead="The release it is promised to" />
                <Point lead="Its opening paragraph" />
                <Point lead="Its review notes">
                  the card&apos;s <Term>Worth noting</Term> sections, which is
                  what judging a build off a title alone is missing.
                </Point>
                <Point lead="The questions it is asking">
                  with their options.
                </Point>
              </ul>
              <p className="mt-5 text-sm text-muted">
                Enough to decide from, and nothing else off the card.
              </p>
            </div>
          </div>
        </Band>

        <div className={column}>
          {/* ── What this release does not ship ──────────────────────────── */}
          <section className="mt-28">
            <SectionHeading
              num="02"
              eyebrow="Limits"
              title="What Cloud does not do"
            />
            <ul className="mt-6 max-w-2xl space-y-3 text-[0.95rem] leading-relaxed">
              <Point lead="No shared or team board">
                Cloud relays one account&apos;s events; it is not a board other
                people open.
              </Point>
              <Point lead="No members and no roles" />
              <Point lead="No board in the browser">
                there is nothing to read or edit on the web.
              </Point>
              <Point lead="No agent run by Cloud">
                it builds nothing and writes nothing to your repository.
              </Point>
              <Point lead="No always-on machine">
                a decision you make while your machine is off is recorded and
                waits, and runs once the machine is reachable again.
              </Point>
            </ul>
          </section>

          {/* ── Getting in ───────────────────────────────────────────────── */}
          <section className="mt-28">
            <SectionHeading
              num="03"
              eyebrow="Access"
              title="Invite only, and free while the preview lasts"
            />
            <ol className="mt-6 max-w-2xl space-y-6">
              <li>
                <p className="font-semibold">
                  <span className="font-mono text-sm text-accent-deep">01</span>{" "}
                  Sign in with GitHub, inside the app.
                </p>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">
                  Configuration → Notifications. It says straight away
                  whether your account is in the preview.
                </p>
              </li>
              <li>
                <p className="font-semibold">
                  <span className="font-mono text-sm text-accent-deep">02</span>{" "}
                  If it is not, ask from the refusal itself.
                </p>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">
                  Press <span className="text-ink">Request an invite</span>{" "}
                  there. That is the only way to ask: this page carries no form,
                  no waitlist and no address to write to.
                </p>
              </li>
              <li>
                <p className="font-semibold">
                  <span className="font-mono text-sm text-accent-deep">03</span>{" "}
                  We approve it, and you are in.
                </p>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">
                  We read every request by hand. Approving admits your account on
                  the spot and emails you to say so — there is nothing to paste
                  and nothing to sign in for a second time. No date is promised
                  for a reply.
                </p>
              </li>
            </ol>
          </section>
        </div>

        {/* ── What Cloud holds about an account ───────────────────────────── */}
        <Band flush>
          <SectionHeading
            num="04"
            eyebrow="Your account"
            title="What Cloud holds"
          />
          <div className={`${panelBare} mt-8 max-w-3xl p-6`}>
            <ul className="space-y-3 text-[0.95rem] leading-relaxed">
              <Point lead="The events your board published">
                with the decision and the answers recorded against each one.
              </Point>
              <Point lead="Your board's folder name">
                the name only, so a message can say which board it came from.
              </Point>
              <Point lead="A record of the machine that runs your board's work" />
              <Point lead="One Slack connection, one Lark connection">
                if you connect them.
              </Point>
            </ul>
            <p className="mt-6 text-sm text-muted">
              <span className="font-semibold text-ink">Never</span> your
              repository, the path your board sits at, a credential, or a model
              key.
            </p>
          </div>
          <p className="mt-6 text-[0.95rem] text-muted">
            The full text is in the{" "}
            <a href="/privacy" className={linkClass}>
              Privacy Policy
            </a>{" "}
            and the{" "}
            <a href="/terms" className={linkClass}>
              Terms of Service
            </a>
            .
          </p>
        </Band>
      </main>
      <SiteFooter c={c} locale="en" path={PATH} />
    </>
  );
}
