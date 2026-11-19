import type { GenerativeSettings } from '~/content/types'
import type { ArtSettings } from './types'

/** The settings the original reads as colors. */
const COLOR_KEYS = ['startColor', 'endColor', 'baseColor', 'backgroundColor', 'imageTint', 'patternColor', 'color1', 'color2', 'color3', 'color4']

type StoredColor = {
  type?: string
  sitePaletteColor?: { id?: string; colorName?: string; alpha?: number; alphaModifier?: number }
  customColor?: string | { hslaValue?: { hue: number; saturation: number; lightness: number; alpha?: number } }
}

/**
 * A color as the original stores it, as a CSS color: one of the site's palette colors (our theme defines the same
 * `--<name>-hsl` variables), or a custom one. Null for anything else, which the kinds then draw black, as the
 * original's do.
 */
export function cssColor(color: unknown, theme: CSSStyleDeclaration): string | null {
  const c = color as StoredColor | null
  if (!c || typeof c !== 'object') return null
  if (c.type === 'SITE_PALETTE_COLOR' && c.sitePaletteColor) {
    const { id, colorName, alpha, alphaModifier } = c.sitePaletteColor
    return `hsla(${theme.getPropertyValue(`--${id ?? colorName}-hsl`)},${alpha ?? alphaModifier ?? 1})`
  }
  if (c.type === 'CUSTOM_COLOR') {
    const custom = c.customColor
    if (typeof custom === 'string') return custom
    // Not used on the site so far; the original formats these in the editor's own way.
    const v = custom?.hslaValue
    if (v) return `hsla(${v.hue},${v.saturation * 100}%,${v.lightness * 100}%,${v.alpha ?? 1})`
  }
  return null
}

/** The settings a kind is started with, as the original's: its pixel ratio, then the settings with their colors resolved. */
export function resolveSettings(settings: GenerativeSettings, pixelRatio: number): ArtSettings {
  const theme = getComputedStyle(document.documentElement)
  const colors = Object.fromEntries(Object.entries(settings).filter(([k]) => COLOR_KEYS.includes(k)).map(([k, v]) => [k, cssColor(v, theme)]))
  return { pixelRatio, ...settings, ...colors }
}

/** One part of a color from its place on the hue circle (the usual HSL formula, in the original's order of operations). */
function hue(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  return t < 1 / 6 ? p + 6 * (q - p) * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
}

const NUMBER = String.raw`\s*(\d*\.?\d+)`
const RGB = new RegExp(`^${NUMBER}\\s*,${NUMBER}\\s*,${NUMBER}\\s*(?:,${NUMBER}\\s*)?$`)
const RGB_PERCENT = new RegExp(`^${NUMBER}\\%\\s*,${NUMBER}\\%\\s*,${NUMBER}\\%\\s*(?:,${NUMBER}\\s*)?$`)
const HSL = new RegExp(`^${NUMBER}\\s*,${NUMBER}\\%\\s*,${NUMBER}\\%\\s*(?:,${NUMBER}\\s*)?$`)

/**
 * A CSS color as [red, green, blue, alpha] from 0 to 1, read as the original's kinds read theirs: rgb(a) and hsl(a)
 * with commas, or #rgb, #rgba, #rrggbb. Anything else is black.
 */
export function parseColor(css: string | null | undefined): [number, number, number, number] {
  const text = String(css)
  const fn = /^((?:rgb|hsl)a?)\(([^)]*)\)/.exec(text)
  if (fn) {
    const [, name, args] = fn
    if (name === 'rgb' || name === 'rgba') {
      let m = RGB.exec(args)
      if (m) return [Math.min(255, parseFloat(m[1])) / 255, Math.min(255, parseFloat(m[2])) / 255, Math.min(255, parseFloat(m[3])) / 255, m[4] ? parseFloat(m[4]) : 1]
      m = RGB_PERCENT.exec(args)
      if (m) return [Math.min(100, parseFloat(m[1])) / 100, Math.min(100, parseFloat(m[2])) / 100, Math.min(100, parseFloat(m[3])) / 100, m[4] ? parseFloat(m[4]) : 1]
    } else {
      const m = HSL.exec(args)
      if (m) {
        const h = parseFloat(m[1]) / 360
        const s = parseFloat(m[2]) / 100
        const l = parseFloat(m[3]) / 100
        const a = m[4] ? parseFloat(m[4]) : 1
        if (s === 0) return [l, l, l, a]
        const q = l <= 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3), a]
      }
    }
    return [0, 0, 0, 1]
  }
  const hex = /^#([A-Fa-f\d]+)$/.exec(text)?.[1]
  if (hex && (hex.length === 3 || hex.length === 4)) {
    const at = (i: number) => parseInt(hex[i] + hex[i], 16) / 255
    return [at(0), at(1), at(2), hex[3] ? at(3) : 1]
  }
  // (#rrggbbaa is black too: the original reads only six digits.)
  if (hex && hex.length === 6) {
    const at = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255
    return [at(0), at(2), at(4), 1]
  }
  return [0, 0, 0, 1]
}

/** A color setting as the three numbers a shader's vec3 takes. */
export function rgb(css: unknown): [number, number, number] {
  const [r, g, b] = parseColor(css as string | null)
  return [r, g, b]
}
