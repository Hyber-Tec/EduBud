// The Instagram feed on Our Team: EduBud's newest posts, read from Instagram's official API once EduBud has connected
// its account (docs/INSTAGRAM.md), so the website keeps up with it as the original does.
//
//   node web/scripts/instagram.mjs build     # before a build: the posts for it (CI's deploy job)
//   node web/scripts/instagram.mjs refresh   # renews Instagram's token and stores the new one (the Instagram workflow)
//   node web/scripts/instagram.mjs check     # are there posts the website doesn't show yet? (the Instagram workflow)
//
// `build` writes the posts to app/content/instagram.json, their pictures to public/media/instagram/<post>/ (both
// git-ignored), and the posts again to public/media/instagram/feed.json, which the website serves so the next run can
// tell what it shows. The posts come from, in this order:
//   1. Instagram, with INSTAGRAM=on (main's deploy) or INSTAGRAM_TOKEN;
//   2. the live website's feed.json and pictures (a pull request's preview; main's, if Instagram can't be read);
//   3. nowhere: the build then shows the posts read from the original with the rest of the page (widgets.json).
//
// The token is Instagram's long-lived token for EduBud's account, kept in Google Cloud's Secret Manager and read with
// the access token of CI's Google sign-in (GOOGLE_ACCESS_TOKEN). It lasts 60 days from its last renewal, so `refresh`
// renews it every day. On your computer, INSTAGRAM_TOKEN=<token> takes its place (never commit a token).
//
// Plain Node (22 or later), so the Instagram workflow needs no packages; only `build` uses sharp, for the pictures.
import { createHash } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const WEB = path.resolve(import.meta.dirname, '..')
const CONTENT_FILE = path.join(WEB, 'app/content/instagram.json')
const PICTURES = path.join(WEB, 'public/media/instagram')
/** Where the website serves the posts it shows. */
const FEED_PATH = '/media/instagram/feed.json'

const SITE = process.env.SITE_URL || 'https://edubud-hybertec.web.app'
// Tests point these two at a stand-in.
const INSTAGRAM_API = process.env.INSTAGRAM_API || 'https://graph.instagram.com'
const SECRET_MANAGER_API = process.env.SECRET_MANAGER_API || 'https://secretmanager.googleapis.com/v1'
/** The secret holding the token (docs/INSTAGRAM.md, "Connect EduBud's account"). */
const SECRET = 'projects/edubud-hybertec/secrets/instagram-token'
const API_VERSION = 'v27.0'

/** The original shows the 20 newest posts. */
const POSTS = 20
/** The widths Squarespace makes of a picture; ours stop at the picture's own width. */
const WIDTHS = [100, 300, 500, 750, 1000, 1500, 2500]
/** A picture's description for screen readers, as Squarespace makes it: the caption's first 250 characters. */
const ALT_LENGTH = 250
/** Instagram's player, at the size Squarespace embeds it. */
const PLAYER = { width: 612, height: 710 }
/** feed.json's format. A new one makes the next run fetch everything again. */
const FORMAT = 1
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}'
const DAY = 24 * 60 * 60 * 1000

// ---------- What a run says: the log, and in CI its summary page and outputs ----------

const secrets = new Set()
/** Keeps a secret out of everything printed: CI hides it in its logs, and our own messages drop it. */
function secret(value) {
  if (!value) return
  secrets.add(value)
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${value}`)
}
function scrub(text) {
  let out = String(text)
  for (const s of secrets) out = out.split(s).join('***')
  return out
}
function say(line) {
  console.log(scrub(line))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${scrub(line)}\n\n`)
}
function warn(line) {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${scrub(line)}` : `warning: ${scrub(line)}`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Warning:** ${scrub(line)}\n\n`)
}
function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}
/** A day as EduBud counts it (CLAUDE.md: its time zone, never the computer's), e.g. 2026-11-19. */
function day(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'an unknown day' : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

// ---------- Instagram, Secret Manager and the live website ----------

/** A GET that gives up after 30 seconds. */
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })

