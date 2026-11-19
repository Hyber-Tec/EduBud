/**
 * The "contours" art: a noise landscape cut into flat levels, like a contour map, colored from the start color
 * (lowest) to the end color (highest), that travels in one direction and slowly changes shape. Optionally the levels
 * blend smoothly instead, or each edge gets a bevel of light and shade.
 *
 * It moves by frames, as the original's does: each frame (each `render`) takes one fixed step, so it runs at the
 * screen's frame rate (60 steps a second on a 60 Hz screen), and its first frame has already taken one.
 *
 * Settings (the original's): startColor and endColor (swapped by invertColors); steps how many levels; scale (0–100,
 * larger is broader) and complexity the two noises' sizes; cutoff (0–100) the height below which all is the lowest
 * level; seed; speedTravel how fast it travels and travelDirection which way (taken in radians, as the original takes
 * it); speedMorph how fast it changes shape; isBlurEnabled smooth levels; isBevelEnabled with bevelSize,
 * bevelRotation (degrees) and bevelStrength (0–100) the bevel.
 */
import { rgb } from './colors'
import { bigTriangle, FILL_VERTEX } from './fill'
import { createProgram, deleteProgram, draw, share, type Program, type Shape, type Shared } from './gl'
import { CLASSIC_NOISE, NOISE_BASE } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  startColor: '#ffffff' as string | null,
  endColor: '#000000' as string | null,
  invertColors: false,
  complexity: 0,
  cutoff: 0,
  scale: 1,
  seed: 0,
  speedMorph: 0,
  speedTravel: 0,
  travelDirection: 0,
  isBlurEnabled: false,
  steps: 2,
  isBevelEnabled: false,
  bevelRotation: 0,
  bevelSize: 0,
  bevelStrength: 0,
}

// SMOOTH blends the levels; BEVEL (only with levels) adds the bevel.
const FRAGMENT = /* glsl */ `
${NOISE_BASE}
${CLASSIC_NOISE}

#define PI 3.141592653589793

uniform vec3 uLow;            // the lowest level's color
uniform vec3 uHigh;           // the highest level's color
uniform float uAspect;        // the section's width over its height
uniform float uScale;         // the broad noise's scale
uniform float uDetail;        // the other noise's scale
uniform float uSeed;
uniform float uCutOff;        // heights below this are the lowest level
uniform float uLevels;        // how many levels above the lowest
uniform float uShape;         // how far the landscape has changed shape
uniform vec2 uTravel;         // how far it has travelled
uniform vec2 uBevelOffset;    // where the bevel looks for the next level
uniform float uBevelStrength;

varying vec2 vUv;

float easeInOutSine(float x) {
  return -0.5 * (cos(PI * x) - 1.0);
}

// The landscape's height at p, about 0 to 1: one noise, and another a tenth as strong.
float terrain(vec2 p, vec2 travel, float broad, float fine, float z) {
  return (cnoise(vec3(p * broad - travel + uSeed, z)) + cnoise(vec3(p * fine - travel + uSeed, z)) * 0.1) * 0.5 + 0.5;
}

// The height above the cut-off, as a share of what's above it.
float aboveCutOff(float h) {
  return max(0.0, h - uCutOff) / (1.0 - uCutOff);
}

void main() {
  vec2 p = vUv - 0.5;
  float z = uShape + uSeed;
  p.x *= uAspect;

  float level = aboveCutOff(easeInOutSine(terrain(p, uTravel, uScale, uDetail, z)));
  float shade = level;
#ifndef SMOOTH
  level = floor(level * uLevels + 0.5);
  shade = level / uLevels;
#endif

  vec4 color = vec4(mix(uLow, uHigh, shade), 1.0);

#ifdef BEVEL
  // Lighter where the next level along the bevel's direction is lower, darker where it's higher.
  float next = floor(aboveCutOff(easeInOutSine(terrain(p + uBevelOffset, uTravel, uScale, uDetail, z))) * uLevels + 0.5);
  color.rgb += ((level - next) - (next - level)) * uBevelStrength;
#endif

  gl_FragColor = color;
}
`

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS
  const smooth = !!s.isBlurEnabled
  const bevel = !smooth && !!s.isBevelEnabled
  const defines = [smooth && '#define SMOOTH', bevel && '#define BEVEL'].filter(Boolean).join('\n')
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, `contours-program-${+smooth}-${+bevel}`, () => createProgram(gl, FILL_VERTEX, `${defines}\n${FRAGMENT}`), (p) => deleteProgram(gl, p))
    shape = bigTriangle(gl)
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const start = rgb(s.startColor)
  const end = rgb(s.endColor)
  // Which way it travels: as on the original, the setting is taken in radians, though the editor shows degrees.
  const direction = [Math.cos(s.travelDirection), Math.sin(s.travelDirection)]
  const bevelAngle = (s.bevelRotation * Math.PI) / 180
  const bevelSize = 1e-4 * s.bevelSize
  const uniforms = {
    uLow: s.invertColors ? end : start,
    uHigh: s.invertColors ? start : end,
    uAspect: view.width / view.height,
    uScale: 0.2 * Math.max(1, 100 - s.scale),
    uDetail: s.complexity,
    uSeed: 0.1 * s.seed,
    uCutOff: 0.01 * Math.min(s.cutoff, 99.99),
    uLevels: s.steps,
    uShape: 0,
    uTravel: [0, 0],
    uBevelOffset: [bevelSize * Math.cos(bevelAngle), bevelSize * Math.sin(bevelAngle)],
    uBevelStrength: 0.01 * s.bevelStrength,
  }

  return {
    moves: !!(s.speedTravel || s.speedMorph),
    resize(width, height) {
      uniforms.uAspect = width / height
    },
    render() {
      // One frame's step, in the original's order and arithmetic, then the drawing.
      const travel = 25e-6 * s.speedTravel
      uniforms.uShape += 1e-5 * s.speedMorph
      uniforms.uTravel[0] += travel * direction[0]
      uniforms.uTravel[1] += travel * direction[1]
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      shared.program.release()
      shared.shape.release()
    },
  }
}
