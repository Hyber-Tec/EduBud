/**
 * The "bokeh" art: soft, out-of-focus discs of light drifting across the section in a loose stream, over a background
 * color, with a faint beam of light rising from the bottom.
 *
 * Settings (the original's, 0–100 unless said): backgroundColor; color1 and color2 the discs (each a mix of the two),
 * count how many, size their size and alpha their strength; speed (−100–100) how fast they drift and seed (a
 * number) the stream's shape, complexityY/Z and amplitudeY/Z how it winds, offset how widely the discs spread around
 * it, distortionSpeed (−100–100) how fast it changes; color3, lightIntensity, lightAngle and lightX the beam.
 *
 * The discs are placed at random (100,000 of them, of which `count` are drawn), so each visit shows a different
 * stream, as on the original.
 */
import { parseColor, rgb } from './colors'
import { createProgram, createShape, deleteProgram, deleteShape, draw, share, type Program, type Shape, type Shared } from './gl'
import { identity, lookAt, perspective, remap, visibleSize, type Mat4 } from './math'
import { CLASSIC_NOISE, NOISE_BASE } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  color1: '#d45071',
  color2: '#f8ba81',
  backgroundColor: '#28243e',
  color3: '#ffffff',
  size: 1,
  count: 0,
  speed: 0,
  distortionSpeed: 0,
  alpha: 0,
  seed: 0,
  complexityY: 0,
  complexityZ: 0,
  amplitudeY: 0,
  amplitudeZ: 0,
  offset: 0,
  lightAngle: 0,
  lightIntensity: 0,
  lightX: 0,
}

/** How many discs there are to draw from. */
const DISCS = 100000
/** The camera's field of view (degrees, up to down), and its distance from the stream. */
const FOV = 40
const DISTANCE = 100

const DISC_VERTEX = /* glsl */ `
${NOISE_BASE}
${CLASSIC_NOISE}

attribute vec3 aPosition;
attribute vec2 aUv;
attribute vec3 aOffset;
attribute vec4 aParticle;
attribute vec2 aDelayDuration;

uniform float uTime;
uniform float uDistortionTime;
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uStart;
uniform vec3 uEnd;
uniform float uSize;
uniform float uSeed;
uniform vec4 uPath;
uniform float uOffset;

varying vec2 vUv;
varying vec3 vPosition;
varying vec4 vParticle;

void main() {
  // How far along the stream this disc is: each loops at its own pace, from its own start.
  float along = mod((uTime + aDelayDuration.x), aDelayDuration.y) / aDelayDuration.y;
  vec3 position = mix(uStart, uEnd, along);

  // The stream winds up and down, and to and fro.
  float wind = cnoise(vec3(along + uDistortionTime, uSeed, 0.0) * uPath.x);
  float sway = cnoise(vec3(along + uDistortionTime, uSeed, 0.0) * uPath.z);
  position.y += wind * uPath.y;
  position.z += sway * uPath.w;

  // Discs spread around it, wider where it sways.
  position += aOffset * (sway * 0.5 + 0.3) * uOffset;

  float n = cnoise(position * 0.1);
  position.z += n * 4.0;
  position += aPosition * uSize * aParticle.x * n;

  vUv = aUv;
  vPosition = position;
  vParticle = aParticle;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`

const DISC_FRAGMENT = /* glsl */ `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uAlpha;

varying vec2 vUv;
varying vec3 vPosition;
varying vec4 vParticle;

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}

// A soft disc: 1 inside, fading out across its blurred edge.
float disc(vec2 uv, vec2 blur, float r) {
  vec2 d = uv - vec2(0.5);
  return 1.0 - smoothstep(r - (r * blur.x), r + (r * blur.y), dot(d, d) * 4.0);
}

void main() {
  // Blurrier the farther from the focus.
  float depth = abs(remap(vPosition.z, -160., 160., 0., 1.));
  depth *= depth;
  float a = disc(vUv, vec2(vParticle.y + 0.5 * depth, vParticle.z + 0.5 * depth), 0.5);
  vec3 color = mix(uColor1, uColor2, vParticle.w);
  gl_FragColor = vec4(color * a * vParticle.w * uAlpha, a * uAlpha);
}
`

const LIGHT_VERTEX = /* glsl */ `
attribute vec3 aPosition;
attribute vec2 aUv;

varying vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 1.0);
}
`

const LIGHT_FRAGMENT = /* glsl */ `
${NOISE_BASE}
${CLASSIC_NOISE}

uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uAngle;
uniform float uPosition;

varying vec2 vUv;

// A dither of half a color step, so the faint beam doesn't band.
const highp float GRAIN = 0.5/255.0;

highp float random(vec2 p) {
  return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 turn(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c + p.y * s, -p.x * s + p.y * c);
}

void main() {
  vec2 at = turn(vUv - vec2(0.5), uAngle) + vec2(0.5);
  // Rays: noise stretched up and down, stronger towards the bottom.
  float n = cnoise(vec3(at * vec2(8.0, 1.0), uTime * 0.25));
  n = n * 0.5 + 0.5;
  n *= vUv.y * vUv.y;
  // Strongest across, at uPosition.
  float c = 0.;
  c = mix(0.0, 1.0, smoothstep(0.0, uPosition, vUv.x));
  c = mix(c, 0.0, smoothstep(uPosition, 1.0, vUv.x));
  n *= c * uIntensity;
  n += mix(-GRAIN, GRAIN, random(vUv));
  gl_FragColor = vec4(uColor, n);
}
`

/** A flat square `size` wide, facing the camera: 4 corners, 2 triangles. */
function square(size: number) {
  const h = size / 2
  return {
    aPosition: new Float32Array([-h, h, 0, h, h, 0, -h, -h, 0, h, -h, 0]),
    aUv: new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
    index: new Uint16Array([0, 2, 1, 2, 3, 1]),
  }
}

