/**
 * Runs the page's animated backgrounds the way the original's code does, so that they look and move the same: when
 * each one is drawn, at what size, on which canvas, with which clock.
 *
 * - The art is drawn with WebGL on at most four shared canvases ("stages"); the sections take them in turn, in the
 *   order they start. Each section is drawn into the top left corner of its stage, sized to the section times the
 *   pixel ratio (min(1.5, devicePixelRatio)).
 * - One clock (requestAnimationFrame) drives them all. On each frame a section is drawn if it's on screen and
 *   playing, or if it must be drawn once: when it starts, when its size changes, when it comes on screen paused.
 * - A section drawing alone on its stage shows the stage's canvas itself, moved into the section; when several draw
 *   on one stage, each drawing is copied into the section's own canvas.
 * - When frames come too slowly (more than 60 ms on average), a stage draws smaller, in steps, and back up when they
 *   come quickly again (under 40 ms).
 * - A section starts paused for visitors who ask for less motion, or who paused the art before (remembered in this
 *   browser); pausing one pauses all.
 *
 * Each kind of art (conic.ts, bokeh.ts, …) draws one frame when asked (types.ts). The React side is ArtBackground.tsx.
 */
import type { GenerativeSettings } from '~/content/types'
import { resolveSettings } from './colors'
import { forgetShared } from './gl'
import { KINDS } from './kinds'
import type { ArtRenderer, ArtSettings, ArtView, CreateArt } from './types'

/** How much smaller a stage draws, step by step, when frames come too slowly. */
const SCALES = [1, 0.79, 0.62, 0.5, 0.4, 0.31, 0.25]
const MAX_STEP = 3
/** The most stages (WebGL canvases) a page keeps. */
const STAGES = 4
/** The stages' WebGL settings. */
const ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: true,
  failIfMajorPerformanceCaveat: true,
}
const WHITE = [1, 1, 1, 1] as const
/** Where this browser remembers that the visitor paused the art. */
const PAUSED_KEY = 'edubud-bgfx-prefer-paused'

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)

let stagesMade = 0

/** One shared WebGL canvas, and the sections drawn on it. */
class Stage {
  /** Its number, in the order the page made them (shown on its sections as `data-stage`). */
  readonly id = stagesMade++
  readonly canvas = document.createElement('canvas')
  readonly gl: WebGLRenderingContext | null
  readonly pieces: Piece[] = []
  /** The canvas's size, in canvas pixels: the largest section's on this stage. */
  width = 0
  height = 0
  /** How much smaller it draws (SCALES), and the average time between frames that decides it. */
  step = 0
  frameTime = 50
  drewLastFrame = false
  /** More than one section draws on it this frame. */
  several = false

  constructor() {
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0' })
    this.gl = (this.canvas.getContext('webgl', ATTRIBUTES) ?? this.canvas.getContext('experimental-webgl', ATTRIBUTES)) as WebGLRenderingContext | null
    // A lost context (the browser reclaims it) comes back empty: the kinds start again on it.
    this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
    this.canvas.addEventListener('webglcontextrestored', () => {
      if (this.gl) forgetShared(this.gl)
      this.pieces.forEach((p) => p.recreate())
    })
  }

  get lost(): boolean {
    return !this.gl || this.gl.isContextLost()
  }

  add(p: Piece) {
    p.updateSize()
    p.setDrawSize(...this.scaled(p))
    this.pieces.push(p)
    p.node.dataset.stage = String(this.id)
  }

  remove(p: Piece) {
    const i = this.pieces.indexOf(p)
    if (i === -1) return
    this.pieces.splice(i, 1)
    p.detach()
  }

  /** One frame: `time` for the art, `step` the time since the last frame. */
  tick(time: number, step: number) {
    if (this.drewLastFrame) {
      this.adjustScale(step)
      this.drewLastFrame = false
    }
    this.countDrawing()
    this.fit()
    if (this.width === 0 || this.height === 0) return
    for (const p of this.pieces) {
      if (!p.forceDraw && !p.active) continue
      if (p.moves) p.dirty = true
      this.draw(p, time)
    }
  }

