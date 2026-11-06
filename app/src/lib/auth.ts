import { PUBLIC_GOOGLE_CLIENT_ID } from '$app/env/public'

type reply = { access_token?: string; expires_in?: number; error?: string }
type client = { requestAccessToken: (o: { prompt: string }) => void }

declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (o: object) => client } } }
  }
}

let tok = ''
let exp = 0
let gis: Promise<client> | undefined
let asking: { ok: (t: string) => void; fail: (e: Error) => void } | undefined
let pending: Promise<string> | undefined

/** whether this browser has signed in before */
export const signed = () => !!localStorage.getItem('signed')

/** load google's script and make the token client once */
export function load() {
  return (gis ??= new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () =>
      ok(
        window.google!.accounts.oauth2.initTokenClient({
          client_id: PUBLIC_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (r: reply) => {
            if (r.access_token) {
              tok = r.access_token
              exp = Date.now() + (r.expires_in ?? 3600) * 1000
              asking?.ok(tok)
            } else asking?.fail(new Error('auth'))
          },
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

/** ask google for a token, the client must be loaded so the popup opens inside a click */
function request(c: client, prompt: string) {
  asking?.fail(new Error('auth'))
  return new Promise<string>((ok, fail) => {
    asking = { ok, fail }
    c.requestAccessToken({ prompt })
  })
}

/** sign in from a click, remembering it for later visits */
export async function signin() {
  await request(await load(), 'select_account')
  localStorage.setItem('signed', '1')
}

/** refresh quietly, else on the next click or keypress, since browsers block popups outside one */
async function refresh() {
  const c = await load()
  try {
    return await request(c, '')
  } catch {
    return new Promise<string>((ok, fail) => {
      const go = () => {
        removeEventListener('pointerdown', go, true)
        removeEventListener('keydown', go, true)
        if (live()) ok(tok)
        else request(c, '').then(ok, fail)
      }
      addEventListener('pointerdown', go, true)
      addEventListener('keydown', go, true)
    })
  }
}

/** a live token, refreshed when it is close to expiring */
export function token() {
  if (live()) return Promise.resolve(tok)
  return (pending ??= refresh().finally(() => (pending = undefined)))
}

const live = () => !!tok && Date.now() < exp - 60e3

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

/** forget the token and the sign-in */
export function forget() {
  tok = ''
  localStorage.removeItem('signed')
}
