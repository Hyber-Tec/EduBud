import { isRouteErrorResponse, Links, Meta, Outlet, Scripts } from 'react-router'
import type { Route } from './+types/root'
import './site/styles/fonts.css'

// The document every page shares: its head, EduBud's fonts and the scripts. How a page looks comes from its layout,
// which imports its own CSS: routes/site-layout.tsx for the copy of edubud.org, routes/app-layout.tsx for the app.
// React Router links a layout's CSS only on the pages inside it, so one layout's styles never reach another's pages.

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
        {children}
        {/* No <ScrollRestoration>: every page is a full page load, as on the original, so the browser scrolls as it
            does there (a new page at its top, Back to where you were). React Router's would put a page that links to
            itself (the logo, on the home page) back where it was scrolled. */}
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

/**
 * The last resort, for an error no layout catches (the copy's draws its own "page not found" page). No layout's CSS
 * is linked here, so this page carries its few styles itself.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <main style={{ maxWidth: '36rem', margin: '0 auto', padding: '4rem 1.5rem', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, color: 'hsl(63 61% 7%)' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p>
        {notFound ? "We couldn't find the page you were looking for." : "This page couldn't be shown. Please try again in a moment."}{' '}
        <a href="/" style={{ color: 'inherit' }}>
          Go to the homepage
        </a>
        .
      </p>
    </main>
  )
}
