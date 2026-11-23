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
  added?: number        // ms timestamp when made, for newest first; older cards fall back to updated
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
  dest?: string         // pile only: the board it belongs to
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

Two preview endpoints, both GET, CORS limited to `ALLOWED_ORIGIN`, public http/https URLs only (400 otherwise), browser user agent, redirects followed, 5s timeout.

- `/preview?url=` → `{ url, title, desc, site, image }`, always 200 with whatever was found. Parsed with `HTMLRewriter` from the page head, up to `<body>`: title from og, twitter, `<title>`; desc from og, twitter, meta description; image from og, twitter; site from og:site_name, else the hostname. JSON-LD fills in title, desc and image when the tags are missing. Relative image URLs resolve against the final URL. An oEmbed endpoint, advertised by the page or known (Spotify), gives the title, thumbnail and provider. Spotify adds artist and kind from its embed page; Amazon reads on past `<body>` to the product image. Instagram posts and reels take the full size, uncropped picture (a reel's cover) from `instagram.com/p/<code>/media/?size=l`, since Instagram gives servers no preview tags. Cached 1 day, failures 10 minutes.
- Instagram link cards take their frame from the picture's own aspect (portrait for reels and most posts), not the wide link frame. They show a play mark, and opening one on desktop plays Instagram's own embed (`/p/<code>/embed/captioned/`) in an overlay, with Open on Instagram and Close; Escape or a click outside closes it. On touch screens it opens the post in Instagram instead.
- `/image?url=&ref=` → the image bytes, `ref` sent as Referer. Raster image types only, no SVG, max 10MB. The app compresses the result (1200px long edge) and saves it as an asset, so link thumbnails survive the site going away.

## Pile

Every board has two layers: the canvas, arranged by hand, and the pile, collected without effort. Things sent from the phone or pasted into the pile stay there until placed or removed; nothing needs to be arranged.


Send links and text from the phone through an iOS Shortcut in the share sheet.

- `/inbox` on the worker, guarded by `Authorization: Bearer <INBOX_KEY>` (a worker secret), kept in D1 (`schema.sql`).
- `POST` takes `{ "text": …, "board"?: …, "title"?: …, "desc"?: … }` as JSON or a raw text body. Title and desc are the page's og tags, read by the phone, which Instagram serves to phones but not to the worker. They are entity decoded, and an Instagram `Name on Instagram: "caption"` title splits into title and caption. `GET` returns `[{ id, text, board, title, caption }]` oldest first. `DELETE` takes a JSON array of ids.
- `/inbox/boards`: the app `PUT`s `Unsorted`, `Home`, then its live board paths like `Travel / Vietnam`, as plain text, one per line. It sends them only when they changed. The Shortcut `GET`s them to show a Choose from List.
- The app keeps the key in localStorage, set once per device by opening `/#inbox=<key>`.
- It pulls on open, on focus and every 30s while visible. Entries go into a hidden board with the id `inbox`, which syncs like any board but is never shown as a canvas. Each card keeps `dest`, the board its path names; `Unsorted` or an unknown path leaves it unsorted. The first URL in the text becomes a link card, anything else a note. The card takes the entry id, so two devices pulling at once merge into one card. A link already in the pile (compared without tracking parameters, and without the query on Instagram) moves to the top instead; one already on its board is skipped. Arrivals get no undo step; `order` holds the arrival time.
- A board's pile is the cards whose `dest` is that board. Unsorted cards, and cards whose board was deleted, belong to Home. Inside a board the pile shows its own cards and those of every board below it, so Home shows everything.
- A Canvas / Pile switch sits at the top centre (bottom right on phones); a pill glides between the two. I toggles it, Escape goes back to the canvas. The pile stays open while moving between boards; from the canvas, a board opens on its pile when its canvas is empty and its own pile is not.
- The pile view has a search field (title, description, text, site and url), then a row of the boards on the open board's canvas: cover, name and pile count. Clicking one opens its pile; dragging a card onto one moves the card to that board's pile. The view fades in, and cards rise in, a little staggered.
- Cards lay out in about 230px columns, newest first from left to right, each into the shortest column, two columns on phones. Picture cards keep their frame aspect, with a play mark on Instagram; notes show their text, links without a picture their title in the display face and the domain. Under each card: its title when it has a picture, the site, the board when it is below the open one, and how long ago it arrived. Pasting or dropping while the pile is open adds to it, as one undo step. The canvas controls are hidden there.
- Clicking a card opens its link (Instagram plays in the overlay on desktop, opens in Instagram on touch). Hovering shows icon buttons on the card (always shown on touch): Place puts it on its board's canvas, to the right of what is there; Move marks it for another board or unsorted; × removes it. Each is one undo step, and a placed card leaves the pile.
- Right click on a card, or a still 450ms press on touch, opens its menu: Open, Place, Move to… (a list of boards), Copy link, Remove. Right click on empty space: Paste, Add image…, Show the canvas, Up one level.
- Placing, sending, moving, removing, saving to the pile, moving cards to another board and deleting cards show a short message at the bottom with Undo, for 4.5s (held while hovered). Any later change or undo clears it. Copy link shows one without Undo.
- On a canvas the pile button in the bottom right, before the zoom controls, opens a tray listing the same cards, for dragging onto the canvas or into a column; Add places one in the middle of the view, clear of other cards when there is room, or below the last card in the flat view. Phones have no tray or zoom controls; the switch takes their place.
- Move to pile in a card's menu, and Pile at the top of Move to board, put cards in the open board's pile; a column gives up its cards and stays, board cards stay.
- Board cards count and show pictures from their board's pile along with its canvas.

## Flat view

- A second view of the open board with no free arrangement, toggled from the top bar or with V, remembered per device. Phones start in it.
- Board order: top level cards form lanes, cards whose sides overlap by more than half the narrower one, read left to right, each top to bottom. A column shows as a section, its name then its cards. Newest first sorts all cards but columns by `added`.
- Laid out in CSS columns about 300px wide, so the order runs down each column; one column on phones.
- Cards are the canvas cards without position, nothing drags or resizes and images don't crop. With a mouse, click selects and double click opens. On touch, a tap opens (a note edits, a link inside a note opens by itself) and a still press of 450ms selects and opens the card's menu; a scroll cancels both. The menu, delete and move work as on the canvas.
- Cards are 16px apart, 24px on phones. The list scrolls to the top on every board change.
- Anything added (keys, buttons, paste, drop, the inbox) goes on the canvas below the last card in board order, and the view scrolls to it.

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
