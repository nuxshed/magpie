<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { app, settext } from '../board.svelte'
  import type { item } from '../model'
  import { highlight, render } from './markdown'

  let { card }: { card: item } = $props()

  const editing = $derived(app.editing === card.id)
  let text = $state('')
  let area = $state<HTMLTextAreaElement>()

  $effect(() => {
    if (!editing) return
    text = untrack(() => card.text ?? '')
    tick().then(() => {
      area?.focus({ preventScroll: true })
      area?.setSelectionRange(text.length, text.length)
    })
  })

  /** save the edit and go back to rendered markdown */
  function done() {
    if (!text.trim() || text !== card.text) settext(card.id, text)
    app.editing = null
  }
</script>

{#if editing}
  <div class="mirror">{@html highlight(text) + ' '}</div>
  <textarea
    bind:this={area}
    bind:value={text}
    onblur={done}
    onkeydown={(e) => e.key === 'Escape' && area?.blur()}
    spellcheck="false"
  ></textarea>
{:else}
  {@html render(card.text ?? '')}
{/if}