/** A call to Instagram's API. The address holds the token, so an error says only what Instagram answered. */
async function instagram(url) {
  const res = await get(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const e = body.error ?? {}
    const err = new Error(`Instagram: ${e.message ?? `HTTP ${res.status}`}${e.code ? ` (code ${e.code})` : ''}`)
    // 190: the token is invalid, expired or revoked; only connecting the account again fixes it.
    err.expired = e.code === 190
    throw err
  }
  return body
}
function instagramUrl(pathname, params) {
  const url = new URL(pathname, INSTAGRAM_API)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

/** A call to Secret Manager's API, as CI's Google sign-in (github-deploy@). */
async function secretManager(name, body) {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  if (!token) throw new Error('No Google sign-in (GOOGLE_ACCESS_TOKEN) to read the token from Secret Manager; on a computer, set INSTAGRAM_TOKEN')
  const res = await get(`${SECRET_MANAGER_API}/${name}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Secret Manager: ${json.error?.status ?? `HTTP ${res.status}`}${json.error?.message ? `: ${json.error.message}` : ''}`)
  return json
}

/** Instagram's token: INSTAGRAM_TOKEN on a computer, else the newest version of the secret. */
async function readToken() {
  if (process.env.INSTAGRAM_TOKEN) {
    const token = process.env.INSTAGRAM_TOKEN.trim()
    secret(token)
    return token
  }
  const version = await secretManager(`${SECRET}/versions/latest:access`)
  const token = Buffer.from(version.payload?.data ?? '', 'base64').toString('utf8').trim()
  secret(token)
  if (!token) throw new Error(`Secret Manager: ${SECRET}'s newest version is empty`)
  return token
}

/** The posts the live website shows (its feed.json), or null when it has none. */
async function liveFeed() {
  const res = await get(new URL(FEED_PATH, SITE), { headers: { 'cache-control': 'no-cache' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${new URL(FEED_PATH, SITE)}: HTTP ${res.status}`)
  const feed = await res.json()
  return feed?.format === FORMAT && Array.isArray(feed.posts) ? feed : null
}

// ---------- The posts ----------

/**
 * One of Instagram's media as the feed shows it, or null when Instagram gives no picture for it. A video (a reel)
 * shows its cover, and Instagram's player in the lightbox; a carousel shows its first picture, as on the original.
 */
function fromInstagram(media) {
  const first = media.media_type === 'CAROUSEL_ALBUM' ? media.children?.data?.[0] : media
  const pictureUrl = first?.media_type === 'VIDEO' ? first.thumbnail_url : first?.media_url
  if (!pictureUrl || !/^\w+$/.test(media.id)) return null
  return {
    id: media.id,
    kind: media.media_type === 'VIDEO' && media.permalink ? 'video' : 'image',
    caption: media.caption ?? '',
    permalink: media.permalink ?? '',
    timestamp: media.timestamp ?? '',
    pictureId: first.id ?? media.id,
    pictureUrl,
  }
}

/** The account's newest posts, newest first, and its name (said in the run's summary, to show which is connected). */
async function newestPosts(token) {
  // The account's id first, as Instagram's guide does it (its example wraps the answer in `data`).
  const me = await instagram(instagramUrl(`/${API_VERSION}/me`, { fields: 'user_id,username', access_token: token }))
  const account = me.data?.[0] ?? me
  if (!/^\w+$/.test(account.user_id ?? '')) throw new Error("Instagram: the token's account has no id")
  const posts = []
  let page = await instagram(instagramUrl(`/${API_VERSION}/${account.user_id}/media`, { fields: FIELDS, limit: String(POSTS + 5), access_token: token }))
  for (;;) {
    for (const media of page.data ?? []) {
      const post = fromInstagram(media)
      if (post) posts.push(post)
    }
    if (posts.length >= POSTS || !page.paging?.next) break
    page = await instagram(page.paging.next)
  }
  if (!posts.length) throw new Error(`Instagram: @${account.username} has no posts with a picture`)
  return { account: account.username ?? account.user_id, posts: posts.slice(0, POSTS) }
}

/** What the feed shows of these posts, in short: two lists of posts with the same fingerprint look the same. */
function fingerprint(posts) {
  const shown = posts.map((p) => [p.id, p.kind, p.caption, p.permalink, p.pictureId])
  return createHash('sha256').update(JSON.stringify([FORMAT, shown])).digest('hex').slice(0, 16)
}

/** The caption's first 250 characters, without cutting an emoji in two. */
function altText(caption) {
  const alt = caption.slice(0, ALT_LENGTH)
  return /[\uD800-\uDBFF]$/.test(alt) ? alt.slice(0, -1) : alt
}

/** Runs `fn` on every item, a few at a time, in order. */
async function inTurn(items, fn, at = 5) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: at }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

/**
 * A post's picture, saved on our Hosting: Instagram's picture addresses stop working after a while. WebP in
 * Squarespace's widths up to its own, so a tile loads the same size of file as on the original.
 */
async function savePicture(sharp, post) {
  const res = await get(post.pictureUrl)
  if (!res.ok) throw new Error(`Instagram: post ${post.id}'s picture: HTTP ${res.status}`)
  const image = sharp(Buffer.from(await res.arrayBuffer()))
  const { width, height } = await image.metadata()
  if (!width || !height) throw new Error(`Instagram: post ${post.id}'s picture can't be read`)
  const widths = [...WIDTHS.filter((w) => w < width), width]
  const dir = path.join(PICTURES, post.id)
  await mkdir(dir, { recursive: true })
  for (const w of widths) await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, `${w}.webp`))
  return { base: `/media/instagram/${post.id}`, ext: 'webp', widths, width, height }
}

/** A post as the website's code draws it (web/app/content/types.ts, InstagramPost), as the snapshot's are. */
function feedPost(post, picture) {
  const shown = {
    id: post.id,
    kind: post.kind,
    picture: { ...picture, alt: post.kind === 'video' ? '' : altText(post.caption), focal: [0.5, 0.5] },
    description: post.caption,
    timestamp: post.timestamp,
  }
  if (post.kind !== 'video') return shown
  const href = post.permalink.replace(/\/?$/, '/')
  return { ...shown, href, embed: { src: `${href}embed/`, ...PLAYER } }
}

/** The newest posts, with their pictures, from Instagram. */
async function feedFromInstagram() {
  const { account, posts } = await newestPosts(await readToken())
  const sharp = (await import('sharp')).default
  await rm(PICTURES, { recursive: true, force: true })
  const pictures = await inTurn(posts, (post) => savePicture(sharp, post))
  return { format: FORMAT, fingerprint: fingerprint(posts), account, updated: new Date().toISOString(), posts: posts.map((p, i) => feedPost(p, pictures[i])) }
}

/** The posts the live website shows, with their pictures, copied from it. */
async function feedFromLive() {
  const feed = await liveFeed()
  if (!feed) return null
  await rm(PICTURES, { recursive: true, force: true })
  const files = feed.posts.flatMap((p) => p.picture.widths.map((w) => `${p.picture.base}/${w}.${p.picture.ext}`))
  await inTurn(files, async (file) => {
    // Only pictures of the feed's own folder.
    if (!/^\/media\/instagram\/\w+\/\d+\.\w+$/.test(file)) throw new Error(`the live website's feed: unexpected picture ${file}`)
    const res = await get(new URL(file, SITE))
    if (!res.ok) throw new Error(`${new URL(file, SITE)}: HTTP ${res.status}`)
    const to = path.join(WEB, 'public', file)
    await mkdir(path.dirname(to), { recursive: true })
    await writeFile(to, Buffer.from(await res.arrayBuffer()))
  })
  return feed
}

// ---------- The commands ----------

/** Before a build: the posts for it, from Instagram, else the live website, else none (the snapshot). */
async function build() {
  let feed = null
  if (process.env.INSTAGRAM === 'on' || process.env.INSTAGRAM_TOKEN) {
    try {
      feed = await feedFromInstagram()
      say(`Instagram feed: @${feed.account}'s ${feed.posts.length} newest posts, from Instagram (the newest of ${day(feed.posts[0].timestamp)}).`)
    } catch (e) {
      warn(`Instagram feed: Instagram couldn't be read (${e.message}); the live website's posts instead.`)
    }
  }
  if (!feed) {
    try {
      feed = await feedFromLive()
      if (feed) say(`Instagram feed: the ${feed.posts.length} posts the live website shows, copied from it (read from Instagram on ${day(feed.updated)}).`)
    } catch (e) {
      warn(`Instagram feed: the live website's posts couldn't be copied (${e.message}).`)
      feed = null
    }
  }
  if (!feed) {
    await rm(CONTENT_FILE, { force: true })
    await rm(PICTURES, { recursive: true, force: true })
    say('Instagram feed: the posts read from the original with the rest of the page (none from Instagram yet).')
    return
  }
  const json = `${JSON.stringify(feed, null, 1)}\n`
  await mkdir(PICTURES, { recursive: true })
  await writeFile(CONTENT_FILE, json)
  await writeFile(path.join(PICTURES, 'feed.json'), json)
}

/** Says whether Instagram's newest posts differ from the live website's: output `changed=true|false`. */
async function check() {
  const { account, posts } = await newestPosts(await readToken())
  let live = null
  try {
    live = await liveFeed()
  } catch (e) {
    warn(`The live website's posts couldn't be read (${e.message}); deploying to be sure.`)
  }
  const changed = !live || live.fingerprint !== fingerprint(posts)
  output('changed', String(changed))
  const newest = `@${account}, the newest of ${day(posts[0].timestamp)}`
  say(changed ? `Instagram's posts differ from the website's (${newest}): the website gets them now.` : `No new posts (${newest}): the website shows them already.`)
}

/**
 * Renews the token in Secret Manager: Instagram gives a new one, valid 60 days, for one at least a day old; it's
 * stored as the secret's newest version and the older versions are destroyed. If Instagram refuses, the current token
 * goes on working until it lapses, so that's only a warning, until the token is 45 days old.
 */
async function refresh() {
  if (process.env.INSTAGRAM_TOKEN) throw new Error('refresh renews the token in Secret Manager; unset INSTAGRAM_TOKEN')
  const stored = await secretManager(`${SECRET}/versions/latest`)
  const age = (Date.now() - Date.parse(stored.createTime)) / DAY
  if (age < 1) {
    say('Token: stored less than a day ago; Instagram renews a token once it is a day old.')
    return
  }
  const token = await readToken()
  let renewed
  try {
    renewed = await instagram(instagramUrl('/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token }))
  } catch (e) {
    if (e.expired) throw new Error(`Token: Instagram no longer accepts it (${e.message}). Connect the account again (docs/INSTAGRAM.md).`)
    if (age > 45) throw new Error(`Token: not renewed (${e.message}), and it was stored ${Math.floor(age)} days ago; tokens last 60 days. Connect the account again (docs/INSTAGRAM.md).`)
    warn(`Token: not renewed (${e.message}). The current one, stored ${Math.floor(age)} days ago, still works; the next run tries again.`)
    return
  }
  const fresh = String(renewed.access_token ?? '')
  secret(fresh)
  const until = renewed.expires_in ? `, valid until ${day(new Date(Date.now() + renewed.expires_in * 1000).toISOString())}` : ''
  if (!fresh || fresh === token) {
    say(`Token: renewed${until}.`)
    return
  }
  const added = await secretManager(`${SECRET}:addVersion`, { payload: { data: Buffer.from(fresh).toString('base64') } })
  // Only the newest version is kept: a destroyed version can't be read again, and Secret Manager bills the others.
  const { versions = [] } = await secretManager(`${SECRET}/versions?filter=${encodeURIComponent('state:ENABLED')}`)
  for (const v of versions) if (v.name !== added.name) await secretManager(`${v.name}:destroy`, {})
  say(`Token: renewed and stored${until}.`)
}

const commands = { build, check, refresh }
const command = commands[process.argv[2]]
if (!command) {
  console.error('Usage: node web/scripts/instagram.mjs build|check|refresh (docs/INSTAGRAM.md)')
  process.exit(2)
}
command().catch((e) => {
  const message = scrub(e?.message ?? e)
  console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : message)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**Failed:** ${message}\n\n`)
  process.exit(1)
})
