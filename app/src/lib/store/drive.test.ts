import { expect, mock, test } from 'bun:test'

const replies: Response[] = []
const urls: string[] = []
mock.module('../auth', () => ({
  call: async (url: string) => (urls.push(url), replies.shift()!)
}))

const { download, getasset } = await import('./drive')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const limited = () => json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 403)

test('backs off and retries on 429, 5xx and rate limit 403s', async () => {
  replies.push(new Response('', { status: 429 }), new Response('', { status: 503 }), limited(), json({ id: 'b' }))
  expect(await download('f')).toEqual({ id: 'b' } as never)
  expect(urls.length).toBe(4)
}, 20000)

test('other errors fail straight away', async () => {
  urls.length = 0
  replies.push(json({ error: { errors: [{ reason: 'insufficientPermissions' }] } }, 403))
  expect(download('f')).rejects.toThrow('drive 403')
  await Bun.sleep(0)
  expect(urls.length).toBe(1)
})

test('assets are listed once, then downloaded by cached file id', async () => {
  urls.length = 0
  replies.push(json({ files: [{ id: 'fa', appProperties: { magpie: 'asset', id: 'a' } }, { id: 'fb', appProperties: { magpie: 'asset', id: 'b' } }] }))
  replies.push(new Response('A'), new Response('B'))
  expect(await (await getasset('a'))!.text()).toBe('A')
  expect(await (await getasset('b'))!.text()).toBe('B')
  expect(urls.map((u) => u.split('?')[0].split('/').at(-1))).toEqual(['files', 'fa', 'fb'])
})

test('at most four downloads run at once', async () => {
  let open = 0
  let peak = 0
  const slow = new Response('x')
  mock.module('../auth', () => ({
    call: async () => {
      peak = Math.max(peak, ++open)
      await Bun.sleep(10)
      open--
      return slow.clone()
    }
  }))
  await Promise.all(['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b'].map(getasset))
  expect(peak).toBe(4)
})
