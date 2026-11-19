import type { CSSProperties } from 'react'
import { focal, pictureSrc, srcSet } from '../Picture'
import type { GalleryItem } from './types'

interface Props {
  item: GalleryItem
  /**
   * A file chosen for the picture's laid-out size (strips, as the original picks it), instead of letting the browser
   * pick by `sizes`; `null` until the layout is known, so no file is fetched before then.
   */
  src?: string | null
  style?: CSSProperties
}

/** A gallery's picture: the original's widths and `sizes`, so the browser shows the same file it does. */
export function GalleryImage({ item, src, style }: Props) {
  const p = item.picture
  const chosen = src !== undefined
  return (
    <img
      src={chosen ? (src ?? undefined) : pictureSrc(p)}
      srcSet={chosen ? undefined : srcSet(p)}
      sizes={chosen ? undefined : item.sizes}
      alt={p.alt}
      width={p.width || undefined}
      height={p.height || undefined}
      loading="lazy"
      decoding="async"
      style={{ objectPosition: focal(p) ?? '50% 50%', ...style }}
    />
  )
}
