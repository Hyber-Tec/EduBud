import type { Picture } from '~/content/types'

/**
 * How much wider than its box a picture must be to cover the box (cropped, as `object-fit: cover`): 1 when the box is
 * relatively wider than the picture, more when the picture is wider. The original asks for its files this way, so a
 * `sizes` that multiplies the box's width by this factor makes the browser pick the same file the original shows.
 */
export function coverFactor(p: Picture, boxRatio: number): number {
  if (!p.width || !p.height) return 1
  return Math.max(1, p.width / p.height / boxRatio)
}

/** A shape setting like `3 / 4` as a number (width ÷ height). */
export function ratio(value: string | undefined, fallback = 1): number {
  const [w, h] = (value ?? '').split('/').map((x) => Number(x.trim()))
  return w > 0 && h > 0 ? w / h : fallback
}

/** A number for `calc()`, without needless digits. */
export const num = (n: number) => String(Math.round(n * 10000) / 10000)

/** The smallest of a picture's files at least `width` pixels wide (the largest if none is), as the original picks. */
export function fileFor(p: Picture, width: number): string {
  const w = p.widths.find((x) => x >= width) ?? p.widths[p.widths.length - 1]
  return `${p.base}/${w}.${p.ext}`
}
