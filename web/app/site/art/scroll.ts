/**
 * How far the page has scrolled past a box, from 0 to 1, as the original measures it for the effects on its
 * pictures (parallax.ts). For a box in the middle of a page, it goes from 0 when the box's top comes in at the
 * window's bottom to 1 when its bottom leaves at the window's top. Near the top (or the bottom) of the page, which
 * can't scroll that far, the box gets the whole range over the scroll there is: the first section goes from 0 with
 * the page at its top to 1 when its bottom reaches the window's top.
 *
 * It's measured when the box comes on screen or leaves it; then, while it's on screen, on the frame after each
 * scroll (from the scroll alone, the box and the window as last measured; on touch screens, measuring them again);
 * and again once the window has stopped changing size.
 */

type Listener = () => void

// The page's scrolling: one listener, and one animation frame after a scroll for every box on screen.
const scrollListeners: Listener[] = []
let scrollFrameAsked = false

function onScroll() {
  if (scrollFrameAsked) return
  scrollFrameAsked = true
  requestAnimationFrame(() => {
    for (const listener of [...scrollListeners]) listener()
    scrollFrameAsked = false
  })
}

function listenToScroll(listener: Listener) {
  if (scrollListeners.includes(listener)) return
  if (!scrollListeners.length) addEventListener('scroll', onScroll, { passive: true })
  scrollListeners.push(listener)
}

function stopListeningToScroll(listener: Listener) {
  const i = scrollListeners.indexOf(listener)
  if (i === -1) return
  scrollListeners.splice(i, 1)
  if (!scrollListeners.length) removeEventListener('scroll', onScroll)
}

// The window's size: told once it has stopped changing (a frame after a change, 150 ms without another, a frame).
const resizeListeners = new Set<Listener>()
let resizeFrame = 0
let settledFrame = 0
let settling: ReturnType<typeof setTimeout> | undefined

function onResize() {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    clearTimeout(settling)
    settling = setTimeout(() => {
      cancelAnimationFrame(settledFrame)
      settledFrame = requestAnimationFrame(() => resizeListeners.forEach((listener) => listener()))
    }, 150)
  })
}

function listenToResize(listener: Listener) {
  if (!resizeListeners.size) addEventListener('resize', onResize)
  resizeListeners.add(listener)
}

function stopListeningToResize(listener: Listener) {
  resizeListeners.delete(listener)
  if (resizeListeners.size) return
  clearTimeout(settling)
  cancelAnimationFrame(settledFrame)
  removeEventListener('resize', onResize)
}

export interface ScrollWatch {
  stop(): void
}

/**
 * Watches how far the page has scrolled past `box`: `progress` hears it (0 to 1) each time it changes, and `visible`
 * each time the box comes on screen or leaves it, just before the progress measured then.
 */
export function watchScroll(box: HTMLElement, on: { visible(visible: boolean): void; progress(progress: number): void }): ScrollWatch {
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  // As last measured: the window's height, the box's height, its top on the page (rounded), how far the page was
  // scrolled, and how much of the page is above the box and below it.
  let windowHeight = 0
  let height = 0
  let top = 0
  let scrollTop = 0
  let above = 0
  let below = 0
  let last = -1

  const measure = () => {
    windowHeight = innerHeight
    height = box.clientHeight
    scrollTop = pageYOffset
    top = Math.round(box.getBoundingClientRect().top) + scrollTop
  }
  const measurePage = () => {
    measure()
    above = 0
    for (let n: HTMLElement | null = box; n; n = n.offsetParent as HTMLElement | null) above += n.offsetTop
    below = document.body.scrollHeight - above - height
  }
  /** Works the progress out (from the scroll alone, or measuring the box and the window again) and tells it if it changed. */
  const update = (scrollOnly: boolean) => {
    if (scrollOnly) scrollTop = pageYOffset
    else measure()
    // The page scrolls this much before the box starts to go by (at most a window's height), and this much after.
    const before = Math.min(above, windowHeight)
    const after = Math.min(below, windowHeight)
    const scrolled = -(top - scrollTop) + before
    const range = before + height + after - windowHeight
    const share = scrolled === range ? 1 : scrolled / range
    const progress = share < 0 ? 0 : share > 1 ? 1 : share
    if (progress === last) return
    last = progress
    on.progress(progress)
  }

  const scrolled = () => update(!touch)
  const resized = () => {
    measurePage()
    update(true)
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        on.visible(e.isIntersecting)
        update(false)
        if (e.isIntersecting) listenToScroll(scrolled)
        else stopListeningToScroll(scrolled)
      }),
    { rootMargin: '0px 0px 0px 0px' },
  )
  listenToResize(resized)
  measurePage()
  io.observe(box)
  return {
    stop() {
      io.disconnect()
      stopListeningToResize(resized)
      stopListeningToScroll(scrolled)
    },
  }
}
