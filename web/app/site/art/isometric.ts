/**
 * The "isometric" art: a field of boxes seen from one corner, rising and falling on slowly moving noise, lit from the
 * side. The field is `boxSize` wide boxes, as many as fit in 36 units each way (13 × 13 at 2.75), each drawn with the
 * three faces the camera sees (its top, +x and +z sides), from the far corner to the near one so that nearer boxes
 * cover farther ones (the original sets no depth test of its own).
 *
 * Settings (the original's): boxSize; scaleX, scaleY and scaleZ (%) the boxes' size in their cells; isMorphEnabled
 * lets each corner follow the noise (the boxes bend) rather than the box as a whole; startColor the faces turned to
 * the light, endColor those turned away and the background (invertColors swaps them); lightIntensity (%) and lightX,
 * lightY, lightZ (its direction) the light; speed how fast the noise moves; noiseScale its size; noiseRange (%) the
 * part of it that counts; positionFactor how far it lifts the boxes, scaleFactor how much it shrinks them, and
 * colorFactor how much darker it makes the low ones.
 */
import { parseColor } from './colors'
import { createProgram, createShape, deleteProgram, deleteShape, draw, share, type Program, type Shape, type Shared } from './gl'
import { identity, lookAt, normalize, ortho, type Mat4 } from './math'
import { NOISE_BASE, SIMPLEX_NOISE_2D } from './noise'
import type { CreateArt } from './types'

/** The settings a section doesn't give: the original's. */
const DEFAULTS = {
  boxSize: 1,
  scaleX: 0,
  scaleY: 0,
  scaleZ: 0,
  isMorphEnabled: false,
  startColor: '#F08E80',
  endColor: '#0B0D63',
  invertColors: false,
  lightIntensity: 100,
  lightX: 0,
  lightY: 0,
  lightZ: 0,
  speed: 0,
  noiseScale: 100,
  noiseRange: 100,
  positionFactor: 1,
  scaleFactor: 0,
  colorFactor: 1,
}

/** The field's width, in the same units as `boxSize`. */
const FIELD = 36
/** How much of the field the camera shows across the drawing's longer side. */
const VIEW = 17
/** How far the noise moves each frame, times `speed`: the original moves it by frames, not by time. */
const STEP = 16e-5

const VERTEX = /* glsl */ `
${NOISE_BASE}
${SIMPLEX_NOISE_2D}

attribute vec3 aPosition; // a corner of a box, from the middle of its top
attribute vec3 aNormal;   // which way its face looks
attribute vec3 aCell;     // the box's place in the field

uniform float uTime;
uniform float uField;
uniform vec3 uBoxScale;
uniform float uMorph;      // 1: each corner follows the noise where it is; 0: a box moves as one
uniform float uNoiseScale;
uniform vec2 uNoiseRange;  // the noise is held between these
uniform float uRise;       // how far the noise lifts a box
uniform float uShrink;     // how much the noise shrinks a box
uniform mat4 uView;
uniform mat4 uProjection;

varying vec3 vNormal;
varying float vHeight;     // where the noise is in its range, 0 to 1

void main() {
  vec2 spot = ((aCell.xz + (aPosition.xz * uBoxScale.xz) * uMorph) / uField) * uNoiseScale;
  float noise = 0.0;
  noise += snoise(spot + vec2(uTime));
  noise += snoise(spot + vec2(sin(uTime), cos(uTime)));
  noise *= 0.5;
  noise = clamp(noise, uNoiseRange.x, uNoiseRange.y);
  float height = (noise - uNoiseRange.x) / (uNoiseRange.y - uNoiseRange.x);

  vec3 corner = (aPosition * uBoxScale * (1.0 - height * uShrink)) + aCell;
  corner.y += noise * uRise;
  gl_Position = uProjection * uView * vec4(corner, 1.0);

  vNormal = aNormal;
  vHeight = height;
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uLit;          // the colour of a face turned to the light
uniform vec3 uShade;        // the colour away from it (and the background)
uniform float uLightStrength;
uniform vec3 uLight;        // the light's direction
uniform float uDepthShade;  // how much darker the low boxes are

varying vec3 vNormal;
varying float vHeight;

void main() {
  float light = dot(normalize(vNormal), uLight) * uLightStrength;
  float lowness = 1.0 - (1.0 - vHeight) * uDepthShade;
  gl_FragColor = vec4(mix(uShade, uLit, light * lowness), 1.0);
}
`

/**
 * One box: its +x, top and +z faces, each a grid of squares (4 across the top each way, 4 × 1 on the sides), its top
 * at y = 0. The corners and triangles come in the original's order, which is the order they're drawn in.
 */
