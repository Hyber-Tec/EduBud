import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/page.tsx', { id: 'home' }),
  route('home', 'routes/page.tsx', { id: 'home-alias' }),
  route('products-store', 'routes/store.tsx'),
  route('products-store/p/:product', 'routes/product.tsx'),
  route('cart', 'routes/cart.tsx'),
  route('404', 'routes/not-found.tsx', { id: 'not-found' }),
  route(':slug', 'routes/page.tsx', { id: 'page' }),
] satisfies RouteConfig
