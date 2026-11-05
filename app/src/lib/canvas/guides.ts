import { snap } from '../model'

export type box = { x: number; y: number; w: number; h: number }

const flip = (r: box): box => ({ x: r.y, y: r.x, w: r.h, h: r.w })
const across = (a: box, b: box) => a.y < b.y + b.h && a.y + a.h > b.y
const same = (a: number, b: number) => Math.abs(a - b) < 0.5

/** gaps between cards side by side along x */
function gaps(rs: box[]) {
  const out: number[] = []
  for (const a of rs)
    for (const c of rs) {
      const g = c.x - (a.x + a.w)
      if (g > 0 && g < 400 && across(a, c)) out.push(g)
    }
  return out
}

/**
 * best x for b: edges and centers of other cards first, then the gaps already used between them
 * side 1 or -1 moves only b's right or left edge, as when resizing
 */
function fit(b: box, rs: box[], reach: number, side: number) {
  const near = rs.filter((o) => across(o, b))
  const gs = gaps(near)
  const edges: number[] = []
  const want: number[] = []
  for (const o of rs) {
    if (side) edges.push(o.x, o.x + o.w)
    else edges.push(o.x, o.x + o.w - b.w, o.x + (o.w - b.w) / 2)
  }
  for (const o of near) {
    const r = o.x + o.w
    if (side <= 0 && r <= b.x + reach) for (const g of gs) want.push(r + g)
    if (side >= 0 && o.x >= b.x + b.w - reach) for (const g of gs) want.push(o.x - g - b.w)
    if (!side) for (const q of near) if (q.x > r + b.w) want.push((r + q.x - b.w) / 2)
  }
  return closest(edges, b.x, reach) ?? closest(want, b.x, reach)
}

/** the value nearest v within reach */
function closest(list: number[], v: number, reach: number) {
  const best = list.sort((a, c) => Math.abs(a - v) - Math.abs(c - v))[0]
  return best !== undefined && Math.abs(best - v) <= reach ? best : null
}

/** guide lines for b along x: shared edges and centers, and gaps equal to b's own */
function lines(b: box, rs: box[], side: number) {
  const out: box[] = []
  const edges = (r: box) => (side ? [r.x, r.x + r.w] : [r.x, r.x + r.w, r.x + r.w / 2])
  for (const o of rs)
    for (const v of edges(b))
      if (edges(o).some((u) => same(u, v))) {
        const y = Math.min(b.y, o.y)
        out.push({ x: v, y, w: 0, h: Math.max(b.y + b.h, o.y + o.h) - y })
      }
  const near = rs.filter((o) => across(o, b))
  const all = [...near, b]
  const own = near.flatMap((o) => [b.x - (o.x + o.w), o.x - (b.x + b.w)]).filter((g) => g > 0)
  const g = Math.min(...own)
  if (side || !isFinite(g)) return out
  for (const a of all)
    for (const c of all)
      if (across(a, c) && same(c.x - (a.x + a.w), g)) {
        const y = (Math.max(a.y, c.y) + Math.min(a.y + a.h, c.y + c.h)) / 2
        out.push({ x: a.x + a.w, y, w: g, h: 0 })
      }
  return out
}

/** shift a moving box onto guides from other cards, else onto the grid */
export function align(b: box, rs: box[], reach: number) {
  const x = fit(b, rs, reach, 0) ?? snap(b.x)
  const y = fit(flip(b), rs.map(flip), reach, 0) ?? snap(b.y)
  const to = { ...b, x, y }
  return { dx: x - b.x, dy: y - b.y, lines: [...lines(to, rs, 0), ...lines(flip(to), rs.map(flip), 0).map(flip)] }
}

/** snap a moving vertical edge of a card spanning y to h onto other cards' edges or gaps, else the grid */
export function edge(v: number, y: number, h: number, rs: box[], reach: number, side: 1 | -1) {
  const b = { x: v, y, w: 0, h }
  const x = fit(b, rs, reach, side) ?? snap(v)
  return { v: x, lines: lines({ ...b, x }, rs, side) }
}
