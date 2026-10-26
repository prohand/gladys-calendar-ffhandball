# FFHandball Calendar — Gladys Assistant integration

External integration putting the matches of French handball teams in the
[Gladys Assistant](https://gladysassistant.com) **calendar**, from **ffhandball.fr**, the
website of the French handball federation: professional, national, regional or departmental
teams, one calendar per team, one event per scheduled match, with its hall and its score.

It is the calendar companion of [FFHandball](https://github.com/prohand/gladys-ffhandball)
(devices, scene triggers and widgets): a Gladys integration has one type, and a calendar
integration has no devices, hence two integrations.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

User documentation: [English](./docs/en.md) · [Français](./docs/fr.md) · [Deutsch](./docs/de.md)
· [Español](./docs/es.md).

> Not affiliated with the Fédération Française de Handball. The integration reads the public
> website, the way a browser does.

## What it does

| Surface                         | Content                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **My calendars** (one per user) | The team page addresses of that user, one per line                                                              |
| **Calendar** (one per team)     | Named after the team and its competition, with its own color; private until the user shares it                  |
| **Event** (one per match)       | Teams (score once played), kick-off for 1 h 30, hall and address, competition, round, home / away, result, link |
| **Configuration**               | Refresh interval · Sync now · List the teams of a competition                                                   |

The events feed everything Gladys does with a calendar: the calendar view, the "event is
coming" scene trigger, the calendar scene actions and the assistant. Every text is in
**English, French, German and Spanish**; the event descriptions follow each user's language.

## How it reads ffhandball.fr

The federation publishes no public API. Its website renders every competition block from a
WordPress REST route, `wp-json/competitions/v1/computeBlockAttributes`, whose answers are
obfuscated (base64 + XOR with a key printed on every page). The integration reads that key
from a page, decodes the answers exactly as the site's own JavaScript does, and reads two
blocks per team: the pool and the season's matches (dates, teams, scores).

The halls are not in that data. They come from the club's iCalendar feed, the one behind the
site's "Add the matches to your calendar" button
(`competition-calendar.ffhandball.fr/c-<competition>/s-<club>.ics`), whose ids are read once
from the team page. Without that feed, the matches still go to the calendar, without hall.
See [`src/ffhandball/client.js`](./src/ffhandball/client.js).

It only sends public `GET` requests, every 60 minutes by default, each team once however many
users follow it; the site caches its answers an hour anyway. No account, no key, nothing to
install, no file written: the calendars live in Gladys.

## How it syncs

Every refresh, and whenever a user changes their **My calendars** block, the integration
upserts one calendar per team and republishes the season of each team as a **window**
(July to July): a moved match moves, a match that loses its date leaves, nothing else is
touched. Only what changed since the last push is sent, under the core's limit of 30 calendar
writes per minute. See [`src/sync.js`](./src/sync.js).

## Project structure

```
.
├─ index.js                          # SDK bootstrap + event wiring
├─ src/
│  ├─ config.js                      # defaults, team / competition address parsing
│  ├─ i18n.js                        # en, fr, de, es
│  ├─ sync.js                        # the sync loop, the write limiter
│  ├─ calendar.js                    # one team -> one calendar, one match -> one event
│  ├─ ffhandball/
│  │  ├─ client.js                   # ffhandball.fr reader (key, decoding, blocks, feed)
│  │  ├─ ics.js                      # the venues of a club's iCalendar feed
│  │  ├─ team.js                     # raw blocks -> one team, from its own side
│  │  └─ format.js                   # texts per language
│  └─ capabilities/actions.js        # Configuration screen buttons
├─ docs/{en,fr,de,es}.md             # user documentation (re-hosted by Gladys)
├─ test/                             # node --test, fake ffhandball.fr + SDK fake Gladys
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · SECURITY.md · CLAUDE.md
└─ .github/                          # CI, Release, build, GitHub releases, Dependabot
```

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="ffhandball-calendar" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor in the container.

## Quality checks

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test: no network, a fake ffhandball.fr and the SDK fake Gladys
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI runs the first three on Node 22 and 24 for every push and pull request, and on pull
requests the store checks and a Docker build.

## Release

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`.

The workflow bumps `package.json`, the manifest `version` and `docker_image`, moves the
changelog section, pushes the `vX.Y.Z` tag, builds the `linux/amd64` + `linux/arm64` image to
`ghcr.io/prohand/gladys-calendar-ffhandball` and publishes the GitHub Release.

For the store: the repository must be public and carry the GitHub topic
`gladys-assistant-integration`, and the GHCR package must be public.

## License

Apache-2.0
