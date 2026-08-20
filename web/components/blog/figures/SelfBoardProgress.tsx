import { printFrame } from "@/components/home/Mat";
import { CDN } from "@/lib/site";
import { Figure } from "./kit";

// "We saw this shift while using AI4Kanban to manage its own development."
//
// The only figure in the set that is not a drawing, and the one place in the
// post where that is the right thing: the claim is a number the project has
// actually recorded, so the honest illustration is the board's own panel rather
// than a picture of one. It is mounted the way the landing page mounts every
// screenshot — a print on the mat, no frame of its own.

export function SelfBoardProgress() {
  return (
    <Figure
      single
      wash="peachEmber"
      caption="AI4Kanban's own board, one month in: 218 tasks created, 112 completed, 29 rejected. The marked step is where the project started planning its own work on the board. The rejections are part of the record — the reason an idea was turned down is what keeps it from coming back as if it were new."
    >
      <div className={`${printFrame} bg-elev`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${CDN}/ai4kanban-daily-progress-v2.webp`}
          alt="AI4Kanban's daily progress panel over 30 days: 112 completed, 218 created, 29 rejected, with the later, taller stretch of the chart marked out from the flatter run before it"
          className="block w-full"
          loading="lazy"
        />
      </div>
    </Figure>
  );
}
