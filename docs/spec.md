# Magpie spec

Rough technical spec. The design in `design/` decides how things look and behave; this file decides how they work.

## Architecture

```
browser (sveltekit spa on cloudflare pages)
  ├─ indexeddb       all boards + image blobs, the working copy
  ├─ google drive    source of truth, drive.file scope
  └─ worker          link previews + image proxy
```

- Local first. Every change writes to IndexedDB at once, then syncs to Drive in the background.
- The app works fully offline and signed out. Sync just waits.
- No backend besides the worker. No database.

## Data model

```ts
type kind = 'image' | 'link' | 'note' | 'column' | 'board'

type item = {
  id: string            // random, 12 chars
  kind: kind
  x: number; y: number  // canvas position, ignored inside a column
  w: number             // width; height comes from content (images: from aspect)
  z: number
  parent?: string       // column id, when inside a column
  order?: number        // position inside the column
  updated: number       // ms timestamp, used for merging
  deleted?: boolean     // tombstone, kept for sync

  // image
  asset?: string        // asset id (sha256)
  aspect?: number
  caption?: string
  crop?: frame          // image and link pictures: { r, z, x, y, bg }, frame aspect, zoom, offset, padding color
  // link
  url?: string
  title?: string
  desc?: string
  site?: string
  thumb?: string        // asset id of the saved preview image
  layout?: 'large' | 'compact'
  note?: string         // user's note on a link
  fetched?: number      // when the preview was fetched, missing while pending
  // note
  text?: string         // markdown
  align?: 'center' | 'right'  // note text alignment, left when missing
  // column
  name?: string
  collapsed?: boolean
  // board
  board?: string        // child board id
}

type board = {
  id: string            // 'home' for the root
  name: string
  parent?: string       // parent board id, for breadcrumbs
  cover?: string[]      // asset ids pinned to the board card cover, first is the big one
  items: item[]
  updated: number
  deleted?: boolean
}
```

- Board card name, item count and cover are computed from the child board, which is always in IndexedDB. Nothing is duplicated.
- Cover: pinned pictures first, then the first image and link pictures on the board, three in all. A board with no pictures uses the ones in its boards.
- Deleting a board card marks the child board deleted, so undo can bring it back.
- Viewport (pan, zoom) is saved per board in IndexedDB, not synced.

## Drive layout

```
Magpie/
  boards/<id>.json
  assets/<sha256>.webp   (.gif kept as gif)
```

- Files are found by `appProperties` (`magpie: board | asset`, `id`), not by name.
- Drive file ids are cached locally (board id → file id).

## Sync

- Saves are debounced 2s per board.
- Before uploading a board, compare Drive's `version` with the last one pulled. If it changed, download and merge first.
- Merge: per item, newest `updated` wins. Tombstones always merge. Board name uses the board's `updated`.
- Pull on app open and on window focus: list board files modified since the last pull, merge each.
- Tombstones older than 30 days are dropped.
- Status: saved, saving (only shown after 600ms), offline, error. Error offers retry or sign in again.

## Auth

- Google Identity Services token client, `drive.file` scope.
- Token in memory only. Refresh silently when it expires or a call returns 401; retry the call once.
- If silent refresh fails, sync shows "Sign in again". Local work continues.
- `PUBLIC_GOOGLE_CLIENT_ID` from env.

## Images

- On paste or drop: decode, scale so the long edge is at most 2000px, encode WebP around 0.82 quality. GIFs are kept as they are.
- Asset id = sha256 of the final bytes, so duplicates are stored once.
- Blob goes into IndexedDB at once, then into an upload queue for Drive.
- Loading: IndexedDB first, else download from Drive with the token and cache it. Render with blob URLs, revoke when unused.
- Assets are never deleted for now. Cleanup of unused assets can come later.

## Worker

Two endpoints, both GET, CORS limited to `ALLOWED_ORIGIN`, public http/https URLs only (400 otherwise), browser user agent, redirects followed, 5s timeout.

- `/preview?url=` → `{ url, title, desc, site, image }`, always 200 with whatever was found. Parsed with `HTMLRewriter` from the page head, up to `<body>`: title from og, twitter, `<title>`; desc from og, twitter, meta description; image from og, twitter; site from og:site_name, else the hostname. JSON-LD fills in title, desc and image when the tags are missing. Relative image URLs resolve against the final URL. An oEmbed endpoint, advertised by the page or known (Spotify), gives the title, thumbnail and provider. Spotify adds artist and kind from its embed page; Amazon reads on past `<body>` to the product image. Cached 1 day, failures 10 minutes.
- `/image?url=&ref=` → the image bytes, `ref` sent as Referer. Raster image types only, no SVG, max 10MB. The app compresses the result (1200px long edge) and saves it as an asset, so link thumbnails survive the site going away.

## Undo

- Every change is a command in `board.svelte.ts` that records item patches before and after.
- One history across boards, so moving cards between boards undoes cleanly. Capped at 200 steps, not persisted.
- Undo and redo just apply patches and bump `updated`, so they sync like any edit.

## Search

- In-memory index over all boards in IndexedDB, rebuilt on change.
- Fields: note text (markdown stripped), link title, desc, site and note, image captions, column names, board names.
- Hand-written fuzzy scorer: subsequence match with bonuses for word starts and consecutive letters. No dependency.

## Markdown

- Tiny hand-written renderer. Escape HTML first, then headings, bold, italic, lists, links, inline code.
- Links open in a new tab with `rel="noopener"`.

## Routing

- `/` is the home board, `/b/<id>` any other board.
- Unknown or deleted board ids go to home.

## Milestones

1. **Canvas and cards.** Model, board state, undo/redo, pan and zoom, all five card types styled from the design, add by paste, drop and double-click, select, marquee, move, resize, delete, duplicate. IndexedDB only. Link cards show just the URL.
2. **Columns and boards.** Drop into and out of columns, reorder, collapse. Nested boards, routing, breadcrumbs, open and close animation, board covers.
3. **Link previews.** Worker, link card loading, filled and fallback states, saved thumbnails.
4. **Drive.** Sign-in screen, auth, board sync and merge, asset upload and download, sync status.
5. **Search and polish.** Search overlay, context menu, move to board, remaining shortcuts, zoomed-out mode, dark theme toggle.

Each milestone ends with something to click through. Check it against the design before moving on.

## Open questions

- Should the board list be kept in Drive as well, for faster first load on a new device?
- Copy and paste of cards between boards: plain JSON on the clipboard, or app-internal only?
