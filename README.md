# education

A daily-updated JSON compilation of [JetBrains/swot](https://github.com/JetBrains/swot)'s
academic email domain list, for programmatically checking whether an email
address belongs to an educational institution - including its organization
name and country.

## Correcting bad data

The `country` field (and occasionally `org`) is derived automatically and
is sometimes wrong - e.g. an institution's domain sits under a generic TLD
that carries no country info, or ends in a retired ccTLD like `.su`.

Each entry is matched by exact `domain` and patches `country` and/or `org`
on top of whatever swot derived for it - it doesn't need to touch `data/`.

Overrides are reapplied on every build, so they survive the daily rebuild
instead of being overwritten by it. If a `domain` doesn't appear in the
compiled data (it's missing from swot entirely, or swot renamed it).

```json
[
  {"domain": "kstu.su", "country": "RU", "note": "Historical domain, institution is Russian"}
]
```

## Usage

The package ships code only - `data/database.json` isn't bundled, so it never
goes stale relative to the daily rebuild. `loadSwotIndex` is async: call it
with no argument to fetch the latest database straight from this repo on
GitHub, or pass a local path (e.g. your own clone's `data/database.json`) to
avoid the network round-trip:

```sh
npm install education-email
```

```ts
import { loadSwotIndex, checkEducationalEmail } from "education-email";

const index = await loadSwotIndex(); // fetches the latest database.json from GitHub
const index = await loadSwotIndex("/path/to/database.json"); // local offline example

checkEducationalEmail("student@cs.acu.edu.au", index);
// => {educational: true, organization: "Australian Catholic University", country: "AU"}

checkEducationalEmail("me@gmail.com", index);
// => {educational: false, organization: null, country: null}
```