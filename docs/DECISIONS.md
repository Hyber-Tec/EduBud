# Decisions

The owner's answers and the calls already made. They win over the brief (CLAUDE.md). Add new answers at the end of the
matching section, with the date.

## 1. Product (the kickoff meeting, 2026-11-16)

- **Keep EduBud's design.** HyberTec rebuilds edubud.org in its own code, so it looks the same to EduBud and its
  visitors, then adds a sign-in, the volunteer point tracker, one inbox for the interest forms, an events calendar, and
  admin pages to change the website's photos and text.
- **A phone app comes last**, after everything else is ready, if EduBud wants one.
- **No parent accounts** and no progress reports for the participants' families.

## 2. Setup (2026-11-18)

- **Repository:** https://github.com/Hyber-Tec/EduBud, **public** (the owner: no Actions limits to think about while
  it's public; it goes private when he says). Its CI is written as if private all the same (Hyber-Tec's rules for
  GitHub Actions). Client-internal details and people's data stay in the private notes (`docs/internal/`, a copy of
  Hyber-Tec/Eclipse).
- **The same way of working as Sky Arc** (the owner): its CLAUDE.md's rules for branches and pull requests, commits
  (Conventional Commits, few of them, no attribution), secrets, UI and the "AI" naming, and Claude Code merging its
  own pull requests once CI is green.
- **Self-contained:** a student intern may learn on this repository, so Sky Arc's and HyberCRM's code isn't copied in
  wholesale without the owner's OK; their patterns and ideas are fine.
- **Firebase:** the project `edubud-hybertec` (Authentication with Google and email/password, Firestore `nam5`,
  Hosting at `edubud-hybertec.web.app`), created by the owner. GitHub deploys `main` to Hosting and gives pull requests
  preview links, signing in without keys ([`DEPLOY.md`](DEPLOY.md)). Until edubud.org moves, the copy isn't indexed by
  search engines.
- **One step at a time:** step 1 is the copy of the website, proposed first ([`proposals/replica.md`](proposals/replica.md))
  and built once the owner approves; the features come after the owner has compared the copy with the original.

## 3. The copy of the website (the owner, 2026-11-18)

- **Go as proposed** ([`proposals/replica.md`](proposals/replica.md)): rebuild edubud.org in our own code from a capture
  of the live site, React and TypeScript with Vite and React Router's prerendering, on Firebase; checked against the
  original page by page at five widths, with one side-by-side report. The goal: identical for visitors.
- **No Korean (Q1):** the language picker is removed, as on Sky Arc. English only, everywhere.
- **The shop and donations look the same, and do nothing yet (Q2, Q3):** the product pages, cart and donation form are
  copied as they look; buying or donating doesn't work for now. Payments (Stripe, EduBud's own account) are a later
  talk with the founder.
- **The forms (Q4):** they look, check and thank like today, but store nothing until the forms inbox; they become
  real before the domain moves.
- **Pictures and videos in this repository (Q5):** they're on the public website anyway, and the repository goes
  private later. No Cloud Storage for them.
- **EduBud doesn't edit the Squarespace site:** no need to ask the founder to hold changes (E1 dropped).
