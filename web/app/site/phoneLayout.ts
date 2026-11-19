/**
 * The phone layout (below 768px): the original's own, with two kinds of changes that make it read well on a phone.
 * Nothing here changes wider screens, which use each block's desktop place.
 *
 * 1. Rules for every page.
 *    - Text never overlaps the blocks after it. On the original's phone grid a block often starts a row or two before
 *      the block above it ends, or inside its rows; that works while the text above is short, but as soon as it wraps
 *      onto more lines it runs into what follows (a name into its role, a heading over a photo, a paragraph under a
 *      picture). So a block of text (or an accordion, or a form) ends where the next block begins, and its rows grow
 *      to fit it, pushing what follows down. A card of text (a text block with its own background) does so only for a
 *      block reaching below it (a button inside a card stays in it). A block of text that starts inside a picture or a
 *      button and reaches below it starts below it instead. Shapes are left alone (they're drawn behind or around other
 *      blocks on purpose), and so are pictures overlapping each other (a collage), text sitting wholly on a picture
 *      (a caption on a photo), and blocks kept apart by a shape drawn between them where they meet (a label on a
 *      flower on a photo's edge, a card behind its text).
 *    - Text keeps the page's side margins: a block of text without a background of its own stays within the grid's
 *      eight columns, out of the margins at either side.
 *    - No empty space under a video or a form. Their blocks often have more rows than they fill on a phone, leaving a
 *      gap below them. A video's rows are cut to what it fills on the narrowest phone (320px) and a form's to one
 *      row; the grid's rows grow to fit them at any width, and the blocks below move up by the rows set free. Only
 *      when no other block uses those rows.
 * 2. Changes for one block at a time, written by hand in content/phone.json, each saying what it fixes.
 */
import phone from '~/content/phone.json'
import type { Area, Block, Section } from '~/content/types'
import widgets from '~/content/widgets.json'

/** A hand-written change to one block's phone layout (content/phone.json). */
export interface PhoneChange {
  why: string
  /** Its place on the phone grid: first row, first column, the row after its last, the column after its last. */
  area?: [number, number, number, number]
  /** Its layer on phones (higher is drawn over lower). */
  z?: number
  /** Hidden on phones. */
  hide?: boolean
  /** A picture of text, opened full size when tapped (on phones). */
  zoom?: boolean
}

interface PhoneFile {
  pages: Record<string, { blocks?: Record<string, PhoneChange>; sections?: Record<string, { why: string; rows: number }> }>
}

const pages = Object.values((phone as unknown as PhoneFile).pages)
const blockChanges: Record<string, PhoneChange> = Object.assign({}, ...pages.map((p) => p.blocks ?? {}))
const sectionRows: Record<string, number> = Object.assign({}, ...pages.map((p) => Object.fromEntries(Object.entries(p.sections ?? {}).map(([id, s]) => [id, s.rows]))))

/** A block's hand-written phone change, if it has one. */
export function phoneChange(id: string): PhoneChange | undefined {
  return blockChanges[id]
}

/** Blocks whose height follows their text: their rows grow to fit them. */
const GROWS = new Set<Block['type']>(['text', 'accordion', 'form'])

const sharesColumns = (a: Area, b: Area) => Math.min(a.colEnd, b.colEnd) > Math.max(a.colStart, b.colStart)

/** The narrowest phone a layout has to fit, and the phone grid's smallest row (as the original's). */
const NARROWEST = 320
const ROW = 24

/**
 * How wide a block is on a phone W px wide: the grid's columns are a margin (6vw, less a gap) at either side and
 * eight equal cells, with gaps between them all.
 */
function blockWidth(area: Area, colGap: number, w: number): number {
  const margin = 0.06 * w - colGap
  const cell = (0.88 * w - 7 * colGap) / 8
  let width = (area.colEnd - area.colStart - 1) * colGap
  for (let c = area.colStart; c < area.colEnd; c++) width += c === 1 || c === 10 ? margin : cell
  return width
}

/** A video's height as a share of its width. */
function videoRatio(b: Block): number | undefined {
  if (b.type !== 'video') return undefined
  const native = (widgets.video as Record<string, { aspectRatio?: number }>)[b.id]?.aspectRatio
  if (b.provider === 'native') return native ? 1 / native : b.file ? b.file.height / b.file.width : undefined
  return b.ratio ? b.ratio / 100 : undefined
}

