# Character design

The agents' art: the same small robot, dressed for its job. Every sprite is drawn in code;
nothing here is hand-edited.

- **`draw.mjs`**: every sprite. `node draw.mjs` rewrites `png/`, `loops/`, the avatars in
  `public/agent-art/` (and the site's), and the office atlas `public/run-scene/cast.*`.
- **`png/`**: transparent 48×48 frames per job — front, side, back, sit, walk 1–4, work 1–4,
  and `-noprop` views for the jobs that hold a prop — plus the four 76×42 desk screens.
- **`loops/`**: the walk and work loops of the whole cast as silent looping H.264 videos at
  4×, with a first-frame poster.
- **`preview.html`**: the review sheet — the desk and the sofa at the office's real scale, all
  views, the loops, the recognition check and the custom-agent badge. `review.png` is a shot
  of its top.

## The shared body

- **Canvas**: 48×48, transparent, drawn at whole multiples only — pixels go uneven otherwise.
- **Robot**: charcoal rounded head and torso, cream visor with mint eyes, ember antenna tip,
  wire arms with round hands, two stubby legs. The head, visor and antenna never change.
- **Ground line**: feet end on row 45; the antenna tip starts on row 1.
- **Light**: from the top left — top and left edges one step lighter, bottom and right one
  step darker. A one-pixel ink outline (`#0b0a09`) around the figure and any part laid over
  another.
- **Palette**: the board's five inks (ember, mint, sky, lilac, peach) plus cream, charcoal
  and seven costume ramps (khaki, brown, gray, teal, wine, yellow, deep ink). A new colour
  needs a reason no costume can do without.

## Poses

- **Views**: front, side facing right, back. Facing left is the side mirrored, so a one-sided
  detail must still make sense flipped.
- **Walk**: four frames, stride–pass–stride–pass; the pass frames lift the body a row. A foot
  on the ground moves back 5px a frame.
- **Work**: four frames seen from behind at the office desk, hands striking in turn.
- **Sit**: one front frame on the sofa — head and chest six rows lower, feet on the ground
  line. No sitting-down motion.
- **Costumes on poses**: a role's costume is read off its front and back, then laid onto each
  pose — squeezed for the side, folded onto the lap for the sit, sleeves and trousers redrawn
  on moving limbs. A bulky back mark (pack, tube, board, cabinet) shows as a slab in profile.
- **No furniture**: the office's own desk, display and sofa are drawn under the sprites. A
  job's screen — code, doc, design or video — is drawn over the desk's display (`SCREEN_OF`).
- **Custom agents**: the plain robot (`base`) with a blank cream patch on its left upper arm;
  the name's first visible character is laid over it at runtime.

## Telling jobs apart

Name a job by its clothes, never only by a prop.

- **Head first**: each job's headpiece has its own outline; it is what reads at 48px and
  from behind. The antenna tip always shows.
- **A distinct back**: the back view carries its own mark.
- **One colour family per job**: when inks run out, the cut must differ.

## Adding a job

1. Pick a headpiece whose outline differs from every other job's, and a main ink or cut no
   other job has.
2. Give the back one mark.
3. Add a `role(...)` with its front and back in `draw.mjs`, and its screen in `SCREEN_OF`.
   The side, walk, work and sit are derived.
4. Run `node draw.mjs` and check `preview.html`: without names or props, at 48px, it must
   still be told apart from every other job.
