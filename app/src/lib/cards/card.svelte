<script lang="ts">
  import { app, items, topz, update } from '../board.svelte'
  import { view } from '../canvas/view.svelte'
  import { track } from '../input/track'
  import { minw, type item } from '../model'
  import Imagecard from './imagecard.svelte'
  import Linkcard from './linkcard.svelte'
  import Notecard from './notecard.svelte'

  let { card }: { card: item } = $props()

  const c = $derived({ ...card, ...app.live[card.id] })
  const selected = $derived(app.sel.includes(card.id))
  const editing = $derived(app.editing === card.id)
  const dragging = $derived(app.dragging && selected)
  const solo = $derived(selected && app.sel.length === 1 && !app.dragging)

  $effect(() => () => delete app.heights[card.id])

  /** select on press, move the selection once the pointer travels */
  function down(e: PointerEvent) {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    const was = selected
    if (!was) app.sel = e.shiftKey ? [...app.sel, card.id] : [card.id]
    const start = items()
      .filter((i) => app.sel.includes(i.id))
      .sort((a, b) => a.z - b.z)
      .map((i) => ({ id: i.id, x: i.x, y: i.y }))
    let moved = false
    track(
      e,
      (dx, dy, ev) => {
        if (!moved && Math.hypot(dx, dy) < 3) return
        moved = app.dragging = true
        if (ev.shiftKey && Math.abs(dx) > Math.abs(dy)) dy = 0
        else if (ev.shiftKey) dx = 0
        for (const s of start) {
          app.live[s.id] = { x: Math.round(s.x + dx / view.zoom), y: Math.round(s.y + dy / view.zoom) }
        }
      },
      () => {
        if (moved) {
          let z = topz()
          update(Object.fromEntries(start.map((s) => [s.id, { ...app.live[s.id], z: ++z }])))
          app.live = {}
          app.dragging = false
        } else if (was && e.shiftKey) app.sel = app.sel.filter((id) => id !== card.id)
        else if (was) app.sel = [card.id]
      }
    )
  }

  /** right edge sets width; image corners keep aspect and pin the opposite corner */
  function resize(e: PointerEvent, dir: string) {
    e.stopPropagation()
    const s = { x: c.x, y: c.y, w: c.w, aspect: c.aspect ?? 1 }
    track(
      e,
      (dx, dy) => {
        dx /= view.zoom
        dy /= view.zoom
        let w = s.w + dx
        if (dir !== 'r') {
          const a = s.w + (dir.includes('l') ? -dx : dx)
          const b = s.w + (dir.includes('t') ? -dy : dy) * s.aspect
          w = Math.abs(a - s.w) > Math.abs(b - s.w) ? a : b
        }
        w = Math.max(minw, Math.round(w))
        const p: Partial<item> = { w }
        if (dir.includes('l')) p.x = s.x + s.w - w
        if (dir.includes('t')) p.y = Math.round(s.y + (s.w - w) / s.aspect)
        app.live[card.id] = p
      },
      () => {
        const p = app.live[card.id]
        if (p) update({ [card.id]: p })
        delete app.live[card.id]
      }
    )
  }

  function open() {
    if (card.kind === 'note') app.editing = card.id
    else if (card.kind === 'link') window.open(card.url, '_blank', 'noopener')
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card {card.kind === 'image' ? 'img' : card.kind}"
  class:is-selected={selected && !editing}
  class:is-drag={dragging}
  class:editing
  style:left="{c.x}px"
  style:top="{c.y}px"
  style:width="{c.w}px"
  style:z-index={dragging ? 1e6 : c.z}
  bind:offsetHeight={app.heights[card.id]}
  onpointerdown={down}
  ondblclick={open}
  ondragstart={(e) => e.preventDefault()}
>
  {#if card.kind === 'image'}
    <Imagecard card={c} {solo} {resize} />
  {:else if card.kind === 'link'}
    <Linkcard card={c} />
  {:else if card.kind === 'note'}
    <Notecard card={c} />
  {/if}
  {#if card.kind !== 'image' && (solo || editing)}
    <i class="h r" onpointerdown={(e) => resize(e, 'r')}></i>
  {/if}
</div>
