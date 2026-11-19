# Deploys

Production is the Firebase project **`edubud-hybertec`** (project number 257015720209), served at
**https://edubud-hybertec.web.app** (and `edubud-hybertec.firebaseapp.com`). Production runs reviewed code only:
GitHub deploys `main` after every merge, once CI passes on `main`. Nobody deploys from a branch. **edubud.org is still
EduBud's Squarespace site** ("Moving edubud.org", below).

## How a merge reaches production

1. A pull request passes CI (`.github/workflows/ci.yml`: the job "Checks", which runs the checks the change touches,
   "What CI checks" below) and is merged. Before that, when the pull request changes what Hosting serves, CI's
   **Deploy** job gives it a **preview link** (a comment on the pull request, updated on each push, kept 7 days after
   the last one): look at the change there before merging.
2. CI runs again on `main`: the checks the merge touches, then, when the merge changed what Hosting serves, the
   **Deploy** job: `firebase deploy --only hosting`. A merge that changes nothing Hosting serves (the docs) deploys
   nothing, and the job is skipped.
3. The new version is live. To roll back: Firebase console → Hosting → Release history → Roll back, then revert the
   change on `main`.

Runs on `main` go one at a time, in the order of the merges, so a deploy never puts an older `main` over a newer one.
To redeploy `main` without a change: GitHub → Actions → CI → Run workflow on `main`, or
`gh workflow run CI --ref main --repo Hyber-Tec/EduBud`. A run started by hand checks and deploys everything.

## What CI checks

