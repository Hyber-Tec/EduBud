/** The shop's product page, drawn like the original's; buying does nothing yet (docs/DECISIONS.md §3). */
export function meta() {
  return [{ title: 'EduBud International' }, { name: 'robots', content: 'noindex, nofollow' }]
}

export default function ShopProduct() {
  return <section className="page-section shop-product" data-theme="white" />
}
