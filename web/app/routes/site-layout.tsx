import { useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { fitText } from '~/site/fitText'
import { fitWords } from '~/site/fitWords'
import { Footer } from '~/site/Footer'
import { Header } from '~/site/Header'
// The copy's CSS, in this order. It's imported here rather than in root.tsx so that it's only linked on the copy's
// pages: React Router links a layout's CSS on the pages inside it, and nowhere else.
import '~/site/styles/themes.css'
import '~/site/styles/base.css'
import '~/site/styles/sections.css'
import '~/site/styles/blocks.css'
import '~/site/styles/header.css'
import '~/site/styles/shop.css'
import '~/site/styles/widgets.css'
import '~/site/styles/galleries.css'
import '~/site/styles/motion.css'
// Phones' own rules (below 768px) come last, so they win over the rules above.
import '~/site/styles/phone.css'
import NotFound from './not-found'

/**
 * Around each page of the copy: the header and the footer. Once it's drawn, fitText sizes the scaled text, and on
 * phones fitWords keeps headings from breaking a word.
 */
function SitePage({ children }: { children: ReactNode }) {
  useEffect(() => fitText(), [])
  useEffect(() => fitWords(), [])
  return (
    <>
      <Header />
      <main id="page">{children}</main>
      <Footer />
    </>
  )
}

/** The layout of the copy of edubud.org: every page of the site, the shop and its "page not found" page. */
export default function SiteLayout() {
  return (
    <SitePage>
      <Outlet />
    </SitePage>
  )
}

/** An address the copy doesn't have, or an error on one of its pages: the "page not found" page, as the original's. */
export function ErrorBoundary() {
  return (
    <SitePage>
      <NotFound />
    </SitePage>
  )
}
