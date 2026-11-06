import type { board, item } from '../model'

const ttl = 30 * 864e5

/** merge two copies of a board: per item the newest wins, a tie goes to the tombstone, board fields follow the newer board */
export function merge(a: board, b: board, now = Date.now()): board {
  const top = b.updated > a.updated ? b : a
  const byid = new Map<string, item>()
  for (const i of [...a.items, ...b.items]) {
    const o = byid.get(i.id)
    if (!o || i.updated > o.updated || (i.updated === o.updated && i.deleted && !o.deleted)) byid.set(i.id, i)
  }
  const items = [...byid.values()].filter((i) => !i.deleted || now - i.updated < ttl)
  return { ...top, items, updated: Math.max(a.updated, b.updated) }
}

/** true when b already holds everything in a: every item at the same or a newer version, and board fields at least as new */
export function covers(b: board, a: board) {
  const seen = new Map(b.items.map((i) => [i.id, i.updated]))
  return b.updated >= a.updated && a.items.every((i) => (seen.get(i.id) ?? -1) >= i.updated)
}
