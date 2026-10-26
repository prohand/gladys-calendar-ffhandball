// -----------------------------------------------------------------------------
// Reading ffhandball.fr.
//
// The federation publishes no public API. Its website renders every
// competition block (calendar, standings, pools…) from a WordPress REST route,
// `wp-json/competitions/v1/computeBlockAttributes`, which takes the same
// parameters as the page address (season, competition type and slug, team,
// pool) and answers the block's data. That answer is obfuscated, not secret:
// base64, then XOR with a key the site writes in plain text on every page (the
// `data-cfk` attribute of `<body>`), and the site's own JavaScript decodes it
// the same way.
//
// So the client reads the key from a page once, keeps it, and reads it again
// only when an answer no longer decodes (the site changed its key).
//
// The matches come from that route. Their venues do not: the route only gives
// a hall id. The site's "Add the matches to your calendar" button links to an
// iCalendar feed per club and competition, on competition-calendar.ffhandball.fr,
// whose LOCATION is the hall and its address. The ids of that feed (the club's
// public `ext_structureId`, the competition's `ext_competitionId`) are only
// printed in the team page, in the attributes of that button: the client reads
// them there once per team, then the feed at every refresh.
//
// Nothing is sent but public GET requests, at the pace of the configured
// refresh, and the site caches each answer an hour anyway.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { competitionPath } from '../config.js';
import { locationsFromIcs } from './ics.js';

const logger = createLogger({ name: 'ffhandball' });

export const FFHB_BASE_URL = 'https://www.ffhandball.fr';
export const FFHB_CALENDAR_URL = 'https://competition-calendar.ffhandball.fr';
const API_PATH = '/wp-json/competitions/v1/computeBlockAttributes';
// Any page of the site carries the key; this one is the lightest stable one.
const KEY_PAGE = '/competitions/';
const REQUEST_TIMEOUT_MS = 20_000;

// The blocks this integration reads.
export const BLOCKS = {
  // The team, its pool and phase (and every team of a pool, without a team).
  POOL: 'competitions---poule-selector',
  // Every match of a team, the whole season.
  MATCHES: 'competitions---rencontre-list',
};

// The block of the team page that carries the ids of the iCalendar feed.
const CALENDAR_BUTTON = 'competitions---calendar-button';

/** Decode an obfuscated answer: base64, XOR with the key, UTF-8 JSON. */
export function decodePayload(payload, key) {
  const bytes = Buffer.from(payload, 'base64');
  const keyBytes = Buffer.from(key, 'latin1');
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] ^= keyBytes[i % keyBytes.length];
  }
  return JSON.parse(bytes.toString('utf8'));
}

/** The reverse of {@link decodePayload}, for the tests. */
export function encodePayload(data, key) {
  const bytes = Buffer.from(JSON.stringify(data), 'utf8');
  const keyBytes = Buffer.from(key, 'latin1');
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] ^= keyBytes[i % keyBytes.length];
  }
  return bytes.toString('base64');
}

/** The key the site writes on its pages, or null. */
export function keyFromPage(html) {
  return String(html).match(/data-cfk="([^"]+)"/)?.[1] ?? null;
}

const ENTITIES = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

/**
 * The ids of a team's iCalendar feed, read from its page, or null when the
 * page has no calendar button for it.
 * @param {string} html the team page
 * @param {string} teamId the public team id (`ext_equipeId`)
 * @returns {{ competitionId: string, structureId: string } | null}
 */
export function calendarIdsFromPage(html, teamId) {
  const match = String(html).match(
    new RegExp(`name=(['"])${CALENDAR_BUTTON}\\1\\s+attributes=(['"])(.*?)\\2`, 's'),
  );
  if (!match) {
    return null;
  }
  let attributes;
  try {
    attributes = JSON.parse(decodeEntities(match[3]));
  } catch {
    return null;
  }
  const team = (attributes.equipes ?? []).find(
    (entry) => String(entry.ext_equipeId) === String(teamId),
  );
  const competitionId = attributes.ext_competitionId;
  if (!team?.ext_structureId || !competitionId) {
    return null;
  }
  return { competitionId: String(competitionId), structureId: String(team.ext_structureId) };
}

export class FfhbError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'FfhbError';
    this.status = status;
  }
}

export class FfhbClient {
  /**
   * @param {object} [options]
   * @param {typeof fetch} [options.fetch] injected in the tests
   * @param {string} [options.baseUrl]
   * @param {string} [options.calendarUrl] host of the iCalendar feeds
   * @param {string} [options.userAgent]
   */
  constructor({
    fetch: fetchImpl = globalThis.fetch,
    baseUrl = FFHB_BASE_URL,
    calendarUrl = FFHB_CALENDAR_URL,
    userAgent,
  } = {}) {
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl;
    this.calendarUrl = calendarUrl;
    this.userAgent =
      userAgent ??
      'gladys-calendar-ffhandball (+https://github.com/prohand/gladys-calendar-ffhandball)';
    this.key = null;
    this.keyPromise = null;
    // teamId -> the ids of its feed (or null: the page has none). They do not
    // change during a season, and a team address is one season.
    this.calendarIds = new Map();
  }

