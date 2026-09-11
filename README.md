# GoLinks browser extension

Makes `go/<keyword>` work in Chrome without touching DNS, and turns the page
you are looking at into a link in two clicks.

- **Short-host redirect.** `go/handbook` in the address bar is rewritten to
  your deployment before the browser looks the host up. It needs no network of
  its own, so it keeps working when the deployment does not. Once your network
  also has a `go` DNS record, the rule simply wins first and lands in the same
  place.
- **`go` omnibox keyword.** Type `go`, a space, then a keyword. While you type,
  matching keywords are offered; Enter goes.
- **Popup.** Click the toolbar button on any page. If a link already points
  there, you get `go/<keyword>` and Copy. If not, you get a keyword field and
  Create.

It has no content scripts, injects nothing into pages, reads no page content,
sends nothing anywhere except the deployment you configure, and has no
analytics. The only thing it ever sends about a page is that page's URL, only
while the popup is open.

## Contributing

`CONTRIBUTING.md` lists what every change is held to: the checks to run, the
conventions, and the rules that are easy to break.

## Install for development

```
pnpm install
pnpm build          # writes dist/ and golinks-extension.zip
```

Then in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked**, and choose this repository's `dist/` directory.
3. Open the extension's options page and enter your deployment's base URL.
4. Allow the two hosts Chrome asks about: the short host it redirects, and the
   deployment whose session it uses.
5. Sign in once in an ordinary tab.

`pnpm dev` rebuilds `dist/` on change. Chrome picks up the new files after
**Reload** on the extension card.

## Configuration

| Value | Default | Where it comes from |
|---|---|---|
| `baseUrl` | none | Enterprise policy, else the options page |
| `shortHost` | `go` | Enterprise policy, else `GET /_/api/v1/me` after connecting |

Policy wins. A managed install shows both values locked and asks for nothing.
An unmanaged install asks for the base URL and reads the rest from the
deployment.

The extension keeps `baseUrl`, `shortHost`, and the organization title in local
storage. Nothing else.

## The extension id is pinned

The manifest carries a `key`, so the unpacked build, the zip, and any store
listing all load under the same id:

```
fabhnbapplciocjepcpgppjnhedbbiae
```

The deployment has to recognize that origin before the popup can create links —
the API's Origin check (spec 02 §6) refuses state-changing requests from
anywhere else. Add it to the service's environment:

```
EXTENSION_ORIGINS=chrome-extension://fabhnbapplciocjepcpgppjnhedbbiae
```

`pnpm extension-id` prints the id; `node scripts/extension-id.mjs --origin`
prints the whole line's worth. The public half of the key pair is committed in
`src/manifest.json`; the private half is written to `.keys/extension-key.pem`
by `pnpm generate-key`, is not committed, and is needed only to sign a `.crx`
for self-hosted updates. Regenerating the pair changes the id, and every
deployment's `EXTENSION_ORIGINS` with it, so do not.

## Forking

The pinned id belongs to whoever published it first, and the private half of
its key is not in this repository. A fork that will publish its own listing, or
sign its own `.crx`, needs an identity of its own. Do this once, before the
first release:

1. `pnpm generate-key --force` writes a new private key to
   `.keys/extension-key.pem` and prints the public key. Put the public key in
   the manifest's `key` field, and keep the private key out of git (it already
   is) and somewhere safe, such as a repository secret or a password manager,
   because it is what signs a self-hosted `.crx`.
2. `pnpm extension-id` now prints the new id. Replace the old id everywhere it
   is written down: this README, `CLAUDE.md`, and every deployment's
   `EXTENSION_ORIGINS`. The code and the tests never hard-code it.
3. Change the name in `src/manifest.json` and `package.json`, the icons under
   `src/icons/` (`node scripts/generate-icons.mjs` if you keep the shape), and
   the listing text in `docs/store-listing.md`.
4. Create the store item by uploading the first zip, then set up the release
   pipeline as `docs/publishing-pipeline.md` describes.

After that the rule in `CLAUDE.md` applies to the fork as it does here: the id
is pinned and must not move again.

## Build for a deployment

Organizations rolling the extension out to everyone build it for their own
service, so nobody types anything:

```bash
BASE_URL=https://links.example.com pnpm build --zip     # SHORT_HOST=go is the default
```

That build bakes the address into the package and declares host access to
the service and the short host as required permissions, which Chrome grants at
install. Force-installed this way, the extension works on first launch with no
options page and no prompt. A generic build (plain `pnpm build`) is what the
public listing carries; it takes the address from policy or the options page and
asks for host access once.

## Publish to the Chrome Web Store

Publishing gets the extension somewhere a force-install policy can point at.

You need a Chrome Web Store developer account: a Google account enrolled in the
developer program for a one-time registration fee, US$5 at the time of writing.
Check the Web Store developer dashboard for the current amount and for what the
account itself has to be. Enroll an account the organization owns rather than
one person's, because the listing outlives whoever created it.

