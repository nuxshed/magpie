import { get, put } from './db'
import { getasset } from './drive'
import { syncing } from './sync'

const maxedge = 2000

async function hash(blob: Blob) {
  const sum = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(sum), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** compress an image, store it once by hash, return its asset id and aspect */
export async function saveimage(file: Blob, edge = maxedge) {
  const bmp = await createImageBitmap(file)
  const aspect = bmp.width / bmp.height
  let blob = file
  if (file.type !== 'image/gif') {
    const k = Math.min(1, edge / Math.max(bmp.width, bmp.height))
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k))
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    blob = await c.convertToBlob({ type: 'image/webp', quality: 0.82 })
  }
  bmp.close()
  const asset = await hash(blob)
  if (!(await get('assets', asset))) {
    await put('assets', asset, blob)
    await put('queue', asset, 1)
  }
  return { asset, aspect }
}

const loading: Record<string, Promise<Blob | undefined>> = {}

/** an asset from indexeddb, else from drive, cached once downloaded */
export async function loadasset(id: string) {
  const local = await get<Blob>('assets', id)
  if (local || !syncing()) return local
  return (loading[id] ??= getasset(id)
    .then(async (b) => {
      if (b) await put('assets', id, b)
      return b
    })
    .catch(() => undefined)
    .finally(() => delete loading[id]))
}
