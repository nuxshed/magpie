import { app, bounds, droptarget, getitem, items, kids, rect, type target } from '../board.svelte'
import { snap } from '../model'

export const view = $state({ x: 0, y: 0, zoom: 1 })
export const pointer = { x: 0, y: 0, inside: false }

const clamp = (z: number) => Math.min(4, Math.max(0.1, z))

export function toworld(sx: number, sy: number) {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom }
}

/** true when a world box shows in the window */
export function onscreen(r: { x: number; y: number; w: number; h: number }) {
  const z = view.zoom
  return r.x * z + view.x < innerWidth && (r.x + r.w) * z + view.x > 0 && r.y * z + view.y < innerHeight && (r.y + r.h) * z + view.y > 0
}

export function center() {
  return toworld(innerWidth / 2, innerHeight / 2)
}

/** where new cards go: the cursor, else the view center */
export function spot() {
  return pointer.inside ? toworld(pointer.x, pointer.y) : center()
}

const space = 24

/** the nearest spot to a point where a w by h card overlaps nothing, preferring right and down */
function free(p: { x: number; y: number }, w: number, h: number) {
  const rs = items()
    .filter((i) => !i.parent)
    .map(rect)
  const hit = (x: number, y: number) =>
    rs.some((r) => x < r.x + r.w + space && x + w + space > r.x && y < r.y + r.h + space && y + h + space > r.y)
  const spots = []
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) spots.push({ x: p.x + i * space, y: p.y + j * space })
  const cost = (s: { x: number; y: number }) => {
    const dx = s.x - p.x
    const dy = s.y - p.y
    return Math.hypot(dx, dy) + (dx < 0 ? 200 : 0) + (dy < 0 ? 100 : 0)
  }
  return spots.sort((a, b) => cost(a) - cost(b)).find((s) => !hit(s.x, s.y)) ?? p
}

/** where a new card goes: after the selected or last added card when it is in view, else the cursor or view center, never on top of another card */
export function place(w: number, h: number, from = spot(), incol = true): { x: number; y: number; t: target | null } {
  const id = app.sel.length === 1 ? app.sel[0] : app.last
  let a = id ? getitem(id) : undefined
  if (a?.parent && !incol) a = getitem(a.parent)
  const r = a && rect(a)
  if (a && r && onscreen(r)) {
    if (a.parent) return { ...from, t: { col: a.parent, slot: kids(a.parent).findIndex((k) => k.id === a.id) + 1, h: 0 } }
    return { ...free({ x: r.x + r.w + space, y: r.y }, w, h), t: null }
  }
  const t = incol ? droptarget(from) : null
  if (t) return { ...from, t }
  return { ...free({ x: snap(from.x), y: snap(from.y) }, w, h), t: null }
}

/** zoom keeping a screen point still */
export function zoomat(z: number, sx = innerWidth / 2, sy = innerHeight / 2) {
  const w = toworld(sx, sy)
  view.zoom = clamp(z)
  view.x = sx - w.x * view.zoom
  view.y = sy - w.y * view.zoom
}

/** step zoom to the next 25% */
export function step(dir: 1 | -1) {
  const q = view.zoom * 4
  zoomat((dir > 0 ? Math.floor(q + 0.01) : Math.ceil(q - 0.01)) / 4 + dir * 0.25)
}

export function reset() {
  zoomat(1)
}

/** zoom to fit all cards, never past 100% */
export function fit() {
  const b = bounds(items())
  if (!b) return
  const pad = 64
  view.zoom = clamp(Math.min(1, (innerWidth - pad * 2) / b.w, (innerHeight - pad * 2) / b.h))
  view.x = innerWidth / 2 - (b.x + b.w / 2) * view.zoom
  view.y = innerHeight / 2 - (b.y + b.h / 2) * view.zoom
}
