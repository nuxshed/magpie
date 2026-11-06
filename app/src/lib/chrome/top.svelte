<script lang="ts">
  import { app, current, href } from '../board.svelte'
  import { forget, signin } from '../auth'
  import type { board } from '../model'
  import { wipe } from '../store/db'
  import { flush, stop, syncall } from '../store/sync'

  const above = $derived.by(() => {
    const list: board[] = []
    for (let b = app.boards[current()?.parent ?? '']; b; b = app.boards[b.parent ?? '']) list.unshift(b)
    return list
  })

  const labels = { saved: 'Saved', saving: 'Saving…', offline: 'Offline, kept on this device', error: 'Not synced', auth: 'Sign in again' }
  const failed = $derived(app.sync === 'error' || app.sync === 'auth')
  let panel = $state(false)
  let more = $state(false)

  $effect(() => {
    if (!failed) panel = false
  })

  async function again() {
    panel = false
    await signin().catch(() => {})
    syncall()
  }

  /** push what is pending, then clear this device and go back to the sign-in screen */
  async function signout() {
    more = false
    if (!(await flush())) return
    stop()
    await wipe()
    forget()
    localStorage.removeItem('seeded')
    location.href = '/'
  }

  /** close the open popup on a press outside it */
  function away(node: HTMLElement, close: () => void) {
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!node.contains(t) && !t.closest('.tr')) close()
    }
    addEventListener('pointerdown', down, true)
    return { destroy: () => removeEventListener('pointerdown', down, true) }
  }
</script>

<div class="top">
  <nav class="crumbs" aria-label="Breadcrumb">
    {#each above as b (b.id)}<a href={href(b.id)}>{b.name}</a><span class="sep">/</span>{/each}
    <span class="here">{current()?.name}</span>
  </nav>
  <div class="tr">
    {#if failed}
      <button class="q sync error" type="button" onclick={() => (panel = !panel)}><i class="dot"></i>{labels[app.sync]}</button>
    {:else}
      <span class="sync {app.sync}"><i class="dot"></i>{labels[app.sync]}</span>
    {/if}
    <button class="q" class:on={more} type="button" aria-label="Menu" onclick={() => (more = !more)}>
      <svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="3" cy="7" r=".8" /><circle cx="7" cy="7" r=".8" /><circle cx="11" cy="7" r=".8" /></svg>
    </button>
  </div>
</div>
{#if panel}
  <div class="pop syncerr" use:away={() => (panel = false)}>
    <div class="t">Couldn't sync with Google Drive</div>
    <div class="d">Your changes are kept on this device and will sync once Drive is reachable.</div>
    <div class="row">
      <button class="btn-p" type="button" onclick={() => ((panel = false), syncall())}>Retry</button>
      <button class="q" type="button" onclick={again}>Sign in again</button>
    </div>
  </div>
{/if}
{#if more}
  <div class="pop menu more" role="menu" tabindex="-1" use:away={() => (more = false)}>
    <button class="mi" type="button" onclick={signout}>Sign out</button>
  </div>
{/if}
