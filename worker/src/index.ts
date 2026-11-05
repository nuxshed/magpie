interface Env {
  ALLOWED_ORIGIN: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET',
      vary: 'origin'
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const { pathname } = new URL(req.url)
    if (req.method === 'GET' && pathname === '/preview') {
      return new Response('not implemented', { status: 501, headers: cors })
    }
    return new Response('not found', { status: 404, headers: cors })
  }
}
