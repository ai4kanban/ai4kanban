import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SOCIALS, SOCIAL_URLS } from "@/components/social";
import { buttonClass } from "@/components/ui/Button";
import { BridgeScene } from "@/components/home/BridgeScene";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { ORG_ID, PERSON_ID, jsonLd, pageUrl, webPage } from "@/lib/schema";

const c = getCopy("en");

const AVATAR = "https://cdn.dist0.com/images/tao.avatar.jpg";

const PATH = "/builder";
const TITLE = "Why I'm building WildCrane — Tao Wu";
const DESCRIPTION =
  "Four thoughts on why I'm building WildCrane: clear boundaries between humans and agents, planning smart, thin skills, and a workspace for coding and marketing.";
const SCHEMA_DESCRIPTION =
  "Tao Wu's four thoughts on building WildCrane: humans handle precision while agents handle generation, planning matters as models improve, skills are thin, and a shared workspace brings coding, marketing, workflows, agents and templates together.";

export const metadata: Metadata = pageMetadata({
  locale: "en",
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  type: "profile",
  byTao: true,
  translated: false,
});

const schema = jsonLd(
  {
    ...webPage(PATH, TITLE, SCHEMA_DESCRIPTION),
    mainEntity: { "@id": PERSON_ID },
  },
  {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Tao Wu",
    url: pageUrl(PATH),
    image: AVATAR,
    jobTitle: "Founder of WildCrane",
    description: "Tao Wu is the founder of WildCrane.",
    worksFor: { "@id": ORG_ID },
    sameAs: SOCIAL_URLS,
  },
);

function N({ n }: { n: number }) {
  return <span className="font-semibold">{n}. </span>;
}

// /builder as one letter: title, who is writing, four numbered thoughts, the signature.
export default function BuilderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schema }}
      />
      <Header c={c} locale="en" />
      <main className="px-6 pb-8 text-ink">
        <article className="mx-auto max-w-[38rem] pt-14 sm:pt-24">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-0.035em] sm:text-5xl">
            Why I&apos;m building WildCrane
          </h1>

          <div className="mt-8 flex items-center gap-4">
            {/* The portrait is shared with Tao's personal site at its canonical URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR}
              alt="Tao Wu"
              width={56}
              height={56}
              fetchPriority="high"
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold">Tao Wu</p>
              <p className="text-sm text-muted">Founder of WildCrane</p>
            </div>
          </div>

          <div className="mt-12 space-y-6 text-[1.125rem] leading-[1.8]">
            <p>
              <N n={1} />
              Everyone in the AI industry believes you can let AI agents
              handle everything. But we believe differently. AI and humans
              should have a clear boundary: humans handle precision, and agents
              handle generation. Humans handle the key parts while agents handle
              the details.
            </p>
            <div className="py-2">
              <BridgeScene c={c.home.handoff.scene} />
            </div>
            <p>
              <N n={2} />
              Human thinking is still what really matters. But not
              &quot;execution smart&quot;. It&apos;s more about &quot;planning
              smart&quot;. Models are evolving quickly, skills are getting
              thinner, and there&apos;s no need for another complex harness with
              over 100k lines of code just to handle one specific task. The
              models have already learned those capabilities. So knowing what to
              do and having a sense of what&apos;s good or bad are what really
              differentiate you in this AI era.
            </p>
            <p>
              <N n={3} />
              Skills are thin, so it&apos;s pointless to pay $99/month for a
              workflow that can be encapsulated in a skill. I prefer a unified
              workspace where I manage different kinds of work. As an indie
              hacker, I don&apos;t just code. I do marketing as well. My Codex
              desktop gets messy when I mix 10+ tasks in the UI, some coding,
              some marketing.
            </p>
            <p>
              <N n={4} />
              These thoughts led to what WildCrane is today. It&apos;s a middle
              layer between humans and the agents who handle execution. You
              manage your ideas, both coding and marketing, on the board.
            </p>
            <p>
              For each idea, you review a draft before agents build it. Once the
              &quot;key parts&quot; match your expectations perfectly, leave the
              rest to agents.
            </p>
            <p>
              What about &quot;execution&quot;? It&apos;s thin today, but it
              hasn&apos;t entirely vanished. So we provide 6 built-in workflows
              and 20+ agents tailored for indie hackers. We&apos;ve created
              thousands of tasks through these workflows. They use your existing
              AI subscriptions, like Codex, Claude Code, and Cursor, so you
              don&apos;t pay extra for AI coding. You can create your own
              workflow and add new agents to the team in existing workflows.
            </p>
            <p>
              Yet while skills, agents, and workflows are thin, templates are
              not. Without a template, you may still produce an ugly product
              intro video or landing page, even with the most powerful model and
              agent. This is not their fault. We&apos;ve cloned videos, UI, and
              decks into a template catalog, with carousels coming soon. The
              templates are &quot;feels&quot; and &quot;recipes&quot; that teach
              your agent to work like an expert.
            </p>
          </div>

          <p className="mt-12 text-xl font-semibold">Tao</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={label}
                className={buttonClass("secondary", "icon")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter c={c} locale="en" path={PATH} />
    </>
  );
}
