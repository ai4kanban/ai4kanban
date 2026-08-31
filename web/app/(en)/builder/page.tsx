import type { Metadata } from "next";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { FiGlobe } from "react-icons/fi";
import { GITHUB_URL } from "@/components/content";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { buttonClass } from "@/components/ui/Button";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { ORG_ID, jsonLd, pageUrl, webPage } from "@/lib/schema";

const c = getCopy("en");

const PATH = "/builder";
const TITLE = "AI4Kanban: Meet the builder";
const DESCRIPTION =
  "Meet Tao Wu and learn why he built AI4Kanban to move software teams beyond supervising coding agents and toward managing requirements, decisions, and goals.";
const SCHEMA_DESCRIPTION =
  "Meet Tao Wu, the builder of AI4Kanban, an open-source project-management agent built around a kanban board. The page explains how faster coding moved the bottleneck to requirements, why project context needs durable memory, and why people should steer product judgment instead of watching agent logs.";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  translated: false,
});

const builderId = pageUrl(PATH) + "#builder";
const schema = jsonLd(
  {
    ...webPage(PATH, TITLE, SCHEMA_DESCRIPTION),
    mainEntity: { "@id": builderId },
  },
  {
    "@type": "Person",
    "@id": builderId,
    name: "Tao Wu",
    url: pageUrl(PATH),
    image: "https://cdn.dist0.com/images/tao.avatar.jpg",
    jobTitle: "Builder of AI4Kanban",
    description:
      "Tao Wu is the builder of AI4Kanban, an open-source project-management agent for turning rough product ideas into buildable work.",
    worksFor: { "@id": ORG_ID },
    sameAs: [
      "https://www.linkedin.com/in/tao-pmf",
      "https://github.com/neverchanje/",
      "https://x.com/tao_pmf",
      "https://tao-wu-me.pages.dev/",
    ],
  },
);

const linkClass =
  "text-ink underline decoration-2 decoration-accent underline-offset-[3px] transition-colors hover:text-accent-deep hover:decoration-accent-deep";

const socials = [
  {
    href: "https://www.linkedin.com/in/tao-pmf",
    label: "LinkedIn",
    icon: <FaLinkedinIn className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "https://github.com/neverchanje/",
    label: "GitHub",
    icon: <FaGithub className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "https://x.com/tao_pmf",
    label: "X",
    icon: <FaXTwitter className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    href: "https://tao-wu-me.pages.dev/",
    label: "Personal website",
    icon: <FiGlobe className="h-4 w-4" aria-hidden="true" />,
  },
];

function SocialLinks() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {socials.map((social) => (
        <a
          key={social.href}
          href={social.href}
          target="_blank"
          rel="me noopener noreferrer"
          aria-label={social.label}
          className={buttonClass("secondary", "icon")}
        >
          {social.icon}
        </a>
      ))}
    </div>
  );
}

function Avatar({ priority = false }: { priority?: boolean }) {
  return (
    // The portrait is shared with Tao's personal site at its canonical URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://cdn.dist0.com/images/tao.avatar.jpg"
      alt="Tao Wu"
      width={174}
      height={174}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="block aspect-square h-full w-full object-cover"
    />
  );
}

function Question({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-xl bg-code p-6 sm:p-7">
      <h3 className="text-lg font-bold leading-snug tracking-tight">{title}</h3>
      <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-muted">
        {children}
      </div>
    </aside>
  );
}

