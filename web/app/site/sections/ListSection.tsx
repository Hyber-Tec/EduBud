import { useEffect, useRef, type CSSProperties } from 'react'
import type { Section } from '~/content/types'
import { contentFor } from './content'
import { slidePositions, tween } from './layout'
import type { ListSectionData } from './types'

/** An "auto layout" list section (EduBud's: a slideshow of quotes), drawn as the original's. */
export function ListSection({ section }: { section: Section }) {
  const data = contentFor(section.id)
  return (
    <div className="list-section-content" data-list={section.id}>
      {data?.type === 'list' && <BannerSlideshow data={data} />}
    </div>
  )
}

const SLIDE_MS = 600
/** A drag shorter than this doesn't count as one (px). */
const DRAG_MIN = 15

/** The space between slides in pixels (a % is of the slideshow's width); phones have none. */
function spacingPx({ value, unit }: { value: number; unit: string }, regionWidth: number): number {
  if (window.innerWidth < 576) return 0
  const [w, h] = [window.innerWidth, window.innerHeight]
  const base: Record<string, number> = { '%': regionWidth, vw: w, vh: h, vmin: Math.min(w, h), vmax: Math.max(w, h) }
  return Math.round(unit in base ? (value / 100) * base[unit] : value)
}

/**
 * The banner slideshow: one item at a time, full width, its title and text; arrows (and, on phones, two round
 * buttons) slide to the next or previous one, wrapping round; it can also be dragged, or moved with the arrow keys.
 * Slides are positioned by script, as the original's are, so it slides exactly as the original does.
 */
