import { get, put } from './db'

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
  await put('assets', asset, blob)
  return { asset, aspect }
}

export const loadasset = (id: string) => get<Blob>('assets', id)
