import { goto } from '$app/navigation'
import { coarse, igembed, newid, openlink, picture, widths, type board, type draft, type item } from './model'
import { all, put } from './store/db'
import { merge } from './store/merge'
import { changed, type status } from './store/sync'

type change = { before: item | null; after: item; board?: string }
type meta = { id: string; before: Partial<board>; after: Partial<board> }
type step = { board: string; changes: change[]; meta: meta[] }
type point = { x: number; y: number }
export type target = { col: string; slot: number; h: number }

export const app = $state({
  boards: {} as Record<string, board>,
  current: '',
  sel: [] as string[],
  editing: null as string | null,
  multi: false,
  dragging: false,
  live: {} as Record<string, Partial<item>>,
  heights: {} as Record<string, number>,
  target: null as target | null,
  over: null as string | null,
  last: null as string | null,
  visits: {} as Record<string, { n: number; seen: number }>,
  guides: [] as { x: number; y: number; w: number; h: number }[],
  menu: null as { x: number; y: number; pick?: boolean } | null,
  covering: null as string | null,
  playing: null as string | null,
  cropping: null as string | null,
  flat: false,
  pile: false,
  toast: null as { text: string; n: number; back: boolean } | null,
  sync: 'saved' as status,
  ready: false
})

let told = 0

/** show a short message, with an undo button for the last change unless back is false */
export function say(text: string, back = true) {
  app.toast = { text, n: ++told, back }
}

/** a count with its noun, like 1 card or 3 cards */
const many = (n: number, one: string) => (n === 1 ? `1 ${one}` : `${n} ${one}s`)

const past: step[] = []
const future: step[] = []
const cap = 200

export const head = 36
export const pad = 6
export const gap = 6

/** the open board */
export function current() {
  return app.boards[app.current]
}

/** cards on the open board, tombstones left out */
export function items() {
  return current()?.items.filter((i) => !i.deleted) ?? []
}

export function getitem(id: string) {
  return items().find((i) => i.id === id)
}