Create the item in the dashboard and upload a zip. `golinks-extension.zip` from
a tagged release is the generic build; a deployment build is one you produce
yourself with the command above.

**The item keeps the pinned id.** The manifest carries the public half of the
key pair and the id is derived from it, which is why the unpacked build, the
zip, and the store item all load as `fabhnbapplciocjepcpgppjnhedbbiae`.
Everything downstream depends on that id: the policies you write, the
deployment's `EXTENSION_ORIGINS`, the browser tests.

So the key has to stay in the packaged manifest. `scripts/build.mjs` copies
`src/manifest.json` into the package unchanged, so it is already in the zip;
what to avoid is stripping it, or letting some other packaging step rewrite the
manifest without it.

Read the id off the item's page in the dashboard once the item exists, before
you write any policy, and confirm it matches. The dashboard is the authority on
what the store assigned. If it does not match, stop there rather than writing
policy against an id that is about to change.

**Visibility.** The store offers three, and a force-install policy works with
any of them, because policy addresses the item by id.

- *Private* limits the item to accounts you name and, when your developer
  account belongs to the organization's Google Workspace, to that domain. This
  is the one to choose for an internal rollout. The dashboard states the
  current rules for publishing to a domain.
- *Unlisted* means anyone with the link or the id can install it, but it does
  not appear in search or browse.
- *Public* is listed and searchable.

**Which build goes on which listing.** A private listing serves one
organization, so put the deployment build on it: the address is baked in, host
access to the service is a required permission, and members get a working `go/`
with nothing to do. A public or unlisted listing is read by people from many
deployments, so it carries the generic build, which asks for the address once.
A deployment build on a public listing would name one organization's service in
its permissions and be useless to everyone else.

