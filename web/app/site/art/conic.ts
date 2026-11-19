/**
 * The "conic" art: the inside of a funnel seen from its wide end, which fills the section, painted with bands of two
 * colors that scroll down into it, warped by noise, fading to a third color (the "fog") towards the narrow end. A
 * fine grain of noise over the bands dithers them.
 *
 * Settings (the original's, 0–100 unless said): curveX and curveY (−100–100) bend the funnel sideways, curveFunnel
 * narrows its wide end; color1 and color2 the bands, color3 the fog and fogIntensity its strength; repeat how many
 * bands, rotation (degrees) their angle and blur their softness; speed (−100–100) how fast they scroll,
 * rotationSpeed (−100–100) how fast they turn; distortionScaleX/Y, distortionIntensity and distortionSpeed the
 * warping; noiseIntensity and noiseScale the grain.
 */
import { rgb } from './colors'
import { createProgram, createShape, deleteProgram, deleteShape, draw, share, type Program, type Shape, type Shared } from './gl'
import { identity, lookAt, perspective, remap, rotateX, scale, translate, visibleSize, type Mat4 } from './math'
import { NOISE_BASE, SIMPLEX_NOISE } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  curveX: 0,
  curveY: 0,
  curveFunnel: 0,
  color1: '#d45071',
  color2: '#f8ba81',
  color3: '#ffffff',
  fogIntensity: 0,
  repeat: 1,
  speed: 0,
  rotation: 0,
  rotationSpeed: 0,
  blur: 0,
  distortionScaleX: 0,
  distortionScaleY: 0,
  distortionIntensity: 0,
  distortionSpeed: 0,
  noiseIntensity: 0,
  noiseScale: 0,
}

/** The camera's field of view (degrees, up to down), and its distance from the funnel's wide end. */
const FOV = 80
const DISTANCE = 10

const VERTEX = /* glsl */ `
attribute vec3 aPosition;
attribute vec2 aUv;

uniform vec3 uCurve;
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vUv;

void main() {
  vec3 position = aPosition;
  // How far down the funnel: 0 at the wide end, 1 at the tip.
  float down = -(position.y - 0.5);
  float rest = down - 1.0;
  // Narrower towards the tip (an ease-out curve), bent sideways (an ease-in one).
  position.xz *= 1.0 - (rest * rest * rest + 1.0) * uCurve.z;
  position.xz += uCurve.xy * (down * down * down);
  vUv = aUv;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
${NOISE_BASE}
${SIMPLEX_NOISE}

#define PI 3.141592653589793

uniform float uScrollTime;
uniform float uDistortionTime;
uniform float uRotationTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uFogColor;
uniform float uFogIntensity;
uniform float uRepeat;
uniform float uRotation;
uniform vec2 uGradient;
uniform vec2 uDistortionScale;
uniform float uDistortionAmount;
uniform float uNoiseAmount;
uniform float uNoiseScale;

varying vec2 vUv;

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}

void main() {
  // Around the funnel, and down it as the bands scroll.
  vec2 at = vUv;
  at.x = cos(at.x * PI * 2.0);
  at.y = cos(at.y - uScrollTime);
  at.xy += snoise(vec3(at * uDistortionScale, uDistortionTime)) * uDistortionAmount;

  // Bands across one direction, turning.
  float angle = uRotation + uRotationTime;
  float band = dot(vec2(0.5) - at, vec2(cos(angle), sin(angle))) + 0.5;
  band = (cos(band * uRepeat * PI) + 1.0) * 0.5;

  // The grain, fixed to the screen's pixels.
  band += snoise(vec3(gl_FragCoord.xy * vec2(uNoiseScale), uDistortionTime * 100.0)) * uNoiseAmount * 0.4;

  float mixed = clamp(remap(band, uGradient.x, uGradient.y, 0.0, 1.0), 0.0, 1.0);
  vec3 color = mix(uColor2, uColor1, mixed);
  color = mix(color, uFogColor, smoothstep(0.0, 1.0, (1.0 - vUv.y) * uFogIntensity));
  gl_FragColor = vec4(color, 1.0);
}
`

/** Around the funnel, and along it. */
const AROUND = 128
const ALONG = 100

/**
 * The funnel: an open cone 1 high, its wide end (radius 1) at the top. Vertices row by row from the top, each row
 * once around (the last vertex where the first is); `aUv` is (around, up).
 */