/** cards in a column, in order */
export function kids(col: string) {
  return items()
    .filter((i) => i.parent === col)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** a card picked up by a drag, floating on the canvas */
export function lifted(id: string) {
  return app.dragging && !!app.live[id]
}

/** card bounds in world space, with any live drag or resize applied */
export function rect(i: item): { x: number; y: number; w: number; h: number } {
  const l = app.live[i.id]
  const h = app.heights[i.id] ?? 0
  const col = i.parent && !l ? getitem(i.parent) : undefined
  if (!col) return { x: l?.x ?? i.x, y: l?.y ?? i.y, w: l?.w ?? i.w, h }
  const c = rect(col)
  let y = c.y + head
  for (const k of kids(col.id)) {
    if (k.id === i.id) break
    if (!lifted(k.id)) y += (app.heights[k.id] ?? 0) + gap
  }
  return { x: c.x + pad, y, w: c.w - pad * 2, h: col.collapsed ? 0 : h }
}

/** bounds around several cards */
export function bounds(list: item[]) {
  if (!list.length) return null
  const rs = list.map(rect)
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  const w = Math.max(...rs.map((r) => r.x + r.w)) - x
  const h = Math.max(...rs.map((r) => r.y + r.h)) - y
  return { x, y, w, h }
}

export function topz() {
  return items().reduce((z, i) => Math.max(z, i.z), 0)
}

/** the column under a point and the slot there, for cards being moved or added */
export function droptarget(p: point, moving: item[] = []): target | null {
  if (moving.some((i) => i.kind === 'column')) return null
  const col = items()
    .filter((i) => {
      if (i.kind !== 'column') return false
      const r = rect(i)
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
    })
    .sort((a, b) => b.z - a.z)[0]
  if (!col) return null
  const list = kids(col.id).filter((k) => !lifted(k.id))
  const slot = col.collapsed
    ? list.length
    : list.filter((k) => {
        const r = rect(k)
        return r.y + r.h / 2 < p.y
      }).length
  const h = moving.reduce((s, i) => s + (app.heights[i.id] ?? 0) + gap, -gap)
  return { col: col.id, slot, h: Math.max(0, h) }
}

/** the card under a point that takes the cards being moved: a board card, or a link card for one image */
export function cardat(p: point, moving: item[]) {
  const skip = new Set(moving.map((i) => i.id))
  const img = moving.length === 1 && moving[0].kind === 'image'
  return items()
    .filter((i) => {
      if (!(i.kind === 'board' || (img && i.kind === 'link')) || skip.has(i.id) || skip.has(i.parent ?? '')) return false
      const r = rect(i)
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
    })
    .sort((a, b) => b.z - a.z)[0]
}

/** move cards, with the cards in their columns, onto another board, to the right of what is there */
export function sendto(list: item[], dest: string) {
  const b = app.boards[dest]
  const moved = list.flatMap((i) => (i.kind === 'column' ? [i, ...kids(i.id)] : [i]))
  const tops = moved.filter((i) => !moved.some((j) => j.id === i.parent))
  const box = bounds(tops)
  if (!b || !box) return
  const there = b.items.filter((i) => !i.deleted && !i.parent)
  const x = there.length ? Math.max(...there.map((i) => i.x + i.w)) + 40 : 64
  const y = there.length ? Math.min(...there.map((i) => i.y)) : 96
  let z = b.items.reduce((m, i) => Math.max(m, i.z), 0)
  const now = Date.now()
  const changes: change[] = []
  for (const i of moved) {
    const before = $state.snapshot(i)
    const r = rect(i)
    const top = tops.includes(i) && {
      x: Math.round(x + r.x - box.x),
      y: Math.round(y + r.y - box.y),
      parent: undefined,
      order: undefined
    }
    changes.push({ before, after: { ...before, deleted: true, updated: now } })
    changes.push({ board: dest, before: null, after: { ...before, ...top, z: ++z, updated: now } })
  }
  const meta = moved
    .filter((i) => i.board && app.boards[i.board])
    .map((i) => ({ id: i.board!, before: { parent: app.current }, after: { parent: dest } }))
  commit(changes, meta)
  app.sel = []
  say(`Moved to ${b.name}`)
}

/** parent and order patches that put cards into a column at a slot */
export function into(t: target, ids: string[]) {
  const list = kids(t.col)
    .map((i) => i.id)
    .filter((id) => !ids.includes(id))
  list.splice(t.slot, 0, ...ids)
  return Object.fromEntries(list.map((id, order) => [id, { parent: t.col, order }]))
}

function write(b: board, next: item) {
  const i = b.items.findIndex((x) => x.id === next.id)
  if (i < 0) b.items.push(next)
  else b.items[i] = next
}

function save(b: board) {
  b.updated = Date.now()
  put('boards', b.id, $state.snapshot(b))
  changed(b.id)
}

function setmeta(m: meta, back: boolean) {
  const b = app.boards[m.id]
  Object.assign(b, back ? m.before : m.after)
  save(b)
}

function commit(changes: change[], meta: meta[] = []) {
  const b = current()
  if (!b || (!changes.length && !meta.length)) return
  app.toast = null
  past.push({ board: b.id, changes, meta })
  if (past.length > cap) past.shift()
  future.length = 0
  apply(b.id, changes.map((c) => [c.board, c.after]))
  for (const m of meta) setmeta(m, false)
}

/** write items to their boards, then save each board once */
function apply(home: string, list: [string | undefined, item][]) {
  const touched = new Set([home])
  for (const [id, it] of list) {
    write(app.boards[id ?? home], it)
    touched.add(id ?? home)
  }
  for (const id of touched) save(app.boards[id])
}

function replay(s: step, back: boolean) {
  const now = Date.now()
  apply(
    s.board,
    s.changes.map(({ before, after, board }) => [
      board,
      { ...(back ? (before ?? { ...after, deleted: true }) : after), updated: now }
    ])
  )
  for (const m of s.meta) setmeta(m, back)
  app.editing = null
  if (s.board !== app.current) goto(href(s.board))
  else app.sel = s.changes.map((c) => c.after.id).filter((id) => {
      const i = getitem(id)
      return i && !i.parent
    })
}

export function undo() {
  const s = past.pop()
  app.toast = null
  if (!s) return
  future.push(s)
  replay(s, true)
}

export function redo() {
  const s = future.pop()
  app.toast = null
  if (!s) return
  past.push(s)
  replay(s, false)
}

/** the last step, when it only added this card */
function fresh(id: string) {
  const last = past.at(-1)
  const c = last?.changes
  return last?.board === app.current && c?.length === 1 && !c[0].before && c[0].after.id === id ? last : null
}

/** item patches as changes */
function patch(patches: Record<string, Partial<item>>) {
  const now = Date.now()
  const changes: change[] = []
  for (const [id, p] of Object.entries(patches)) {
    const cur = getitem(id)
    if (!cur) continue
    const before = $state.snapshot(cur)
    changes.push({ before, after: { ...before, ...p, updated: now } })
  }
  return changes
}

/** patch cards on any board with no undo step, for previews and sync */
export function system(patches: Record<string, Partial<item>>) {
  const now = Date.now()
  for (const b of Object.values(app.boards)) {
    const hit = b.items.filter((i) => patches[i.id])
    for (const i of hit) Object.assign(i, patches[i.id], { updated: now })
    if (hit.length) save(b)
  }
  for (const s of [...past, ...future])
    for (const c of s.changes) {
      const p = patches[c.after.id]
      if (!p) continue
      Object.assign(c.after, p)
      if (c.before) Object.assign(c.before, p)
    }
}

/** merge in a board from drive, with no undo step and no new timestamps */
export function absorb(theirs: board) {
  const mine = app.boards[theirs.id]
  const next = mine ? merge($state.snapshot(mine), theirs) : theirs
  if (mine && JSON.stringify(next) === JSON.stringify(mine)) return
  const byid = new Map(next.items.map((i) => [i.id, i]))
  for (const s of [...past, ...future])
    for (const c of s.changes) {
      const i = byid.get(c.after.id)
      if (!i || i.updated <= c.after.updated) continue
      Object.assign(c.after, i)
      if (c.before) Object.assign(c.before, i)
    }
  app.boards[next.id] = next
  put('boards', next.id, $state.snapshot(app.boards[next.id]))
}

/** live boards by path from home, like "Travel / Japan", with home as "Home" */
export function paths() {
  const out: Record<string, string> = { Home: 'home' }
  for (const b of Object.values(app.boards)) {
    if (b.id === 'home' || !alive(b.id)) continue
    const names: string[] = []
    for (let p = b; p && p.id !== 'home'; p = app.boards[p.parent ?? '']) names.unshift(p.name)
    out[names.join(' / ')] ??= b.id
  }
  return out
}

/** a url without tracking bits, to spot the same link sent twice */
function plain(u = '') {
  try {
    const x = new URL(u)
    if (x.hostname.endsWith('instagram.com')) x.search = ''
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|si$|igsh|fbclid)/.test(k)) x.searchParams.delete(k)
    return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search
  } catch {
    return u
  }
}

