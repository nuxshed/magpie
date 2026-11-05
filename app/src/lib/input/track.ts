/** follow a pointer drag, calling move with the offset from the start in screen px */
export function track(
  e: PointerEvent,
  move: (dx: number, dy: number, e: PointerEvent) => void,
  up?: () => void
) {
  const onmove = (ev: PointerEvent) => move(ev.clientX - e.clientX, ev.clientY - e.clientY, ev)
  const onup = () => {
    removeEventListener('pointermove', onmove)
    removeEventListener('pointerup', onup)
    removeEventListener('pointercancel', onup)
    up?.()
  }
  addEventListener('pointermove', onmove)
  addEventListener('pointerup', onup)
  addEventListener('pointercancel', onup)
}
