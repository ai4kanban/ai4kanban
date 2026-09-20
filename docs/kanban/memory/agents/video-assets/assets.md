# Reusable video assets

Paths are under the board's assets folder. One line per asset: path, what it shows, what it
suits, its limits, and the product change that makes it need recapturing.

## Screen recordings, 1080p

Silent H.264, English demo UI, with a pointer/click overlay.

- `850/01-open-board.mp4`: board with a development and a video card in one frame, pointer
  drifts to the first; suits openings and "one board" shots; board layout only; recapture when
  the board page or card design changes.
- `850/02-open-task.mp4` … `850/07-review-plan.mp4`: open a card, answer a question, type in
  card chat, the agent writes the request back, review Scope/Todo; suits planning and chat
  demos; tied to the demo card's text; recapture when the card page, question block or chat
  panel changes.
- `850/08-start-delivery.mp4`: Implement → confirm → Runs office with Builder running; suits
  delivery shots; shows the run-log strip; recapture when the Implement dialog or Runs view
  changes.
- `850/10-open-video-task.mp4`, `850/11-video-workflow.mp4`, `850/12-type-video-brief.mp4`:
  board → video card, Configuration → the video workflow's roles, typed video brief;
  recapture when Configuration or that workflow's agents change.
- `850/13-media-preview.mp4` + `850/13-media-audio.wav`: in-card video plays about 3.9 s and
  pauses; recapture when the media player changes.
- `850/14-board.png`, `850/02-board.png`: board stills; same limits as `01`.

## Screen recordings, retina

1440×900 logical viewport at 2× density, CFR30. Native originals and edit ranges are in
`850/capture/`; framing and limits in `macbook-handoff.md`.

- `850/01-create-goal.mp4`: Create, typed goal, real planning and a group card; 31.5s; suits
  goal breakdown; the group includes a real follow-up reorganization, not an immediate
  planner response; recapture when creation, discussion or group UI changes.
- `850/02-dependencies-answer.mp4`: three linked cards, a design question and a real compact
  option selection; 18.8s; suits dependencies and decisions; tied to those demo ids; recapture
  when the graph or question UI changes.
- `850/03-change-prototype.mp4`: old prototype, chat typing and Send, a larger Play with
  Speed beside it; 34.2s; suits design iteration; the before/after replay saved real versions;
  recapture when card chat, embeds or prototype controls change.
- `850/04-review-prototype.mp4`: pointer inspects Play and Speed in an enlarged prototype;
  11.9s; suits review; standalone design rather than implemented playback; recapture when the
  prototype or embed renderer changes.
- `850/05-start-delivery.mp4`: a real "implement anyway" acknowledgement and the Builder
  running; 13.8s; suits delivery startup; design-only deliverable, cancelled after capture, so
  no completed-product claim; recapture when the delivery dialog or office changes.
- `850/10-board.png`: the same board with twelve cards and a group, native 2880×1800; suits a
  six-second credits background; recapture when board layout or card design changes.

## Sound and art

- `850/00-music.mp3`, `00-click.mp3`, `00-select.mp3`, `00-confirm.mp3`: CC0 copies from
  `assets/video/README.md`; no typing sound exists there.
- `850/01-narration-en.wav` … `10-narration-en.wav` and the matching `-zh.wav`: ten approved
  bilingual lines, Kokoro TTS (Apache-2.0), 24 kHz mono; suit that 60-second script only;
  regenerate when the approved wording changes.
- `850/00-logo-mark.svg`: unchanged `web/public/logo-mark.svg`; suits a logo beside the
  typeset product name; replace when the brand mark changes.
- `850/10-scriptwriter.png`, `10-video-assets.png`, `10-video-editor.png`: unchanged
  repository agent-art sprites, 96×96 transparent; suit collaborative credits — animate in the
  composition and add role props; replace when the character family changes.
