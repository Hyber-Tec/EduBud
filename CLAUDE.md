# CLAUDE.md: EduBud

Project context lives in **`EDUBUD_PROJECT_BRIEF.md`**. Read it first.

EduBud is a nonprofit: a learning center for adults with disabilities, with volunteer chapters of high school and
college students. This repository is its website, rebuilt by HyberTec in its own code, and the volunteers' tools that
come after it. The rules below are **strict** and apply to every developer and every AI session. They follow HyberTec's
Sky Arc project's rules (a separate repository), changed only where EduBud differs.

Read next: [`docs/DECISIONS.md`](docs/DECISIONS.md) (the owner's answers; they win over the brief) →
[`docs/QUESTIONS.md`](docs/QUESTIONS.md) (what's still open, with the defaults used meanwhile) →
[`docs/TODO.md`](docs/TODO.md) (the owner's to-do, a short checklist: bring up what's due; tick what's done with ✅ and
the date and move it to Done at the bottom) → [`docs/proposals/replica.md`](docs/proposals/replica.md) (how the copy
of the website is built and checked) → [`docs/DEPLOY.md`](docs/DEPLOY.md) (how `main` reaches Firebase). Every other
doc, by folder: [`docs/README.md`](docs/README.md).

---

## Strict Rules

### Branches & pull requests
- `main` is reached **only through a pull request** with CI green. A session works on a **branch**, opens the pull
  request, and **says so**. It **never pushes to `main`**.
- **Claude Code merges its own pull requests** once CI is green, every kind of change, shared files included, unless the
  owner says not to for that change ("Merging", below). It then checks the deploy.
- **Phone releases are the owner's call:** no TestFlight, App Store or Google Play build unless the owner asks for it.

### Your accounts and local setup
- Commit and push with **your own personal GitHub account**, never a shared or work account. If your global git
  identity is another account, set `user.name` and `user.email` in this repository's `.git/config`; never change
  another developer's setup.
- Your machine-specific setup (accounts, credential helpers, local paths) goes in **`CLAUDE.local.md`** at the
  repository root. It's git-ignored, and Claude Code reads it together with this file. Never put personal details in
  this file.

### AI naming (permanent rule)
- The app **never names the AI model or provider** in labels, settings, messages, or errors. It is always **"AI."**
  If a settings page ever lets admins choose a provider, that page alone may name them, and only admins see it.

### UI
- **The public website is EduBud's design, unchanged.** Until the owner says otherwise, every page matches
  edubud.org: layout, fonts, colors, spacing, images, text, links, menus, buttons, hover effects, animations, at
  desktop, tablet and phone sizes. A difference from the original is a bug, not a choice. Measure the original (its
  computed styles, its pictures), don't eyeball it, and check every change with the side-by-side comparison
  ([`docs/proposals/replica.md`](docs/proposals/replica.md)).
- **What we add** (sign-in, the point tracker, the forms inbox, the calendar, the admin pages): **shadcn/ui**
  components and icons from **react-icons**, themed with EduBud's colors and fonts so they sit well next to the site.
- **Logos:** only EduBud's own files, as "Brand and logos" below says. Never draw, recolor or retype the logo.

### Secrets
- **Never commit** API keys, service-account files, tokens, passwords, or PINs.
- Never copy secrets or `.env` values from another HyberTec project. EduBud has its own Firebase project.
- **Never commit people's data:** volunteers' and participants' names, emails, phone numbers, points, hours, or form
  answers, and never the point tracker's sheets or the forms' exports. Use made-up people in tests and samples.
- **This repository is public** (the owner's choice, 2026-11-18; it may go private later, when he says). Everything
  committed is world-readable and its history can be copied. Never commit client-internal details (people's names,
  contacts, schedules, money) or findings about other HyberTec products. They go in the private notes,
  `docs/internal/` (git-ignored here: "Local files" below). In committed docs, name EduBud's people by role (the
  founder, the program director, chapter leaders, volunteers).

### Commits: no attribution
- Commits carry **no attribution trailers**: no `Co-authored-by` line, no session line, no "generated with" footer, in
  commit messages **or** pull request bodies.
- Every commit is authored **solely as the git user is configured**.

### Commits: Conventional Commits v1.0.0
```
<type>[(scope)][!]: <imperative description>

<body>

<footers>
```
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`.

### Commits: commit far less often
- **One commit per meaningful, self-contained piece of work**: a feature, a fix, a refactor, or a runbook.
- Small things join the commit they belong to.
- **Never** commit per file, per review round, or per step of a session.
- A day's work is **a handful of commits split by type and scope**, not by when the edits were made.

---

## Merging
The owner's rule for Sky Arc (2026-11-10), the same here from the start (2026-11-18): "just any change, everything
you're doing, just do the PR and merge by yourself … unless I ever tell you not to do it. … It doesn't mean I want you
to put the new updates on the mobile phone. That's something that I'll tell you manually."

1. Create a branch, commit, push; `gh pr create` with the body this file asks for (what changed, how it was checked,
   what the deploy does).
2. **Docs, comments and config that change no behaviour:** `gh pr merge --auto --squash`, and say the PR's link in one
   line.
3. **Everything else** (the website, app code, rules, the database, auth, deploy config): wait for CI to be green, open
   the pull request's preview link and look at what changed, merge (`gh pr merge --squash`), then watch `main`'s
   deploy to the end and fix what it leaves behind.
4. When the owner says to hold a change for his review, open it and leave it.

---

## Project Rules

- **One step at a time** (the owner, 2026-11-18): first the copy of the website, then, once the owner has compared it
  with edubud.org, the sign-in, the volunteer point tracker, one inbox for every interest form, the events calendar
  and the admin pages, and a phone app last. Don't start a step before the owner says so.
- **The copy, not a redesign.** What visitors see on edubud.org is the specification. Don't fix, tidy or improve the
  original's design, text or quirks on the website without the owner's OK; write them in `docs/QUESTIONS.md` instead.
  The only visible differences are the ones the owner approves (the sign-in button, later).
- **Samples teach, they never answer:** the point tracker's sheet and the forms show how EduBud works today. Never
  hard-code anything from them (names, chapters, point values, a rule that only makes them come out right): the rules
  go in settings EduBud can change, and tests use made-up volunteers.
- **Volunteers are mostly high school students, many of them minors.** Their data is minors' data: a volunteer sees
  only their own, a chapter leader only their chapter's, and the database's rules enforce it. No public file URLs for
  anything personal.
- **No parent accounts** (the kickoff meeting, 2026-11-16): the participants' families keep calling EduBud.
- **Configurable, not hard-coded:** the point categories and their requirements, chapters, the school year, events,
  and anything else EduBud may change. Values EduBud hasn't confirmed are defaults in code, marked as such.
- **Self-contained** (the owner, 2026-11-18): a student intern may learn on this repository. Don't copy Sky Arc's or
  HyberCRM's code into it wholesale without asking the owner; reusing their patterns and ideas is fine. Keep it
  readable for a newcomer: plain names, short files, a comment where the why isn't obvious.
- **Languages:** the original has a language picker (English and Korean), but its Korean doesn't work today (its
  translation service has used up its word limit). What our copy does with it is decided in `docs/DECISIONS.md` §3
  once the owner has read the replica proposal. Until then: English, with the picker drawn as on the original.

## Owner and production

- The project owner is **Goo Choi** (HyberTec; `@goochoi913` on GitHub). The owner makes the product decisions,
  approves changes to the shared files (`.github/CODEOWNERS`) and gives developers access to the production accounts.
  Each developer uses their own Google and GitHub accounts.
- Production is the Firebase project **`edubud-hybertec`** (project number 257015720209, in HyberTec's Google Cloud
  organization): Authentication (Google, and email and password), Firestore (`nam5`), and Hosting at
  **https://edubud-hybertec.web.app**.
- **edubud.org is still EduBud's Squarespace site.** It moves to our copy only when the owner says so
  (`docs/DEPLOY.md`, "Moving edubud.org"). Until then our copy tells search engines not to index it, so it never
  competes with the original.
- **GitHub deploys `main`** to Hosting after every merge, once CI passes on `main`, and gives each pull request a
  preview link ([`docs/DEPLOY.md`](docs/DEPLOY.md)). Sessions don't deploy by hand. If GitHub Actions is down, deploy
  only from an up-to-date `main`, never from a branch.
- When something in the brief is unclear or conflicts with the code, ask the owner. Open questions live in
  `docs/QUESTIONS.md`; record the answers in `docs/DECISIONS.md` and take them off that list.

## Layout

| Path | What |
|---|---|
| `public/` | What Hosting serves today: a holding page, until the copy of the website lands (its layout comes with it, `docs/proposals/replica.md`). |
| `docs/` | The map of every doc is `README.md`. At the top, the living ones: `DECISIONS.md` (the owner's answers), `QUESTIONS.md` (open questions), `TODO.md` (the owner's to-do, a short checklist) and `DEPLOY.md` (how `main` reaches Firebase). In folders: `proposals/` (proposals, kept after they're decided) and `internal/` (the private notes, git-ignored here: "Local files"). |
| `scripts/` | `check-repo.sh` (CI's guard: no people's data or secrets), `ci-changes.sh` (what a change needs checked and deployed), `internal-docs.sh` (keeps `docs/internal/` up to date when a session starts). |
| `.github/` | `workflows/ci.yml` (checks every pull request and `main`, deploys `main`, previews pull requests), `CODEOWNERS` (the shared files). |
| `firebase.json`, `.firebaserc` | Hosting's settings, and the project. |

## Commands

- Checks, as CI runs them: `bash scripts/check-repo.sh`.
- What CI would check and deploy for your branch: `bash scripts/ci-changes.sh --base origin/main`.
- The website's own commands (install, run, build, compare with edubud.org) come with the copy of the website.

## Conventions

- **Words:** EduBud's own. A **volunteer** belongs to a **chapter** (a high school's), led by its **chapter leaders**;
  the **central team** runs EduBud; the people the learning center serves are **participants**. Check the site and
  the tracker's sheet before naming something new.
- **Time:** EduBud's IANA time zone (`America/New_York`), never the browser's.
- **Confirmations** use the app's own dialog, never the browser's `window.confirm`, and say what will happen.
- **Rules:** every database collection gets explicit security rules; never a catch-all allow. Rules are tested in the
  emulator.
- **Secrets:** the Firebase web settings live in a git-ignored `.env.local` and in GitHub Actions secrets for the
  deploy (`docs/DEPLOY.md`).

## Brand and logos

EduBud's logo and pictures are its own, taken from its Squarespace site at the best quality it holds. Use them as they
are: don't redraw, recolor, stretch, crop or rebuild them from other images. Where each file goes is written here when
the copy of the website lands.

- **Fonts** (the original's): Bricolage Grotesque for headings (700) and DM Sans for text (300) and small labels, both
  free Google Fonts, served from our own Hosting.
- **Colors** (the original's tokens): mint `hsl(158 85% 54%)` (accent), dark green `hsl(161 75% 40%)`, light mint
  `hsl(158 100% 82%)`, near-black `hsl(63 61% 7%)`, white.

## Git and commits

- The repository is HyberTec's: **https://github.com/Hyber-Tec/EduBud**, public since 2026-11-18 ("Secrets" above).
- **Hyber-Tec's rules for AI agents** apply here, as in every Hyber-Tec repository: https://github.com/Hyber-Tec/.github
  (`rules/`, loaded on each computer from `~/.claude/rules/hybertec`; its README says how to set a computer up). Among
  them, GitHub Actions' minutes: this repository's CI is written as if it were private (`docs/DEPLOY.md`, "What CI
  checks").
- **`main` is reached through a pull request** (Strict Rules): CI green, and Claude Code merges its own ("Merging").
  `.github/CODEOWNERS` lists the shared files; the code owner is the project owner, who asks for a review when he
  wants one.
  - GitHub enforces the first part with a ruleset on `main`: a pull request, with CI's check job ("Checks") passing.
    Code-owner approval isn't required (GitHub doesn't let authors approve their own pull requests).
  - Start the branch from the latest `main`, named `<type>/<topic>` (`feat/site-header`). Open the pull request with
    `gh pr create`: the title is a Conventional Commits subject; the body says what changed, how it was checked, and
    what the deploy after merging will do (or that it changes nothing in production). Give the owner its link.
  - CI (`.github/workflows/ci.yml`) runs, in one job, the repository guard and only the checks a change touches
    (`scripts/ci-changes.sh`). Run the parts the change touches before pushing.
- Scopes name the part of the project (e.g. `site`, `replica`, `auth`, `tracker`, `inbox`, `calendar`, `admin`,
  `rules`, `functions`, `deploy`, `ci`). Leave the scope off when a change spans several.
- Breaking changes take `!` before the colon, a `BREAKING CHANGE:` footer, or both.

## Local files

- **Sky Arc and HyberCRM (reference, read-only):** never edit, commit, or push there from an EduBud session, and don't
  copy their code wholesale ("Project Rules"). Their paths on your machine go in `CLAUDE.local.md`.
- **Client material** (the point tracker's sheets, form answers, screenshots, downloads of the old site) can sit in the
  repository folder on the owner's machine, but it's git-ignored and never committed: any PDF, spreadsheet, CSV,
  picture or page at the top level, and the kickoff's and meetings' notes (`EduBud_Kickoff*.md`, `EduBud_Meeting*.md`).
  Folder names may contain spaces; always quote paths.
- **`docs/internal/` is the private notes**: a copy of the private repository
  [Hyber-Tec/Eclipse](https://github.com/Hyber-Tec/Eclipse), git-ignored here. Eclipse is HyberTec's internal notes for
  all of the owner's clients in this family of businesses, a folder each; EduBud's are in `docs/internal/EduBud/`: its
  meetings, the material EduBud shared (`resources/`), and anything else that can't be public. Its README says what
  never goes there: passwords, keys and tokens.
  - A session's start brings the copy up to date and says when it holds changes not pushed (`scripts/internal-docs.sh`,
    run from `.claude/settings.json`). With no copy yet, it makes one, when your GitHub login can read the repository;
    without access, nothing happens.
  - After changing it, commit and push straight to its `main` (it has no pull requests), so sessions on other
    computers see it. Pull before changing it.
