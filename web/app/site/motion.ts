/**
 * Block animations, played as the original plays them. A block can move to a pose while the mouse is over it
 * ("hover") or while it's pressed ("press"), and once, as it scrolls into view, move from a pose to its place
 * ("appear"). Each of the three moves its own CSS properties (--mh-*, --mp-*, --ma-*), which styles/motion.css adds to
 * the block's transform, so they can play at the same time. They move with the original's spring.
 */
import { useEffect, type RefObject } from 'react'
import type { Motion, MotionPose, MotionStep } from '~/content/types'

type Layer = 'hover' | 'press' | 'appear'
const PREFIX: Record<Layer, string> = { hover: '--mh', press: '--mp', appear: '--ma' }
const REST: MotionPose = { x: '0px', y: '0px', rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 }

/** A layer's properties for a pose (its place, when there's none): { '--mh-x': '0px', '--mh-sx': '1.1', … }. */
export function poseProps(layer: Layer, pose: MotionPose = REST): Record<string, string> {
  const p = PREFIX[layer]
  return {
    [`${p}-x`]: pose.x,
    [`${p}-y`]: pose.y,
    [`${p}-r`]: `${pose.rotate}deg`,
    [`${p}-sx`]: String(pose.scaleX),
    [`${p}-sy`]: String(pose.scaleY),
    [`${p}-kx`]: `${pose.skewX}deg`,
    [`${p}-ky`]: `${pose.skewY}deg`,
  }
}

// --- The spring -------------------------------------------------------------------------------------------------

const easings = new Map<string, string>()

/**
 * The original's spring as a CSS linear() easing. For a duration T (seconds) and a bounce b, it's a spring of mass 1
 * with stiffness (2π/T)² and damping (1 − b)·4π/T: it swings once in T, and the more bounce, the less it's damped.
 * It's followed in steps of 1/6 s until it settles (within 0.001 of its rest for 16 steps), sampled once per step,
 * and samples that lie within 0.00375 of the line between their neighbours are dropped. The browser then plays that
 * curve over the duration, as the original does.
 */
export function springEasing(duration: number, bounce: number): string {
  const key = `${duration}/${bounce}`
  const known = easings.get(key)
  if (known) return known
  const T = duration / 1000
  const stiffness = Number(((2 * Math.PI) / T) ** 2).toFixed(5)
  const damping = Number(((1 - bounce) * 4 * Math.PI) / T).toFixed(5)
  const at = springCurve(Number(stiffness), Number(damping))

  const { time, samples } = settle(at)
  const points: [number, number][] = []
  for (let i = 0; i < samples; i++) points.push([i / (samples - 1), at((time * i) / (samples - 1))])
  const kept = simplify(points, 0.00375)
  const easing = `linear(${kept.map(([x, y]) => `${round(y, 5)} ${round(x * 100, 3)}%`).join(', ')})`
  easings.set(key, easing)
  return easing
}

/** Where a spring (mass 1, at rest at 1, starting at 0 nearly still) is after t seconds. */
function springCurve(stiffness: number, damping: number): (t: number) => number {
  const velocity = 1e-4
  const w0 = Math.sqrt(stiffness)
  const zeta = damping / (2 * Math.sqrt(stiffness))
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const b = (zeta * w0 - velocity) / wd
    return (t) => 1 - Math.exp(-t * zeta * w0) * (Math.cos(wd * t) + b * Math.sin(wd * t))
  }
  const b = w0 - velocity
  return (t) => 1 - (1 + b * t) * Math.exp(-t * w0)
}

/** When the spring has settled, in seconds, and how many steps of 1/6 s it took to be sure (the number of samples). */
function settle(at: (t: number) => number): { time: number; samples: number } {
  const step = 1 / 6
  const still = (t: number) => Math.abs(1 - at(t)) < 0.001
  let t = 0
  let n = 0
  while (++n < 1e5) {
    if (still(t)) {
      const start = t
      let count = 1
      while (++n < 1e5) {
        t += step
        if (!still(t)) break
        if (++count === 16) return { time: start, samples: n }
      }
    }
    t += step
  }
  return { time: t, samples: n }
}

/** Ramer–Douglas–Peucker: keeps the samples that stray more than `tolerance` from the line between kept ones. */
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points
  const keep = new Set([0, points.length - 1])
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let far = 0
    let farthest = -1
    for (let i = a + 1; i < b; i++) {
      const d = distance(points[i], points[a], points[b])
      if (d > far) {
        far = d
        farthest = i
      }
    }
    if (far > tolerance && farthest > 0) {
      keep.add(farthest)
      stack.push([a, farthest], [farthest, b])
    }
  }
  return points.filter((_, i) => keep.has(i))
}

/** How far a point is from the segment between two others. */
function distance([x, y]: [number, number], [x1, y1]: [number, number], [x2, y2]: [number, number]): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

// --- Playing a layer -------------------------------------------------------------------------------------------

const playing = new WeakMap<HTMLElement, Partial<Record<Layer, Animation>>>()

