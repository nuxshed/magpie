import { snap } from '../model'

export type box = { x: number; y: number; w: number; h: number }
type hit = { v: number; lines: box[] }

const flip = (r: box): box => ({ x: r.y, y: r.x, w: r.h, h: r.w })
const across = (a: box, b: box) => a.y < b.y + b.h && a.y + a.h > b.y
const dist = (h: hit, v: number) => Math.abs(h.v - v)

/** a vertical line at x reaching across both boxes */
function span(a: box, b: box, x: number): box {
  const y = Math.min(a.y, b.y)
  return { x, y, w: 0, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

/** a horizontal marker filling the gap between a and c */
function gap(a: box, c: box): box {
  return { x: a.x + a.w, y: (Math.max(a.y, c.y) + Math.min(a.y + a.h, c.y + c.h)) / 2, w: c.x - a.x - a.w, h: 0 }
}

/** x lining up b's left, right or center with the nearest card's */
function aligned(b: box, rs: box[], reach: number): hit | null {
  let best: (hit & { d: number; far: number }) | null = null
  for (const o of rs) {
    const pairs = b.w ? [[0, o.x], [b.w, o.x + o.w], [b.w / 2, o.x + o.w / 2]] : [[0, o.x], [0, o.x + o.w]]
    for (const [off, v] of pairs) {
      const d = Math.abs(v - off - b.x)
      const far = Math.abs(o.y - b.y)
      if (d > reach || (best && (d > best.d + 0.5 || (d > best.d - 0.5 && far >= best.far)))) continue
      best = { v: v - off, d, far, lines: [span(b, o, v)] }
    }
  }
  return best
}

/** x putting b in a row of cards at the gap they already share */
function spaced(b: box, rs: box[], reach: number): hit | null {
  const row = rs.filter((o) => across(o, b))
  const [l1, l2] = row.filter((o) => o.x + o.w <= b.x + reach).sort((a, c) => c.x + c.w - (a.x + a.w))
  const [r1, r2] = row.filter((o) => o.x >= b.x + b.w - reach).sort((a, c) => a.x - c.x)
  const at = (v: number) => ({ ...b, x: v })
  const opts: hit[] = []
  if (l1 && l2 && l2.x + l2.w < l1.x) {
    const v = l1.x + l1.w + (l1.x - l2.x - l2.w)
    opts.push({ v, lines: [gap(l2, l1), gap(l1, at(v))] })
  }
  if (r1 && r2 && r1.x + r1.w < r2.x) {
    const v = r1.x - (r2.x - r1.x - r1.w) - b.w
    opts.push({ v, lines: [gap(at(v), r1), gap(r1, r2)] })
  }
  if (l1 && r1 && l1.x + l1.w + b.w < r1.x) {
    const v = (l1.x + l1.w + r1.x - b.w) / 2
    opts.push({ v, lines: [gap(l1, at(v)), gap(at(v), r1)] })
  }
  return opts.filter((o) => dist(o, b.x) <= reach).sort((a, c) => dist(a, b.x) - dist(c, b.x))[0] ?? null
}

/** shift a moving box to line up with one card, or into an evenly spaced row, else onto the grid */
export function align(b: box, rs: box[], reach: number) {
  const fs = rs.map(flip)
  const pick = (r: box, list: box[], n: number) => aligned(r, list, n) ?? spaced(r, list, n)
  const x = pick(b, rs, reach)?.v ?? snap(b.x)
  const y = pick(flip(b), fs, reach)?.v ?? snap(b.y)
  const to = { ...b, x, y }
  const lines = [...(pick(to, rs, 0.5)?.lines ?? []), ...(pick(flip(to), fs, 0.5)?.lines ?? []).map(flip)]
  return { dx: x - b.x, dy: y - b.y, lines }
}

/** snap a moving vertical edge at v, on a card spanning y to y + h, onto another card's edge, else the grid */
export function edge(v: number, y: number, h: number, rs: box[], reach: number) {
  const x = aligned({ x: v, y, w: 0, h }, rs, reach)?.v ?? snap(v)
  return { v: x, lines: aligned({ x, y, w: 0, h }, rs, 0.5)?.lines ?? [] }
}
