import type { InstagramPost } from './types'

/**
 * EduBud's newest Instagram posts, when web/scripts/instagram.mjs wrote them for this build into instagram.json
 * (git-ignored: CI's deploy writes it once EduBud's account is connected, docs/INSTAGRAM.md). Without that file, none:
 * the feed shows the posts read from the original with the rest of the page (widgets.json).
 */
const fetched = import.meta.glob<{ posts: InstagramPost[] }>('./instagram.json', { eager: true, import: 'default' })

export const newestInstagramPosts: InstagramPost[] | undefined = Object.values(fetched)[0]?.posts
