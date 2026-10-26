# FFHandball Calendar

Diese Integration trägt die Spiele deiner Handballmannschaften in den **Gladys-Kalender** ein,
von **ffhandball.fr**, der Website des französischen Handballverbands: Profiligen, nationale,
regionale und departementale Meisterschaften. Jede Mannschaft wird ein Kalender, mit jedem
angesetzten Spiel, seiner Halle, seinem Link und, sobald gespielt, seinem Ergebnis.

Kein Konto, kein Schlüssel: Die Integration liest die öffentliche Website über das Internet.

Erfordert **Gladys 5.3.0 oder neuer**.

Diese Integration macht nur den Kalender. Für die Tabelle, die aktuellen Ergebnisse, die
eigenen Szenenauslöser und die Widgets installiere zusätzlich die Integration **FFHandball**:
Beide arbeiten zusammen, mit denselben Mannschaftsadressen.

## Mannschaften hinzufügen

1. Wähle auf [www.ffhandball.fr/competitions](https://www.ffhandball.fr/competitions/) die
   Saison, den Wettbewerb und klicke auf deine Mannschaft (im Spielplan oder in der Tabelle).
2. Kopiere die Adresse dieser Seite aus deinem Browser. Sie endet mit `/equipe-<Nummer>/`,
   zum Beispiel:

   ```
   https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/
   ```

3. Öffne in Gladys die Seite der Integration. Füge im Block **Meine Kalender** die Adresse in
   **Mannschaften** ein, eine pro Zeile für mehrere Mannschaften, und aktiviere.

Jedes Haushaltsmitglied aktiviert die Integration für sich selbst und wählt seine eigenen
Mannschaften: Die Kalender gehören ihm. Sie sind anfangs **privat**: Teile einen im selben
Block, damit der Haushalt ihn sieht und die Szenen ihn nutzen können.

**Du findest die Mannschaftsseite nicht?** Kopiere stattdessen die Adresse des Wettbewerbs
(oder einer seiner Gruppen) und füge sie in die Schaltfläche **Mannschaften eines Wettbewerbs
auflisten** ein: Die Antwort listet jede Mannschaft mit der einzufügenden Adresse auf.

**Neue Saison, neue Adressen.** Der Verband gibt jeder Mannschaft jede Saison eine neue Seite:
Ersetze im September die Adresse. Der alte Kalender wird gelöscht, ein neuer für die Saison
angelegt.

## Konfiguration

| Feld                                   | Zweck                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Mannschaften** (Meine Kalender)      | Adressen von Mannschaftsseiten, eine pro Zeile. Eine Liste pro Benutzer.                                               |
| **Aktualisierungsintervall (Minuten)** | Minuten zwischen zwei Lesevorgängen von ffhandball.fr, für alle Kalender (Standard 60, mindestens 15, höchstens 1440). |

**Jetzt synchronisieren** liest sofort jede Mannschaft jedes Benutzers und zeigt, Mannschaft
für Mannschaft, wie viele Spiele im Kalender sind — oder warum es fehlschlug.

## Was in den Kalender kommt

| Element        | Inhalt                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| Kalender       | Einer pro Mannschaft, benannt nach der Mannschaft und ihrem Wettbewerb, mit eigener Farbe |
| Termin         | Einer pro angesetztem Spiel, z. B. „CAEN HANDBALL – PARIS SAINT-GERMAIN“                  |
| Nach dem Spiel | Das Ergebnis im Namen, z. B. „CAEN HANDBALL 29 – 32 PARIS SAINT-GERMAIN“, und der Ausgang |
| Zeit           | Der Anpfiff, für 1 h 30                                                                   |
| Ort            | Die Halle und ihre Adresse, wie der Verein sie veröffentlicht                             |
| Beschreibung   | Der Wettbewerb, der Spieltag, Heim- oder Auswärtsspiel, das Ergebnis                      |
| Link           | Die Seite des Spiels auf ffhandball.fr                                                    |

Ein Spiel **ohne Datum** erscheint nicht: Es kommt in den Kalender, sobald der Verband es
ansetzt. Ein **verlegtes** Spiel wird verschoben, ein Spiel, das sein Datum verliert, entfernt.

Die Texte sind in der Sprache des Benutzers in Gladys. Die Zeiten sind die, die der Verband
veröffentlicht (französische Zeit).

## In Szenen

Die Spiele sind Kalendertermine wie alle anderen: Der Kalenderauslöser von Gladys (ein Termin
steht bevor) und seine Kalenderaktionen sehen sie, sobald der Kalender **geteilt** ist. Zum
Beispiel:

- eine Stunde vor einem Heimspiel alle daran erinnern, zur Halle aufzubrechen;
- am Morgen eines Spiels den Namen und den Ort des Termins senden.

## Fehlerbehebung

- **„keine Mannschaftsseite“**: Die Adresse muss `/equipe-<Nummer>/` enthalten. Nutze die
  Schaltfläche **Mannschaften eines Wettbewerbs auflisten**, um sie zu erhalten.
- **„team … not found on ffhandball.fr“**: Die Saison dieser Seite ist vorbei oder die
  Mannschaft wurde zurückgezogen. Füge die Adresse der laufenden Saison ein.
- **„ffhandball.fr unreachable“**: Die Website oder deine Internetverbindung ist gestört; der
  Kalender behält seine Spiele und die Integration versucht es bei der nächsten Aktualisierung
  erneut.
- **Kein Ort**: Der Verein hat für diesen Wettbewerb keinen Kalender auf ffhandball.fr
  veröffentlicht; die Spiele sind da, ohne Halle.
- **Ein Kalender wird nicht mehr aktualisiert**: Seine Synchronisierung ist vielleicht unter
  **Meine Kalender** ausgeschaltet.

## Datenschutz

Die Integration liest nur öffentliche Seiten von ffhandball.fr. Sie sendet nichts über dich
oder dein Zuhause, schreibt keine Datei und synchronisiert nur die Benutzer, die sie aktiviert
haben.
