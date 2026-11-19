/**
 * Small WebGL 1 helpers for the kinds of art: programs, shapes (buffers), drawing, and the resources the sections
 * drawn on the same canvas share (as the original shares its programs and shapes).
 */

/** A compiled program, and where its attributes and uniforms are. */
export interface Program {
  program: WebGLProgram
  attributes: Map<string, number>
  uniforms: Map<string, { location: WebGLUniformLocation; type: number }>
}

/** A shape: its vertex attributes (per vertex, or per instance with `divisor` 1) and its triangles. */
export interface Shape {
  attributes: Map<string, { buffer: WebGLBuffer; size: number; divisor: number }>
  index: WebGLBuffer
  count: number
}

export type UniformValue = number | readonly number[]

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`could not compile shader: ${gl.getShaderInfoLog(shader)}`)
  return shader
}

/** The float precision fragment shaders get: the best the device has (vertex shaders have highp already). */
function precision(gl: WebGLRenderingContext): string {
  const has = (p: number) => gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, p)!.precision > 0 && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, p)!.precision > 0
  return has(gl.HIGH_FLOAT) ? 'highp' : has(gl.MEDIUM_FLOAT) ? 'mediump' : 'lowp'
}

/** Compiles and links a program (throws if it can't), the fragment shader given the device's best precision. */
export function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): Program {
  const frag = fragment.startsWith('precision') ? fragment : `precision ${precision(gl)} float;\n${fragment}`
  const vs = compile(gl, gl.VERTEX_SHADER, vertex)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`could not link shader: ${gl.getProgramInfoLog(program)}`)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  const attributes = new Map<string, number>()
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i++) {
    const a = gl.getActiveAttrib(program, i)!
    attributes.set(a.name, gl.getAttribLocation(program, a.name))
  }
  const uniforms = new Map<string, { location: WebGLUniformLocation; type: number }>()
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
    const u = gl.getActiveUniform(program, i)!
    uniforms.set(u.name, { location: gl.getUniformLocation(program, u.name)!, type: u.type })
  }
  return { program, attributes, uniforms }
}

/** Puts a shape's attributes (with how many numbers each vertex has) and triangles into buffers. */
export function createShape(
  gl: WebGLRenderingContext,
  attributes: Record<string, { data: Float32Array<ArrayBuffer>; size: number; divisor?: number }>,
  index: Uint16Array<ArrayBuffer>,
): Shape {
  const buffer = (target: number, data: BufferSource) => {
    const b = gl.createBuffer()!
    gl.bindBuffer(target, b)
    gl.bufferData(target, data, gl.STATIC_DRAW)
    return b
  }
  return {
    attributes: new Map(Object.entries(attributes).map(([name, a]) => [name, { buffer: buffer(gl.ARRAY_BUFFER, a.data), size: a.size, divisor: a.divisor ?? 0 }])),
    index: buffer(gl.ELEMENT_ARRAY_BUFFER, index),
    count: index.length,
  }
}

export function deleteProgram(gl: WebGLRenderingContext, p: Program) {
  gl.deleteProgram(p.program)
}

export function deleteShape(gl: WebGLRenderingContext, s: Shape) {
  for (const a of s.attributes.values()) gl.deleteBuffer(a.buffer)
  gl.deleteBuffer(s.index)
}

function setUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation, type: number, v: UniformValue) {
  const a = v as readonly number[]
  switch (type) {
    case gl.FLOAT:
      return gl.uniform1f(location, v as number)
    case gl.FLOAT_VEC2:
      return gl.uniform2f(location, a[0], a[1])
    case gl.FLOAT_VEC3:
      return gl.uniform3f(location, a[0], a[1], a[2])
    case gl.FLOAT_VEC4:
      return gl.uniform4f(location, a[0], a[1], a[2], a[3])
    case gl.FLOAT_MAT2:
      return gl.uniformMatrix2fv(location, false, a as number[])
    case gl.FLOAT_MAT3:
      return gl.uniformMatrix3fv(location, false, a as number[])
    case gl.FLOAT_MAT4:
      return gl.uniformMatrix4fv(location, false, a as number[])
    default:
      return gl.uniform1i(location, v as number)
  }
}

/**
 * Draws a shape's triangles with a program and its uniforms' values (every uniform the program uses must have one),
 * `instances` times with the instancing extension when given. Leaves no attribute array enabled, nor any divisor set.
 */
export function draw(
  gl: WebGLRenderingContext,
  program: Program,
  shape: Shape,
  uniforms: Record<string, UniformValue>,
  instanced?: { ext: ANGLE_instanced_arrays; count: number },
) {
  gl.useProgram(program.program)
  const enabled: number[] = []
  for (const [name, location] of program.attributes) {
    const a = shape.attributes.get(name)
    if (!a) continue
    gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, a.size, gl.FLOAT, false, 0, 0)
    instanced?.ext.vertexAttribDivisorANGLE(location, a.divisor)
    enabled.push(location)
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.index)
  for (const [name, { location, type }] of program.uniforms) setUniform(gl, location, type, uniforms[name])
  if (instanced) instanced.ext.drawElementsInstancedANGLE(gl.TRIANGLES, shape.count, gl.UNSIGNED_SHORT, 0, instanced.count)
  else gl.drawElements(gl.TRIANGLES, shape.count, gl.UNSIGNED_SHORT, 0)
  for (const location of enabled) {
    instanced?.ext.vertexAttribDivisorANGLE(location, 0)
    gl.disableVertexAttribArray(location)
  }
}

interface SharedEntry {
  value: unknown
  users: number
  free: () => void
}
const sharedByContext = new WeakMap<WebGLRenderingContext, Map<string, SharedEntry>>()

/** A shared resource, and how to let it go. */
export interface Shared<T> {
  value: T
  release(): void
}

/**
 * A resource the sections drawn on the same canvas share (a program, a shape), under a name: made by the first that
 * asks, freed when the last lets it go.
 */
export function share<T>(gl: WebGLRenderingContext, name: string, make: () => T, free: (value: T) => void): Shared<T> {
  let all = sharedByContext.get(gl)
  if (!all) sharedByContext.set(gl, (all = new Map()))
  let entry = all.get(name)
  if (!entry) {
    const value = make()
    entry = { value, users: 0, free: () => free(value) }
    all.set(name, entry)
  }
  entry.users++
  const mine = entry
  let released = false
  return {
    value: mine.value as T,
    release() {
      if (released) return
      released = true
      if (--mine.users > 0) return
      mine.free()
      if (all.get(name) === mine) all.delete(name)
    },
  }
}

/** Forgets a canvas's shared resources (they're gone when its context was lost). */
export function forgetShared(gl: WebGLRenderingContext) {
  sharedByContext.delete(gl)
}
