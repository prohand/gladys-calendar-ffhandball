// -----------------------------------------------------------------------------
// Just enough iCalendar (RFC 5545) to read the venues of a club's feed.
//
// The feed of competition-calendar.ffhandball.fr has one VEVENT per scheduled
// match: its UID is the match's internal id (the `id` of the site's
// `rencontres` entries), its LOCATION the hall and its address. The dates,
// teams and scores are read from the site's data service instead, which also
// lists the matches without a date and gives the scores: only LOCATION is
// taken from here.
// -----------------------------------------------------------------------------

/** Undo the line folding: a line starting with a space or a tab continues the previous one. */
function unfold(text) {
  return String(text).replace(/\r?\n[ \t]/g, '');
}

/** Undo the TEXT escaping: `\,` `\;` `\\` and `\n`. */
function unescapeText(value) {
  return value.replace(/\\([\\;,nN])/g, (_all, char) =>
    char === 'n' || char === 'N' ? '\n' : char,
  );
}

/**
 * The LOCATION of every event of a feed, by UID.
 * @param {string} text the iCalendar document
 * @returns {Map<string, string>}
 */
export function locationsFromIcs(text) {
  const locations = new Map();
  let event = null;
  for (const line of unfold(text).split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (event?.uid && event.location) {
        locations.set(event.uid, event.location);
      }
      event = null;
      continue;
    }
    if (!event) {
      continue;
    }
    // NAME;PARAM=…:VALUE — the value starts at the first colon after the name
    // and its parameters (a quoted parameter may hold a colon).
    const match = line.match(/^([A-Z-]+)((?:;[^:;]+=(?:"[^"]*"|[^:;]*))*):(.*)$/);
    if (!match) {
      continue;
    }
    const [, name, , value] = match;
    if (name === 'UID') {
      event.uid = value.trim();
    } else if (name === 'LOCATION') {
      event.location = unescapeText(value).replace(/\s+/g, ' ').trim();
    }
  }
  return locations;
}
