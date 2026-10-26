// -----------------------------------------------------------------------------
// The sync loop: ffhandball.fr -> the Gladys calendars of every enabled user.
//
// "The integration syncs, the core stores." Every `refresh_minutes`, and when
// a user changes something on their "My calendars" block:
//   1. read the users who enabled the integration and their teams;
//   2. read each team once, however many users follow it;
//   3. per user: upsert one calendar per team read, delete the calendars of
//      the teams they no longer list, then republish the season of each team
//      (a window push: a moved match moves, an unscheduled one leaves).
//
// Calendars are personal data: only the users who enabled the integration are
// synced, each one owning their calendars. A calendar the user set to
// `sync: false` is skipped (the core refuses it with a 403 anyway).
//
// The core counts 30 calendar writes per minute per integration: a write is
// only sent when what it carries changed since the last push, and the writes
// go through a limiter that stays under that pace.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, normalizeAccount, parseTeams } from './config.js';
import { languageOf } from './i18n.js';
import { buildTeam } from './ffhandball/team.js';
import {
  calendarExternalId,
  calendarPrefix,
  seasonWindow,
  toCalendar,
  toEvents,
} from './calendar.js';

const logger = createLogger({ name: 'sync' });

/** Holds the calendar writes under the core's limit (30 per minute). */
export class WriteLimiter {
  constructor({
    limit = 25,
    intervalMs = 60_000,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {}) {
    this.limit = limit;
    this.intervalMs = intervalMs;
    this.now = now;
    this.sleep = sleep;
    this.stamps = [];
  }

  async take() {
    for (;;) {
      const now = this.now();
      this.stamps = this.stamps.filter((stamp) => stamp > now - this.intervalMs);
      if (this.stamps.length < this.limit) {
        this.stamps.push(now);
        return;
      }
      await this.sleep(this.stamps[0] + this.intervalMs - now);
    }
  }
}

export class CalendarSync {
  /**
   * @param {object} options
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
   * @param {import('./ffhandball/client.js').FfhbClient} options.client
   * @param {WriteLimiter} [options.limiter]
   */
  constructor({ gladys, client, limiter = new WriteLimiter() }) {
    this.gladys = gladys;
    this.client = client;
    this.limiter = limiter;
    this.config = { ...DEFAULT_CONFIG };
    this.timer = null;
    // One sync at a time: the refresh, a user's change and the "Sync now"
    // button would otherwise push the same calendars concurrently.
    this.queue = Promise.resolve();
    // What was last pushed, by calendar external id (and `calendars:<user>`
    // for the calendar list of a user): an unchanged payload is not resent.
    this.published = new Map();
    // The last outcome, by user selector, for the "Sync now" button.
    this.report = new Map();
  }

  setConfig(config) {
    this.config = config;
  }

