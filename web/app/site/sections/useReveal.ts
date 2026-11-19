import { useEffect, type RefObject } from 'react'

/**
 * Shows a gallery's pictures as they scroll into view, as the original does: each one gets `data-show` when it enters
 * the window, those entering together one after another, 50 ms apart (the CSS draws the effect, or none).
 */
export function useReveal(container: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const root = container.current
    if (!root) return
    const nodes = [...root.querySelectorAll<HTMLElement>(selector)]
    const timers: number[] = []
    let count = 0
    let reset = 0
    const show = (node: HTMLElement) => {
      timers.push(window.setTimeout(() => node.setAttribute('data-show', ''), 50 + count * 50))
      count = Math.min(count + 1, 20)
      window.clearTimeout(reset)
      reset = window.setTimeout(() => (count = 0), 10)
    }
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach(show)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        show(entry.target as HTMLElement)
      }
    })
    nodes.forEach((node) => observer.observe(node))
    return () => {
      observer.disconnect()
      timers.forEach((t) => window.clearTimeout(t))
      window.clearTimeout(reset)
    }
  }, [container, selector])
}

/** The element's width (whole pixels, as the original reads it), kept up to date as the window changes. */
export function observeWidth(el: HTMLElement, onChange: (width: number) => void): () => void {
  let last = -1
  const read = () => {
    const w = el.clientWidth
    if (w !== last) {
      last = w
      onChange(w)
    }
  }
  read()
  const observer = new ResizeObserver(read)
  observer.observe(el)
  return () => observer.disconnect()
}
