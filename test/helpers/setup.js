// Shared set-up of the tests: a sync loop on the fake site and the SDK fake
// Gladys, with users who enabled the integration.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../../src/config.js';
import { FfhbClient } from '../../src/ffhandball/client.js';
import { CalendarSync, WriteLimiter } from '../../src/sync.js';
import { createFakeFfhb, TEAM_URL } from './fakeFfhb.js';

export const SELECTOR = 'ffhandball-calendar';

export const MARIE = { selector: 'marie', first_name: 'Marie', language: 'fr' };
export const JOHN = { selector: 'john', first_name: 'John', language: 'en' };

/** An account as getCalendarAccounts() returns it. */
export const account = (user, teams = TEAM_URL) => ({ user, config: { teams } });

/**
 * @param {object} [options]
 * @param {object[]} [options.accounts] the users who enabled the integration
 * @param {object} [options.server] a fake site (a new one by default)
 * @param {object} [options.config] raw instance configuration
 */
export function setup({ accounts = [account(MARIE)], server, config = {} } = {}) {
  const site = server ?? createFakeFfhb();
  const gladys = createFakeGladys({ selector: SELECTOR, calendarAccounts: accounts });
  const client = new FfhbClient({ fetch: site.fetch });
  // No waiting in the tests: the limiter is tested on its own.
  const limiter = new WriteLimiter({ limit: Infinity });
  const sync = new CalendarSync({ gladys, client, limiter });
  sync.setConfig(normalizeConfig(config));
  return { site, gladys, fake: gladys.fake, client, sync };
}
