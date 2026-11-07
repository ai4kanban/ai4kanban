# Icons

An agent's icon is a sticker of its deliverable, not of a character. Pick the glyph closest to what it makes:

- **Text**: `text` copy · `article` article · `outline` brief or outline · `script` script · `prompt` prompts · `email` email · `notebook` notes · `reply` discussion · `feedback` feedback
- **Images**: `image` images · `post-image` blog images · `social-image` social images · `cover` cover · `carousel` carousel pages · `carousel-outline` carousel copy · `shots` screenshots
- **Screens and decks**: `screen` UI design · `wireframe` wireframes · `slides` slides
- **Video**: `video` video · `storyboard` storyboard · `template` video template
- **Software**: `api` API docs · `schema` database changes · `code` code · `stack` tech choices · `plan` plan · `checklist` QA
- **Workflows**: `software` software · `product-video` product video · `social-post` social post · `blog` blog · `deck` slide deck · `video-clone` video clone · `workflow-kit` workflow
- **Board**: `workflow` workflow · `card` task · `proposal` proposals · `inbox` triage · `folder` project description · `compare` research · `squeeze` pruning · `dismissed` rejections · `file` anything else

With none close, draw one as a list of 1 to 12 parts `{ d, f?, o?: true, s?, w? }`:

- **Grid**: a 24×24 SVG path `d`, filling the grid, on a transparent ground with no circle, frame or shadow.
- **Shapes**: each silhouette has one ink outline, `o: true`; inside it, only flat fills `f` and a few thick bars, `s` with `w` about 2 (at most 3). No grid lines, hairlines, shading tones or large dark solids.
- **Palette**: `k` ink, `w` paper, `c` canvas, `g` soft ink, `o` accent, `p` peach, `s` sky, `m` mint, `l` lilac, `r` crimson, `y` yellow.

```yaml
akb:
  icon:
    - d: M5 3.5h14v17H5z
      f: y
      o: true
    - d: M8 9h8M8 13h8M8 17h5
      s: g
      w: 2
```
