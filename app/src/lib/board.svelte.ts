import { goto } from '$app/navigation'
import { newid, picture, widths, type board, type draft, type item } from './model'
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
  cropping: null as string | null,
  sync: 'saved' as status,
  ready: false
})

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
  if (!s) return
  future.push(s)
  replay(s, true)
}

export function redo() {
  const s = future.pop()
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

/** add cards on top of the open board, or into a column, and select them */
export function add(list: draft[], t?: target | null, meta: meta[] = []) {
  let z = topz()
  const now = Date.now()
  const made = list.map((d) => ({ ...d, id: newid(), z: ++z, updated: now }) as item)
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
  const own = list.map(picture).filter((a) => !!a)
  return [...new Set([...own, ...list.flatMap((i) => (i.kind === 'board' && i.board ? pictures(i.board, seen) : []))])]
}

/** a board's cover: pinned pictures, then its own, or those in its boards when it has none */
export function cover(id: string) {
  const b = app.boards[id]
  const all = pictures(id)
  const own = b?.items.filter((i) => !i.deleted).map(picture).filter((a) => !!a) ?? []
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
export function remove(ids: string[]) {
  const all = items()
  const gone = all.filter((i) => ids.includes(i.id) || ids.includes(i.parent ?? ''))
  const meta = gone
    .filter((i) => i.board && app.boards[i.board])
    .map((i) => ({ id: i.board!, before: { deleted: !!app.boards[i.board!].deleted }, after: { deleted: true } }))
  commit(patch(Object.fromEntries(gone.map((i) => [i.id, { deleted: true }]))), meta)
  app.sel = []
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
    const c: item = { ...$state.snapshot(i), id: map[i.id], z: ++z, updated: now }
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
  if (!last) return text.trim() ? update({ [id]: { text } }) : remove([id])
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
