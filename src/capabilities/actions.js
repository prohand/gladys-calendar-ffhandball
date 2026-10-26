// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   - `sync_now` syncs every enabled user at once and says, user by user and
//     team by team, what ffhandball.fr answered and what went to the calendar:
//     the fastest way to check an address;
//   - `list_teams` turns the address of a competition into the addresses of
//     its teams, ready to paste: the site shows team pages, but finding the
//     one of your club means clicking through the calendar.
//
// The resolved text is shown under the button, in the reader's language.
// -----------------------------------------------------------------------------

import { localize, pick } from '../i18n.js';
import { parseCompetitionUrl } from '../config.js';

export const ACTION_KEYS = { SYNC_NOW: 'sync_now', LIST_TEAMS: 'list_teams' };

// What the Configuration screen shows under a button stays readable: a
// competition of 60 teams is cut, with the count of the others.
const MAX_LISTED_TEAMS = 40;

function matchCount(count, language) {
  return pick(language, {
    en: `${count} match${count === 1 ? '' : 'es'} in the calendar`,
    fr: `${count} match${count > 1 ? 's' : ''} dans le calendrier`,
    de: `${count} Spiel${count === 1 ? '' : 'e'} im Kalender`,
    es: `${count} partido${count === 1 ? '' : 's'} en el calendario`,
  });
}

function entryLine(entry, language) {
  if (!entry.team) {
    return `✗ ${entry.ref.url}\n   ${entry.error?.message ?? '?'}`;
  }
  const title = `${entry.team.name}${entry.team.competition ? ` (${entry.team.competition})` : ''}`;
  if (entry.skipped) {
    return `– ${title}\n   ${pick(language, {
      en: 'sync turned off in My calendars',
      fr: 'synchronisation désactivée dans Mes calendriers',
      de: 'Synchronisierung in Meine Kalender ausgeschaltet',
      es: 'sincronización desactivada en Mis calendarios',
    })}`;
  }
  if (entry.error) {
    return `✗ ${title}\n   ${entry.error.message}`;
  }
  return `✓ ${title}\n   ${matchCount(entry.events ?? 0, language)}`;
}

function invalidLine(address, language) {
  return `✗ ${address}\n   ${pick(language, {
    en: 'not a team page of ffhandball.fr (…/equipe-<number>/)',
    fr: 'pas une page équipe de ffhandball.fr (…/equipe-<numéro>/)',
    de: 'keine Mannschaftsseite von ffhandball.fr (…/equipe-<Nummer>/)',
    es: 'no es una página de equipo de ffhandball.fr (…/equipe-<número>/)',
  })}`;
}

export const ACTIONS = {
  async [ACTION_KEYS.SYNC_NOW](sync) {
    await sync.syncAll();
    const reports = [...sync.report.values()];
    return localize((language) => {
      if (reports.length === 0) {
        return pick(language, {
          en: 'Nobody has enabled the calendars yet. In My calendars on this page, paste the address of a team page of ffhandball.fr, then enable.',
          fr: "Personne n'a encore activé les calendriers. Dans Mes calendriers sur cette page, collez l'adresse d'une page équipe de ffhandball.fr, puis activez.",
          de: 'Noch niemand hat die Kalender aktiviert. Füge unter Meine Kalender auf dieser Seite die Adresse einer Mannschaftsseite von ffhandball.fr ein und aktiviere.',
          es: 'Nadie ha activado aún los calendarios. En Mis calendarios en esta página, pegue la dirección de una página de equipo de ffhandball.fr y active.',
        });
      }
      return reports
        .map((report) => {
          const lines = [
            ...report.entries.map((entry) => entryLine(entry, language)),
            ...report.invalid.map((address) => invalidLine(address, language)),
          ];
          if (lines.length === 0) {
            lines.push(
              pick(language, {
                en: 'no team: paste a team page address in My calendars',
                fr: "aucune équipe : collez l'adresse d'une page équipe dans Mes calendriers",
                de: 'keine Mannschaft: füge die Adresse einer Mannschaftsseite unter Meine Kalender ein',
                es: 'ningún equipo: pegue la dirección de una página de equipo en Mis calendarios',
              }),
            );
          }
          return `${report.user.first_name || report.user.selector}\n${lines.join('\n')}`;
        })
        .join('\n\n');
    });
  },

  async [ACTION_KEYS.LIST_TEAMS](sync, { fields }) {
    const ref = parseCompetitionUrl(fields.url);
    if (!ref) {
      return {
        en: 'Not a competition page of ffhandball.fr: open the competition on www.ffhandball.fr/competitions and copy the address from the browser.',
        fr: "Ce n'est pas une page de compétition de ffhandball.fr : ouvrez la compétition sur www.ffhandball.fr/competitions et copiez l'adresse du navigateur.",
        de: 'Keine Wettbewerbsseite von ffhandball.fr: öffne den Wettbewerb auf www.ffhandball.fr/competitions und kopiere die Adresse aus dem Browser.',
        es: 'No es una página de competición de ffhandball.fr: abra la competición en www.ffhandball.fr/competitions y copie la dirección del navegador.',
      };
    }
    const pools = await sync.client.listTeams(ref);
    const total = pools.reduce((sum, pool) => sum + pool.teams.length, 0);
    let listed = 0;
    const lines = [];
    for (const pool of pools) {
      if (pools.length > 1 && pool.pool) {
        lines.push(`— ${pool.pool}`);
      }
      for (const team of pool.teams) {
        if (listed >= MAX_LISTED_TEAMS) {
          break;
        }
        lines.push(`${team.name}\n${team.url}`);
        listed += 1;
      }
    }
    return localize((language) => {
      if (total === 0) {
        return pick(language, {
          en: 'No team in this competition yet.',
          fr: "Aucune équipe dans cette compétition pour l'instant.",
          de: 'Noch keine Mannschaft in diesem Wettbewerb.',
          es: 'Aún no hay equipos en esta competición.',
        });
      }
      const intro = pick(language, {
        en: 'Copy the address of your team into the Teams field of My calendars:',
        fr: "Copiez l'adresse de votre équipe dans le champ Équipes de Mes calendriers :",
        de: 'Kopiere die Adresse deiner Mannschaft in das Feld Mannschaften unter Meine Kalender:',
        es: 'Copie la dirección de su equipo en el campo Equipos de Mis calendarios:',
      });
      const more =
        total > listed
          ? `\n… ${pick(language, {
              en: `and ${total - listed} more: give the address of one pool to see it.`,
              fr: `et ${total - listed} autres : donnez l'adresse d'une poule pour la voir.`,
              de: `und ${total - listed} weitere: gib die Adresse einer Gruppe an, um sie zu sehen.`,
              es: `y ${total - listed} más: indique la dirección de un grupo para verlo.`,
            })}`
          : '';
      return `${intro}\n${lines.join('\n')}${more}`;
    });
  },
};