  /** Sync now, then every `refresh_minutes`. */
  async start() {
    this.stop();
    try {
      await this.syncAll();
    } finally {
      this.schedule();
    }
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.syncAll()
        .catch((err) => logger.error('Sync failed', err))
        .finally(() => this.schedule());
    }, this.config.refresh_minutes * 60_000);
  }

  /** Push everything again at the next sync: Gladys may have changed while we were away. */
  forget(userSelector) {
    if (userSelector === undefined) {
      this.published.clear();
      return;
    }
    const prefix = calendarPrefix(this.gladys, userSelector);
    for (const key of this.published.keys()) {
      if (key.startsWith(prefix) || key === `calendars:${userSelector}`) {
        this.published.delete(key);
      }
    }
  }

  enqueue(task) {
    const run = this.queue.then(task);
    this.queue = run.catch(() => {});
    return run;
  }

  /** Every enabled user, each team read once. */
  syncAll() {
    return this.enqueue(async () => {
      const accounts = await this.gladys.getCalendarAccounts();
      const teams = new Map();
      for (const selector of this.report.keys()) {
        if (!accounts.some((account) => account.user.selector === selector)) {
          this.report.delete(selector);
        }
      }
      for (const account of accounts) {
        await this.syncAccount(account, teams);
      }
      await this.reportStatus();
    });
  }

  /**
   * One user changed something (enabled, disabled, new teams, a `sync`
   * toggle): their calendars are already up to date in the core, push them
   * again from scratch.
   */
  syncUser(userSelector) {
    return this.enqueue(async () => {
      this.forget(userSelector);
      const accounts = await this.gladys.getCalendarAccounts();
      const account = accounts.find((entry) => entry.user.selector === userSelector);
      if (!account) {
        // Disabled: the core already destroyed their calendars.
        this.report.delete(userSelector);
        return;
      }
      await this.syncAccount(account, new Map());
    });
  }

  /** The team and its venues, read once per sync however many users follow it. */
  readTeam(ref, teams) {
    if (!teams.has(ref.teamId)) {
      teams.set(
        ref.teamId,
        (async () => {
          const [blocks, venues] = await Promise.all([
            this.client.fetchTeam(ref),
            this.client.fetchVenues(ref),
          ]);
          return { team: buildTeam(ref, blocks), venues };
        })(),
      );
    }
    return teams.get(ref.teamId);
  }

  async write(key, payload, send) {
    const serialized = JSON.stringify(payload);
    if (this.published.get(key) === serialized) {
      return false;
    }
    await this.limiter.take();
    await send();
    this.published.set(key, serialized);
    return true;
  }

  async syncAccount({ user, config }, teams) {
    const { gladys } = this;
    const selector = user.selector;
    const language = languageOf(user.language);
    const { teams: refs, invalid } = parseTeams(normalizeAccount(config).teams);
    const entries = await Promise.all(
      refs.map(async (ref, index) => {
        try {
          return { ref, index, ...(await this.readTeam(ref, teams)) };
        } catch (error) {
          logger.warn(`Team ${ref.teamId} not read: ${error.message}`);
          return { ref, index, error };
        }
      }),
    );
    this.report.set(selector, { user, invalid, entries });
    const read = entries.filter((entry) => entry.team);

    try {
      // 1. The calendars first: the events need theirs to exist.
      const calendars = read.map((entry) =>
        toCalendar(entry.team, { gladys, userSelector: selector, index: entry.index, language }),
      );
      if (calendars.length > 0) {
        await this.write(`calendars:${selector}`, calendars, () =>
          gladys.publishCalendars(selector, calendars),
        );
      }

      // 2. What the core holds: the user's `sync` toggles, and the calendars
      // of the teams no longer listed (a team failing to read keeps its own).
      const existing = await gladys.getCalendars(selector);
      const prefix = calendarPrefix(gladys, selector);
      const listed = new Set(refs.map((ref) => calendarExternalId(gladys, selector, ref.teamId)));
      for (const calendar of existing) {
        if (calendar.external_id.startsWith(prefix) && !listed.has(calendar.external_id)) {
          await this.limiter.take();
          await gladys.deleteCalendar(calendar.external_id);
          this.published.delete(calendar.external_id);
          logger.info(`Calendar ${calendar.external_id} deleted: its team is no longer listed`);
        }
      }
      const skipped = new Set(
        existing.filter((calendar) => !calendar.sync).map((calendar) => calendar.external_id),
      );

      // 3. The season of each team.
      for (const entry of read) {
        const id = calendarExternalId(gladys, selector, entry.ref.teamId);
        if (skipped.has(id)) {
          // Pushed again in full once the user turns it back on.
          this.published.delete(id);
          entry.skipped = true;
          continue;
        }
        const events = toEvents(entry.team, {
          gladys,
          userSelector: selector,
          language,
          venues: entry.venues,
        });
        const window = seasonWindow(entry.ref, events);
        entry.events = events.length;
        try {
          await this.write(id, { events, window }, () =>
            gladys.publishCalendarEvents(id, events, window),
          );
        } catch (error) {
          logger.error(`Calendar ${id} not pushed: ${error.message}`);
          entry.error = error;
        }
      }
    } catch (error) {
      // The core refused (a 429, the user disabled meanwhile…): the next sync
      // pushes what was not.
      logger.error(`Calendars of ${selector} not pushed: ${error.message}`);
      for (const entry of read) {
        entry.error ??= error;
      }
    }
  }

  /** The badge of the Configuration screen: red when no team could be read at all. */
  async reportStatus() {
    const entries = [...this.report.values()].flatMap((report) => report.entries);
    const failed = entries.length > 0 && entries.every((entry) => entry.error && !entry.team);
    await this.gladys
      .setConnectionStatus(
        !failed,
        failed
          ? {
              en: 'ffhandball.fr could not be read: see the "Sync now" button.',
              fr: 'ffhandball.fr n’a pas pu être lu : voir le bouton « Synchroniser maintenant ».',
              de: 'ffhandball.fr konnte nicht gelesen werden: siehe die Schaltfläche „Jetzt synchronisieren“.',
              es: 'No se pudo leer ffhandball.fr: vea el botón «Sincronizar ahora».',
            }
          : undefined,
      )
      .catch((err) => logger.warn(`Connection status not sent: ${err.message}`));
  }
}
