# GoLinks extension — working notes

A Manifest V3 Chrome extension. Plain TypeScript, HTML, and CSS; esbuild
bundles it; there is no UI framework and there are no runtime dependencies.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Rebuild `dist/` on change |
| `pnpm build` | Rebuild `dist/` from scratch and write `golinks-extension.zip` |
| `pnpm typecheck` | `tsc --noEmit`, strict, with `noUncheckedIndexedAccess` |
| `pnpm lint` | Biome: single quotes, no semicolons, width 100 |
| `pnpm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm test:e2e` | Playwright browser tests against `E2E_BASE_URL` |
| `pnpm extension-id` | Print the pinned id |
| `pnpm generate-key` | Generate a new key pair — see the rule below first |

All four of `typecheck`, `lint`, `test`, and `build` must pass before a change
is finished.

## Layout

- `src/manifest.json` — the manifest, including the pinned `key`.
- `src/background.ts` — the service worker. It owns the redirect rule and the
  omnibox keyword, and re-registers both on every start, because MV3 tears the
  worker down whenever it likes.
- `src/config.ts` — `storage.managed` over `storage.local`. `resolveConfig` is
  pure; the storage plumbing around it is not.
- `src/redirect.ts` — `buildRedirectRule` is pure and unit-tested;
  `syncRedirectRule` is the only thing that touches Chrome.
- `src/omnibox.ts` — parsing and formatting are pure; `registerOmnibox` takes
  its configuration and navigation as dependencies.
- `src/api.ts` — the API slice, with the extension's own types for it.
- `src/popup/`, `src/options/` — one HTML shell each plus a TypeScript entry
  point. Both load `src/ui/ui.css`.
- `e2e/fixtures.ts` — the Chromium profile, the destination server, test
  sign-in, and the popup helper.

`scripts/build.mjs` maps `src/background.ts`, `src/popup/popup.ts`, and
`src/options/options.ts` to `dist/*.js`, copies the HTML, CSS, icons, manifest,
and managed schema, and syncs the manifest version from `package.json`.

## Rules

**The extension id is pinned and must not move.** The manifest's `key` field
fixes the id at `fabhnbapplciocjepcpgppjnhedbbiae`. Every deployment lists that
origin in `EXTENSION_ORIGINS` so the API's Origin check accepts the popup's
requests. Changing the key breaks every one of them at once. Never regenerate
the key pair, never edit the `key` field, and never remove it "because the
store assigns an id anyway". `scripts/generate-key.mjs` refuses to overwrite an
existing private key without `--force` for the same reason.

The one exception is a fork's first release. The id above is owned by the
original publisher and its private key is not in the repository, so a fork
generates its own key pair once, before publishing anything, and follows
"Forking" in the README to take the new id everywhere. After that the rule
above applies to the fork's id.

**Releases and publishing** are `.github/workflows/release.yml`, driven by a
`vX.Y.Z` tag that must match `package.json`; `docs/publishing-pipeline.md` is
the setup. `ci.yml` runs the checks on branches and pull requests only.

**No content scripts, ever.** The extension does not inject into pages, does
not read page content, and holds no permission that would let it. The popup
reads the active tab's URL through `activeTab` while it is open, and that is
the whole of the extension's contact with a page. Anything that would need a
content script — unfurling `go/` mentions, rewriting links in a document — is
out of scope by design, not by omission. The same goes for analytics and for
any host besides the configured `baseUrl` and short host.

**Validation belongs to the service.** Keyword rules are per-organization and
live in the deployment. The popup sends what the member typed and renders
whatever the error envelope says. Do not reimplement the pattern here.

**Failures are quiet where a member did not ask.** Omnibox suggestions drop
silently on any error, including 401. The popup, which the member did ask, says
what happened.

**Types are the extension's own.** `src/api.ts` declares only the fields this
extension reads. It shares nothing with the service at build time on purpose,
so the two ship on their own schedules.

## The redirect rule

One dynamic rule, id 1, `main_frame` only. The capture stops before `?` and
`#`, and the substitution appends `via=ext` itself; a query typed against the
short host is dropped, which costs nothing because the resolver reads the path
and `via` and ignores the rest. That is what lets a single static substitution
always join the parameter with the right separator. Tests apply the built rule
the way Chrome would, so they read as behavior rather than as string equality.

## Deployment builds

`BASE_URL=... pnpm build` writes `dist/deployment.json` and adds the service's
origin and the short host to `host_permissions`. `config.ts` reads that file
below policy and above the options page, so a deployment build locks the
address the same way policy does (`lockedBy: 'build'`). The generic build has
no such file and keeps host access optional.

## Browser tests

They need a running deployment with test sign-in on and this extension's id in
`EXTENSION_ORIGINS`. `pnpm test:e2e` builds with `--grant-hosts`, which promotes
the optional host permissions to required ones, because Chrome's host-access
prompt is browser UI a driver cannot click. That flag exists for tests only.

The popup opens as a normal page in those tests, with `?tab=<url>` standing in
for the active tab, because a real popup has no address to navigate to.
