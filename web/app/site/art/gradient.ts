/**
 * The "gradient" art: a linear or radial gradient between two colors whose coordinates a slowly drifting noise pinches
 * toward the middle, so its bands ripple. The radial one can follow the pointer over its section.
 *
 * It moves by frames, as the original's does: each frame (each `render`) takes one fixed step, so it runs at the
 * screen's frame rate (60 steps a second on a 60 Hz screen), and its first frame has already taken one.
 *
 * Settings (the original's, 0–100 unless said): gradientType "linear" or "radial"; startColor and endColor (swapped
 * by invertColors). Linear: linearGradientAngle (degrees; 0 never turns), linearGradientAngleMotion how fast it turns,
 * linearGradientStartColorDistance and linearGradientEndColorDistance (−100–100) where the colors start and end,
 * linearGradientRepeat how many times they go back and forth. Radial: radialGradientRadius, radialGradientPositionX/Y
 * its middle, radialGradientFollowCursor and radialGradientFollowSpeed. The distortion: distortionComplexity how fine,
 * distortionDirection (degrees) which way it drifts, distortionSpeed how fast, distortionMorphSpeed how fast it changes
 * shape, distortionIntensity how hard it pinches, distortionSmoothness how much of it does, distortionSeed. The grain:
 * noiseIntensity, noiseScale, noiseBias (−100–100) and animateNoise.
 */
import { rgb } from './colors'
import { bigTriangle, FILL_VERTEX } from './fill'
import { createProgram, deleteProgram, draw, share, type Program, type Shape, type Shared } from './gl'
import { NOISE_BASE, SIMPLEX_NOISE } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  gradientType: 'radial',
  invertColors: false,
  startColor: '#ffffff' as string | null,
  endColor: '#000000' as string | null,
  linearGradientStartColorDistance: 0,
  linearGradientEndColorDistance: 0,
  linearGradientAngle: 0,
  linearGradientAngleMotion: 0,
  linearGradientRepeat: 1,
  radialGradientRadius: 0,
  radialGradientPositionX: 0,
  radialGradientPositionY: 0,
  radialGradientFollowCursor: false,
  radialGradientFollowSpeed: 0,
  noiseIntensity: 0,
  noiseScale: 0,
  noiseBias: 0,
  animateNoise: false,
  distortionComplexity: 0,
  distortionDirection: 0,
  distortionIntensity: 0,
  distortionMorphSpeed: 0,
  distortionSeed: 0,
  distortionSmoothness: 0,
  distortionSpeed: 0,
}

// RADIAL picks the radial gradient (else linear); GRAIN adds the grain, which a strength of 0 leaves out (adding
// 0 × the grain changes no pixel, and the grain is half the work).
const FRAGMENT = /* glsl */ `
${NOISE_BASE}
${SIMPLEX_NOISE}

#define PI 3.141592653589793

uniform vec3 uFrom;          // the start color
uniform vec3 uTo;            // the end color
uniform vec2 uSize;          // the section in CSS pixels

uniform float uDetail;       // how fine the distortion's noise is
uniform float uDriftAngle;   // which way it drifts (radians)
uniform float uDrift;        // how far it has drifted
uniform float uShape;        // how far it has changed shape
uniform float uSeed;
uniform float uStrength;     // how hard it pinches the gradient, 0 to 1
uniform float uSoftness;     // how much of the noise pinches, 0 to 1

#ifdef RADIAL
uniform vec2 uCenter;        // 0 to 1 across the section, from its bottom left
uniform float uRadius;       // in section heights
#else
uniform vec2 uAngle;         // the gradient's direction (cosine, sine)
uniform float uStart;        // where the start color ends, 0 to 1 along it
uniform float uEnd;          // where the end color begins
uniform float uRepeat;       // how many times the colors go back and forth
#endif

#ifdef GRAIN
uniform float uGrain;        // the grain's strength
uniform float uGrainScale;
uniform float uGrainBias;
uniform float uGrainTime;
#endif

varying vec2 vUv;

float easeOutCubic(float x) {
  float f = x - 1.0;
  return f * f * f + 1.0;
}

float remap(float v, float fromLow, float fromHigh, float toLow, float toHigh) {
  return toLow + (v - fromLow) * (toHigh - toLow) / (fromHigh - fromLow);
}

// p turned clockwise by a (radians).
vec2 turn(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c + p.y * s, -p.x * s + p.y * c);
}

// The distortion's noise at p (0 to 2), drifted along its direction and changed in shape over time.
float distortion(vec2 p) {
  vec2 drift = turn(vec2(uDrift), uDriftAngle);
  return 1.0 - snoise(vec3(p * uDetail + drift, uShape) + uSeed);
}

#ifdef GRAIN
// Film grain: noise at a random offset for each pixel.
float grain(vec2 p) {
  float r = fract(sin(dot(p + uGrainTime, vec2(12.9898, 78.233))) * 43758.5453);
  return snoise(vec3(p, uGrainTime) * uGrainScale + r);
}
#endif

void main() {
  // Where the noise is high, the point is drawn from nearer the middle of the gradient.
  float pinch = 1.0 - easeOutCubic(smoothstep(1.0 - uSoftness, 1.0, 1.0 - distortion(vUv))) * uStrength;
  vec2 p = (vUv - 0.5) * pinch + 0.5;

#ifdef RADIAL
  vec2 center = uCenter;
  float aspect = uSize.x / uSize.y;
  p.x *= aspect;
  center.x *= aspect;
  float t = clamp(length(center - p) / uRadius, 0.0, 1.0);
#else
  float t = dot(vec2(0.5) - p, uAngle) + 0.5;
  t = (cos(t * uRepeat * PI) + 1.0) * 0.5;
#endif

#ifdef GRAIN
  t += uGrain * (grain(gl_FragCoord.xy / uSize) + uGrainBias);
#endif

#ifdef RADIAL
  vec3 color = mix(uFrom, uTo, smoothstep(0.0, 1.0, t));
#else
  vec3 color = mix(uFrom, uTo, clamp(remap(t, uStart, uEnd, 0.0, 1.0), 0.0, 1.0));
#endif
  gl_FragColor = vec4(color, 1.0);
}
`