/** put texts sent from the phone, with any title and caption the phone read, in the pile, marked for the board picked by path, links as link cards, with no undo step, and return the new urls; a link already in the pile moves to the top, one already on its board is skipped */
export function receive(list: { id: string; text: string; board?: string | null; title?: string | null; caption?: string | null }[]) {
  const ids = paths()
  const now = Date.now()
  const box = (app.boards.inbox ??= { id: 'inbox', name: 'Inbox', items: [], updated: 0 })
  const urls: string[] = []
  for (const { id, text, board, title, caption } of list) {
    if (box.items.some((i) => i.id === id)) continue
    const url = text.match(/https?:\/\/\S+/)?.[0]
    const dest = ids[board ?? '']
    if (url) {
      const key = plain(url)
      const old = waiting().find((i) => plain(i.url) === key)
      if (old) {
        write(box, { ...$state.snapshot(old), order: now, dest: dest ?? old.dest, updated: now })
        continue
      }
      if (app.boards[dest ?? '']?.items.some((i) => !i.deleted && plain(i.url) === key)) continue
    }
    const card = url
      ? { kind: 'link' as const, w: widths.link, url, title: title ?? undefined, desc: caption ?? undefined }
      : { kind: 'note' as const, w: widths.note, text }
    write(box, { ...card, id, x: 0, y: 0, z: 0, order: now, dest, updated: now, added: now })
    if (url) urls.push(url)
  }
  if (list.length) save(box)
  return urls
}

/** cards in the pile, newest first */
export function waiting() {
  return (app.boards.inbox?.items.filter((i) => !i.deleted) ?? []).sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
}

/** the board a pile card belongs to, home when unsorted or its board is gone */
export const owner = (i: item) => (i.dest && alive(i.dest) ? i.dest : 'home')

