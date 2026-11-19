/**
 * The arithmetic the kinds of art share. The matrices are 4×4, column after column, as WebGL takes them, and are
 * computed as gl-matrix (MIT) computes them, operation for operation, so their numbers match the original's to the bit.
 */

export type Mat4 = number[]
export type Vec3 = readonly [number, number, number]

/** A value from one range to another. */
export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) => ((v - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin

export function identity(out: Mat4 = []): Mat4 {
  out.length = 16
  out.fill(0)
  out[0] = out[5] = out[10] = out[15] = 1
  return out
}

/** Moves by `v`, after what `m` does. */
export function translate(m: Mat4, [x, y, z]: Vec3): Mat4 {
  m[12] = m[0] * x + m[4] * y + m[8] * z + m[12]
  m[13] = m[1] * x + m[5] * y + m[9] * z + m[13]
  m[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
  m[15] = m[3] * x + m[7] * y + m[11] * z + m[15]
  return m
}

/** Turns by `rad` around the x axis. */
export function rotateX(m: Mat4, rad: number): Mat4 {
  const s = Math.sin(rad)
  const c = Math.cos(rad)
  const [a10, a11, a12, a13, a20, a21, a22, a23] = m.slice(4, 12)
  m[4] = a10 * c + a20 * s
  m[5] = a11 * c + a21 * s
  m[6] = a12 * c + a22 * s
  m[7] = a13 * c + a23 * s
  m[8] = a20 * c - a10 * s
  m[9] = a21 * c - a11 * s
  m[10] = a22 * c - a12 * s
  m[11] = a23 * c - a13 * s
  return m
}

/** Stretches by `v` along each axis. */
export function scale(m: Mat4, [x, y, z]: Vec3): Mat4 {
  for (let i = 0; i < 4; i++) {
    m[i] *= x
    m[4 + i] *= y
    m[8 + i] *= z
  }
  return m
}

/** A perspective projection: field of view `fovy` (radians, up to down), `aspect` (width / height), near and far planes. */
export function perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  identity(out)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
  out[15] = 0
  return out
}

/** A camera at `eye` looking at `center`, `up` being up. */
export function lookAt(out: Mat4, [ex, ey, ez]: Vec3, [cx, cy, cz]: Vec3, [ux, uy, uz]: Vec3): Mat4 {
  if (Math.abs(ex - cx) < 1e-6 && Math.abs(ey - cy) < 1e-6 && Math.abs(ez - cz) < 1e-6) return identity(out)
  let z0 = ex - cx
  let z1 = ey - cy
  let z2 = ez - cz
  let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2)
  z0 *= len
  z1 *= len
  z2 *= len
  let x0 = uy * z2 - uz * z1
  let x1 = uz * z0 - ux * z2
  let x2 = ux * z1 - uy * z0
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2)
  if (len) {
    len = 1 / len
    x0 *= len
    x1 *= len
    x2 *= len
  } else x0 = x1 = x2 = 0
  let y0 = z1 * x2 - z2 * x1
  let y1 = z2 * x0 - z0 * x2
  let y2 = z0 * x1 - z1 * x0
  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2)
  if (len) {
    len = 1 / len
    y0 *= len
    y1 *= len
    y2 *= len
  } else y0 = y1 = y2 = 0
  out.length = 16
  out.splice(0, 16, x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0, -(x0 * ex + x1 * ey + x2 * ez), -(y0 * ex + y1 * ey + y2 * ez), -(z0 * ex + z1 * ey + z2 * ez), 1)
  return out
}

/** What a camera with field of view `fov` (degrees, up to down) and `aspect` sees at `distance`: its width and height. */
export function visibleSize(fov: number, aspect: number, distance: number): { width: number; height: number } {
  const height = 2 * Math.tan((fov * (Math.PI / 180)) / 2) * distance
  return { width: height * aspect, height }
}

/** An orthographic projection of the box from `left` to `right`, `bottom` to `top`, `near` to `far`. */
export function ortho(out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
  const lr = 1 / (left - right)
  const bt = 1 / (bottom - top)
  const nf = 1 / (near - far)
  identity(out)
  out[0] = -2 * lr
  out[5] = -2 * bt
  out[10] = 2 * nf
  out[12] = (left + right) * lr
  out[13] = (top + bottom) * bt
  out[14] = (far + near) * nf
  return out
}

/** `v` made one long. A zero vector has no direction: NaN, which is what the original's shaders get then. */
export function normalize([x, y, z]: Vec3): [number, number, number] {
  let len = x * x + y * y + z * z
  if (!(len > 0)) return [NaN, NaN, NaN]
  len = 1 / Math.sqrt(len)
  return [x * len, y * len, z * len]
}
