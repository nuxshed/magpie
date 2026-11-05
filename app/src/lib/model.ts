export type kind = 'image' | 'link' | 'note' | 'column' | 'board'

export type item = {
  id: string
  kind: kind
  x: number
  y: number
  w: number
  z: number
  parent?: string
  order?: number
  updated: number
  deleted?: boolean

  asset?: string
  aspect?: number
  caption?: string

  url?: string
  title?: string
  desc?: string
  site?: string
  thumb?: string
  layout?: 'large' | 'compact'
  note?: string
  fetched?: number

  text?: string

  name?: string
  collapsed?: boolean

  board?: string
}

export type board = {
  id: string
  name: string
  parent?: string
  items: item[]
  updated: number
  deleted?: boolean
}

export type draft = Omit<item, 'id' | 'z' | 'updated'>

export const minw = 160
export const grid = 8

/** round to the nearest grid line */
export const snap = (n: number) => Math.round(n / grid) * grid
export const widths = { image: 260, link: 256, note: 256, column: 272, board: 220 }

/** open a link in a new tab, http and https only */
export function openlink(url = '') {
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener')
}

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** random 12 char id */
export function newid() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => chars[b % 36]).join('')
}