/** a board's pile, newest first */
export function piled(id: string) {
  return waiting().filter((i) => owner(i) === id)
}

/** true when a board is the top one or sits somewhere below it */
export function within(id: string, top: string) {
  for (let b = app.boards[id]; b; b = app.boards[b.parent ?? '']) if (b.id === top) return true
  return false
}

/** the pile of a board and of every board below it, newest first */
export function under(id: string) {
  return waiting().filter((i) => within(owner(i), id))
}

/** add cards to the open board's pile, as one undo step */
export function stash(list: draft[]) {
  const now = Date.now()
  const dest = app.current === 'home' ? undefined : app.current
  commit(list.map((d, n) => ({ board: 'inbox', before: null, after: { ...d, x: 0, y: 0, id: newid(), z: 0, order: now + n, dest, updated: now, added: now } as item })))
  say(`${list.length === 1 ? 'Saved' : many(list.length, 'card') + ' saved'} to the pile`)
}

/** move a card out of the inbox onto the open board at a point, into a column there, or onto its own board to the right of what is there */
export function unbox(id: string, at?: point, t = at && droptarget(at)) {
  const it = waiting().find((i) => i.id === id)
  const b = it && app.boards[at ? app.current : owner(it)]
  if (!it || !b || !alive(b.id)) return
  const before = $state.snapshot(it)
  const now = Date.now()
  const there = b.items.filter((i) => !i.deleted && !i.parent)
  const x = at ? at.x : there.length ? Math.max(...there.map((i) => i.x + i.w)) + 40 : 64
  const y = at ? at.y : there.length ? Math.min(...there.map((i) => i.y)) : 96
  const card: item = { ...before, x: Math.round(x), y: Math.round(y), z: b.items.reduce((m, i) => Math.max(m, i.z), 0) + 1, order: undefined, dest: undefined, deleted: false, updated: now }
  const p = t ? into(t, [id]) : {}
  Object.assign(card, p[id])
  delete p[id]
  commit([
    { board: 'inbox', before, after: { ...before, deleted: true, updated: now } },
    { board: b.id, before: null, after: card },
    ...patch(p)
  ])
  if (at) app.sel = [id]
  say(at ? 'Added to the canvas' : `Placed on ${b.name}`)
}

/** drop a card from the inbox */
export function discard(id: string) {
  const it = waiting().find((i) => i.id === id)
  if (!it) return
  const before = $state.snapshot(it)
  commit([{ board: 'inbox', before, after: { ...before, deleted: true, updated: Date.now() } }])
  say('Removed from the pile')
}

/** move cards off the open board into the inbox, marked for this board, columns giving up their cards */
export function tobox(ids: string[]) {
  const box = (app.boards.inbox ??= { id: 'inbox', name: 'Inbox', items: [], updated: 0 })
  const list = items().filter((i) => (ids.includes(i.id) || ids.includes(i.parent ?? '')) && i.kind !== 'column' && i.kind !== 'board')
  if (!list.length) return
  const now = Date.now()
  const changes: change[] = []
  for (const i of list) {
    const before = $state.snapshot(i)
    const old = box.items.find((x) => x.id === i.id)
    changes.push({ before, after: { ...before, deleted: true, updated: now } })
    changes.push({ board: 'inbox', before: old ? $state.snapshot(old) : null, after: { ...before, parent: undefined, order: now, dest: app.current, updated: now } })
  }
  commit(changes)
  app.sel = []
  say(`${list.length === 1 ? 'Moved' : many(list.length, 'card') + ' moved'} to the pile`)
}

/** mark an inbox card for another board, or none for unsorted */
export function redirect(id: string, dest?: string) {
  const it = waiting().find((i) => i.id === id)
  if (!it) return
  const before = $state.snapshot(it)
  commit([{ board: 'inbox', before, after: { ...before, dest, updated: Date.now() } }])
  say(`Moved to ${dest ? app.boards[dest]?.name : 'Unsorted'}`)
}

