import { bounds, items } from '../board.svelte'

export const view = $state({ x: 0, y: 0, zoom: 1 })
export const pointer = { x: 0, y: 0, inside: false }

const clamp = (z: number) => Math.min(4, Math.max(0.1, z))

export function toworld(sx: number, sy: number) {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom }
}

export function center() {
  return toworld(innerWidth / 2, innerHeight / 2)
}

/** where new cards go: the cursor, else the view center */
export function spot() {
  return pointer.inside ? toworld(pointer.x, pointer.y) : center()
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
