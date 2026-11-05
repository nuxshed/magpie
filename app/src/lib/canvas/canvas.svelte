<script lang="ts">
  import { dev } from '$app/env'
  import { replaceState } from '$app/navigation'
  import { onMount } from 'svelte'
  import { addnote, app, items, load, rect } from '../board.svelte'
  import Card from '../cards/card.svelte'
  import Add from '../chrome/add.svelte'
  import Selbar from '../chrome/selbar.svelte'
  import Top from '../chrome/top.svelte'
  import Zoom from '../chrome/zoom.svelte'
  import { onkey, typing } from '../input/keys'
  import { adddata } from '../input/paste'
  import { track } from '../input/track'
  import { get, put } from '../store/db'
  import { pointer, spot, toworld, view, zoomat } from './view.svelte'

  let el = $state<HTMLDivElement>()
  let marquee = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let space = $state(false)
  let panning = $state(false)
  const list = $derived(items())

  onMount(async () => {
    await load()
    if (dev && new URLSearchParams(location.search).has('seed')) {
      await (await import('../store/seed')).seed()
      replaceState('/', {})
    } else Object.assign(view, await get('views', app.current))
    app.ready = true
  })

  $effect(() => {
    if (!app.ready) return
    const v = { ...view }
    const t = setTimeout(() => put('views', app.current, v), 300)
    return () => clearTimeout(t)
  })

  $effect(() => {
    const node = el!
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  })

  /** pinch and cmd+scroll zoom around the cursor, plain scroll pans */
  function wheel(e: WheelEvent) {
    e.preventDefault()
    const k = e.deltaMode === 1 ? 16 : 1
    if (e.ctrlKey || e.metaKey) {
      const d = Math.max(-50, Math.min(50, e.deltaY * k))
      zoomat(view.zoom * 2 ** (-d / 100), e.clientX, e.clientY)
    } else {
      view.x -= e.deltaX * k
      view.y -= e.deltaY * k
    }
  }

  /** space+drag or middle mouse pans, anywhere */
  function grab(e: PointerEvent) {
    if (e.button !== 1 && !(space && e.button === 0)) return
    e.preventDefault()
    e.stopPropagation()
    const sx = view.x
    const sy = view.y
    panning = true
    track(
      e,
      (dx, dy) => {
        view.x = sx + dx
        view.y = sy + dy
      },
      () => (panning = false)
    )
  }

  /** press on empty canvas clears the selection, dragging draws a marquee */
  function down(e: PointerEvent) {
    if (e.target !== el || e.button !== 0) return
    const keep = e.shiftKey ? [...app.sel] : []
    app.sel = keep
    track(
      e,
      (dx, dy) => {
        const m = {
          x: Math.min(e.clientX, e.clientX + dx),
          y: Math.min(e.clientY, e.clientY + dy),
          w: Math.abs(dx),
          h: Math.abs(dy)
        }
        marquee = m
        const a = toworld(m.x, m.y)
        const b = toworld(m.x + m.w, m.y + m.h)
        const hit = list.filter((i) => {
          const r = rect(i)
          return r.x < b.x && r.x + r.w > a.x && r.y < b.y && r.y + r.h > a.y
        })
        app.sel = [...new Set([...keep, ...hit.map((i) => i.id)])]
      },
      () => (marquee = null)
    )
  }

  function move(e: PointerEvent) {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.inside = true
  }

  function keydown(e: KeyboardEvent) {
    if (e.code === 'Space' && !typing(e.target)) {
      e.preventDefault()
      space = true
    } else onkey(e)
  }

  function keyup(e: KeyboardEvent) {
    if (e.code !== 'Space') return
    if (!typing(e.target)) e.preventDefault()
    space = false
  }

  function paste(e: ClipboardEvent) {
    if (typing(e.target)) return
    e.preventDefault()
    adddata(e.clipboardData, spot())
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    adddata(e.dataTransfer, toworld(e.clientX, e.clientY))
  }
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onpaste={paste} onblur={() => (space = false)} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="app"
  class:space
  class:panning
  class:grabbing={app.dragging}
  bind:this={el}
  onpointerdowncapture={grab}
  onpointerdown={down}
  onpointermove={move}
  onpointerleave={() => (pointer.inside = false)}
  onmousedown={(e) => e.button === 1 && e.preventDefault()}
  ondblclick={(e) => e.target === el && addnote(toworld(e.clientX, e.clientY))}
  ondragover={(e) => e.preventDefault()}
  ondrop={drop}
>
  <div class="world" style:transform="translate({view.x}px, {view.y}px) scale({view.zoom})">
    {#each list as item (item.id)}
      <Card card={item} />
    {/each}
  </div>
  {#if marquee}
    <div
      class="marquee"
      style:left="{marquee.x}px"
      style:top="{marquee.y}px"
      style:width="{marquee.w}px"
      style:height="{marquee.h}px"
    ></div>
  {/if}
  <Selbar />
  <Top />
  <Add />
  <Zoom />
</div>
