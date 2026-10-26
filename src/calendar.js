// -----------------------------------------------------------------------------
// One team -> one Gladys calendar, one scheduled match -> one event.
//
// Pure functions: what to push, never the pushing (src/sync.js does that).
//
// External ids are stored by Gladys and must never change:
//   calendar  ext:<selector>:<user>:team-<ext_equipeId>
//   event     ext:<selector>:<user>:team-<ext_equipeId>:match-<ext_rencontreId>
// The core moves an event republished under another calendar of the same user:
// the team id in the event id keeps the match of two followed teams playing
// each other in both calendars.
// -----------------------------------------------------------------------------

import { pick } from './i18n.js';
import { seasonYear } from './config.js';
import { matchTitle, resultSentence, roundSentence, VENUE_LABELS } from './ffhandball/format.js';

// How long a match takes in the calendar: 2 × 30 minutes of play, the
// half-time and the stoppages. The site's own feed says 1h30 too.
export const MATCH_MINUTES = 90;

// The calendar colors, by position of the team in the user's list: two
// followed teams never share one, up to the length of the palette.
export const COLORS = ['#e2001a', '#0055a4', '#f39200', '#2e7d32', '#6a1b9a', '#00838f'];

// The limits of the core (the SDK checks them before any request).
const MAX = { calendarName: 100, calendarDescription: 500, eventName: 200, description: 1000 };

const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The id of the calendar of one team, for one user. */
export function calendarExternalId(gladys, userSelector, teamId) {
  return gladys.externalId(`${userSelector}:team-${teamId}`);
}

/** Every calendar id of a user starts with this: tells ours from a future other kind. */
export function calendarPrefix(gladys, userSelector) {
  return gladys.externalId(`${userSelector}:team-`);
}

function eventExternalId(gladys, userSelector, teamId, matchId) {
  return gladys.externalId(`${userSelector}:team-${teamId}:match-${matchId}`);
}

/**
 * The calendar of a team. Its name is the team; the competition follows, as
 * a club often has several teams (seniors, under 18…) in several
 * competitions.
 * @param {object} team a built team (src/ffhandball/team.js)
 * @param {{ gladys: object, userSelector: string, index: number, language: string }} options
 */
export function toCalendar(team, { gladys, userSelector, index, language }) {
  const name = team.competition ? `${team.name} – ${team.competition}` : team.name;
  return {
    external_id: calendarExternalId(gladys, userSelector, team.id),
    name: cut(name, MAX.calendarName),
    // Gladys stores one text: the owner's language.
    description: cut(
      pick(language, {
        en: `Matches of ${team.name}, read from ffhandball.fr: ${team.url}`,
        fr: `Matchs de ${team.name}, lus sur ffhandball.fr : ${team.url}`,
        de: `Spiele von ${team.name}, gelesen auf ffhandball.fr: ${team.url}`,
        es: `Partidos de ${team.name}, leídos en ffhandball.fr: ${team.url}`,
      }),
      MAX.calendarDescription,
    ),
    color: COLORS[index % COLORS.length],
  };
}

/**
 * The events of a team: its scheduled matches, played or to come. A match
 * without a date yet is not an event: it becomes one once the federation
 * schedules it.
 * @param {object} team a built team
 * @param {{ gladys: object, userSelector: string, language: string, venues: Map<string, string> }} options
 */
export function toEvents(team, { gladys, userSelector, language, venues }) {
  return team.matches
    .filter((match) => match.date)
    .map((match) => {
      const lines = [
        roundSentence(team.competition, match, language),
        pick(language, VENUE_LABELS[match.venue]),
      ];
      if (match.played) {
        lines.push(resultSentence(match, language));
      }
      return {
        external_id: eventExternalId(gladys, userSelector, team.id, match.id),
        name: cut(matchTitle(match), MAX.eventName),
        start: match.date.toISOString(),
        end: new Date(match.date.getTime() + MATCH_MINUTES * 60_000).toISOString(),
        description: cut(lines.filter(Boolean).join('\n'), MAX.description),
        location: venues.get(match.internalId) ?? null,
        url: match.url,
      };
    });
}

/**
 * The prune window of a team's events: the whole season (July to July), and
 * more if a match falls outside. Republishing it replaces its content: a
 * match that lost its date leaves the calendar, a moved one moves.
 * @param {{ seasonId: string }} ref the team address
 * @param {{ start: string, end: string }[]} events
 */
export function seasonWindow(ref, events) {
  const year = seasonYear(ref.seasonId);
  let from = Date.UTC(year, 6, 1);
  let to = Date.UTC(year + 1, 6, 1);
  for (const event of events) {
    from = Math.min(from, Date.parse(event.start));
    to = Math.max(to, Date.parse(event.end));
  }
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}
