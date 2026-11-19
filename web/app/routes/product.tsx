import { data } from 'react-router'
import { loadProduct } from '~/content/shop/load'
import { shopMeta } from '~/site/shop/meta'
import { ProductDetail } from '~/site/shop/ProductDetail'
import type { Route } from './+types/product'

/** A product page of the shop, drawn like the original's; buying does nothing yet (docs/DECISIONS.md §3). */
export async function loader({ params }: Route.LoaderArgs) {
  const product = await loadProduct(params.product)
  if (!product) throw data(null, { status: 404 })
  return { product }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return shopMeta(loaderData?.product.meta)
}

export default function ShopProduct({ loaderData }: Route.ComponentProps) {
  return <ProductDetail product={loaderData.product} />
}
