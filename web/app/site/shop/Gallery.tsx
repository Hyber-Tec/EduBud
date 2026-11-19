import { useEffect, useRef, useState } from 'react'
import type { Picture } from '~/content/types'
import { focal, pictureSrc, srcSet } from '../Picture'
import { coverFactor, fileFor, num, ratio } from './pictures'

/** The thumbnails' width: always 50px, so each one's file is known in advance (for screens of 1× and 2× density). */
const THUMB = 50

interface Props {
  pictures: Picture[]
  /** The gallery's shape (`3 / 4`) and its width beside the product's text (`50%`), the original's settings. */
  aspect: string
  width: string
}

/**
 * A product's pictures, as the original's "slideshow" gallery: on computers, the thumbnails in a column beside the
 * picture, which change at once when a thumbnail or an arrow is clicked; on phones, the picture alone, which slides
 * aside when an arrow is tapped or the picture is swiped, with "1 / 3" in its corner.
 */
export function Gallery({ pictures, aspect, width }: Props) {
  const [index, setIndex] = useState(0)
  // Which way the last change went: the phone's slide animation follows it. The original starts "going next", so
  // the first picture slides in when the page opens, as there.
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [ready, setReady] = useState(false)
  const firstImg = useRef<HTMLImageElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const count = pictures.length

  useEffect(() => {
    if (firstImg.current?.complete) setReady(true)
  }, [])

  const go = (step: 1 | -1) => {
    setDirection(step > 0 ? 'next' : 'prev')
    setIndex((i) => (i + step + count) % count)
  }

  // The width the original asks for each picture: the picture's box (on phones the screen less its margins; on
  // computers the gallery's share of the page, less the thumbnails' column), times how much the picture overflows it.
  const box = ratio(aspect, 3 / 4)
  const share = parseFloat(width) / 100 || 0.5
  const slideSizes = (p: Picture) => {
    const k = num(coverFactor(p, box))
    return `(max-width: 767px) calc(88vw * ${k}), calc(((100vw - 2 * 30px) * ${num(share)} - 60px) * ${k})`
  }

  return (
    <div className="shop-gallery" aria-label="Gallery">
      <div className="shop-gallery-scroll">
        <div className="shop-gallery-thumbs" role="group" aria-label="Gallery thumbnails">
          {pictures.map((p, i) => {
            const need = THUMB * coverFactor(p, box)
            return (
              <button
                key={p.base}
                type="button"
                className="shop-gallery-thumb"
                aria-label={`Image ${i + 1} of ${count}`}
                onClick={() => {
                  setDirection(i >= index ? 'next' : 'prev')
                  setIndex(i)
                }}
              >
                <img src={fileFor(p, need)} srcSet={`${fileFor(p, need)} 1x, ${fileFor(p, 2 * need)} 2x`} alt={p.alt} style={{ objectPosition: focal(p) }} />
              </button>
            )
          })}
        </div>
      </div>
      <div
        className={`shop-gallery-slides going-${direction}`}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }}
        onTouchEnd={(e) => {
          const start = touch.current
          touch.current = null
          if (!start || count < 2) return
          const dx = e.changedTouches[0].clientX - start.x
          const dy = e.changedTouches[0].clientY - start.y
          if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
        }}
      >
        {count > 1 && (
          <div className={`shop-gallery-controls${ready ? ' is-ready' : ''}`}>
            <button type="button" className="shop-gallery-arrow shop-gallery-prev" aria-label="Previous" onClick={() => go(-1)} />
            <button type="button" className="shop-gallery-arrow shop-gallery-next" aria-label="Next" onClick={() => go(1)} />
          </div>
        )}
        <div className="shop-gallery-indicator">{`${index + 1} / ${count}`}</div>
        {pictures.map((p, i) => {
          const state = [
            i === index && 'is-selected',
            i === (index - 1 + count) % count && 'is-prev',
            i === (index + 1) % count && 'is-next',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div key={p.base} className={`shop-gallery-slide ${state}`}>
              <img
                ref={i === 0 ? firstImg : undefined}
                src={pictureSrc(p)}
                srcSet={srcSet(p)}
                sizes={slideSizes(p)}
                alt={p.alt}
                style={{ objectPosition: focal(p) }}
                onLoad={i === 0 ? () => setReady(true) : undefined}
              />
              <span className="visually-hidden">
                Image {i + 1} of {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