  private adjustScale(step: number) {
    const before = this.step
    this.frameTime += clamp(0.2 * (step - this.frameTime), -5, 5)
    if (this.frameTime > 60) this.step++
    else if (this.frameTime < 40 && this.step > 0) this.step--
    this.step = Math.min(this.step, MAX_STEP)
    if (before !== this.step) this.frameTime = 50
  }

  /** Whether several sections draw this frame; the one showing the canvas gets a copy of its drawing when that changes. */
  private countDrawing() {
    let drawing = 0
    let holder: Piece | undefined
    for (const p of this.pieces) {
      if (p.active || p.forceDraw) drawing++
      if (p.node === this.canvas.parentElement) holder = p
    }
    const several = drawing > 1
    if (holder && ((several && !this.several) || !holder.active)) {
      this.copy(holder, ...this.scaled(holder))
      holder.detach()
      holder.show()
    }
    this.several = several
  }

  /** The canvas's size: the largest section's. */
  private fit() {
    const scale = SCALES[this.step]
    let width = 0
    let height = 0
    for (const p of this.pieces) {
      width = Math.max(width, Math.ceil(p.width * p.pixelRatio * scale))
      height = Math.max(height, Math.ceil(p.height * p.pixelRatio * scale))
    }
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    if (this.lost) return
    this.canvas.width = width
    this.canvas.height = height
    this.gl!.viewport(0, 0, width, height)
  }

  private draw(p: Piece, time: number) {
    if (!p.forceDraw && !(p.active && p.dirty)) return
    const gl = this.gl!
    const [width, height] = this.scaled(p)
    gl.viewport(0, this.height - height, width, height)
    const [r, g, b, a] = p.renderer?.clearColor ?? WHITE
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
    p.setDrawSize(width, height)
    p.viewport = [0, this.height - height, p.drawWidth, p.drawHeight]
    if (!this.lost) p.renderer?.render(time)
    if (this.several) {
      this.copy(p, width, height)
      p.show()
    } else {
      this.canvas.style.width = `${Math.ceil(this.width / (p.pixelRatio * SCALES[this.step]))}px`
      this.canvas.style.height = `${Math.ceil(this.height / (p.pixelRatio * SCALES[this.step]))}px`
      p.attach(this.canvas)
      p.hide()
    }
    p.dirty = false
    p.forceDraw = false
    this.drewLastFrame = true
    p.drew()
  }

  /** Copies a section's drawing (the canvas's top left corner) into the section's own canvas. */
  copy(p: Piece, width: number, height: number) {
    const ctx = p.canvas.getContext('2d')
    const { width: w, height: h } = p.canvas
    if (!ctx || !width || !height || !w || !h) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.canvas, 0, 0, width, height, 0, 0, w, h)
  }

  /** A section's drawing size at this stage's scale. */
  scaled(p: Piece): [number, number] {
    const scale = SCALES[this.step]
    return [Math.ceil(p.width * p.pixelRatio * scale), Math.ceil(p.height * p.pixelRatio * scale)]
  }
}

// The stages in use, and the ones put aside (kept for the next sections, as the original does).
const stages: Stage[] = []
const spare: Stage[] = []
let placed = 0
let ticking = false
let frame = 0
let lastFrame = 0

/** One frame for every stage. Its timestamp (ms since the page started) is the art's clock, as on the original. */
function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const step = now - lastFrame
  lastFrame = now
  for (const s of stages) s.tick(now, step)
}

/** Puts a section on the next stage in turn (a new one up to four, then the first again…). */
function place(p: Piece): Stage | null {
  if (!ticking) {
    lastFrame = performance.now()
    frame = requestAnimationFrame(tick)
    ticking = true
  }
  let stage = stages[placed % STAGES]
  if (!stage) {
    const reused = spare.pop()
    stage = reused && !reused.lost ? reused : new Stage()
    if (stage.lost) {
      if (!stages.length) {
        cancelAnimationFrame(frame)
        ticking = false
      }
      return null
    }
    stages.push(stage)
  }
  stage.add(p)
  placed++
  return stage
}

