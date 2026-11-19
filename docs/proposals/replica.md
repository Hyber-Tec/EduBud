# Proposal: a copy of edubud.org in our own code

**Status: proposed on 2026-11-18, waiting for the owner's OK.** Nothing is built until then. Step 1 of the brief: a copy
of EduBud's website that a visitor can't tell from the original, on https://edubud-hybertec.web.app, before any of
the features.

## In short

- **Squarespace can't hand us the site.** Its export covers blog posts only (EduBud has none), and a 7.1 site has no
  code access. The saveweb2zip download is the homepage alone, in Squarespace's own code. So we rebuild.
- **An exact copy is doable, because the site carries its layout as numbers.** Every section of every page is a grid
  (24 columns on a computer, 8 on a phone) with each block's row and column written in the page. Its two fonts are
  free Google Fonts. A script reads each live page (text, links, pictures, layout, measured styles) into our own
  content files, and our code draws them. We copy EduBud's content and design, never Squarespace's code.
- **The stack is Sky Arc's family:** React and TypeScript with Vite, every page prerendered to plain HTML, on
  Firebase (Hosting now; sign-in, Firestore, Cloud Functions and Storage for the features), and Expo later for the
  phone app.
- **The check is a script, then your eyes.** It screenshots every page of edubud.org and of our copy at five widths
  and compares pixels, text, links and styles. You get one report page, side by side, with every difference listed.
- **Five answers needed** (Q1–Q5 below): the Korean option (broken on the original today), the shop, donations,
  the forms, and keeping EduBud's photos out of this public repository.

## 1. What I found

### The website (checked 2026-11-18)

Squarespace 7.1, made with its Fluid Engine editor.

