import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Generate the HyperFrames composition; media playback stays with HyperFrames.
const [source, destination, config] = process.argv.slice(2)
if (!source || !destination) throw new Error('Usage: demo.tsx <capture.mp4> <project-directory> [shot.json]')
const project = resolve(destination)
mkdirSync(project, { recursive: true })
const media = resolve(project, '05-type-request.mp4')
if (resolve(source) !== media) copyFileSync(source, media)

const shot = config ? JSON.parse(readFileSync(config, 'utf8')) : {
  width: 1920, height: 1080, duration: 10.57,
  moves: [{ start: 3, duration: 0.4, scale: 1.8, x: -1536, y: -864 }],
}
if (![shot.width, shot.height, shot.duration].every(value => Number.isFinite(value) && value > 0)
  || !Array.isArray(shot.moves)) throw new Error('Expected positive width, height, duration and a moves array')
const moves = []
let end = 0
for (const move of shot.moves) {
  if (![move.start, move.duration, move.scale, move.x, move.y].every(Number.isFinite)
    || move.start < end || move.duration <= 0 || move.scale <= 0
    || move.start + move.duration > shot.duration) throw new Error('Invalid or overlapping camera move')
  moves.push({ start: move.start, duration: move.duration, scale: move.scale, x: move.x, y: move.y })
  end = move.start + move.duration
}
writeFileSync(resolve(project, 'package.json'), JSON.stringify({
  private: true, type: 'module',
  scripts: {
    check: 'npx --yes hyperframes@0.8.55 check',
    render: 'npx --yes hyperframes@0.8.55 render',
    preview: 'npx --yes hyperframes@0.8.55 preview',
  },
}, null, 2) + '\n')
writeFileSync(resolve(project, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${shot.width}, height=${shot.height}">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${shot.width}px; height: ${shot.height}px; overflow: hidden; background: #000; }
    #root { position: absolute; inset: 0; overflow: hidden; }
    #camera, video { width: ${shot.width}px; height: ${shot.height}px; }
    #camera { transform-origin: top left; }
    video { display: block; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${shot.duration}" data-width="${shot.width}" data-height="${shot.height}">
    <div id="camera">
      <video id="a-roll" class="clip" src="05-type-request.mp4" muted playsinline data-start="0" data-duration="${shot.duration}" data-track-index="0"></video>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const moves = ${JSON.stringify(moves)};
    for (const move of moves) {
      tl.to("#camera", {
        x: move.x, y: move.y, scale: move.scale,
        duration: move.duration, ease: "power2.inOut",
      }, move.start);
    }
    window.__timelines = window.__timelines || {};
    window.__timelines.main = tl;
  </script>
</body>
</html>
`)
