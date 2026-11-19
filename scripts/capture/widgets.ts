/**
 * The widgets' content, read from the original's pages into web/app/content/widgets.json, keyed by block id: the
 * Instagram feed's posts (their pictures saved under web/public/media/), the map's place, the donation form's settings
 * and the videos' details. The page files (capture.ts) say where each block sits; this file says what it shows, and
 * our components draw it (web/app/site/blocks/). Like capture.ts, it reads EduBud's content, never Squarespace's code.
 *
 *   npx tsx scripts/capture/widgets.ts             # from the cached pages (scripts/capture/.cache)
 *   npx tsx scripts/capture/widgets.ts --refresh   # fetch the pages from edubud.org again first
 *
 * The feed's posts are the ones the original shows today: Squarespace keeps a copy of each Instagram post, so the
 * capture takes them once, and the copy shows them as they were captured until this script runs again.
 */
import { parseHTML } from 'linkedom'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchHtml } from './capture'
import { downloadMedia, picture } from './media'
import type { Picture } from '../../web/app/content/types'

const ROOT = path.resolve(import.meta.dirname, '../..')
const PUBLIC = path.join(ROOT, 'web/public')
const OUT = path.join(ROOT, 'web/app/content/widgets.json')

/** The pages with widgets. */
const PAGES = ['/our-team', '/day-learning-program', '/support-us', '/blue-bridge-project', '/golden-bridge-project']

const json = (raw: string | null | undefined): any => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The iframe inside an attribute that holds HTML (Squarespace's `data-html`). */
function embeddedIframe(html: string): Element | null {
  return parseHTML(`<!doctype html><html><body><div>${html}</div></body></html>`).document.querySelector('iframe')
}

const dims = (el: Element | null) => (el?.getAttribute('data-image-dimensions') ?? '0x0').split('x').map(Number) as [number, number]
const focal = (el: Element | null): [number, number] | undefined => {
  const f = (el?.getAttribute('data-image-focal-point') ?? '').split(',').map(Number)
  return f.length === 2 && f.every((n) => !Number.isNaN(n)) ? [f[0], f[1]] : undefined
}

/** The Instagram feed: Squarespace draws it as a gallery grid of the posts it copied, each opening in a lightbox. */
function instagram(block: Element) {
  const cfg = json(block.getAttribute('data-block-json')) ?? {}
  const posts = [...block.querySelectorAll('.sqs-gallery .slide')].map((slide) => {
    const kind = slide.getAttribute('data-type') === 'video' ? 'video' : 'image'
    if (kind === 'video') {
      const opener = slide.querySelector('.js-gallery-lightbox-opener')
      const wrapper = slide.querySelector('.sqs-video-wrapper')
      const iframe = embeddedIframe(wrapper?.getAttribute('data-html') ?? '')
      const img = slide.querySelector('.sqs-video-overlay img')
      const [width, height] = dims(img)
      const src = iframe?.getAttribute('src') ?? ''
      return {
        kind,
        picture: picture(img?.getAttribute('data-src') ?? '', { width, height, alt: '', focal: focal(img) }),
        description: opener?.getAttribute('data-description') ?? '',
        // The post on Instagram, and the player Instagram gives for embedding it (the lightbox shows it).
        href: src.replace(/embed\/?$/, ''),
        embed: { src, width: Number(iframe?.getAttribute('width') ?? 612), height: Number(iframe?.getAttribute('height') ?? 710) },
      }
    }
    const a = slide.querySelector('a.image-slide-anchor')
    const img = slide.querySelector('img.thumb-image')
    const [width, height] = dims(img)
    return {
      kind,
      picture: picture(img?.getAttribute('data-src') ?? img?.getAttribute('data-image') ?? '', { width, height, alt: img?.getAttribute('alt') ?? '', focal: focal(img) }),
      description: a?.getAttribute('data-description') ?? '',
    }
  })
  return {
    design: cfg.design ?? 'grid',
    /** Squarespace's grid: this many a row from 641 px wide, two below (its gallery's own breakpoint). */
    perRow: Number(cfg['thumbnails-per-row'] ?? 4),
    aspectRatio: { 'three-four-vertical': '3 / 4', 'square': '1 / 1', 'four-three-standard': '4 / 3', 'three-two-standard': '3 / 2', 'sixteen-nine-wide': '16 / 9' }[String(cfg['aspect-ratio'])] ?? '1 / 1',
    gap: Number(cfg.padding ?? 0),
    lightbox: cfg.lightbox !== false,
    lightboxTheme: cfg.lightboxTheme ?? 'dark',
    posts,
  }
}

/** The map: its place and how it's drawn (Squarespace's own Google map: no controls, the default red pin). */
function map(block: Element) {
  const ctx = json(block.querySelector('[data-context]')?.getAttribute('data-context')) ?? {}
  const loc = ctx.location ?? {}
  const anim = (ctx.animations ?? [])[0]
  const from = anim?.transforms?.[0]
  return {
    lat: loc.mapLat ?? loc.markerLat,
    lng: loc.mapLng ?? loc.markerLng,
    zoom: loc.mapZoom ?? 13,
    place: [loc.addressTitle, loc.addressLine1, loc.addressLine2, loc.addressCountry].filter(Boolean),
    style: ctx.style,
    controls: Boolean(ctx.controls),
    labels: ctx.labels !== false,
    terrain: Boolean(ctx.terrain),
    // The block's "appear" animation: it grows from this scale when it scrolls into view.
    appear: anim
      ? {
          scale: (from?.scale?.x?.value ?? 100) / 100,
          opacity: (from?.opacity?.value ?? 100) / 100,
          duration: anim.duration?.value ?? 0.7,
          delay: anim.delay?.value ?? 0,
          ease: anim.ease,
          bounce: anim.bounce,
          replay: Boolean(anim.replay),
        }
      : undefined,
  }
}

/** The donation form's settings, as its block carries them (the fund, amounts, frequencies, the fee, the words). */
function donation(block: Element) {
  const ctx = json(block.querySelector('[data-block-context]')?.getAttribute('data-block-context')) ?? {}
  const content = ctx.resolvedDonationContent ?? {}
  const fund = content.resolvedFunds?.[0] ?? {}
  const s = ctx.localizedStrings ?? {}
  const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]))
  return {
    buttonText: ctx.buttonText ?? 'Donate',
    buttonVariant: ctx.donateButtonVariant ?? 'primary',
    buttonAlignment: ctx.donateButtonAlignment ?? 'left',
    amountAlignment: ctx.donationAmountAlignment ?? 'left',
    container: ctx.containerStyles,
    fund: {
      name: fund.name,
      customAmount: Boolean(fund.isCustomAmountEnabled),
      amounts: (fund.suggestedContributions ?? []).map((c: { amount: number; formattedAmount: string }) => ({ cents: c.amount, label: c.formattedAmount })),
      frequencies: ['ONE_TIME', ...(fund.recurringDonationOptions ?? []).map((o: { frequency: string }) => o.frequency)],
      defaultFrequency: fund.defaultDonationFrequency ?? 'ONE_TIME',
      coverTheFee: fund.coverTheFeeSettings?.isEnabled
        ? { percent: fund.coverTheFeeSettings.fee, description: fund.coverTheFeeSettings.description, label: fund.coverTheFeeSettings.ctfPercentMessage, checked: Boolean(block.querySelector('.sqs-cover-the-fees-checkbox[checked]')) }
        : undefined,
    },
    currency: content.currencyCode ?? 'USD',
    locale: ctx.formattingLocale ?? content.siteLanguage ?? 'en-US',
    strings: {
      ...pick([
        'oneTimeDonationLabel',
        'weeklyDonationLabel',
        'monthlyDonationLabel',
        'quarterlyDonationLabel',
        'annualDonationLabel',
        'customAmountLabel',
        'customAmountDescription',
        'donationFrequencyDropdownAriaLabel',
        'totalAmountOneTimeLabel',
        'totalAmountWeeklyLabel',
        'totalAmountMonthlyLabel',
        'totalAmountQuarterlyLabel',
        'totalAmountAnnualLabel',
        'submissionLabel',
      ]),
      required: content.localizedVisitorFormStrings?.required ?? '(required)',
      // What the original shows when its server refuses the donation (seen on the live page, 2026-11-18).
      submitError: 'There was an error submitting the form.',
    },
  }
}