/** top level cards in reading order: lanes of cards that overlap sideways, left to right, each top to bottom */
export function flatorder() {
  const lanes: { x0: number; x1: number; list: item[] }[] = []
  for (const i of items()
    .filter((i) => !i.parent)
    .sort((a, b) => a.x - b.x)) {
    const l = lanes.at(-1)
    const overlap = l ? Math.min(l.x1, i.x + i.w) - Math.max(l.x0, i.x) : 0
    if (l && overlap > Math.min(i.w, l.x1 - l.x0) / 2) {
      l.list.push(i)
      l.x1 = Math.max(l.x1, i.x + i.w)
    } else lanes.push({ x0: i.x, x1: i.x + i.w, list: [i] })
  }
  return lanes.flatMap((l) => l.list.sort((a, b) => a.y - b.y))
}

/** switch between the canvas and the flat view, remembered on this device */
export function setflat(on: boolean) {
  app.flat = on
  app.sel = []
  app.editing = null
  app.menu = null
  localStorage.setItem('flat', on ? '1' : '0')
}

/** switch between the canvas and the pile */
export function setpile(on: boolean) {
  app.pile = on
  app.sel = []
  app.editing = null
  app.menu = null
}

/** open a pile card's link, playing instagram in the overlay on desktop */
export function peek(i: item) {
  if (i.kind !== 'link') return
  if (igembed(i.url) && !coarse()) app.playing = i.url!
  else openlink(i.url)
}

/** the spot after the last card in reading order, below the last lane */
export function tail() {
  const last = flatorder().at(-1)
  if (!last) return { x: 64, y: 96 }
  return { x: last.x, y: Math.round(last.y + (app.heights[last.id] ?? 200) + 24) }
}

/** add cards on top of the open board, or into a column, and select them */
export function add(list: draft[], t?: target | null, meta: meta[] = []) {
  let z = topz()
  const now = Date.now()
  const made = list.map((d) => ({ ...d, id: newid(), z: ++z, updated: now, added: now }) as item)
  const p = t ? into(t, made.map((i) => i.id)) : {}
  for (const i of made) Object.assign(i, p[i.id])
  commit([...made.map((after) => ({ before: null, after })), ...patch(p)], meta)
  app.sel = made.map((i) => i.id)
  app.last = made.at(-1)?.id ?? null
  return made
}

/** patch cards by id */
export function update(patches: Record<string, Partial<item>>) {
  commit(patch(patches))
}

/** pictures shown by cards on a board, then those in its boards */
export function pictures(id: string, seen = new Set<string>()): string[] {
  const list = app.boards[id]?.items.filter((i) => !i.deleted)
  if (!list || seen.has(id)) return []
  seen.add(id)
  const own = [...list, ...piled(id)].map(picture).filter((a) => !!a)
  return [...new Set([...own, ...list.flatMap((i) => (i.kind === 'board' && i.board ? pictures(i.board, seen) : []))])]
}

/** a board's cover: pinned pictures, then its own, or those in its boards when it has none */
export function cover(id: string) {
  const b = app.boards[id]
  const all = pictures(id)
  const own = [...(b?.items.filter((i) => !i.deleted) ?? []), ...piled(id)].map(picture).filter((a) => !!a)
  return [...new Set([...(b?.cover ?? []).filter((a) => all.includes(a)), ...(own.length ? own : all)])].slice(0, 3)
}

/** set a board's pinned cover pictures, none for automatic */
export function setcover(id: string, cover: string[] = []) {
  const b = app.boards[id]
  if (b) commit([], [{ id, before: { cover: b.cover }, after: { cover: cover.length ? cover : undefined } }])
}

/** start cropping a card's picture */
export function startcrop(id: string) {
  app.sel = [id]
  app.menu = null
  app.cropping = id
}

/** finish cropping, keeping the draft or dropping it */
export function endcrop(save: boolean) {
  const id = app.cropping
  if (!id) return
  const l = app.live[id]
  if (save && l && 'crop' in l) update({ [id]: { crop: l.crop } })
  delete app.live[id]
  app.cropping = null
}

/** use an image card as a link's image, taking the image card off the board */
export function linkimage(link: string, img: item) {
  update({ [link]: { thumb: img.asset }, [img.id]: { deleted: true } })
  app.sel = [link]
}

/** align the text of notes */
export function setalign(ids: string[], to: 'left' | 'center' | 'right') {
  const align = to === 'left' ? undefined : to
  const notes = items().filter((i) => ids.includes(i.id) && i.kind === 'note' && i.align !== align)
  if (notes.length) update(Object.fromEntries(notes.map((i) => [i.id, { align }])))
}

