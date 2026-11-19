import { useEffect } from 'react'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { Route } from './+types/root'
import { fitText } from './site/fitText'
import { Footer } from './site/Footer'
import { Header } from './site/Header'
import './site/styles/fonts.css'
import './site/styles/themes.css'
import './site/styles/base.css'
import './site/styles/sections.css'
import './site/styles/blocks.css'
import './site/styles/header.css'
import './site/styles/shop.css'
import './site/styles/widgets.css'
import './site/styles/galleries.css'
import './site/styles/motion.css'
import NotFound from './routes/not-found'

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.ico' },
  { rel: 'preload', href: '/fonts/dm-sans-300-normal-latin.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'preload', href: '/fonts/bricolage-grotesque-700-normal-latin.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Header />
        <main id="page">{children}</main>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  useEffect(() => fitText(), [])
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />
  return <NotFound />
}