  async request(url) {
    let response;
    try {
      response = await this.fetch(url, {
        headers: {
          'user-agent': this.userAgent,
          accept: 'application/json, text/html, text/calendar',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new FfhbError(`ffhandball.fr unreachable: ${err.message}`, { cause: err });
    }
    if (!response.ok) {
      throw new FfhbError(`ffhandball.fr answered HTTP ${response.status}`, {
        status: response.status,
      });
    }
    return response;
  }

  /** The decoding key, read from a page once and shared by concurrent reads. */
  async getKey({ refresh = false } = {}) {
    if (refresh) {
      this.key = null;
      this.keyPromise = null;
    }
    if (this.key) {
      return this.key;
    }
    this.keyPromise ??= (async () => {
      const html = await (await this.request(`${this.baseUrl}${KEY_PAGE}`)).text();
      const key = keyFromPage(html);
      if (!key) {
        throw new FfhbError('ffhandball.fr changed: no decoding key on its pages');
      }
      logger.debug('Decoding key read from ffhandball.fr');
      this.key = key;
      return key;
    })().finally(() => {
      this.keyPromise = null;
    });
    return this.keyPromise;
  }

  /**
   * The data of one block of the site.
   * @param {string} block one of {@link BLOCKS}
   * @param {Record<string, string>} params the page parameters
   */
  async fetchBlock(block, params) {
    const query = new URLSearchParams({ block, ...params });
    const response = await this.request(`${this.baseUrl}${API_PATH}?${query}`);
    let body;
    try {
      body = await response.json();
    } catch (err) {
      throw new FfhbError(`ffhandball.fr answered something else than data for ${block}`, {
        cause: err,
      });
    }
    // An object is either an error of the REST route or, should the site stop
    // obfuscating one day, the data itself.
    if (typeof body !== 'string') {
      if (body?.code && body?.message) {
        throw new FfhbError(`ffhandball.fr refused ${block}: ${body.message}`, {
          status: body.data?.status,
        });
      }
      return body;
    }
    try {
      return decodePayload(body, await this.getKey());
    } catch (err) {
      if (err instanceof FfhbError) {
        throw err;
      }
      // The site rotated its key: read it again, once.
      logger.info('The ffhandball.fr data no longer decodes: reading its key again');
      try {
        return decodePayload(body, await this.getKey({ refresh: true }));
      } catch (retryErr) {
        if (retryErr instanceof FfhbError) {
          throw retryErr;
        }
        throw new FfhbError('ffhandball.fr changed the way it encodes its data', {
          cause: retryErr,
        });
      }
    }
  }

  /**
   * The pool and the season's matches of one team, read in parallel.
   * @param {{ seasonId: string, type: string, competition: string, teamId: string }} ref
   */
  async fetchTeam(ref) {
    const params = {
      ext_saison_id: ref.seasonId,
      url_competition_type: ref.type,
      url_competition: ref.competition,
      ext_equipe_id: ref.teamId,
    };
    const [pool, matches] = await Promise.all([
      this.fetchBlock(BLOCKS.POOL, params),
      this.fetchBlock(BLOCKS.MATCHES, params),
    ]);
    return { pool, matches };
  }

  /**
   * The venue of each match of a team: internal match id (the `id` of a
   * `rencontres` entry, the UID of the feed) -> "HALL, ADDRESS ZIP, CITY".
   * The venues are a bonus: any failure is logged and answers an empty map,
   * the matches go to the calendar without them.
   * @param {{ teamId: string, path: string }} ref
   * @returns {Promise<Map<string, string>>}
   */
  async fetchVenues(ref) {
    try {
      if (!this.calendarIds.has(ref.teamId)) {
        const html = await (await this.request(`${this.baseUrl}${ref.path}`)).text();
        this.calendarIds.set(ref.teamId, calendarIdsFromPage(html, ref.teamId));
      }
      const ids = this.calendarIds.get(ref.teamId);
      if (!ids) {
        logger.debug(`Team ${ref.teamId}: no calendar feed on its page, no venues`);
        return new Map();
      }
      const feed = `${this.calendarUrl}/c-${ids.competitionId}/s-${ids.structureId}.ics`;
      return locationsFromIcs(await (await this.request(feed)).text());
    } catch (err) {
      logger.warn(`Team ${ref.teamId}: venues not read (${err.message})`);
      return new Map();
    }
  }

  /**
   * Every team of a competition, pool by pool, with the address of its page.
   * @param {{ seasonId: string, type: string, competition: string, poolId: string|null }} ref
   */
  async listTeams(ref) {
    const base = {
      ext_saison_id: ref.seasonId,
      url_competition_type: ref.type,
      url_competition: ref.competition,
    };
    const first = await this.fetchBlock(BLOCKS.POOL, {
      ...base,
      ...(ref.poolId ? { ext_poule_id: ref.poolId } : {}),
    });
    const pools = ref.poolId ? [] : (first.poules ?? []).slice(1);
    const others = await Promise.all(
      pools.map((pool) =>
        this.fetchBlock(BLOCKS.POOL, { ...base, ext_poule_id: pool.ext_pouleId }),
      ),
    );
    const prefix = `${FFHB_BASE_URL}${competitionPath(ref)}`;
    return [first, ...others].map((answer) => ({
      pool: answer.selected_poule?.libelle ?? '',
      teams: (answer.equipe_options ?? []).map((team) => ({
        name: team.libelle,
        url: `${prefix}equipe-${team.ext_equipeId}/`,
      })),
    }));
  }
}