export default function BuilderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" />
      <main className="px-6 pb-8 text-ink">
        <section
          aria-labelledby="builder-heading"
          className="mx-auto max-w-3xl pb-14 pt-16 text-center sm:pb-20 sm:pt-24"
        >
          <p className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <span className="text-accent-deep">01</span>
            Builder
          </p>
          <h1
            id="builder-heading"
            className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl"
          >
            Why I&apos;m building{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">AI4Kanban</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[0.06em] h-[0.24em] bg-accent"
              />
            </span>
          </h1>
        </section>

        <section aria-label="About Tao Wu" className="mx-auto max-w-4xl">
          <div className="rounded-xl bg-code p-5 shadow-[4px_4px_0_0_var(--color-ink)] md:hidden">
            <div className="flex items-center gap-5">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-elev">
                <Avatar priority />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight">Tao Wu</h2>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  Builder of AI4Kanban
                </p>
                <div className="mt-4">
                  <SocialLinks />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-12 md:mt-0 md:grid-cols-[174px_minmax(0,580px)] md:justify-center md:gap-14">
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-xl bg-code p-2.5 shadow-[4px_4px_0_0_var(--color-ink)]">
                <div className="aspect-square overflow-hidden rounded-lg bg-elev">
                  <Avatar priority />
                </div>
              </div>
              <div className="mt-5">
                <SocialLinks />
              </div>
            </div>

            <div>
              <div className="hidden md:block">
                <h2 className="text-3xl font-bold leading-tight tracking-tight">
                  Tao Wu
                </h2>
                <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Builder of AI4Kanban
                </p>
              </div>

              <div className="space-y-5 text-[1.05rem] leading-[1.7] md:mt-7">
                <p>
                  I spent most of my career building{" "}
                  <a
                    href="https://github.com/risingwavelabs/risingwave"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    databases
                  </a>
                  , first as an engineer and later as a product manager. That
                  combination taught me that software rarely fails because a
                  team cannot write code. It fails when the work is unclear,
                  context is scattered, and small decisions disappear before
                  the next person needs them.
                </p>

                <p>
                  Coding agents made that imbalance impossible to ignore. Give
                  Claude Code or Codex a clear requirement and it can often
                  deliver more than I expected. Give it a vague idea and the
                  design space opens in every direction. The agent keeps moving,
                  but speed only gets you to the wrong place faster.
                </p>

                <p>
                  The new bottleneck is not writing code. It is turning a rough
                  goal into good work: deciding what matters next, clarifying the
                  edges, preserving product judgment, and knowing when a choice
                  genuinely needs a person.
                </p>

                <p>
                  I tried managing that work in chat. The decisions were there,
                  but buried across long conversations. Every new session felt
                  like onboarding a capable new teammate who had never met the
                  product. More parallel agents created more conversations to
                  supervise, not more leverage.
                </p>

                <p>
                  That led me to what I call{" "}
                  <span className="font-semibold underline decoration-2 decoration-accent underline-offset-[3px]">
                    kanban engineering
                  </span>
                  : use the board as the planning layer above coding agents. A
                  broad goal becomes a set of cards. Each card is questioned and
                  refined until it is buildable. The decisions stay attached to
                  the project, so the next card starts with more context than the
                  last.
                </p>

                <ul className="space-y-3 pl-1">
                  {[
                    "Turn rough ideas into independent, buildable cards.",
                    "Let the agent settle ordinary details and raise the few choices that need judgment.",
                    "Keep goals, rejected paths, and product decisions in durable project memory.",
                    "Run ready work through the coding agent while people focus on users, direction, and taste.",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <p>
                  AI4Kanban is my open-source attempt to make that workflow real.
                  It is a project-management agent shaped as a kanban board, not
                  another dashboard for watching logs. You steer requirements and
                  approve the important calls; the board plans, remembers, and
                  coordinates the path to delivery.
                </p>

                <p>
                  The{" "}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    core is open source
                  </a>
                  . I use it to manage its own development, because the only way
                  to learn whether an autonomous board can improve a real project
                  is to trust it with one.
                </p>
              </div>

              <div className="mt-10 space-y-5">
                <Question title="Why a kanban instead of another chat window?">
                  <p>
                    Chat is good for one task. A project is a long-lived tree of
                    goals, dependencies, decisions, and rejected paths. A board
                    gives that structure a stable home and lets people review the
                    work from the level that matters.
                  </p>
                  <p>
                    The board is primarily for the agent to plan from. People can
                    stay with the small set of questions, reviews, and decisions
                    that require them.
                  </p>
                </Question>

                <Question title="What does “AI4Kanban” mean?">
                  <p>
                    It means AI for the kanban: an agent drives each card from
                    rough idea to clarified work, execution, and delivery. The
                    kanban is no longer a passive list that waits for a person to
                    update every column.
                  </p>
                  <p>
                    The goal is simple: spend less time supervising agents and
                    more time deciding what creates value.
                  </p>
                </Question>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter c={c} locale="en" path={PATH} />
    </>
  );
}
