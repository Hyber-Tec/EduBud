import type { CartPage } from '~/content/shop/types'

/**
 * The cart, as the original shows it with nothing in it. Nothing can be added yet (docs/DECISIONS.md §3), so this is
 * the only state it has.
 */
export function CartEmpty({ cart }: { cart: CartPage }) {
  return (
    <section className="page-section first-section shop shop-cart-section" data-theme={cart.theme}>
      <div className="shop-cart">
        <div className="shop-cart-body">
          <div className="shop-cart-header">
            <h2 className="shop-cart-title">{cart.title}</h2>
          </div>
          <div className="shop-cart-empty">
            <p className="shop-cart-message">{cart.emptyMessage}</p>
          </div>
          <a className="shop-cart-button" href={cart.button.href}>
            {cart.button.label}
          </a>
        </div>
      </div>
    </section>
  )
}
