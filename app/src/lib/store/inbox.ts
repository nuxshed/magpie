import { PUBLIC_PREVIEW_URL } from '$app/env/public'
import { replaceState } from '$app/navigation'
import { paths, receive } from '../board.svelte'
import { fetchpreviews } from './preview'

let busy = false

/** keep a key opened as #inbox=key, then move what the phone sent into the inbox column */
export async function pullinbox() {
  const m = location.hash.match(/^#inbox=(.+)$/)
  if (m) {
    localStorage.setItem('inbox', m[1])
    replaceState(location.pathname + location.search, {})
  }
  const key = localStorage.getItem('inbox')
  if (!key || busy || !navigator.onLine) return
  busy = true
  const url = `${PUBLIC_PREVIEW_URL}/inbox`
  const authorization = `Bearer ${key}`
  try {
    const names = ['Home', ...Object.keys(paths()).filter((p) => p !== 'Home').sort()].join('\n')
    if (names !== localStorage.getItem('inboxboards')) {
      const put = await fetch(`${url}/boards`, { method: 'PUT', headers: { authorization }, body: names })
      if (put.ok) localStorage.setItem('inboxboards', names)
    }
    const res = await fetch(url, { headers: { authorization } })
    const list: { id: string; text: string; board?: string | null }[] = res.ok ? await res.json() : []
    if (list.length) {
      fetchpreviews(receive(list))
      await fetch(url, {
        method: 'DELETE',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify(list.map((e) => e.id))
      })
    }
  } catch {}
  busy = false
}
