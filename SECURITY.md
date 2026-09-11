# Security

## Reporting a vulnerability

Do not open a public issue. Use the repository's private vulnerability reporting (the **Security** tab, then **Report a vulnerability**) so the report reaches the maintainers alone. Include the extension version, the steps to reproduce, and what an attacker gains.

You will get an acknowledgement, a fix or a mitigation, and credit in the release notes if you want it. Please allow time for a fix to reach managed browsers before publishing details.

## Supported versions

The latest release on the Chrome Web Store receives fixes. Managed browsers update on their own once a release is through review.

## What the extension does, and does not do

- It talks to one host, the configured service, plus the short host it rewrites. No analytics, no third parties.
- It has no content scripts and never reads page content. Its only contact with a page is the active tab's URL while the popup is open.
- It stores the service address and nothing else; sessions belong to the browser's cookie jar for the service's origin.
- The extension id is pinned by the manifest's `key`, so a deployment can name its exact origin in the service's `EXTENSION_ORIGINS` and refuse every other extension.
