import { loadStore } from '~/content/shop/load'
import { Section } from '~/site/Section'
import { shopMeta } from '~/site/shop/meta'
import { ProductGrid } from '~/site/shop/ProductGrid'
import type { Route } from './+types/store'

/** The shop's store page: its Fluid Engine sections and the product grid, drawn like the original's. */
export async function loader() {
  return { store: await loadStore() }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return shopMeta(loaderData?.store.meta)
}

export default function ShopStore({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {loaderData.store.sections.map((s, i) =>
        s.kind === 'products' ? <ProductGrid key={s.list.id} list={s.list} first={i === 0} /> : <Section key={s.section.id} section={s.section} index={i} />,
      )}
      {/* The cards fade in from their scripts; without scripts they show at once. */}
      <noscript>
        <style>{'.shop-card { opacity: 1 !important; transform: none !important; }'}</style>
      </noscript>
    </>
  )
}
