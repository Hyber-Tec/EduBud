// The site's design settings, read from the original's stylesheet: its palette, each section theme's colors, and its
// type and button sizes. Written under our own names to web/app/site/styles/themes.css; our CSS uses only those.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Our name ← the original's setting. */
const THEME_VARS: Record<string, string> = {
  '--bg': '--siteBackgroundColor',
  '--h1': '--headingExtraLargeColor',
  '--h2': '--headingLargeColor',
  '--h3': '--headingMediumColor',
  '--h4': '--headingSmallColor',
  '--p1': '--paragraphLargeColor',
  '--p2': '--paragraphMediumColor',
  '--p3': '--paragraphSmallColor',
  '--link': '--paragraphLinkColor',
  '--heading-link': '--headingLinkColor',
  '--btn1-bg': '--primaryButtonBackgroundColor',
  '--btn1-fg': '--primaryButtonTextColor',
  '--btn2-bg': '--secondaryButtonBackgroundColor',
  '--btn2-fg': '--secondaryButtonTextColor',
  '--btn3-bg': '--tertiaryButtonBackgroundColor',
  '--btn3-fg': '--tertiaryButtonTextColor',
  '--nav': '--navigationLinkColor',
  '--site-title': '--siteTitleColor',
  '--menu-bg': '--menuOverlayBackgroundColor',
  '--menu-link': '--menuOverlayNavigationLinkColor',
  '--menu-btn-bg': '--menuOverlayButtonBackgroundColor',
  '--menu-btn-fg': '--menuOverlayButtonTextColor',
  '--acc-icon': '--tweak-accordion-block-icon-color',
  '--acc-divider': '--tweak-accordion-block-divider-color',
  '--acc-bg': '--tweak-accordion-block-background-color',
  '--text-block-bg': '--tweak-text-block-background-color',
  '--shape-bg': '--shape-block-background-color',
  '--shape-stroke': '--shape-block-stroke-color',
  '--line': '--tweak-line-block-line-color',
  '--marquee-h': '--tweak-marquee-block-heading-color',
  '--marquee-p': '--tweak-marquee-block-paragraph-color',
  '--marquee-bg': '--tweak-marquee-block-background-color',
  '--image-overlay': '--image-block-overlay-color',
  '--form-bg': '--tweak-form-block-background-color',
  '--form-title': '--tweak-form-block-title-color',
  '--form-desc': '--tweak-form-block-description-color',
  '--form-caption': '--tweak-form-block-caption-color',
  '--form-input': '--tweak-form-block-field-input-color',
  '--form-fill': '--tweak-form-block-field-fill-color',
  '--form-border': '--tweak-form-block-field-border-color',
  '--form-accent': '--tweak-form-block-field-accent-color',
  '--form-accessory': '--tweak-form-block-field-accessory-color',
  '--form-option': '--tweak-form-block-option-color',
  '--form-btn-bg': '--tweak-form-block-button-background-color',
  '--form-btn-fg': '--tweak-form-block-button-text-color',
  '--donation-bg': '--donation-block-background-color',
  '--donation-stroke': '--donation-block-stroke-color',
  '--divider-stroke': '--section-divider-stroke-color',
  '--video-bg': '--tweak-video-block-background-color',
  '--product-title': '--tweak-product-grid-text-below-list-title-color',
  '--product-price': '--tweak-product-grid-text-below-list-price-color',
  '--product-nav': '--tweak-product-grid-text-below-list-category-nav-color',
  '--product-item-title': '--tweak-product-basic-item-title-color',
  '--product-item-price': '--tweak-product-basic-item-price-color',
  '--product-item-desc': '--tweak-product-basic-item-description-color',
  '--product-item-nav': '--tweak-product-basic-item-breadcumb-nav-color',
  '--product-item-variant': '--tweak-product-basic-item-variant-fields-color',
  '--product-item-gallery': '--tweak-product-basic-item-gallery-controls-color',
  '--product-item-scarcity': '--tweak-product-basic-item-scarcity-color',
}

/** Root settings: the palette and the type and button scales. */
const ROOT_VARS = [
  '--white-hsl',
  '--black-hsl',
  '--accent-hsl',
  '--lightAccent-hsl',
  '--darkAccent-hsl',
  '--safeLightAccent-hsl',
  '--safeDarkAccent-hsl',
  '--safeInverseAccent-hsl',
  '--safeInverseLightAccent-hsl',
  '--safeInverseDarkAccent-hsl',
  '--heading-1-size-value',
  '--heading-2-size-value',
  '--heading-3-size-value',
  '--heading-4-size-value',
  '--large-text-size-value',
  '--normal-text-size-value',
  '--small-text-size-value',
]

const THEMES = ['white', 'white-bold', 'light', 'light-bold', 'dark', 'dark-bold', 'black', 'black-bold', 'bright', 'bright-inverse']

function block(css: string, selector: string): Record<string, string> {
  // The rule whose selector list contains this selector and that defines the theme's background.
  let from = 0
  while (true) {
    const i = css.indexOf(selector, from)
    if (i < 0) return {}
    const br = css.indexOf('{', i)
    const en = css.indexOf('}', br)
    const body = css.slice(br + 1, en)
    if (body.includes('--siteBackgroundColor')) {
      return Object.fromEntries([...body.matchAll(/(--[\w-]+):([^;]+)/g)].map((m) => [m[1], m[2].trim()]))
    }
    from = en
  }
}

export async function captureTheme(siteCssUrl: string, outDir: string) {
  const css = await (await fetch(siteCssUrl)).text()
  const lines: string[] = ['/* The original\'s palette, type scale and section themes, captured by scripts/capture. Don\'t edit by hand. */', '']

  const root: string[] = []
  for (const name of ROOT_VARS) {
    const v = css.match(new RegExp(`${name.replace(/[-]/g, '\\-')}:([^;}]+)`))?.[1]
    if (v) root.push(`  ${name.replace(/-hsl$/, '-hsl')}: ${v.trim()};`)
  }
  // The default theme (sections without one) is the root rule's.
  const rootTheme = block(css, ':root{')
  lines.push(":root, [data-theme=\"white\"], [data-theme=\"\"] {", ...root, ...themeLines(rootTheme), "}", "")
  for (const t of THEMES) {
    const vars = block(css, `[data-section-theme="${t}"]`)
    if (!Object.keys(vars).length) continue
    lines.push(`[data-theme="${t}"] {`, ...themeLines(vars), '}', '')
  }
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'themes.css'), lines.join('\n'))
  console.log(`themes: ${THEMES.length} themes, ${Object.keys(THEME_VARS).length} colors each`)
}

function themeLines(vars: Record<string, string>): string[] {
  return Object.entries(THEME_VARS)
    .filter(([, theirs]) => vars[theirs])
    .map(([ours, theirs]) => `  ${ours}: ${vars[theirs]};`)
}
