import { data } from 'react-router'
import { loadPage } from '~/content/load'
import { PAGES } from '~/content/paths'
import { Section } from '~/site/Section'
import type { Route } from './+types/page'

export async function loader({ params, request }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/'
  const slug = path === '/home' ? 'home' : PAGES[path] ?? params.slug
  const page = slug ? await loadPage(slug) : null
  if (!page) throw data(null, { status: 404 })
  return { page }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const m = loaderData?.page.meta
  if (!m) return [{ title: 'EduBud International' }]
  return [
    { title: m.title },
    { name: 'description', content: m.description },
    { property: 'og:title', content: m.title },
    { property: 'og:description', content: m.description },
    { name: 'robots', content: 'noindex, nofollow' },
  ]
}

export default function ContentPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {loaderData.page.sections.map((s, i) => (
        <Section key={s.id} section={s} index={i} />
      ))}
    </>
  )
}
