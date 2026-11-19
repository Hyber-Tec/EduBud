import { Outlet } from 'react-router'
import '~/app.css'

/**
 * The layout of the app's pages: what we add next to the copy of edubud.org (the log-in and sign-up pages for now).
 * It brings the app's CSS (app.css: Tailwind and shadcn/ui, in EduBud's fonts and colours), which React Router links
 * only on the pages inside it. The copy's header, footer and CSS aren't here (routes/site-layout.tsx).
 */
export default function AppLayout() {
  return <Outlet />
}