The repository is public, so its standard runners cost nothing, but its CI is written as if it were private
(Hyber-Tec's rules for GitHub Actions, `~/.claude/rules/hybertec/github-actions.md`): a private repository's minutes
come out of the organization's shared monthly allowance, each job rounded up to the next minute.

- **One job checks** ("Checks", the check the ruleset on `main` requires). It runs the repository guard
  (`scripts/check-repo.sh`: no people's data or secrets) for every change, then only what the change can break
  (`scripts/ci-changes.sh`), from its files: a pull request's against `main`, a merge's against the commit before it.
- **The deploy runs apart**, with its own permissions, and only when what Hosting serves changed: `web/`,
  `firebase.json`, `.firebaserc`. It builds the website again from the same commit (a few seconds) rather than taking
  it from the check job as an artifact: its pictures make it a few hundred MB.
- The docs (`docs/`, any `.md`), `.claude/`, `CODEOWNERS` and `.gitignore` run the repository guard alone. A workflow,
  `firebase.json`, `.firebaserc` and `scripts/ci-changes.sh` check and deploy everything, and so does a run started by
  hand. A file the script doesn't know counts as code.
- Each run's summary says what it checked and why. What CI would do for your branch:
  `bash scripts/ci-changes.sh --base origin/main`.
- **Estimate** (2026-11-19, with the website): a run that touches the website is about 2 minutes to check (checkout
  with the pictures, cached packages, typecheck, build) and 2 to 3 more to deploy (a first deploy uploads every
  picture, about 300 MB, and takes longer; later ones upload only what changed). Docs alone: under a minute. A merged
  pull request runs CI about 2.5 times, so 20 website pull requests a month come to about 200 to 250 minutes.

## How GitHub signs in to Google Cloud (no keys)

The Deploy job uses **Workload Identity Federation**: GitHub's OIDC token is exchanged for a short-lived token of a
service account. No service-account key exists. Never create one.

- Pool `github`, provider `github-actions` (issuer `https://token.actions.githubusercontent.com`). The provider only
  accepts tokens from repository ID `1463578804` (`Hyber-Tec/EduBud`) owned by ID `280069423` (`Hyber-Tec`). IDs,
  unlike names, can't be reused by a renamed or recreated repository.
- **`main`** (tokens whose `ref` is `refs/heads/main`) acts as `github-deploy@edubud-hybertec.iam.gserviceaccount.com`.
- **Pull requests** (tokens whose `event_name` is `pull_request`) act as
  `github-preview@edubud-hybertec.iam.gserviceaccount.com`. A fork's pull request gets no token, so no preview.
- Both have Firebase Hosting Admin, Service Usage Consumer and Firebase Viewer, and nothing else: when the database's
  rules or Cloud Functions come, only `github-deploy@` gets the roles to deploy them. Hosting's roles can't tell a
  preview from the live site, so a branch of this repository could deploy the live site by changing the workflow; that
  is no more than write access already allows (merging to `main` needs no approval), so write access is the line.
  Give a newcomer (an intern) a fork, or the Triage role, until they should have it.
- The bindings use the token's `ref` and `event_name`, not its subject: this repository uses GitHub's immutable subject
  format (`repo:Hyber-Tec@280069423/EduBud@1463578804:…`).

How it was created (2026-11-18), to recreate or audit it:

```bash
P=edubud-hybertec; N=257015720209; POOL=principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com --project $P
gcloud iam service-accounts create github-deploy --project $P --display-name "GitHub deploys from main"
gcloud iam service-accounts create github-preview --project $P --display-name "GitHub previews of pull requests"
gcloud iam workload-identity-pools create github --project $P --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-actions --project $P --location global \
  --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.event_name=assertion.event_name" \
  --attribute-condition "assertion.repository_id == '1463578804' && assertion.repository_owner_id == '280069423'"
gcloud iam service-accounts add-iam-policy-binding github-deploy@$P.iam.gserviceaccount.com --project $P \
  --role roles/iam.workloadIdentityUser --member "$POOL/attribute.ref/refs/heads/main"
gcloud iam service-accounts add-iam-policy-binding github-preview@$P.iam.gserviceaccount.com --project $P \
  --role roles/iam.workloadIdentityUser --member "$POOL/attribute.event_name/pull_request"
for sa in github-deploy github-preview; do
  for role in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer roles/firebase.viewer; do
    gcloud projects add-iam-policy-binding $P --member "serviceAccount:$sa@$P.iam.gserviceaccount.com" --role $role --condition=None
  done
done
```

## Firebase web settings

The web settings (API key, app ID, …) are never committed (CLAUDE.md, "Secrets"), though nothing uses them yet: the
sign-in will.

- **Local:** a git-ignored `.env.local` in the website's folder, from Firebase console → Project settings → Your apps →
  **EduBud**.
- **CI:** the repository's Actions secrets `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID` (set 2026-11-18). Change one with `gh secret set <NAME> --repo Hyber-Tec/EduBud`.

## Google Maps key

The map on Day Learning Program is Google's map code, as on the original, with EduBud's own key (created 2026-11-19 in
`edubud-hybertec`, Google Cloud console → APIs & Services → Credentials, "EduBud website - Maps JavaScript API
(browser)"; billing is HyberTec's account, as Sky Arc's). It's a browser key, so it ends up in the page, which is why
it's locked down: it works only for the Maps JavaScript API and only on `https://edubud-hybertec.web.app/*`,
`https://edubud-hybertec.firebaseapp.com/*`, `https://edubud.org/*`, `https://www.edubud.org/*` and
`http://localhost:5173/*` / `http://localhost:5179/*` (the dev server and `scripts/compare/serve.ts`). Its use is free
at EduBud's size (Google's "Dynamic Maps": 10,000 loads a month free).

- **CI:** the Actions secret `GOOGLE_MAPS_API_KEY`, given only to `main`'s build as `VITE_GOOGLE_MAPS_KEY`. A pull
  request's preview isn't one of the key's addresses, so it's built without it and shows Google's keyless embed.
- **Local:** `VITE_GOOGLE_MAPS_KEY=…` in the git-ignored `web/.env.local` (`gcloud services api-keys get-key-string`
  on the key, as a project owner). Without it, the keyless embed.
- **When edubud.org moves here:** its addresses are already allowed. Another address needs adding to the key's
  restrictions first.

## What Hosting serves

`web/build/client`: each page prerendered to its own HTML file, the copy's and the app's (`/login`, `/signup`), as
`web/app/content/paths.ts` lists them (`web/scripts/flatten.mjs` also writes `a/b/index.html` as `a/b.html`, which
`cleanUrls` serves for `/a/b`); `404.html` for any unknown address; the pictures, videos and fonts.
The menu's folders (`/learning-center`, `/initiatives`, `/current-projects`, `/past-projects`, `/about-us`) redirect
to their first page with a 302, as on the original.

## Search engines

Until edubud.org moves here, our copy must never compete with the original in search results. Every response carries
`X-Robots-Tag: noindex, nofollow` (`firebase.json`) and `robots.txt` disallows everything. Both go when the domain
moves (the website then gets its sitemap and canonical addresses on edubud.org).

## Moving edubud.org

Not yet: only when the owner and EduBud say so, after the copy is approved. It will follow Sky Arc's move (that
project's `docs/DEPLOY.md`, "Moving to skyarcacademy.com"): Firebase's **Add custom domain** with advanced setup, so
the Squarespace site stays up until the certificate is ready, then the A record switched in the domain's DNS, and
`www` redirected. The domain's email records (if any) stay exactly as they are. What it changes for EduBud (its
Squarespace plan, the shop, the forms) is in `docs/proposals/replica.md`.