/**
 * The radial gradient's middle, 0 to 1 across the section from its bottom left. With "follow cursor" on, it eases
 * toward the pointer while it's over the section (a share of the way each frame), and back to its place 2 seconds
 * after the pointer leaves.
 */
function follower(s: typeof DEFAULTS, section: HTMLElement) {
  const rest = [0.01 * s.radialGradientPositionX, 0.01 * s.radialGradientPositionY]
  const position = [rest[0], rest[1]]
  const target = [rest[0], rest[1]]
  const speed = 0.01 * s.radialGradientFollowSpeed
  const follows = !!s.radialGradientFollowCursor
  let reset: ReturnType<typeof setTimeout> | undefined

  const onMove = (e: MouseEvent) => {
    const r = section.getBoundingClientRect()
    target[0] = (e.clientX - r.left) / r.width
    target[1] = 1 - (e.clientY - r.top) / r.height
    clearTimeout(reset)
  }
  const onLeave = () => {
    clearTimeout(reset)
    reset = setTimeout(() => {
      target[0] = rest[0]
      target[1] = rest[1]
    }, 2000)
  }
  if (follows) {
    section.addEventListener('mousemove', onMove)
    section.addEventListener('mouseleave', onLeave)
  }

  return {
    position,
    /** One frame's step. */
    step() {
      if (follows) {
        position[0] += (target[0] - position[0]) * (speed * 0.016)
        position[1] += (target[1] - position[1]) * (speed * 0.016)
      } else {
        position[0] = rest[0]
        position[1] = rest[1]
      }
    },
    destroy() {
      clearTimeout(reset)
      section.removeEventListener('mousemove', onMove)
      section.removeEventListener('mouseleave', onLeave)
    },
  }
}

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS
  const radial = s.gradientType !== 'linear'
  const grain = s.noiseIntensity !== 0
  const defines = [radial && '#define RADIAL', grain && '#define GRAIN'].filter(Boolean).join('\n')
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, `gradient-program-${radial ? 'radial' : 'linear'}-${+grain}`, () => createProgram(gl, FILL_VERTEX, `${defines}\n${FRAGMENT}`), (p) => deleteProgram(gl, p))
    shape = bigTriangle(gl)
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const from = rgb(s.startColor)
  const to = rgb(s.endColor)
  // As on the original, the middle follows the pointer over the section, which the art's own box doesn't get.
  const center = follower(s, view.node.closest('section') ?? view.node)
  // The linear gradient's angle (degrees), turning a step each frame.
  let angle = s.linearGradientAngle
  const uAngle = [Math.cos((-s.linearGradientAngle * Math.PI) / 180), Math.sin((-s.linearGradientAngle * Math.PI) / 180)]
  const uniforms = {
    uFrom: s.invertColors ? to : from,
    uTo: s.invertColors ? from : to,
    uSize: [view.width, view.height],
    uDetail: 0.1 * s.distortionComplexity,
    uDriftAngle: (45 + s.distortionDirection) * (Math.PI / 180),
    uDrift: 0,
    uShape: 0,
    uSeed: s.distortionSeed,
    uStrength: 0.01 * s.distortionIntensity,
    uSoftness: 0.01 * s.distortionSmoothness,
    uCenter: center.position,
    uRadius: 0.01 * s.radialGradientRadius,
    uAngle,
    uStart: 0.5 * (0.01 * s.linearGradientStartColorDistance + 1),
    uEnd: 0.5 * (0.01 * s.linearGradientEndColorDistance + 1),
    uRepeat: s.linearGradientRepeat,
    uGrain: 0.01 * s.noiseIntensity,
    uGrainScale: 100 + 0.01 * (100 - s.noiseScale) * 900,
    uGrainBias: 0.01 * s.noiseBias,
    uGrainTime: 0,
  }

  return {
    moves: !!(s.animateNoise || s.linearGradientAngleMotion || (s.radialGradientFollowCursor && s.radialGradientFollowSpeed) || s.distortionSpeed || s.distortionMorphSpeed),
    resize(width, height) {
      uniforms.uSize = [width, height]
    },
    render() {
      // One frame's step, in the original's order and arithmetic, then the drawing.
      if (radial) center.step()
      else if (s.linearGradientAngle) {
        // (A set angle turns from where it's set; 0 never turns. Each frame draws the angle from before its step.)
        uAngle[0] = Math.cos((angle * Math.PI) / 180)
        uAngle[1] = Math.sin((angle * Math.PI) / 180)
        angle -= 0.016 * s.linearGradientAngleMotion
      } else {
        uAngle[0] = Math.cos((-s.linearGradientAngle * Math.PI) / 180)
        uAngle[1] = Math.sin((-s.linearGradientAngle * Math.PI) / 180)
      }
      uniforms.uGrainTime = s.animateNoise ? (uniforms.uGrainTime + 0.016) % 1 : 0
      uniforms.uDrift += 5e-5 * s.distortionSpeed
      uniforms.uShape += 1e-4 * s.distortionMorphSpeed
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      center.destroy()
      shared.program.release()
      shared.shape.release()
    },
  }
}
