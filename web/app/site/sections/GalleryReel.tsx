import { useEffect, useRef, useState } from 'react'
import { GalleryImage } from './GalleryImage'
import { reelPositions, tween } from './layout'
import type { GallerySectionData } from './types'

/** How long a slide takes, and the original's swipe: at least 40px within 0.6 s, more than 100px sideways. */
const SLIDE_MS = 600
const SWIPE = { minLength: 40, maxTime: 600, threshold: 100 }
const HIDDEN = 'matrix(1, 0, 0, 1, -9999, 0)'

/**
 * The reel: pictures side by side at the reel's height (each at its own proportions, or cropped to the window), the
 * current one centred, wrapping round without end. The arrows and swipes slide it by one picture; pictures fade in as
 * they come into view. Positions are set on the elements directly, frame by frame, as the original's script does.
 */
export function GalleryReel({ data }: { data: GallerySectionData }) {
  const regionRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // The pictures repeat when a round of them is shorter than twice the window, so it can wrap round.
  const [copies, setCopies] = useState(1)
  // Where the reel is (1 = one picture along), and where it's going; kept when the pictures are repeated.
  const position = useRef({ now: 0, target: 0 })
  const count = data.items.length

  useEffect(() => {
    const region = regionRef.current
    if (!region || !count) return
    const figures = [...region.querySelectorAll<HTMLElement>('.gallery-reel-item')]
    let width = 0
    let widths: number[] = []
    let stop: (() => void) | undefined

    const place = () => {
      const xs = reelPositions(widths, count, width, position.current.now)
      figures.forEach((fig, i) => {
        const x = xs[i]
        const src = fig.firstElementChild?.firstElementChild as HTMLElement | null
        if (x !== null) {
          fig.style.transform = `matrix(1, 0, 0, 1, ${x}, 0)`
          fig.dataset.inView = 'true'
          if (src) src.dataset.visible = 'true'
        } else if (fig.dataset.inView !== 'false') {
          fig.style.transform = HIDDEN
          fig.dataset.inView = 'false'
          if (src) src.dataset.visible = 'false'
        }
      })
    }
    const resize = () => {
      width = region.clientWidth
      const height = region.clientHeight
      widths = figures.map((fig, i) => {
        const p = data.items[i % count].picture
        const w = data.cropping ? width : Math.round(p.width * (height / p.height))
        fig.style.width = `${w}px`
        fig.style.height = `${height}px`
        return w
      })
      const round = widths.slice(0, count).reduce((a, b) => a + b, 0)
      let needed = 1
      while (needed * round < 2 * width && needed * count < 100) needed++
      if (needed > copies) setCopies(needed)
      place()
    }
    // The current picture is marked `data-active` (its caption shows, when captions are on).
    const activate = (to: number) => figures.slice(0, count).forEach((f, i) => (f.dataset.active = String(i === ((to % count) + count) % count)))
    const go = (to: number) => {
      position.current.target = to
      activate(to)
      stop?.()
      stop = tween(position.current.now, to, SLIDE_MS, (v) => {
        position.current.now = v
        place()
      })
    }
    const previous = () => go(position.current.target - 1)
    const next = () => go(position.current.target + 1)

    // Swipes: by touch on phones and tablets, by mouse elsewhere (pressing on a picture drags the picture itself,
    // as on the original).
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    let start: { x: number; y: number; t: number } | null = null
    let moved = { x: 0, y: 0 }
    let dir = { x: '', y: '' }
    const point = (e: MouseEvent | TouchEvent) => ('touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e)
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!start) return
      const p = point(e)
      moved = { x: p.clientX - start.x, y: p.clientY - start.y }
      const d = {
        x: Math.abs(moved.x) > SWIPE.threshold ? (moved.x < 0 ? 'Left' : 'Right') : dir.x,
        y: Math.abs(moved.y) > SWIPE.threshold ? (moved.y < 0 ? 'Up' : 'Down') : dir.y,
      }
      if ((dir.x && dir.x !== d.x) || (dir.y && dir.y !== d.y)) start = null
      else dir = d
    }
    const onRelease = () => {
      if (start && Math.abs(moved.x) + Math.abs(moved.y) > SWIPE.minLength && performance.now() - start.t <= SWIPE.maxTime && !dir.y) {
        if (dir.x === 'Left') next()
        if (dir.x === 'Right') previous()
      }
      start = null
      document.removeEventListener(touch ? 'touchmove' : 'mousemove', onMove)
      for (const type of touch ? ['touchend', 'touchcancel'] : ['mouseup']) document.removeEventListener(type, onRelease)
    }
    const onPress = (e: MouseEvent | TouchEvent) => {
      if ('button' in e && e.button !== 0) return
      const p = point(e)
      start = { x: p.clientX, y: p.clientY, t: performance.now() }
      moved = { x: 0, y: 0 }
      dir = { x: '', y: '' }
      document.addEventListener(touch ? 'touchmove' : 'mousemove', onMove, { passive: true })
      for (const type of touch ? ['touchend', 'touchcancel'] : ['mouseup']) document.addEventListener(type, onRelease)
    }

    resize()
    activate(position.current.target)
    const prevBtn = prevRef.current
    const nextBtn = nextRef.current
    prevBtn?.addEventListener('click', previous)
    nextBtn?.addEventListener('click', next)
    region.addEventListener(touch ? 'touchstart' : 'mousedown', onPress as EventListener, { passive: true })
    let timer = 0
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(resize, 175)
    }
    window.addEventListener('resize', onResize)
    return () => {
      stop?.()
      onRelease()
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      prevBtn?.removeEventListener('click', previous)
      nextBtn?.removeEventListener('click', next)
      region.removeEventListener(touch ? 'touchstart' : 'mousedown', onPress as EventListener)
    }
  }, [data, count, copies])

  const slides = Array.from({ length: copies * count }, (_, i) => data.items[i % count])
  return (
    <div className="gallery gallery--reel gallery-reel" data-width={data.width} data-controls={data.controls} style={{ height: `${data.viewportHeight ?? 75}vh` }}>
      <div className="gallery-reel-wrapper">
        <div ref={regionRef} className="gallery-reel-list">
          {slides.map((item, i) => (
            <figure key={i} className="gallery-reel-item" style={{ transform: HIDDEN }}>
              <div className="gallery-reel-item-frame">
                <div className="gallery-reel-item-src">
                  <GalleryImage item={item} />
                </div>
              </div>
            </figure>
          ))}
        </div>
        {data.controls !== 'none' && (
          <div className="gallery-reel-controls">
            <div className="gallery-reel-control">
              <button ref={prevRef} type="button" className="gallery-reel-button" aria-label="Previous Slide">
                <svg viewBox="0 0 60 30" aria-hidden="true">
                  <path d="M15.9,23.7L7.1,15l8.7-8.7" />
                  <path d="M52.9,15H8.5" />
                </svg>
              </button>
            </div>
            <div className="gallery-reel-control">
              <button ref={nextRef} type="button" className="gallery-reel-button" aria-label="Next Slide">
                <svg viewBox="0 0 60 30" aria-hidden="true">
                  <path d="M44.1,6.3l8.7,8.7l-8.7,8.7" />
                  <path d="M7.1,15h44.4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
