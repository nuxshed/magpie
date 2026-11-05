import { PUBLIC_PREVIEW_URL } from '$app/env/public'
import { app, system } from '../board.svelte'
import type { item } from '../model'
import { saveimage } from './images'

const queue: string[] = []
const busy = new Set<string>()
let running = 0

const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const ask = (path: string, q: Record<string, string>) => fetch(`${PUBLIC_PREVIEW_URL}${path}?${new URLSearchParams(q)}`)

/** link cards on every board still waiting for a preview */
function pending(url?: string) {
  return Object.values(app.boards).flatMap((b) =>
    b.items.filter((i) => i.kind === 'link' && i.url && !i.deleted && !i.fetched && (!url || i.url === url))
  )
}

/** queue previews for these urls, or for every pending link card */
export function fetchpreviews(urls = pending().map((i) => i.url!)) {
  for (const u of urls)
    if (!busy.has(u)) {
      busy.add(u)
      queue.push(u)
    }
  pump()
}

function pump() {
  while (running < 3 && queue.length && navigator.onLine) {
    const u = queue.shift()!
    running++
    fill(u).finally(() => {
      running--
      busy.delete(u)
      pump()
    })
  }
}

/** save the preview image through the worker, compressed */
async function thumb(src: string, ref: string) {
  try {
    const r = await ask('/image', { url: src, ref })
    return r.ok ? (await saveimage(await r.blob(), 1200)).asset : undefined
  } catch {
    return undefined
  }
}

/** fetch one url's preview and fill in every card with it, leaving it pending only when offline */
async function fill(url: string) {
  const p: Partial<item> = {}
  try {
    const d = await (await ask('/preview', { url })).json()
    Object.assign(p, { title: text(d.title), desc: text(d.desc), site: text(d.site) })
    if (text(d.image)) p.thumb = await thumb(d.image, url)
  } catch {
    if (!navigator.onLine) return
  }
  system(Object.fromEntries(pending(url).map((i) => [i.id, { ...p, fetched: Date.now() }])))
}
