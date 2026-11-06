type store = 'boards' | 'assets' | 'views' | 'sync' | 'queue'

const stores = ['boards', 'assets', 'views', 'sync', 'queue']

let db: Promise<IDBDatabase> | undefined

function open() {
  return (db ??= new Promise((ok, fail) => {
    const req = indexedDB.open('magpie', 2)
    req.onupgradeneeded = () => {
      for (const s of stores) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s)
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  }))
}

async function run<T>(name: store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) {
  const s = (await open()).transaction(name, mode).objectStore(name)
  return new Promise<T>((ok, fail) => {
    const req = fn(s)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}

export const get = <T>(name: store, key: string) => run<T | undefined>(name, 'readonly', (s) => s.get(key))
export const all = <T>(name: store) => run<T[]>(name, 'readonly', (s) => s.getAll())
export const put = (name: store, key: string, value: unknown) => run(name, 'readwrite', (s) => s.put(value, key))
export const del = (name: store, key: string) => run(name, 'readwrite', (s) => s.delete(key))
export const keys = (name: store) => run<string[]>(name, 'readonly', (s) => s.getAllKeys())

/** empty every store, for sign out */
export async function wipe() {
  for (const s of stores) await run(s as store, 'readwrite', (o) => o.clear())
}
