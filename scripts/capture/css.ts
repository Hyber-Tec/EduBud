// A small CSS reader for the capture: enough to walk the rules Squarespace writes into each page (a section's grid,
// a block's settings), with their @media blocks, nested or not. Not a general CSS parser.

export interface Rule {
  /** The selector, or the at-rule's prelude (`@media (min-width: 768px)`). */
  prelude: string
  /** Declarations, for a style rule. */
  decls: [string, string][]
  /** Nested rules, for an at-rule (or a rule with nested at-rules). */
  children: Rule[]
}

/** Parses CSS text into rules, keeping nesting. Comments are dropped. */
export function parseCss(text: string): Rule[] {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  function parseBlock(): Rule[] {
    const rules: Rule[] = []
    let buf = ''
    let current: Rule | null = null
    while (i < src.length) {
      const ch = src[i]
      if (ch === '{') {
        i++
        const prelude = buf.trim()
        buf = ''
        const inner = parseBody()
        rules.push({ prelude, decls: inner.decls, children: inner.children })
      } else if (ch === '}') {
        i++
        break
      } else {
        buf += ch
        i++
      }
    }
    void current
    return rules
  }
  // A body holds declarations and nested blocks; it ends at its closing brace.
  function parseBody(): { decls: [string, string][]; children: Rule[] } {
    const decls: [string, string][] = []
    const children: Rule[] = []
    let buf = ''
    while (i < src.length) {
      const ch = src[i]
      if (ch === '{') {
        i++
        const prelude = buf.trim()
        buf = ''
        const inner = parseBody()
        children.push({ prelude, decls: inner.decls, children: inner.children })
      } else if (ch === '}') {
        i++
        pushDecl(buf, decls)
        return { decls, children }
      } else if (ch === ';') {
        i++
        pushDecl(buf, decls)
        buf = ''
      } else {
        buf += ch
        i++
      }
    }
    pushDecl(buf, decls)
    return { decls, children }
  }
  return parseBlock()
}

function pushDecl(raw: string, decls: [string, string][]) {
  const s = raw.trim()
  if (!s) return
  const colon = s.indexOf(':')
  if (colon <= 0) return
  const prop = s.slice(0, colon).trim()
  const value = s.slice(colon + 1).trim()
  if (prop && value) decls.push([prop, value])
}

export const isDesktopMedia = (prelude: string) => /min-width:\s*768px/.test(prelude)
export const isMobileMedia = (prelude: string) => /max-width:\s*767px/.test(prelude)

/**
 * Visits every style rule with the breakpoint it applies to: `all`, `desktop` (inside min-width 768px) or `mobile`
 * (inside max-width 767px). Nested at-rules inside a style rule count too.
 */
export function walkRules(rules: Rule[], visit: (selector: string, decls: [string, string][], bp: 'all' | 'desktop' | 'mobile') => void, bp: 'all' | 'desktop' | 'mobile' = 'all') {
  for (const r of rules) {
    if (r.prelude.startsWith('@media')) {
      const inner = isDesktopMedia(r.prelude) ? 'desktop' : isMobileMedia(r.prelude) ? 'mobile' : bp
      walkRules(r.children, visit, inner)
    } else if (r.prelude.startsWith('@')) {
      continue
    } else {
      if (r.decls.length) visit(r.prelude, r.decls, bp)
      for (const c of r.children) {
        if (c.prelude.startsWith('@media')) {
          const inner = isDesktopMedia(c.prelude) ? 'desktop' : isMobileMedia(c.prelude) ? 'mobile' : bp
          if (c.decls.length) visit(r.prelude, c.decls, inner)
          walkRules(c.children.map((x) => ({ ...x, prelude: x.prelude || r.prelude })), visit, inner)
        }
      }
    }
  }
}
