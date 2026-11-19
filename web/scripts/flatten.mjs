// After the build: each prerendered page `a/b/index.html` is also written as `a/b.html`, which Firebase Hosting serves
// for `/a/b` (cleanUrls), and `404/index.html` becomes `404.html`, its "page not found" page.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../build/client')
let count = 0
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (!statSync(full).isDirectory() || ['assets', 'media', 'fonts'].includes(name)) continue
    const index = path.join(full, 'index.html')
    if (existsSync(index)) {
      copyFileSync(index, `${full}.html`)
      count++
    }
    walk(full)
  }
}
walk(root)
console.log(`flatten: ${count} pages written as <page>.html`)