/** The discs: a small square, drawn once per disc, each with its own place, pace, size, blur and color. */
function discs(gl: WebGLRenderingContext) {
  const between = (a: number, b: number) => a + (b - a) * Math.random()
  const each = (size: number, pick: (out: number[]) => void) => {
    const data = new Float32Array(DISCS * size)
    const one: number[] = []
    for (let i = 0; i < DISCS; i++) {
      pick(one)
      for (let k = 0; k < size; k++) data[i * size + k] = one[k]
    }
    return { data, size, divisor: 1 }
  }
  const { index, ...corners } = square(1)
  return createShape(
    gl,
    {
      aPosition: { data: corners.aPosition, size: 3 },
      aUv: { data: corners.aUv, size: 2 },
      // Where around the stream, from −1 to 1 each way.
      aOffset: each(3, (o) => ((o[0] = between(-1, 1)), (o[1] = between(-1, 1)), (o[2] = between(-1, 1)))),
      // When it starts along the stream, and how long it takes.
      aDelayDuration: each(2, (o) => ((o[0] = between(0, 1)), (o[1] = between(0.5, 1)))),
      // Its size, inner and outer blur, and color (and strength).
      aParticle: each(4, (o) => ((o[0] = between(0.1, 1)), (o[1] = between(0.25, 0.75)), (o[2] = between(0.25, 0.75)), (o[3] = between(0, 1)))),
    },
    index,
  )
}

/** The beam: a square covering the whole drawing. */
function screen(gl: WebGLRenderingContext) {
  const { index, aPosition, aUv } = square(2)
  return createShape(gl, { aPosition: { data: aPosition, size: 3 }, aUv: { data: aUv, size: 2 } }, index)
}

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as typeof DEFAULTS
  const ext = gl.getExtension('ANGLE_instanced_arrays')
  if (!gl.getExtension('OES_element_index_uint') || !ext) return null
  const made: Shared<Program | Shape>[] = []
  let discProgram: Shared<Program>, lightProgram: Shared<Program>, discShape: Shared<Shape>, lightShape: Shared<Shape>
  try {
    made.push((discProgram = share(gl, 'bokeh-program', () => createProgram(gl, DISC_VERTEX, DISC_FRAGMENT), (p) => deleteProgram(gl, p))))
    made.push((discShape = share(gl, 'bokeh-shape', () => discs(gl), (d) => deleteShape(gl, d))))
    made.push((lightShape = share(gl, 'bokeh-light-shape', () => screen(gl), (d) => deleteShape(gl, d))))
    made.push((lightProgram = share(gl, 'bokeh-light-program', () => createProgram(gl, LIGHT_VERTEX, LIGHT_FRAGMENT), (p) => deleteProgram(gl, p))))
  } catch {
    made.forEach((m) => m.release())
    return null
  }

  const viewMatrix = lookAt([], [0, 0, DISTANCE], [0, 0, 0], [0, 1, 0])
  const projection: Mat4 = identity()
  const disc = {
    uTime: 0,
    uDistortionTime: 0,
    uModelMatrix: identity(),
    uViewMatrix: viewMatrix,
    uProjectionMatrix: projection,
    uStart: [0, 0, 0],
    uEnd: [0, 0, 0],
    uColor1: rgb(s.color1),
    uColor2: rgb(s.color2),
    uSize: remap(s.size, 1, 100, 1, 32),
    uAlpha: remap(s.alpha, 1, 100, 0.01, 1),
    uSeed: s.seed,
    uPath: [remap(s.complexityY, 0, 100, 0, 6), remap(s.amplitudeY, 0, 100, 0, 100), remap(s.complexityZ, 0, 100, 0, 6), remap(s.amplitudeZ, 0, 100, 0, 100)],
    uOffset: remap(s.offset, 0, 100, 1, 60),
  }
  const light = {
    uTime: 0,
    uColor: rgb(s.color3),
    uIntensity: remap(s.lightIntensity, 0, 100, 0, 1),
    uAngle: remap(s.lightAngle, 0, 100, -0.3 * Math.PI, 0.3 * Math.PI),
    uPosition: remap(s.lightX, 0, 100, 0, 1),
  }
  const count = remap(s.count, 0, 100, 0, DISCS) | 0
  const speed = remap(s.speed, -100, 100, -0.01, 0.01)
  const distortionSpeed = remap(s.distortionSpeed, -100, 100, -0.01, 0.01)
  // The clock: each frame moves the art by the time since the last one, the first by its whole timestamp.
  let last = 0

  return {
    clearColor: parseColor(s.backgroundColor),
    moves: !(s.speed === 0 && s.distortionSpeed === 0),
    resize() {
      // The stream runs across what the camera sees, from beyond one side to beyond the other.
      const aspect = view.drawWidth / view.drawHeight
      const seen = visibleSize(FOV, aspect, DISTANCE)
      const across = Math.max(seen.width, seen.height)
      disc.uStart[0] = -0.75 * across
      disc.uEnd[0] = 0.75 * across
      perspective(projection, (FOV * Math.PI) / 180, aspect, 1, 10000)
    },
    render(time) {
      const step = 0.001 * (time - last)
      last = time
      disc.uTime += step * speed
      disc.uDistortionTime += step * distortionSpeed
      light.uTime += step * speed
      // Light adds up: each disc brightens what's behind it.
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendEquation(gl.FUNC_ADD)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      draw(gl, discProgram.value, discShape.value, disc, { ext, count })
      draw(gl, lightProgram.value, lightShape.value, light)
      gl.disable(gl.BLEND)
    },
    destroy() {
      made.forEach((m) => m.release())
    },
  }
}
