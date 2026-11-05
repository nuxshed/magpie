import { newid, widths, type board, type draft, type item } from './model'
import { all, put } from './store/db'

type change = { before: item | null; after: item }
type step = { board: string; changes: change[] }

export const app = $state({
  boards: {} as Record<string, board>,
  current: 'home',
  sel: [] as string[],
  editing: null as string | null,
  dragging: false,
  live: {} as Record<string, Partial<item>>,
  heights: {} as Record<string, number>,
  ready: false
})

const past: step[] = []
const future: step[] = []
const cap = 200

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

/** card bounds in world space, with any live drag or resize applied */
export function rect(i: item) {
  const l = app.live[i.id]
  return { x: l?.x ?? i.x, y: l?.y ?? i.y, w: l?.w ?? i.w, h: app.heights[i.id] ?? 0 }
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

function write(b: board, next: item) {
  const i = b.items.findIndex((x) => x.id === next.id)
  if (i < 0) b.items.push(next)
  else b.items[i] = next
}

function save(b: board) {
  b.updated = Date.now()
  put('boards', b.id, $state.snapshot(b))
}

function commit(changes: change[]) {
  const b = current()
  if (!b || !changes.length) return
  past.push({ board: b.id, changes })
  if (past.length > cap) past.shift()
  future.length = 0
  for (const c of changes) write(b, c.after)
  save(b)
}

function replay(s: step, back: boolean) {
  const b = app.boards[s.board]
  const now = Date.now()
  for (const { before, after } of s.changes) {
    write(b, { ...(back ? (before ?? { ...after, deleted: true }) : after), updated: now })
  }
  save(b)
  app.editing = null
  app.sel = s.changes.map((c) => c.after.id).filter((id) => getitem(id))
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

/** add cards on top of the open board and select them */
export function add(list: draft[]) {
  let z = topz()
  const now = Date.now()
  const made = list.map((d) => ({ ...d, id: newid(), z: ++z, updated: now }) as item)
  commit(made.map((after) => ({ before: null, after })))
  app.sel = made.map((i) => i.id)
  return made
}

/** patch cards by id */
export function update(patches: Record<string, Partial<item>>) {
  const now = Date.now()
  const changes: change[] = []
  for (const [id, p] of Object.entries(patches)) {
    const cur = getitem(id)
    if (!cur) continue
    const before = $state.snapshot(cur)
    changes.push({ before, after: { ...before, ...p, updated: now } })
  }
  commit(changes)
}

export function remove(ids: string[]) {
  update(Object.fromEntries(ids.map((id) => [id, { deleted: true }])))
  app.sel = []
}

/** copy cards 16px down-right */
export function duplicate(ids: string[]) {
  const list = items().filter((i) => ids.includes(i.id)).sort((a, b) => a.z - b.z)
  if (list.length) add(list.map((i) => ({ ...$state.snapshot(i), x: i.x + 16, y: i.y + 16 })))
}

export function nudge(ids: string[], dx: number, dy: number) {
  update(Object.fromEntries(ids.map((id) => [id, { x: getitem(id)!.x + dx, y: getitem(id)!.y + dy }])))
}

/** new empty note at a point, already editing */
export function addnote(at: { x: number; y: number }) {
  const [n] = add([{ kind: 'note', x: Math.round(at.x), y: Math.round(at.y), w: widths.note, text: '' }])
  app.editing = n.id
}

/** finish a note edit, folding it into the note's add step when it was just created */
export function settext(id: string, text: string) {
  const last = past.at(-1)?.changes
  const fresh = last?.length === 1 && !last[0].before && last[0].after.id === id
  if (!fresh) return text.trim() ? update({ [id]: { text } }) : remove([id])
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

/** swap the open board's cards and forget history, for the dev seed */
export function replace(list: draft[]) {
  const b = current()
  b.items = []
  add(list)
  past.length = future.length = 0
  app.sel = []
}

export async function load() {
  for (const b of await all<board>('boards')) app.boards[b.id] = b
  if (!app.boards.home) {
    app.boards.home = { id: 'home', name: 'Home', items: [], updated: Date.now() }
    save(app.boards.home)
  }
}