/** switch links to compact, or back to large when they all are */
export function togglelayout(ids: string[]) {
  const links = items().filter((i) => ids.includes(i.id) && i.kind === 'link')
  const layout = links.every((i) => i.layout === 'compact') ? 'large' : 'compact'
  update(Object.fromEntries(links.map((i) => [i.id, { layout }])))
}

/** delete cards, with the cards in their columns, and mark their boards deleted */
export function remove(ids: string[], tell = true) {
  const all = items()
  const gone = all.filter((i) => ids.includes(i.id) || ids.includes(i.parent ?? ''))
  const meta = gone
    .filter((i) => i.board && app.boards[i.board])
    .map((i) => ({ id: i.board!, before: { deleted: !!app.boards[i.board!].deleted }, after: { deleted: true } }))
  commit(patch(Object.fromEntries(gone.map((i) => [i.id, { deleted: true }]))), meta)
  app.sel = []
  const n = gone.filter((i) => !gone.some((j) => j.id === i.parent)).length
  if (tell && n) say(n === 1 ? 'Deleted' : `${many(n, 'card')} deleted`)
}

/** copy a board and the boards inside it */
function clone(id: string, parent: string): string {
  const src = app.boards[id]
  const nid = newid()
  const live = src.items.filter((i) => !i.deleted)
  const map = Object.fromEntries(live.map((i) => [i.id, newid()]))
  app.boards[nid] = {
    id: nid,
    name: src.name,
    parent,
    updated: Date.now(),
    items: live.map((i) => ({
      ...$state.snapshot(i),
      id: map[i.id],
      parent: i.parent && map[i.parent],
      board: i.board && app.boards[i.board] ? clone(i.board, nid) : i.board
    }))
  }
  save(app.boards[nid])
  return nid
}

/** copy cards 16px down-right, columns with their cards, boards deep */
export function duplicate(ids: string[]) {
  const picked = items()
    .filter((i) => ids.includes(i.id) && !ids.includes(i.parent ?? ''))
    .sort((a, b) => a.z - b.z)
  if (!picked.length) return
  const list = picked.flatMap((i) => (i.kind === 'column' ? [i, ...kids(i.id)] : [i]))
  const map = Object.fromEntries(list.map((i) => [i.id, newid()]))
  const meta: meta[] = []
  let z = topz()
  const now = Date.now()
  const made = list.map((i) => {
    const c: item = { ...$state.snapshot(i), id: map[i.id], z: ++z, updated: now, added: now }
    if (c.parent && map[c.parent]) c.parent = map[c.parent]
    else if (c.parent) c.order = (c.order ?? 0) + 0.5
    else Object.assign(c, { x: c.x + 16, y: c.y + 16 })
    if (i.board && app.boards[i.board]) {
      c.board = clone(i.board, app.current)
      app.boards[c.board].deleted = true
      meta.push({ id: c.board, before: { deleted: true }, after: { deleted: false } })
    }
    return c
  })
  commit(
    made.map((after) => ({ before: null, after })),
    meta
  )
  app.sel = picked.map((i) => map[i.id])
}

export function nudge(ids: string[], dx: number, dy: number) {
  update(Object.fromEntries(ids.map((id) => [id, { x: getitem(id)!.x + dx, y: getitem(id)!.y + dy }])))
}

/** move canvas cards within about two notes below a note or column that grew or shrank, and the cards below those, so spacing stays */
export function reflow(id: string, from: number, to: number) {
  const i = getitem(id)
  if (!i || i.parent || (i.kind !== 'note' && i.kind !== 'column')) return
  const reach = 80
  const pushed = [{ ...rect(i), h: from }]
  const patches: Record<string, Partial<item>> = {}
  for (const k of items()
    .filter((k) => !k.parent && k.id !== id)
    .sort((a, b) => a.y - b.y)) {
    const r = rect(k)
    const below = pushed.some((p) => {
      const d = r.y - (p.y + p.h)
      return d >= 0 && d <= reach && r.x < p.x + p.w && r.x + r.w > p.x
    })
    if (!below) continue
    pushed.push(r)
    patches[k.id] = { y: k.y + to - from }
  }
  if (Object.keys(patches).length) system(patches)
}

/** new empty note at a point, already editing */
export function addnote(at: point, t = droptarget(at)) {
  const [n] = add([{ kind: 'note', x: Math.round(at.x), y: Math.round(at.y), w: widths.note, text: '' }], t)
  app.editing = n.id
}

