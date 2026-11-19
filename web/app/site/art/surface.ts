/**
 * The "surface" art: a sheet seen from above at a slant, its height a mix of a ridged pattern and slowly moving
 * noise, coloured along a four-colour gradient that a second noise warps, with a fine grain over it. The sheet is
 * 2 × 2 units, 400 × 50 squares, drawn from its far edge to its near one so that nearer folds cover farther ones,
 * and seen through a 1 × 1 window whatever the drawing's shape (the original stretches it to fit).
 *
 * Settings (the original's, 0–100): patternScaleX and patternScaleY the ridges' size, patternPowerX and patternPowerY
 * their sharpness, patternAmount how much of the height they make (the rest is noise), distortionScaleX and
 * distortionScaleY the noise's size, surfaceHeight the height; color1 to color4 the gradient and colorStop1 to
 * colorStop4 where along it each colour takes over; gradientDistortionX and gradientDistortionY how much the
 * gradient's own noise varies across the sheet; noiseIntensity and noiseScale the grain; speed how fast it all moves.
 */
import { rgb } from './colors'
import { createProgram, createShape, deleteProgram, deleteShape, draw, share, type Program, type Shape, type Shared } from './gl'
import { identity, lookAt, ortho, remap } from './math'
import { CLASSIC_NOISE, NOISE_BASE, SIMPLEX_NOISE } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  speed: 0,
  patternScaleX: 0,
  patternScaleY: 0,
  patternPowerX: 0,
  patternPowerY: 0,
  patternAmount: 0,
  distortionScaleX: 0,
  distortionScaleY: 0,
  surfaceHeight: 0,
  color1: '#BA4534',
  color2: '#D67162',
  color3: '#9E3626',
  color4: '#ff0000',
  colorStop1: 0,
  colorStop2: 0,
  colorStop3: 0,
  colorStop4: 0,
  gradientDistortionX: 0,
  gradientDistortionY: 0,
  noiseIntensity: 0,
  noiseScale: 0,
}

const VERTEX = /* glsl */ `
${NOISE_BASE}
${CLASSIC_NOISE}

float PI = 3.141592653589793;

attribute vec3 aPosition;
attribute vec2 aUv;

uniform float uTime;
uniform vec4 uScales;        // the pattern's scale (xy) and the noise's (zw)
uniform vec2 uRidgePower;    // how sharp the pattern's ridges are, across and along
uniform float uPatternShare; // 0: all noise; 1: all pattern
uniform float uHeight;
uniform mat4 uView;
uniform mat4 uProjection;

varying float vHeight;       // the sheet's height here, about 0 to 1
varying vec2 vUv;

// 1 on the even lines of x, 0 on the odd ones, the change sharper as sharpness grows.
float ridges(float x, float sharpness) {
  return 1.0 - pow(abs(sin(PI * x * 0.5)), sharpness);
}

void main() {
  vec3 point = aPosition;
  vec3 patternAt = vec3(point.xy * uScales.xy, uTime);
  float pattern = ridges(patternAt.x, uRidgePower.x) * ridges(patternAt.y, uRidgePower.y);
  float noise = cnoise(vec3(point.xy * uScales.zw, uTime));
  noise = noise * 0.5 + 0.5;
  float height = mix(noise, pattern, uPatternShare);
  point.z += height * uHeight;

  vHeight = height;
  vUv = aUv;
  gl_Position = uProjection * uView * vec4(point, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${NOISE_BASE}
${SIMPLEX_NOISE}

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec4 uStops;        // where along the gradient each colour takes over
uniform vec2 uWarp;         // how much the gradient's noise varies across the sheet
uniform float uGrain;       // how much of the fine grain shows
uniform float uGrainScale;  // the grain's size, per pixel

varying float vHeight;
varying vec2 vUv;

void main() {
  float warp = snoise(vec3(vUv * uWarp, uTime * 2.0));
  warp = warp * 0.5 + 0.5;
  float grain = snoise(vec3(gl_FragCoord.xy * uGrainScale, uTime * 100.0));
  grain = grain * 0.5 + 0.5;
  float along = smoothstep(0.0, 1.0, (vHeight + mix(warp, grain, uGrain)) * 0.5);

  vec3 color = mix(uColor1, uColor2, smoothstep(uStops.x, uStops.y, along));
  color = mix(color, uColor3, smoothstep(uStops.y, uStops.z, along));
  color = mix(color, uColor4, smoothstep(uStops.z, uStops.w, along));
  gl_FragColor = vec4(color, 1.0);
}
`

