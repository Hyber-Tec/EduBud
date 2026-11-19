/**
 * The "parallax" effect on a section's background picture, as the original's: the picture, zoomed in a little,
 * slides across the section as the page scrolls past it. It doesn't move by itself; it follows how far the page has
 * scrolled past the section (scroll.ts), easing a tenth of the rest of the way there each frame, whichever way the
 * page scrolls (the original jumps when it scrolls up: see update()); when the section comes on screen or changes
 * size, it's there at once.
 *
 * It draws the section's own picture, the <img> next to its box (ArtBackground.tsx), which is hidden while the effect
 * shows it: covering the section as CSS's `object-fit: cover` would, around its focal point (picture.ts).
 *
 * Settings (the original's): intensity (0–100) how far it slides, and how much it's zoomed in to have room to;
 * rotation (degrees) which way; zoomStart and zoomEnd (0–100) more zoom with the page at the start of its scroll past
 * the section, and at the end.
 */
import { bigTriangle } from './fill'
import { createProgram, deleteProgram, draw, share, type Program, type Shape, type Shared } from './gl'
import { dataFocalPoint, pictureTexture } from './picture'
import { watchScroll } from './scroll'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = { intensity: 0, rotation: 0, zoomStart: 0, zoomEnd: 0 }

// Each corner of the triangle gets its place in the picture; the pixels between get theirs from the corners'. The
// arithmetic is the original's, step for step, so that every pixel samples the picture where the original's does.
const VERTEX = /* glsl */ `
attribute vec2 aPosition;

uniform mat3 uCover;       // the picture covering the section around its focal point
uniform vec2 uFocal;       // the focal point, 0 to 1 across the picture from its bottom left
uniform float uAmount;     // how far it slides, as a share of the picture
uniform vec2 uDirection;   // which way (the rotation's cosine and sine)
uniform vec2 uZoom;        // the extra zoom at the start of the scroll, and at its end
uniform float uProgress;   // how far the page has scrolled past the section, 0 to 1

varying vec2 vUv;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  // This corner's place in the picture, as it covers the section...
  vUv = (uCover * vec3(aPosition * 0.5 + 0.5, 1.0)).xy;
  // ...zoomed in around the focal point, which leaves room on each side to slide...
  vUv -= uFocal;
  vUv *= 1.0 - uAmount - mix(uZoom.x, uZoom.y, uProgress);
  // ...and slid across that room, from one side to the other, as the page scrolls.
  vUv -= uDirection * mix((vec2(1.0) - uFocal) * -uAmount, uFocal * uAmount, uProgress);
  vUv += uFocal;
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D uPicture;

varying vec2 vUv;

void main() {
  vec4 color = texture2D(uPicture, vUv);
  // Its alpha premultiplied, as the canvas keeps colors (a photo is opaque: no change).
  gl_FragColor = vec4(color.rgb * color.a, color.a);
}
`

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  // The section's picture, loaded: the effect starts once it is.
  const picture = view.node.parentElement?.querySelector('img')
  if (!picture) return null
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, 'parallax-program', () => createProgram(gl, VERTEX, FRAGMENT), (p) => deleteProgram(gl, p))
    shape = bigTriangle(gl)
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  // Where the scroll is heading (uProgress is where the drawing is), whether the next progress is taken at once, and
  // whether the drawing changed since it was last drawn.
  let target = 0
  let immediate = true
  let changed = false

  // The picture, fitted again when the browser loads another of its files (a wider one, after the window grows).
  const focal = dataFocalPoint(picture)
  const texture = pictureTexture(gl, picture, focal, () => {
    texture.fit(view.width, view.height)
    immediate = true
    changed = true
  })
  texture.fit(view.width, view.height)
  const uniforms = {
    uCover: texture.cover,
    uFocal: [focal[0], 1 - focal[1]],
    uAmount: 0.01 * s.intensity * 0.5,
    uDirection: [Math.cos((s.rotation * Math.PI) / 180), Math.sin((s.rotation * Math.PI) / 180)],
    uZoom: [0.01 * s.zoomStart, 0.01 * s.zoomEnd],
    uProgress: 0,
    uPicture: 0,
  }

  const scroll = watchScroll(view.node, {
    visible(visible) {
      if (visible) immediate = true
    },
    progress(progress) {
      if (immediate) {
        uniforms.uProgress = progress
        changed = true
        immediate = false
      }
      target = progress
    },
  })

  return {
    moves: false,
    pausable: false,
    resize(width, height) {
      texture.fit(width, height)
      immediate = true
    },
    update() {
      const from = uniforms.uProgress
      if (from !== target) {
        // A tenth of the rest of the way each frame, all of it once that's under a hundredth: down the page or up it.
        // (The original's test leaves out the absolute value, so every step back up counts as close enough, and the
        // picture jumps there in one frame. That's a fault, not copied: docs/DECISIONS.md §5, Q7.)
        const rest = target - from
        uniforms.uProgress = Math.abs(rest) < 0.01 ? target : from + 0.1 * rest
        changed = true
      }
      const drawAgain = changed
      changed = false
      return drawAgain
    },
    render() {
      texture.bind()
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      scroll.stop()
      texture.destroy()
      shared.program.release()
      shared.shape.release()
    },
  }
}
