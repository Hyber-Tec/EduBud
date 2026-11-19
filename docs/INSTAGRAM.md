# The Instagram feed

Our Team ends with EduBud's Instagram feed (@edubud.international): its 20 newest posts, 4 a row (2 on phones), each
opening in a dark lightbox, a photo with its caption or Instagram's own player for a video. On the original,
Squarespace keeps it current. Ours keeps up by itself through Instagram's official API, once EduBud's account is
connected ("Connect EduBud's account", below). Until then it shows the 20 posts read from the original with the rest of
the page (`web/app/content/widgets.json`).

## How it keeps up

- **Every evening** (6:17 pm in New York, 7:17 in summer; `.github/workflows/instagram.yml`) a short job renews
  Instagram's token,
  asks Instagram for the account's 20 newest posts and compares them with the ones the website shows
  (`https://edubud-hybertec.web.app/media/instagram/feed.json`). A new post, a deleted one or an edited caption: it
  starts CI on `main`. Nothing new: it stops there.
- **Every deploy of `main`** (CI's Deploy job, `node web/scripts/instagram.mjs build`) reads the 20 newest posts from
  Instagram and saves each one's picture on our Hosting (`/media/instagram/<post>/`, WebP in Squarespace's widths up
  to the picture's own), because Instagram's picture addresses stop working after a while. So a merge never drops the
  newest posts, and the website is deployed one way only, in the order of the runs on `main` ([`DEPLOY.md`](DEPLOY.md)).
- **A pull request's preview** copies the live website's posts and pictures; it never reads the token.
- **If Instagram can't be read** during a deploy, the deploy copies the live website's posts instead, and failing that
  shows the original's; the run's summary says so in a warning. The website never breaks because Instagram didn't
  answer.
- **The posts look as before:** a photo shows its picture and its caption; a video (a reel) its cover with the play
  mark, and Instagram's player in the lightbox; a carousel its first picture, as on the original. The grid and the
  lightbox are the same code for the original's posts and Instagram's (`web/app/site/blocks/InstagramBlock.tsx`).

**The token** is the feed's only secret: Instagram's long-lived token for EduBud's account, kept in Google Cloud's
Secret Manager (`projects/edubud-hybertec/secrets/instagram-token`), never in the repository or the website. It lasts
60 days from its last renewal. The evening job renews it (once it's a day old), stores the new one as the secret's
newest version and destroys the older ones, so nobody has to. CI reads it as `github-deploy@`, which may read and
replace that one secret and no other ([`DEPLOY.md`](DEPLOY.md), "How GitHub signs in to Google Cloud"). It lives
there rather than in GitHub's secrets because the job has to replace it, and a workflow's own GitHub token can't
write secrets: that would take a GitHub App and its private key, one more key to keep.

## Connect EduBud's account (once)

About 20 minutes, the owner with EduBud's Instagram account holder (on a call is fine). Nothing to repeat afterwards.

**The account must be a professional account** (Business or Creator) and public: Instagram's API reads no other. It
almost certainly is already, since Squarespace's feed needs the same. To check, in the Instagram app: profile → ☰ →
Settings → Account type and tools. Switching is free and changes nothing visitors see.

1. **A Meta app (the owner).** At https://developers.facebook.com/apps, signed in with your own Facebook account
   (register as a developer if asked): **Create app** → name it "EduBud website" → the use case **Manage messaging &
   content on Instagram** (if it asks for an app type, **Business**; skip connecting a business portfolio) → create.
   Leave it in **Development** mode: an app that only reads an account with a role on it needs no App Review and no
   Business Verification (Meta's "Standard Access").
2. **Invite EduBud's account as a tester (the owner).** In the app: **App roles → Roles → Add people → Instagram
   Tester** → `edubud.international`.
3. **Accept the invitation (EduBud).** On instagram.com, logged in as @edubud.international: **Settings → Website
   permissions → Apps and websites → Tester invites → Accept**.
4. **Generate the token (together).** In the app: **Use cases → Manage messaging & content on Instagram → Customize →
   API setup with Instagram login** (in some dashboards, **Instagram → API setup with Instagram business login** in the
   left menu) → **Generate access tokens**: **Add account** if @edubud.international isn't listed, then **Generate
   token**. Instagram's log-in opens: EduBud's account holder logs in and allows it. Copy the token (it starts with
   `IGAA`; it's shown once). Only the token is kept, never the password.
5. **Store the token in Secret Manager (the owner)**, in a terminal where gcloud is signed in as a project owner:
   ```bash
   P=edubud-hybertec
   gcloud services enable secretmanager.googleapis.com --project $P
   gcloud secrets create instagram-token --project $P --replication-policy automatic
   gcloud secrets versions add instagram-token --project $P --data-file=-   # paste the token, Enter, then Ctrl-D
   for role in roles/secretmanager.secretAccessor roles/secretmanager.secretVersionManager; do
     gcloud secrets add-iam-policy-binding instagram-token --project $P \
       --member serviceAccount:github-deploy@$P.iam.gserviceaccount.com --role $role
   done
   ```
   Then clear the clipboard: the token is nowhere else. Never paste it in a chat, an issue or a file.
6. **Turn the feed on and run it once (the owner):**
   ```bash
   gh variable set INSTAGRAM_FEED --body on --repo Hyber-Tec/EduBud
   gh workflow run Instagram --ref main --repo Hyber-Tec/EduBud
   ```
   The run's summary (GitHub → Actions → Instagram) names the account it read and says it started CI; a few minutes
   later Our Team shows the newest posts. From then on it runs every evening. To look sooner after a post, run it
   again (the second command, or **Run workflow** on that page).

## When something goes wrong

When a scheduled run fails, GitHub emails whoever last changed the workflow's schedule. The website keeps the posts it
has, so visitors see nothing wrong; only new posts wait.

- **"Token: Instagram no longer accepts it"**, **"Token: not renewed … Connect the account again"**, or
  **"Instagram: … (code 190)"**: the token stopped working, or is about to.
  EduBud changed its Instagram password, removed the app in Instagram's settings, lost the tester role or made the
  account personal; or the token lapsed. Do step 4 again, store the new token with step 5's third command
  (`gcloud secrets versions add …`), and run the workflow (step 6's second command). The next renewal destroys the
  old version.
- **"Secret Manager: PERMISSION_DENIED"** or **"NOT_FOUND"**: step 5 isn't complete.
- **A warning, "Token: not renewed"**, with the current token still working: Instagram refused once; the next evening
  tries again. It fails the run only once the stored token is 45 days old, leaving two weeks to look.
- **The repository goes 60 days without a commit** while it's public: GitHub pauses scheduled workflows. GitHub →
  Actions → Instagram → **Enable workflow**. If it stayed paused for about two months, the token has lapsed: connect
  again (steps 4 and 5).
- **To stop:** `gh variable delete INSTAGRAM_FEED --repo Hyber-Tec/EduBud`. The evening runs stop, and the next deploy
  shows the original's posts again. To remove the token as well: `gcloud secrets delete instagram-token --project
  edubud-hybertec`, and delete the Meta app.

## What it costs

- **GitHub Actions** (counted as if the repository were private, Hyber-Tec's rule): the evening run takes about 20
  seconds, billed as a minute, so 30 minutes a month. A day with new posts adds a CI run on `main` (Checks and
  Deploy, under a minute each: 2 minutes). EduBud posts on most days, so about 70 minutes a month, and at most 90 (a
  new post every day). Nothing until the account is connected: the job is skipped. Checking twice a day would add 30
  minutes a month.
- **Secret Manager:** one version of one secret at a time, and a few reads a day: inside its free tier (6 versions
  and 10,000 reads a month for the billing account); at most $0.06 a month if other projects on the billing account
  use up the free versions.
- **Instagram's API:** free, and the two or three calls a day are far below its limits.

## On your computer

```bash
node web/scripts/instagram.mjs build    # the live website's posts, as a preview gets them (none yet: the original's)
npm run dev                             # Our Team shows them
```

With a token from step 4: `INSTAGRAM_TOKEN=… node web/scripts/instagram.mjs build` reads Instagram itself (never
commit a token; the repository guard looks for them). Deleting `web/app/content/instagram.json` goes back to the
original's posts. Both it and the pictures (`web/public/media/instagram/`) are git-ignored.

## Why this way

The owner asked for the feed to update itself, connected once by EduBud (2026-11-19, [`DECISIONS.md`](DECISIONS.md)
§5). The options as they stood that day:

| Option | For | Against |
|---|---|---|
| **Instagram's official API ("Instagram API with Instagram Login") and a daily job: chosen** | Meta's own and free; nobody else gets access to the account, and visitors' browsers call only our Hosting; the posts are prerendered like the rest of the page | A Meta app, and a token to keep alive, which the job does |
| A feed service that holds the token (Behold and the like) | No Meta app; the service renews the token | Behold's free plan shows 6 posts, updated daily; 20 posts take its $10-a-month plan. Another company with access to the account |
| The browser reading a feed (any of these) | No deploys | The prerendered page would show old posts, then swap them; visitors' browsers would call a third party; a public feed address can be used by anyone |
| The same API with Facebook Login | Page tokens that don't expire | Needs a Facebook Page connected to the account (EduBud's site links none), and someone who manages it |
| The newer "Instagram API with Unified Login" | Meta's recommended setup for new apps; its token's expiry is set in its configuration | Built for companies connecting many clients: needs a business portfolio, an HTTPS page of ours to receive the log-in, and a webhook endpoint |
| Reading edubud.org's page (Squarespace keeps the feed current) | No token | Ends when edubud.org moves here |
| Reading Instagram's pages directly | — | Against Instagram's terms, and blocked from servers |

Instagram's Basic Display API, which read personal accounts, was turned off on 2024-12-04, so a professional account
is needed whichever way.

Sources: Meta's Instagram Platform documentation: [overview](https://developers.facebook.com/documentation/instagram-platform/overview)
(access levels, tokens, limits), [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login),
[create an app](https://developers.facebook.com/documentation/instagram-platform/create-an-instagram-app),
[get started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started),
[Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login),
[refresh access token](https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token),
[IG Media](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media),
[Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login),
[changelog](https://developers.facebook.com/documentation/instagram-platform/changelog); GitHub,
[disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows);
Google, [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing); [Behold's pricing](https://behold.so/pricing).
