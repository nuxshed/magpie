import { add, droptarget, type target } from '../board.svelte'
import { widths, type draft } from '../model'
import { saveimage } from '../store/images'
import { fetchpreviews } from '../store/preview'

type point = { x: number; y: number }

/** add image files in a row from a point, 24px apart */
export async function addfiles(files: File[], at: point, t?: target | null) {
  const made: draft[] = []
  let x = Math.round(at.x)
  for (const f of files.filter((f) => f.type.startsWith('image/'))) {
    try {
      const { asset, aspect } = await saveimage(f)
      made.push({ kind: 'image', x, y: Math.round(at.y), w: widths.image, asset, aspect })
      x += widths.image + 24
    } catch {
      continue
    }
  }
  if (made.length) add(made, t)
}

/** a url becomes a link card, anything else a note */
export function addtext(text: string, at: point, t?: target | null) {
  text = text.trim()
  if (!text) return
  const x = Math.round(at.x)
  const y = Math.round(at.y)
  if (/^https?:\/\/\S+$/.test(text)) {
    add([{ kind: 'link', x, y, w: widths.link, url: text }], t)
    fetchpreviews([text])
  } else add([{ kind: 'note', x, y, w: widths.note, text }], t)
}

/** paste or drop data at a point, into a column when over one */
export function adddata(data: DataTransfer | null, at: point) {
  if (!data) return
  const files = [...data.files]
  const t = droptarget(at)
  if (files.length) addfiles(files, at, t)
  else addtext(data.getData('text/uri-list').split('\n')[0] || data.getData('text/plain'), at, t)
}
