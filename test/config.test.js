import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  normalizeAccount,
  normalizeConfig,
  parseCompetitionUrl,
  parseTeams,
  parseTeamUrl,
} from '../src/config.js';

const PSG =
  'https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/';

test('a team page address gives the four parameters of the site', () => {
  assert.deepEqual(parseTeamUrl(PSG), {
    seasonId: '22',
    type: 'national',
    competition: 'daikin-starligue-2026-27-32372',
    teamId: '2119699',
    path: '/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/',
    url: PSG,
  });
});

test('a team address is cleaned up: no query, no trailing parts, lower case', () => {
  const ref = parseTeamUrl(
    'http://ffhandball.fr/competitions/saison-2026-2027-22/National/Daikin-Starligue-2026-27-32372/equipe-2119699/calendrier?x=1',
  );
  assert.equal(ref.url, PSG);
});

test('the teams field takes addresses separated by commas, reports the others, skips duplicates', () => {
  const { teams, invalid } = parseTeams(`${PSG}\n\n${PSG}, https://example.com/x ; nope`);
  assert.equal(teams.length, 1);
  assert.deepEqual(invalid, ['https://example.com/x', 'nope']);
});

test('two addresses on the single line of the form field, with or without spaces', () => {
  const other = PSG.replace('equipe-2119699', 'equipe-2119702');
  for (const text of [
    `${PSG},${other}`,
    `${PSG}, ${other}`,
    `${PSG} ${other}`,
    `${PSG};${other}`,
  ]) {
    const { teams, invalid } = parseTeams(text);
    assert.deepEqual(
      teams.map((team) => team.teamId),
      ['2119699', '2119702'],
      text,
    );
    assert.deepEqual(invalid, []);
  }
});

test('a competition or pool page is a competition address, a team page too', () => {
  assert.deepEqual(
    parseCompetitionUrl(
      'https://www.ffhandball.fr/competitions/saison-2026-2027-22/regional/prenationale-30500/poule-600/',
    ),
    { seasonId: '22', type: 'regional', competition: 'prenationale-30500', poolId: '600' },
  );
  assert.equal(parseCompetitionUrl(PSG).competition, 'daikin-starligue-2026-27-32372');
  assert.equal(parseCompetitionUrl('https://www.ffhandball.fr/'), null);
});

test('the refresh interval is clamped, strings accepted, defaults filled', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(normalizeConfig({ refresh_minutes: '30' }).refresh_minutes, 30);
  assert.equal(normalizeConfig({ refresh_minutes: 1 }).refresh_minutes, 15);
  assert.equal(normalizeConfig({ refresh_minutes: 'x' }).refresh_minutes, 60);
});

test('an account without values follows no team', () => {
  assert.equal(normalizeAccount().teams, '');
  assert.equal(normalizeAccount({ teams: null }).teams, '');
  assert.equal(normalizeAccount({ teams: PSG }).teams, PSG);
});
