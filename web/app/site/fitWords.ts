/**
 * On phones, a heading never breaks a word in two. The original's headings are sized by the screen's height, so on a
 * narrow phone a long word can be wider than its block ("Communit" / "y"); such a heading is made just small enough
 * for its longest word to fit. Headings whose words fit keep their size, and wider screens are left alone. Runs once
 * the page is drawn, again when the fonts have loaded, and when the window's size changes; returns how to stop.
 */
const PHONE = '(max-width: 767px)'

export function fitWords(): () => void {
  let frame = 0
  const run = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(fitAll)
  }
  run()
  void document.fonts?.ready.then(run)
  window.addEventListener('resize', run)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', run)
  }
}

function fitAll() {
  const phone = window.matchMedia(PHONE).matches
  const headings = [...document.querySelectorAll<HTMLElement>('.rte h1, .rte h2, .rte h3, .rte h4')].filter((h) => !h.closest('.rte-scaled-text'))
  // Back to their own size first, then measured: one heading's size doesn't change another's room.
  for (const h of headings) {
    if (!h.dataset.fitWords) continue
    h.style.removeProperty('font-size')
    delete h.dataset.fitWords
  }
  if (!phone) return
  for (const h of headings) {
    const room = h.clientWidth
    const longest = longestWord(h)
    if (room > 0 && longest > room) {
      const size = parseFloat(getComputedStyle(h).fontSize)
      h.style.fontSize = `${Math.floor(((size * room * 0.99) / longest) * 10) / 10}px`
      h.dataset.fitWords = 'on'
    }
  }
}

/** The width of the heading's widest word as it's drawn (a word broken across lines counts its pieces together). */
function longestWord(h: HTMLElement): number {
  let widest = 0
  const range = document.createRange()
  const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const m of (node.textContent ?? '').matchAll(/[^\s\-–—/]+/g)) {
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      let width = 0
      for (const r of range.getClientRects()) width += r.width
      widest = Math.max(widest, width)
    }
  }
  return widest
}
