import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [reactRouter()],
  // The `~/…` imports (tsconfig.json's paths). The build finds them without this; the dev server doesn't.
  resolve: { tsconfigPaths: true },
  server: { port: 5173 },
})
