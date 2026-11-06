import { beforeEach, expect, mock, test } from 'bun:test'
import type { board } from '../model'
import { merge } from './merge'

const idb = new Map<string, unknown>()
const key = (s: string, k: string) => `${s}/${k}`
mock.module('./db', () => ({
  get: async (s: string, k: string) => idb.get(key(s, k)),
  put: async (s: string, k: string, v: unknown) => void idb.set(key(s, k), v),
  del: async (s: string, k: string) => void idb.delete(key(s, k)),
  all: async (s: string) => [...idb].filter(([k]) => k.startsWith(`${s}/`)).map(([, v]) => v),
  keys: async (s: string) => [...idb.keys()].filter((k) => k.startsWith(`${s}/`)).map((k) => k.slice(s.length + 1))
}))

/** a fake drive holding one board file */
const remote = { file: '', version: 0, body: null as board | null }
const calls: string[] = []
const file = () => ({ id: remote.file, version: String(remote.version), modifiedTime: `t${remote.version}`, appProperties: { id: 'b' } })
const store = (b: board) => {
  remote.body = JSON.parse(JSON.stringify(b))
  remote.version++
  return file()
}
mock.module('./drive', () => ({
  findboard: async () => (calls.push('find'), remote.file ? file() : null),
  info: async () => (calls.push('info'), remote.file ? file() : null),
  modified: async () => (calls.push('list'), remote.file ? [file()] : []),
  download: async () => (calls.push('download'), JSON.parse(JSON.stringify(remote.body))),
  createboard: async (b: board) => (calls.push('create'), (remote.file = 'f1'), store(b)),
  updateboard: async (_: string, b: board) => (calls.push('update'), store(b)),
  putasset: async (id: string) => void calls.push(`asset ${id}`)
}))

const app = { boards: {} as Record<string, board>, sync: 'saved' }
mock.module('../board.svelte', () => ({
  app,
  absorb: (b: board) => (app.boards[b.id] = app.boards[b.id] ? merge(app.boards[b.id], b) : b)
}))

Object.assign(globalThis, { navigator: { onLine: true }, addEventListener: () => {} })
const { changed, flush, start, syncall } = await import('./sync')

const note = (id: string, updated: number, text: string) => ({ id, kind: 'note' as const, x: 0, y: 0, w: 256, z: 1, updated, text })
const local = (updated: number, items = [note('x', updated, 'mine')]) => (app.boards.b = { id: 'b', name: 'Board', items, updated })

beforeEach(() => {
  calls.length = 0
})

test('first sync creates the board file, then a sync with nothing new does nothing', async () => {
  idb.set('queue/pic', 1)
  idb.set('assets/pic', new Blob(['x']))
  local(1000, [{ ...note('x', 1000, 'mine'), kind: 'image', asset: 'pic' } as never])
  await start()
  expect(calls).toEqual(['list', 'asset pic', 'find', 'create'])
  expect(idb.has('queue/pic')).toBe(false)
  expect(app.sync).toBe('saved')
  calls.length = 0
  await syncall()
  expect(calls).toEqual(['list'])
})

test('same version on drive: upload straight away, no download', async () => {
  local(2000)
  expect(await flush()).toBe(true)
  expect(calls).toEqual(['info', 'update'])
  expect(remote.body?.items[0].text).toBe('mine')
})

test('drive moved on: download and merge before uploading', async () => {
  remote.body = { ...remote.body!, items: [...remote.body!.items, note('y', 2500, 'theirs')], updated: 2500 }
  remote.version++
  local(3000, [note('x', 3000, 'mine again')])
  expect(await flush()).toBe(true)
  expect(calls).toEqual(['info', 'download', 'update'])
  const texts = Object.fromEntries(remote.body!.items.map((i) => [i.id, i.text]))
  expect(texts).toEqual({ x: 'mine again', y: 'theirs' })
})

test('pull merges a newer file in and leaves a clean board clean', async () => {
  remote.body = { ...remote.body!, items: [note('x', 4000, 'from the other device')], updated: 4000 }
  remote.version++
  await syncall()
  expect(calls).toEqual(['list', 'download'])
  expect(app.boards.b.items.find((i) => i.id === 'x')?.text).toBe('from the other device')
})

test('a failed upload keeps the board dirty and shows the error, retry sends it', async () => {
  local(5000)
  const drive = await import('./drive')
  const real = drive.updateboard
  mock.module('./drive', () => ({ ...drive, updateboard: async () => Promise.reject(new Error('drive 500')) }))
  expect(await flush()).toBe(false)
  expect(app.sync).toBe('error')
  mock.module('./drive', () => ({ ...drive, updateboard: real }))
  calls.length = 0
  expect(await syncall()).toBe(true)
  expect(calls).toEqual(['list', 'info', 'update'])
  expect(app.sync).toBe('saved')
})

test('changes are debounced 2s per board', async () => {
  local(6000)
  changed('b')
  changed('b')
  expect(calls).toEqual([])
  await new Promise((r) => setTimeout(r, 2100))
  await flush()
  expect(calls).toEqual(['info', 'update'])
})
