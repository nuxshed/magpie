<script module lang="ts">
  /** screen rects of cards just dropped into a column, so they can settle into place */
  const flights: Record<string, DOMRect> = {}
</script>

<script lang="ts">
  import { app, bounds, cardat, droptarget, into, items, linkimage, openboard, rect, sendto, topz, update } from '../board.svelte'
  import { align, edge } from '../canvas/guides'
  import { onscreen, toworld, view } from '../canvas/view.svelte'
  import { track } from '../input/track'
  import { minw, openlink, type item } from '../model'
  import Boardcard from './boardcard.svelte'
  import Columncard from './columncard.svelte'
  import Imagecard from './imagecard.svelte'
  import Linkcard from './linkcard.svelte'
  import Notecard from './notecard.svelte'

  let { card, colw, shift = 0 }: { card: item; colw?: number; shift?: number } = $props()

  let node = $state<HTMLDivElement>()
  const c = $derived({ ...card, ...app.live[card.id], ...(colw && { w: colw }) })
  const selected = $derived(app.sel.includes(card.id))
  const editing = $derived(app.editing === card.id)
  const dragging = $derived(app.dragging && !!app.live[card.id])
  const solo = $derived(selected && app.sel.length === 1 && !app.dragging)
  const col = $derived(card.kind === 'column')

  $effect(() => () => delete app.heights[card.id])

  $effect(() => {
    const r = flights[card.id]
    if (!r || !node) return
    delete flights[card.id]
    const n = node.getBoundingClientRect()
    const css = getComputedStyle(node)
    const from = `translate(${(r.left - n.left) / view.zoom}px, ${(r.top - n.top) / view.zoom}px) rotate(-1.5deg) scale(1.03)`
    node.animate([{ transform: from }, { transform: 'none' }], {
      duration: parseFloat(css.getPropertyValue('--d-slow')),
      easing: css.getPropertyValue('--ease-settle')
    })
  })

  /** select on press, move the selection once the pointer travels, drop into a column or the canvas */
  function down(e: PointerEvent) {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    const was = selected
    if (!was) app.sel = e.shiftKey ? [...app.sel, card.id] : [card.id]
    const moving = items()
      .filter((i) => app.sel.includes(i.id) && !app.sel.includes(i.parent ?? ''))
      .sort((a, b) => a.z - b.z)
    const start = moving.map((i) => ({ i, ...rect(i) }))
    const box = bounds(moving)!
    const others = items()
      .filter((i) => !i.parent && !moving.some((m) => m.id === i.id))
      .map(rect)
      .filter(onscreen)
    let moved = false
    track(
      e,
      (dx, dy, ev) => {
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = app.dragging = true
        const lock = ev.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'y' : 'x') : ''
        let wx = lock === 'x' ? 0 : dx / view.zoom
        let wy = lock === 'y' ? 0 : dy / view.zoom
        const at = toworld(ev.clientX, ev.clientY)
        app.over = cardat(at, moving)?.id ?? null
        app.target = app.over ? null : droptarget(at, moving)
        app.guides = []
        if (!ev.altKey && !app.over && !app.target) {
          const a = align({ ...box, x: box.x + wx, y: box.y + wy }, others, 6 / view.zoom)
          if (lock !== 'x') wx += a.dx
          if (lock !== 'y') wy += a.dy
          app.guides = a.lines
        }
        for (const s of start) {
          const p = { x: Math.round(s.x + wx), y: Math.round(s.y + wy) }
          app.live[s.i.id] = s.i.parent && app.target ? { ...p, w: s.w } : p
        }
      },
      () => {
        if (moved) drop(start)
        else if (was && e.shiftKey) app.sel = app.sel.filter((id) => id !== card.id)
        else if (was) app.sel = [card.id]
      }
    )
  }

  function drop(start: { i: item; y: number; x: number }[]) {
    const t = app.target
    const over = app.over && items().find((i) => i.id === app.over)
    let z = topz()
    if (over && over.kind === 'link') linkimage(over.id, start[0].i)
    else if (over && over.board) sendto(start.map((s) => s.i), over.board)
    else if (t) {
      const order = [...start].sort((a, b) => a.y - b.y || a.x - b.x).map((s) => s.i.id)
      for (const id of order) {
        const r = document.querySelector(`[data-id="${id}"]`)?.getBoundingClientRect()
        if (r) flights[id] = r
      }
      update(into(t, order))
    } else {
      update(
        Object.fromEntries(
          start.map((s) => {
            const { x, y } = app.live[s.i.id]
            return [s.i.id, { x, y, z: ++z, parent: undefined, order: undefined }]
          })
        )
      )
    }
    app.live = {}
    app.dragging = false
    app.target = null
    app.over = null
    app.guides = []
  }

  /** right edge sets width; image corners keep aspect and pin the opposite corner */
  function resize(e: PointerEvent, dir: string) {
    e.stopPropagation()
    const s = { x: c.x, y: c.y, w: c.w, h: app.heights[card.id] ?? 0, aspect: c.aspect ?? 1 }
    const others = items()
      .filter((i) => !i.parent && i.id !== card.id)
      .map(rect)
      .filter(onscreen)
    track(
      e,
      (dx, dy, ev) => {
        dx /= view.zoom
        dy /= view.zoom
        let w = s.w + dx
        if (dir !== 'r') {
          const a = s.w + (dir.includes('l') ? -dx : dx)
          const b = s.w + (dir.includes('t') ? -dy : dy) * s.aspect
          w = Math.abs(a - s.w) > Math.abs(b - s.w) ? a : b
        }
        const left = dir.includes('l')
        app.guides = []
        if (!ev.altKey) {
          const g = edge(left ? s.x + s.w - w : s.x + w, s.y, s.h, others, 6 / view.zoom)
          w = left ? s.x + s.w - g.v : g.v - s.x
          app.guides = g.lines
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
        app.guides = []
      }
    )
  }

  /** right click selects the card, keeping a selection it is part of, and opens its menu */
  function menu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!selected) app.sel = [card.id]
    app.menu = { x: e.clientX, y: e.clientY }
  }

  function open() {
    if (editing) return
    if (card.kind === 'note') app.editing = card.id
    else if (card.kind === 'link') openlink(card.url)
    else if (card.kind === 'board') openboard(card)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={col ? 'col' : `card ${card.kind === 'image' ? 'img' : card.kind}`}
  class:is-selected={selected && !editing && !dragging}
  class:is-drag={dragging}
  class:is-target={(col && app.target?.col === card.id) || app.over === card.id}
  class:collapsed={col && card.collapsed}
  class:editing
  class:compact={card.kind === 'link' && card.layout === 'compact'}
  data-id={card.id}
  style:left={colw ? null : `${c.x}px`}
  style:top={colw ? null : `${c.y}px`}
  style:width={colw ? null : `${c.w}px`}
  style:z-index={colw ? null : dragging ? 1e6 : c.z}
  style:transform={shift ? `translateY(${shift}px)` : null}
  bind:this={node}
  bind:offsetHeight={app.heights[card.id]}
  onpointerdown={down}
  ondblclick={open}
  oncontextmenu={menu}
  ondragstart={(e) => e.preventDefault()}
>
  {#if card.kind !== 'image' && card.kind !== 'board' && !colw && (solo || editing)}
    <i class="h r" onpointerdown={(e) => resize(e, 'r')}></i>
  {/if}
  {#if card.kind === 'image'}
    <Imagecard card={c} solo={solo && !colw} {resize} />
  {:else if card.kind === 'link'}
    <Linkcard card={c} />
  {:else if card.kind === 'note'}
    <Notecard card={c} />
  {:else if card.kind === 'column'}
    <Columncard card={c} />
  {:else if card.kind === 'board'}
    <Boardcard card={c} />
  {/if}
</div>
