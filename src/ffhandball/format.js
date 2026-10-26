// -----------------------------------------------------------------------------
// How matches read, in each language.
//
// The event names stay language-free (the teams, and the score once played):
// they are what the calendar view, the reminders and the assistant read out.
// The description carries the rest, in the language of the calendar's owner.
// -----------------------------------------------------------------------------

import { pick } from '../i18n.js';
import { RESULTS, VENUES } from './team.js';

/** "CAEN HANDBALL – PARIS SAINT-GERMAIN", with the score once played. */
export function matchTitle(match) {
  if (match.played) {
    return `${match.homeTeam} ${match.homeScore} – ${match.awayScore} ${match.awayTeam}`;
  }
  return `${match.homeTeam} – ${match.awayTeam}`;
}

export const RESULT_LABELS = {
  [RESULTS.WIN]: { en: 'Win', fr: 'Victoire', de: 'Sieg', es: 'Victoria' },
  [RESULTS.DRAW]: { en: 'Draw', fr: 'Nul', de: 'Unentschieden', es: 'Empate' },
  [RESULTS.LOSS]: { en: 'Loss', fr: 'Défaite', de: 'Niederlage', es: 'Derrota' },
};

export const VENUE_LABELS = {
  [VENUES.HOME]: {
    en: 'Home match',
    fr: 'Match à domicile',
    de: 'Heimspiel',
    es: 'Partido en casa',
  },
  [VENUES.AWAY]: {
    en: 'Away match',
    fr: 'Match à l’extérieur',
    de: 'Auswärtsspiel',
    es: 'Partido fuera',
  },
};

/** "Victoire 32-29 contre CHAMBERY SAVOIE MB" */
export function resultSentence(match, language) {
  const against = pick(language, { en: 'against', fr: 'contre', de: 'gegen', es: 'contra' });
  return (
    `${pick(language, RESULT_LABELS[match.result])} ${match.scoreFor}-${match.scoreAgainst} ` +
    `${against} ${match.opponent}`
  );
}

/** "DAIKIN STARLIGUE 2026-27 · Journée 3" */
export function roundSentence(competition, match, language) {
  const round =
    match.round === null
      ? null
      : `${pick(language, { en: 'Round', fr: 'Journée', de: 'Spieltag', es: 'Jornada' })} ${match.round}`;
  return [competition, round].filter(Boolean).join(' · ');
}
