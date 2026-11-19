/**
 * A picture an effect draws (parallax.ts on a section's, filmGrain.ts on an image block's), as the original's effects
 * on pictures draw theirs: the page's own <img> as a texture, over the effect's box as CSS's `object-fit: cover` puts
 * it, cut evenly around its focal point, and loaded into the texture again each time the browser loads another of its
 * files (a wider one, after the window grows).
 */

/** The vertex shader of an effect that draws the picture as it covers the box: `vUv` is each pixel's place in it. */
export const COVER_VERTEX = /* glsl */ `
attribute vec2 aPosition;

uniform mat3 uCover;   // the picture over the box (PictureTexture.cover)

varying vec2 vUv;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vUv = (uCover * vec3(aPosition * 0.5 + 0.5, 1.0)).xy;
}
`

/** The focal point as a section's picture gives it (`data-image-focal-point`, from its top left); the middle if it has none. */
export function dataFocalPoint(img: HTMLImageElement): [number, number] {
  const [x, y] = img.dataset.imageFocalPoint?.split(',') ?? []
  return x && y ? [+x, +y] : [0.5, 0.5]
}

/** The focal point as an image block's effect takes it: where CSS places the picture (its `object-position`, in percent). */
export function styleFocalPoint(img: HTMLImageElement): [number, number] {
  const [x, y] = getComputedStyle(img).objectPosition.split(' ')
  return [parseFloat(x) / 100, parseFloat(y) / 100]
}

export interface PictureTexture {
  /**
   * The picture over the box, as a 3×3 matrix (column after column) from the box's 0–1 coordinates (from its bottom
   * left) to the picture's: the shaders' `uCover`, which fit() keeps up to date.
   */
  readonly cover: number[]
  /** Fits the picture to a box of this size (in CSS pixels). */
  fit(width: number, height: number): void
  /** Binds the texture to unit 0, loading the picture into it first if it's new. */
  bind(): void
  destroy(): void
}

/**
 * The picture `img` (loaded) as a texture, with its focal point (0 to 1 across it from its top left). `reloaded`
 * hears each time the browser loads another of its files; the texture takes it before its next drawing.
 */
export function pictureTexture(gl: WebGLRenderingContext, img: HTMLImageElement, focal: readonly [number, number], reloaded: () => void): PictureTexture {
  const texture = gl.createTexture()
  const cover = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  let upload = true
  const reload = () => {
    upload = true
    reloaded()
  }
  img.addEventListener('load', reload)
  return {
    cover,
    // (The picture's shape is its size on the page: its file's, divided by the density the browser picked it for,
    // rounded down. The arithmetic is the original's, step for step.)
    fit(width, height) {
      const w = img.naturalWidth
      const h = img.naturalHeight
      let sx = 1
      let sy = 1
      if (w / h > width / height) sx = (width * h) / (height * w)
      else sy = (height * w) / (width * h)
      const ox = ((sx - 1) / 2) * -1
      const oy = ((sy - 1) / 2) * -1
      cover[0] = sx
      cover[4] = sy
      cover[6] = ox + (focal[0] - 0.5) * ox * 2
      cover[7] = oy + (0.5 - focal[1]) * oy * 2
    },
    bind() {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      if (!upload) return
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      upload = false
    },
    destroy() {
      img.removeEventListener('load', reload)
      gl.deleteTexture(texture)
    },
  }
}
