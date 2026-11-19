import { Fragment, type CSSProperties } from 'react'
import type { Product } from '~/content/shop/types'
import { AddToCartButton } from './AddToCartButton'
import { Gallery } from './Gallery'
import { Quantity } from './Quantity'

/**
 * A product page: the way back to the shop, the gallery, and beside it (below it on phones) the name, price,
 * description, quantity and "Add To Cart". On phones the description moves below the button, as on the original.
 */
export function ProductDetail({ product }: { product: Product }) {
  const description = { __html: product.description }
  return (
    <section className="page-section first-section shop shop-product-section" data-theme={product.theme}>
      <div className="shop-product" style={product.vars as CSSProperties}>
        <nav className="shop-product-nav" aria-label="Breadcrumb">
          {product.breadcrumb.map((crumb, i) => (
            <Fragment key={crumb.href}>
              {i > 0 && <span>›</span>}
              <a href={crumb.href}>{crumb.title}</a>
            </Fragment>
          ))}
        </nav>
        <div className="shop-product-content">
          <Gallery
            pictures={product.pictures}
            aspect={product.vars['--product-gallery-aspect-ratio'] ?? '3 / 4'}
            width={product.vars['--product-gallery-width'] ?? '50%'}
          />
          <div className="shop-product-meta">
            <h1 className="shop-product-title shop-size">{product.title}</h1>
            {/* Where the original puts a product's badge; empty, but it adds the column's gap below the title. */}
            <div className="shop-product-badge" />
            <div className="shop-product-price shop-size">{product.price}</div>
            <div className="shop-product-description shop-product-description--side shop-size" dangerouslySetInnerHTML={description} />
            <div className="shop-product-add">
              <div className="shop-product-controls">
                <div className="shop-product-quantity">
                  <Quantity />
                </div>
                <div className="shop-product-button">
                  <AddToCartButton label={product.button} />
                </div>
              </div>
            </div>
            <div className="shop-product-description shop-product-description--below shop-size" dangerouslySetInnerHTML={description} />
          </div>
        </div>
      </div>
    </section>
  )
}