**Versions and review.** Every upload needs a version the store has not seen
before. Bump `package.json`; the build copies that version into the packaged
manifest. See [Releases](#releases).

Every upload is reviewed before it reaches anyone, private and unlisted items
included. How long that takes varies, and an item asking for broad host access
is not the fast case, so put review inside the rollout plan rather than after
it. The dashboard shows where a submission has got to.

**Self-hosting instead.** A deployment that cannot use the store at all can
host the package itself. Pack a `.crx` signed with the private half of the
pinned key pair, publish it and an update manifest over HTTPS somewhere the
managed browsers can reach, and point the policy at that update manifest rather
than at the store.

In the platform policy that is one change: `update_url` becomes your update
manifest's address instead of
`https://clients2.google.com/service/update2/crx`. In Workspace it means adding
the extension from a custom URL instead of from the store. The id, the
installation mode, and the policy values are the same either way.

Two things to know before choosing this. The private key is not in the
repository, so only whoever holds the original can sign a `.crx` that keeps the
pinned id. And Chrome installs extensions from outside the store only where
policy says to, which is exactly the managed case here and nowhere else. There
is no review, and you publish an update by replacing the `.crx` and raising the
version in the update manifest.

## Roll out with Google Workspace

The path from a published item to every managed browser having it.

Open the admin console and go to **Devices → Chrome → Apps & extensions →
Users & browsers**.

Select the organizational unit on the left before changing anything. What you
set applies to that unit and everything under it, so start with a small one,
confirm it on a real machine, then move up. Groups work the same way if your
rollout follows groups rather than the directory.

Add the extension with the **+** button at the bottom right, then **Add Chrome
app or extension by ID**, and paste the id:

```
fabhnbapplciocjepcpgppjnhedbbiae
```

Leave the source as the Chrome Web Store. For a self-hosted build, change the
source to a custom URL and give the address of your update manifest.

Set **Installation policy** to **Force install**, or **Force install + pin to
browser toolbar** to put the action button in the toolbar rather than leaving
members to find it in the extensions menu. Force install also means the
extension cannot be removed.

If you rolled out the generic build, paste the deployment's address into
**Policy for extensions** in the panel on the right. That JSON is in
[Force-install with policy](#force-install-with-policy); take it from there
rather than retyping it.

If you rolled out a deployment build, leave that field empty. The address is in
the package already. Setting it anyway is harmless and wins over the build,
which is how you would move an organization to a new address without
rebuilding.

**What members see.** A deployment build works on first launch. `go/handbook`
resolves in the address bar, the `go` keyword is in the omnibox, and there is
no options page and no prompt.

The generic build opens the options page once. The address is already filled in
and locked, and Chrome asks a single question: whether to allow the extension
access to the service's host, and to a non-default short host if you have one.
Chrome asks a person for host access and policy cannot answer for it. Until
someone does, the popup shows a link to that page, and `go/keyword` for the
default short host already works, because `http://go/*` is a required
permission granted at install.

Either build, the popup needs a session. A member who has none sees a Sign in
button that opens the ordinary sign-in page in a tab, once.

**Verify on a managed machine.** Take a machine in the unit you changed.

`chrome://policy` lists what the browser actually received. Look for
`ExtensionSettings` or `ExtensionInstallForcelist` with the id in it and, once
the extension is installed, for its own policies in their own section, with
`baseUrl` and `shortHost` and the values you set. **Reload policies** fetches
again if the machine has not caught up.

`chrome://extensions` shows the extension under the pinned id with its version,
installed by enterprise policy, and no Remove button.

Then type a keyword you know into the address bar as `go/<keyword>`. That is
the part members notice first.

**Updates.** Publish a new version to the store; once it is through review,
managed browsers pick it up on their own schedule, in hours rather than at
once. Nothing changes in the admin console, because the policy names the id and
the id does not move. A member who wants it now can use **Update** on
`chrome://extensions` with developer mode on. Self-hosted, you replace the
`.crx` and raise the version in the update manifest; browsers poll it the same
way.

## Force-install with policy

Chrome Browser Cloud Management, Google Workspace, and platform policy files
all take the same two pieces: force-install the extension, then hand it the
deployment's address.

In Workspace (**Devices → Chrome → Apps & extensions**), set the installation
policy to *Force install* and paste this into **Policy for extensions**:

```json
{
  "baseUrl": { "Value": "https://links.example.com" },
  "shortHost": { "Value": "go" }
}
```

As a platform policy file, the same thing reads:

```json
{
  "ExtensionSettings": {
    "fabhnbapplciocjepcpgppjnhedbbiae": {
      "installation_mode": "force_installed",
      "update_url": "https://clients2.google.com/service/update2/crx",
      "toolbar_pin": "force_pinned"
    }
  },
  "3rdparty": {
    "extensions": {
      "fabhnbapplciocjepcpgppjnhedbbiae": {
        "baseUrl": "https://links.example.com",
        "shortHost": "go"
      }
    }
  }
}
```

`shortHost` can be left out when it is `go`.

The redirect for the default short host needs no click: `http://go/*` is a
required permission, granted at install, so `go/keyword` works the moment a
force-installed extension lands. Host access to the service itself is the one
thing policy cannot hand over: Chrome asks a person before an extension may call
a host. A managed install therefore opens the options page once, where the
member allows the service's origin (and a non-default short host, if any) in a
single prompt and sees the configuration already filled in and locked. Until
then, the popup shows a link to that page.

## Tests

```
pnpm typecheck
pnpm lint
pnpm test        # unit tests: the redirect rule, omnibox parsing, URLs, errors
pnpm test:e2e    # browser tests against a running deployment
```

The browser tests load the unpacked build into a persistent Chromium profile
and need a deployment with test sign-in enabled (spec 02 §8) and this
extension's id in `EXTENSION_ORIGINS`:

```
E2E_BASE_URL=http://localhost:3999 pnpm test:e2e
```

| Variable | Default |
|---|---|
| `E2E_BASE_URL` | `http://localhost:3999` |
| `E2E_TEST_SECRET` | `development-only-test-sign-in-secret` |
| `E2E_TEST_EMAIL` | `jane@widgets.test` |
| `E2E_HEADED` | unset; `1` shows the browser |

They cover the redirect rule, the popup's lookup, create, keyword conflict and
signed-out states, and that the member's session cookie accompanies requests
the extension makes.

`pnpm test:e2e` builds with `--grant-hosts`, which promotes the optional host
permissions to required ones, because Chrome's host-access prompt is browser
chrome that no test driver can click. `pnpm build` always rebuilds `dist/` from
scratch, so the shipped build is never the test one.

## Releases

Bump the version in `package.json` (the build copies it into the manifest),
commit, tag `vX.Y.Z`, and push the tag. The release workflow checks the tag
against the version, runs the checks, attaches `golinks-extension-generic.zip`
to the GitHub release and, when the repository variable `BASE_URL` is set,
`golinks-extension-deployment.zip` as well. With the Chrome Web Store secrets
in place it also uploads one of them to the store item and submits it for
review. `docs/publishing-pipeline.md` has the setup for both.

## Layout

```
src/
  manifest.json         MV3 manifest, including the pinned key
  managed_schema.json   the two values enterprise policy may set
  background.ts         service worker: redirect rule and omnibox
  config.ts             policy over local storage
  redirect.ts           the dynamic declarativeNetRequest rule
  omnibox.ts            the go keyword, its parsing and suggestions
  api.ts                the slice of the HTTP API this extension uses
  errors.ts             error envelope to something a member can read
  url.ts                base URL normalization and joining
  popup/                the action popup
  options/              the options page
  ui/                   shared stylesheet and DOM helpers
e2e/                    Playwright browser tests
scripts/                build, icon, and key/id tools
```

## License

Apache License 2.0. See `LICENSE`.
