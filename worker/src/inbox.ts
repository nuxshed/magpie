import { decode } from './decode'

export interface Box {
  ALLOWED_ORIGIN: string
  INBOX_KEY: string
  DB: D1Database
}

/** text shared from the phone comes in by post, with the page title and description when the phone could read them, the app reads it by get and clears what it took by delete, and keeps the board list at /inbox/boards for the phone to pick from */
export async function inbox(req: Request, env: Box, path: string) {
  const head = {
    'access-control-allow-origin': env.ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET, POST, PUT, DELETE',
    'access-control-allow-headers': 'authorization, content-type',
    vary: 'origin'
  }
  const reply = (body: BodyInit | null, status = 200) => new Response(body, { status, headers: head })
  if (req.method === 'OPTIONS') return reply(null, 204)
  if (!env.INBOX_KEY || req.headers.get('authorization') !== `Bearer ${env.INBOX_KEY}`) return reply('no', 401)

  if (path === '/inbox/boards') {
    if (req.method === 'PUT') {
      await env.DB.prepare('insert or replace into boards (k, list) values (1, ?)').bind((await req.text()).slice(0, 100000)).run()
      return reply(null, 204)
    }
    return reply((await env.DB.prepare('select list from boards where k = 1').first<string>('list')) ?? 'Home')
  }

  if (req.method === 'POST') {
    const json = req.headers.get('content-type')?.includes('json')
    const body: Record<string, unknown> = json ? await req.json() : { text: await req.text() }
    const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? decode(v).replace(/\s+/g, ' ').trim().slice(0, n) : null)
    const text = String(body.text ?? '').trim()
    if (!text) return reply('empty', 400)
    let title = str(body.title, 300)
    let caption = str(body.desc, 2000)
    const ig = title?.match(/^(.*?) on Instagram: ["“](.*?)["”]?$/)
    if (ig) [title, caption] = [ig[1], ig[2]]
    await env.DB.prepare('insert into inbox (id, text, board, title, caption, at) values (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), text.slice(0, 10000), str(body.board, 500), title, caption, Date.now())
      .run()
    return reply('saved')
  }
  if (req.method === 'GET') {
    const { results } = await env.DB.prepare('select id, text, board, title, caption from inbox order by at limit 100').all()
    return reply(JSON.stringify(results))
  }
  if (req.method === 'DELETE') {
    const ids = await req.json<string[]>()
    const del = env.DB.prepare('delete from inbox where id = ?')
    if (ids.length) await env.DB.batch(ids.slice(0, 100).map((id) => del.bind(String(id))))
    return reply(null, 204)
  }
  return reply('not found', 404)
}
