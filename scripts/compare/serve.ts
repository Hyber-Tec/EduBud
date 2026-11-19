/** Serves the website's build as Firebase Hosting does, for looking at it or comparing it: `npx tsx scripts/compare/serve.ts [port]`. */
import { serve } from './compare'

const port = Number(process.argv[2] ?? 5179)
await serve(port)
console.log(`http://127.0.0.1:${port}`)
