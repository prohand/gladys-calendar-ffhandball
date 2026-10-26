// -----------------------------------------------------------------------------
// Integration configuration.
//
// Two forms, both declared in `gladys-assistant-integration.json`:
//   - the `config_schema` (Configuration screen, one for the instance): how
//     often ffhandball.fr is read;
//   - the `account_schema` ("My calendars" block, one per user who enabled
//     the integration): the teams whose matches go in that user's calendar.
// This module provides the defaults, normalizes the received objects (form
// values may arrive as strings) and reads the teams out of the pasted
// ffhandball.fr addresses.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Minutes between two reads of ffhandball.fr. Fixtures move a few times a
  // season and the site caches its pages an hour: an hour is plenty.
  refresh_minutes: 60,
};

export const REFRESH_MINUTES = { min: 15, max: 1440 };

// Same rule for the per-user `account_schema`.
export const DEFAULT_ACCOUNT = {
  // ffhandball.fr team pages, separated by commas: the Gladys form field is
  // a single line.
  teams: '',
};

// A team page of ffhandball.fr:
//   https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/
// The season id, the competition type and slug, and the team id are the four
// parameters the site's own data service asks for.
const TEAM_URL =
  /\/competitions\/saison-\d{4}-\d{4}-(\d+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/equipe-(\d+)/i;

// A competition (or pool) page, the input of the "List the teams" action.
const COMPETITION_URL =
  /\/competitions\/saison-\d{4}-\d{4}-(\d+)\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/poule-(\d+))?/i;

/** The first year of a season, from its id (`22` is 2026-2027). */
export function seasonYear(seasonId) {
  return Number(seasonId) + 2004;
}

/** `/competitions/saison-2026-2027-22/national/<slug>/`: the competition's pages start there. */
export function competitionPath({ seasonId, type, competition }) {
  const season = seasonYear(seasonId);
  return `/competitions/saison-${season}-${season + 1}-${seasonId}/${type}/${competition}/`;
}

/**
 * The team a ffhandball.fr address points at, or null.
 * @param {string} url
 * @returns {{ seasonId: string, type: string, competition: string, teamId: string, path: string, url: string } | null}
 */
export function parseTeamUrl(url) {
  const match = String(url ?? '').match(TEAM_URL);
  if (!match) {
    return null;
  }
  const [, seasonId, type, competition, teamId] = match;
  const ref = {
    seasonId,
    type: type.toLowerCase(),
    competition: competition.toLowerCase(),
    teamId,
  };
  const path = `${competitionPath(ref)}equipe-${teamId}/`;
  return { ...ref, path, url: `https://www.ffhandball.fr${path}` };
}

/**
 * The competition a ffhandball.fr address points at, or null. A team page is
 * a competition page too: its teams are the ones it plays against.
 * @param {string} url
 */
export function parseCompetitionUrl(url) {
  const match = String(url ?? '').match(COMPETITION_URL);
  if (!match || /^o-/.test(match[3])) {
    return null;
  }
  const [, seasonId, type, competition, poolId] = match;
  return {
    seasonId,
    type: type.toLowerCase(),
    competition: competition.toLowerCase(),
    poolId: poolId ?? null,
  };
}

/**
 * Read the teams out of a `teams` field: addresses separated by commas (the
 * form field is a single line), semicolons, spaces or line breaks. An address that is not a team page is
 * reported, never silently dropped.
 * @param {string} text
 * @returns {{ teams: ReturnType<typeof parseTeamUrl>[], invalid: string[] }}
 */
export function parseTeams(text) {
  const teams = [];
  const invalid = [];
  const seen = new Set();
  for (const entry of String(text ?? '').split(/[\s,;]+/)) {
    if (!entry) {
      continue;
    }
    const team = parseTeamUrl(entry);
    if (!team) {
      invalid.push(entry);
    } else if (!seen.has(team.teamId)) {
      seen.add(team.teamId);
      teams.push(team);
    }
  }
  return { teams, invalid };
}

function clamp(value, { min, max }, fallback) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Merge the instance config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    refresh_minutes: clamp(raw.refresh_minutes, REFRESH_MINUTES, DEFAULT_CONFIG.refresh_minutes),
  };
}

/**
 * Merge the values of one user's account form with the defaults.
 * @param {Record<string, unknown>} raw `config` of a getCalendarAccounts() entry
 */
export function normalizeAccount(raw = {}) {
  const account = { ...DEFAULT_ACCOUNT, ...raw };
  return { ...account, teams: String(account.teams ?? '') };
}
