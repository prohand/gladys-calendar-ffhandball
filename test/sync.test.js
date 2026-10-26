import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WriteLimiter } from '../src/sync.js';
import {
  createFakeFfhb,
  HALLS,
  RIVAL_URL,
  setDate,
  setScore,
  TEAM_URL,
} from './helpers/fakeFfhb.js';
import { account, JOHN, MARIE, SELECTOR, setup } from './helpers/setup.js';

const calendarId = (user, team = '2001') => `ext:${SELECTOR}:${user}:team-${team}`;
const eventId = (user, match, team = '2001') =>
  `ext:${SELECTOR}:${user}:team-${team}:match-${match}`;
const eventsOf = (fake, calendar) =>
  fake.calendarEvents.filter((event) => event.calendar_external_id === calendar);
const eventById = (fake, id) => fake.calendarEvents.find((event) => event.external_id === id);

test('a team becomes a calendar of the user, its scheduled matches events', async () => {
  const { sync, fake } = setup();
  await sync.syncAll();

  assert.equal(fake.calendars.length, 1);
  const [calendar] = fake.calendars;
  assert.equal(calendar.user, 'marie');
  assert.equal(calendar.external_id, calendarId('marie'));
  assert.equal(calendar.name, 'HBC TEST – PRENATIONALE MASCULINE TEST – POULE 1');
  assert.match(calendar.description, /^Matchs de HBC TEST, lus sur ffhandball\.fr : https:/);
  assert.equal(calendar.color, '#e2001a');
  // Private until the user shares it, like every pushed calendar.
  assert.equal(calendar.shared, false);

  // Three matches have a date, the fourth is not scheduled yet.
  const events = eventsOf(fake, calendarId('marie'));
  assert.deepEqual(events.map((event) => event.external_id).sort(), [
    eventId('marie', '1'),
    eventId('marie', '2'),
    eventId('marie', '3'),
  ]);
});

test('an event carries the match: teams, score, times, hall, link, round', async () => {
  const { sync, fake } = setup();
  await sync.syncAll();

  const played = eventById(fake, eventId('marie', '1'));
  assert.equal(played.name, 'HBC TEST 30 – 25 RIVAL A');
  assert.equal(new Date(played.start).toISOString(), '2026-10-03T16:00:00.000Z');
  assert.equal(new Date(played.end).toISOString(), '2026-10-03T17:30:00.000Z');
  assert.equal(played.location, HALLS.followed);
  assert.equal(
    played.url,
    'https://www.ffhandball.fr/competitions/saison-2026-2027-22/regional/prenationale-masculine-test-30500/poule-600/rencontre-1/',
  );
  assert.equal(
    played.description,
    'PRENATIONALE MASCULINE TEST – POULE 1 · Journée 1\nMatch à domicile\nVictoire 30-25 contre RIVAL A',
  );

  const away = eventById(fake, eventId('marie', '2'));
  assert.equal(away.location, HALLS.b);
  assert.match(away.description, /Match à l’extérieur\nNul 28-28 contre RIVAL B$/);

  const next = eventById(fake, eventId('marie', '3'));
  assert.equal(next.name, 'HBC TEST – RIVAL C');
  assert.equal(
    next.description,
    'PRENATIONALE MASCULINE TEST – POULE 1 · Journée 3\nMatch à domicile',
  );
});

test('the texts follow the language of the calendar owner', async () => {
  const { sync, fake } = setup({ accounts: [account(JOHN)] });
  await sync.syncAll();
  assert.match(fake.calendars[0].description, /^Matches of HBC TEST, read from ffhandball\.fr: /);
  assert.equal(
    eventById(fake, eventId('john', '1')).description,
    'PRENATIONALE MASCULINE TEST – POULE 1 · Round 1\nHome match\nWin 30-25 against RIVAL A',
  );
});

