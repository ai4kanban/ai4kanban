# Character design

The next look for the agents: the same small robot, dressed for its job. This folder is the
reviewed direction and the rules for drawing more. The shipped art in `public/agent-art/`
and its recipe, `agent-art.md`, stay as they are until the art is replaced.

- **`draw.mjs`**: every sprite, drawn in code. `node draw.mjs` rewrites `png/`.
- **`png/`**: transparent 48×48 samples — four jobs in three views, prop-less checks, and
  the planner's poses.
- **`preview.html`**: the review sheet — list size, desktop-pet size, the recognition check
  and the poses. `review.png` is a shot of it.

## The shared body

- **Canvas**: 48×48, transparent, drawn at 1× in a list and at whole multiples (4× for a
  desktop pet). Never at a fraction — pixels go uneven.
- **Robot**: charcoal rounded head and torso, cream visor with mint eyes, ember antenna tip,
  wire arms with round hands, two stubby legs. The head, visor and antenna never change.
- **Ground line**: feet end on row 45; the antenna tip starts on row 1.
- **Light**: from the top left — each part's top and left edge one step lighter, bottom
  and right edge one step darker. One-pixel ink outline (`#0b0a09`) around the whole figure
  and around any part laid over another.
- **Palette**: the board's inks — ember, mint, sky, lilac, peach — each in a light, base and
  shade step, plus cream and charcoal. A new colour needs a reason a costume can't do
  without, like the planner's brass.

## Telling jobs apart

Name a job by its clothes, not its prop. The prop helps; it must never be the only difference.

| Job | Head | Body | Back | Prop |
| --- | --- | --- | --- | --- |
| Planner | white captain's cap | navy double-breasted coat, brass epaulettes | map tube across the back | rolled map |
| Developer | mint hood up | hoodie with pocket and ribbed hem | hood seam | mug |
| Designer | ember beret, drooping right | lilac smock, cream apron | apron bow and crossed straps | brush |
| Archivist | green eyeshade, glasses | peach cardigan | three-drawer cabinet | index card |

- **Head first**: each job gets a headpiece with its own outline — cap, hood, beret,
  eyeshade. It is what still reads at 48px and from behind.
- **A distinct back**: the back view carries its own mark (tube, seam, bow, drawers), and
  that mark shows at the edges of the front and side views where it can.
- **One colour family per job**: the main garment owns one ink, so a row of mixed jobs
  never shows two that match.
- **Face**: the visor is the face. The eyes may set a mood per job (focused, happy, calm),
  the same in every view.

## Across views

- **Three views**: front, side facing right, back. Facing left is the side view mirrored, so
  a one-sided detail must still make sense flipped.
- **Same parts, same rows**: a garment starts and ends on the same rows in every view; only
  its width changes.
- **Poses**: walk is four frames (stride, pass, stride, pass); the pass frames lift the body
  one row. Clothes follow the body — a coat tail swings out on a stride.

## Adding a job

1. Pick a headpiece whose outline differs from the four above.
2. Pick an ink no other job's main garment uses, or a different cut if the inks run out.
3. Give the back one mark.
4. Draw front, side and back in `draw.mjs`, then check `preview.html`: without names or
   props, at 48px, it must still be told apart from every other job.
