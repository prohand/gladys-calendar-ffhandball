// -----------------------------------------------------------------------------
// From the raw blocks of ffhandball.fr to one team and its matches.
//
// The site speaks of "equipe1" (home) and "equipe2" (away), with numbers as
// strings and `null` for what is not known yet (a score before the match, the
// date of a match not scheduled yet). Everything below is written from the
// team's side: its opponent, its goals, its result.
// -----------------------------------------------------------------------------

import { competitionPath } from '../config.js';
import { FFHB_BASE_URL } from './client.js';

export const RESULTS = { WIN: 'win', DRAW: 'draw', LOSS: 'loss' };
export const VENUES = { HOME: 'home', AWAY: 'away' };

const toInt = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};

const toDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * The competition as the site names it. A pool named after the competition
 * ("DAIKIN STARLIGUE 2026-27", its phase being "SAISON REGULIERE") is the
 * name; a numbered pool ("POULE 2") reads after its phase.
 */
function competitionLabel(pool) {
  const selected = pool?.selected_poule;
  const phase = (pool?.phases ?? []).find((p) => p.id === selected?.phaseId) ?? pool?.phases?.[0];
  const phaseName = phase?.libelle?.trim();
  const poolName = selected?.libelle?.trim();
  if (poolName && !/^poule\b/i.test(poolName)) {
    return poolName;
  }
  if (phaseName && poolName) {
    return `${phaseName} – ${poolName}`;
  }
  return phaseName || poolName || '';
}

/**
 * One match, from the team's side.
 * @param {object} raw a `rencontres` entry
 * @param {string} internalId the team's id in the site's own tables
 * @param {{ seasonId: string, type: string, competition: string }} ref the team address
 */
export function toMatch(raw, internalId, ref) {
  const home = String(raw.equipe1Id) === String(internalId);
  const scoreFor = toInt(home ? raw.equipe1Score : raw.equipe2Score);
  const scoreAgainst = toInt(home ? raw.equipe2Score : raw.equipe1Score);
  const played = scoreFor !== null && scoreAgainst !== null;
  let result = null;
  if (played) {
    result =
      scoreFor > scoreAgainst ? RESULTS.WIN : scoreFor < scoreAgainst ? RESULTS.LOSS : RESULTS.DRAW;
  }
  const id = String(raw.ext_rencontreId ?? raw.id);
  // The match page, the link of the site's own calendar feed.
  const url =
    raw.extPouleId && raw.ext_rencontreId
      ? `${FFHB_BASE_URL}${competitionPath(ref)}poule-${raw.extPouleId}/rencontre-${raw.ext_rencontreId}/`
      : null;
  return {
    id,
    // The site's internal id: the UID of the match in the club's feed.
    internalId: String(raw.id ?? ''),
    date: toDate(raw.date),
    round: toInt(raw.journeeNumero),
    phase: raw.phaseLibelle ?? null,
    venue: home ? VENUES.HOME : VENUES.AWAY,
    homeTeam: raw.equipe1Libelle ?? '',
    awayTeam: raw.equipe2Libelle ?? '',
    opponent: (home ? raw.equipe2Libelle : raw.equipe1Libelle) ?? '',
    homeScore: toInt(raw.equipe1Score),
    awayScore: toInt(raw.equipe2Score),
    scoreFor,
    scoreAgainst,
    played,
    result,
    url,
  };
}

/**
 * The team, built from the two blocks {@link FfhbClient.fetchTeam} reads.
 * @param {{ teamId: string, url: string }} ref the parsed team address
 * @param {{ pool: object, matches: object }} blocks
 */
export function buildTeam(ref, { pool, matches }) {
  const selected = pool?.selected_equipe;
  if (!selected) {
    throw new Error(
      `team ${ref.teamId} not found on ffhandball.fr (season over or wrong address?)`,
    );
  }
  const internalId = String(selected.id);
  const allMatches = (matches?.rencontres ?? [])
    .map((raw) => toMatch(raw, internalId, ref))
    // Matches without a date (not scheduled yet) go last, in round order.
    .sort((a, b) => {
      if (a.date && b.date) {
        return a.date - b.date;
      }
      if (a.date || b.date) {
        return a.date ? -1 : 1;
      }
      return (a.round ?? 0) - (b.round ?? 0);
    });
  return {
    id: ref.teamId,
    url: ref.url,
    name: selected.libelle?.trim() || `Team ${ref.teamId}`,
    competition: competitionLabel(pool),
    matches: allMatches,
  };
}
