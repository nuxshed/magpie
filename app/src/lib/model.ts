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
export const widths = { image: 260, link: 256, note: 256 }

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** random 12 char id */
export function newid() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => chars[b % 36]).join('')
}