function BannerSlideshow({ data }: { data: ListSectionData }) {
  const root = useRef<HTMLDivElement>(null)
  const count = data.items.length
  const multiple = count > 1
  const arrows = multiple && data.navigation === 'arrows'
  const Title = data.titleTag

  useEffect(() => {
    const el = root.current
    if (!el || !multiple) {
      el?.querySelector('.list-slides')?.setAttribute('data-ready', '')
      return
    }
    const gutter = el.querySelector<HTMLElement>('.list-slideshow-gutter')!
    const list = el.querySelector<HTMLElement>('.list-slides')!
    const slides = [...list.querySelectorAll<HTMLElement>('.list-slide')]
    const status = el.querySelector<HTMLElement>('.list-slideshow-status')
    const pos = { current: 0, target: 0 }
    const mod = (n: number) => ((n % count) + count) % count
    let stop: (() => void) | undefined

    const place = () => {
      const width = slides[0].offsetWidth
      const spacing = spacingPx(data.spaceBetweenSlides, gutter.offsetWidth)
      const edge = list.getBoundingClientRect().x - gutter.getBoundingClientRect().x
      slidePositions(count, width, spacing, gutter.offsetWidth, edge, pos.current, data.infinite).forEach((s, i) => {
        slides[i].style.transform = `translate3d(${s.x ?? -9999}px, 0px, 0px)`
        if (s.away) slides[i].setAttribute('aria-hidden', 'true')
        else slides[i].removeAttribute('aria-hidden')
      })
    }
    const setProgress = (t: number) => {
      pos.current = t
      place()
    }
    // Moves to slide `to` (counting on past the last when endless), sliding, or at once while dragged.
    const setIndex = (to: number, { instant = false, keepCount = false } = {}) => {
      let s = data.infinite ? to : Math.min(Math.max(to, 0), count - 1)
      if (!keepCount || !data.infinite) {
        s = mod(s)
        pos.target = mod(pos.target)
        pos.current = mod(pos.current)
      }
      if (s === pos.target && !instant) return
      pos.target = s
      stop?.()
      if (status && !drag.active) status.textContent = `Item ${mod(Math.round(s)) + 1} of ${count}`
      if (instant) setProgress(s)
      else stop = tween(pos.current, s, SLIDE_MS, setProgress)
    }
    const step = (by: number) => setIndex(Math.round(pos.target + by), { keepCount: true })
    const previous = () => step(-1)
    const next = () => step(1)

    // Dragging, with a mouse or a finger: the slides follow, then settle on the slide the drag went toward.
    const drag = { active: false, x: 0, y: 0, from: 0, progress: 0, index: 0, direction: 0, axis: '', committed: false, last: [NaN, NaN] }
    const point = (e: MouseEvent | TouchEvent) => ('touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e)
    const onStart = (e: MouseEvent | TouchEvent) => {
      if ((e.target as Element).closest('button, a') || ('button' in e && e.button !== 0)) return
      const p = point(e)
      if (!('touches' in e)) gutter.addEventListener('mousemove', onMove)
      Object.assign(drag, { active: true, x: p.clientX, y: p.clientY, from: pos.current, direction: 0, axis: '', committed: false })
      gutter.style.cursor = 'grabbing'
    }
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!drag.active) return
      const p = point(e)
      const dx = p.clientX - drag.x
      const dy = p.clientY - drag.y
      if (p.clientX === drag.last[0] && p.clientY === drag.last[1]) return
      drag.last = [p.clientX, p.clientY]
      if ('touches' in e) {
        // A finger decides once it has moved 15px: sideways drags the slides, otherwise the page scrolls.
        if (!drag.committed) {
          drag.committed = Math.abs(dx) > DRAG_MIN || Math.abs(dy) > DRAG_MIN
          drag.axis = Math.abs(dx) > 2 * Math.abs(dy) ? 'horizontal' : 'vertical'
        }
        if (drag.axis !== 'horizontal') {
          drag.direction = 0
          return
        }
      }
      e.preventDefault()
      const progress = drag.from - dx / slides[0].offsetWidth
      const moved = progress - drag.progress
      drag.direction = Math.abs(dx) <= DRAG_MIN ? 0 : moved ? Math.sign(moved) : drag.direction
      drag.progress = progress
      setIndex(progress, { instant: true, keepCount: true })
      drag.index = Math.floor(0.5 + progress + 0.49 * drag.direction)
    }
    const onEnd = (e: Event) => {
      if (!drag.active) return
      drag.active = false
      gutter.style.removeProperty('cursor')
      if (!e.type.startsWith('touch')) gutter.removeEventListener('mousemove', onMove)
      if (drag.axis === 'horizontal' || drag.progress !== Math.trunc(drag.progress)) setIndex(drag.index, { keepCount: true })
      drag.progress = drag.index
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') previous()
      else return
      e.preventDefault()
    }

    const buttons = [...el.querySelectorAll<HTMLButtonElement>('[data-step]')]
    const onButton = (e: Event) => ((e.currentTarget as HTMLElement).dataset.step === 'next' ? next() : previous())
    buttons.forEach((b) => b.addEventListener('click', onButton))
    gutter.addEventListener('keydown', onKey)
    gutter.addEventListener('mousedown', onStart)
    gutter.addEventListener('mouseup', onEnd)
    gutter.addEventListener('mouseleave', onEnd)
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (touch) {
      gutter.addEventListener('touchstart', onStart, { passive: true })
      gutter.addEventListener('touchmove', onMove)
      gutter.addEventListener('touchend', onEnd)
      gutter.addEventListener('touchcancel', onEnd)
    }
    const resize = new ResizeObserver(place)
    resize.observe(gutter)
    setIndex(0, { instant: true })
    list.setAttribute('data-ready', '')
    return () => {
      stop?.()
      resize.disconnect()
      buttons.forEach((b) => b.removeEventListener('click', onButton))
      gutter.removeEventListener('keydown', onKey)
      gutter.removeEventListener('mousedown', onStart)
      gutter.removeEventListener('mouseup', onEnd)
      gutter.removeEventListener('mouseleave', onEnd)
      gutter.removeEventListener('mousemove', onMove)
      gutter.removeEventListener('touchstart', onStart)
      gutter.removeEventListener('touchmove', onMove)
      gutter.removeEventListener('touchend', onEnd)
      gutter.removeEventListener('touchcancel', onEnd)
    }
  }, [data, count, multiple])

  const [top, right, bottom, left] = data.slidePadding
  const vars = {
    '--list-title': data.colors.title,
    '--list-description': data.colors.description,
    '--list-arrow': data.colors.arrow,
    '--list-arrow-bg': data.colors.arrowBackground,
    '--list-title-size': data.titleSize,
    '--list-body-size': data.bodySize,
    '--list-title-level': `var(--heading-${data.titleTag.slice(1)}-size-value)`,
    paddingTop: data.paddingTop,
    paddingBottom: data.paddingBottom,
  } as CSSProperties
  return (
    <div
      ref={root}
      className="list-slideshow"
      data-layout-width={data.layoutWidth}
      data-multiple={multiple || undefined}
      data-card-vertical={data.cardVertical}
      data-card-horizontal={data.cardHorizontal}
      data-navigation-alignment={data.navigationAlignment}
      style={vars}
    >
      <div className="list-slideshow-wrapper">
        <div className="list-slideshow-gutter" tabIndex={multiple ? 0 : undefined}>
          <div className="list-slideshow-holder">
            <ul className="list-slides" style={{ minHeight: data.minSlideHeight }}>
              {data.items.map((item, i) => (
                <li
                  key={i}
                  className="list-slide"
                  aria-hidden={i === 0 ? undefined : true}
                  style={{
                    padding: `${top} ${right} ${arrows && data.navigationPlacement === 'bottom' ? `calc(${bottom} + ${data.navigationOffset} + 60px)` : bottom} ${left}`,
                    transform: i === 0 ? 'translate3d(0px, 0px, 0px)' : undefined,
                  }}
                >
                  <div className="list-slide-content" style={{ width: 350, minWidth: data.slideContentWidth, maxWidth: data.slideContentWidth }}>
                    <Title className="list-item-title" style={{ textAlign: data.titleAlign as CSSProperties['textAlign'] }}>
                      {item.title}
                    </Title>
                    <div
                      className="list-item-description"
                      style={{ marginTop: data.spaceBelowTitle, textAlign: data.bodyAlign as CSSProperties['textAlign'] }}
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {multiple && (
            <div className="list-slideshow-status" aria-live="polite" aria-atomic="true">
              Item 1 of {count}
            </div>
          )}
        </div>
        {arrows && (
          <>
            <div className="list-mobile-arrows">
              <button type="button" className="list-mobile-arrow list-mobile-arrow--left" aria-label="Previous" data-step="previous">
                <div className="list-mobile-arrow-bg" />
                <svg className="list-mobile-arrow-icon" viewBox="0 0 24 14" aria-hidden="true">
                  <path d="M7.87012 13L2.00021 7L7.87012 1" strokeWidth="2" fill="none" />
                  <path d="M22.9653 7L3.03948 7" strokeWidth="2" strokeLinecap="square" fill="none" />
                </svg>
              </button>
              <button type="button" className="list-mobile-arrow list-mobile-arrow--right" aria-label="Next" data-step="next">
                <div className="list-mobile-arrow-bg" />
                <svg className="list-mobile-arrow-icon" viewBox="0 0 24 14" aria-hidden="true">
                  <path d="M16.1299 1L21.9998 7L16.1299 13" strokeWidth="2" fill="none" />
                  <path d="M1.03472 7H20.9605" strokeWidth="2" strokeLinecap="square" fill="none" />
                </svg>
              </button>
            </div>
            <div className="list-arrows-outer">
              <div className="list-arrows-wrapper" style={{ paddingRight: right, paddingBottom: data.navigationOffset, paddingLeft: left }}>
                <div className="list-arrows">
                  <button type="button" className="list-arrow" aria-label="Previous" data-step="previous">
                    <div className="list-arrow-bg" />
                    <svg className="list-arrow-icon" viewBox="0 0 44 18" aria-hidden="true">
                      <path d="M9.90649 16.96L2.1221 9.17556L9.9065 1.39116" />
                      <path d="M42.8633 9.18125L3.37868 9.18125" />
                    </svg>
                  </button>
                  <button type="button" className="list-arrow" aria-label="Next" data-step="next">
                    <div className="list-arrow-bg" />
                    <svg className="list-arrow-icon" viewBox="0 0 44 18" aria-hidden="true">
                      <path d="M34.1477 1.39111L41.9321 9.17551L34.1477 16.9599" />
                      <path d="M1.19088 9.16982H40.6755" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