| | |
|---|---|
| **Pages** | 14: Home; *Learning Center* → Day Learning Program, Summer Program; *Initiatives* → Community Chapters; *Current Projects* → Golden Bridge Project; *Past Projects* → Blue Bridge Project, California Schools Fire Relief Project, Voices of the Vulnerable Project, Mentor's Corner; *About Us* → Our Team, Resources, Support Us; and Founder Message, which isn't in the menu but is public at `/founder-message`. |
| **Shop** | A product grid and 4 products (a tote $20, a cap $25, a hoodie $50, a tee $35, whose address is still the template's `/the-echo-vase-llhgn`), a cart and Squarespace's checkout. |
| **Other addresses** | The menu's five folders (`/learning-center`, `/initiatives`, …) send visitors to their first page; `/home` is a second address of the homepage; a "page not found" page. Drafts that aren't public (two disabled pages, an unlinked copy of About Us) aren't part of the copy. |
| **Parts** | A header with drop-down menus, a cart icon and an English / 한국어 picker; a full-screen menu on phones; heroes with background videos and photos; the green "blob" shapes; accordions; a scrolling sponsors' band; cards; a big "EDUBUD" footer. |
| **Forms** | A contact form on Home (name, email, subject, message, "sign up for news"); a newsletter sign-up in every page's footer; a **donation form** on Support Us (Squarespace Donations, live). The interest forms are links to Google Forms; some pages link to files on Google Drive. |
| **Media** | About 250 pictures (Squarespace keeps each at up to 2,500 px wide), 5 background videos on Squarespace, 4 YouTube videos, an Instagram feed (Our Team), a Google map (Day Learning Program). |
| **Look** | Fonts: **Bricolage Grotesque** (headings, bold) and **DM Sans** (text, light): both free Google Fonts. Colors: mint, dark green, light mint, near-black, white. Buttons are pills; hover effects on buttons, links and menus; the site-wide scroll animations are off. |
| **Korean** | The picker is Weglot's, a service that translates the page in the browser. **It doesn't work today:** choosing 한국어 asks Weglot, which answers "You have reached your words limit, you need to upgrade", and the page stays in English. |
| **Code** | No custom code injected; Squarespace's own reCAPTCHA on the forms. |
| **Domain** | edubud.org is registered at Squarespace Domains (paid to 2027-01-30), its DNS on Google's name servers, its email on Google Workspace. Moving the website later changes only the website's records, never the email's. |

### What Squarespace can export

*(The research's sources are in "Sources" at the end.)*

- **Settings → Import & Export** on EduBud's site offers to export **blogs** only, and EduBud has no blog. Even on
  sites with one, the export is a WordPress file of text and picture addresses: no layouts, no styles, no shop.
- **No code:** a 7.1 site gives no access to its template's code.
- **Pictures:** Squarespace's image server gives each picture at up to 2,500 px wide (no larger copy exists there),
  re-encoded; we take the largest it has, in the original format where it gives it.
- **Data:** products, orders, donations and contacts (the newsletter's list) can each be exported as a spreadsheet
  from the admin, which matters when the site moves (§6).
- **The `?format=json` view** still works on 7.1, but holds the site's settings, not the pages' content.

### The saveweb2zip download

`~/Downloads/saveweb2zip-com-www-edubud-org`: 72 MB, 171 files.

- **The homepage only**, twice (a computer's view and an iPhone's): none of the other 17 pages, the shop or the Korean.
- **Squarespace's own code:** the page's HTML (815 KB), Squarespace's compressed CSS (1.3 MB) and 29 JavaScript files,
  its fonts and icons, and ~100 picture files (the homepage's dozen pictures in several sizes).
- Opened from the disk, its menus, forms, cart, donations and translation all depend on Squarespace's servers.
- **Useful as** a dated snapshot of the homepage. **Not useful as a base:** that code is Squarespace's, not EduBud's
  to give; it's compressed and tied to Squarespace's servers; and the features can't be built on it.

## 2. What I recommend: rebuild in our own code, measured from the live site

1. **Capture.** A script opens every page of edubud.org in a real browser at computer, tablet and phone widths and
   records each section (its background: color, photo, video or gradient; its height), each block's place on the
   section's grid at each width, the text with its links and styling, the pictures, and the measured styles of every
   element (font, size, weight, line height, spacing, color). It writes our own content files, one per page.
2. **Pictures and videos.** Downloaded at the best quality Squarespace has, then resized to the sizes the pages use.
   They live in Cloud Storage, not in this repository (Q5).
3. **Build.** Our own components: the header and its menus, the phone menu, the footer, the section grid, and each
   kind of block (text, picture, button, shape, accordion, scrolling band, card, video, form, map, product grid,
   product page, cart). Every page is prerendered to plain HTML when the site is built (fast, found by search engines,
   readable without JavaScript); the menus, accordions and cart come alive in the browser.
4. **Compare** (§5), fix, and compare again, until the differences are gone.

**Why read the live site instead of coding each page by eye:** the layout numbers are exact, so the copy is exact at
every width; re-running the capture shows anything EduBud changes on Squarespace while we build; and the same content
files are what the admin pages will edit later (the brief's "edit photos and text").

**What we take, and what we don't:** EduBud's text, pictures, logo, colors, fonts and layout, which are EduBud's to
give. Not Squarespace's CSS and JavaScript, which are Squarespace's: our code reproduces how the site looks.

## 3. Alternatives

| | For | Against |
|---|---|---|
| **A. Mirror Squarespace's files** (a full saveweb2zip, hosted as it is) | Identical on day one | Squarespace's code (its terms); 1.3 MB of CSS and dozens of scripts that call Squarespace (forms, cart, donations and translation break); nothing to build the features into |
| **B. Keep Squarespace, build the features beside it** (`app.edubud.org`, linked from a button added in Squarespace) | Least work; no risk to the look; EduBud keeps editing in Squarespace | Two systems and two sign-ins; Squarespace stays paid; the calendar and tracker only as links or embeds; the admin for photos and text is Squarespace's. A fallback, if the copy proved too costly (I don't expect it to) |
| **C. Code each page by hand** | Easiest for a beginner to read | Slow and approximate (18 pages, each with a computer and a phone layout, by eye), and it drifts from the original |

## 4. The stack

| Part | Choice | Why |
|---|---|---|
| Website, and later the app | **React 19 + TypeScript, Vite, React Router 7** with prerendering | One codebase for the public pages (prerendered HTML) and the sign-in, tracker, inbox, calendar and admin pages (the same app). Sky Arc's family, so HyberTec maintains one kind of project; and mainstream, for an intern to learn |
| The site's look | **Our own CSS**, with the original's values as tokens (colors, fonts, the grid's sizes) | The replica's styles are measured numbers, clearer in plain CSS than in utility classes |
| What we add | **Tailwind v4 + shadcn/ui + react-icons**, in EduBud's colors and fonts | The project's UI rule (CLAUDE.md) |
| Fonts | Bricolage Grotesque and DM Sans, served from our Hosting | Free (Open Font License); no Google request on each visit |
| Hosting | **Firebase Hosting** (CDN, HTTPS, preview links) | Already deploying from GitHub |
| Pictures and videos | **Cloud Storage for Firebase**, readable by anyone for the website's files | Out of the public repository (Q5); where the admin will upload photos later |
| Later: sign-in, data, server | Firebase Authentication (Google, email and password), Firestore with tested security rules, Cloud Functions (form intake, emails) | Already set up in the project; the database rules keep each volunteer to their own data and each chapter leader to their chapter |
| Later: phone app | Expo (React Native), sharing the TypeScript types | As Sky Arc |
| Tests | Vitest; Playwright for the comparison and page checks | |

The folders it would add:

```
web/                  the website now, the app's pages later
  src/site/           layout, header, menus, footer, sections, blocks
  src/content/        one file per page, written by the capture
  public/             fonts, favicon
scripts/capture/      reads edubud.org into web/src/content (and the pictures into Storage)
scripts/compare/      the side-by-side check and its report
```

## 5. How we'll know it matches

- **Pixels.** A script opens each page on edubud.org and on our copy at five widths: 1920 and 1440 (computers), 1024
  and 768 (tablets), 390 (a phone). It scrolls through so every picture loads, freezes what moves (videos on their
  first frame, the scrolling band), takes full-page screenshots, and compares them pixel by pixel: a percentage and a
  map of the differences for each page at each width.
- **Text and links.** Every word, heading, link address and picture description on each page, compared as lists:
  they must be identical.
- **Styles.** The measured font, size, weight, line height, letter spacing, color and position of every heading,
  paragraph and button, within a pixel.
- **Behaviour.** Scripted: the menus open on hover, the phone menu opens, closes and steps into its folders, the
  accordions open, the band scrolls, buttons and links change on hover, the cart counts, product options change,
  the folders' addresses redirect, an unknown address shows the "page not found" page.
- **One report for you** (an artifact page): page by page, at each width, the original, ours and the difference
  side by side, with the numbers and every remaining difference explained. Then your own look on your computer and
  phone, both sites side by side.
- **Done means** identical text, links and behaviour, and pixel differences only where browsers draw fonts or video
  frames differently, each one listed.
- It runs on our computers, not in CI: it loads edubud.org, which shouldn't be hit on every push, and it would cost
  minutes for nothing a pull request can break.

## 6. Risks

1. **Squarespace's code isn't EduBud's to give.** EduBud's permission covers its content and design, not
   Squarespace's files. We never copy their CSS or JavaScript, only reproduce the look, so the risk is low.
2. **Photos in a public repository.** The site shows high school volunteers, many of them minors, and the adults the
   center serves. A photo committed to a public repository stays in its history forever, copied with every clone
   (public repositories are cloned in bulk by bots), even after EduBud takes it off its site.
   So the pictures and videos live in Cloud Storage, where a removed photo is really gone; the repository holds only
   their names and sizes (Q5).
3. **The Korean option is broken on the original** (Q1).
4. **The shop and donations need a new way to take money** once the site leaves Squarespace: its checkout and
   Donations only work there (Q2, Q3).
5. **The forms' answers go to Squarespace today** (Q4).
6. **EduBud may change its Squarespace site while we build.** The capture can run again to show what changed; best if
   the founder tells us before changing it (E1).
7. **Pictures can't be sharper than Squarespace kept them** (2,500 px wide). Bigger originals would have to come from
   EduBud or its designer; at the site's sizes that won't show.
8. **Between the measured widths.** Squarespace scales some text with the window's width. We measure at five widths
   and test the ones between; a pixel or two may remain at odd widths, and the report will say where.
9. **Later, when edubud.org moves** (not part of step 1): the same addresses, titles, descriptions, link previews and
   icons, the folders' redirects and a sitemap, so search results carry over (the domain already carries a Google
   verification record, Workspace's or Search Console's). Export the newsletter list, donors and products first. Squarespace's analytics stays
   behind (a replacement is a later question). EduBud's Squarespace website plan can then end; the domain is billed
   apart and stays.

## 7. Questions for you

Each has the default I'd use until you answer. They're also in [`../QUESTIONS.md`](../QUESTIONS.md).

| | Question | Options | Until answered |
|---|---|---|---|
| **Q1** | **Korean.** The original's picker shows 한국어 but does nothing (its translation service is out of words). | (a) **A real Korean version** of every page, translated once (AI, then checked by you or EduBud), with its own addresses (`/ko/…`), built after the English copy is approved: *my recommendation*; (b) no Korean: remove the picker (EduBud's call); (c) as today: the picker shows, nothing happens | (c), which is what visitors see today |
| **Q2** | **The shop:** Squarespace's checkout leaves with Squarespace, and one product still has the template's address. | (a) copy it with its cart, and connect checkout to EduBud's own Stripe account when the site moves; (b) keep the products as a catalogue without a cart; (c) drop the shop (EduBud's call) | Copied with its cart; the checkout button goes nowhere yet |
| **Q3** | **Donations** are live on Squarespace and leave with it. | (a) **Stripe** (EduBud's own account, one-time and monthly), with our donation form drawn like today's: *my recommendation*; (b) a nonprofit service's form (Zeffy, free; Givebutter): their look, not today's; (c) PayPal | The form is copied; paying isn't connected yet |
| **Q4** | **The forms** (contact, newsletter) send their answers to Squarespace today. | (a) in step 1 they look, check and thank exactly like today, but store nothing (the copy has no visitors); they become real with the forms inbox, before the domain moves: *my recommendation*; (b) store answers in Firestore from step 1 | (a) |
| **Q5** | **EduBud's photos and videos out of this public repository**, in Cloud Storage (risk 2). | Yes (*my recommendation*); or in the repository after all | Yes. It needs Storage turned on (§8) |

## 8. What I need from you

1. **Your OK** on the approach (§2) and the stack (§4), and answers to Q1–Q5 (or the defaults).
2. **Cloud Storage turned on**, if Q5 is yes: Firebase console → **Storage** → **Get started** (the US location it
   offers; production mode: the rules come with the code). The project already has billing, which Storage needs. Or
   tell me to, and I'll try it from the command line.
3. **A word to the founder (E1):** please tell us before changing the Squarespace site until the copy is done, or
   keep changes for after; the capture can catch up either way.
4. **Later, not now:** EduBud's Stripe account (if Q2 or Q3 is Stripe), and who should receive the forms' emails.

## 9. After your OK

1. The capture and the content files, and the pictures and videos into Storage.
2. The frame: fonts, colors, the grid, the header and its menus, the phone menu, the footer. Then Home, compared at
   all five widths before moving on.
3. The other pages; then the shop and cart, the forms, the donation form (look only), "page not found", the redirects.
4. The comparison report, the fixes, and the copy on https://edubud-hybertec.web.app for you to compare.

Each part is a pull request with its preview link, merged once CI is green; the copy grows on
edubud-hybertec.web.app, still hidden from search engines. CI adds the website's typecheck, tests and build: about a
minute or two a run, estimated in that pull request. No sign-in button yet: that's step 2.

## Sources

- What the site is made of: its pages, read in a browser on 2026-11-18, and EduBud's Squarespace admin, looked at
  without changing anything (Pages, Orders, Donations, Import & Export).
- The Korean option: the translation service's answer to the site's request, 2026-11-18.
- The domain: its public DNS and registration records, 2026-11-18.
