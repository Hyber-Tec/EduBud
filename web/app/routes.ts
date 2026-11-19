import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  // The copy of edubud.org. Its pages share the header, the footer and the copy's CSS (routes/site-layout.tsx).
  layout('routes/site-layout.tsx', [
    index('routes/page.tsx', { id: 'home' }),
    route('home', 'routes/page.tsx', { id: 'home-alias' }),
    route('products-store', 'routes/store.tsx'),
    route('products-store/p/:product', 'routes/product.tsx'),
    route('cart', 'routes/cart.tsx'),
    route('404', 'routes/not-found.tsx', { id: 'not-found' }),
    route(':slug', 'routes/page.tsx', { id: 'page' }),
    // Any other address (`/a/b`): Firebase Hosting serves 404.html there, and this keeps it the copy's "page not
    // found" page once the page's scripts run, inside this layout and with its CSS.
    route('*', 'routes/not-found.tsx', { id: 'not-found-other' }),
  ]),
  // What we add next to the copy: the app's pages, with the app's CSS (routes/app-layout.tsx) and none of the copy's.
  layout('routes/app-layout.tsx', [route('login', 'routes/login.tsx'), route('signup', 'routes/signup.tsx')]),
] satisfies RouteConfig
