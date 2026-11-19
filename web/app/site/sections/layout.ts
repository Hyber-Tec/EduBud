// The galleries' and list's layout rules, as plain functions of the window's and container's sizes. They reproduce
// what the original's pages do (measured on edubud.org at each width): the numbers below are its own.

/** The original's breakpoints for galleries: phones, tablets, small computers. */
export const BREAKPOINTS = { sm: 576, md: 768, lg: 992 }

/** How many columns a grid or masonry gallery shows in a window this wide: its setting on a computer, fewer below. */
export function columnsAt(columns: number, windowWidth: number): number {
  const n = Math.max(1, columns)
  if (n === 1) return 1
  if (windowWidth <= BREAKPOINTS.sm) return 2
  if (windowWidth <= BREAKPOINTS.md) return Math.max(Math.ceil(n / 2), 2)
  if (windowWidth <= BREAKPOINTS.lg) return Math.ceil(n * 0.75)
  return n
}

/** A gutter setting above 20 shrinks on smaller windows (never below 20). */
export function gutterAt(gutter: number, windowWidth: number): number {
  const min = 20
  if (gutter <= min) return gutter
  if (windowWidth <= BREAKPOINTS.sm) return Math.max(min, Math.round(gutter * 0.25))
  if (windowWidth <= BREAKPOINTS.md) return Math.max(min, Math.round(gutter * 0.5))
  if (windowWidth <= BREAKPOINTS.lg) return Math.max(min, Math.round(gutter * 0.75))
  return gutter
}

/** A picture's place in a laid-out gallery. `x` may be fractional; widths and heights are whole pixels. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
  /** Masonry: the picture's own width when it's a pixel or two wider than its column (cropped by it). */
  imageWidth?: number
}

/**
 * "Strips": rows of pictures at their own proportions, each row stretched to the full width. Pictures fill a row at
 * the target height until the next would overflow it by more than a quarter of that height; a lone picture left for
 * the last row joins the row before (except on narrow screens).
 */
export function stripsLayout(ratios: number[], width: number, rowHeight: number, gutter: number): { boxes: Box[]; height: number } {
  const limit = width + gutter + 0.25 * rowHeight
  const rows: { items: number[]; width: number }[] = [{ items: [], width: 0 }]
  ratios.forEach((ratio, i) => {
    const w = Math.round(ratio * rowHeight)
    let row = rows[rows.length - 1]
    if (row.width + w > limit) rows.push((row = { items: [], width: 0 }))
    row.items.push(i)
    row.width += w
  })
  const last = rows[rows.length - 1]
  const before = rows[rows.length - 2]
  if (width > 500 && before && last.items.length === 1 && before.items.length > 1) {
    before.items.push(last.items[0])
    before.width += Math.round(ratios[last.items[0]] * rowHeight)
    rows.pop()
  }
  const boxes: Box[] = []
  let y = 0
  for (const row of rows) {
    const h = row.items.length ? Math.round(((width - gutter * (row.items.length - 1)) / row.width) * rowHeight) : 0
    let x = 0
    for (const i of row.items) {
      const w = ratios[i] * h
      boxes[i] = { x, y, width: Math.round(w), height: h }
      x += w + gutter
    }
    y += h + gutter
  }
  return { boxes, height: y - gutter }
}

/**
 * Masonry: equal columns, each picture placed at the top of the shortest one. A picture's frame is its height in the
 * column rounded up; when its height rounds down, the picture is widened a little so it still fills the frame.
 */
export function masonryLayout(ratios: number[], width: number, columns: number, gutter: number, gutterAtEdges: boolean): { boxes: Box[]; height: number } {
  const offset = gutterAtEdges ? gutter : 0
  const step = gutterAtEdges ? (width - gutter) / columns : (width + gutter) / columns
  const column = step - gutter
  const heights = new Array<number>(columns).fill(0)
  const boxes = ratios.map((ratio) => {
    const c = heights.indexOf(Math.min(...heights))
    const rounded = Math.round(column / ratio)
    const frame = Math.ceil(column / ratio)
    const box: Box = { x: Math.round(offset + step * c), y: Math.round(heights[c]), width: Math.round(column), height: frame }
    if (rounded < frame) box.imageWidth = Math.round((column * frame) / rounded)
    heights[c] += frame + gutter
    return box
  })
  return { boxes, height: Math.max(...heights) - gutter }
}

/**
 * The reel: pictures side by side at the reel's height, the current one centred, wrapping round without end. Given
 * the slides' widths and a position (0 = the first picture centred, 1 = the second, fractions between), returns each
 * slide's left edge, or null when it's out of view.
 */
export function reelPositions(widths: number[], count: number, regionWidth: number, position: number): (number | null)[] {
  const starts: number[] = []
  let total = 0
  for (const w of widths) {
    starts.push(total)
    total += w
  }
  // The centre of each of the first `count` pictures, and of the first one again after the last.
  const centres = starts.slice(0, count).map((s, i) => s + widths[i] / 2)
  centres.push(count < widths.length ? starts[count] + widths[count] / 2 : total + widths[0] / 2)
  const p = ((position % count) + count) % count
  const seg = Math.min(Math.floor(p), count - 1)
  const centre = centres[seg] + (p - seg) * (centres[seg + 1] - centres[seg])
  const shift = regionWidth / 2 - centre
  return widths.map((w, i) => {
    let x = shift + starts[i]
    if (x + w < 0) x += total
    else if (x > regionWidth) x -= total
    return x + w > 0 && x < regionWidth ? x : null
  })
}

/**
 * The list's slideshow: slides of equal width in a row, `spacing` apart, at a position (0 = the first slide in view,
 * fractions while sliding). Endless, the slides wrap round. Returns each slide's left edge (null when out of view)
 * and whether it's away from the current one (hidden from screen readers). `edge`: the slides' inset in their window.
 */
export function slidePositions(count: number, width: number, spacing: number, regionWidth: number, edge: number, position: number, infinite: boolean): { x: number | null; away: boolean }[] {
  const p = ((position % count) + count) % count
  const round = count * (width + spacing)
  return Array.from({ length: count }, (_, i) => {
    let x = (i - p) * (width + spacing)
    let near = i - p
    if (infinite && x + width < -edge) {
      x += round
      near += count
    } else if (infinite && x >= regionWidth) {
      x -= round
      near -= count
    }
    return { x: x + width >= -edge && x < regionWidth ? x : null, away: Math.abs(near) >= 0.5 }
  })
}

/** The original's easing for slides: fast, then slowing to a stop. */
export const easeOut = (t: number) => t * (2 - t)

/**
 * Moves a value from `from` to `to` over `duration` ms on each animation frame. Returns a function that stops it.
 */
export function tween(from: number, to: number, duration: number, onUpdate: (value: number) => void, onDone?: () => void): () => void {
  const start = performance.now()
  let frame = requestAnimationFrame(function tick(now) {
    const t = Math.min(1, (now - start) / duration)
    onUpdate(from + (to - from) * easeOut(t))
    if (t < 1) frame = requestAnimationFrame(tick)
    else onDone?.()
  })
  return () => cancelAnimationFrame(frame)
}

/** The smallest of a picture's widths that covers `needed` pixels (the largest if none does). */
export function widthFor(widths: number[], needed: number): number {
  return widths.find((w) => w >= needed) ?? widths[widths.length - 1]
}