function unplace(p: Piece) {
  const stage = stages.find((s) => s.pieces.includes(p))
  if (!stage) return
  stage.remove(p)
  placed--
  if (!stage.pieces.length) {
    stages.splice(stages.indexOf(stage), 1)
    spare.push(stage)
  }
  if (stages.every((s) => !s.pieces.length)) {
    cancelAnimationFrame(frame)
    ticking = false
  }
}

let webgl: boolean | undefined
/** Whether this browser draws WebGL well enough (not on a slow fallback): the original draws no art otherwise. */
function webglWorks(): boolean {
  if (webgl === undefined) {
    const gl = (document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true }) ??
      document.createElement('canvas').getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })) as WebGLRenderingContext | null
    webgl = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  return webgl
}

let reduceMotion: boolean | undefined
/** The art starts paused for visitors who ask for less motion, or who paused it before. */
function startsPaused(): boolean {
  reduceMotion ??= matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    return reduceMotion || !!localStorage.getItem(PAUSED_KEY)
  } catch {
    return reduceMotion
  }
}

/** What a section's art tells the page: whether it runs, moves and is paused, and when it's first drawn. */
export interface ArtEvents {
  changed(state: { running: boolean; moves: boolean; paused: boolean }): void
  drawn(): void
}

/** One section's art: its own canvas, its place on a stage, its renderer, and whether it's on screen and playing. */
class Piece implements ArtView {
  readonly canvas = document.createElement('canvas')
  readonly pixelRatio: number
  width = 0
  height = 0
  drawWidth = 0
  drawHeight = 0
  viewport: [number, number, number, number] = [0, 0, 0, 0]
  /** Drawn every frame (on screen and playing); must be drawn once; has changed since it was last drawn. */
  active = false
  forceDraw = false
  dirty = true
  paused: boolean
  onScreen = false
  renderer: ArtRenderer | null = null
  stage: Stage | null = null
  private attached: HTMLCanvasElement | null = null
  private observers: { disconnect(): void }[] = []
  private drawnOnce = false

  constructor(
    readonly node: HTMLElement,
    private readonly settings: ArtSettings,
    private readonly create: CreateArt,
    private readonly events: ArtEvents,
  ) {
    this.pixelRatio = settings.pixelRatio as number
    this.paused = startsPaused()
  }

  get gl(): WebGLRenderingContext {
    return this.stage!.gl!
  }

  get moves(): boolean {
    return this.renderer?.moves ?? true
  }

