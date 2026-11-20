export interface Box {
  ALLOWED_ORIGIN: string
  INBOX_KEY: string
  DB: D1Database
}

/** text shared from the phone comes in by post, the app reads it by get and clears what it took by delete, and keeps the board list at /inbox/boards for the phone to pick from */
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
    const body = json ? await req.json<{ text?: unknown; board?: unknown }>() : { text: await req.text() }
    const text = String(body.text ?? '').trim()
    if (!text) return reply('empty', 400)
    const board = typeof body.board === 'string' && body.board.trim() ? body.board.trim() : null
    await env.DB.prepare('insert into inbox (id, text, board, at) values (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), text.slice(0, 10000), board, Date.now())
      .run()
    return reply('saved')
  }
  if (req.method === 'GET') {
    const { results } = await env.DB.prepare('select id, text, board from inbox order by at limit 100').all()
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
