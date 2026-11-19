import { useRef, type CSSProperties } from 'react'
import { GalleryImage } from './GalleryImage'
import { columnsAt } from './layout'
import type { GallerySectionData } from './types'
import { useReveal } from './useReveal'

/** Each cell's height as a share of its width, by the original's aspect-ratio setting. */
const CELL: Record<string, string> = {
  square: '100%',
  standard: '66.666%',
  'standard-vertical': '150%',
  'four-three': '75%',
  'three-four-vertical': '133.333%',
  widescreen: '56.25%',
  'anamorphic-widescreen': '41.666%',
  'ultra-widescreen': '41.666%',
}

/**
 * A grid of equal cells, each picture cropped to fill its cell. Its columns change with the window (the CSS reads
 * the counts below at the original's breakpoints), so it needs no script but the pictures' appearing.
 */
export function GalleryGrid({ data }: { data: GallerySectionData }) {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref, '.gallery-item')
  const n = data.columns ?? 3
  const gap = `${(data.gutter ?? 0) / 20}vw`
  const style = {
    '--cols': columnsAt(n, Infinity),
    '--cols-lg': columnsAt(n, 992),
    '--cols-md': columnsAt(n, 768),
    '--cols-sm': columnsAt(n, 576),
    '--gap': gap,
    '--cell': CELL[data.aspectRatio ?? 'square'] ?? '100%',
  } as CSSProperties
  return (
    <div ref={ref} className="gallery gallery--grid" data-width={data.width} data-animation={data.animation} style={style}>
      <div className="gallery-grid-list">
        {data.items.map((item, i) => (
          <figure key={i} className="gallery-item">
            <div className="gallery-item-frame">
              <GalleryImage item={item} />
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}
