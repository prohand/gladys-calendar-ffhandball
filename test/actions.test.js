import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../src/capabilities/actions.js';
import { COMPETITION_URL, RIVAL_URL, TEAM_URL } from './helpers/fakeFfhb.js';
import { account, JOHN, MARIE, setup } from './helpers/setup.js';

test('"Sync now" says, user by user and team by team, what went to the calendar', async () => {
  const { sync, fake } = setup({
    accounts: [account(MARIE, `${TEAM_URL}\nhttps://example.com/x`), account(JOHN, '')],
  });
  const answer = await ACTIONS.sync_now(sync);
  assert.equal(
    answer.fr,
    'Marie\n✓ HBC TEST (PRENATIONALE MASCULINE TEST – POULE 1)\n   3 matchs dans le calendrier\n' +
      '✗ https://example.com/x\n   pas une page équipe de ffhandball.fr (…/equipe-<numéro>/)\n\n' +
      "John\naucune équipe : collez l'adresse d'une page équipe dans Mes calendriers",
  );
  assert.match(answer.en, /3 matches in the calendar/);
  assert.equal(fake.calendars.length, 1);
});

test('"Sync now" shows a team the site does not answer for', async () => {
  const { sync, site } = setup({ accounts: [account(MARIE, RIVAL_URL)] });
  site.down = true;
  const answer = await ACTIONS.sync_now(sync);
  assert.match(
    answer.en,
    /^Marie\n✗ https:\/\/www\.ffhandball\.fr\/.*\n {3}ffhandball\.fr unreachable/,
  );
});

test('"Sync now" without any enabled user explains where to start', async () => {
  const { sync } = setup({ accounts: [] });
  const answer = await ACTIONS.sync_now(sync);
  assert.match(answer.fr, /^Personne n'a encore activé les calendriers/);
});

test('"List the teams" gives the address of every team page', async () => {
  const { sync } = setup();
  const answer = await ACTIONS.list_teams(sync, { fields: { url: COMPETITION_URL } });
  assert.match(answer.en, /^Copy the address of your team into the Teams field of My calendars:/);
  assert.match(answer.en, /— POULE 1\nHBC TEST\nhttps:\/\/www\.ffhandball\.fr\/.*equipe-2001\//);
  const wrong = await ACTIONS.list_teams(sync, { fields: { url: 'https://example.com' } });
  assert.match(wrong.fr, /^Ce n'est pas une page de compétition/);
});
