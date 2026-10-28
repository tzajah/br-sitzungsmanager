# Gemeinsamer Kalender mit Terminen und Erinnerungen

Stand: 2026-10-28 · Status: Entwurf zur Freigabe

## Wozu

Der Betriebsrat muss Fristen einhalten, die nicht an Sitzungen hängen: geplante Kündigungen
(Anhörungsfrist nach § 102 BetrVG), Schulungen (Freistellung, Anmeldung). Heute lässt sich das
im Sitzungsmanager nirgends eintragen, und nichts erinnert rechtzeitig daran. Außerdem können nur
Admins (Debug-Mode-Passwort) die Urlaubsmeldungen der Mitglieder einlesen, obwohl das regelmäßig
die Mitglieder mit Schreibzugriff (Arbeits-Passwort) erledigen sollen.

Ziel: ein gemeinsamer Kalender für das Gremium, in dem Urlaube, Sitzungen und eigene Termine
zusammen liegen, mit Erinnerungen, die beim Öffnen der App rechtzeitig aufpoppen.

## Ziele

1. **Termine erstellen, bearbeiten, löschen** im Kalender.
2. **Erinnerungen** mit pro Termin einstellbarem Vorlauf; erscheinen beim nächsten Login, sobald
   der Erinnerungszeitpunkt erreicht ist.
3. **Glocken-Symbol** (Benachrichtigungen), über das die nächsten Erinnerungen jederzeit abrufbar sind.
4. **Urlaubsmeldungen einlesen** für alle mit Schreibzugriff, direkt im Kalender.

## Nicht-Ziele

- Keine Benachrichtigung, solange die App geschlossen ist (kein Server, keine E-Mail, keine
  System-Benachrichtigungen des Betriebssystems).
- Keine personenbezogenen Konten. Die App kennt nur die Rollen Viewer, Arbeit und Admin.
- Keine wiederkehrenden Termine, kein iCal-Import/-Export.
- Kein Umbau von `br-urlaub-melden.html` und des Meldeformats `urlaub-v1`.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Eine Erinnerung zu einer Kündigungsfrist geht verloren, z. B. weil „gelesen" bei einem Mitglied
  sie für alle ausblendet oder ein Speicherfehler sie verschluckt.
- Termine landen nicht in der verschlüsselten Sicherungsdatei und fehlen deshalb bei den anderen.
- Viewer können Termine ändern oder Meldungen einlesen.

## Bestand (worauf aufgebaut wird)

- Sidebar-Ansicht **„Urlaub"** (`btnUrlaub`, `renderUrlaubAnsicht` in `scripts/br-app.js`): Monatsraster
  aus `urlaubKalender()` (`scripts/br-kern.js`) mit Abwesenheiten und Sitzungsterminen, darunter
  „Kommende Abwesenheiten". Heute rein lesend, für alle Rollen sichtbar, nur im Sitzungsmanager
  (`MODUS_ANSICHTEN.sitzung`).
- Admin-Menü → Reiter **„Urlaub"** (`scripts/br-export.js`): Abwesenheiten von Hand pflegen,
  „Meldungen einlesen …" (`urlaubMeldungLesen`, `urlaubMeldungenZusammenfuehren`), „Vergangene
  aufräumen", Abgleich mit `urlaub.js`.
- Rollen: `darfBearbeiten()` (Arbeit/Admin, nicht im Lese-Tab), `istAdmin()`.
- Daten: `daten.urlaub` reist in IndexedDB und in der Sicherungsdatei (`.brenc.json`) mit.
  Ausgangsbestand in `leeresProjekt()` (br-kern.js), Migration in `migriere()` (br-app.js).
  Achtung: Schreiben in IndexedDB, Wiederladen und Dateisicherung haben **jeweils eigene
  Feldlisten** (br-app.js um Z. 300–317, 393–422, 458, 658–668); `termine` muss in **alle** davon.

## Entscheidungen des Users

- **Ein gemeinsamer Kalender für alle mit Schreibzugriff.** Er ersetzt die bisherige Ansicht „Urlaub";
  das Admin-Menü braucht man für Kalender und Import nicht mehr.
- **Typische Termine:** geplante Kündigungen, Schulungen.
- **Erinnerung erscheint beim nächsten Login**, sobald der Zeitpunkt erreicht ist; das genügt.
- **Vorlauf pro Termin einstellbar.**
- **Glocken-Symbol**, das jederzeit die nächsten Benachrichtigungen zeigt.
- **„Gelesen" gilt nur für mich**: Andere sehen die Erinnerung weiter. Bis zum Termindatum bleibt
  sie über die Glocke jederzeit wieder abrufbar.
