# EduBud

The website of **EduBud International**, a nonprofit learning center for adults with disabilities with volunteer
chapters of high school and college students, rebuilt by HyberTec in its own code, and the volunteers' tools that come
after it: a sign-in, a volunteer point tracker, one inbox for every interest form, an events calendar and admin pages.
It runs on Firebase (Hosting now; Authentication and Firestore with the features).

**Step 1 is a copy of edubud.org that visitors can't tell from the original**
([`docs/proposals/replica.md`](docs/proposals/replica.md)). It lives at https://edubud-hybertec.web.app; edubud.org
stays on Squarespace until the owner says to move it.

- **Start here:** [`CLAUDE.md`](CLAUDE.md) (the rules, layout and commands) →
  [`EDUBUD_PROJECT_BRIEF.md`](EDUBUD_PROJECT_BRIEF.md) (what we're building) → [`docs/DECISIONS.md`](docs/DECISIONS.md).
- **Deploys:** GitHub deploys `main` after every merge, and each pull request gets a preview link
  ([`docs/DEPLOY.md`](docs/DEPLOY.md)).
- **Open questions:** [`docs/QUESTIONS.md`](docs/QUESTIONS.md).

## Shipping a change

`main` is reached only through a pull request (the full rules: [`CLAUDE.md`](CLAUDE.md), "Git and commits"):

1. Start a branch from the latest `main`: `git switch main && git pull && git switch -c fix/short-topic`.
2. Commit with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), one commit per self-contained
   piece of work and no attribution trailers. Push the branch and open a pull request.
3. **CI** checks it, and gives it a preview link when it changes the website. CI must be green.
4. After the merge, GitHub deploys `main` to https://edubud-hybertec.web.app.