/** Across the sheet, and from its far edge to its near one. */
const COLS = 400
const ROWS = 50

/** A flat 2 × 2 sheet at z = 0, its rows from y = 1 (the far edge) to y = -1; `aUv` is (across, up). */
function sheet(gl: WebGLRenderingContext): Shape {
  const position: number[] = []
  const uv: number[] = []
  for (let row = 0; row <= ROWS; row++) {
    const y = row * (2 / ROWS) - 1
    for (let col = 0; col <= COLS; col++) {
      position.push(col * (2 / COLS) - 1, -y, 0)
      uv.push(col / COLS, 1 - row / ROWS)
    }
  }
  const index: number[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const a = col + (COLS + 1) * row
      const b = col + (COLS + 1) * (row + 1)
      const c = col + 1 + (COLS + 1) * (row + 1)
      const d = col + 1 + (COLS + 1) * row
      index.push(a, b, d, b, c, d)
    }
  }
  return createShape(gl, { aPosition: { data: new Float32Array(position), size: 3 }, aUv: { data: new Float32Array(uv), size: 2 } }, new Uint16Array(index))
}

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS & { pixelRatio: number }
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, 'surface-program', () => createProgram(gl, VERTEX, FRAGMENT), (p) => deleteProgram(gl, p))
    shape = share(gl, 'surface-sheet', () => sheet(gl), (f) => deleteShape(gl, f))
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const uniforms = {
    uTime: 0,
    uScales: [
      remap(s.patternScaleX, 0, 100, 0.1, 20),
      remap(s.patternScaleY, 0, 100, 0.1, 20),
      remap(s.distortionScaleX, 0, 100, 0, 10),
      remap(s.distortionScaleY, 0, 100, 0, 10),
    ],
    uRidgePower: [remap(s.patternPowerX, 0, 100, 0.4, 4), remap(s.patternPowerY, 0, 100, 0.4, 4)],
    uPatternShare: remap(s.patternAmount, 0, 100, 0, 1),
    uHeight: remap(s.surfaceHeight, 0, 100, 0, 1),
    uColor1: rgb(s.color1),
    uColor2: rgb(s.color2),
    uColor3: rgb(s.color3),
    uColor4: rgb(s.color4),
    uStops: [remap(s.colorStop1, 0, 100, 0, 1), remap(s.colorStop2, 0, 100, 0, 1), remap(s.colorStop3, 0, 100, 0, 1), remap(s.colorStop4, 0, 100, 0, 1)],
    uWarp: [remap(s.gradientDistortionX, 0, 100, 0, 10), remap(s.gradientDistortionY, 0, 100, 0, 10)],
    uGrain: remap(s.noiseIntensity, 0, 100, 0, 0.5),
    // The grain keeps its size in CSS pixels.
    uGrainScale: remap(s.noiseScale, 0, 100, 0.6, 0.3) / (s.pixelRatio || 1),
    uView: lookAt([], [0, -1, 2], [0, 0, 0], [0, 1, 0]),
    uProjection: ortho(identity(), -0.5, 0.5, -0.5, 0.5, 0, 4),
  }
  // The clock: each frame moves the art by the time since the last one, the first by its whole timestamp.
  let last = 0

  return {
    moves: s.speed !== 0,
    resize() {
      // The same view whatever the drawing's shape.
    },
    render(time) {
      const step = 0.001 * (time - last)
      last = time
      uniforms.uTime += step * (0.0025 * s.speed)
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      shared.program.release()
      shared.shape.release()
    },
  }
}
