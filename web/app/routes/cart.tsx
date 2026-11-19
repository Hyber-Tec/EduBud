import { loadCart } from '~/content/shop/load'
import { CartEmpty } from '~/site/shop/CartEmpty'
import { shopMeta } from '~/site/shop/meta'
import type { Route } from './+types/cart'

/** The shop's cart page, drawn like the original's when empty; buying does nothing yet (docs/DECISIONS.md §3). */
export async function loader() {
  return { cart: await loadCart() }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return shopMeta(loaderData?.cart.meta)
}

export default function ShopCart({ loaderData }: Route.ComponentProps) {
  return <CartEmpty cart={loaderData.cart} />
}
