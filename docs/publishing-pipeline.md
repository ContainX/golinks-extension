# Publishing pipeline

How a tag becomes a release, and how a release reaches the Chrome Web Store without anyone
uploading a zip by hand. The workflow is `.github/workflows/release.yml`; this page is the
setup it needs.

## What the workflow does

On a push of a tag `vX.Y.Z`:

1. Checks that the tag matches the version in `package.json`, which the build copies into the
   manifest. A mismatch fails the run before anything is built.
2. Runs typecheck, lint, and the unit tests.
3. Builds the generic zip, `golinks-extension-generic.zip`.
4. If the repository variable `BASE_URL` is set, builds the deployment zip too,
   `golinks-extension-deployment.zip`, with that address baked in and host access to it
   declared as a required permission (see "Build for a deployment" in the README).
5. Attaches every zip to the GitHub release for the tag.
6. If the Chrome Web Store secrets are set, uploads one zip to the store item and submits it
   for publication.

Steps 4 and 6 are skipped, without failing, when their variable or secrets are absent. A
fork that only wants release zips sets nothing.

## Cutting a release

```bash
# bump the version in package.json (the build writes it into the manifest)
git commit -am "Release 1.1.0"
git tag v1.1.0
git push && git push --tags
```

## Deployment build in CI

Repository **variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `BASE_URL` | the service's canonical address, for example `https://links.example.com` |
| `SHORT_HOST` | optional; the short host when it is not `go` |

## Publishing to the Chrome Web Store

The store item is created once by hand: upload the first zip in the developer dashboard,
fill in the listing from `store-listing.md`, and note the item id on its page. The workflow
updates that item; it does not create one.

Then obtain API credentials. The Chrome Web Store API is a Google API, so it is reached with
an OAuth client and a refresh token belonging to a Google account that owns the item or is in
its publisher group.

1. **Create a Google Cloud project** (or use an existing one) at console.cloud.google.com, and
   under **APIs & Services → Library** enable the **Chrome Web Store API**.
2. **Configure the OAuth consent screen.** For an organization on Google Workspace, choose
   **Internal**; the refresh token then does not expire. An **External** app left in the
   *Testing* publishing status issues refresh tokens that expire after seven days, which
   would break the workflow silently a week later, so if External is the only option, publish
   the consent screen.
3. **Create an OAuth client** under **APIs & Services → Credentials → Create credentials →
   OAuth client ID**, application type **Desktop app**. Keep the client id and client secret.
4. **Obtain a refresh token** for the scope `https://www.googleapis.com/auth/chromewebstore`.
   The quickest way is the OAuth 2.0 Playground at developers.google.com/oauthplayground: open
   its settings (the gear), tick **Use your own OAuth credentials**, paste the client id and
   secret, enter the scope above in the box on the left, authorize as the account that owns
   the store item, then **Exchange authorization code for tokens** and copy the refresh
   token.
5. **Set the repository secrets** (Settings → Secrets and variables → Actions → Secrets):

   | Secret | Value |
   |---|---|
   | `CWS_EXTENSION_ID` | the store item id, 32 lowercase letters |
   | `CWS_CLIENT_ID` | from step 3 |
   | `CWS_CLIENT_SECRET` | from step 3 |
   | `CWS_REFRESH_TOKEN` | from step 4 |

   And, optionally, the variables:

   | Variable | Value |
   |---|---|
   | `CWS_UPLOAD` | `deployment` or `generic`; which zip goes to the store. Unset, the deployment zip is used when there is one, else the generic one. A private listing wants the deployment build; a public or unlisted listing wants the generic one. |
   | `CWS_PUBLISH_TARGET` | `trustedTesters` to publish to the item's trusted testers list instead of to everyone the listing's visibility allows |

The item id stays the same across uploads because the manifest carries the `key` field; see
"The extension id is pinned" in the README. If the id on the item's page differs from the
pinned id, stop and read "Forking" in the README before publishing anything.

## After the run

The store reviews every upload before it reaches anyone, private items included. The
workflow's publish step submits for review; the dashboard shows where the submission is.
Managed browsers pick up the new version on their own schedule once it is through.

## Doing it by hand

Without the secrets, the workflow still attaches the zips to the GitHub release. Download the
one the listing wants and upload it in the developer dashboard, as the README's "Publish to
the Chrome Web Store" section describes.
