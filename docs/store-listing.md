# Chrome Web Store listing

The text below is what you paste into the Web Store developer dashboard when
you create or edit the item. The surrounding steps, the account, the
visibility, the review cycle, are in the README under **Publish to the Chrome
Web Store**.

Field names in the dashboard move around. Where one below does not match what
you see, match it by what the field is asking for, and check the dashboard
rather than assuming this file is current.

## Name

```
GoLinks
```

## Summary

132 characters or fewer. This is the same sentence as the `description` field
in `src/manifest.json`; keep the two identical so they cannot drift.

```
Type go/keyword in the address bar, and turn the page you are on into a go link.
```

## Description

```
GoLinks turns short keywords into full URLs. Type go/handbook in the address
bar and you land wherever your organization has pointed that keyword.

What it does

- Redirects the short host. A request for go/<keyword> is rewritten to your
  organization's GoLinks service before the browser looks the host up, so it
  works on any machine that has the extension, with or without a DNS record
  for it. The rule needs no network of its own, so it keeps working when the
  service does not.
- Adds a go keyword to the address bar. Type go, a space, then a keyword.
  Matching keywords are offered while you type. Enter goes.
- Creates links from the toolbar button. Open the popup on any page. If a link
  already points there, you get the short form and a Copy button. If not, you
  get a keyword field, the page's URL as the destination, and Create.

What it does not do

- It has no content scripts and injects nothing into any page.
- It does not read page content.
- It talks to one service: the address your administrator configured, or the
  one you entered on the options page. It contacts nothing else and no third
  party.
- It has no analytics, no telemetry, and no tracking.
- It does not handle sign-in. It uses the session you already have with your
  organization's service, and never sees a password or a token.
- It runs no remote code. Everything it executes is in the package.

Setup

A managed install is configured by policy and needs no setup. Otherwise, open
the options page, enter your organization's service address, allow the two
hosts Chrome asks about, and sign in once in an ordinary tab.
```

## Category

```
Workflow & Planning
```

If the dashboard's list does not have that, `Tools` is the closest. Pick from
the list the dashboard actually shows.

## Screenshots

1280x800, up to five. Take them on a clean profile against a demonstration
organization: no real keywords, no real destinations, no member names or
addresses.

1. The address bar with `go/handbook` typed, and the destination page behind
   it. The redirect is what people install this for, so lead with it.
2. The omnibox after `go` and a few letters, with the suggestion list open and
   its `go/<keyword>` rows visible.
3. The popup on a page that already has a link: the short form and the Copy
   button.
4. The popup on a page with no link yet: the keyword field, the page's URL as
   the destination, and Create.
5. The options page after connecting: the service address and the status
   panel.

## Single purpose

```
GoLinks resolves short keywords to full URLs against one GoLinks service, the
one the user's administrator configured or the user entered, and creates those
keywords from the page the user is on. Every permission it holds serves that
purpose and nothing else.
```

## Permission justifications

One per permission in the manifest.

**`declarativeNetRequest`**

```
One dynamic rule, which rewrites a request for the short host to the configured
service so that go/<keyword> resolves. The rule is declarative: the extension
does not read, observe, or block any request, including the ones the rule
matches.
```

**`declarativeNetRequestWithHostAccess`**

```
It scopes that rule to hosts the user has granted the extension, rather than
letting it act on all traffic. The redirect cannot apply to a host the user has
not allowed.
```

**`storage`**

```
Stores the service's address, the short host, and the organization's title on
the device, and reads the values an administrator sets through enterprise
policy. Nothing else is stored.
```

**`omnibox`**

```
Registers the go keyword in the address bar, which is how a member types
go <keyword> and gets a suggestion list. The feature does not exist without it.
```

**`activeTab`**

```
The popup reads the URL of the tab it was opened on, so it can say whether a
link already points there and offer that URL as the destination for a new one.
It reads that URL only while the popup is open, and reads nothing else about
the tab or its content.
```

**Host permission `http://go/*`**

```
The default short host. Declaring it as required means the redirect works the
moment the extension is installed, including an install pushed by an
administrator, with nothing for the member to click.
```

**Optional host permissions `http://*/*` and `https://*/*`**

```
The service's address differs per organization and is not known when the
extension is packaged, so it cannot be listed literally. The extension holds
these as optional and requests exactly one origin, the address the member or
their administrator gave it, at the moment it is entered. The member grants
that origin; the extension asks for nothing broader and uses nothing broader.
```

If you are uploading a build made for a single organization, add: that build
declares the organization's own origin as a required permission, so Chrome
grants it at install and the member is asked nothing.

## Data use

Declare, in the dashboard's privacy section:

```
The extension sends data to exactly one place: the GoLinks service address set
by enterprise policy, baked into the packaged build, or entered by the user on
the options page. It sends nothing to the developer and nothing to any third
party.

What it sends to that service: the URL of the active tab, while the popup is
open, to ask whether a link already points there; the keyword text typed after
the go keyword, to fetch matching suggestions; the keyword and destination of a
link the user chooses to create; and a request for the signed-in member's own
account details, to show who is signed in and to read the organization's short
host.

Requests carry the session cookie the user already has with that service. The
extension never handles credentials or tokens.

What it keeps on the device and sends nowhere: the service's address, the short
host, and the organization's title.

There are no analytics, no telemetry, no advertising, no third parties, and no
remote code.
```

The URL of a page a member acts on is the only user data that leaves the
device. If the dashboard asks you to tick a category for it, that is the one to
tick, under whatever the dashboard currently calls web history or browsing
activity, with the paragraphs above as the justification. Read the labels there
rather than assuming this list; they change.

You are also asked to certify three things. All three hold for this extension:
that you do not sell user data, that you do not use or transfer it for any
purpose unrelated to the item's single purpose, and that you do not use or
transfer it to determine creditworthiness or for lending.

## Privacy policy

The dashboard wants a URL, not pasted text. Host this statement where your
members can read it, a page on the service itself is fine, and give the
dashboard that address.

```
GoLinks does not collect, store, or transmit personal data to its developer or
to any third party.

The extension communicates only with the GoLinks service configured for it:
your organization's deployment, set by your administrator or entered by you. To
that service it sends the URL of the tab you have open, and only while the
extension's popup is open; the keyword text you type after the go keyword, to
fetch suggestions; and the keyword and destination of a link you choose to
create. Requests carry the session cookie you already have with that service;
the extension never sees your password or any token.

On your device it stores the service's address, the short host, and your
organization's title, and nothing else.

It has no content scripts, reads no page content, runs no remote code, and
contains no analytics or tracking of any kind.

What your organization's own GoLinks service records is governed by your
organization's privacy policy.
```
