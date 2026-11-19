/**
 * Text the original marks "scaled" fills its block's width, sized as Squarespace's own script sizes it: the line's font
 * size is multiplied by how much wider its container is than the line (both in whole pixels), rounded to a tenth of a
 * pixel, and again each time either changes size, until it settles. (Measuring once at a large size isn't the same:
 * letter spacing in pixels doesn't grow with the text.) At most every 40ms, as the original.
 */
export function fitText() {
  const stops: (() => void)[] = []
  for (const container of document.querySelectorAll<HTMLElement>('.rte-scaled-text-container')) {
    const line = container.querySelector<HTMLElement>('.rte-scaled-text')
    if (!line) continue
    const fit = () => {
      const width = container.offsetWidth
      const natural = line.offsetWidth
      if (!width || !natural) return
      const size = parseFloat(getComputedStyle(line).fontSize)
      const next = Math.max(1, Math.round((width / natural) * size * 10) / 10)
      if (next !== size) line.style.fontSize = `${next}px`
      line.style.visibility = 'visible'
    }
    const throttled = throttle(fit, 40)
    const resized = new ResizeObserver(throttled)
    resized.observe(container)
    resized.observe(line)
    stops.push(() => resized.disconnect())
  }
  return () => stops.forEach((stop) => stop())
}

/** Runs `fn` at once, then at most every `ms`, with one last run after the calls stop (as lodash's throttle). */
function throttle(fn: () => void, ms: number): () => void {
  let last = 0
  let timer = 0
  return () => {
    const wait = last + ms - performance.now()
    if (wait <= 0) {
      window.clearTimeout(timer)
      timer = 0
      last = performance.now()
      fn()
    } else if (!timer) {
      timer = window.setTimeout(() => {
        timer = 0
        last = performance.now()
        fn()
      }, wait)
    }
  }
}
