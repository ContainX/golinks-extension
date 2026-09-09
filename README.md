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
