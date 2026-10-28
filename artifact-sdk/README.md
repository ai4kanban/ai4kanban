# wildcrane-artifact-sdk

Write your own preview for your own artifact type — a subtitle editor, a slide viewer — and
publish it to your WildCrane account. When an agent submits an artifact of that type, the review
page draws it with your component.

```
review.wildcrane.ai ──postMessage──▶ <hash>.wildcraneusercontent.com (your bundle)
  holds the sign-in,                   sandboxed iframe, no network,
  validates and saves                  sees only the artifact it is handed
```

- **Yours alone**: a component draws artifacts only on tasks your account started.
- **No network**: `connect-src 'none'`, so not even `fetch` of your own files; bundle every script, style, font and image, and import data instead of fetching it.
- **Saving**: only the account's owners get `readOnly: false`. A save becomes the artifact's
  next version. Approving stays on the review page.
- **Pinned**: an artifact version keeps the component version that was newest when it was
  written; publishing later changes nothing already submitted.

## A component

A folder of static files with `index.html` at its top, at most 10 MB, any framework, and
`wildcrane.component.json`:

```json
{
  "name": "subtitles",
  "version": "1.0.0",
  "title": { "en": "Subtitle editor", "zh": "字幕编辑器" },
  "types": ["@your-handle/subtitles"],
  "schema": { "type": "array" }
}
```

- **`name`**: unique in your account; not a built-in type (`html`, `image`, `video`,
  `markdown`, `storyboard`, `compare`).
- **`version`**: semver, published once.
- **`types`**: the artifact types it draws, each `@<your GitHub handle>/<name>`, lowercase.
- **`schema`**: optional JSON Schema every save must match. The review page checks `type`,
  `enum`, `const`, `properties`, `required`, `additionalProperties`, `items`, `minItems`,
  `maxItems`, `minLength`, `maxLength`, `pattern`, `minimum` and `maximum`. A save is at most 256 KB.

```sh
npm install wildcrane-artifact-sdk
```

```js
import { connect } from "wildcrane-artifact-sdk";

const bridge = await connect();
// bridge.artifact: { type, name, version, content } or { …, file: { data: ArrayBuffer, contentType } }
// bridge.readOnly, bridge.locale ("zh" | "en"), bridge.theme ("light" | "dark")
await bridge.save(next);          // rejects with the reason, in bridge.locale
bridge.onChange((ctx) => redraw(ctx));
```

The frame follows your document's height (`connect({ autoResize: false })` and
`bridge.resize(px)` to do it yourself), up to twice the window's height.

## Publish

```sh
WILDCRANE_API_KEY=wck_… npx wildcrane-artifact-sdk publish dist
```

Every file in the folder but dot files goes into the bundle. With Vite, put the manifest in
`public/` and publish `dist`. Then submit an artifact of your type:
`POST /v1/tasks/{id}/artifacts { "type": "@your-handle/subtitles" }`; it is reviewed with the
card's current phase.
`GET /v1/components` lists what you published; `DELETE
/v1/components/{name}/versions/{version}` removes a version, and artifacts pinned to it show that
their preview cannot be drawn.

## The example

`examples/subtitles` edits a JSON list of `{ start, end, text }`. Set your handle in its
manifest, then `npm run example`.

## Develop

`npm install`, then `npm run lint`.
