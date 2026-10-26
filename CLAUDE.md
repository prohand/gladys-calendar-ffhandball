# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and to human contributors when
working with code in this repository.

## What this is

A Gladys Assistant **external integration of type `calendar`** (Node 22+, ESM, no build step,
one runtime dependency: `@gladysassistant/integration-sdk`) that puts the matches of French
handball teams, read on **ffhandball.fr**, in the Gladys calendar: each user who enables it
lists team pages in **My calendars** (`account_schema`), each team becomes one of their
calendars, each scheduled match an event (teams and score, kick-off, hall, round, result,
link). Gladys 5.3+ (`gladys_version >=5.3.0`: the calendar type needs 5.2, `keywords` and
`countries` 5.3). France only (`countries: ["FR"]`).

The calendar companion of [prohand/gladys-ffhandball](https://github.com/prohand/gladys-ffhandball)
(type `device`: devices, scene triggers, widgets). A manifest has one type and a calendar
integration has no devices, hence two repositories. The ffhandball.fr reader
(`src/ffhandball/client.js`, `team.js`, `src/config.js` address parsing) comes from there:
a fix to the reading of the site usually belongs in both.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/sync.test.js               # one file
node --test --test-name-pattern "window"    # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store .   # store admission checks
```

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `test` on Node 22 and 24, and on
pull requests the store checks and a Docker build: run the three commands before pushing.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/config.js                DEFAULT_CONFIG / DEFAULT_ACCOUNT (mirror the manifest) + URL parsing
src/i18n.js                  LANGUAGES (en, fr, de, es), pick, localize
src/ffhandball/client.js     ffhandball.fr reader: computeBlockAttributes + data-cfk key, club feed
src/ffhandball/ics.js        LOCATION by UID out of an iCalendar feed
src/ffhandball/team.js       raw blocks -> one team, from its own side (opponent, result, venue)
src/ffhandball/format.js     texts per language
src/calendar.js              team -> calendar, match -> event, season window (pure)
src/sync.js                  sync loop (refresh clock, per-user sync, write limiter)
src/capabilities/actions.js  Configuration screen buttons (sync_now, list_teams)
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys
test/                        node --test, fake ffhandball.fr (test/helpers/fakeFfhb.js) + SDK fake Gladys
```

### How ffhandball.fr is read

There is no public API. The website renders its competition blocks from
`/wp-json/competitions/v1/computeBlockAttributes?block=<name>&ext_saison_id=…&url_competition_type=…&url_competition=…&ext_equipe_id=…`.
The answer is a JSON string: base64 of the JSON XORed with a key the site prints on every page
(`<body data-cfk="…">`). `FfhbClient` reads the key once from `/competitions/`, and again only
when an answer stops decoding (key rotation). Blocks used: `competitions---poule-selector`
(team + pool), `competitions---rencontre-list` (season matches).

The halls come from the club's iCalendar feed
`https://competition-calendar.ffhandball.fr/c-<ext_competitionId>/s-<ext_structureId>.ics`
(UID = the match's internal `id`, LOCATION = hall and address). Both ids are only printed in
the team page, in the `attributes` of `<smartfire-component name='competitions---calendar-button'>`
(HTML-escaped JSON): read once per team, kept in memory. The venues are a bonus: any failure
gives no location, never an error.

A team page address is
`/competitions/saison-<Y>-<Y+1>-<seasonId>/<type>/<competition-slug>/equipe-<teamId>/`
(`seasonId` = year − 2004); a match page is the competition prefix +
`poule-<extPouleId>/rencontre-<ext_rencontreId>/`.

### Invariants worth knowing

- **External ids are forever** and **user-scoped** (`ext:<selector>:<user>:…`, the SDK checks
  the prefix): calendar `…:<user>:team-<ext_equipeId>`, event
  `…:<user>:team-<ext_equipeId>:match-<ext_rencontreId>` (the team id keeps a match between
  two followed teams in both calendars: the core moves an event republished elsewhere). Config,
  account and action keys are stored too: never rename them. Team ids change every season: a
  new calendar, by design.
- **A window push replaces the window.** Each team's events go with the season window (July to
  July, widened to cover every event): never push a partial list with it. A team that could not
  be read is not pushed at all (its calendar stays as it was).
- **The user owns `sync`, `shared`, `selector`.** A `sync: false` calendar is skipped (403
  otherwise); only the integration's own calendars of teams no longer listed are deleted.
- **30 calendar writes per minute per integration**: writes go through `WriteLimiter` and are
  only sent when their payload changed (`CalendarSync.published`, forgotten on reconnection
  and on every account change).
- **No state on disk**: the rootfs is read-only and nothing needs to survive a restart (the
  first sync after a start pushes everything again). Tests never touch the network.

## Rules

- **Versions belong to the Release workflow** (Actions → Release). Never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand. `test/manifest.test.js`
  checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version
  heading: the Release workflow moves the section.
- **Manifest.** Every text is `{ en, fr, de, es }` (test enforced), catalog description 10–100
  characters per language. `test/manifest.test.js` ties the manifest to the code (defaults of
  `config_schema` and `account_schema`, action handlers): change both sides together. It also
  pins the catalog fields: `categories` (1–3, `leisure` among them), `keywords` (1–10 unique
  terms of 2–30 characters) and `countries` (`["FR"]`), and the `gladys_version` floor.
- **User-facing text** is in the four languages: messages (`localize` / `pick`), event
  descriptions (in the owner's language, `user.language`), manifest, and `docs/en.md`,
  `docs/fr.md`, `docs/de.md`, `docs/es.md`, kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English.
