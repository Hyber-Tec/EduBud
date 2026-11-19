import { useEffect, useRef, useState } from 'react'
import type { AccordionBlock as Data } from '~/content/types'

/** How long an item takes to slide open or shut, and its easing (the original's "product default" curve). */
const DURATION = 250
const EASING = 'cubic-bezier(0.66, 0, 0.34, 1)'

/** Runs `fn` two frames from now, once the browser has drawn the starting height (as the original waits). */
const afterTwoFrames = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn))

/**
 * An accordion, as the original's: clicking a title slides its description open or shut over 250ms, closing the
 * others first unless several may be open. Its icon turns at once (styles/blocks.css). While an item is moving, clicks
 * on it wait.
 */
export function AccordionBlock({ block }: { block: Data }) {
  const first = block.firstOpen ? [0] : []
  // `open`: the titles' state (their icon and aria-expanded), which changes on the click. `shown`: the descriptions
  // that are displayed, which stay while they slide shut.
  const [open, setOpen] = useState<number[]>(first)
  const [shown, setShown] = useState<number[]>(first)
  const drops = useRef<(HTMLDivElement | null)[]>([])
  // Each item's latest slide (a newer one, e.g. shutting an item that was still opening, cancels the older one's
  // remaining steps), and the items moving now.
  const slides = useRef(new Map<number, number>())
  const busy = useRef(new Set<number>())
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const transition = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : `height ${DURATION}ms ${EASING}`)

  /** Starts a slide of item `i`: `to` sets its end height two frames from now, `done` tidies up when it's there. */
  const slide = (i: number, to: () => void, done: () => void) => {
    const id = (slides.current.get(i) ?? 0) + 1
    slides.current.set(i, id)
    busy.current.add(i)
    afterTwoFrames(() => {
      if (slides.current.get(i) !== id) return
      to()
      const timer = window.setTimeout(() => {
        timers.current.delete(timer)
        if (slides.current.get(i) !== id) return
        done()
        busy.current.delete(i)
      }, DURATION)
      timers.current.add(timer)
    })
  }

  const slideOpen = (i: number) => {
    const el = drops.current[i]
    if (!el) return
    // Its full height, measured before it shows; then it starts from nothing.
    el.hidden = false
    el.style.height = ''
    const height = el.getBoundingClientRect().height
    el.style.height = '0px'
    el.style.transition = transition()
    setOpen((cur) => [...cur, i])
    setShown((cur) => (cur.includes(i) ? cur : [...cur, i]))
    slide(
      i,
      () => void (el.style.height = `${height}px`),
      () => {
        el.style.removeProperty('height')
        el.style.removeProperty('transition')
      },
    )
  }

  const slideShut = (i: number) => {
    const el = drops.current[i]
    if (!el) return
    el.style.height = `${el.getBoundingClientRect().height}px`
    el.style.transition = transition()
    setOpen((cur) => cur.filter((x) => x !== i))
    slide(
      i,
      () => void (el.style.height = '0px'),
      () => {
        // Hidden here as well as by React, so it never shows at full height for a frame.
        el.hidden = true
        el.style.removeProperty('height')
        el.style.removeProperty('transition')
        setShown((cur) => cur.filter((x) => x !== i))
      },
    )
  }

  const toggle = (i: number) => {
    if (busy.current.has(i)) return
    if (open.includes(i)) return slideShut(i)
    if (!block.allowMultiple) open.forEach(slideShut)
    slideOpen(i)
  }

  const d = block.dividers
  const Title = block.titleTag ?? 'p'
  return (
    <div className="block accordion-block">
      <ul
        className={`accordion accordion--icon-${block.iconPlacement}`}
        data-title-align={block.titleAlign}
        data-description-align={block.descriptionAlign}
        data-description-placement={block.descriptionPlacement}
      >
        {block.items.map((item, i) => {
          const isOpen = open.includes(i)
          return (
            <li key={i} className="accordion-item" data-open={isOpen || undefined}>
              {d.enabled && d.first && i === 0 && <div className="accordion-divider accordion-divider--top" />}
              <Title className={`accordion-title ${block.titleClass}`}>
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(i)}>
                  <span className="accordion-title-text">{item.title}</span>
                  <span className={`accordion-icon accordion-icon--${block.icon}`} aria-hidden="true">
                    {block.icon === 'plus' ? (
                      <span className="plus">
                        <span className="plus-h" />
                        <span className="plus-v" />
                      </span>
                    ) : (
                      <span className="arrow-container">
                        <span className="arrow" />
                      </span>
                    )}
                  </span>
                </button>
              </Title>
              <div className="accordion-dropdown" hidden={!shown.includes(i)} ref={(el) => void (drops.current[i] = el)}>
                <div className={`accordion-description rte ${block.descriptionClass}`} dangerouslySetInnerHTML={{ __html: item.html }} />
              </div>
              {d.enabled && (i < block.items.length - 1 || d.last) && <div className="accordion-divider" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
