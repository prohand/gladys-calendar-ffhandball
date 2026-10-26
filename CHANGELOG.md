# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The matches of French handball teams in the Gladys calendar, from ffhandball.fr: each user
  who enables the integration pastes the addresses of their team pages in **My calendars**, separated by commas,
  and each team becomes one of their calendars (Gladys 5.3.0 or later).
- One event per scheduled match: the teams (and the score once played), the kick-off for
  1 h 30, the hall and its address (from the club's calendar feed on ffhandball.fr), the
  competition, the round, home or away, the result, and a link to the match page.
- Rescheduled matches move, matches that lose their date leave the calendar, a team removed
  from the list loses its calendar; a calendar whose sync is turned off is left alone.
- Configuration screen: the refresh interval (60 minutes by default), the "Sync now" and
  "List the teams of a competition" buttons.
- English, French, German and Spanish everywhere: configuration screen, messages, event
  descriptions (in each user's language) and documentation.
- CI (format, lint, tests on Node 22 and 24, store checks and Docker build on pull requests),
  UI-driven Release workflow, multi-arch image build, GitHub Releases, Dependabot.
- `SECURITY.md`, `CLAUDE.md` and this changelog.

[Unreleased]: https://github.com/prohand/gladys-calendar-ffhandball/commits/main