function funnel(gl: WebGLRenderingContext) {
  const position: number[] = []
  const uv: number[] = []
  for (let row = 0; row <= ALONG; row++) {
    const down = row / ALONG
    const radius = down * (0 - 1) + 1
    for (let col = 0; col <= AROUND; col++) {
      const around = col / AROUND
      const theta = around * (2 * Math.PI) + 0
      position.push(radius * Math.sin(theta), -down * 1 + 0.5, radius * Math.cos(theta))
      uv.push(around, 1 - down)
    }
  }
  const index: number[] = []
  const at = (row: number, col: number) => row * (AROUND + 1) + col
  for (let col = 0; col < AROUND; col++)
    for (let row = 0; row < ALONG; row++) {
      index.push(at(row, col), at(row + 1, col), at(row, col + 1))
      index.push(at(row + 1, col), at(row + 1, col + 1), at(row, col + 1))
    }
  return createShape(gl, { aPosition: { data: new Float32Array(position), size: 3 }, aUv: { data: new Float32Array(uv), size: 2 } }, new Uint16Array(index))
}

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS & { pixelRatio: number }
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, 'conic-program', () => createProgram(gl, VERTEX, FRAGMENT), (p) => deleteProgram(gl, p))
    shape = share(gl, 'conic-shape', () => funnel(gl), (f) => deleteShape(gl, f))
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const viewMatrix = lookAt([], [0, 0, DISTANCE], [0, 0, 0], [0, 1, 0])
  const model: Mat4 = identity()
  const projection: Mat4 = identity()
  const uniforms = {
    uScrollTime: 0,
    uDistortionTime: 0,
    uRotationTime: 0,
    uModelMatrix: model,
    uViewMatrix: viewMatrix,
    uProjectionMatrix: projection,
    uCurve: [remap(s.curveX, -100, 100, -4, 4), remap(s.curveY, -100, 100, -4, 4), remap(s.curveFunnel, 0, 100, 1, 0)],
    uColor1: rgb(s.color1),
    uColor2: rgb(s.color2),
    uFogColor: rgb(s.color3),
    uFogIntensity: remap(s.fogIntensity, 0, 100, 0, 1),
    uRepeat: s.repeat,
    uRotation: remap(s.rotation, 0, 360, 0, 2 * Math.PI),
    uGradient: [remap(s.blur, 0, 100, 0.5, 0), remap(s.blur, 0, 100, 0.5, 1)],
    uDistortionScale: [remap(s.distortionScaleX, 0, 100, 0, 4), remap(s.distortionScaleY, 0, 100, 0, 4)],
    uDistortionAmount: remap(s.distortionIntensity, 0, 100, 0, 0.5),
    uNoiseAmount: remap(s.noiseIntensity, 0, 100, 0, 0.5),
    uNoiseScale: remap(s.noiseScale, 0, 100, 0.6, 0.3) / s.pixelRatio,
  }
  const scrollSpeed = remap(s.speed, -100, 100, -0.15, 0.15)
  const rotationSpeed = remap(s.rotationSpeed, -100, 100, -0.075, 0.075)
  const distortionSpeed = remap(s.distortionSpeed, 0, 100, 0, 0.075)
  // The clock: each frame moves the art by the time since the last one, the first by its whole timestamp.
  let last = 0

  return {
    moves: !(s.speed === 0 && s.rotationSpeed === 0 && s.distortionSpeed === 0),
    resize() {
      // The funnel's wide end covers what the camera sees, corner to corner.
      const aspect = view.drawWidth / view.drawHeight
      const seen = visibleSize(FOV, aspect, DISTANCE)
      const radius = 0.5 * Math.sqrt(seen.width * seen.width + seen.height * seen.height)
      identity(model)
      translate(model, [0, 0, -5])
      rotateX(model, 0.5 * Math.PI)
      scale(model, [radius, 10, radius])
      perspective(projection, (FOV * Math.PI) / 180, aspect, 1, 1000)
    },
    render(time) {
      const step = 0.001 * (time - last)
      last = time
      uniforms.uScrollTime += step * scrollSpeed
      uniforms.uRotationTime += step * rotationSpeed
      uniforms.uDistortionTime += step * distortionSpeed
      gl.enable(gl.DEPTH_TEST)
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      shared.program.release()
      shared.shape.release()
    },
  }
}
