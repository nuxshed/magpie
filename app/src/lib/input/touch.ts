import { pinned, toworld, view } from '../canvas/view.svelte'
import { typing } from './keys'
import { abort } from './track'

type point = { x: number; y: number }

const fingers = new Map<number, point>()
let press: (point & { id: number; time: number; tap: boolean }) | null = null
let pinch: { d: number; z: number; w: point } | null = null
let timer = 0
let last = { time: 0, x: 0, y: 0 }

const dist = (a: point, b: point) => Math.hypot(a.x - b.x, a.y - b.y)

/** send a mouse event to whatever is under a point, for gestures touch browsers don't report */
function fire(type: string, p: point) {
  document.elementFromPoint(p.x, p.y)?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y }))
}

/** two fingers pinch and pan, a long press is a right click, a double tap a double click. true when the press belongs to a pinch */
export function touch(e: PointerEvent) {
  const p = { x: e.clientX, y: e.clientY }
  fingers.set(e.pointerId, p)
  addEventListener('pointermove', move)
  addEventListener('pointerup', end)
  addEventListener('pointercancel', end)
  clearTimeout(timer)
  if (fingers.size > 1) {
    abort()
    if (press) press.tap = false
    const [a, b] = [...fingers.values()]
    pinch = { d: dist(a, b) || 1, z: view.zoom, w: toworld((a.x + b.x) / 2, (a.y + b.y) / 2) }
    return true
  }
  press = { ...p, id: e.pointerId, time: e.timeStamp, tap: true }
  if (!typing(e.target))
    timer = window.setTimeout(() => {
      press!.tap = false
      fire('contextmenu', p)
    }, 450)
  return false
}

function move(e: PointerEvent) {
  const p = fingers.get(e.pointerId)
  if (!p) return
  p.x = e.clientX
  p.y = e.clientY
  if (press?.tap && press.id === e.pointerId && dist(p, press) > 8) {
    press.tap = false
    clearTimeout(timer)
  }
  if (!pinch || fingers.size < 2) return
  const [a, b] = [...fingers.values()]
  pinned((pinch.z * dist(a, b)) / pinch.d, pinch.w, (a.x + b.x) / 2, (a.y + b.y) / 2)
}

function end(e: PointerEvent) {
  if (!fingers.delete(e.pointerId)) return
  clearTimeout(timer)
  if (fingers.size < 2) pinch = null
  if (!fingers.size) {
    removeEventListener('pointermove', move)
    removeEventListener('pointerup', end)
    removeEventListener('pointercancel', end)
  }
  if (e.type !== 'pointerup' || press?.id !== e.pointerId || !press.tap || e.timeStamp - press.time > 400) return
  const again = e.timeStamp - last.time < 350 && dist(last, press) < 30
  last = again ? { time: 0, x: 0, y: 0 } : { time: e.timeStamp, x: press.x, y: press.y }
  if (again) fire('dblclick', press)
}
