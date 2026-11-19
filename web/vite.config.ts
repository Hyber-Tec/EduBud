import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // Tailwind builds the app's CSS (app/app.css). It leaves CSS that doesn't use it, the copy's, exactly as it is.
  plugins: [tailwindcss(), reactRouter()],
  // The `~/…` imports (tsconfig.json's paths). The build finds them without this; the dev server doesn't.
  resolve: { tsconfigPaths: true },
  server: { port: 5173 },
})
