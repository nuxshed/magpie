const live = new Set<() => void>()

/** follow a pointer drag, calling move with the offset from the start in screen px */
export function track(
  e: PointerEvent,
  move: (dx: number, dy: number, e: PointerEvent) => void,
  up?: () => void
) {
  const onmove = (ev: PointerEvent) => ev.pointerId === e.pointerId && move(ev.clientX - e.clientX, ev.clientY - e.clientY, ev)
  const stop = () => {
    removeEventListener('pointermove', onmove)
    removeEventListener('pointerup', onup)
    removeEventListener('pointercancel', onup)
    live.delete(stop)
    up?.()
  }
  const onup = (ev: PointerEvent) => ev.pointerId === e.pointerId && stop()
  addEventListener('pointermove', onmove)
  addEventListener('pointerup', onup)
  addEventListener('pointercancel', onup)
  live.add(stop)
}

/** end every drag in progress as if the pointer had lifted */
export function abort() {
  live.forEach((stop) => stop())
}
