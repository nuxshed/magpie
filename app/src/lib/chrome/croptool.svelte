<script lang="ts">
  import { app, endcrop, getitem } from '../board.svelte'
  import type { frame } from '../model'

  const it = $derived(app.cropping ? getitem(app.cropping) : undefined)
  const draft = $derived(it && app.live[it.id] && 'crop' in app.live[it.id] ? app.live[it.id].crop : it?.crop)
  const compact = $derived(it?.kind === 'link' && it.layout === 'compact')
  const r = $derived(compact ? 1 : (draft?.r ?? (it?.kind === 'link' ? 1.91 : (it?.aspect ?? 1))))
  const colors = ['#ffffff', '#f2f1ee', '#1c1c1a', '#000000']
  let h = $state(0)

  /** under the card, or above it when there is no room */
  const pos = $derived.by(() => {
    void app.live[it?.id ?? '']
    const b = document.querySelector(`[data-id="${it?.id}"]`)?.getBoundingClientRect()
    if (!b) return { x: 16, y: 16 }
    const y = b.bottom + 10 + h < innerHeight ? b.bottom + 10 : Math.max(16, b.top - 10 - h)
    return { x: Math.max(16, b.left), y }
  })

  /** the picture's own aspect, read from the rendered image */
  function natural() {
    const i = document.querySelector<HTMLImageElement>(`[data-id="${it?.id}"] .clip img`)
    return i?.naturalWidth ? i.naturalWidth / i.naturalHeight : r
  }

  function set(p: Partial<frame> | undefined) {
    if (it) app.live[it.id] = { crop: p && { z: 1, x: 0, y: 0, ...draft, r, ...p } }
  }

  const ratio = (n: number) => set({ r: n })
  const fit = () => {
    const a = natural()
    set({ z: Math.min(a / r, r / a), x: 0, y: 0 })
  }
</script>

{#if it}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="pop cropbar" style:left="{pos.x}px" style:top="{pos.y}px" bind:offsetHeight={h} onpointerdown={(e) => e.stopPropagation()}>
    {#if !compact}
      {#if it.kind === 'link'}<button class="q" type="button" onclick={() => ratio(1.91)}>Wide</button>{/if}
      <button class="q" type="button" onclick={() => ratio(1)}>Square</button>
      <button class="q" type="button" onclick={() => ratio(natural())}>Original</button>
      <span class="sep"></span>
    {/if}
    <button class="q" type="button" onclick={fit}>Fit</button>
    <button class="q" type="button" onclick={() => set({ z: 1, x: 0, y: 0 })}>Fill</button>
    <span class="sep"></span>
    <button class="sw none" type="button" title="No background" aria-label="No background" onclick={() => set({ bg: undefined })}></button>
    {#each colors as bg (bg)}
      <button class="sw" type="button" style:background={bg} aria-label="Background {bg}" onclick={() => set({ bg })}></button>
    {/each}
    <input type="color" aria-label="Custom background" value={draft?.bg ?? '#ffffff'} oninput={(e) => set({ bg: e.currentTarget.value })} />
    <span class="sep"></span>
    <button class="q" type="button" onclick={() => set(undefined)}>Reset</button>
    <button class="q" type="button" onclick={() => endcrop(false)}>Cancel</button>
    <button class="q on" type="button" onclick={() => endcrop(true)}>Done</button>
  </div>
{/if}
