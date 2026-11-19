/**
 * The "film grain" effect on a picture, as the original draws it on an image block's (Our Team's "Who We Are" logo):
 * the picture, each pixel made a little lighter or darker by a noise that changes every frame, like a film's grain.
 *
 * It moves by frames, as the original's does: each frame takes one step of its clock (a ten-thousandth of the speed),
 * which starts again from 0 whenever the block changes size (the original makes its effect anew then). It's drawn at
 * the screen's full pixel ratio (the original's image blocks don't cap theirs at 1.5, as its sections do) and never
 * paused. It draws the block's own picture, the <img> next to its box (blockEffect.ts), as it covers the box.
 *
 * Settings (the original's, 0–100): intensity how strong the grain is; shadow how much of it moves from the
 * picture's dark parts to its light ones; speed how fast it changes.
 */
import { bigTriangle } from './fill'
import { createProgram, deleteProgram, draw, share, type Program, type Shape, type Shared } from './gl'
import { NOISE_BASE, SIMPLEX_NOISE } from './noise'
import { COVER_VERTEX, pictureTexture, styleFocalPoint } from './picture'
import type { CreateArt } from './types'

/** The settings a block doesn't give: the original's. */
const DEFAULTS = { intensity: 0, shadow: 0, speed: 0 }

// The arithmetic is the original's, step for step: the grain at each pixel depends on every bit of it.
const FRAGMENT = /* glsl */ `
${NOISE_BASE}
${SIMPLEX_NOISE}

uniform sampler2D uPicture;
uniform float uStrength;   // how strong the grain is, 0 to 1
uniform float uShadow;     // how much of it moves to the light parts, 0 to 1
uniform float uTime;       // the grain's clock
uniform vec2 uSize;        // the box, in CSS pixels

varying vec2 vUv;

// A number from 0 to 1 that looks random, for a point (the well-known sine hash).
float hash(vec2 p) {
  return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(uPicture, vUv);
  // The grain: simplex noise at this place in the box (in CSS pixels), at a depth the hash picks anew each frame.
  vec2 at = vUv * uSize;
  float r = hash(at + uTime);
  float grain = snoise(vec3(at, r) + r);
  // Lighter or darker by it: less in the picture's light parts, and with shadow, less in its dark ones.
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 rgb = color.rgb * (1.0 + grain * uStrength * (-1.0 + uShadow + luma * 0.75));
  // Its alpha premultiplied, as the canvas keeps colors.
  gl_FragColor = vec4(rgb * color.a, color.a);
}
`

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  // The block's picture, loaded: the effect starts once it is.
  const picture = view.node.parentElement?.querySelector('img')
  if (!picture) return null
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, 'film-grain-program', () => createProgram(gl, COVER_VERTEX, FRAGMENT), (p) => deleteProgram(gl, p))
    shape = bigTriangle(gl)
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const texture = pictureTexture(gl, picture, styleFocalPoint(picture), () => texture.fit(view.width, view.height))
  texture.fit(view.width, view.height)
  const uniforms = {
    uCover: texture.cover,
    uPicture: 0,
    uStrength: 0.01 * s.intensity,
    uShadow: 0.01 * s.shadow,
    uTime: 0,
    uSize: [view.width, view.height],
  }
  // The box's size when the clock started.
  let size = [view.width, view.height]

  return {
    pausable: false,
    resize(width, height) {
      texture.fit(width, height)
      uniforms.uSize = [width, height]
      if (width === size[0] && height === size[1]) return
      size = [width, height]
      uniforms.uTime = 0
    },
    update() {
      uniforms.uTime += 1e-4 * s.speed
      return true
    },
    render() {
      texture.bind()
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      texture.destroy()
      shared.program.release()
      shared.shape.release()
    },
  }
}