  /** Starts drawing; false when it can't. */
  start(): boolean {
    if (!webglWorks()) return false
    this.node.style.overflow = 'hidden'
    Object.assign(this.canvas.style, { display: 'block', position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' })
    this.node.replaceChildren(this.canvas)
    this.stage = place(this)
    if (!this.stage) return false
    this.updateSize()
    try {
      this.renderer = this.create(this.stage.canvas, this.settings, this)
    } catch (e) {
      console.error(e)
    }
    if (!this.renderer) {
      unplace(this)
      this.canvas.remove()
      return false
    }
    this.refresh()
    const io = new IntersectionObserver((entries) => entries.forEach((e) => this.setOnScreen(e.isIntersecting)), { rootMargin: '0px 0px 0px 0px' })
    io.observe(this.node)
    const ro = new ResizeObserver(() => this.refresh())
    ro.observe(this.node)
    this.observers = [io, ro]
    pieces.add(this)
    this.changed()
    return true
  }

  /** Stops drawing, and empties the section's box. */
  destroy() {
    this.observers.forEach((o) => o.disconnect())
    pieces.delete(this)
    unplace(this)
    this.renderer?.destroy()
    this.renderer = null
    this.node.replaceChildren()
  }

  /** Starts the renderer again on the same stage (after the browser lost and restored the canvas's context). */
  recreate() {
    this.renderer?.destroy()
    this.renderer = this.stage ? this.create(this.stage.canvas, this.settings, this) : null
    if (this.renderer) this.refresh()
    this.forceDraw = true
  }

  updateSize() {
    const { offsetWidth: width, offsetHeight: height } = this.node
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.forceDraw = true
  }

  /** Checks the section's size, and tells the renderer. */
  refresh() {
    this.updateSize()
    this.renderer?.resize(this.width, this.height, this.pixelRatio)
  }

  setDrawSize(width: number, height: number) {
    if (width === this.drawWidth && height === this.drawHeight) return
    this.drawWidth = width
    this.drawHeight = height
    this.canvas.width = width
    this.canvas.height = height
  }

  setOnScreen(onScreen: boolean) {
    this.onScreen = onScreen
    this.updatePlay()
    if (this.onScreen && this.paused) this.forceDraw = true
  }

  setPaused(paused: boolean) {
    this.paused = paused
    this.updatePlay()
    this.changed()
  }

  private updatePlay() {
    this.active = this.onScreen && !this.paused
  }

  attach(canvas: HTMLCanvasElement) {
    if (canvas.parentElement === this.node) return
    this.node.appendChild(canvas)
    this.attached = canvas
  }

  detach() {
    if (this.attached && this.attached.parentElement === this.node) {
      this.node.removeChild(this.attached)
      this.attached = null
    }
  }

  show() {
    this.canvas.style.display = 'block'
  }

  hide() {
    this.canvas.style.display = 'none'
  }

  drew() {
    if (this.drawnOnce) return
    this.drawnOnce = true
    this.events.drawn()
  }

  changed() {
    this.events.changed({ running: true, moves: this.moves, paused: this.paused })
  }
}

/** The art running on the page, which a pause button pauses together. */
const pieces = new Set<Piece>()

/** Pauses or plays a section's art, as its pause button does: pausing it pauses all, and the browser remembers. */
function togglePaused(p: Piece) {
  p.setPaused(!p.paused)
  try {
    if (p.paused) localStorage.setItem(PAUSED_KEY, 'true')
    else localStorage.removeItem(PAUSED_KEY)
  } catch {
    // (No storage: nothing is remembered.)
  }
  if (p.paused) for (const other of pieces) if (other !== p) other.setPaused(true)
}

interface Request {
  node: HTMLElement
  settings: GenerativeSettings
  events: ArtEvents
  piece?: Piece
  stopped?: boolean
}

let waiting: Request[] = []
let queue = Promise.resolve()

/**
 * Starts a section's art. Sections start in a fixed order, one the original also takes (it starts each kind's
 * sections, in page order, as soon as that kind's code has loaded): kinds in the order they first appear on the page.
 * The order decides which sections share a stage. Returns how to stop it, and to pause or play it.
 */
export function startArt(node: HTMLElement, settings: GenerativeSettings, events: ArtEvents) {
  const request: Request = { node, settings, events }
  if (!waiting.length) queueMicrotask(startWaiting)
  waiting.push(request)
  return {
    stop() {
      request.stopped = true
      request.piece?.destroy()
      request.piece = undefined
    },
    togglePaused() {
      if (request.piece) togglePaused(request.piece)
    },
  }
}

/** Starts the sections that asked since the last time (a page's, together), kind by kind. */
function startWaiting() {
  const batch = waiting.filter((r) => !r.stopped && r.node.isConnected)
  waiting = []
  batch.sort((a, b) => (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  const order = [...new Set(batch.map((r) => r.settings.type))]
  const loads = new Map(order.map((type) => [type, KINDS[type]?.().catch(() => null) ?? Promise.resolve(null)]))
  queue = queue
    .then(async () => {
      for (const type of order) {
        const kind = await loads.get(type)!
        for (const r of batch) {
          if (r.settings.type !== type || r.stopped) continue
          const piece = kind && new Piece(r.node, resolveSettings(r.settings, Math.min(1.5, devicePixelRatio)), kind.create, r.events)
          if (piece?.start()) r.piece = piece
          else r.events.changed({ running: false, moves: false, paused: false })
        }
      }
    })
    .catch((e) => console.error(e))
}