- **Import:** Mitglieder legen die JSON-Dateien aus `br-urlaub-melden.html` ab; Mitglieder mit
  Schreibzugriff lesen sie regelmäßig ein. Das bisherige Verhalten des Einlesens bleibt (eine Meldung
  ersetzt die Zeiträume ihrer Person, alle anderen bleiben unberührt).

## Entwurf

### Kalender-Ansicht

- Sidebar-Knopf „Urlaub" wird zu **„Kalender"** (gleiches Symbol), Überschrift „Kalender".
- Monatsraster wie bisher; je Tag zusätzlich die **Termine** des Tages (eigene Farbe, eigener
  Legendeneintrag). Mehrtägige Termine erscheinen an jedem Tag ihres Zeitraums.
- Unter dem Raster zwei Listen: **„Kommende Termine"** und wie bisher **„Kommende Abwesenheiten"**.
- Mit `darfBearbeiten()`: Knöpfe „+ Termin" und „Meldungen einlesen …" in der Kopfzeile; Klick
  auf einen Termin (im Raster oder in der Liste) öffnet ihn zum Bearbeiten/Löschen.
- Ohne Schreibrecht (Viewer, Lese-Tab): alles sichtbar, keine Bearbeitungsknöpfe.

### Termin

Felder: `id`, `titel` (Pflicht), `von` (ISO-Datum, Pflicht), `bis` (ISO-Datum, optional,
Standard = `von`), `uhrzeit` (optional, `HH:MM`), `notiz` (optional, Freitext), `vorlauf`
(Tage, siehe unten), `geaendertAm` (ISO-Zeitstempel).

Gespeichert in `daten.termine` (neues Feld, Standard `[]` in `leeresProjekt()`), mit eigener
Normalisierung analog zu `urlaubNormieren` (ungültige Einträge fallen weg, sortiert nach Datum).
Muss an jeder Stelle ergänzt werden, an der `urlaub` geschrieben, geladen, migriert oder in die
Sicherung verpackt wird (siehe „Bestand"); ein Test belegt den Rundlauf Speichern → Neuladen →
Sicherung → Öffnen.

### Erinnerungen

- **Vorlauf** als Auswahl: keine Erinnerung, am selben Tag, 1 Tag, 3 Tage, 1 Woche, 2 Wochen
  vorher. *(Stufen = meine Entscheidung.)* Standard für neue Termine: 1 Woche.
- **Fällig** ist eine Erinnerung ab `von − vorlauf` bis einschließlich `bis` (bei eintägigen
  Terminen `von`). Danach verschwindet sie aus der Glocke; der Termin selbst bleibt im Kalender.
  Wird ein Termin erst innerhalb des Vorlaufs oder am Termintag selbst angelegt, ist er sofort
  fällig. Bei „keine Erinnerung" gibt es nichts Fälliges; wird später ein Vorlauf gesetzt, gilt
  ab dann die normale Regel. *(Mehrtägig bis `bis` = meine Entscheidung.)*
- **„Heute"** ist das lokale Datum des Browsers. Die `uhrzeit` dient nur der Anzeige und
  beeinflusst die Fälligkeit nicht. *(Meine Entscheidung.)*
- **Beim Login**, also nach „Datei laden" und erfolgreicher Passworteingabe im Sitzungsmanager
  (in jeder Rolle, auch im Lese-Tab), erscheint ein Hinweisfenster
  mit allen fälligen, in diesem Browser **ungelesenen** Erinnerungen. Je Eintrag „Gelesen";
  dazu „Alle gelesen" und „Später" (schließt ohne zu markieren, kommt beim nächsten Login wieder).
  Ist nichts ungelesen, erscheint kein Fenster. Ein Neuladen der Seite ohne neue Passwortabfrage
  zählt nicht als Login. Das Fenster kommt erst, wenn vorangehende Dialoge des Öffnens (z. B.
  die Nachfrage beim Wiederöffnen) erledigt sind. *(Meine Entscheidung.)*
- **Glocke** in der Kopfleiste/Sidebar des Sitzungsmanagers, für alle Rollen sichtbar. Ein Zähler
  zeigt die Zahl der fälligen ungelesenen Erinnerungen. Klick öffnet eine Liste:
  oben fällige (ungelesene hervorgehoben, gelesene ausgegraut, je Eintrag umschaltbar
  gelesen/ungelesen), darunter „Demnächst" (Termine der nächsten 30 Tage, deren Erinnerung noch nicht
  fällig ist). Klick auf einen Eintrag springt in den Kalender zum Monat des Termins.
  *(30 Tage = meine Entscheidung.)*
