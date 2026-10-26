# FFHandball Calendar

This integration puts the matches of your handball teams in the **Gladys calendar**, from
**ffhandball.fr**, the website of the French handball federation: professional leagues,
national, regional and departmental championships. Each team becomes a calendar, with every
scheduled match, its hall, its link and, once played, its score.

No account, no key: the integration reads the public website, over the internet.

Requires **Gladys 5.3.0 or later**.

This integration only does the calendar. For the standings, the live results, the dedicated
scene triggers and the widgets, install the **FFHandball** integration too: both work
together, with the same team addresses.

## Add your teams

1. On [www.ffhandball.fr/competitions](https://www.ffhandball.fr/competitions/), pick the
   season, the competition, then click your team (in the calendar or the standings).
2. Copy the address of that page from your browser. It ends with `/equipe-<number>/`, for
   example:

   ```
   https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/
   ```

3. In Gladys, open the page of the integration. In the **My calendars** block, paste the
   address in **Teams**, several teams separated by commas, then enable.

Each member of the household enables the integration for themselves and picks their own
teams: the calendars are theirs. They start **private**: share one, in the same block, so the
household sees it and the scenes can use it.

**Can't find the team page?** Copy the address of the competition (or of one of its pools)
instead and paste it in the **List the teams of a competition** button: the answer lists every
team with the address to paste.

**New season, new addresses.** The federation gives every team a new page each season: in
September, replace the address. The old calendar is deleted, a new one is created for the
season.

## Configuration

| Field                          | Role                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Teams** (My calendars)       | Addresses of team pages, separated by commas (or spaces). One list per user.                              |
| **Refresh interval (minutes)** | Minutes between two reads of ffhandball.fr, for every calendar (60 by default, 15 minimum, 1440 maximum). |

**Sync now** reads every team of every user right away and says, team by team, how many
matches are in the calendar — or why it failed.

## What goes in the calendar

| Item            | Content                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| Calendar        | One per team, named after the team and its competition, with its color                  |
| Event           | One per scheduled match, e.g. "CAEN HANDBALL – PARIS SAINT-GERMAIN"                     |
| After the match | The score in the name, e.g. "CAEN HANDBALL 29 – 32 PARIS SAINT-GERMAIN", and the result |
| Time            | The kick-off, for 1 h 30                                                                |
| Location        | The hall and its address, as the club publishes them                                    |
| Description     | The competition, the round, home or away, the result                                    |
| Link            | The page of the match on ffhandball.fr                                                  |

A match **without a date** does not show: it reaches the calendar as soon as the federation
schedules it. A **rescheduled** match moves, a match that loses its date is removed.

The texts are in the user's language in Gladys. The times are the ones the federation
publishes (French time).

## In scenes

The matches are calendar events like any other: the Gladys calendar trigger (an event is
coming) and its calendar actions see them, once the calendar is **shared**. For example:

- an hour before a home match, remind everyone to leave for the gym;
- on the morning of a match, send the name and the location of the event.

## Troubleshooting

- **"not a team page"**: the address must contain `/equipe-<number>/`. Use the **List the
  teams of a competition** button to get it.
- **"team … not found on ffhandball.fr"**: the season of that page is over, or the team was
  withdrawn. Paste the address of the current season.
- **"ffhandball.fr unreachable"**: the website or your internet connection is down; the
  calendar keeps its matches and the integration tries again at the next refresh.
- **No location**: the club has no calendar published on ffhandball.fr for that competition;
  the matches are there, without hall.
- **A calendar is no longer updated**: its sync may be turned off in **My calendars**.

## Privacy

The integration only reads public pages of ffhandball.fr. It sends nothing about you or your
home, writes no file, and only syncs the users who enabled it.