/** The rows a block needs when its height is its content's: a video's on the narrowest phone, a form's one. */
function contentRows(b: Block, area: Area, section: Section): number | undefined {
  if (b.type === 'form') return 1
  const ratio = videoRatio(b)
  if (!ratio) return undefined
  const { gap, colGap } = section.grid.mobile
  const height = blockWidth(area, colGap, NARROWEST) * ratio
  return Math.max(1, Math.floor((height + gap) / (ROW + gap)))
}

/** A shape drawn between two layers, its area covering the whole of a region (where two blocks meet). */
function shapeBetween(shapes: Area[], region: Area, zLow: number, zHigh: number): boolean {
  return shapes.some(
    (s) =>
      s.z > zLow &&
      s.z < zHigh &&
      s.rowStart <= region.rowStart &&
      s.rowEnd >= region.rowEnd &&
      s.colStart <= region.colStart &&
      s.colEnd >= region.colEnd,
  )
}

/** Each block's place on the phone grid, and how many rows the grid has. */
export function phoneLayout(section: Section): { areas: Map<string, Area>; rows: number } {
  const areas = new Map<string, Area>()
  for (const b of section.blocks) {
    const change = blockChanges[b.id]
    const area = { ...b.mobile, z: change?.z ?? b.mobile.z }
    if (change?.area) [area.rowStart, area.colStart, area.rowEnd, area.colEnd] = change.area
    // Columns 2 to 9 are the grid's eight; 1 and 10 are the margins at either side.
    if (b.type === 'text' && !b.background) {
      area.colStart = Math.max(area.colStart, 2)
      area.colEnd = Math.max(area.colStart + 1, Math.min(area.colEnd, 10))
    }
    areas.set(b.id, area)
  }
  const shown = section.blocks.filter((b) => !blockChanges[b.id]?.hide)

  // Videos and forms: their rows cut to what they need, and the blocks below moved up into the rows set free, when no
  // other block uses them.
  let freed = 0
  for (const b of [...shown].sort((x, y) => areas.get(x.id)!.rowStart - areas.get(y.id)!.rowStart)) {
    const A = areas.get(b.id)!
    const need = contentRows(b, A, section)
    if (!need || A.rowEnd - A.rowStart <= need) continue
    const cut = A.rowStart + need
    if (shown.some((o) => o !== b && areas.get(o.id)!.rowStart < A.rowEnd && areas.get(o.id)!.rowEnd > cut)) continue
    const rows = A.rowEnd - cut
    for (const o of section.blocks) {
      const O = areas.get(o.id)!
      if (o !== b && O.rowStart >= A.rowEnd) {
        O.rowStart -= rows
        O.rowEnd -= rows
      }
    }
    A.rowEnd = cut
    freed += rows
  }

  const shapes = shown.filter((b) => b.type === 'shape').map((b) => areas.get(b.id)!)
  const content = shown.filter((b) => b.type !== 'shape')

  // Until nothing changes (each change can only shrink a block's rows, so this ends).
  for (let pass = 0, changed = true; changed && pass < 50; pass++) {
    changed = false
    for (const a of content) {
      for (const b of content) {
        const A = areas.get(a.id)!
        const B = areas.get(b.id)!
        // B starts inside A's rows (A starts first).
        if (a === b || !(A.rowStart < B.rowStart && B.rowStart < A.rowEnd) || !sharesColumns(A, B)) continue
        const region: Area = {
          rowStart: B.rowStart,
          rowEnd: Math.min(A.rowEnd, B.rowEnd),
          colStart: Math.max(A.colStart, B.colStart),
          colEnd: Math.min(A.colEnd, B.colEnd),
          z: 0,
        }
        if (shapeBetween(shapes, region, Math.min(A.z, B.z), Math.max(A.z, B.z))) continue
        // B reaches below A (they're staggered), or stays within A's rows.
        const staggered = A.rowEnd < B.rowEnd
        if (GROWS.has(a.type) && (staggered || !a.background)) A.rowEnd = B.rowStart
        else if (GROWS.has(b.type) && staggered) B.rowStart = A.rowEnd
        else continue
        changed = true
      }
    }
  }
  const lastRow = Math.max(0, ...[...areas.values()].map((a) => a.rowEnd - 1))
  return { areas, rows: sectionRows[section.id] ?? Math.max(section.grid.mobile.rows - freed, lastRow) }
}
