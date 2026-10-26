// -----------------------------------------------------------------------------
// A fake ffhandball.fr, for the tests: no network.
//
// It serves what the real site serves — a page carrying the `data-cfk` key,
// the `computeBlockAttributes` route answering obfuscated blocks, the team
// page with its "calendar" button, and the club's iCalendar feed on
// competition-calendar.ffhandball.fr — from a small season the tests edit
// between two syncs (a score that appears, a match moved).
// -----------------------------------------------------------------------------

import { BLOCKS, encodePayload } from '../../src/ffhandball/client.js';

export const KEY = 'testKey0123456789';

export const TEAM_URL =
  'https://www.ffhandball.fr/competitions/saison-2026-2027-22/regional/prenationale-masculine-test-30500/equipe-2001/';
export const RIVAL_URL =
  'https://www.ffhandball.fr/competitions/saison-2026-2027-22/regional/prenationale-masculine-test-30500/equipe-2002/';
export const COMPETITION_URL =
  'https://www.ffhandball.fr/competitions/saison-2026-2027-22/regional/prenationale-masculine-test-30500/';

// The site's internal ids (equipe1Id / equipe2Id / equipeId) and the public
// ones (ext_equipeId, in the page addresses) are different numbers, and so
// are the clubs' (structureId / ext_structureId).
export const TEAMS = {
  followed: { id: '100', ext: '2001', name: 'HBC TEST', club: '7001' },
  a: { id: '101', ext: '2002', name: 'RIVAL A', club: '7002' },
  b: { id: '102', ext: '2003', name: 'RIVAL B', club: '7003' },
  c: { id: '103', ext: '2004', name: 'RIVAL C', club: '7004' },
};
export const COMPETITION_ID = '30500';

export const HALLS = {
  followed: 'GYMNASE DU TEST, 1 RUE DU STADE 14000, CAEN',
  a: 'SALLE RIVALE, 2 AVENUE DES SPORTS 75016, PARIS 16e',
  b: 'PALAIS DES SPORTS, 3 PLACE DU MATCH 69000, LYON',
};

const team = (key) => TEAMS[key];

function match(id, round, date, home, away, homeScore = null, awayScore = null) {
  return {
    id: `9${id}`,
    ext_rencontreId: id,
    pouleId: '500',
    equipe1Id: team(home).id,
    equipe2Id: team(away).id,
    equipe1Score: homeScore === null ? null : String(homeScore),
    equipe2Score: awayScore === null ? null : String(awayScore),
    date,
    journeeNumero: String(round),
    equipe1Libelle: team(home).name,
    equipe2Libelle: team(away).name,
    phaseLibelle: 'PRENATIONALE MASCULINE TEST',
    extPouleId: '600',
    // Where it is played: not in the data, only in the club's feed.
    home,
  };
}

/** A season in progress: one win, one draw, the next match tomorrow, one not scheduled. */
export function createSeason() {
  return {
    matches: [
      match('1', 1, '2026-10-03T18:00:00+02:00', 'followed', 'a', 30, 25),
      match('2', 2, '2026-10-10T20:00:00+02:00', 'b', 'followed', 28, 28),
      match('3', 3, '2026-10-17T19:00:00+02:00', 'followed', 'c'),
      match('4', 4, null, 'a', 'followed'),
    ],
  };
}

/** Give a match its final score, as the site does after the match sheet. */
export function setScore(season, id, homeScore, awayScore) {
  const found = season.matches.find((m) => m.ext_rencontreId === id);
  found.equipe1Score = String(homeScore);
  found.equipe2Score = String(awayScore);
}

export function setDate(season, id, date) {
  season.matches.find((m) => m.ext_rencontreId === id).date = date;
}

function poolBlock(params) {
  const options = Object.values(TEAMS).map((t) => ({
    id: t.id,
    ext_equipeId: t.ext,
    pouleId: '500',
    structureId: `5${t.club}`,
    libelle: t.name,
  }));
  const selected = params.ext_equipe_id
    ? options.find((t) => t.ext_equipeId === params.ext_equipe_id)
    : null;
  return {
    selected_equipe: params.ext_equipe_id ? (selected ?? null) : null,
    selected_poule:
      params.ext_poule_id === '601'
        ? { id: '501', ext_pouleId: '601', phaseId: '700', libelle: 'POULE 2' }
        : { id: '500', ext_pouleId: '600', phaseId: '700', libelle: 'POULE 1' },
    equipe_options: params.ext_poule_id === '601' ? options.slice(0, 2) : options,
    phases: [{ id: '700', libelle: 'PRENATIONALE MASCULINE TEST' }],
    poules: [
      { id: '500', ext_pouleId: '600', libelle: 'POULE 1' },
      { id: '501', ext_pouleId: '601', libelle: 'POULE 2' },
    ],
  };
}

