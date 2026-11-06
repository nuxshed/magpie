export interface Keys {
  ALLOWED_ORIGIN: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}

const year = 365 * 86400
const jar = (v: string, age: number) => `rt=${v}; Path=/auth; Max-Age=${age}; HttpOnly; Secure; SameSite=None; Partitioned`

/** post a grant to google's token endpoint */
async function grant(env: Keys, body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...body })
  })
  return res.ok ? ((await res.json()) as { access_token: string; expires_in: number; refresh_token?: string }) : null
}

/** sign-in code to tokens, refresh token to a new access token, and sign out, with the refresh token kept in a cookie */
export async function auth(req: Request, env: Keys, path: string) {
  const head: Record<string, string> = {
    'access-control-allow-origin': env.ALLOWED_ORIGIN,
    'access-control-allow-credentials': 'true',
    'content-type': 'application/json',
    vary: 'origin'
  }
  const reply = (body: object | null, status = 200, cookie?: string) =>
    new Response(body && JSON.stringify(body), { status, headers: cookie ? { ...head, 'set-cookie': cookie } : head })
  if (req.method !== 'POST') return reply(null, 404)
  const rt = req.headers.get('cookie')?.match(/(?:^|; )rt=([^;]+)/)?.[1]

  if (path === '/auth/code') {
    const t = await grant(env, { code: await req.text(), grant_type: 'authorization_code', redirect_uri: 'postmessage' })
    if (!t) return reply(null, 401)
    const { access_token, expires_in } = t
    return reply({ access_token, expires_in }, 200, t.refresh_token && jar(t.refresh_token, year))
  }
  if (path === '/auth/refresh') {
    const t = rt && (await grant(env, { refresh_token: rt, grant_type: 'refresh_token' }))
    if (!t) return reply(null, 401, jar('', 0))
    return reply({ access_token: t.access_token, expires_in: t.expires_in })
  }
  if (path === '/auth/out') {
    if (rt) await fetch(`https://oauth2.googleapis.com/revoke?token=${rt}`, { method: 'POST' })
    return reply(null, 204, jar('', 0))
  }
  return reply(null, 404)
}
