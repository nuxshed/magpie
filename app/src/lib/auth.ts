import { PUBLIC_GOOGLE_CLIENT_ID, PUBLIC_PREVIEW_URL } from '$app/env/public'

type reply = { code?: string; error?: string }
type client = { requestCode: () => void }

declare global {
  interface Window {
    google?: { accounts: { oauth2: { initCodeClient: (o: object) => client } } }
  }
}

let tok = ''
let exp = 0
let gis: Promise<client> | undefined
let asking: { ok: (c: string) => void; fail: (e: Error) => void } | undefined
let pending: Promise<string> | undefined
let stuck = false

/** whether this browser has signed in before */
export const signed = () => !!localStorage.getItem('signed')

/** load google's script and make the code client once */
export function load() {
  return (gis ??= new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () =>
      ok(
        window.google!.accounts.oauth2.initCodeClient({
          client_id: PUBLIC_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          ux_mode: 'popup',
          prompt: 'consent',
          callback: (r: reply) => (r.code ? asking?.ok(r.code) : asking?.fail(new Error('auth'))),
          error_callback: () => asking?.fail(new Error('auth'))
        })
      )
    s.onerror = () => {
      gis = undefined
      fail(new TypeError('offline'))
    }
    document.head.append(s)
  }))
}

/** post to the worker's auth routes, which keep the refresh token in a cookie, and keep the access token it returns */
async function post(path: string, body?: string) {
  const res = await fetch(`${PUBLIC_PREVIEW_URL}/auth/${path}`, { method: 'POST', body, credentials: 'include', keepalive: true })
  if (res.status === 401) throw new Error('auth')
  if (!res.ok) throw new Error('worker')
  if (res.status === 204) return ''
  const r: { access_token: string; expires_in: number } = await res.json()
  tok = r.access_token
  exp = Date.now() + r.expires_in * 1000
  return tok
}

/** sign in from a click, so the popup can open, remembering it for later visits */
export async function signin() {
  const c = await load()
  const code = await new Promise<string>((ok, fail) => {
    asking?.fail(new Error('auth'))
    asking = { ok, fail }
    c.requestCode()
  })
  await post('code', code)
  stuck = false
  localStorage.setItem('signed', '1')
}

/** a live token, refreshed quietly by the worker, none until signing in again once the worker turns it down */
export function token() {
  if (tok && Date.now() < exp - 60e3) return Promise.resolve(tok)
  if (stuck) return Promise.reject(new Error('auth'))
  return (pending ??= post('refresh')
    .catch((e) => {
      if (e.message === 'auth') stuck = true
      throw e
    })
    .finally(() => (pending = undefined)))
}

/** fetch with the token, refreshing and retrying once on a 401 */
export async function call(url: string, init: RequestInit = {}) {
  const go = async () => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await token()}` } })
  let res = await go()
  if (res.status === 401) {
    tok = ''
    res = await go()
  }
  if (res.status === 401) throw new Error('auth')
  return res
}

/** forget the token and the sign-in, and have the worker revoke the refresh token */
export function forget() {
  tok = ''
  post('out').catch(() => {})
  localStorage.removeItem('signed')
}