/** Moves a block's layer from wherever it is now to a pose (or back to its place), with the step's spring. */
function play(el: HTMLElement, layer: Layer, to: MotionPose | undefined, step: MotionStep) {
  const target = poseProps(layer, to)
  const style = getComputedStyle(el)
  const from = Object.fromEntries(Object.keys(target).map((k) => [k, style.getPropertyValue(k).trim()]))
  const running = playing.get(el) ?? {}
  running[layer]?.cancel()
  const animation = el.animate([from, target], { duration: step.duration, delay: step.delay, easing: springEasing(step.duration, step.bounce), fill: 'forwards' })
  running[layer] = animation
  playing.set(el, running)
  // Once there, the pose is kept as the block's own style, and the animation let go.
  animation.onfinish = () => {
    for (const [k, v] of Object.entries(target)) el.style.setProperty(k, v)
    animation.cancel()
  }
}

// --- The triggers ----------------------------------------------------------------------------------------------

/**
 * Hover, as the original's: with a mouse only. The pointer is over the block while it's inside the block's place on
 * the page (not where the animation has moved it, so the block doesn't flicker at its edges); halfway through moving,
 * the block's new outline counts too.
 */
function watchHover(el: HTMLElement, step: MotionStep): () => void {
  let inside = false
  let live = false
  let frame = 0
  let liveTimer = 0
  const enter = () => {
    play(el, 'hover', step.pose, step)
    liveTimer = window.setTimeout(() => (live = true), step.delay + step.duration * 0.5)
  }
  const leave = () => {
    window.clearTimeout(liveTimer)
    live = false
    play(el, 'hover', undefined, step)
  }
  const onMove = (e: PointerEvent) => {
    if (frame || e.pointerType !== 'mouse') return
    const { clientX: x, clientY: y } = e
    frame = requestAnimationFrame(() => {
      frame = 0
      const r = placeOf(el)
      const over = (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) || (live && document.elementsFromPoint(x, y).some((n) => el.contains(n)))
      if (over && !inside) {
        inside = true
        enter()
      } else if (!over && inside) {
        inside = false
        leave()
      }
    })
  }
  const onOut = (e: PointerEvent) => {
    if (e.relatedTarget === null && inside) {
      inside = false
      leave()
    }
  }
  document.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerout', onOut)
  return () => {
    document.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerout', onOut)
    cancelAnimationFrame(frame)
    window.clearTimeout(liveTimer)
  }
}

/** The block's place on the page, as laid out (its transform left out). */
function placeOf(el: HTMLElement): { left: number; top: number; right: number; bottom: number } {
  const parent = el.offsetParent as HTMLElement | null
  const p = parent?.getBoundingClientRect() ?? { left: 0, top: 0 }
  const left = p.left + (parent?.clientLeft ?? 0) + el.offsetLeft
  const top = p.top + (parent?.clientTop ?? 0) + el.offsetTop
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight }
}

/** Press: the block moves to its pose while the main button (or a finger) is down on it. */
function watchPress(el: HTMLElement, step: MotionStep): () => void {
  const release = () => {
    window.removeEventListener('pointerup', release)
    window.removeEventListener('touchend', release)
    play(el, 'press', undefined, step)
  }
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    play(el, 'press', step.pose, step)
    window.addEventListener(e.pointerType === 'mouse' ? 'pointerup' : 'touchend', release)
  }
  el.addEventListener('pointerdown', onDown)
  return () => {
    el.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('touchend', release)
  }
}

/**
 * Appear, as the original's: the block starts in its pose (styles/motion.css), and moves to its place once its top,
 * middle or bottom has risen above a line `threshold` % up the window (checked at most every 250 ms while it's within
 * a window's height below the view).
 */
function watchAppear(el: HTMLElement, step: MotionStep & NonNullable<Motion['appear']>): () => void {
  let last = 0
  let frame = 0
  let done = false
  const check = () => {
    if (done) return
    const r = el.getBoundingClientRect()
    const middle = r.top + r.height / 2
    const half = el.clientHeight / 2
    const point = { top: middle - half, middle, bottom: middle + half }[step.point]
    if (point <= window.innerHeight * (1 - step.threshold / 100)) {
      done = true
      stop()
      observer.disconnect()
      play(el, 'appear', undefined, step)
    }
  }
  const tick = () => {
    const now = performance.now()
    if (now - last >= 250) {
      last = now
      check()
    }
    frame = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      check()
      if (entry?.isIntersecting && !done) {
        if (!frame) frame = requestAnimationFrame(tick)
      } else stop()
    },
    { rootMargin: '0px 0px 100% 0px' },
  )
  // If the page took so long that the stylesheet's fallback has already shown the block, it stays shown.
  const fallen = el.getAnimations().some((a) => (a as CSSAnimation).animationName === 'motion-appear-fallback' && a.playState === 'finished')
  if (fallen) {
    for (const [k, v] of Object.entries(poseProps('appear'))) el.style.setProperty(k, v)
    return () => undefined
  }
  observer.observe(el)
  return () => {
    stop()
    observer.disconnect()
  }
}

/** Plays a block's animations (none when the visitor has asked for less motion, as on the original). */
export function useMotion(ref: RefObject<HTMLElement | null>, motion: Motion | undefined) {
  useEffect(() => {
    const el = ref.current
    if (!el || !motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stops: (() => void)[] = []
    if (motion.appear) stops.push(watchAppear(el, motion.appear))
    if (motion.hover) stops.push(watchHover(el, motion.hover))
    if (motion.press) stops.push(watchPress(el, motion.press))
    // Our script has taken over from the stylesheet's fallback.
    el.dataset.motion = 'on'
    return () => stops.forEach((stop) => stop())
  }, [ref, motion])
}
