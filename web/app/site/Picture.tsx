import type { CSSProperties } from 'react'
import type { Picture as PictureData } from '~/content/types'

/** The picture's files, widest last, as a `srcset`: the browser picks the same width the original serves. */
export function srcSet(p: PictureData): string {
  return p.widths.map((w) => `${p.base}/${w}.${p.ext} ${w}w`).join(', ')
}

export function pictureSrc(p: PictureData, width = 1500): string {
  const w = p.widths.find((x) => x >= width) ?? p.widths[p.widths.length - 1]
  return `${p.base}/${w}.${p.ext}`
}

/** The focal point as CSS `object-position`. */
export function focal(p: PictureData): string | undefined {
  return p.focal ? `${(p.focal[0] * 100).toFixed(3)}% ${(p.focal[1] * 100).toFixed(3)}%` : undefined
}

interface Props {
  picture: PictureData
  className?: string
  style?: CSSProperties
  /** Load it at once (the logo, the first screen) instead of when it scrolls into view. */
  eager?: boolean
  alt?: string
}

export function Img({ picture, className, style, eager, alt }: Props) {
  return (
    <img
      className={className}
      src={pictureSrc(picture)}
      srcSet={srcSet(picture)}
      sizes={eager ? '100vw' : 'auto, 100vw'}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      alt={alt ?? picture.alt}
      width={picture.width || undefined}
      height={picture.height || undefined}
      style={style}
    />
  )
}
