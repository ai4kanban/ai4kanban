import { Mat, printFrame } from "../home/Mat";
import { HeroShots } from "../home/HeroShots";
import { MemoryScene } from "../home/MemoryScene";
import { FollowUpsScene } from "../home/FollowUpsScene";
import { PauseOffscreen } from "../home/PauseOffscreen";
import { ShotTaskGraph } from "../shots/ShotTaskGraph";
import { ShotSessions } from "../shots/ShotSessions";

// The pictures the landing page used to carry, mounted in a doc's column for MDX. `doc-visual`
// keeps the prose rules off their markup (`blog-prose.css`). The board deck and the task graph
// are unreadable on a phone, so they are hidden below `sm`, as they were on the landing page.

const BLOCK = "doc-visual mdx-block";

export function BoardShots() {
  return (
    <Mat wash="mintSky" className={`${BLOCK} hidden p-4 sm:block sm:p-6`}>
      <HeroShots
        c={{
          board: { label: "Board", alt: "The AI4Kanban board: Board view" },
          card: { label: "Card", alt: "The AI4Kanban board: a card's details and requirements" },
          frontAria: "{view} view (current)",
          flipAria: "Switch to the {view} view",
        }}
      />
    </Mat>
  );
}

export function TaskGraphShot() {
  return (
    <Mat wash="skyLilac" className={`${BLOCK} hidden p-3 sm:block sm:p-6`}>
      <div aria-hidden className={printFrame}>
        <ShotTaskGraph />
      </div>
    </Mat>
  );
}

export function SessionsShot() {
  return (
    <Mat wash="emberMint" className={`${BLOCK} p-3 sm:p-6`}>
      <PauseOffscreen className={printFrame}>
        <ShotSessions />
      </PauseOffscreen>
    </Mat>
  );
}

export function MemoryAnimation() {
  return (
    <div className={`${BLOCK} px-2 sm:px-6`}>
      <MemoryScene label="You give a note once; the agent remembers it and every later draft follows it." />
    </div>
  );
}

export function FollowUpsAnimation() {
  return (
    <div className={`${BLOCK} px-2 sm:px-6`}>
      <FollowUpsScene label="The QA agent finds a gap and hands you a follow-up to accept or dismiss." />
    </div>
  );
}
