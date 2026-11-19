/**
 * The "parallax" effect on a section's background picture, as the original's: the picture, zoomed in a little,
 * slides across the section as the page scrolls past it. It doesn't move by itself; it follows how far the page has
 * scrolled past the section (scroll.ts): scrolling down, it eases a tenth of the rest of the way there each frame;
 * scrolling up, or when the section comes on screen or changes size, it's there at once.
 *
 * It draws the section's own picture, the <img> next to its box (ArtBackground.tsx), which is hidden while the effect
 * shows it: covering the section as CSS's `object-fit: cover` would, around its focal point.
 *
 * Settings (the original's): intensity (0–100) how far it slides, and how much it's zoomed in to have room to;
 * rotation (degrees) which way; zoomStart and zoomEnd (0–100) more zoom with the page at the start of its scroll past
 * the section, and at the end.
 */
import { bigTriangle } from './fill'
import { createProgram, deleteProgram, draw, share, type Program, type Shape, type Shared } from './gl'
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
  const texture = gl.createTexture()

  // The focal point, 0 to 1 across the picture from its top left, as the page gives it; the middle if it gives none.
  const [x, y] = picture.dataset.imageFocalPoint?.split(',') ?? []
  const focal = x && y ? [+x, +y] : [0.5, 0.5]
  const cover = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const uniforms = {
    uCover: cover,
    uFocal: [focal[0], 1 - focal[1]],
    uAmount: 0.01 * s.intensity * 0.5,
    uDirection: [Math.cos((s.rotation * Math.PI) / 180), Math.sin((s.rotation * Math.PI) / 180)],
    uZoom: [0.01 * s.zoomStart, 0.01 * s.zoomEnd],
    uProgress: 0,
    uPicture: 0,
  }

  /**
   * The picture over a section of this size, as `object-fit: cover` puts it, cut evenly around its focal point. Its
   * shape is its size on the page: its file's, divided by the density the browser picked it for, rounded down.
   */
  const fit = (width: number, height: number) => {
    const w = picture.naturalWidth
    const h = picture.naturalHeight
    let sx = 1
    let sy = 1
    if (w / h > width / height) sx = (width * h) / (height * w)
    else sy = (height * w) / (width * h)
    const ox = ((sx - 1) / 2) * -1
    const oy = ((sy - 1) / 2) * -1
    cover[0] = sx
    cover[4] = sy
    cover[6] = ox + (focal[0] - 0.5) * ox * 2
    cover[7] = oy + (0.5 - focal[1]) * oy * 2
  }
  fit(view.width, view.height)

  // Where the scroll is heading (uProgress is where the drawing is), whether the next progress is taken at once, and
  // whether the drawing changed since it was last drawn.
  let target = 0
  let immediate = true
  let changed = false
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

  // The picture goes into the texture before the next drawing: at the first, and each time the browser loads another
  // of its files (a wider one, after the window grows), which is fitted again.
  let upload = true
  const reload = () => {
    upload = true
    fit(view.width, view.height)
    immediate = true
    changed = true
  }
  picture.addEventListener('load', reload)

  return {
    moves: false,
    pausable: false,
    resize(width, height) {
      fit(width, height)
      immediate = true
    },
    update() {
      const from = uniforms.uProgress
      if (from !== target) {
        // A tenth of the rest of the way each frame; all of it once that's under a hundredth, or backwards.
        const rest = target - from
        uniforms.uProgress = rest < 0.01 ? target : from + 0.1 * rest
        changed = true
      }
      const drawAgain = changed
      changed = false
      return drawAgain
    },
    render() {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      if (upload) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, picture)
        upload = false
      }
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      scroll.stop()
      picture.removeEventListener('load', reload)
      gl.deleteTexture(texture)
      shared.program.release()
      shared.shape.release()
    },
  }
}
