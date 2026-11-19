/**
 * The animated backgrounds ("generative art") the original draws live in some sections, and how one kind of art
 * (conic.ts, bokeh.ts, …) plugs into the part that runs them all (stage.ts, ArtBackground.tsx), which works as the
 * original's does.
 *
 * As on the original, every kind draws with WebGL 1 into a canvas it shares with other sections' art: the page keeps
 * at most four of them. A section's art is drawn into the top left corner of its canvas (`ArtView.viewport`), then
 * shown: the canvas itself is moved into the section when the section is the only one on it drawing, or the drawing
 * is copied into the section's own canvas.
 */

/** A section's art settings as the original stores them (`data-current-styles` → `generative`), colors resolved to CSS colors. */
export type ArtSettings = { type: string } & Record<string, unknown>

/** What the page tells a kind about the section it draws in, kept up to date: the original's fields of the same meaning. */
export interface ArtView {
  /** The shared canvas's WebGL 1 context (`canvas.getContext('webgl')` gives the same). */
  readonly gl: WebGLRenderingContext
  /**
   * The section's box the art is shown in (the original's `node`): `node.closest('section')` is where a kind listens
   * to the mouse (the box itself gets no pointer events, as on the original).
   */
  readonly node: HTMLElement
  /** The section's size in CSS pixels. */
  readonly width: number
  readonly height: number
  /** The pixel ratio the art is drawn at: min(1.5, devicePixelRatio) when it started, as on the original. */
  readonly pixelRatio: number
  /**
   * The drawing's size in canvas pixels: the original's `canvas.width` and `canvas.height`. It changes only when a
   * frame is drawn, so during `resize()` it's still the size of the last frame, before the resize (the original's
   * kinds read it then, and keep the shape they had until the next resize).
   */
  readonly drawWidth: number
  readonly drawHeight: number
  /** Where this frame goes in the canvas, in canvas pixels from its bottom left: gl.viewport's x, y, width, height (the original's `uViewport`). */
  readonly viewport: readonly [number, number, number, number]
}

/** One kind of art drawing into one canvas. */
export interface ArtRenderer {
  /**
   * The canvas's size in CSS pixels, and the pixel ratio to draw at: the section's. Called when the art starts and
   * each time the section's size is checked (it may not have changed), when the original calls its kinds' `onRefresh`.
   */
  resize(width: number, height: number, pixelRatio: number): void
  /**
   * Draws the frame for `time`: the frame's requestAnimationFrame timestamp, in milliseconds since the page started
   * (paused time counted). That's the clock the original's kinds read: a kind that moves with time keeps a timer
   * starting at 0, so its first step is the whole timestamp (conic, bokeh, surface); a kind that moves by frames
   * steps once per call (gradient, contours, isometric). Called on each frame the original updates and draws the
   * art: once when it starts, every frame while it's on screen and playing (if it `moves`), and when it's resized or
   * comes on screen while paused.
   *
   * The canvas has been cleared with `clearColor` and its viewport set to `view.viewport`. Don't resize the canvas,
   * change its viewport or clear it; set the GL state you need as the original's kind does (another kind may have
   * drawn in the same canvas before, and the context keeps what it left); leave no vertex attribute array enabled.
   */
  render(time: number): void
  /** Lets go of everything it holds: its programs, buffers and textures (never the shared context). */
  destroy(): void
  /** The color the canvas is cleared with before each frame, from 0 to 1 (the original's `clearColor`); white when not given. */
  readonly clearColor?: readonly [number, number, number, number]
  /** Whether the art moves (the original's `autoUpdate`): art that doesn't is drawn only when needed, and has no pause button. True when not given. */
  readonly moves?: boolean
}

/** Starts a kind's renderer on a canvas (the shared one, see above), or returns null when the browser can't draw it. */
export type CreateArt = (canvas: HTMLCanvasElement, settings: ArtSettings, view: ArtView) => ArtRenderer | null
