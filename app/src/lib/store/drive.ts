import { call } from '../auth'
import { newid, type board } from '../model'

type file = { id: string; version: string; modifiedTime?: string; trashed?: boolean; appProperties?: Record<string, string> }

const api = 'https://www.googleapis.com/drive/v3/files'
const up = 'https://www.googleapis.com/upload/drive/v3/files'
const fields = 'id,version,modifiedTime,trashed,appProperties'

let folders: Promise<Record<string, string>> | undefined

async function req(url: string, init?: RequestInit) {
  const res = await call(url, init)
  if (!res.ok) throw new Error(`drive ${res.status}`)
  return res
}

/** files matching appProperties, not trashed, following pages */
async function find(props: Record<string, string>, extra = '') {
  const q = [...Object.entries(props).map(([k, v]) => `appProperties has { key='${k}' and value='${v}' }`), 'trashed = false', extra]
    .filter(Boolean)
    .join(' and ')
  const list: file[] = []
  let page = ''
  do {
    const p = new URLSearchParams({ q, fields: `nextPageToken,files(${fields})`, pageSize: '1000', spaces: 'drive' })
    if (page) p.set('pageToken', page)
    const r = await (await req(`${api}?${p}`)).json()
    list.push(...r.files)
    page = r.nextPageToken ?? ''
  } while (page)
  return list
}

/** a metadata and content upload in one request */
async function create(meta: object, body: Blob | string, type: string): Promise<file> {
  const b = `magpie${newid()}`
  const head = (t: string) => `--${b}\r\nContent-Type: ${t}\r\n\r\n`
  const data = new Blob([head('application/json; charset=UTF-8'), JSON.stringify(meta), '\r\n', head(type), body, `\r\n--${b}--`])
  const res = await req(`${up}?uploadType=multipart&fields=${fields}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: data
  })
  return res.json()
}

/** the Magpie folder with boards/ and assets/, made on first sync */
function folder(name: 'boards' | 'assets') {
  folders ??= (async () => {
    const found = Object.fromEntries((await find({ magpie: 'folder' })).map((f) => [f.appProperties?.id, f.id]))
    const make = async (id: string, name: string, parent?: string) => {
      if (found[id]) return found[id]
      const meta = { name, mimeType: 'application/vnd.google-apps.folder', parents: parent && [parent], appProperties: { magpie: 'folder', id } }
      const res = await req(`${api}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) })
      return (found[id] = (await res.json()).id)
    }
    const root = await make('root', 'Magpie')
    await make('boards', 'boards', root)
    await make('assets', 'assets', root)
    return found
  })().catch((e) => {
    folders = undefined
    throw e
  })
  return folders.then((f) => f[name])
}

/** a file's version, null when it is gone or trashed */
export async function info(id: string) {
  const res = await call(`${api}/${id}?fields=${fields}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`drive ${res.status}`)
  const f: file = await res.json()
  return f.trashed ? null : f
}

/** the drive file of a board, by its id */
export async function findboard(id: string) {
  return (await find({ magpie: 'board', id }))[0] ?? null
}

/** board files changed since a time */
export const modified = (since?: string) => find({ magpie: 'board' }, since ? `modifiedTime > '${since}'` : '')

export async function download(id: string): Promise<board> {
  return (await req(`${api}/${id}?alt=media`)).json()
}

export async function createboard(b: board) {
  return create({ name: `${b.id}.json`, parents: [await folder('boards')], appProperties: { magpie: 'board', id: b.id } }, JSON.stringify(b), 'application/json')
}

export async function updateboard(id: string, b: board): Promise<file> {
  const res = await req(`${up}/${id}?uploadType=media&fields=${fields}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b)
  })
  return res.json()
}

/** upload an asset once, the same hash is the same file */
export async function putasset(id: string, blob: Blob) {
  if ((await find({ magpie: 'asset', id })).length) return
  const ext = blob.type === 'image/gif' ? 'gif' : 'webp'
  await create({ name: `${id}.${ext}`, parents: [await folder('assets')], appProperties: { magpie: 'asset', id } }, blob, blob.type || 'image/webp')
}

/** download an asset, undefined when drive has none */
export async function getasset(id: string) {
  const [f] = await find({ magpie: 'asset', id })
  return f ? (await req(`${api}/${f.id}?alt=media`)).blob() : undefined
}
