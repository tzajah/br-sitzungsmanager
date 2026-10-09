# BR-Sitzungsmanager

Vollständiger Sitzungsmanager für einen **Betriebsrat**: Tagesordnungen,
Protokolle, Beschlüsse, Anlagen sowie Stammdaten (BR, SBV, JAV) – **lokal,
offline und verschlüsselt**. Erzeugt rechtssichere PDFs (Einladung,
Anwesenheitsliste, Niederschrift) nach den einschlägigen Vorschriften des BetrVG.

## Auf einen Blick

- **Kein Server, kein Build-Schritt**, läuft vollständig offline im Browser.
  Die HTML-Dateien liegen im Stammverzeichnis, alles per `<script src>` Geladene
  im Unterordner **`scripts/`** (vollständige Liste unter „Projektdateien"):

  ```
  BR-Sitzungsmanager.html      Einstieg für die Sitzungsleitung
  BR-Protokoll.html            Einstieg für die Schriftführung
  br-design.css                Erscheinungsbild
  br-sicherung-teilen.html     Werkzeuge (einzeln weitergebbar)
  br-anlagen-entfernen.html
  br-urlaub-melden.html
  scripts/
    br-kern.js  br-app.js  br-tagesordnung.js  br-protokoll.js  br-export.js
    pdf-lib.min.js
    standard-tops.js  category.js  protokoll_vorlagen.js
    beschluss_vorlagen.js  urlaub.js
    br-zugang.js  Gremium
  ```

  Der Ordner `scripts/` muss mitkopiert werden – ohne ihn startet die App nicht.
  Ohne gültige `scripts/br-zugang.js` bleibt sie gesperrt.
- **Getrennte Dateien und getrennte Speicherstände.** Die Sitzungsleitung plant in
  `BR-Sitzungsmanager.html` (Rahmendaten, Tagesordnung, Einladung, Präsentation),
  die Schriftführung protokolliert in `BR-Protokoll.html` (Tagesordnung,
  Anwesenheit, Verlauf, Beschlüsse, Aufgaben, Protokoll-PDF). Beide laden denselben
  Code, haben aber eine **eigene Ablage** und können sich nicht gegenseitig
  überschreiben. Der Austausch läuft gerichtet: Der Manager übergibt die
  **Tagesordnung**, das Protokollmodul die **Beschlüsse und Aufgaben**. Die
  Stammdaten kommen für beide aus der Nachbardatei **`Gremium`**. Die Tagesordnung
  lässt sich in beiden Modulen bearbeiten, die gremiumsweiten Übersichten führt nur
  der Manager. Das ist eine **Aufgaben-, keine Rechtetrennung** – wer beide Dateien
  öffnet, kann beides bearbeiten.
- **Login beim Öffnen**: Beim Start wird die Speicherdatei geladen („Datei laden");
  das danach abgefragte Passwort bestimmt die Rolle – **Viewer** (nur Ansehen),
  **Arbeitsmodus** oder **Debug-Mode**. Ein Neuladen der Seite setzt die Sitzung
  ohne Passwort fort; erst „Datei schließen" verlangt wieder Datei und Passwort.
- **Verschlüsselte Ablage** im Browser (WebCrypto, AES-GCM) mit **drei Rollen-
  Passwörtern**; der Zugang (verschlüsselter Hauptschlüssel, keine Klartext-
  Passwörter) liegt in der Nachbardatei `br-zugang.js` und ist maßgeblich.
- **PDF-Erzeugung** über eine eingebettete Layout-Engine (pdf-lib, in
  `pdf-lib.min.js` ausgelagert).

## Funktionsumfang

- **Sitzungen** anlegen, speichern, duplizieren; Status (Entwurf → Eingeladen →
  Protokoll → Abgeschlossen).
- **Tagesordnung** mit Punkten, Kategorien, Referent, Dauer und Anlagen sowie
  **Unterpunkten** (2.1, 2.2 …) – jeder Unterpunkt kann eine eigene Kategorie,
  eigene Beschlüsse, Aufgaben **und Anlagen** tragen. Die Kategorie ist optional
  („– ohne –"); ein neuer Unterpunkt übernimmt zunächst die Kategorie seines TOP.
- **Einladung** (nur Sitzungsmanager): die **geplante Anwesenheit** vor der Sitzung –
  Status je Mitglied, „Vertreten durch" für das geladene Ersatzmitglied und eine
  Vorschau der Beschlussfähigkeit. Sie füllt dasselbe Feld wie das Protokollmodul,
  reist mit der Tagesordnung dorthin und speist die vor der Sitzung gedruckte
  Anwesenheitsliste. Dazu die **zu ladenden Gäste** (Arbeitgeber, Gewerkschaft, SBV, JAV,
  Sachverständige) – dieselbe Liste, die das Protokollmodul führt, inklusive Übernahme
  aktiver SBV-/JAV-Personen aus den Stammdaten. Sobald die Schriftführung eigene Angaben
  erfasst hat, gilt deren Stand – die Planung überschreibt nie Protokolliertes.
- **Protokoll** mit Anwesenheit, tatsächlichem Beginn und Ende der Sitzung,
  Beschlussfähigkeit (§ 33 Abs. 2 BetrVG), Beschlüssen im Wortlaut (inkl.
  Unterpunkte), automatischer Abstimmungsauswertung (§ 33 Abs. 1) und Aufgaben je
  TOP/Unterpunkt. Mitglieder – etwa ein nachgerücktes Ersatzmitglied – lassen sich als
  **nur bei einzelnen TOPs anwesend** erfassen; sie zählen dann nur bei den Beschlüssen
  dieser TOPs mit. Je Beschluss lassen sich anwesende Mitglieder als **nicht an der
  Abstimmung beteiligt** markieren (nicht stimmberechtigt oder abwesend); die
  Mehrheit wird dann aus den Beteiligten berechnet, und die Niederschrift nennt sie.
- **Textformatierung im Verlauf** („Verlauf / Ergebnis der Beratung", je TOP und
  Unterpunkt): kleine WYSIWYG-Leiste für **Fett**, *Kursiv*, Unterstrichen sowie
  Aufzählungs- und Nummerierungslisten. Die Auszeichnung erscheint in der App und
  im Protokoll-PDF. Der Verlauf wird als eng begrenztes, sanitisiertes HTML-Subset
  gespeichert; ältere Klartext-Verläufe werden beim Laden automatisch übernommen.
- **Beschluss-Übersicht** über alle Sitzungen mit Filter (Jahr/Ergebnis/**Status**/
  Tag/Suche) und Export als PDF und CSV. Jeder Beschluss hat einen **Status**
  („In Arbeit" / „Zugestellt").
- **Aufgabenübersicht** über alle Sitzungen (aus den Protokollen erzeugt) mit
  Filter (Jahr/Zuständig/Suche) und Export als PDF und CSV.
- **Einladung als E-Mail** (`.eml`): versandfertige Datei im Layout der PDF-Einladung (HTML mit
  Briefkopf, Logo und Akzentfarbe; dazu eine reine Textfassung für Programme ohne HTML) mit den aktiven BR-Mitgliedern
  als Empfänger (aus deren E-Mail-Adressen) sowie der als Gast geladenen SBV und JAV.
  Ist im Admin-Menü ein **E-Mail-Verteiler des Gremiums** hinterlegt, ersetzt er die
  Einzeladressen der ordentlichen Mitglieder; ein **E-Mail-Verteiler der SBV** bzw. **der JAV** ersetzt entsprechend
  die Einzeladressen der jeweiligen Gruppe, wenn sie als Gast geladen ist. Ersatzmitglieder werden einzeln eingeladen –
  und nur, wenn sie für die Sitzung geladen sind (geplante Anwesenheit „anwesend“/„Video“
  oder unter „Vertreten durch“ genannt);
  der vollständige Einladungstext steht im Mailtext (kein PDF-Anhang) – öffnet in
  Outlook & anderen Clients.
- **Dokumentenmanagement**: zentrales Panel für hochgeladene Dokumente, alle
  Sitzungs-Anlagen und automatisch archivierte Protokoll-/Einladungs-PDFs –
  verschlüsselt, mit Filter, Ansehen, Herunterladen und Löschen.
- **Sitzungsliste** mit Suche, Gruppierung nach Jahr und Archivierung.
- **Standard-Tagesordnungspunkte** aus einer externen Datei `standard-tops.js`
  (im Ordner `scripts`), im Admin-Menü editierbar; werden beim Anlegen jeder Sitzung
  automatisch eingefügt. Je Punkt lassen sich **Unterpunkte** hinterlegen, die dann
  als 1.1, 1.2 … mit entstehen – in der Datei über ein optionales Feld
  `"unterpunkte": [{ "titel": "…", "kategorie": "…" }]` (Kurzform `["Erster", "Zweiter"]`
  genügt auch; die Kategorie ist optional).
- **TOP-Kategorien** (z. B. Formalia, Beratung, Beschlussfassung) aus einer externen
  Datei `category.js` (im Ordner `scripts`), im Admin-Menü editierbar (Bezeichnung
  anlegen/umbenennen/sortieren); ein interner Schlüssel bleibt stabil.
- **Textbausteine für Protokolle** aus einer externen Datei `protokoll_vorlagen.js`
  (im Ordner `scripts`), im Admin-Menü editierbar; im Protokoll je Tagesordnungspunkt
  über „+ Textblock einfügen" an der Cursorposition auswähl- und einfügbar.
- **Textbausteine für Beschlüsse** aus einer externen Datei `beschluss_vorlagen.js`
  (im Ordner `scripts`), im Admin-Menü unter „Textbausteine" editierbar; im Protokoll je
  Beschluss über „+ Textblock einfügen" in den **Wortlaut** übernehmbar. Ausgeliefert
  werden Formulierungen zu §§ 37, 80, 87, 99 und 102 BetrVG.
- **Urlaubs-/Abwesenheitskalender**, im Admin-Menü des Sitzungsmanagers
  unter „Urlaub" gepflegt: Name (mit Vorschlägen aus den Stammdaten), Zeitraum und Grund. Im Reiter
  „Sitzung" warnt die App beim gewählten Datum, wer fehlt; im Protokoll werden diese
  Mitglieder als „Entschuldigt" **vorbelegt**, solange noch kein Status erfasst ist –
  bereits erfasste Angaben bleiben unberührt. Namen ohne Zuordnung in den Stammdaten
  werden gemeldet, „Vergangene aufräumen" entfernt abgelaufene Zeiträume. Wer den
  Kalender lieber zentral pflegt, legt `urlaub.js` in den Ordner `scripts` – die Datei hat
  dann beim Öffnen Vorrang und lässt sich aus der App heraus erzeugen.
- **Die Mitglieder melden selbst**: `br-urlaub-melden.html` ist eine eigenständige Seite
  **ohne Passwort**. Name eintragen, Zeiträume erfassen, speichern – die erzeugte
  JSON-Datei geht an die Sitzungsleitung, die sie über „Meldungen einlesen …"
  übernimmt (mehrere auf einmal möglich). Eine Meldung ist für ihre Person maßgeblich:
  Deren Zeiträume werden ersetzt, alle anderen bleiben unangetastet.
- **Kalenderansicht „Urlaub"** im Sitzungsmanager: Monatsraster, in dem Abwesenheiten
  und Sitzungstermine im selben Blick liegen – Terminkollisionen sieht man sofort.
  Monatsweise blätterbar, darunter die kommenden Abwesenheiten mit Tagesanzahl.
- **Sitzungsstand** im Protokollmodul: Beschlussfähigkeit, protokollierte Punkte mit
  Fortschrittsleiste, Zahl der Beschlüsse, Aufgaben und Gäste sowie ein Hinweis,
  solange eine Sitzungspause läuft – dauerhaft in der Seitenleiste sichtbar. Die
  Sprungleiste im Protokoll-Reiter zeigt je TOP, ob dort schon etwas erfasst ist.
- **Inhaltsverzeichnis im Protokoll-Reiter** wie der Navigationsbereich in Word: steht im
  freien Rand links neben dem Protokoll und scrollt mit. Es gliedert in Anwesenheit, TOPs mit
  Unterpunkten und Anlagen, springt per Klick an die Stelle (klappt einen zugeklappten TOP dafür
  auf) und markiert, wo man gerade steht. Per Pfeil-Knopf lässt es sich zu einer schmalen Leiste
  einklappen. Ab 1280 px Fensterbreite; darunter bleibt die Sprungleiste.
- **Eigenes Erscheinungsbild** je Gremium (Admin-Menü → „Erscheinungsbild“): Akzentfarbe
  für App, PDFs und Präsentation (Varianten werden abgeleitet, der Kontrast bleibt gewahrt),
  Name und Untertitel der Anwendung sowie das Logo in der Seitenleiste.
- **Beschluss-Tags**: farbige Schlagworte, im Admin-Menü konfigurierbar, je
  Beschluss zuweisbar, in der Beschluss-Übersicht filterbar und im Export.
- **Dokument-Ordner**: das Dokumente-Panel gruppiert je Sitzung in Ordnern;
  Uploads landen im geöffneten Ordner.
- **Stammdaten**: Betriebsrat, **Schwerbehindertenvertretung (SBV)** und
  **Jugend- und Auszubildendenvertretung (JAV)** mit Rollen und **E-Mail-Adressen**;
  nur BR zählt für Anwesenheit und Beschlussfähigkeit. SBV/JAV lassen sich pro
  Sitzung als Gäste übernehmen.
- **Copyright-Vermerk** in der App-Fußzeile (statisch in der HTML hinterlegt).
- **Erscheinungsbild „Leitsystem"** (seit v0.35.0): die Bildsprache industrieller
  Beschilderung – Kennfeld, Emailleschild, Bodenmarkierung. Die Bedeutung liegt zuerst
  in der **Form** (Rechteck = Freigabe, Dreieck = Warnung, Kreis = Halt), die Farbe
  bestätigt nur; dadurch bleibt jede Aussage im Schwarzweißdruck und für farbfehlsichtige
  Leser erhalten. Alle Maße sind Vielfache von 4 px, Ziffern laufen tabellarisch,
  Kennfelder und Überschriften stehen in **Bahnschrift** (DIN 1451). Einzelheiten in
  `DESIGN.md`.
- **Überarbeitete Oberfläche**: Navigationsleiste mit Aktiv-Markierung, beim
  Scrollen sichtbare Reiter, TOP-Sprungleiste und ein-/ausklappbare
  TOP-Blöcke in Tagesordnung und Protokoll, Reiter im
  Admin-Menü, Passwort-Anzeigen-Umschalter am Login, Sprungmarke für die
  Tastaturbedienung.
- **Bearbeiter-Dialog beim Sichern**: bei jeder Sicherung wird die speichernde
  Person erfasst (erscheint im Sicherungsvermerk).
- **PDF-Export**: Einladung (§ 29 Abs. 2), Anwesenheitsliste (§ 34 Abs. 1 S. 3),
  Niederschrift (§ 34). Hochgeladene Anlagen werden **im Anlagenverzeichnis** der
  PDFs mit Nummer, Name und Fundstelle (TOP bzw. Unterpunkt) aufgeführt und sind
  über den BR-Sitzungsmanager einsehbar (keine Einbettung ins PDF). Die
  **Anwesenheitsliste** führt nur die tatsächlich Teilnehmenden (Präsenz und
  Video/Telefon) auf – in getrennten Blöcken für Betriebsratsmitglieder und Gäste,
  jeweils mit den Spalten „Abw. Anwesenheit" (Video/Telefon) und „Unterschrift".
  Beide Spalten stehen immer – sie werden in der Sitzung von Hand ausgefüllt. Kurz
  gehalten wird die Liste über die **Zeilen**: eine je Person, der Gäste-Block nur
  bei geladenen Gästen. So passen 16 Mitglieder ohne Gäste bzw. 12 mit zwei Gästen
  auf eine Seite. Wer Platz für handschriftliche Nachträge braucht, schaltet im
  Export-Reiter **„Leerzeilen in der Anwesenheitsliste"** ein – dann stehen unter
  beiden Tabellen zwei freie Zeilen.

## Erste Schritte

1. Den gesamten Programmordner **mitsamt dem Unterordner `scripts/`** auf das
   BR-Laufwerk legen. Die Sitzungsleitung öffnet `BR-Sitzungsmanager.html`, die
   Schriftführung `BR-Protokoll.html`. Fehlt `scripts/br-zugang.js`, ist die App
   gesperrt; fehlt eines der fünf Code-Module in `scripts/`, startet sie gar nicht.
2. Die App öffnet beim Start den Sperrschirm mit einer einzigen Option: **„Datei laden"**.
   Nach der Wahl der Speicherdatei wird das **Passwort** abgefragt – mit dem
   **Viewer-Passwort** öffnet sich die Nur-Lese-Ansicht, mit dem **Arbeits-Passwort** der
   Bearbeitungsmodus, mit dem **Debug-Mode-Passwort** zusätzlich die Verwaltung.
3. `br-zugang.js` wird mit dem Werkzeug **`br-verschluesselung-generator.html`**
   erzeugt: drei Passwörter eingeben, die Datei herunterladen und nach `scripts/` legen. Dasselbe Werkzeug liefert für die
   **Erstinbetriebnahme** je einen leeren Speicherstand für den Sitzungsmanager und
   für das Protokollmodul – ohne eine solche Datei lässt sich kein Modul öffnen. Passwörter lassen sich später im Admin-Menü
   unter **„Zugang & System"** ändern; danach **„Zugangsdatei (br-zugang.js)
   herunterladen"** und die Datei in den Ordner `scripts` legen – erst dann gilt das neue
   Passwort für alle.
4. Im **Admin-Menü** (nur mit dem Debug-Mode-Passwort) Stammdaten und Personen (BR/SBV/JAV) erfassen.
5. **Sitzung anlegen**, Tagesordnung aufstellen, protokollieren, als PDF
   exportieren.
6. Regelmäßig über **„Sichern (Datei)"** eine verschlüsselte Sicherung auf dem
   BR-Laufwerk ablegen.

## Rollen

| Rolle | Rechte |
|-------|--------|
| **Viewer** (Standard) | Ansehen, Navigieren, Filtern, PDF-/CSV-Export, Sicherung erstellen – **kein** Bearbeiten |
| **Arbeitsmodus** | Sitzungen, Tagesordnung, Protokoll, Beschlüsse, Teilnahme/Gäste, Dokumente, Sicherung öffnen/erstellen |
| **Debug-Mode** | zusätzlich Gremium/Mitglieder, Personen & Rollen, Standard-TOPs, Kategorien, Textbausteine, Tags, Passwörter ändern, zurücksetzen |

Das eingegebene Passwort bestimmt die Rolle. Alle drei Passwörter gelten
**geräteübergreifend**: Der Zugang liegt in `br-zugang.js` und reist zusätzlich mit
der Sicherungsdatei.

**Login beim Öffnen:** Der Sperrschirm kennt genau einen Weg hinein: **„Datei laden"**
– die Speicherdatei (`.brenc.json`) auswählen, danach das Passwort eingeben. Der
Zugang stammt aus der Nachbardatei `br-zugang.js`, die **maßgeblich** ist: Sie
überschreibt einen veralteten, lokal gespeicherten Zugang, sodass die dort
hinterlegten Passwörter zuverlässig funktionieren. Ein **Neuladen der Seite** führt
weder zu Datenverlust noch zu einer neuen Passwortabfrage (der Schlüssel bleibt für
die Dauer des Browser-Tabs im `sessionStorage`); erst **„Datei schließen"** – oder das
Schließen des Tabs – verlangt Datei und Passwort erneut. Ein Rollenwechsel erfolgt
durch Schließen und erneutes Laden mit dem anderen Passwort.

## Betrieb auf dem Netzlaufwerk

Die Anwendung ist client-seitig; die Browser-Ablage liegt **lokal pro Rechner**.
Daher gilt: Das **Programm** (Stammverzeichnis **plus `scripts/`**) liegt auf dem
Laufwerk, die **verschlüsselte Sicherungsdatei** ist die verlässliche, gemeinsame
Ablage. Wichtig: Der Unterordner `scripts/` muss mitkopiert werden – die HTML-Dateien
laden von dort. Fehlt eines der fünf Code-Module, startet die App nicht; fehlt
`scripts/br-zugang.js`, ist sie gesperrt. Fehlen `br-design.css`,
`scripts/pdf-lib.min.js`, `scripts/standard-tops.js`, `scripts/category.js`,
`scripts/protokoll_vorlagen.js`, `scripts/beschluss_vorlagen.js` oder
`scripts/urlaub.js`, läuft die App weiter – es fehlen dann Erscheinungsbild
(Kern-Fallback + Hinweis), PDF-Erzeugung, Standard-TOPs, Kategorien, Textbausteine
bzw. der Urlaubskalender.

Alle Dateien, die die App zum Herunterladen anbietet – `standard-tops.js`,
`category.js`, `protokoll_vorlagen.js`, `beschluss_vorlagen.js`, `urlaub.js`,
`br-zugang.js` und `Gremium` – gehören nach `scripts/`. Sicherungen
(`.brenc.json`) und Übergabedateien (`.brto.json`, `.brerg.json`) **nicht**: Die
liegen dort, wo ihr sie ablegt.

Sitzungsleitung und Schriftführung öffnen **verschiedene Dateien**
(`BR-Sitzungsmanager.html` bzw. `BR-Protokoll.html`), arbeiten aber auf demselben
Datenbestand:

Jedes Modul hat eine **eigene Ablage**: Was die Schriftführung protokolliert, landet
nicht im Bestand der Sitzungsleitung und umgekehrt. Der Austausch läuft bewusst über
Dateien:

- **Datei `Gremium`** (Stammdaten): Alles aus dem Admin-Menü – Stammdaten,
  Personen, Kategorien, Standard-TOPs, Textbausteine, Schlagworte, Urlaubskalender –
  sowie die **Exporteinstellungen** wird im Sitzungsmanager gepflegt und dort über
  **„Gremium-Datei erzeugen"** verschlüsselt abgelegt. Die Datei liegt neben beiden
  HTML-Dateien; das Protokollmodul übernimmt sie beim Öffnen **automatisch** und zeigt
  die Exportschalter dort nur an. Nach jeder Änderung neu erzeugen und ablegen.
- **Gerichtete Übergabe je Sitzung** (der Regelfall im Alltag):

  | Richtung | Knopf | Inhalt |
  |---|---|---|
  | Manager → Protokoll | „Tagesordnung übergeben" | Rahmendaten, vollständige Tagesordnung, **Namen** der Anlagen |
  | Protokoll → Manager | „Ergebnisse übergeben" | Beschlüsse, Aufgaben, Teilnahme |

  Die Gegenseite liest sie mit „… übernehmen" ein. Beide Richtungen **führen zusammen
  statt zu ersetzen**: Eine erneut übergebene Tagesordnung aktualisiert die Punkte und
  rettet bereits Protokolliertes über die Punkt-IDs; vor gestrichenen Punkten, die noch
  Inhalt tragen, warnt der Bestätigungsdialog namentlich. Jedes Modul nimmt nur die
  Gegenrichtung an.
- **Vollständige Sicherung** („Sichern (Datei)" / „Öffnen"): unverändert das Mittel für
  die dauerhafte, gemeinsame Ablage auf dem Laufwerk und für den Wechsel zwischen PCs.
  Sie ersetzt beim Laden den **gesamten** Bestand des jeweiligen Moduls.

Die Seitenleisten-Ansichten **„Beschlüsse", „Aufgaben", „Dokumente" und „Gremium &
Mitglieder" führt nur der Sitzungsmanager.** Im Protokollmodul gibt es sie nicht: Die
Übersichten laufen über die Ergebnis-Übergaben ohnehin dort zusammen, die
Anlagen-Dateien liegen dort, und die Stammdaten kommen fertig aus der Datei `Gremium`.
Aus demselben Grund archiviert das Protokollmodul erzeugte PDFs nicht mehr mit und
nimmt keine Anlagen-Uploads entgegen – solche Dateien kämen dort nie wieder heraus.
Altbestände räumt **`br-anlagen-entfernen.html`** weg.

Gleichzeitiges Bearbeiten *derselben* Sitzung im selben Modul an verschiedenen PCs ist
weiterhin nicht vorgesehen – die zuletzt gesicherte Fassung gewinnt.

### Umstellung eines vorhandenen Bestands

Der bisherige Browser-Stand gehört weiterhin dem **Sitzungsmanager** (sein Ablagename ist
unverändert) – dort ist nichts zu tun. Das Protokollmodul startet leer. Für einen sauberen
Start liefert **`br-sicherung-teilen.html`** aus einer vorhandenen Sicherung die beiden
Startdateien: Sicherung wählen, Passwort eingeben, beide Dateien herunterladen und je
Modul über „Öffnen" laden. Beide enthalten den vollständigen Datenbestand; die
**Anlagen-Dateien selbst** liegen nur in der Sitzungsmanager-Fassung, das Protokollmodul
führt sie als Verweis im Anlagenverzeichnis (PDFs betten Anlagen ohnehin nicht ein).
Passwörter und Revisionsnummer bleiben unverändert gültig.

Hinweis zur Browser-Ablage: Der Browser behandelt alle lokal geöffneten Dateien als einen
Ursprung (`file://`). Auch eine Kopie der App in einem **anderen Ordner** greift deshalb
auf dieselbe Ablage zu. Wer parallel mit getrennten Datenbeständen arbeiten will, braucht
getrennte Browser-Profile.

- **Empfohlenes Modell (Einzelbearbeiter):** Eine verantwortliche Person pflegt
  die Daten und legt nach jeder Sitzung die aktuelle Sicherung auf dem Laufwerk
  ab; andere öffnen diese Datei zum Ansehen/Arbeiten.
- **Schutz vor Datenverlust:** Jede Sicherung erhält eine fortlaufende
  **Revision** und einen Vermerk (Zeitpunkt + Person); die App warnt bei nicht
  gesicherten Änderungen und beim Laden einer **älteren** Datei.
- **Kein** gleichzeitiges Bearbeiten gemeinsamer Daten. Für echten
  Mehrbenutzerbetrieb wäre ein Server nötig; die öffentliche Fassung ist
  bewusst serverlos.

## Sicherheit & Datenschutz

- Alle Daten werden verschlüsselt gespeichert (PBKDF2-SHA256 mit 600 000 Iterationen
  → AES-GCM-256); der
  Hauptschlüssel ist dreifach verpackt – unter dem Viewer-, dem Arbeits- und dem
  Debug-Mode-Passwort – und liegt nur im Arbeitsspeicher (Geheimhaltung nach
  **§ 79 BetrVG**). Die Passwörter werden **nie im Klartext** abgelegt; die
  Zugangsdatei `br-zugang.js` enthält nur Salts und den je Rolle verschlüsselten
  Hauptschlüssel.
- **Rollen sind weiche, client-seitige Schalter:** Wer die Daten ansehen kann,
  kann sie technisch auch entschlüsseln. Arbeits-/Debug-Mode-Passwort steuern, was die
  Oberfläche zum **Bearbeiten** bzw. **Verwalten** freigibt.
- **Bewusste Grenze:** Wer `br-zugang.js` **und** das Programm besitzt, kann mit dem
  Viewer-Passwort mitlesen – der eigentliche Schutz „at rest" ist das **geschützte
  Laufwerk**, auf dem die Dateien liegen. Der Login trennt Ansehen/Bearbeiten/
  Verwalten an der Oberfläche.
- **Passwort verloren = Daten verloren.** Passwörter verbindlich im Gremium
  festlegen und regelmäßig sichern. Die **Default-Kennwörter nach der Einführung
  ändern** und danach die neue `br-zugang.js` verteilen.
- Eine **harte** Rollentrennung wäre erst mit einem Serverbetrieb möglich; hier
  sind die Rollen weiche, client-seitige Schalter.

## Rechtsgrundlagen

§§ 25, 29, 30, 33, 34 BetrVG (Ladung, Sitzung, Video/Telefon, Beschlussfähigkeit
und -fassung, Niederschrift); Geheimhaltung nach § 79 BetrVG.

## Projektdateien

| Datei | Inhalt |
|-------|--------|
| `BR-Sitzungsmanager.html` | Einstieg für die **Sitzungsleitung**: Markup + Skriptliste, setzt `BR_MODUS = 'sitzung'` |
| `BR-Protokoll.html` | Einstieg für die **Schriftführung**: gleiches Markup, setzt `BR_MODUS = 'protokoll'` |
| `scripts/br-kern.js` | Konstanten, Datenmodell, BetrVG-Logik, PDF-Layout-Engine, Dokumentgeneratoren (**zuerst laden**) |
| `scripts/br-app.js` | Zustand, Verschlüsselung/Persistenz, Seitenleiste, Übersichten, Reiter „Sitzung" und „Einladung" (geplante Anwesenheit) |
| `scripts/br-tagesordnung.js` | Reiter „Tagesordnung" und Anlagen-Widget |
| `scripts/br-protokoll.js` | Reiter „Protokoll": Anwesenheit, Verlauf, Beschlüsse, Aufgaben |
| `scripts/br-export.js` | Export (PDF/E-Mail/Präsentation), Admin-Menü, Initialisierung (**zuletzt laden – startet die App**) |
| `br-design.css` | Erscheinungsbild der App (im Stammverzeichnis; ohne sie greift ein einfacher Kern-Fallback) |
| `DESIGN.md` | Das Gestaltungssystem „Leitsystem": Farben, Schrift, Formen, Zustände, Regeln |
| `PRODUCT.md` | Produktwahrheit: Nutzer, Zweck, Betriebsbedingungen, Barrierefreiheit |
| `scripts/pdf-lib.min.js` | PDF-Bibliothek (nötig für PDF-Erzeugung) |
| `scripts/standard-tops.js` | Standard-Tagesordnungspunkte |
| `scripts/category.js` | Kategorien der Tagesordnungspunkte |
| `scripts/protokoll_vorlagen.js` | Textbausteine für die Protokollerstellung |
| `scripts/beschluss_vorlagen.js` | Textbausteine für den Wortlaut von Beschlüssen |
| `scripts/urlaub.js` | Urlaubs-/Abwesenheitskalender, nur lesend. Mit echten Namen personenbezogen und deshalb **nicht** versioniert – als Vorlage dient `urlaub.beispiel.js`, die dazu in `urlaub.js` umbenannt wird. |
| `scripts/Gremium` | Stammdaten, Personen, Kategorien und Textbausteine, verschlüsselt. Wird im Sitzungsmanager erzeugt, vom Protokollmodul automatisch übernommen. Personenbezogen – gehört wie `br-zugang.js` aufs geschützte Laufwerk, **nicht** versioniert. |
| `test-br.js` | Selbsttest ohne Browser: Urlaubs-Logik, Betriebsart, gemeinsamer Skript-Scope (`node test-br.js`) |
| `test-browser.js` | Browser-Integrationstest beider HTML-Dateien und des Umwandlers via Playwright (`node test-browser.js`) |
| `scripts/br-zugang.js` | Verschlüsselte Zugangsdatei mit den Rollen-Passwörtern (maßgeblich) |
| `br-verschluesselung-generator.html` | Werkzeug für die Erstinbetriebnahme: erzeugt `br-zugang.js` sowie die leeren Start-Speicherstände beider Module, alle aus einem Hauptschlüssel |
| `br-sicherung-teilen.html` | Werkzeug zur einmaligen Umstellung: teilt eine vorhandene Sicherung in je eine Startdatei für Sitzungsmanager und Protokollmodul |
| `br-anlagen-entfernen.html` | Werkzeug zum Aufräumen: entfernt gespeicherte Anlagen-Dateien aus einer Sicherung oder aus der Browser-Ablage des Protokollmoduls; die Verweise bleiben erhalten |
| `br-urlaub-melden.html` | Werkzeug für die Mitglieder: eigene Abwesenheiten erfassen und als JSON-Datei an die Sitzungsleitung geben. Ohne Passwort, läuft allein – kann auch einzeln weitergegeben werden |
| `CHANGELOG.md` | Änderungshistorie |

## Entwicklung & Tests

Die App hat **keine Build-Kette und keine Abhängigkeiten** – sie läuft per
Doppelklick. Node und npm werden ausschließlich für die Tests gebraucht; das Repo
enthält deshalb bewusst **keine** `package.json`. Einmalig einrichten:

```
npm i playwright
npx playwright install chromium
```

Danach:

```
node test-br.js        # ohne Browser, wenige Sekunden
node test-browser.js   # headless Chromium
```

`test-br.js` prüft die Urlaubs-Logik (Zeitraumgrenzen, Namensabgleich, ungültige
Einträge), die Betriebsart-Umschaltung und dass die fünf Module sich den globalen
Skript-Scope ohne Namenskollision teilen – Letzteres fällt bei einer Prüfung je
Einzeldatei nicht auf, im Browser wäre es ein Ladefehler.

`test-browser.js` lädt beide HTML-Dateien per `file://` in Chromium und prüft am
echten DOM: fehlerfreies Laden aller Module, Reiter und Exporte je Betriebsart, die
Urlaubs-Vorbelegung im Protokoll, das Einfügen eines Beschluss-Textbausteins, die
Migration alter Sicherungsstände (Klartext-Altformat und `enc-v2` ohne Kategorien),
die getrennten Speicherstände samt Sitzungs-Übergabe, den Umwandler
`br-sicherung-teilen.html` inklusive Passwort- und Fehlerfällen sowie die
Formatgleichheit zwischen App und Werkzeugseiten.

Beide Skripte brauchen keine `br-zugang.js`: Der Sperrschirm bleibt zu,
die Renderfunktionen werden direkt mit einem Testprojekt aufgerufen.

## Status

Umgesetzt: verschlüsselte Persistenz, Login beim Öffnen mit Logout,
Drei-Rollen-Modell (Viewer/Arbeit/Debug-Mode) mit externer, maßgeblicher Zugangsdatei
`br-zugang.js`, Personen (BR/SBV/JAV), Beschluss-Übersicht mit Tags,
Netzlaufwerk-Härtung, Dokumentenmanagement mit Ordnern, Standard-TOPs, Kategorien und
Textbausteine für Protokolle aus Nachbardateien sowie Sitzungs-Archiv. Die
PDF-Bibliothek liegt als `scripts/pdf-lib.min.js`.

## Lizenz

GNU General Public License v3.0 – siehe [LICENSE](LICENSE). Wer den
BR-Sitzungsmanager weitergibt oder verändert weitergibt, muss den Quellcode
unter derselben Lizenz mitliefern. Für den Betrieb im eigenen Gremium gilt
keine Einschränkung: Herunterladen, anpassen und intern nutzen ist frei.
