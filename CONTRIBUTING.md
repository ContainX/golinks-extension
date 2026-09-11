# Contributing

Thanks for working on the GoLinks browser extension. This page is the set of expectations every change is held to. `CLAUDE.md` holds the working notes for AI-assisted changes; the rules here apply either way.

## What this extension is

A Manifest V3 Chrome extension in plain TypeScript, HTML, and CSS, bundled with esbuild, with no UI framework and no runtime dependencies. It does three things: rewrites `go/<keyword>` in the address bar to the configured service, offers the `go` keyword in the omnibox, and shows a popup to look up or create a link. It is deliberately small, and changes that grow it beyond those three are discussed before they are written.

## Before opening a pull request

Every one of these has to pass:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm test:e2e` drives a real Chromium against a running deployment with test sign-in on and this extension's id in the deployment's `EXTENSION_ORIGINS`; run it when a change touches the redirect rule, the popup, or sign-in. The README's "Tests" section has the setup.

Format only what you touched: `pnpm exec biome check --write <paths>`.

## Code conventions

- TypeScript strict with `noUncheckedIndexedAccess`; relative imports carry explicit `.ts` extensions.
- Biome formats: single quotes, no semicolons, width 100.
- Pure logic is separated from Chrome APIs and unit-tested on its own: `buildRedirectRule`, `resolveConfig`, the omnibox parsing. The thin layer that touches Chrome is kept thin.
- Comments explain why, briefly.

## Rules that are easy to break

- **The extension id is pinned.** The manifest's `key` field fixes the id, and every deployment lists that origin in its `EXTENSION_ORIGINS`. Never regenerate the key pair, edit the `key` field, or remove it. The one exception is a fork's first release; see "Forking" in the README.
- **No content scripts, ever.** The extension does not inject into pages, does not read page content, and holds no permission that would let it. `activeTab` while the popup is open is the whole of its contact with a page. Anything that would need a content script is out of scope by design.
- **No hosts beyond the configured ones.** The service at `baseUrl` and the short host are the only hosts the extension talks to. No analytics, no third parties.
- **Validation belongs to the service.** Keyword rules are per-organization and live in the deployment. The popup sends what the member typed and shows what the error envelope says; do not reimplement the rules here.
- **Failures are quiet where a member did not ask.** Omnibox suggestions drop silently on any error; the popup, which the member did ask, says what happened.
- **Types are the extension's own.** `src/api.ts` declares only the fields this extension reads and shares nothing with the service at build time, so the two ship on their own schedules.
- **Permissions are justified.** Adding a permission means updating the justification in `docs/store-listing.md` in the same change, and expecting a longer store review.

## Documentation

Documentation describes this extension and its service on their own terms and never compares them to, or references, other products. The README is written for the administrator rolling the extension out; keep that audience in mind.

## Commits, releases, and pull requests

- One change per pull request, code and tests together.
- Commit subjects are short and plain, in the imperative, with no body and no trailers: `Add the release pipeline and forking guide`.
- Releases are cut by bumping the version in `package.json` and pushing a `vX.Y.Z` tag; the release workflow does the rest. `docs/publishing-pipeline.md` describes it. Do not bump the version in a feature pull request.
- Never commit the private key under `.keys/` or any store credential.

## Reporting a security issue

Do not open a public issue for a vulnerability. Contact the maintainers privately through the repository's security advisory page and allow time for a fix before disclosure.
