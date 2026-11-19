// The capture's pictures and videos: each picture in the widths Squarespace serves (so a browser picks the same file
// the original shows), each background video in its full size, saved under web/public/media/.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Picture, VideoFile } from '../../web/app/content/types'

const run = promisify(execFile)

/** The widths Squarespace makes of every picture. */
export const WIDTHS = [100, 300, 500, 750, 1000, 1500, 2500]
/** What Chrome asks for, so the server answers with the format the original's visitors get. */
const ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'

type Job = { kind: 'image'; url: string; dir: string; widths: number[] } | { kind: 'video'; url: string; dir: string; audio: boolean }
export const mediaQueue = new Map<string, Job>()

/** A short, stable folder name for an asset: its UUID's first 12 characters. */
function assetId(url: string): string {
  const m = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i)
  if (m) return m[1].replace(/-/g, '').slice(0, 12)
  const m2 = url.match(/\/(\d{13}-[A-Z0-9]{20})\//)
  if (m2) return m2[1].toLowerCase().replace(/-/g, '').slice(0, 16)
  return Buffer.from(url).toString('base64url').slice(-16)
}

/** Registers a picture to download and says how the copy refers to it. Its format is known once downloaded. */
export function picture(url: string, info: { width: number; height: number; alt: string; focal?: [number, number]; fixed?: boolean }): Picture {
  const clean = (url.startsWith('//') ? 'https:' + url : url).split('?')[0]
  const id = assetId(clean)
  const dir = `media/${id}`
  if (!mediaQueue.has(dir)) mediaQueue.set(dir, { kind: 'image', url: clean, dir, widths: WIDTHS })
  return {
    base: `/${dir}`,
    ext: '{ext}',
    widths: WIDTHS,
    width: info.width,
    height: info.height,
    alt: info.alt,
    ...(info.focal ? { focal: info.focal } : {}),
  }
}

/** Registers a Squarespace video (its `{variant}` URL) to download whole, as an MP4 (with its sound for a video block). */
export function video(alexandriaUrl: string, width: number, height: number, audio = false): VideoFile {
  const base = alexandriaUrl.replace('/{variant}', '')
  const id = assetId(base + '/')
  const dir = `media/${id}`
  if (!mediaQueue.has(dir)) mediaQueue.set(dir, { kind: 'video', url: base, dir, audio })
  return { src: `/${dir}/video.mp4`, poster: undefined, width, height }
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/avif': 'avif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' }

/** The format each picture folder ended up in, for the content files' `{ext}`. */
export const formats = new Map<string, string>()

export async function downloadMedia(publicDir: string) {
  const jobs = [...mediaQueue.values()]
  let bytes = 0
  let files = 0
  await pool(jobs, 8, async (job) => {
    const dir = path.join(publicDir, job.dir)
    await mkdir(dir, { recursive: true })
    if (job.kind === 'image') {
      for (const w of job.widths) {
        const known = ['webp', 'avif', 'jpg', 'png', 'gif'].find((e) => existsSync(path.join(dir, `${w}.${e}`)))
        if (known) {
          formats.set(job.dir, known)
          continue
        }
        const res = await fetch(`${job.url}?format=${w}w`, { headers: { accept: ACCEPT } }).catch((e: Error) => ({ ok: false, status: e.message }) as unknown as Response)
        if (!res.ok) {
          console.warn(`  ! ${job.url}?format=${w}w: HTTP ${res.status}`)
          continue
        }
        const ext = EXT[(res.headers.get('content-type') ?? '').split(';')[0]] ?? 'bin'
        const buf = Buffer.from(await res.arrayBuffer())
        await writeFile(path.join(dir, `${w}.${ext}`), buf)
        formats.set(job.dir, ext)
        bytes += buf.length
        files++
      }
    } else {
      const out = path.join(dir, 'video.mp4')
      if (existsSync(out)) return
      const master = await (await fetch(`${job.url}/playlist.m3u8`)).text()
      // The largest variant: its stream's playlist follows its #EXT-X-STREAM-INF line.
      const lines = master.split('\n')
      let best = { res: 0, url: '' }
      lines.forEach((l, i) => {
        const m = l.match(/RESOLUTION=(\d+)x(\d+)/)
        if (m && Number(m[1]) * Number(m[2]) > best.res) best = { res: Number(m[1]) * Number(m[2]), url: lines[i + 1].trim() }
      })
      if (!best.url) {
        console.warn(`  ! ${job.url}: no stream in its playlist`)
        return
      }
      try {
        // Squarespace's segments have no file extension, which ffmpeg's HLS reader refuses unless told not to check.
        const hls = ['-extension_picky', '0', '-allowed_extensions', 'ALL']
        const audioUrl = master.match(/TYPE=AUDIO[^\n]*URI="([^"]+)"/)?.[1]
        const inputs = job.audio && audioUrl ? [...hls, '-i', best.url, ...hls, '-i', audioUrl] : [...hls, '-i', best.url]
        const maps = job.audio && audioUrl ? ['-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0']
        await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...maps, '-c', 'copy', '-movflags', '+faststart', out])
      } catch (e) {
        console.warn(`  ! ${job.url}: ${(e as Error).message.split('\n').slice(-3).join(' ')}`)
        return
      }
      const thumb = await fetch(`${job.url}/thumbnail`)
      if (thumb.ok) await writeFile(path.join(dir, 'poster.jpg'), Buffer.from(await thumb.arrayBuffer()))
      files++
    }
  })
  console.log(`media: ${files} files downloaded (${(bytes / 1e6).toFixed(1)} MB of pictures), ${jobs.length} assets`)
}