- **„Gelesen" pro Browser:** gespeichert in `localStorage` (Schlüssel je Termin aus `id` plus
  `von` und `vorlauf`), nicht in den gemeinsamen Daten. Folge: Ändert jemand Datum oder Vorlauf,
  gilt die Erinnerung wieder als ungelesen; andere Änderungen (Titel, Notiz, `bis`, Uhrzeit) nicht.
  *(Meine Entscheidung.)* Einträge zu vergangenen oder gelöschten Terminen werden beim Laden
  verworfen. Ist `localStorage` nicht verfügbar, gilt alles als ungelesen (lieber zu oft erinnern).
- Die App kennt keine Personen; „nur für mich" heißt daher „nur in diesem Browser". Das reicht,
  solange jedes Mitglied an seinem eigenen Rechner arbeitet.

### Meldungen einlesen

- „Meldungen einlesen …" sitzt in der Kalender-Ansicht und ist an `darfBearbeiten()` gebunden statt
  an das Admin-Menü. Parser und Zusammenführung (`urlaubMeldungLesen`,
  `urlaubMeldungenZusammenfuehren`) werden wiederverwendet. Der Datei- und Bestätigungsablauf
  steckt heute in `oeffneStammdaten()` (br-export.js um Z. 1293–1318) und ruft dessen lokales
  `renderUrlaub()` auf; er wird in eine eigenständige Funktion herausgelöst, die beide Einstiege
  (Kalender und Admin-Reiter) nutzen und danach die jeweils offene Ansicht neu zeichnet.
- `darfBearbeiten()` wird **unmittelbar vor der Übernahme** geprüft, nicht erst beim Speichern,
  weil die Zusammenführung `daten.urlaub` sofort verändert.
- Der Admin-Reiter „Urlaub" bleibt für die manuelle Pflege und den `urlaub.js`-Abgleich und
  behält „Meldungen einlesen …" (gemeinsamer Ablauf).
- **`urlaub.js` wirksam:** Die zentrale Datei hat beim Öffnen nur dann Vorrang, wenn
  `window.BR_URLAUB` ein Array mit mindestens einem gültigen (normalisierten) Eintrag ist
  (br-app.js um Z. 2399–2406). Genau dann würden eingelesene Meldungen beim nächsten Start
  überschrieben, und der Import ist **an beiden Einstiegen** gesperrt, mit Hinweis, dass der
  Kalender zentral über `urlaub.js` gepflegt wird. Eine Hilfsfunktion entscheidet das für beide.
  *(Meine Entscheidung.)*

- `urlaub.js` betrifft nur `daten.urlaub`. Termine bleiben davon unberührt.

### Was gleich bleibt

- Sitzungswarnung und Vorbelegung „Entschuldigt" im Protokoll (nutzen weiter `daten.urlaub`).
- BR-Protokoll.html bekommt keinen Kalender und keine Glocke (keine Ansichten in diesem Modus).

## Rahmenbedingungen

- Läuft rein im Browser (Chrome/Edge, Chromium), offline, ohne Server; keine neuen Abhängigkeiten.
- Schreiben nur mit `darfBearbeiten()`; Lese-Tab und Viewer bleiben gesperrt, auch serverseitig
  gibt es nichts, also müssen alle Schreibpfade in der App selbst geprüft werden.
- Änderungen an Terminen markieren den Stand als ungesichert wie andere Änderungen, damit der
  bestehende Sicherungs-/Übergabe-Mechanismus sie mitnimmt.
- Tests: Kernlogik (Normalisierung, Fälligkeit, Gelesen-Schlüssel) in `test-br.js`; Ansicht,
  Login-Hinweis, Glocke und Rollen in `test-browser.js`.
- README, PRODUCT.md und CHANGELOG nachziehen.
- **Paralleles Bearbeiten (Entscheidung des Users):** Es bleibt bei der bestehenden Regel aus dem
  README: immer nur eine Person bearbeitet gleichzeitig, die zuletzt gesicherte Datei gewinnt.
  Kein Zusammenführen von Sicherungen. Begründung: kommt in der Praxis selten vor. README und
  CHANGELOG weisen beim Kalender ausdrücklich darauf hin.
- **Eine App-Version für alle:** Ältere Stände der App kennen `termine` nicht und würden sie beim
  nächsten Sichern stillschweigend weglassen. Weil alle die App vom Netzlaufwerk öffnen, wird die
  neue Version dort für alle gleichzeitig ausgetauscht; der CHANGELOG-Eintrag weist darauf hin,
  keine lokalen Altkopien weiterzubenutzen. *(Meine Entscheidung; keine Versionssperre.)*

## Dem Builder überlassen

- Konkretes Layout von Termin-Dialog, Login-Hinweis und Glocken-Liste im bestehenden Design (`br-design.css`, DESIGN.md).
- Platzierung der Glocke (Sidebar-Kopf oder Kopfzeile), solange sie in allen Ansichten sichtbar ist.
- Ob der interne Ansichtsname `urlaub` umbenannt wird.
- Darstellung vieler Einträge in einer Tageszelle.
