// -----------------------------------------------------------------------------
// Entry point of the FFHandball calendar integration.
//
// Role of this file: wire the SDK to the sync loop (src/sync.js), which reads
// ffhandball.fr and pushes the matches into the Gladys calendars. It holds no
// handball logic:
//   1. it instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. it registers the event handlers BEFORE connect();
//   3. it connects, then syncs every user who enabled the integration.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { FfhbClient } from './src/ffhandball/client.js';
import { CalendarSync } from './src/sync.js';
import { ACTION_KEYS, ACTIONS } from './src/capabilities/actions.js';

// A promise rejected with nobody listening (a timer callback) would terminate
// Node: log it and keep syncing.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

const gladys = new GladysIntegration();
const sync = new CalendarSync({ gladys, client: new FfhbClient() });
sync.setConfig(normalizeConfig());

// --- A user enabled, disabled or changed their calendars ---------------------
// Their "My calendars" block: account values (the teams) or a calendar's
// `sync` / `shared` toggle. The change is already applied in the core.
gladys.onCalendarAccountUpdated(async (userSelector) => {
  logger.info(`onCalendarAccountUpdated -> syncing ${userSelector}`);
  await sync.syncUser(userSelector);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
gladys.onAction('sync_now', () => ACTIONS[ACTION_KEYS.SYNC_NOW](sync));
gladys.onAction('list_teams', (fields) => ACTIONS[ACTION_KEYS.LIST_TEAMS](sync, { fields }));

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  sync.setConfig(normalizeConfig(newConfig));
  await sync.start();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    sync.setConfig(normalizeConfig(await gladys.getConfig()));
    // Account changes are lost while disconnected: push everything again.
    sync.forget();
    await sync.start();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, prüfe die Protokolle der Integration.',
        es: 'La inicialización ha fallado, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  sync.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  sync.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the FFHandball calendar integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
