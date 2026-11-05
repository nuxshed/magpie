<script lang="ts">
  import { track } from '../input/track'
  import type { frame } from '../model'
  import Picture from './picture.svelte'

  let {
    asset,
    alt = '',
    r,
    crop,
    edit,
    resizable = false
  }: { asset?: string; alt?: string; r: number; crop?: frame; edit?: (c: frame) => void; resizable?: boolean } =
    $props()

  let natural = $state(0)
  let lines = $state({ v: false, h: false })
  let node = $state<HTMLDivElement>()

  const c = $derived({ z: 1, x: 0, y: 0, ...crop })
  const a = $derived(natural || r)
  const w = $derived(Math.max(1, a / r) * c.z * 100)
  const h = $derived(Math.max(1, r / a) * c.z * 100)
  const pos = $derived(
    `left:${50 + c.x * 100 - w / 2}%;top:${50 + c.y * 100 - h / 2}%;width:${w}%;height:${h}%`
  )

  /** drag pans the picture, snapping its center to the frame's unless alt is held */
  function pan(e: PointerEvent) {
    if (!edit || e.button !== 0) return
    e.stopPropagation()
    const b = node!.getBoundingClientRect()
    const s = { ...c, r }
    track(
      e,
      (dx, dy, ev) => {
        const x = s.x + dx / b.width
        const y = s.y + dy / b.height
        lines = { v: !ev.altKey && Math.abs(x) * b.width < 6, h: !ev.altKey && Math.abs(y) * b.height < 6 }
        edit({ ...s, x: lines.v ? 0 : x, y: lines.h ? 0 : y })
      },
      () => (lines = { v: false, h: false })
    )
  }

  /** the bottom edge sets the frame aspect, snapping to wide, square and the picture's own */
  function stretch(e: PointerEvent) {
    e.stopPropagation()
    const b = node!.getBoundingClientRect()
    const s = { ...c }
    track(e, (_, dy) => {
      let n = b.width / Math.max(20, b.height + dy)
      for (const t of [1.91, 1, a]) if (Math.abs(n / t - 1) < 0.04) n = t
      edit?.({ ...s, r: Math.min(4, Math.max(0.3, n)) })
    })
  }

  /** wheel zooms around the pointer, out past a fill to pad the frame */
  function zoom(n: HTMLElement) {
    const wheel = (e: WheelEvent) => {
      if (!edit) return
      e.preventDefault()
      e.stopPropagation()
      const b = n.getBoundingClientRect()
      const px = (e.clientX - b.left) / b.width - 0.5
      const py = (e.clientY - b.top) / b.height - 0.5
      const z = Math.min(8, Math.max(0.2, c.z * Math.exp(-e.deltaY * 0.002)))
      const k = z / c.z
      edit({ ...c, r, z, x: px - (px - c.x) * k, y: py - (py - c.y) * k })
    }
    n.addEventListener('wheel', wheel, { passive: false })
    return () => n.removeEventListener('wheel', wheel)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="framed" class:editing={!!edit} bind:this={node} onpointerdown={pan} {@attach zoom}>
  {#if edit}<Picture {asset} class="ghost" style={pos} />{/if}
  <div class="clip" style:background={c.bg}>
    <Picture {asset} {alt} style={pos} onload={(e) => { const i = e.currentTarget as HTMLImageElement; natural = i.naturalWidth / i.naturalHeight }} />
  </div>
  {#if lines.v}<i class="mid x"></i>{/if}
  {#if lines.h}<i class="mid y"></i>{/if}
  {#if edit && resizable}<i class="h b" onpointerdown={stretch}></i>{/if}
</div>