/** new column at a point, already renaming */
export function addcolumn(at: point) {
  const [c] = add([{ kind: 'column', x: Math.round(at.x), y: Math.round(at.y), w: widths.column, name: 'Untitled' }])
  app.editing = c.id
}

/** new board card and its empty board, already renaming */
export function addboard(at: point, t = droptarget(at)) {
  const id = newid()
  app.boards[id] = { id, name: 'Untitled', parent: app.current, items: [], updated: Date.now(), deleted: true }
  const [c] = add(
    [{ kind: 'board', x: Math.round(at.x), y: Math.round(at.y), w: widths.board, board: id }],
    t,
    [{ id, before: { deleted: true }, after: { deleted: false } }]
  )
  app.editing = c.id
}

/** put cards in a new column at their top left, in reading order */
export function makecolumn(ids: string[]) {
  const list = items()
    .filter((i) => ids.includes(i.id) && i.kind !== 'column')
    .map((i) => ({ i, r: rect(i) }))
    .sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x)
    .map((x) => x.i)
  const b = bounds(list)
  if (list.length < 2 || !b) return
  const col: item = {
    kind: 'column',
    id: newid(),
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: widths.column,
    z: topz() + 1,
    name: 'Untitled',
    updated: Date.now()
  }
  commit([
    { before: null, after: col },
    ...patch(Object.fromEntries(list.map((i, order) => [i.id, { parent: col.id, order }])))
  ])
  app.sel = [col.id]
}

/** rename a column, or the board behind a board card */
export function rename(id: string, name: string) {
  const it = getitem(id)
  name = name.trim()
  if (!it || !name) return
  const last = fresh(id)
  if (it.kind === 'column') {
    if (name === it.name) return
    if (!last) return update({ [id]: { name } })
    write(current(), (last.changes[0].after = { ...last.changes[0].after, name }))
    return save(current())
  }
  const b = it.board ? app.boards[it.board] : undefined
  if (!b || name === b.name) return
  if (!last?.meta.length) return commit([], [{ id: b.id, before: { name: b.name }, after: { name } }])
  b.name = name
  save(b)
}

/** finish a note edit, folding it into the note's add step when it was just created */
export function settext(id: string, text: string) {
  const last = fresh(id)?.changes
  if (!last) return text.trim() ? update({ [id]: { text } }) : remove([id], false)
  const b = current()
  const now = Date.now()
  if (text.trim()) write(b, (last[0].after = { ...last[0].after, text, updated: now }))
  else {
    past.pop()
    write(b, { ...last[0].after, deleted: true, updated: now })
    app.sel = []
  }
  save(b)
}

/** a board's url */
export function href(id: string) {
  return id === 'home' ? '/' : `/b/${id}`
}

/** true when a board and every board above it are live */
export function alive(id: string) {
  for (let b = app.boards[id]; b; b = app.boards[b.parent ?? '']) {
    if (b.deleted) return false
    if (b.id === 'home') return true
  }
  return false
}

export function up() {
  const p = current()?.parent
  if (p) goto(href(p))
}

/** open the selected board card, else the child board visited most often and most lately */
export function deeper() {
  const one = app.sel.length === 1 ? getitem(app.sel[0]) : undefined
  if (one?.kind === 'board') return openboard(one)
  const score = (id = '') => {
    const v = app.visits[id]
    return v ? v.n * 0.5 ** ((Date.now() - v.seen) / 864e5) : 0
  }
  const best = items()
    .filter((i) => i.kind === 'board' && i.board && alive(i.board))
    .sort((a, b) => score(b.board) - score(a.board) || a.y - b.y || a.x - b.x)[0]
  if (best) openboard(best)
}

/** open the board behind a board card */
export function openboard(i: item) {
  if (i.board) goto(href(i.board))
}

/** swap in whole boards and forget history, for the dev seed */
export function setboards(list: board[]) {
  for (const b of list) {
    app.boards[b.id] = b
    save(b)
  }
  past.length = future.length = 0
  app.sel = []
}

export async function load() {
  for (const b of await all<board>('boards')) app.boards[b.id] = b
  if (!app.boards.home) {
    app.boards.home = { id: 'home', name: 'Home', items: [], updated: 0 }
    put('boards', 'home', $state.snapshot(app.boards.home))
  }
}
