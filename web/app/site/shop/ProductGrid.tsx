import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ProductCard, ProductList } from '~/content/shop/types'
import type { Picture } from '~/content/types'
import { focal, pictureSrc, srcSet } from '../Picture'
import { AddToCartButton } from './AddToCartButton'
import { coverFactor, num, ratio } from './pictures'

/**
 * The store's product grid: each product's picture (another one fades in under the pointer), its name and price, and
 * an "Add To Cart" button. Its columns, spacing and pictures' shape are the original's settings (`list.vars`).
 */
export function ProductGrid({ list, first }: { list: ProductList; first: boolean }) {
  return (
    <section
      className={`page-section shop shop-list-section${first ? ' first-section' : ''}`}
      data-theme={list.theme}
      data-section={list.id}
    >
      <div className="shop-list" style={list.vars as CSSProperties}>
        <div className="shop-list-header">
          <h2 className="shop-list-title shop-size">{list.title}</h2>
        </div>
        <div className="shop-list-grid">
          {list.items.map((item) => (
            <Card key={item.href} item={item} list={list} />
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The width the original asks for a card's picture: a column of the grid (on phones, of the screen less its margins),
 * times how much the picture overflows the card's shape.
 */
function sizes(p: Picture, list: ProductList): string {
  const v = list.vars
  const cols = Number(v['--product-list-num-columns-desktop'] ?? 2)
  const colsMobile = Number(v['--product-list-num-columns-mobile'] ?? 2)
  const gap = v['--product-list-column-spacing'] ?? '2vw'
  const k = num(coverFactor(p, ratio(v['--product-list-image-aspect-ratio'])))
  const kMobile = num(coverFactor(p, ratio(v['--product-list-image-aspect-ratio-mobile'] ?? v['--product-list-image-aspect-ratio'])))
  return `(max-width: 767px) calc((88vw - ${colsMobile - 1} * 30px) / ${colsMobile} * ${kMobile}), calc((100vw - 2 * 30px - ${cols - 1} * ${gap}) / ${cols} * ${k})`
}

function Card({ item, list }: { item: ProductCard; list: ProductList }) {
  // The card fades in once its picture has loaded, as the original's do.
  const [loaded, setLoaded] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (img.current?.complete) setLoaded(true)
  }, [])
  const hover = item.hoverPicture
  return (
    <div className={`shop-card${loaded ? ' is-loaded' : ''}`}>
      <a className="shop-card-link" href={item.href} aria-label={item.title}>
        <div className="shop-card-image">
          <div className={`shop-card-frame${hover ? ' has-hover' : ''}`}>
            <img
              ref={img}
              className="shop-card-img shop-card-cover"
              src={pictureSrc(item.picture)}
              srcSet={srcSet(item.picture)}
              sizes={sizes(item.picture, list)}
              alt={item.picture.alt}
              width={item.picture.width || undefined}
              height={item.picture.height || undefined}
              style={{ objectPosition: focal(item.picture) }}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
            />
            {hover && (
              <img
                className="shop-card-img shop-card-hover"
                src={pictureSrc(hover)}
                srcSet={srcSet(hover)}
                sizes={sizes(hover, list)}
                alt={hover.alt}
                width={hover.width || undefined}
                height={hover.height || undefined}
                style={{ objectPosition: focal(hover) }}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        </div>
        <div className="shop-card-meta">
          <div className="shop-card-title-price">
            <div className="shop-card-title shop-size">{item.title}</div>
            <div className="shop-card-price shop-size">{item.price}</div>
          </div>
          {/* Where the original shows "sold out" or "sale"; empty, but it takes part in the row's wrapping. */}
          <div className="shop-card-status shop-size" />
        </div>
      </a>
      <div className="shop-card-add">
        <AddToCartButton label={item.button} />
      </div>
    </div>
  )
}
