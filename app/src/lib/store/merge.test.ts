import { expect, test } from 'bun:test'
import type { board, item } from '../model'
import { merge } from './merge'

const day = 864e5
const now = 100 * day

const card = (id: string, updated: number, more: Partial<item> = {}): item => ({ id, kind: 'note', x: 0, y: 0, w: 256, z: 1, updated, ...more })
const sheet = (items: item[], updated = now, more: Partial<board> = {}): board => ({ id: 'b', name: 'Board', items, updated, ...more })
const byid = (b: board) => Object.fromEntries(b.items.map((i) => [i.id, i]))

test('concurrent edits: newest wins per item, both sides keep their own changes', () => {
  const a = sheet([card('x', now - 10, { text: 'a' }), card('y', now - 50, { text: 'old' })])
  const b = sheet([card('x', now - 20, { text: 'b' }), card('y', now - 5, { text: 'new' })])
  const m = byid(merge(a, b, now))
  expect(m.x.text).toBe('a')
  expect(m.y.text).toBe('new')
})

test('cards added on either side are both kept', () => {
  const m = merge(sheet([card('x', now)]), sheet([card('y', now)]), now)
  expect(m.items.map((i) => i.id).sort()).toEqual(['x', 'y'])
})

test('delete vs edit: the later one wins, a tie goes to the delete', () => {
  const edit = card('x', now - 10, { text: 'edited' })
  expect(byid(merge(sheet([edit]), sheet([card('x', now - 5, { deleted: true })]), now)).x.deleted).toBe(true)
  expect(byid(merge(sheet([edit]), sheet([card('x', now - 20, { deleted: true })]), now)).x.deleted).toBeUndefined()
  expect(byid(merge(sheet([card('x', now, { deleted: true })]), sheet([card('x', now)]), now)).x.deleted).toBe(true)
  expect(byid(merge(sheet([card('x', now)]), sheet([card('x', now, { deleted: true })]), now)).x.deleted).toBe(true)
})

test('tombstones merge even when the other side never had the card', () => {
  const m = byid(merge(sheet([]), sheet([card('x', now - day, { deleted: true })]), now))
  expect(m.x.deleted).toBe(true)
})

test('tombstones older than 30 days are dropped, live cards are not', () => {
  const m = byid(merge(sheet([card('old', now - 31 * day, { deleted: true }), card('kept', now - 29 * day, { deleted: true })]), sheet([card('live', now - 90 * day)]), now))
  expect(m.old).toBeUndefined()
  expect(m.kept.deleted).toBe(true)
  expect(m.live).toBeDefined()
})

test('a card moved out of a column on one side and reordered in it on the other', () => {
  const out = card('x', now - 5, { x: 400, y: 300 })
  const inside = card('x', now - 10, { parent: 'col', order: 2 })
  expect(byid(merge(sheet([inside]), sheet([out]), now)).x.parent).toBeUndefined()
  expect(byid(merge(sheet([out]), sheet([{ ...inside, updated: now }]), now)).x.parent).toBe('col')
})

test('a card moved into a column while the column was deleted elsewhere', () => {
  const a = sheet([card('col', now - 10, { kind: 'column', deleted: true }), card('x', now - 10, { deleted: true, parent: 'col' })])
  const b = sheet([card('col', now - 20, { kind: 'column' }), card('x', now - 5, { parent: 'col', order: 0 })])
  const m = byid(merge(a, b, now))
  expect(m.col.deleted).toBe(true)
  expect(m.x.deleted).toBeUndefined()
})

test('board fields follow the newer board, updated is the latest of both', () => {
  const a = sheet([], now - 10, { name: 'Old name', cover: ['p'] })
  const b = sheet([], now - 5, { name: 'New name' })
  const m = merge(a, b, now)
  expect(m.name).toBe('New name')
  expect(m.cover).toBeUndefined()
  expect(m.updated).toBe(now - 5)
  expect(merge(b, a, now).name).toBe('New name')
})
