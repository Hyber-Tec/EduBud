/**
 * Text the original marks "scaled" fills its block's width: each line's size is set so its widest line just fits,
 * as Squarespace's does. Runs after the page loads and again when the window's size changes.
 */
export function fitText() {
  const fit = () => {
    for (const span of document.querySelectorAll<HTMLElement>('.rte-scaled-text')) {
      const container = span.closest('.rte-scaled-text-container') as HTMLElement | null
      if (!container) continue
      span.style.fontSize = '100px'
      const natural = span.getBoundingClientRect().width
      const width = container.getBoundingClientRect().width
      if (natural > 0 && width > 0) span.style.fontSize = `${(100 * width) / natural}px`
      span.style.visibility = 'visible'
    }
  }
  fit()
  void document.fonts?.ready.then(fit)
  window.addEventListener('resize', fit)
  return () => window.removeEventListener('resize', fit)
}
