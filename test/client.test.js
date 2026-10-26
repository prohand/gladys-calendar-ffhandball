import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCKS,
  calendarIdsFromPage,
  decodePayload,
  encodePayload,
  FfhbClient,
  keyFromPage,
} from '../src/ffhandball/client.js';
import { locationsFromIcs } from '../src/ffhandball/ics.js';
import { buildTeam } from '../src/ffhandball/team.js';
import { parseCompetitionUrl, parseTeamUrl } from '../src/config.js';
import { COMPETITION_URL, createFakeFfhb, HALLS, KEY, TEAM_URL } from './helpers/fakeFfhb.js';

test('an answer decodes the way the site decodes it, accents included', () => {
  const data = { libelle: 'CHAMBÉRY SAVOIE', score: '29', date: null };
  const payload = encodePayload(data, KEY);
  assert.match(payload, /^[A-Za-z0-9+/]+=*$/);
  assert.ok(!Buffer.from(payload, 'base64').toString('latin1').includes('libelle'));
  assert.deepEqual(decodePayload(payload, KEY), data);
});

test('the key is read from the body of a page', () => {
  assert.equal(keyFromPage('<body class="home" data-cfk="abc123">'), 'abc123');
  assert.equal(keyFromPage('<body>'), null);
});

test('a key the site rotated is read again, once', async () => {
  const site = createFakeFfhb();
  const client = new FfhbClient({ fetch: site.fetch });
  const ref = parseTeamUrl(TEAM_URL);
  await client.fetchTeam(ref);
  site.key = 'aNewKeyFromTheSite';
  const blocks = await client.fetchTeam(ref);
  assert.equal(blocks.pool.selected_equipe.libelle, 'HBC TEST');
  assert.equal(client.key, 'aNewKeyFromTheSite');
});

test('a page without a key is a clear error, not a JSON error', async () => {
  const site = createFakeFfhb();
  site.pageServesKey = false;
  const client = new FfhbClient({ fetch: site.fetch });
  await assert.rejects(client.fetchBlock(BLOCKS.MATCHES, {}), {
    name: 'FfhbError',
    message: /no decoding key/,
  });
});

test('a site that does not answer is a clear error', async () => {
  const site = createFakeFfhb();
  site.down = true;
  const client = new FfhbClient({ fetch: site.fetch });
  await assert.rejects(client.fetchTeam(parseTeamUrl(TEAM_URL)), {
    name: 'FfhbError',
    message: /unreachable/,
  });
});

test('the feed ids are read from the calendar button, HTML entities decoded', () => {
  const attributes = JSON.stringify({
    ext_competitionId: '32372',
    equipes: [
      { ext_equipeId: '2119702', ext_structureId: '1386', libelle: "L'ÉQUIPE & CO" },
      { ext_equipeId: '2119699', ext_structureId: '3214', libelle: 'PARIS SAINT-GERMAIN' },
    ],
  })
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const html = `<smartfire-component name='competitions---calendar-button' attributes="${attributes}"></smartfire-component>`;
  assert.deepEqual(calendarIdsFromPage(html, '2119699'), {
    competitionId: '32372',
    structureId: '3214',
  });
  assert.equal(calendarIdsFromPage(html, '1'), null);
  assert.equal(calendarIdsFromPage('<body></body>', '2119699'), null);
});

test('the venues of a feed are read by UID, folded and escaped lines included', () => {
  const feed = [
    'BEGIN:VCALENDAR',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:2989559',
    'DTSTART;TZID=Europe/Paris:20260912T200000',
    'LOCATION:STADE PIERRE DE COUBERTIN\\, 82 AVENUE GEORGES-LAFONT 75016\\, PARIS',
    '  16e',
    'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS=STADE;X-TITLE=STADE:geo:48.8,2.2',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:2989560',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const venues = locationsFromIcs(feed);
  assert.deepEqual(
    [...venues],
    [['2989559', 'STADE PIERRE DE COUBERTIN, 82 AVENUE GEORGES-LAFONT 75016, PARIS 16e']],
  );
});

test('the venues come from the club feed of the team', async () => {
  const site = createFakeFfhb();
  const client = new FfhbClient({ fetch: site.fetch });
  const venues = await client.fetchVenues(parseTeamUrl(TEAM_URL));
  assert.equal(venues.get('91'), HALLS.followed);
  assert.equal(venues.get('92'), HALLS.b);
});

test('a team page without calendar button gives no venues, and no error', async () => {
  const site = createFakeFfhb();
  site.pageHasCalendarButton = false;
  const client = new FfhbClient({ fetch: site.fetch });
  const venues = await client.fetchVenues(parseTeamUrl(TEAM_URL));
  assert.equal(venues.size, 0);
  assert.equal(site.calls.filter((call) => call.startsWith('feed:')).length, 0);
});

test('a team is read from its own side, unscheduled matches last', async () => {
  const site = createFakeFfhb();
  const client = new FfhbClient({ fetch: site.fetch });
  const ref = parseTeamUrl(TEAM_URL);
  const team = buildTeam(ref, await client.fetchTeam(ref));
  assert.equal(team.name, 'HBC TEST');
  assert.deepEqual(
    team.matches.map((match) => [match.id, match.venue, match.result]),
    [
      ['1', 'home', 'win'],
      ['2', 'away', 'draw'],
      ['3', 'home', null],
      ['4', 'away', null],
    ],
  );
  assert.equal(team.matches[3].date, null);
});

test('a team the site does not know any more is a clear error', () => {
  const ref = parseTeamUrl(TEAM_URL);
  assert.throws(() => buildTeam(ref, { pool: { selected_equipe: null }, matches: {} }), {
    message: /not found on ffhandball\.fr/,
  });
});

test('every team of a competition is listed with the address of its page', async () => {
  const site = createFakeFfhb();
  const client = new FfhbClient({ fetch: site.fetch });
  const pools = await client.listTeams(parseCompetitionUrl(COMPETITION_URL));
  assert.deepEqual(
    pools.map((pool) => [pool.pool, pool.teams.length]),
    [
      ['POULE 1', 4],
      ['POULE 2', 2],
    ],
  );
  assert.equal(pools[0].teams[0].url, TEAM_URL);
});