test('the events are pushed with the season as prune window', async () => {
  const { sync, fake } = setup();
  await sync.syncAll();
  const [push] = fake.publishedCalendarEvents;
  assert.equal(push.calendar_external_id, calendarId('marie'));
  assert.equal(new Date(push.window.from).toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(new Date(push.window.to).toISOString(), '2027-07-01T00:00:00.000Z');
});

test('a score, a moved match and a newly scheduled one reach the calendar', async () => {
  const { sync, fake, site } = setup();
  await sync.syncAll();

  setScore(site.season, '3', 27, 27);
  setDate(site.season, '1', null); // unscheduled again
  setDate(site.season, '4', '2026-11-07T20:30:00+01:00');
  await sync.syncAll();

  assert.equal(eventById(fake, eventId('marie', '3')).name, 'HBC TEST 27 – 27 RIVAL C');
  assert.equal(eventById(fake, eventId('marie', '1')), undefined, 'pruned by the window');
  const scheduled = eventById(fake, eventId('marie', '4'));
  assert.equal(new Date(scheduled.start).toISOString(), '2026-11-07T19:30:00.000Z');
  assert.equal(scheduled.location, HALLS.a);
});

test('nothing changed, nothing is written again', async () => {
  const { sync, fake } = setup();
  await sync.syncAll();
  const writes = fake.publishedCalendars.length + fake.publishedCalendarEvents.length;
  await sync.syncAll();
  assert.equal(fake.publishedCalendars.length + fake.publishedCalendarEvents.length, writes);
});

test('a team followed by two users is read once, each user gets their own calendar', async () => {
  const { sync, fake, site } = setup({ accounts: [account(MARIE), account(JOHN)] });
  await sync.syncAll();
  const matchesReads = site.calls.filter((call) => call.includes('rencontre-list'));
  assert.equal(matchesReads.length, 1);
  assert.deepEqual(fake.calendars.map((calendar) => calendar.user).sort(), ['john', 'marie']);
  assert.equal(eventsOf(fake, calendarId('john')).length, 3);
  assert.equal(eventsOf(fake, calendarId('marie')).length, 3);
});

test('two teams playing each other keep the match in both calendars', async () => {
  const { sync, fake } = setup({ accounts: [account(MARIE, `${TEAM_URL}\n${RIVAL_URL}`)] });
  await sync.syncAll();
  assert.equal(fake.calendars.length, 2);
  assert.notEqual(fake.calendars[0].color, fake.calendars[1].color);
  assert.ok(eventById(fake, eventId('marie', '1')));
  assert.ok(eventById(fake, eventId('marie', '1', '2002')));
});

test('a team removed from the list loses its calendar', async () => {
  const { sync, fake } = setup({ accounts: [account(MARIE, `${TEAM_URL}\n${RIVAL_URL}`)] });
  await sync.syncAll();
  fake.calendarAccounts = [account(MARIE, TEAM_URL)];
  await sync.syncUser('marie');
  assert.deepEqual(fake.deletedCalendars, [calendarId('marie', '2002')]);
  assert.deepEqual(
    fake.calendars.map((calendar) => calendar.external_id),
    [calendarId('marie')],
  );
});

test('a team that cannot be read keeps its calendar as it was', async () => {
  const { sync, fake, site } = setup();
  await sync.syncAll();
  site.down = true;
  await sync.syncAll();
  assert.equal(fake.deletedCalendars.length, 0);
  assert.equal(eventsOf(fake, calendarId('marie')).length, 3);
  assert.equal(fake.connectionStatus.connected, false);
});

test('a calendar the user turned off is skipped, then pushed again once back on', async () => {
  const { sync, fake } = setup();
  await sync.syncAll();
  const pushes = fake.publishedCalendarEvents.length;

  fake.calendars[0].sync = false;
  await sync.syncUser('marie');
  assert.equal(fake.publishedCalendarEvents.length, pushes);
  assert.equal(sync.report.get('marie').entries[0].skipped, true);

  // The core empties a calendar turned off: turned back on, it gets it all.
  fake.calendars[0].sync = true;
  fake.calendarEvents = [];
  await sync.syncUser('marie');
  assert.equal(eventsOf(fake, calendarId('marie')).length, 3);
});

test('a user who disabled the integration is no longer synced', async () => {
  const { sync, fake } = setup({ accounts: [account(MARIE), account(JOHN)] });
  await sync.syncAll();
  fake.calendarAccounts = [account(JOHN)];
  await sync.syncUser('marie');
  assert.equal(sync.report.has('marie'), false);
  await sync.syncAll();
  assert.deepEqual([...sync.report.keys()], ['john']);
});

test('without the club feed, the matches still go to the calendar, without hall', async () => {
  const site = createFakeFfhb();
  site.feedDown = true;
  const { sync, fake } = setup({ server: site });
  await sync.syncAll();
  const events = eventsOf(fake, calendarId('marie'));
  assert.equal(events.length, 3);
  assert.ok(events.every((event) => !event.location));
});

test('the feed ids are read from the team page once, the feed at every sync', async () => {
  const { sync, site, fake } = setup();
  await sync.syncAll();
  fake.calendarEvents = [];
  sync.forget();
  await sync.syncAll();
  assert.equal(site.calls.filter((call) => call.endsWith('/equipe-2001/')).length, 1);
  assert.deepEqual(
    site.calls.filter((call) => call.startsWith('feed:')),
    ['feed:/c-30500/s-7001.ics', 'feed:/c-30500/s-7001.ics'],
  );
});

test('the writes are paced under the limit of the core', async () => {
  let now = 0;
  const waits = [];
  const limiter = new WriteLimiter({
    limit: 2,
    intervalMs: 60_000,
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  await limiter.take();
  now += 1_000;
  await limiter.take();
  await limiter.take();
  assert.deepEqual(waits, [59_000]);
});
