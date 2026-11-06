<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { app, update } from '../board.svelte'
  import { frameof, type item } from '../model'
  import Framed from './framed.svelte'
  import Picture from './picture.svelte'

  let { card }: { card: item } = $props()

  const short = $derived(card.url?.replace(/^https?:\/\/(www\.)?/, '') ?? '')
  const name = $derived(card.title ?? short)
  const site = $derived(card.site ?? short.split('/')[0])
  const compact = $derived(card.layout === 'compact')
  const editing = $derived(app.editing === card.id)
  const cropping = $derived(app.cropping === card.id)
  const r = $derived(compact ? 1 : frameof(card))

  let form = $state({ title: '', desc: '', site: '' })
  let box = $state<HTMLDivElement>()

  $effect(() => {
    if (!editing) return
    form = untrack(() => ({ title: card.title ?? '', desc: card.desc ?? '', site: card.site ?? '' }))
    tick().then(() => box?.querySelector('textarea')?.focus({ preventScroll: true }))
  })

  /** save changed fields, empty ones fall back to the url */
  function done(save: boolean) {
    if (!editing) return
    app.editing = null
    if (!save) return
    const p = { title: form.title.trim() || undefined, desc: form.desc.trim() || undefined, site: form.site.trim() || undefined }
    if (p.title !== card.title || p.desc !== card.desc || p.site !== card.site) update({ [card.id]: p })
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') done(false)
    else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement && e.shiftKey)) {
      e.preventDefault()
      done(true)
    }
  }
</script>

{#if editing}
  {#if card.thumb}<div class="ph"><Picture asset={card.thumb} alt={name} /></div>{/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="body"
    bind:this={box}
    onkeydown={key}
    onfocusout={(e) => !box?.contains(e.relatedTarget as Node) && done(true)}
  >
    <textarea class="field ttl" bind:value={form.title} placeholder={short} rows="1" spellcheck="false"></textarea>
    <textarea class="field desc" bind:value={form.desc} placeholder="Description" rows="1"></textarea>
    <input class="field site" bind:value={form.site} placeholder={short.split('/')[0]} spellcheck="false" />
  </div>
{:else if !card.fetched}
  <div class={compact ? 'ph sk' : 'sk blk'}></div>
  <div class="body">
    <div class="url">{short}</div>
    {#if !compact}
      <div class="sk" style:width="80%" style:margin-top="10px"></div>
      <div class="sk" style:width="55%" style:margin-top="6px"></div>
    {/if}
  </div>
{:else}
  {#if card.thumb || compact}
    <div class="ph" style:aspect-ratio={compact ? null : r}>
      <Framed
        asset={card.thumb}
        alt={name}
        {r}
        crop={card.crop}
        edit={cropping ? (crop) => (app.live[card.id] = { crop }) : undefined}
        resizable={!compact}
      />
    </div>
  {:else}
    <div class="fallback">{name}</div>
  {/if}
  <div class="body">
    {#if card.thumb || compact}<div class="ttl">{name}</div>{/if}
    {#if card.desc && !compact}<div class="desc">{card.desc}</div>{/if}
    <div class="site"><span class="fav">{site[0]?.toUpperCase()}</span>{site}</div>
  </div>
{/if}
{#if card.note && !compact}<div class="unote">{card.note}</div>{/if}
