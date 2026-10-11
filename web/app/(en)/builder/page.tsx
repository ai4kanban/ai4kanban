import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_URL } from "@/components/content";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { SOCIALS, SOCIAL_URLS } from "@/components/social";
import { buttonClass } from "@/components/ui/Button";
import { AskingFirst } from "@/components/builder/AskingFirst";
import { DraftsFirst } from "@/components/builder/DraftsFirst";
import { getCopy } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { ORG_ID, PERSON_ID, jsonLd, pageUrl, webPage } from "@/lib/schema";

const c = getCopy("en");

const AVATAR = "https://cdn.dist0.com/images/tao.avatar.jpg";

const PATH = "/builder";
const TITLE = "Why I'm building AI4Kanban — Tao Wu";
const DESCRIPTION =
  "I started AI4Kanban hoping AI could run a project. Trying it with early users changed my mind about which decisions I could hand over.";
const SCHEMA_DESCRIPTION =
  "The story of building AI4Kanban, from trying to let AI run a project to reviewing key drafts before execution.";

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
    jobTitle: "Founder of AI4Kanban",
    description: "Tao Wu is the founder of AI4Kanban.",
    worksFor: { "@id": ORG_ID },
    sameAs: SOCIAL_URLS,
  },
);

const linkClass =
  "text-ink underline decoration-2 decoration-accent underline-offset-[3px] transition-colors hover:text-accent-deep hover:decoration-accent-deep";

// /builder as one letter: title, who is writing, the story, the signature.
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
            Why I&apos;m building{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">AI4Kanban</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[0.06em] h-[0.24em] bg-accent"
              />
            </span>
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
              <p className="text-sm text-muted">Founder of AI4Kanban</p>
            </div>
          </div>

          <div className="mt-12 space-y-6 text-[1.125rem] leading-[1.8]">
            <p>Hi, I&apos;m Tao. I&apos;m building AI4Kanban full-time.</p>
            <p>
              My first idea was to build a one-person startup with agents
              running the project on their own. Coding agents were already
              doing more of the implementation. I wanted to see if they could
              take on the planning too.
            </p>
            <p>
              Our idea was simple: before building, the agent asks questions
              until the task is clear. It worked in the background. It broke an
              idea into tasks, found the missing details, and answered what it
              could on its own. Only the few choices that needed a person came
              back, as multiple-choice questions.
            </p>
            <div className="py-2">
              <AskingFirst />
            </div>
            <p>
              We spent a lot of time trying to make it work. The agents did
              raise useful questions and make useful decisions. But early users
              told us <strong>it didn&apos;t feel faster</strong>. A coding
              agent shows results right away. Ours made them wait through
              planning and answer more questions, and it spent more tokens. A
              small task could turn into a long conversation.
            </p>
            <p>
              That feedback showed me what was wrong. We were asking people to
              settle everything before they had seen a result. But most people{" "}
              <strong>
                don&apos;t know exactly what they want until they see a first
                version
              </strong>
              . More questions upfront couldn&apos;t fix that.
            </p>
            <p>
              So AI4Kanban now shows you{" "}
              <strong>drafts of the key parts first</strong>: a UI mockup, the
              copy for a page, or a change to a prompt. You settle those, and
              the agent builds the rest.
            </p>
            <div className="py-2">
              <DraftsFirst />
            </div>
            <p>
              Agents sometimes add features you never asked for. In a long
              written spec, those additions are easy to miss. In a UI draft, you
              can see the extra pages right away. You can say, &apos;I
              don&apos;t need these,&apos; before the agent builds them.
              Sometimes, seeing the draft makes you rethink the whole idea.
            </p>
            <p>
              We had moved from trying to let AI do everything, to having people
              help AI, to having <strong>AI help people</strong>. Giving people
              more say over the direction made it easier to hand over the
              execution. Once the key drafts were agreed on, there was less left
              to keep checking.
            </p>
            <p>
              My goal is simple: reduce the effort people spend on each task,
              and help them become{" "}
              <strong>another 10 times more productive</strong>. That&apos;s why
              I&apos;m building AI4Kanban.
            </p>
            <p>
              This took a few attempts to understand. I&apos;m still building
              it. You can see where AI4Kanban is today on the{" "}
              <Link href="/" className={linkClass}>
                home page
              </Link>
              , or follow the work on{" "}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                GitHub
              </a>
              .
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
