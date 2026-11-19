import { useLayoutEffect, useRef, useState } from 'react'
import { GalleryImage } from './GalleryImage'
import { columnsAt, gutterAt, masonryLayout, stripsLayout, widthFor, type Box } from './layout'
import type { GallerySectionData } from './types'
import { observeWidth, useReveal } from './useReveal'

const ratio = (d: GallerySectionData, i: number) => d.items[i].picture.width / d.items[i].picture.height || 1

/**
 * The galleries laid out by script, as the original's are: "strips" (justified rows) and masonry (columns). Until the
 * container's width is known (the prerendered page, before the script runs), the pictures wait hidden and unfetched;
 * then each is placed at the original's exact position, and laid out again when the width changes.
 */
export function GalleryRows({ data }: { data: GallerySectionData }) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ boxes: Box[]; height: number } | null>(null)
  useReveal(ref, '.gallery-item')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    return observeWidth(el, (width) => {
      const ratios = data.items.map((_, i) => ratio(data, i))
      const windowWidth = window.innerWidth
      if (data.design === 'strips') {
        setLayout(stripsLayout(ratios, width, data.rowHeight ?? 300, gutterAt(data.gutter ?? 0, windowWidth)))
      } else {
        // The gutter is a share of the width (1 = 0.05%), and runs along the edges of a full-bleed gallery too.
        const gutter = (gutterAt(data.gutter ?? 0, windowWidth) / 20) * (width / 100)
        setLayout(masonryLayout(ratios, width, columnsAt(data.columns ?? 3, windowWidth), gutter, data.width === 'full-bleed'))
      }
    })
  }, [data])

  const strips = data.design === 'strips'
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return (
    <div className={`gallery gallery--${data.design}`} data-width={data.width} data-animation={data.animation}>
      <div ref={ref} className="gallery-rows-list" data-ready={layout ? '' : undefined} style={{ height: layout?.height }}>
        {data.items.map((item, i) => {
          const b = layout?.boxes[i]
          const position = b ? { width: b.width, transform: strips ? `matrix(1, 0, 0, 1, ${b.x}, ${b.y})` : `translate3d(${b.x}px, ${b.y}px, 0px)` } : undefined
          // Strips: the file the original picks for the picture's size; masonry: the browser's pick by `sizes`.
          const src = strips ? (b ? `${item.picture.base}/${widthFor(item.picture.widths, Math.max(b.width, ratio(data, i) * b.height) * dpr)}.${item.picture.ext}` : null) : undefined
          return (
            <figure key={i} className="gallery-item" style={position}>
              <div className="gallery-item-frame" style={b ? { height: b.height } : undefined}>
                <GalleryImage item={item} src={src} style={b?.imageWidth ? { width: b.imageWidth } : undefined} />
              </div>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