const escapeAttribute = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** The team page: the key, and the calendar button with the feed ids, HTML-escaped. */
function teamPage(server, teamExt) {
  const attributes = {
    ext_saison_id: '22',
    url_competition_type: 'regional',
    url_competition: 'prenationale-masculine-test-30500',
    ext_equipe_id: teamExt,
    ext_competitionId: COMPETITION_ID,
    equipes: Object.values(TEAMS).map((t) => ({
      id: t.id,
      ext_equipeId: t.ext,
      structureId: `5${t.club}`,
      libelle: `${t.name} & CO`,
      ext_structureId: t.club,
    })),
  };
  const button = server.pageHasCalendarButton
    ? `<smartfire-component name='competitions---calendar-button' attributes="${escapeAttribute(JSON.stringify(attributes))}"></smartfire-component>`
    : '';
  return `<html><body class="x" data-cfk="${server.key}">${button}</body></html>`;
}

const icsText = (text) => text.replace(/([\\;,])/g, '\\$1');

/** Fold a content line at 75 octets, the way the site's generator does. */
const fold = (line) => line.match(/.{1,74}/g).join('\r\n ');

/** The club's feed: its scheduled matches in the competition, with their halls. */
function clubFeed(server, club) {
  const key = Object.keys(TEAMS).find((k) => TEAMS[k].club === club);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:spatie/icalendar-generator'];
  for (const m of server.season.matches) {
    const plays = m.equipe1Id === TEAMS[key].id || m.equipe2Id === TEAMS[key].id;
    if (!plays || !m.date) {
      continue;
    }
    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.id}`,
      `SUMMARY:${icsText(`${m.equipe1Libelle} vs ${m.equipe2Libelle}`)}`,
      ...(HALLS[m.home] ? [fold(`LOCATION:${icsText(HALLS[m.home])}`)] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * A `fetch` serving the season. `server.calls` lists the requested URLs
 * (path and query, the feed host spelled out), `server.key` can be changed to
 * play a key rotation, `server.down` makes every request fail, `server.feedDown`
 * only the iCalendar feeds.
 */
export function createFakeFfhb(season = createSeason()) {
  const server = {
    season,
    key: KEY,
    calls: [],
    down: false,
    feedDown: false,
    pageServesKey: true,
    pageHasCalendarButton: true,
  };
  server.fetch = async (url) => {
    const { hostname, pathname, searchParams } = new URL(url);
    const call = `${pathname}${searchParams.size ? `?${searchParams}` : ''}`;
    server.calls.push(hostname === 'competition-calendar.ffhandball.fr' ? `feed:${call}` : call);
    if (server.down) {
      throw new TypeError('fetch failed');
    }
    if (hostname === 'competition-calendar.ffhandball.fr') {
      const feed = pathname.match(/^\/c-(\d+)\/s-(\d+)\.ics$/);
      if (server.feedDown || !feed || feed[1] !== COMPETITION_ID) {
        return new Response('not found', { status: 404 });
      }
      return new Response(clubFeed(server, feed[2]), {
        status: 200,
        headers: { 'content-type': 'text/calendar;charset=UTF-8' },
      });
    }
    if (pathname === '/competitions/') {
      const body = server.pageServesKey ? `<body class="x" data-cfk="${server.key}">` : '<body>';
      return new Response(`<html>${body}</body></html>`, { status: 200 });
    }
    const page = pathname.match(/\/equipe-(\d+)\/$/);
    if (page) {
      return new Response(teamPage(server, page[1]), { status: 200 });
    }
    if (pathname === '/wp-json/competitions/v1/computeBlockAttributes') {
      const params = Object.fromEntries(searchParams);
      let data;
      if (params.block === BLOCKS.POOL) {
        data = poolBlock(params);
      } else if (params.block === BLOCKS.MATCHES) {
        data = { rencontres: server.season.matches };
      } else {
        return Response.json(
          {
            code: 'rest_invalid_param',
            message: 'Invalid parameter(s): block',
            data: { status: 400 },
          },
          { status: 400 },
        );
      }
      return Response.json(encodePayload(data, server.key));
    }
    return new Response('not found', { status: 404 });
  };
  return server;
}
