# Asset

Embed a file with `<Asset src=".assets/<card id>/<file>" label="..." />` alone in a paragraph.
Inline and fenced examples remain text.

- **Label**: use a few words; an image's optional `alt` is its shipped caption and cannot contain `<`, `>` or its enclosing quote.
- **Device**: use a separate tag for each device view, with `device="mobile"` or `device="desktop"`; both may reference the same responsive page.
- **Variants**: versions of the same content on the same device share one tag with `variants='{"English": ".assets/<card id>/page.en.html", "中文": ".assets/<card id>/page.zh.html"}'`, with `src` shown first; alternatives stay separate tags.
- **Loop**: add `loop` for muted, looping video without controls.
- **Tiled map**: a `.tmx` or `.tmj` `src` draws as a map; keep its `.tsx`/`.tsj` tilesets and images beside it, at the relative paths it names.
- **Sprite animation**: a TexturePacker JSON (Hash or Array) `src` plays as an animation; keep its sheet image beside it, at the relative path `meta.image` names.
