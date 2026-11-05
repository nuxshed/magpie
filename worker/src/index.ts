interface Env {
  ALLOWED_ORIGIN: string
}

type info = { url: string; title?: string; desc?: string; site?: string; image?: string }

const agent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const maximage = 10 * 1024 * 1024
const day = 86400
const short = 600

const maxhead = 1024 * 1024
const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const named: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', copy: '©', reg: '®', trade: '™'
}

/** decode html entities */
function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return named[e.toLowerCase()] ?? m
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    try {
      return String.fromCodePoint(n)
    } catch {
      return m
    }
  })
}

const clean = (s?: string) => (s ? decode(s).replace(/\s+/g, ' ').trim() || undefined : undefined)

const local = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i

/** a valid http or https url to a public host, or null */
function weburl(s: string | null, base?: string) {
  try {
    const u = new URL(s ?? '', base)
    return (u.protocol === 'http:' || u.protocol === 'https:') && !local.test(u.hostname) ? u : null
  } catch {
    return null
  }
}

/** title, desc and image from json-ld, searched through graphs and arrays */
function fromld(text: string) {
  const out: { title?: string; desc?: string; image?: string } = {}
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return pick(v[0])
    if (v && typeof v === 'object') return pick((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl)
  }
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    if (o['@graph']) walk(o['@graph'])
    if (!o['@type'] || o['@type'] === 'BreadcrumbList' || o['@type'] === 'WebSite') return
    out.title ??= pick(o.name ?? o.headline)
    out.desc ??= pick(o.description)
    out.image ??= pick(o.image ?? o.thumbnailUrl)
  }
  try {
    walk(JSON.parse(text))
  } catch {}
  return out
}

/** read the head of a page for its preview fields */
async function parse(res: Response) {
  const meta: Record<string, string> = {}
  let title = ''
  let ld = ''
  const lds: string[] = []
  let done = false
  const rw = new HTMLRewriter()
    .on('meta', {
      element(e) {
        const k = (e.getAttribute('property') ?? e.getAttribute('name') ?? '').toLowerCase()
        const v = e.getAttribute('content')
        if (k && v && !(k in meta)) meta[k] = v
      }
    })
    .on('title', {
      text(t) {
        title += t.text
      }
    })
    .on('script[type="application/ld+json"]', {
      element(e) {
        e.onEndTag(() => {
          lds.push(ld)
          ld = ''
        })
      },
      text(t) {
        ld += t.text
      }
    })
    .on('body', {
      element() {
        done = true
      }
    })
  const reader = rw.transform(res).body!.getReader()
  for (let read = 0; !done && read < maxhead; ) {
    const r = await reader.read()
    if (r.done) break
    read += r.value.byteLength
  }
  reader.cancel().catch(() => {})
  const j = lds.map(fromld).reduce((a, b) => ({ title: a.title ?? b.title, desc: a.desc ?? b.desc, image: a.image ?? b.image }), {})
  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? (title || undefined) ?? j.title),
    desc: clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'] ?? j.desc),
    site: clean(meta['og:site_name']),
    image: meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'] ?? meta['twitter:image:src'] ?? j.image
  }
}

/** fetch a page and build its preview, never throwing */
async function preview(url: URL): Promise<{ data: info; ok: boolean }> {
  const data: info = { url: url.href, site: url.hostname.replace(/^www\./, '') }
  try {
    const res = await fetch(url.href, {
      headers: { 'user-agent': agent, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    })
    const end = new URL(res.url || url.href)
    data.site = end.hostname.replace(/^www\./, '')
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) {
      res.body?.cancel()
      return { data, ok: false }
    }
    const p = await parse(res)
    data.title = p.title
    data.desc = p.desc
    data.site = p.site ?? data.site
    data.image = p.image ? weburl(decode(p.image), end.href)?.href : undefined
    return { data, ok: !!(p.title || p.desc || p.image) }
  } catch {
    return { data, ok: false }
  }
}

/** stream an image back, image types only, no svg, capped at 10mb */
async function image(url: URL, ref: URL | null, cors: Record<string, string>) {
  try {
    const res = await fetch(url.href, {
      headers: { 'user-agent': agent, accept: 'image/*', ...(ref && { referer: ref.href }) },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    })
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const size = Number(res.headers.get('content-length') ?? 0)
    if (!res.ok || !types.includes(type) || size > maximage) {
      res.body?.cancel()
      return new Response('bad image', { status: 415, headers: cors })
    }
    let seen = 0
    const cap = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        seen += chunk.byteLength
        if (seen > maximage) ctl.error(new Error('too big'))
        else ctl.enqueue(chunk)
      }
    })
    return new Response(res.body!.pipeThrough(cap), {
      headers: {
        ...cors,
        'content-type': type,
        'cache-control': `public, max-age=${day}`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox"
      }
    })
  } catch {
    return new Response('fetch failed', { status: 502, headers: cors })
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET',
      vary: 'origin'
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const { pathname, searchParams } = new URL(req.url)
    if (req.method !== 'GET') return new Response('not found', { status: 404, headers: cors })

    const url = weburl(searchParams.get('url'))
    if ((pathname === '/preview' || pathname === '/image') && !url)
      return new Response('bad url', { status: 400, headers: cors })

    if (pathname === '/image') return image(url!, weburl(searchParams.get('ref')), cors)

    if (pathname === '/preview') {
      const key = new Request(`https://preview.cache/?url=${encodeURIComponent(url!.href)}`)
      const hit = await caches.default.match(key)
      if (hit) return new Response(hit.body, { headers: { ...cors, 'content-type': 'application/json' } })
      const { data, ok } = await preview(url!)
      const body = JSON.stringify(data)
      const age = ok ? day : short
      ctx.waitUntil(
        caches.default.put(key, new Response(body, { headers: { 'cache-control': `public, max-age=${age}` } }))
      )
      return new Response(body, {
        headers: { ...cors, 'content-type': 'application/json', 'cache-control': `public, max-age=${age}` }
      })
    }
    return new Response('not found', { status: 404, headers: cors })
  }
}
