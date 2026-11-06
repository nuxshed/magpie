import { absorb, app } from '../board.svelte'
import type { board } from '../model'
import { all, del, get, keys, put } from './db'
import * as drive from './drive'

export type status = 'saved' | 'saving' | 'offline' | 'error' | 'auth'

/** where a board lives on drive, its version there, and the local updated that matches it */
type meta = { id: string; file: string; version: string; at?: number }

const metas: Record<string, meta> = {}
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
let chain = Promise.resolve(true)
let slow: ReturnType<typeof setTimeout> | undefined
let pulled: string | undefined
let on = false

/** whether this device syncs: signed in and not on dev seed data */
export const syncing = () => on

function show(s: status) {
  clearTimeout(slow)
  slow = undefined
  app.sync = s
}

/** run drive work one job at a time, true when it went through */
function job(fn: () => Promise<unknown>) {
  return (chain = chain.then(async () => {
    if (!navigator.onLine) {
      show('offline')
      return false
    }
    try {
      await fn()
      show('saved')
      return true
    } catch (e) {
      const auth = e instanceof Error && e.message === 'auth'
      show(auth ? 'auth' : e instanceof TypeError || !navigator.onLine ? 'offline' : 'error')
      return false
    }
  }))
}

async function setmeta(m: meta) {
  metas[m.id] = m
  await put('sync', m.id, m)
}

/** assets a board shows */
const refs = (b: board) => [...b.items.flatMap((i) => [i.asset, i.thumb]), ...(b.cover ?? [])].filter((a) => !!a)

async function sendasset(id: string) {
  const blob = await get<Blob>('assets', id)
  if (blob) await drive.putasset(id, blob)
  await del('queue', id)
}

/** upload a board when it changed here, merging first when drive moved on since the last pull */
async function push(id: string) {
  const m = metas[id]
  if (!app.boards[id] || m?.at === app.boards[id].updated) return
  slow ??= setTimeout(() => (app.sync = 'saving'), 600)
  for (const a of new Set(refs(app.boards[id]))) if (await get('queue', a)) await sendasset(a)
  let file = m?.file ?? (await drive.findboard(id))?.id
  if (file) {
    const f = await drive.info(file)
    if (!f) file = undefined
    else if (f.version !== m?.version) absorb(await drive.download(file))
  }
  const b: board = JSON.parse(JSON.stringify(app.boards[id]))
  const f = file ? await drive.updateboard(file, b) : await drive.createboard(b)
  await setmeta({ id, file: f.id, version: f.version, at: b.updated })
}

/** push every board changed here, then any assets left in the queue */
async function pushall() {
  for (const id of Object.keys(app.boards)) await push(id)
  for (const a of await keys('queue')) await sendasset(a)
}

/** merge in every board file changed on drive since the last pull */
async function pull() {
  const files = await drive.modified(pulled)
  for (const f of files) {
    const id = f.appProperties?.id
    if (!id || metas[id]?.version === f.version) continue
    const theirs = await drive.download(f.id)
    const clean = !app.boards[id] || metas[id]?.at === app.boards[id].updated
    absorb(theirs)
    await setmeta({ id, file: f.id, version: f.version, at: clean ? app.boards[id].updated : metas[id]?.at })
  }
  const last = files.map((f) => f.modifiedTime ?? '').sort().at(-1)
  if (last && last > (pulled ?? '')) await put('sync', '.pulled', (pulled = last))
}

/** pull, then push what changed here */
export const syncall = () =>
  job(async () => {
    await pull()
    await pushall()
  })

/** a board changed locally, push it 2s after the last change */
export function changed(id: string) {
  if (!on) return
  clearTimeout(timers[id])
  timers[id] = setTimeout(() => {
    delete timers[id]
    job(pushall)
  }, 2000)
}

/** push pending changes now, true when nothing is left behind */
export function flush() {
  if (!on) return Promise.resolve(true)
  for (const id in timers) {
    clearTimeout(timers[id])
    delete timers[id]
  }
  return job(pushall)
}

/** stop syncing, for sign out */
export function stop() {
  on = false
  for (const id in timers) clearTimeout(timers[id])
  removeEventListener('focus', syncall)
  removeEventListener('online', syncall)
}

/** start syncing: load what was synced before, queue every local asset on the first sync, sync now, and again on focus and when back online */
export async function start() {
  for (const m of await all<meta | string>('sync')) if (typeof m === 'object') metas[m.id] = m
  pulled = await get<string>('sync', '.pulled')
  if (!Object.keys(metas).length) for (const a of await keys('assets')) await put('queue', a, 1)
  on = true
  addEventListener('focus', syncall)
  addEventListener('online', syncall)
  return syncall()
}
