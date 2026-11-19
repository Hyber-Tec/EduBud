import type { ReactNode } from 'react'
import { LuArrowLeft } from 'react-icons/lu'
import { Button } from '~/components/ui/button'
import site from '~/content/site.json'
import type { Picture } from '~/content/types'
import { Img, pictureSrc, srcSet } from '~/site/Picture'

// EduBud's logo, the one in the copy's header.
const logo = site.header.logo as unknown as Picture

// Two people in EduBud T-shirts walking hand in hand on a sunny path: one of EduBud's own photos, from the gallery on
// the Summer Program page (content/galleries.json). It's decoration here, so screen readers skip it (no alt text).
const photo: Picture = {
  base: '/media/053e77ca10c6',
  ext: 'webp',
  widths: [100, 300, 500, 750, 1000, 1500, 2500],
  width: 1324,
  height: 1770,
  alt: '',
}

interface Props {
  title: string
  /** One line under the title. */
  intro: string
  /** The form. */
  children: ReactNode
  /** The line under the form, and its link to the other page: "New to EduBud? Create an account". */
  other: { question: string; link: string; to: string }
}

/**
 * The page around the log-in and sign-up forms. On computers (1280px and wider), two halves: the form, and one of
 * EduBud's photos with its line "Together, We Grow Stronger". On phones and tablets, the form alone. EduBud's logo is
 * at the top and goes back to the site, as does "Back to site".
 *
 * Every link here is a plain `<a>` that loads its page afresh, as the copy's own links do (so the browser scrolls as
 * it does on the original: a new page at its top, Back where you were).
 */
export function AuthLayout({ title, intro, children, other }: Props) {
  return (
    <div className="grid min-h-svh xl:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <img src={pictureSrc(logo, 300)} srcSet={srcSet(logo)} sizes="64px" alt={logo.alt} className="h-16 w-auto" />
          </a>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <a href="/">
              <LuArrowLeft aria-hidden="true" />
              Back to site
            </a>
          </Button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-base text-pretty text-muted-foreground">{intro}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-8 text-center text-sm">
              {other.question}{' '}
              <a
                href={other.to}
                className="rounded-sm font-bold underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {other.link}
              </a>
            </p>
          </div>
        </main>
      </div>

      {/* Decoration, which screen readers skip: the photo, and EduBud's line from its homepage. */}
      <div className="relative hidden overflow-hidden bg-near-black xl:block" aria-hidden="true">
        {/* Lazy: on phones and tablets the photo isn't shown, so it isn't downloaded either. */}
        <Img picture={photo} className="absolute inset-0 size-full object-cover" style={{ objectPosition: '50% 40%' }} />
        {/* Dark enough under the line for its words to read clearly where the photo is brightest (6:1 or more). */}
        <div className="absolute inset-0 bg-linear-to-t from-near-black/90 via-near-black/70 via-35% to-transparent to-65%" />
        <p className="absolute inset-x-12 bottom-12 font-heading text-6xl/[1.02] font-bold tracking-tight text-white 2xl:text-7xl/[1.02]">
          <span className="text-light-mint">Together,</span>
          <br />
          We Grow
          <br />
          Stronger
        </p>
      </div>
    </div>
  )
}