/** A video block: YouTube's own player, or a video Squarespace hosts (its length and shape, for the player we draw). */
function video(block: Element) {
  const native = block.querySelector('.sqs-native-video')
  if (native) {
    const cfg = json(native.getAttribute('data-config-video')) ?? {}
    return { provider: 'native', duration: cfg.durationSeconds ?? 0, aspectRatio: cfg.aspectRatio ?? 16 / 9 }
  }
  const iframe = embeddedIframe(block.querySelector('.sqs-video-wrapper')?.getAttribute('data-html') ?? '')
  return {
    provider: 'youtube',
    src: iframe?.getAttribute('src') ?? '',
    title: iframe?.getAttribute('title') ?? '',
    allow: iframe?.getAttribute('allow') ?? '',
    referrerPolicy: iframe?.getAttribute('referrerpolicy') ?? undefined,
  }
}

/** A picture's file format, now that its files exist. */
function withFormat(p: Picture): Picture {
  const dir = path.join(PUBLIC, p.base)
  const ext = ['webp', 'avif', 'jpg', 'png', 'gif'].find((e) => p.widths.some((w) => existsSync(path.join(dir, `${w}.${e}`))))
  return { ...p, ext: ext ?? 'jpg' }
}

async function main() {
  const out = { instagram: {} as Record<string, any>, map: {} as Record<string, unknown>, donation: {} as Record<string, unknown>, video: {} as Record<string, unknown> }
  for (const p of PAGES) {
    const { document } = parseHTML(await fetchHtml(p))
    for (const fe of document.querySelectorAll('.fe-block')) {
      const id = [...fe.classList].find((c) => c.startsWith('fe-block-'))?.slice('fe-block-'.length)
      const sqs = fe.querySelector('.sqs-block')
      if (!id || !sqs) continue
      const def = sqs.getAttribute('data-definition-name') ?? ''
      if (sqs.classList.contains('instagram-block')) out.instagram[id] = instagram(sqs)
      else if (def === 'website.components.map') out.map[id] = map(sqs)
      else if (def === 'website.components.donation') out.donation[id] = donation(sqs)
      else if (def === 'website.components.video') out.video[id] = video(sqs)
    }
  }
  await downloadMedia(PUBLIC)
  for (const feed of Object.values(out.instagram)) for (const post of feed.posts) post.picture = withFormat(post.picture)
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
  const posts = Object.values(out.instagram).reduce((n, f) => n + f.posts.length, 0)
  console.log(`widgets.json: ${Object.keys(out.instagram).length} feed (${posts} posts), ${Object.keys(out.map).length} map, ${Object.keys(out.donation).length} donation form, ${Object.keys(out.video).length} videos`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
