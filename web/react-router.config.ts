import type { Config } from '@react-router/dev/config'
import { PRERENDER } from './app/content/paths'

// Every page is written to its own HTML file at build time; the site needs no server.
export default {
  ssr: false,
  prerender: PRERENDER,
} satisfies Config
