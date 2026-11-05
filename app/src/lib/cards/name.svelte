<script lang="ts">
  import { untrack } from 'svelte'
  import { app, rename } from '../board.svelte'

  let { id, value, cls }: { id: string; value: string; cls: string } = $props()

  let text = $state(untrack(() => value))
  let el = $state<HTMLInputElement>()

  $effect(() => {
    el?.focus({ preventScroll: true })
    el?.select()
  })

  /** leave rename mode, saving unless cancelled */
  function done(keep: boolean) {
    if (app.editing !== id) return
    app.editing = null
    if (keep) rename(id, text)
  }
</script>

<input
  class={cls}
  bind:this={el}
  bind:value={text}
  onblur={() => done(true)}
  onkeydown={(e) => (e.key === 'Enter' ? done(true) : e.key === 'Escape' && done(false))}
  onpointerdown={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
  spellcheck="false"
/>