function box(size: number) {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  // A face across axes u and v (drawn in directions uDir, vDir), at depth / 2 along axis w.
  const face = (u: number, v: number, w: number, uDir: number, vDir: number, width: number, height: number, depth: number, cols: number, rows: number) => {
    const first = positions.length / 3
    for (let row = 0; row <= rows; row++) {
      const y = row * (height / rows) - 0.5 * height
      for (let col = 0; col <= cols; col++) {
        const x = col * (width / cols) - 0.5 * width
        const at = positions.length
        positions.push(0, 0, 0)
        normals.push(0, 0, 0)
        positions[at + u] = x * uDir
        positions[at + v] = y * vDir
        positions[at + w] = 0.5 * depth
        normals[at + w] = depth > 0 ? 1 : -1
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const a = first + col + (cols + 1) * row
        const b = first + col + (cols + 1) * (row + 1)
        const c = first + col + 1 + (cols + 1) * (row + 1)
        const d = first + col + 1 + (cols + 1) * row
        indices.push(a, b, d, b, c, d)
      }
    }
  }
  face(2, 1, 0, -1, -1, size, size, size, 4, 1) // +x
  face(0, 2, 1, 1, 1, size, size, size, 4, 4) // top
  face(0, 1, 2, 1, -1, size, size, size, 4, 1) // +z
  const position = new Float32Array(positions)
  // Down by half its height, so its top is at 0 (added to the stored numbers, as the original does).
  for (let i = 1; i < position.length; i += 3) position[i] += -0.5 * size
  return { position, normal: new Float32Array(normals), indices }
}

/** How many boxes the field has each way. */
const boxesPerSide = (size: number) => (FIELD / size) | 0

/** The whole field: one box per cell, row by row from the far corner, each with its cell's place. */
function field(gl: WebGLRenderingContext, size: number): Shape {
  const perSide = boxesPerSide(size)
  const count = perSide * perSide
  const start = size * perSide * -0.5 - 0.5 * size
  const one = box(size)
  const corners = one.position.length / 3
  const position = new Float32Array(count * corners * 3)
  const normal = new Float32Array(count * corners * 3)
  const cell = new Float32Array(count * corners * 3)
  const index = new Uint16Array(count * one.indices.length)
  for (let n = 0; n < count; n++) {
    position.set(one.position, n * corners * 3)
    normal.set(one.normal, n * corners * 3)
    const x = (n % perSide) * size + start
    const z = ((n / perSide) | 0) * size + start
    for (let k = 0; k < corners; k++) cell.set([x, 0, z], (n * corners + k) * 3)
    for (let k = 0; k < one.indices.length; k++) index[n * one.indices.length + k] = one.indices[k] + n * corners
  }
  return createShape(gl, { aPosition: { data: position, size: 3 }, aNormal: { data: normal, size: 3 }, aCell: { data: cell, size: 3 } }, index)
}

export const create: CreateArt = (_canvas, settings, view) => {
  const gl = view.gl
  const s = { ...DEFAULTS, ...settings } as unknown as typeof DEFAULTS
  // Boxes under about 0.95 wide make a field of more corners than 16-bit triangles can number: keep the picture.
  if (boxesPerSide(s.boxSize) ** 2 * 45 > 65536) return null
  let program: Shared<Program> | undefined
  let shape: Shared<Shape>
  try {
    program = share(gl, 'isometric-program', () => createProgram(gl, VERTEX, FRAGMENT), (p) => deleteProgram(gl, p))
    shape = share(gl, `isometric-field-${s.boxSize}`, () => field(gl, s.boxSize), (f) => deleteShape(gl, f))
  } catch {
    program?.release()
    return null
  }
  const shared = { program, shape }

  const start = parseColor(s.startColor)
  const end = parseColor(s.endColor)
  const [lit, shade] = s.invertColors ? [end, start] : [start, end]
  const projection: Mat4 = identity()
  const uniforms = {
    uTime: 0,
    uField: FIELD,
    uBoxScale: [s.scaleX / 100, s.scaleY / 100, s.scaleZ / 100],
    uMorph: s.isMorphEnabled ? 1 : 0,
    uLit: lit,
    uShade: shade,
    uLightStrength: 0.01 * s.lightIntensity,
    uLight: normalize([s.lightX, s.lightY, s.lightZ]),
    uNoiseScale: 0.01 * s.noiseScale * 2,
    uNoiseRange: [0.01 * -s.noiseRange, 0.01 * s.noiseRange],
    uRise: s.positionFactor,
    uShrink: s.scaleFactor,
    uDepthShade: s.colorFactor,
    uView: lookAt([], [50, 50, 50], [0, 0, 0], [0, 1, 0]),
    uProjection: projection,
  }

  // VIEW units across the drawing's longer side, in the drawing's shape. The original sets it only when the window
  // changes size, from the drawing's size as it was just before, so its boxes stay stretched to the old shape until
  // the next change (up to 4× wide from a phone's width to a computer's). That's a fault, not copied (DECISIONS.md §5):
  // ours follows the drawing's size whenever it has changed, at the next frame.
  let fitted = [0, 0]
  const fit = () => {
    const w = view.drawWidth
    const h = view.drawHeight
    if (w === fitted[0] && h === fitted[1]) return
    fitted = [w, h]
    const [width, height] = w > h ? [VIEW, VIEW * (h / w)] : [VIEW * (w / h), VIEW]
    ortho(projection, -0.5 * width, 0.5 * width, -0.5 * height, 0.5 * height, 0, 200)
  }

  return {
    clearColor: shade,
    moves: !!s.speed,
    resize: fit,
    render() {
      fit()
      uniforms.uTime += STEP * s.speed
      draw(gl, shared.program.value, shared.shape.value, uniforms)
    },
    destroy() {
      shared.program.release()
      shared.shape.release()
    },
  }
}
