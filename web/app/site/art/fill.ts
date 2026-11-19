/**
 * For kinds drawn by one fragment shader over the whole drawing (gradient, contours): the original's "big triangle",
 * one triangle twice the drawing's size that covers it with no seam, and a vertex shader that gives each pixel its
 * place. Its three corners, in this order, are the original's, so every pixel's place comes out as on the original.
 */
import { createShape, deleteShape, share, type Shape, type Shared } from './gl'

/** `vUv`: the pixel's place in the drawing, from (0, 0) at its bottom left to (1, 1) at its top right. */
export const FILL_VERTEX = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

/** The triangle, which the sections drawn on the same canvas share (under the original's name for it). */
export function bigTriangle(gl: WebGLRenderingContext): Shared<Shape> {
  return share(
    gl,
    'big-triangle',
    () => createShape(gl, { aPosition: { data: new Float32Array([-1, -1, -1, 3, 3, -1]), size: 2 } }, new Uint16Array([0, 1, 2])),
    (shape) => deleteShape(gl, shape),
  )
}
