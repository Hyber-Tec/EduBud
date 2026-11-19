/** Crops a region out of a screenshot: npx tsx scripts/compare/crop.ts in.png out.png x y w h [scale] */
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
const [inp, out, x, y, w, h] = process.argv.slice(2)
const src = PNG.sync.read(readFileSync(inp))
const W = Math.min(Number(w), src.width - Number(x))
const H = Math.min(Number(h), src.height - Number(y))
const dst = new PNG({ width: W, height: H })
PNG.bitblt(src, dst, Number(x), Number(y), W, H, 0, 0)
writeFileSync(out, PNG.sync.write(dst))
console.log(`${out}: ${W}x${H}`)
