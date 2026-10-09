# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Die Versionsnummern sind interne Entwicklungs-Meilensteine (noch keine
veröffentlichten Releases).

## [Unreleased]

### Behoben
- **Die Einladungs-Mail lud alle Ersatzmitglieder ein.** Jetzt nur noch die, die für diese
  Sitzung geladen sind: in der geplanten Anwesenheit (Reiter „Einladung“) als anwesend oder
  per Video eingetragen oder bei einem verhinderten Mitglied unter „Vertreten durch“ genannt.
  Ersatzmitglieder mit Status „offen“ bekommen keine Einladung. Für ordentliche Mitglieder
  ändert sich nichts.
- **Unterpunkt-Titel im Standard-TOP-Editor stark eingerückt.** Seit die Unterpunkte dort
  eine Kategorie haben, rutschte die Nummer in die breite Titelspalte; Titel und Kategorie
  standen gequetscht rechts daneben. Die Unterpunkt-Zeile hat jetzt ein eigenes Raster
  (Nummer · Titel · Kategorie · Werkzeuge). Außerdem nimmt der Titel eines Unterpunkts im
  Reiter „Tagesordnung“ jetzt die volle Breite ein, statt nach wenigen Zeichen abzuschneiden.
- **„14:00 Uhr Uhr“ in der Einladungs-Mail.** Beginn und voraussichtliches Ende trugen das
  „Uhr“ doppelt, weil die Zeitformatierung es bereits anhängt.

### Geändert (Admin-Menü)
- **„Gremium & Mitglieder“ heißt jetzt „Admin-Menü“** – mit Zahnrad-Symbol in der
  Seitenleiste. Es bleibt dem Debug-Mode vorbehalten und dem Sitzungsmanager; im
  Arbeitsmodus und im Protokollmodul ist der Knopf ausgeblendet. Das gilt jetzt auch für den
  Knopf auf der Startseite, der bisher allen angeboten wurde und im Arbeitsmodus nur eine
  Fehlermeldung brachte.
- **Reiter statt einer langen Seite.** Die bisher neun untereinander stehenden Abschnitte sind
  auf sieben Reiter verteilt: Gremium · Personen · Tagesordnung (Standard-TOPs und
  Kategorien) · Textbausteine (für Protokolle und Beschlüsse) · Beschluss-Tags · Urlaub ·
  Zugang & System. Es ist immer nur ein Bereich sichtbar; beim erneuten Öffnen geht es beim
  zuletzt gewählten Reiter weiter.
- **Aufgeräumt:** Die Hinweistexte sind gekürzt; der bei jeder Liste wiederholte Absatz zur
  Nachbardatei in „scripts“ steht jetzt einheitlich als eigene Zeile samt „herunterladen“ und
  „Datei laden …“ darunter. **„Alle Daten zurücksetzen“ steht nicht mehr neben „Fertig“**,
  sondern im Gefahrenbereich unter „Zugang & System“. Unten bleiben nur „Gremium-Datei
  erzeugen“ und „Fertig“.

### Hinzugefügt
- **Inhaltsverzeichnis im Reiter „Protokoll“** – wie der Navigationsbereich in Word. Es steht im
  freien Rand zwischen Seitenleiste und Protokoll und scrollt mit: Anwesenheit & Beschluss-
  fähigkeit, alle TOPs mit Stand-Punkt (aktualisiert sich beim Tippen) und ihren Unterpunkten,
  Anlagen. Ein Klick springt an die Stelle, ein zugeklappter TOP klappt dafür auf; der Abschnitt,
  in dem man gerade steht, ist markiert. Ab 1280 px Fensterbreite (ist der Rand schmaler, rückt das Protokoll etwas nach rechts);
  die TOP-Sprungleiste entfällt dann, auf schmaleren Bildschirmen bleibt sie wie bisher.
  Über den Pfeil-Knopf im Kopf klappt das Verzeichnis zu einer schmalen Leiste ein; das Protokoll
  steht dann wieder mittig, und die TOP-Sprungleiste ist zurück. Der Zustand wird im Browser
  gemerkt und bleibt auch nach dem Neuladen erhalten.
- **Die Einladungs-Mail (`.eml`) sieht aus wie die PDF-Einladung.** Bisher war sie reiner
  Text; jetzt ist sie eine HTML-Mail im selben Aufbau: Briefkopf mit Gremium, Firma, Ort und
  Logo, die Doppellinie in der Akzentfarbe, Datumszeile, Titel, Rahmendaten, Tagesordnung mit
  Kategorien, Referent, Dauer, Unterpunkten und Anlagennummern, Hinweise, Gruß,
  Anlagenverzeichnis und die Fußzeile samt Vertraulich-Vermerk. Gebaut nur aus Tabellen und
  Inline-Styles, damit Outlook und andere Mailprogramme sie so darstellen; das Logo hängt als
  eingebettetes Bild an (Content-ID), weil Outlook eingebettete `data:`-Bilder nicht zeigt.
  Die bisherige Textfassung reist als Alternative mit (`multipart/alternative`). Die Datei
  öffnet in Outlook weiterhin als Entwurf.
- **Eigenes Erscheinungsbild je Gremium** (Admin-Menü → neuer Reiter „Erscheinungsbild“):
  - **Akzentfarbe** aus sieben Vorschlägen oder frei wählbar. Dunkle, helle und Rand-Variante
    sowie der Akzent auf der dunklen Seitenleiste werden daraus abgeleitet und so weit
    nachgeführt, dass die Kontrastregel aus DESIGN.md hält (Fläche ≥ 3:1, weiße Schrift auf der
    dunklen Variante ≥ 4,5:1). Zu helle Farben werden sichtbar abgedunkelt. Die Farbe gilt in der
    App, in allen PDFs und in der Präsentation. Die Status-Signale bleiben grün.
  - **Name und Untertitel** der Anwendung für Seitenleiste und Browser-Tab (z. B. „BR Werk Nord“).
  - **Logo in der Seitenleiste**: das Briefkopf-Logo wahlweise auch oben in der Seitenleiste,
    auf weißer Fläche.
  Änderungen sind sofort sichtbar; „Standard-Erscheinungsbild wiederherstellen“ setzt alles
  zurück. Das Erscheinungsbild gehört zu den Stammdaten und reist mit der Datei „Gremium“ ins
  Protokollmodul. Vor dem Öffnen einer Datei (Sperrschirm) gilt das Standard-Erscheinungsbild,
  weil die Stammdaten erst danach entschlüsselt vorliegen.
- **E-Mail-Verteiler des Gremiums** (Admin-Menü → „Gremium“, optional). Ist er hinterlegt,
  lädt die Einladungs-Mail die ordentlichen Mitglieder über den Verteiler statt über ihre
  Einzeladressen ein. Ersatzmitglieder stehen nicht im Verteiler und werden immer über ihre
  eigene Adresse eingeladen; ebenso die als Gast geladene SBV und JAV. Ohne Verteiler bleibt
  alles wie bisher. Der Verteiler gehört zu den Stammdaten und reist mit der Datei „Gremium“.
- **E-Mail-Verteiler der SBV** (Admin-Menü → „Gremium“, optional). Ist er hinterlegt und die
  SBV als Gast der Sitzung geladen, geht die Einladungs-Mail an den SBV-Verteiler statt an die
  Einzeladressen der SBV-Personen. Ohne geladene SBV bleibt er außen vor; ohne Verteiler bleibt
  alles wie bisher. Gehört zu den Stammdaten und reist mit der Datei „Gremium“.
- **„Protokoll fertig“-Mail nutzt die Verteiler.** Wie bei der Einladung gehen die ordentlichen
  Mitglieder über den BR-Verteiler und die geladene SBV über den SBV-Verteiler, sofern
  hinterlegt. Anwesende Ersatzmitglieder bekommen die Mail weiter einzeln.
- **E-Mail-Verteiler der JAV** (Admin-Menü → „Gremium“, optional) – analog zum SBV-Verteiler:
  Ist er hinterlegt und die JAV als Gast der Sitzung geladen, gehen Einladungs- und
  „Protokoll fertig“-Mail an den JAV-Verteiler statt an die Einzeladressen der JAV-Personen.
- **Unterpunkte haben eine eigene Kategorie** – in der Sitzung wie bei den Standard-TOPs.
  Im Reiter „Tagesordnung“ steht unter dem Titel jedes Unterpunkts die Auswahl „Art des
  Unterpunkts“, im Standard-TOP-Editor eine Auswahl neben dem Titel. Ein neu angelegter
  Unterpunkt übernimmt zunächst die Kategorie seines TOP. In `standard-tops.js` trägt ein
  Unterpunkt sie optional als `"kategorie"`; sie bleibt beim Einfügen in eine Sitzung, beim
  Herunterladen und bei der Übernahme aus der Datei erhalten. Einladung (PDF und E-Mail),
  Präsentation, Protokollansicht, Niederschrift und Gast-Auszug zeigen sie unter der
  Überschrift des Unterpunkts an – nur wenn eine gesetzt ist.
- **Mitglieder können von einer einzelnen Abstimmung ausgenommen werden.** Unter jedem
  Beschluss lässt sich aufklappen, welche anwesenden Mitglieder *nicht stimmberechtigt*
  (etwa weil selbst betroffen) oder bei dieser Abstimmung *abwesend* waren. Die Mehrheit
  wird dann aus den Beteiligten berechnet, nicht mehr aus allen Anwesenden – das gilt in
  der Protokollansicht, in der Niederschrift und in der Beschluss-Übersicht. Die
  Niederschrift nennt die nicht Beteiligten namentlich mit Grund. Nimmt weniger als die
  Hälfte des Gremiums an der Abstimmung teil, warnen Protokollansicht, Niederschrift und
  die Prüfung vor dem Export: Für diese Abstimmung ist der Betriebsrat nicht
  beschlussfähig (§ 33 Abs. 2 BetrVG). Die Angabe reist mit dem Beschluss in der
  Ergebnis-Übergabe zum Sitzungsmanager.
- **Anwesenheit nur bei einzelnen TOPs.** Bei „Anwesend“ oder „Video“ lässt sich in der
  Anwesenheitstabelle „nur bei einzelnen TOPs anwesend“ ankreuzen und die TOPs wählen –
  etwa für ein Ersatzmitglied, das für ein befangenes Mitglied nur zu einem TOP nachrückt,
  oder für ein Mitglied, das später kommt. Es zählt dann nur bei den Beschlüssen dieser
  TOPs (Unterpunkte gehören zu ihrem TOP) und steht nur dort zur Auswahl „nicht an der
  Abstimmung beteiligt“. Sinkt dadurch die Stimmbasis unter die Hälfte des Gremiums, warnt
  die App für diese Abstimmung. Niederschrift und Anwesenheitsliste vermerken es beim Namen
  („nur TOP 3“). Die Tabelle ist dieselbe in „Einladung“ und Protokoll, die Angabe lässt
  sich also schon vorab planen und reist mit der Teilnahme zwischen den Modulen.
- **Der tatsächliche Sitzungsbeginn wird im Protokoll erfasst** – neben dem Sitzungsende;
  beide Felder haben einen Knopf „Jetzt“, der die aktuelle Uhrzeit einträgt. Die Niederschrift nennt ihn in „Beginn / Ende“ statt der
  geplanten Uhrzeit und leitet die Sitzung mit „Die Sitzungsleitung eröffnet die Sitzung
  um …“ ein. Er reist wie das Ende mit der Ergebnis-Übergabe zum Sitzungsmanager.
- **Test auf Formatgleichheit zwischen App und Werkzeugseiten** (`pruefeFormatgleichheit`
  in `test-browser.js`). „Sicherung teilen“, „Anlagen entfernen“ und der
  Verschlüsselungsgenerator führen bewusst eigene Kopien des Krypto-Kerns. Die bisherigen
  Tests bauten ihre Sicherungen mit genau diesen Kopien – eine Abweichung von der App wäre
  nicht aufgefallen. Jetzt schreibt und liest die echte App: Ihre Sicherung läuft durch
  beide Werkzeuge und wird danach wieder von der App geöffnet; die Startdatei des Generators
  öffnet die App, und jede der drei Rollen entsperrt dessen Zugang. Außerdem muss
  `PBKDF2_ITER` überall gleich sein – der Wert reist im Zugang mit, eine abweichende
  Konstante fiele beim Laden sonst nicht auf. Der Test braucht keine `br-zugang.js` und
  läuft deshalb auch in einem frischen Klon.

### Geändert
- **Die Kategorie ist optional.** Jede Auswahl beginnt mit „– ohne –“; neue TOPs und
  Unterpunkte starten ohne Kategorie. Bisher setzte die App stillschweigend die erste
  Kategorie – beim Anlegen, beim Laden älterer Standard-TOPs und bei der Übernahme aus
  `standard-tops.js`. Bestehende Zuordnungen bleiben unverändert; eine gelöschte
  Kategorie erscheint in der Auswahl als „– ohne –“.
- **Verpacken und Entpacken einer Sicherung stehen in eigenen Funktionen**
  (`sicherungVerpacken`, `sicherungEntpacken` in `br-app.js`), damit der Test genau den
  Code prüft, den Speichern, Öffnen und „Datei laden“ verwenden. Das Dateiformat bleibt
  unverändert.

### Behoben
- **Veraltete Hinweise zum Ablageort von `br-zugang.js`.** Sperrschirm und die vom
  Generator erzeugte Datei nannten noch den Ordner neben `BR-Sitzungsmanager.html`; seit
  v0.33.0 gehört sie in den Unterordner `scripts`.
- **Reste der entfallenen Datei `key`.** Der Dialog „Zugang & Passwörter“ beschrieb sie
  noch als erforderlich, der Generator sprach von der „Prüfung der Cryptodatei“.

## [0.38.0] – 2026-09-12 – Öffentliche Fassung

### Geändert
- **Die Datei `key` entfällt; `br-zugang.js` ist allein maßgeblich.** Sie hat nie einen
  Anspruch auf Nutzung belegt, sondern allein, dass derselbe Hauptschlüssel vorliegt wie
  in `br-zugang.js` – eine zweite Datei also, die dasselbe nachweist wie die erste. Sie
  kostete einen weiteren Kopierschritt bei der Einrichtung und bot einen weiteren Weg,
  sich auszusperren, ohne die Daten zusätzlich zu schützen. Das leisten allein die
  Passwörter. Entfernt sind damit: das Laden von `scripts/key` in beiden Modulen, die
  beiden Sperren beim Start, der Knopf zum Erzeugen im Debug-Panel und die Erzeugung im
  Generator. **Wer von einer früheren Fassung kommt**, löscht `scripts/key` einfach;
  daran hängen keine Daten, und die Sicherungen bleiben unverändert lesbar.
- **Das Kennfeld in der Seitenleiste trägt keinen festen Firmennamen mehr.** Es zeigt
  jetzt Gremium und Firma aus den Stammdaten – dieselbe Schreibweise, die die
  PDF-Kopfzeilen der Beschluss- und Aufgabenübersicht seit je verwenden. Solange keine
  Datei geladen ist, steht dort schlicht „Betriebsrat“; das gilt auch für den
  Sperrschirm, der vor dem Entschlüsseln keine Stammdaten kennt. Wer seinen
  Gremiumsnamen sehen will, trägt ihn unter „Gremium & Mitglieder“ ein – eine
  Anpassung am Quelltext ist dafür nicht mehr nötig.

### Hinzugefügt
- **Der Verschlüsselungsgenerator liegt bei** (`br-verschluesselung-generator.html`) –
  bisher ein Werkzeug, das ausschließlich auf dem BR-Laufwerk lag. Er ist der einzige
  Weg zu einer lauffähigen Installation: drei Passwörter eingeben, und es entstehen
  `br-zugang.js` und die leeren Start-Speicherstände beider Module, alle aus
  **einem** frisch gewürfelten Hauptschlüssel. Er enthält kein eingebautes Geheimnis;
  jeder Aufruf erzeugt einen eigenen, unabhängigen Schlüssel.
- **Lizenz: GNU General Public License v3.0** (`LICENSE`). Weitergabe – verändert oder
  unverändert – nur mit Quellcode unter derselben Lizenz; der Betrieb im eigenen
  Gremium bleibt frei.

### Behoben
- **Die Prüfung der Erstinbetriebnahme bricht nicht mehr ab, wenn der Generator fehlt.**
  Sie überspringt sich nun wie die Anmeldeprüfung, statt die ganze Browser-Suite mit
  einem Ladefehler zu beenden.

## [0.37.1] – 2026-09-07 – Zeilenumbrüche im Verlauf

### Behoben
- **Zeilenumbrüche im Verlauf gingen verloren.** Ein Absatzumbruch (Enter) legt im Browser eine
  `<div>` je Zeile an; die Filterliste des Verlauf-Editors kannte dieses Element nicht und warf es
  samt Umbruch weg – schon beim Tippen, weshalb der Umbruch weder nach dem Laden noch im PDF
  wieder auftauchte. Betroffen war vor allem das Protokollmodul, in dem der Verlauf geschrieben
  wird. Eingefügte Texte mit verschachtelten Absätzen (etwa aus Word oder Outlook) verschmelzen
  im Export ebenfalls nicht mehr zu einer Zeile. Bereits gespeicherte Verläufe bleiben, wie sie
  sind – der verlorene Umbruch lässt sich nicht nachträglich rekonstruieren.

## [0.37.0] – 2026-09-07 – Eine Tür, ein Schlüssel

### Hinzugefügt
- **Der Verschlüsselungsgenerator erzeugt jetzt auch die leeren Start-Speicherstände** – je einen für
  den Sitzungsmanager und für das Protokollmodul. Da beide Module nur noch über „Datei laden"
  aufgehen, braucht eine frische Installation eine solche Startdatei; sie entsteht aus
  demselben Hauptschlüssel wie `br-zugang.js` und `key`.

### Geändert
- **Der Sperrschirm kennt nur noch eine Option: „Datei laden".** Die Speicherdatei wird
  ausgewählt, danach wird das Passwort abgefragt – es bestimmt weiterhin die Rolle. Das gilt in
  beiden Modulen. Der frühere Direktlogin führte in den lokalen Browserstand, nicht in die
  Datei auf dem Laufwerk; welcher Stand gerade offen war, war damit Auslegungssache.
- **Das Neuladen der Seite kostet weder Daten noch eine neue Passworteingabe.** Der Schlüssel
  bleibt für die Dauer des Browser-Tabs gemerkt; erst „Datei schließen" – oder das Schließen
  des Tabs – verlangt Datei und Passwort erneut. Der Knopf in der Seitenleiste heißt deshalb
  jetzt „Datei schließen" statt „Ausloggen".
- **Sitzungsentwürfe ohne Termin stehen in der Seitenleiste ganz oben**, in einer eigenen
  Gruppe „Ohne Termin". Zuvor sortierten sie sich nach ihrem Anlagedatum in ein Jahr ein und
  verschwanden zwischen den terminierten Sitzungen.
- **Die Anwesenheitsliste ist im Protokoll immer Anlage 1 – benannt, nicht eingebettet.** Wie
  jede andere Anlage steht sie nur im Anlagenverzeichnis; das Verzeichnis führt jetzt auch die
  Anlagen der Tagesordnungspunkte auf. Gedruckt wird die Liste über ihren eigenen Export.

### Entfernt
- **„Neueste Sicherung aus Session-Ordner laden"** und die Passworteingabe auf dem Sperrschirm.
  Die automatische Erkennung der neuesten Datei entfällt mit dem einheitlichen Weg über
  „Datei laden".
- **Die Exportoption „Anwesenheitsliste als Anlage 1 ins Protokoll aufnehmen".** Sie ist
  gegenstandslos, seit die Liste immer im Anlagenverzeichnis steht. Das Datenformat ändert sich
  dadurch nicht; ältere Sicherungen laden unverändert.

## [0.36.1] – 2026-08-17 – Aufgeräumter Quelltext

### Geändert
- **Die Kommentierung im gesamten Quelltext ist auf ein Minimum zusammengestrichen.**
  Geblieben sind die Stellen, an denen eine Entscheidung erklärt werden muss; Kommentare,
  die nur wiederholten, was die Zeile darunter ohnehin sagt, sind entfallen. An der
  Anwendung ändert sich nichts – keine neue Funktion, kein geändertes Verhalten, kein
  geändertes Datenformat.

## [0.36.0] – 2026-08-13 – Gäste und SBV wieder im Reiter „Einladung"

### Hinzugefügt
- **Die Gästeliste steht jetzt auch im Reiter „Einladung"** des Sitzungsmanagers: Arbeitgeber,
  Gewerkschaft, SBV, JAV und Sachverständige lassen sich dort erfassen, inklusive
  „SBV/JAV aus Stammdaten übernehmen" und der TOP-Zuweisung fürs gekürzte Protokoll. Mit der
  Aufteilung in zwei Module war die Liste vollständig zur Schriftführung gewandert – die
  Sitzungsleitung konnte niemanden mehr laden, obwohl gerade sie die Einladung verschickt.
  Es ist dieselbe Liste wie im Reiter „Protokoll", nur früher gepflegt.
- **Die geladene SBV und JAV bekommen die Einladungs-E-Mail mit.** Wer im Reiter „Einladung"
  als Gast vom Typ SBV oder JAV steht und in den Stammdaten eine E-Mail-Adresse hat, steht im
  Empfängerfeld der `.eml`-Datei – dieselbe Regel, nach der die „Protokoll fertig"-Mail schon
  verteilt wurde. Gäste selbst tragen weiterhin keine E-Mail-Adresse.

### Geändert
- **Die Gästeliste reist mit der Tagesordnung ins Protokollmodul.** Dort gilt sie so lange, bis
  die Schriftführung eigene Gäste erfasst – dann schlägt die Dokumentation vor Ort die Planung,
  genau wie bei der Anwesenheit.

## [0.35.0] – 2026-08-11 – Neues Erscheinungsbild: das Leitsystem

### Geändert
- **Die Oberfläche folgt jetzt einer industriellen Signaletik** – der Bildsprache, die die
  Belegschaft aus dem Werk kennt: Kennfeld, Emailleschild, Bodenmarkierung. Drei Regeln tragen
  das Ganze:
  1. **Die Bedeutung liegt zuerst in der Form.** Rechteck = Freigabe, Dreieck = Warnung,
     Kreis = Halt. Die Farbe bestätigt nur. Damit bleibt jede Aussage lesbar, wenn ein
     Dokument schwarzweiß kopiert wird oder jemand Farben schlecht unterscheidet.
  2. **Ein einziges Grundmaß.** Jede Höhe und jeder Abstand ist ein Vielfaches von 4 px.
  3. **Wegfindung ist Lesen.** Zonen tragen ihren Namen offen, statt ihn als Symbol anzudeuten.
- **Die Beschlussfähigkeit steht jetzt im Sitzungskopf**, als Schild mit ausgewiesener Zahl –
  die erste Frage jeder Sitzung wird von der ersten Zeile beantwortet. Die Anwesenheitstafel
  führt darunter die Zusammensetzung in Zahlen, der Sitzungsstand in der Seitenleiste zeigt
  sie während der ganzen Sitzung. Kippt die Beschlussfähigkeit, legt das Schild einmal hart um.
- **Schrift:** Kennfelder, Überschriften und alle Ziffern stehen in **Bahnschrift** (DIN 1451,
  die Schrift der Verkehrs- und Werksbeschilderung, unter Windows vorhanden), Fließtext
  weiterhin in der Systemschrift. Ziffern laufen durchgehend tabellarisch.
- **Die Tagesordnungspunkte hängen an einer Führungslinie**; sobald ein Punkt einen Beschluss
  trägt, führt die Spur in Akzentgrün.
- **Die PDF-Dokumente sprechen dieselbe Sprache**: Briefkopf mit Tintenkante und Bodenmarkierung,
  Überschriften in gesperrten Versalien, Tabellenköpfe in Tinte mit weißer Schrift. Die
  Feststellung der Beschlussfähigkeit und jedes Abstimmungsergebnis erscheinen als **Schild mit
  Sicherheitsform** – im Beweisdokument hängt keine Aussage mehr allein an der Farbe.
- **Die Beamer-Präsentation** setzt die Welt in Projektionsgröße um: Kennziffer im gefüllten
  Feld, gesperrte Versalien, Fortschritt als Bodenmarkierung.
- **Exportliste und Dokumentenordner** sind keine Kachelraster mehr, sondern Listen mit einer
  Zeile je Dokument bzw. Ordner.
- Die Symbole der Oberfläche sind durchgehend gezeichnet (SVG); Unicode-Zeichen und Emoji
  als Symbolersatz sind verschwunden.
- Die verbindliche Akzentfarbe ist **#009057**. Sie trägt Flächen, Formen und Kanten; sobald
  weiße Schrift darauf steht, greift die abgedunkelte Variante **#00673E** (Kontrast 6,9:1).

### Hinzugefügt
- **Sprungmarke für die Tastaturbedienung** in beiden Modulen: „Zur Arbeitsfläche springen"
  überspringt die Seitenleiste. Der getabbte Fokus parkt nicht mehr unter der Reiterleiste.
- `PRODUCT.md` und `DESIGN.md` dokumentieren Produktwahrheit und Gestaltungssystem.

### Hinweis
- Die App bleibt in jeder Hinsicht dieselbe: gleiche Wege, gleiche Reiter, gleiche Dichte.
  Es ändert sich nur, wie sie aussieht – und wie viel davon ohne Farbe funktioniert.

## [0.34.0] – 2026-08-11 – Reiter „Einladung": geplante Anwesenheit zurück im Manager

### Hinzugefügt
- **Neuer Reiter „Einladung"** im Sitzungsmanager (zwischen „Tagesordnung" und „PDF-Export").
  Er führt die **geplante Anwesenheit**: Status je Mitglied, „Vertreten durch" für das geladene
  Ersatzmitglied und eine Vorschau der Beschlussfähigkeit („Voraussichtlich beschlussfähig ·
  5 von 9"). Mit der Aufteilung in zwei Module war die Anwesenheit vollständig zur
  Schriftführung gewandert – die Sitzungsleitung konnte vor der Sitzung nichts mehr festlegen,
  obwohl gerade sie die Ersatzmitglieder lädt und die Anwesenheitsliste ausdruckt.
- Die **Vorbelegung aus dem Urlaubskalender** („Entschuldigt", solange kein Status erfasst ist)
  greift jetzt auch in der Planung – dort, wo die Ladung des Ersatzmitglieds entschieden wird.

### Geändert
- **Die geplante Anwesenheit reist mit der Tagesordnung** zum Protokollmodul, damit die
  Schriftführung nicht bei Null anfängt. Sobald dort **ein** Status erfasst ist, gilt der Stand
  vor Ort: Die Planung überschreibt nie Protokolliertes. Der Rückweg (Ergebnis-Übergabe)
  bleibt unverändert.
- Anwesenheitstabelle und Beschlussfähigkeits-Anzeige liegen jetzt einmal in `br-app.js` und
  werden von beiden Reitern genutzt (vorher nur in `br-protokoll.js`).

### Behoben
- **Im exportierten Protokoll stand stellenweise wörtlich „&nbsp;".** Ein Verlaufstext ohne
  umgebendes Absatz-Tag – wie ihn der Editor bei einzeiligen Eingaben hinterlässt – galt beim
  nächsten Öffnen als Klartext und wurde erneut maskiert. Verläufe mit HTML-Entities werden
  jetzt als HTML erkannt; bereits doppelt maskierte Bestände heilen sich beim nächsten Öffnen
  der Sicherung selbst.
- Im Protokoll-PDF heißt es bei entschuldigt fehlenden Mitgliedern jetzt
  **„(vertreten wegen …)"** statt „(vertreten durch …)".

## [0.33.1] – 2026-08-06 – Spalte „Abw. Anwesenheit" wieder da

### Behoben
- **Die Spalte „Abw. Anwesenheit" fehlte auf der Anwesenheitsliste**, sobald beim Druck noch
  niemand als Video-/Telefonteilnahme erfasst war – also im Regelfall, denn die Liste wird **vor**
  der Sitzung ausgedruckt und dort von Hand ausgefüllt. Die mit v0.31.0 eingeführte Regel „Spalte
  nur zeigen, wenn gefüllt" hat damit genau das Feld entfernt, für das das Formular gedacht ist.
  Die Spalte steht jetzt wieder immer – bei Mitgliedern wie bei Gästen, die ebenfalls per Video
  oder Telefon teilnehmen können.

### Hinweis
- Die Liste bleibt einseitig: Was sie kurz hält, sind die **Zeilen**, nicht die Spalten. Gemessen
  passen unverändert 16 Mitglieder ohne Gäste bzw. 12 mit zwei Gästen auf eine Seite. Leerzeilen
  für Nachträge sind weiterhin über den Export-Reiter zuschaltbar, der Gäste-Block entfällt
  weiterhin ohne geladene Gäste.

## [0.33.0] – 2026-08-06 – Skripte im Unterordner `scripts/`

### Geändert
- **Alles per `<script src>` Geladene liegt jetzt im Unterordner `scripts/`.** Im
  Stammverzeichnis bleiben nur die HTML-Dateien, `br-design.css` und die Dokumentation.
  Betroffen sind die fünf Code-Module, `pdf-lib.min.js`, die anpassbaren Nachbardateien
  (`standard-tops.js`, `category.js`, `protokoll_vorlagen.js`, `beschluss_vorlagen.js`,
  `urlaub.js`) sowie `br-zugang.js`, `key` und `Gremium`. Die beiden letzteren haben zwar keine
  `.js`-Endung, werden aber genauso geladen und gehören fachlich zu `br-zugang.js` – sie deshalb
  im Stammverzeichnis zu lassen, hätte zusammengehörige Dateien getrennt.
- Alle Hinweistexte in der App sagen jetzt „in den Unterordner `scripts` legen" statt „neben der
  HTML ablegen" – auch in den Kopfkommentaren der Dateien, die die App zum Herunterladen anbietet.

### Hinweis
- **Beim Aktualisieren den Unterordner mitkopieren.** Wer nur die HTML-Dateien austauscht, bekommt
  eine App, die nicht startet. Die eigenen Dateien `br-zugang.js`, `key`, `Gremium` und ggf.
  `urlaub.js` aus der bisherigen Installation nach `scripts/` verschieben.
- Sicherungen (`.brenc.json`) und Übergabedateien (`.brto.json`, `.brerg.json`) sind **nicht**
  betroffen – die liegen weiterhin dort, wo sie abgelegt werden.
- Die Tests bleiben im Stammverzeichnis (`node test-br.js`, `node test-browser.js`).

## [0.32.0] – 2026-08-06 – Exporteinstellungen gelten fürs ganze Gremium

### Geändert
- **Die drei Exporteinstellungen wandern über die Datei `Gremium`** und werden damit nur noch
  einmal gesetzt – im Sitzungsmanager. Betroffen sind „Anwesenheitsliste als Anlage 1 ins
  Protokoll aufnehmen", „Vertraulichkeitsvermerk in der Fußzeile" und „Leerzeilen in der
  Anwesenheitsliste". Es sind Konventionen des Gremiums, keine Vorlieben des einzelnen Moduls:
  Die Niederschrift soll nicht anders aussehen, je nachdem wer sie exportiert.
- **Im Protokollmodul sind die drei Schalter nur noch sichtbar, nicht bedienbar**, mit Verweis auf
  den Sitzungsmanager. Bisher ließen sie sich dort verstellen – „Vertraulichkeitsvermerk" wurde
  beim nächsten Start ohnehin überschrieben, weil er in den Stammdaten liegt, die schon immer aus
  der Datei `Gremium` kommen. Diese stille Inkonsistenz ist damit weg.

### Hinweis
- Nach dem Ändern einer Exporteinstellung im Sitzungsmanager die Datei `Gremium` neu erzeugen und
  ablegen – wie bei allen Angaben aus „Gremium & Mitglieder".

## [0.31.1] – 2026-08-06 – Leerzeilen als Export-Option

### Neu
- **„Leerzeilen in der Anwesenheitsliste für handschriftliche Nachträge"** als Schalter im
  Export-Reiter. Voreingestellt **aus** – die Liste bleibt damit einseitig. Eingeschaltet stehen
  wie früher unter beiden Tabellen zwei freie Zeilen, und der Gäste-Block erscheint auch dann,
  wenn noch keine Gäste erfasst sind; für den unangemeldeten Gast ist er dann genau da.
  Der Schalter wirkt auf den Einzelexport wie auf die Anlage 1 der Niederschrift.

### Hinweis
- Die Option gehört zu den Exporteinstellungen und wird je Modul gesetzt – wie „Anwesenheitsliste
  als Anlage 1" auch. Wer die Liste im Sitzungsmanager und im Protokollmodul gleich haben möchte,
  setzt den Schalter in beiden.

## [0.31.0] – 2026-08-06 – Anwesenheitsliste ohne Leerzeilen

### Geändert
- **Die Anwesenheitsliste enthält nur noch, was auch gefüllt ist.** Bisher hängte sie an beide
  Tabellen je zwei Leerzeilen für Nachträge an und führte die Spalte „Abw. Anwesenheit" immer mit,
  obwohl sie meist – bei Gästen sogar grundsätzlich – leer blieb. Dadurch lief die Liste eines
  neunköpfigen Gremiums auf zwei Seiten. Jetzt gilt:
  - keine Leerzeilen mehr,
  - die Spalte „Abw. Anwesenheit" erscheint nur, wenn tatsächlich jemand per Video oder Telefon
    teilnimmt; die frei werdende Breite geht an die Unterschriftenspalte,
  - der Gäste-Block entfällt vollständig (samt Überschrift), wenn keine Gäste geladen sind.

  Gemessen passen damit **16 Mitglieder ohne Gäste** bzw. **12 Mitglieder mit zwei Gästen** auf
  eine Seite; die Zeilenhöhe zum Unterschreiben bleibt unverändert. Die Werte sind als Test
  festgehalten, damit künftige Zusätze die Liste nicht unbemerkt wieder auf zwei Seiten schieben.

### Entfernt
- Die überholten Tags und Vorabversionen **Alpha** und **Alpha-2** aus der Frühphase. Die
  zugehörigen Commits bleiben in der Historie; die dort angehängten Zip-Dateien sind entfallen.

## [0.30.0] – 2026-08-06 – Urlaubsmeldung durch die Mitglieder, Kalenderansicht

### Neu
- **Werkzeug `br-urlaub-melden.html` für die Mitglieder.** Eine eigenständige Seite **ohne
  Passwort**: Name eintragen, Zeiträume erfassen, „Meldung speichern" – heraus kommt eine kleine
  JSON-Datei (`Urlaub_Vorname-Nachname_JJJJ-MM-TT.json`), die an die Sitzungsleitung geht. Eine
  frühere Meldung lässt sich wieder öffnen, anpassen und neu speichern. Der Name wird im Browser
  gemerkt, Zeiträume zeigen die Tagesanzahl, ein Bis vor dem Von wird angezeigt statt kommentarlos
  verworfen, und eine Meldung **ohne** Zeitraum ist die gültige Aussage „ich bin nicht abwesend".
- **„Meldungen einlesen …" im Sitzungsmanager** (Debug-Panel → Urlaubskalender). Mehrere Dateien
  auf einmal möglich. Eine Meldung ist für ihre Person maßgeblich: Deren bisherige Zeiträume
  werden ersetzt, die aller anderen bleiben unangetastet. Vor der Übernahme nennt die Rückfrage
  die betroffenen Personen; nicht lesbare Dateien werden einzeln benannt statt den ganzen Vorgang
  abzubrechen.
- **Kalenderansicht „Urlaub"** in der Seitenleiste des Sitzungsmanagers. Monatsraster mit
  Wochenbeginn Montag, in dem **Abwesenheiten und Sitzungstermine im selben Blick** liegen –
  Terminkollisionen sieht man, ohne sie zu suchen. Monatsweise blätterbar, „Heute" springt zurück,
  darunter eine Liste der kommenden Abwesenheiten mit Tagesanzahl. Für alle Rollen sichtbar,
  nicht nur im Debug-Mode; das Protokollmodul führt sie nicht.

### Geändert
- **Ein TOP mit Unterpunkten gilt als protokolliert, sobald zu einem seiner Unterpunkte etwas
  erfasst ist.** Wer eine gegliederte Sitzung ausschließlich auf Unterpunkt-Ebene mitschreibt –
  der Regelfall –, kam bisher nie auf 100 %, obwohl nichts fehlte: Der übergeordnete TOP zählte
  als eigene, unerfüllte Einheit. Ein eigener Verlauf am TOP bleibt möglich, ist aber keine
  Voraussetzung mehr. Umgekehrt macht ein Verlauf am TOP seine Unterpunkte **nicht** erledigt –
  die bleiben als Lücke sichtbar. Betrifft die Fortschrittsanzeige im Sitzungsstand und die
  Punkte in der Sprungleiste.

### Hinweis
- Die Meldedatei ist **nicht verschlüsselt** – sie enthält nur Name und Zeiträume der meldenden
  Person, und jede Hürde würde dazu führen, dass niemand meldet. Die App verlässt sich nicht
  darauf: Alles läuft beim Einlesen durch dieselbe Prüfung wie die übrigen Quellen.
- Der Abgleich zu den Stammdaten läuft weiterhin über den **Namen**. Das Werkzeug weist die
  Mitglieder darauf hin, ihn genau wie in der Mitgliederliste zu schreiben; nicht zuordenbare
  Namen meldet der Sitzungsmanager wie bisher.

## [0.29.0] – 2026-08-05 – Urlaubskalender in der App, Sitzungsstand im Protokollmodul

### Neu
- **Der Urlaubskalender wird in der App gepflegt.** Im Sitzungsmanager unter „Gremium & Mitglieder"
  → „Urlaubskalender" lassen sich Abwesenheiten erfassen: Name mit Vorschlagsliste aus den
  Stammdaten, Von und Bis als Datumsfelder, Grund als Freitext. Ein zu früh liegendes Bis zieht
  mit dem Von mit; unvollständige Zeilen werden markiert statt stillschweigend verworfen.
  „Vergangene aufräumen" entfernt abgelaufene Zeiträume auf einen Klick. Die Liste liegt in
  `daten.urlaub`, wird mitgesichert und wandert über die Datei `Gremium` zum Protokollmodul.
  `urlaub.js` bleibt als zentrale Vorgabe möglich und hat beim Öffnen weiterhin Vorrang; die
  Datei lässt sich aus der App heraus erzeugen und wieder einlesen.
- **Sitzungsstand im Protokollmodul.** An der Stelle der dort entfallenen Navigation steht jetzt,
  was die Schriftführung beim Mitschreiben dauerhaft im Blick braucht und bisher im Hauptbereich
  wegscrollte: Beschlussfähigkeit als Ampel mit Zahlen, wie viele Punkte schon protokolliert sind
  (mit Fortschrittsleiste), die Zahl der Beschlüsse, Aufgaben und Gäste – und ein deutlicher
  Hinweis, solange eine **Sitzungspause läuft**. Der Block aktualisiert sich bei jeder Eingabe.
- **Die Sprungleiste zeigt den Stand je Punkt.** Im Protokoll-Reiter trägt jeder TOP-Chip einen
  Punkt: leer, angefangen oder protokolliert. Die Lücken sind damit auf einen Blick sichtbar.

### Behoben
- **Die Übergabe-Knöpfe in der Seitenleiste überlappten sich.** Seit den längeren Beschriftungen
  („Tagesordnung übergeben", „Ergebnisse übernehmen") passten sie nicht mehr nebeneinander; sie
  stehen jetzt untereinander.
- **Die Sitzungsliste lief aus der Seitenleiste heraus**, statt zu scrollen (fehlendes
  `min-height:0` im Flex-Layout). Bei vielen Sitzungen war die Fußzeile überdeckt.

### Hinweis
- Farbschema und Schrift sind unverändert; der Sitzungsstand nutzt ausschließlich die vorhandenen
  Farbvariablen. Das Pause-Symbol ist dem bestehenden Inline-SVG-Sprite hinzugefügt – eine eigene
  `.svg`-Datei wäre eine weitere Datei, die aufs Laufwerk kopiert werden müsste.

## [0.28.0] – 2026-08-05 – Protokollmodul aufgeräumt

### Geändert
- **Das Protokollmodul führt kein Debug-Panel mehr.** Gremium, Personen, Kategorien, Standard-TOPs
  und Textbausteine kommen fertig aus der Nachbardatei `Gremium`; der Eintrag „Gremium &
  Mitglieder" wäre dort nur eine Fehlerquelle gewesen, weil Änderungen beim nächsten Start
  überschrieben werden. Gepflegt wird ausschließlich im Sitzungsmanager.
- **Das Protokollmodul führt keine Dokumenten-Ansicht mehr.** Die Anlagen-Dateien liegen beim
  Sitzungsmanager; das Protokoll kennt nur die Verweise für das Anlagenverzeichnis. Das
  Anlagen-Widget ist dort entsprechend nur noch lesend, und der Knopf „Dokumente dieser Sitzung
  öffnen" im Export-Reiter entfällt.

### Behoben
- **Im Protokollmodul wuchs die Ablage unbemerkt.** Jeder PDF-Export archiviert das erzeugte
  Dokument automatisch mit – im Protokollmodul landeten diese Dateien damit in einer Ablage, die
  niemand ansehen konnte und deren Inhalt auch nicht mit den Ergebnissen zurückwandert. Die
  Auto-Archivierung und der Anlagen-Upload sind dort jetzt abgeschaltet (ein Riegel in
  `dokumentAnlegen`, der beide Aufrufer abdeckt).

### Neu
- **Werkzeug `br-anlagen-entfernen.html`** für die Altbestände, die so entstanden sind. Zwei Wege:
  1. **Aus einer Sicherungsdatei:** Datei und Passwort angeben, bereinigte Kopie herunterladen.
     Passwörter und Revisionsnummer bleiben gültig, die Verweise bleiben vollständig erhalten.
  2. **Aus der Browser-Ablage:** zeigt Anzahl und Umfang der gespeicherten Anlagen-Dateien je
     Modul und leert die Protokoll-Ablage auf Nachfrage. Sitzungen, Protokolle und Stammdaten
     bleiben unangetastet; der Inhalt der Blobs wird nie entschlüsselt.

## [0.27.0] – 2026-08-05 – Klare Arbeitsteilung: gerichtete Übergabe und Nachbardatei „Gremium"

### Neu
- **Nachbardatei `Gremium`.** Alle Angaben aus „Gremium & Mitglieder" – Stammdaten, Personen,
  Standard-TOPs, Kategorien, Textbausteine und Beschluss-Schlagworte – werden im
  **Sitzungsmanager** gepflegt und dort über „Gremium-Datei erzeugen" verschlüsselt in die Datei
  `Gremium` geschrieben. Sie liegt neben beiden HTML-Dateien; das **Protokollmodul übernimmt sie
  beim Öffnen automatisch** und braucht keine eigene Pflege mehr. Verschlüsselt unter dem
  Hauptschlüssel der Installation, also nur mit der zugehörigen `br-zugang.js`/`key` lesbar; eine
  Datei aus einer fremden Installation wird erkannt und übersprungen. Fehlt sie, arbeitet jedes
  Modul wie bisher mit seinem eigenen Stand.

- **Unterpunkte in den Standard-Tagesordnungspunkten.** Je Standard-TOP lassen sich im Debug-Panel
  Unterpunkte hinterlegen (anlegen, umsortieren, löschen); sie werden beim Anlegen jeder neuen
  Sitzung als vollwertige Unterpunkte 1.1, 1.2 … mit erzeugt – jeweils mit eigenen IDs, damit
  Beschlüsse und Aufgaben sitzungsbezogen bleiben. In `standard-tops.js` steht dafür je Punkt ein
  optionales Feld `"unterpunkte"`, wahlweise ausführlich (`[{ "titel": "…" }]`) oder als Kurzform
  (`["Erster", "Zweiter"]`).

### Geändert
- **Die Übergabe zwischen den Modulen ist jetzt gerichtet** und trägt nur noch, was die Gegenseite
  wirklich braucht:
  - **Sitzungsmanager → Protokoll** („Tagesordnung übergeben", `.brto.json`): Rahmendaten der
    Sitzung, die vollständige Tagesordnung inkl. Erläuterungen, Referent, Dauer und Unterpunkten
    sowie die **Namen der Anlagen** für das Anlagenverzeichnis – ohne die Dateien selbst und ohne
    Protokollinhalte.
  - **Protokoll → Sitzungsmanager** („Ergebnisse übergeben", `.brerg.json`): **Beschlüsse und
    Aufgaben** je Punkt, dazu die **Teilnahme**. Letztere muss mitreisen, weil die
    Beschluss-Übersicht das Ergebnis über die Zahl der Teilnehmenden auswertet – ohne sie stünde
    dort bei automatisch ausgewerteten Beschlüssen das Falsche.

  Beide Richtungen führen **zusammen statt zu ersetzen**: Eine erneut übergebene Tagesordnung
  aktualisiert die Punkte und rettet bereits Protokolliertes über die Punkt-IDs; vor Punkten, die
  gestrichen wurden und noch Inhalt tragen, warnt der Bestätigungsdialog namentlich. Jedes Modul
  nimmt nur die Gegenrichtung an und weist die eigene Ausgaberichtung mit Hinweis ab.
- **Die gremiumsweiten Übersichten „Beschlüsse" und „Aufgaben" führt nur noch der
  Sitzungsmanager.** Das Protokollmodul arbeitet auf einer Sitzung und gibt seine Ergebnisse
  dorthin zurück; es hätte ohnehin nur die selbst protokollierten Sitzungen im Bestand.
- Stammdaten und Personen reisen **nicht mehr** in den Übergabedateien mit – dafür ist jetzt die
  Datei `Gremium` zuständig.

### Behoben
- **Eine Übergabedatei ließ sich über „Öffnen" als vollständige Sicherung laden** und hätte den
  gesamten Bestand durch eine einzelne Sitzung ersetzt: Die Weiche in `projektDateiOeffnen` kannte
  nur das alte Format `sitzung-v1`, sodass die neuen Formate als unverschlüsseltes Altformat
  durchliefen. Alle Übergabeformate werden jetzt erkannt und mit Hinweis abgewiesen.

### Hinweis
- `Gremium` enthält personenbezogene Daten (wenn auch verschlüsselt) und gehört wie `br-zugang.js`
  und `key` ausschließlich auf das geschützte BR-Laufwerk.
- Nach jeder Änderung in „Gremium & Mitglieder" die Datei `Gremium` neu erzeugen und ablegen –
  sonst arbeitet das Protokollmodul weiter mit dem alten Stand.

## [0.26.0] – 2026-08-05 – Getrennte Dateien für Sitzungsleitung und Schriftführung, Beschlusstexte, Urlaubskalender

### Neu
- **Zwei eigenständige Anwendungsdateien mit getrennten Speicherständen.** Die Sitzungsleitung
  arbeitet in `BR-Sitzungsmanager.html` (Rahmendaten, Tagesordnung, Einladung, Präsentation), die
  Schriftführung in der neuen `BR-Protokoll.html` (Tagesordnung, Anwesenheit, Verlauf, Beschlüsse,
  Aufgaben, Protokoll-PDF). Beide laden denselben Code, arbeiten aber auf **eigenen** Ablagen
  (getrennter IndexedDB-Name je Betriebsart) – sie können sich also nicht mehr gegenseitig
  überschreiben. Die HTML-Datei setzt dazu lediglich `window.BR_MODUS`.
- **Sitzungs-Übergabedatei (`.brsitz.json`).** Über „Sitzung übergeben" gibt ein Modul genau eine
  Sitzung als eigenständige, verschlüsselte Datei aus; die Gegenseite liest sie mit „Sitzung
  übernehmen" ein. Mitgegeben werden die Sitzung mit Tagesordnung und Anlagen sowie Stammdaten,
  Personen und Kategorien – ohne sie gäbe es drüben weder Briefkopf noch Anwesenheitsliste.
  Anders als beim Laden einer Sicherung wird **nur diese eine Sitzung** eingefügt bzw. ersetzt,
  der übrige Bestand bleibt stehen; Beschluss-Schlagworte werden zusammengeführt statt ersetzt.
  Das Format ist von der vollständigen Sicherung unterscheidbar – wer die Dateien verwechselt,
  bekommt einen Hinweis statt eines überschriebenen Bestands.
- **Die Tagesordnung führen beide Module.** Die Sitzungsleitung stellt sie auf, die Schriftführung
  kann in der Sitzung beschlossene Ergänzungen direkt nachtragen.
- **Werkzeug `br-sicherung-teilen.html`.** Erzeugt aus einer vorhandenen Sicherung die beiden
  Startdateien für die getrennten Speicherstände. Beide enthalten den vollständigen Datenbestand;
  die **Anlagen-Dateien selbst** wandern nur in die Sitzungsmanager-Fassung, das Protokollmodul
  erhält die Verweise (Name, Nummer, Kategorie) für das Anlagenverzeichnis. Passwörter und
  Revisionsnummer bleiben unverändert gültig, weil der Zugangsblock mitgereicht wird. Unterstützt
  `enc-v2`, das Altformat `enc-v1` und unverschlüsselte Altstände.
- **Textbausteine für Beschlüsse.** Analog zu den Protokoll-Bausteinen lässt sich der Wortlaut
  eines Beschlusses jetzt über „+ Textblock einfügen" aus einer eigenen Liste befüllen
  (ausgeliefert werden zehn Formulierungen zu §§ 37, 80, 87, 99 und 102 BetrVG). Gepflegt wird sie
  im Debug-Panel unter „Beschlusstexte" oder zentral über die neue Nachbardatei
  `beschluss_vorlagen.js`, die – wie `protokoll_vorlagen.js` – Vorrang vor der gespeicherten Liste
  hat.
- **Urlaubs- und Abwesenheitskalender.** Die neue Nachbardatei `urlaub.js` enthält Abwesenheiten
  (Name, Zeitraum, Grund). Im Reiter „Sitzung" warnt die App beim gewählten Datum, wer fehlt und
  wie viele Betriebsratsmitglieder betroffen sind; im Protokoll werden diese Mitglieder als
  „Entschuldigt" vorbelegt, solange noch kein Teilnahmestatus erfasst ist. Das Debug-Panel zeigt
  unter „Urlaub" alle Zeiträume und meldet Namen, die zu keiner Person aus den Stammdaten passen.

### Geändert
- **Der Anwendungscode liegt in fünf externen Dateien** statt in einem `<script>`-Block in der
  HTML: `br-kern.js` (Datenmodell, PDF-Engine, Dokumentgeneratoren), `br-app.js` (Zustand,
  Verschlüsselung/Persistenz, Seitenleiste, Übersichten, Reiter „Sitzung"), `br-tagesordnung.js`,
  `br-protokoll.js` und `br-export.js` (Export, Debug-Panel, Initialisierung). Die Reihenfolge der
  `<script src>`-Zeilen ist bindend: `br-kern.js` zuerst, `br-export.js` zuletzt. **Alle Dateien
  müssen mit auf das Laufwerk kopiert werden.**

### Behoben
- **Eigene TOP-Kategorien gingen beim Wiederherstellen einer Sicherung verloren.** `daten.kategorien`
  fehlte im Inhalt der Sicherungsdatei, obwohl die Kategorien im Browser gespeichert wurden; nach
  dem Öffnen einer Sicherung auf einem anderen PC fielen die Tagesordnungspunkte auf die
  Auslieferungs-Kategorien zurück. Kategorien und Beschluss-Bausteine reisen jetzt mit.

### Kompatibilität
- **Vorhandene Sicherungen und Browser-Stände laufen unverändert weiter.** Das Datenmodell und
  das Sicherungsformat (`enc-v2`) sind unverändert; die neuen Beschluss-Bausteine werden beim
  Laden über die bestehende Migration (`migriere`) mit der Auslieferungsliste ergänzt. Geprüft
  wurden Klartext-Altstände (noch mit `mitglieder[]` statt `personen[]` und Klartext-Verlauf),
  Sicherungen aus 0.19–0.25 sowie eine Browser-Ablage ohne den neuen Meta-Satz.
- **Der bestehende Browser-Stand bleibt beim Sitzungsmanager.** Sein Ablagename ist unverändert;
  wer bisher die Einzeldatei genutzt hat, findet alles unverändert vor. Das Protokollmodul startet
  leer und wird über `br-sicherung-teilen.html` oder eine Sitzungsübergabe befüllt.
- **Das Sicherungsformat ist unverändert** (`enc-v2`). Eine alte Sicherung lässt sich weiterhin in
  beiden Modulen über „Öffnen" laden; der Umwandler ist eine Bequemlichkeit, keine Voraussetzung.
- `urlaub.js` wird ausschließlich gelesen und verändert weder das Datenmodell noch die Sicherung.

### Tests
- Einrichtung einmalig mit `npm i playwright && npx playwright install chromium`; das Repo bleibt
  bewusst ohne `package.json`, weil die App selbst keine Abhängigkeiten hat (siehe README,
  Abschnitt „Entwicklung & Tests").
- `node test-br.js` prüft Urlaubs-Logik (Zeitraumgrenzen, Namensabgleich, ungültige Einträge) und
  Betriebsart-Umschaltung sowie, dass die fünf Module sich den globalen Scope ohne
  Namenskollision teilen.
- `node test-browser.js` lädt beide HTML-Dateien per `file://` in Chromium (Playwright) und prüft
  fehlerfreies Laden, Reiter/Exporte je Betriebsart, die Urlaubs-Vorbelegung, das Einfügen eines
  Beschluss-Textbausteins sowie die Migration alter Sicherungsstände am echten DOM.

### Hinweis
- Die Trennung ist eine **Aufgaben-, keine Rechtetrennung**: Wer beide Dateien öffnet, kann beides
  bearbeiten. Die Zugangsrollen (Viewer / Arbeit / Debug-Mode) aus `br-zugang.js` gelten
  unverändert in beiden Dateien. Gleichzeitiges Bearbeiten *derselben* Sitzung an verschiedenen
  PCs bleibt nicht vorgesehen – die zuletzt gesicherte Fassung gewinnt.
- `urlaub.js` enthält mit echten Einträgen personenbezogene Daten und gehört damit ausschließlich
  auf das geschützte BR-Laufwerk.

## [0.25.0] – 2026-07-24 – Login: neueste Sicherung aus dem Session-Ordner laden

### Neu
- **Login-Knopf „Neueste Sicherung aus Session-Ordner laden".** Beim Anmelden kann statt einer
  einzelnen Datei ein ganzer Ordner (üblicherweise „Session") gewählt werden. Die App sucht daraus
  selbstständig die neueste Sicherung heraus und öffnet sie – das manuelle Heraussuchen der
  richtigen `.brenc.json` entfällt. Die neueste Datei wird primär anhand der Revisionsnummer im
  Dateinamen (`…_Rev0007_…`) bestimmt, ersatzweise über den Zeitstempel im Namen und zuletzt über
  das Änderungsdatum der Datei. Anschließend läuft der bewährte Anmelde-/Entschlüsselungsweg
  (Passwortabfrage, lokale `br-zugang.js`/`key` bleiben maßgeblich).

### Kompatibilität
- **Ältere Speicherstände werden berücksichtigt.** Aus dem Ordner wird die neueste *anmeldefähige*
  Sicherung gewählt (Format `enc-v2` mit Zugang). Ältere Formate ohne Zugang (`enc-v1`, Klartext)
  sowie beschädigte Dateien werden übersprungen statt abgelehnt; das interne Datenmodell einer
  geladenen Sicherung durchläuft weiterhin unverändert die bestehende Migration (`migriere`).

### Hinweis
- Da die Anwendung per Doppelklick (`file://`) geöffnet wird, kann der Browser den Ordner aus
  Sicherheitsgründen nicht dauerhaft merken; er wird deshalb pro Anmeldung einmal ausgewählt.
  (Ein Betrieb über eine Web-Adresse in Chrome/Edge würde das dauerhafte Merken ermöglichen.)

## [0.24.1] – 2026-07-23 – Erläuterungstexte in der Beamer-Präsentation

### Geändert
- **Die TOP-Folien der Präsentation zeigen jetzt die Erläuterung / Beschlussvorlage.** Der im
  Tagesordnungs-Editor gepflegte Text („Erläuterung / Beschlussvorlage für die Einladung")
  erscheint auf der jeweiligen TOP-Folie unter dem Titel; Erläuterungen von Unterpunkten stehen
  unter dem jeweiligen Unterpunkt. Zeilenumbrüche bleiben erhalten, die Auto-Skalierung passt
  die Foliengröße bei längeren Texten automatisch an. Die Übersichtsfolie bleibt kompakt.

## [0.24.0] – 2026-07-22 – Tagesordnung als Beamer-Präsentation

### Neu
- **Export „Tagesordnung als Präsentation".** Neuer Button im Export-Tab erzeugt eine
  eigenständige HTML-Vollbild-Slideshow und öffnet sie in einem neuen Tab (Fallback: Datei-
  Download, falls das Popup blockiert wird). Die erste Folie zeigt die gesamte Tagesordnung
  (für die Feststellung), danach folgt je Tagesordnungspunkt eine Folie mit Titel, Unterpunkten
  und Meta (Kategorie · Referent/in · Dauer). Sehr große, auf die Beamer-Auflösung
  auto-skalierende Schrift; Navigation per Pfeiltasten/Klick, Vollbild (F) und umschaltbarem
  Hell/Dunkel-Design (D). Logo und Markenfarben werden übernommen; keine externen Abhängigkeiten.

## [0.23.0] – 2026-07-22 – Gäste-Zuweisung auch für Unterpunkte

### Geändert
- **Die TOP-Zuweisung je Gast erfasst jetzt auch einzelne Unterpunkte.** Im Auswahl-Panel
  stehen unter jedem TOP dessen Unterpunkte; ein angehakter TOP schließt weiterhin alle seine
  Unterpunkte ein (die Unterpunkt-Häkchen werden dann gesperrt). Im gekürzten Protokoll erscheint
  bei einzeln zugewiesenen Unterpunkten nur der Unterpunkt-Inhalt unter der TOP-Überschrift –
  der direkt am TOP hängende Verlauf/Beschluss bleibt weg.

## [0.22.0] – 2026-07-22 – Gäste-TOP-Zuweisung & gekürztes Protokoll

### Neu
- **Gästen lassen sich einzelne Tagesordnungspunkte zuweisen.** In der Gästeliste (Reiter
  „Protokoll") öffnet der Button „TOPs" je Gast eine Checkbox-Liste aller TOPs. Ohne Auswahl
  nimmt der Gast wie bisher an der gesamten Sitzung teil.
- **Export „Gekürztes Protokoll (Gast)".** Neue Export-Karte, die für einen Gast mit TOP-Zuweisung
  einen Protokollauszug erzeugt – ausschließlich mit den Tagesordnungspunkten, an denen der Gast
  teilgenommen hat (inkl. Verlauf, Beschlüssen und Aufgaben je TOP), mit Kopf-Hinweis „Auszug für
  Gast X". Ohne Teilnahmeliste, Gesamt-Aufgabenübersicht und Unterschriften. Bei mehreren
  infrage kommenden Gästen fragt ein Dialog, für wen der Auszug erstellt werden soll.

## [0.21.0] – 2026-07-22 – Einladungs-Signatur nach Sitzungsleitung & E-Mail als Volltext

### Neu
- **Sitzungsleitung ist jetzt ein Auswahlfeld** (aktive BR-Mitglieder statt Freitext).
  Leer = Vorsitz aus den Stammdaten; ein bereits gespeicherter, nicht (mehr) in der Liste
  vorhandener Name bleibt als Option erhalten und geht nicht verloren.

### Geändert
- **Die Einladungs-E-Mail (`.eml`) enthält den vollständigen Einladungsinhalt jetzt direkt
  im Mailtext** – Termin/Ort, alle Tagesordnungspunkte mit Erläuterungen, Referent/in, Dauer,
  Anlagenverweisen und Unterpunkten, Hinweise und Anlagenverzeichnis – **ohne PDF-Anhang**.
  Für eine formatierte PDF steht weiterhin der normale Einladungs-Export bereit.

### Behoben
- **Die Rolle in der Signatur richtet sich nach der tatsächlichen Sitzungsleitung.** Leitet
  z. B. die Stellvertretung die Sitzung, steht in Einladung und Protokoll nun
  „Stellv. Vorsitzende/r des Betriebsrats" statt fest „Vorsitzende/r des Betriebsrats".

## [0.20.0] – 2026-07-17 – Protokoll-Mail, Sitzungspausen, Datumsfilter & PDF-Feinschliff

### Neu
- **Button „Protokoll fertig (E-Mail)" im PDF-Export.** Erzeugt eine versandfertige,
  anhanglose E-Mail-Datei (`.eml`) an die Teilnehmenden mit dem Hinweis, dass die
  Niederschrift auf dem Laufwerk abgelegt wurde. Vor dem Erstellen fragt ein Dialog nach
  dem Ablageort/Link, der in die E-Mail übernommen wird. Empfänger: aktive ordentliche
  BR-Mitglieder, anwesende Ersatzmitglieder sowie teilnehmende SBV/JAV (per Namensabgleich
  Gast ↔ Stammdaten); Absender ist die Schriftführung der Sitzung.
- **„Pause beginnen"/„Pause beenden" je Tagesordnungspunkt und Unterpunkt** im Reiter
  Protokoll: fügt am Verlaufsende eine Zeile mit der aktuellen Uhrzeit ein („… um HH:MM Uhr
  unterbrochen/fortgesetzt"). Der Pausenzustand wird je Punkt gespeichert und übersteht ein
  Neuladen.
- **Datumsfilter (Zeitraum von–bis)** in den Übersichten Beschlüsse und Aufgaben (Bezug:
  Sitzungsdatum). CSV-/PDF-Export folgen dem gewählten Zeitraum.

### Geändert
- **„Alle als anwesend markieren" heißt jetzt „Alle Mitglieder als anwesend markieren"** und
  markiert nur ordentliche Mitglieder – Ersatzmitglieder werden bewusst nicht mehr mitmarkiert.
- **PDF-Layout der Beschluss- und Aufgabenübersicht korrigiert:** Datums-/Fälligkeitsspalten
  werden nicht mehr mitten im Wert umbrochen (neues `nowrap`-Spaltenverhalten, breitere
  Datumsspalten); Spaltentitel dürfen weiterhin umbrechen, sodass kein Kopf überläuft.

### Behoben
- **Laden einer Sicherung meldete fälschlich „key passt nicht zu `br-zugang.js`".**
  Ursache: Jeder Zugangsblock verpackt einen eigenen zufälligen Hauptschlüssel (MK).
  Beim Öffnen einer Sicherung wurde deren (u. U. älterer) MK aktiv gesetzt und die
  `key`-Cryptodatei dagegen geprüft – das schlug fehl, sobald die Sicherung vor der
  aktuellen `br-zugang.js`/`key` erzeugt wurde. Der auf dem Sperrschirm sichtbare
  Fehler trat besonders bei Test-Sicherungen aus der Zeit vor Einführung der
  `key`-Datei auf.
- **Die Installation (`br-zugang.js` + `key`) ist nun beim Laden einer Sicherung
  maßgeblich.** Der in der Sicherung eingebettete Schlüssel dient nur noch zum
  **Entschlüsseln** ihres Inhalts; die Daten werden anschließend unter dem
  Installations-Hauptschlüssel gespeichert, und Zugang/Rolle/Schlüssel der Anmeldung
  bleiben erhalten. Damit bleibt die Prüfung der Cryptodatei gültig, ältere Sicherungen lassen
  sich importieren, und der zuvor mögliche stille Datenverlust beim nächsten Login
  (lokaler Cache unter fremdem MK nicht mehr lesbar) entfällt. Betrifft
  „Vorhandene Sicherung öffnen" (Sperrschirm) und „Projekt öffnen" (angemeldet).

## [0.19.0] – 2026-07-11 – Zugang & Cryptodatei erzwungen

### Geändert
- **Ohne gültige `br-zugang.js` ist die App gesperrt.** Der bisherige
  Ersteinrichtungs-Dialog (Passwörter ohne Zugangsdatei festlegen), die
  Legacy-Migration und der Rückgriff auf einen nur lokal gespeicherten Zugang wurden
  entfernt. Fehlt die Datei oder ist sie ungültig, erscheint ein Sperrbildschirm –
  Passwörter lassen sich nicht mehr ohne Zugangsdatei setzen.

### Neu
- **Verschlüsselte Cryptodatei `key` erforderlich.** Zusätzlich zur `br-zugang.js`
  muss die Datei `key` im selben Ordner liegen. Sie enthält einen mit demselben
  Hauptschlüssel wie `br-zugang.js` verschlüsselten Marker und ist damit an genau
  diese Zugangsdatei gebunden. Fehlt sie oder passt sie nicht, bleibt die App gesperrt
  (Prüfung beim Anmelden und beim Öffnen einer Sicherung).
- **Neues Generator-Werkzeug `br-verschluesselung-generator.html`.** Erzeugt aus drei Passwörtern
  ein zusammengehöriges Paar `br-zugang.js` + `key` (beide aus einem Hauptschlüssel).
  Ein passendes `key` lässt sich zusätzlich im Debug-Panel neu herunterladen.

### Sicherheit
- Als reine Client-Anwendung ist die Prüfung der Cryptodatei technisch umgehbar (der
  Prüf-Code liegt im HTML). Sie verhindert beiläufige Weitergabe, schützt aber nicht die
  Daten – das leisten allein die Passwörter.

## [0.18.0] – 2026-07-11 – Debug-Mode statt Administrator, editierbare TOP-Kategorien

### Neu
- **Editierbare Kategorien für Tagesordnungspunkte** aus einer neuen externen Datei
  `category.js` (Muster wie `standard-tops.js`): Bezeichnungen anlegen, umbenennen,
  sortieren und entfernen – im Debug-Panel unter **„Kategorien"**. Ein interner,
  stabiler Schlüssel wird automatisch vergeben, sodass bereits kategorisierte
  Tagesordnungspunkte erhalten bleiben. Buttons **„category.js herunterladen"** und
  **„Datei laden …"** wie bei den Standard-TOPs; die externe Datei hat beim Öffnen
  Vorrang vor der gespeicherten Liste. Die App wird mit einer Default-`category.js`
  ausgeliefert (Formalia, Information, Beratung, Beschlussfassung, Sonstiges).

### Geändert
- **Rolle „Administrator" heißt nun „Debug-Mode"**, der Verwaltungsdialog **„Debug-Panel"**.
  Betrifft nur die sichtbaren Beschriftungen; der interne Rollen-Bezeichner und die
  verschlüsselte `br-zugang.js` bleiben unverändert (Bestandsdateien funktionieren weiter).
- **Existenz des Debug-Mode aus Viewer und Arbeitsmodus entfernt**: Der Login-Schirm
  nennt nur noch Viewer- und Arbeits-Passwort; die Leer-Hinweise bei Textbausteinen und
  Beschluss-Schlagworten verweisen nicht mehr auf einen Verwaltungsbereich.

## [0.17.0] – 2026-07-10 – Anhänge: Unterpunkt-Anlagen, keine PDF-Einbettung

### Neu
- **Anlagen an Unterpunkten**: Auch Unterpunkte (2.1, 2.2 …) können nun eigene Anhänge tragen
  (bisher nur Tagesordnungspunkte). Sie erscheinen im Anlagenverzeichnis mit Fundstelle
  „TOP 1.1" und im Dokumentenmanagement.

### Geändert
- **Keine Einbettung mehr in die PDFs**: Hochgeladene Anlagen werden nicht mehr als zusätzliche
  Seiten in Einladung und Niederschrift eingebettet. Stattdessen bleibt das **Anlagenverzeichnis**
  (Nummer, Name, Fundstelle) erhalten; die Dateien sind über den BR-Sitzungsmanager (Reiter
  „Dokumente") einsehbar. Die Export-Option „Anlagen in die PDFs einbinden" entfällt.
- Die generierte **Anwesenheitsliste** wird weiterhin als Anlage 1 in die Niederschrift
  aufgenommen (eigene Option, unverändert).

### Entfernt
- Einbettungs-Code (`anhaengeEinbinden`, PDF-Trennblatt, Fremdseiten-Übernahme) und die
  Checkbox `Anlagen in die PDFs einbinden` samt `exportOptionen.anlagenEinbinden`.

### Hinweis (geprüft, nicht umgesetzt)
- Ein **Upload in einen Unterordner** neben der HTML wäre technisch über die
  File-System-Access-API möglich (nur Chromium; Firefox/Safari nicht), würde die Anhänge
  aber zwingend **unverschlüsselt** auf dem Laufwerk ablegen. Es bleibt daher bei der
  bisherigen **verschlüsselten** Speicherung der Anhänge in der App/Sicherungsdatei.

## [0.16.0] – 2026-07-10 – Textformatierung im Protokoll

### Neu
- **WYSIWYG-Formatierung im Verlauf-Feld** („Verlauf / Ergebnis der Beratung", je TOP **und**
  Unterpunkt): Über eine kleine Werkzeugleiste lassen sich Textstellen **fett**, *kursiv* und
  <u>unterstrichen</u> auszeichnen sowie **Aufzählungs-** und **Nummerierungslisten** anlegen.
  Der Editor ist ein `contenteditable`-Feld; die Auszeichnung nutzt `document.execCommand`
  (offline, ohne Fremd-Bibliothek).
- Die Formatierung erscheint **sowohl in der App-Eingabe als auch im Protokoll-PDF** (Niederschrift):
  eigene Rich-Text-Ausgabe mit run-übergreifendem Wortumbruch, den Schriftschnitten
  Regular/Fett/Kursiv/Fett-Kursiv, echten Unterstreichungen und eingerückten Listen mit
  Aufzählungszeichen bzw. fortlaufender Nummerierung.

### Geändert
- **`punkt.verlauf` speichert nun HTML** aus einem festen Tag-Subset (`p, br, b, strong, i, em,
  u, ul, ol, li`, ohne Attribute). Bestehende Klartext-Verläufe werden beim Laden **automatisch
  migriert** (Absätze an Leerzeilen, Zeilenumbrüche als `<br>`); es geht kein Inhalt verloren.
- „**+ Textblock einfügen**" fügt Bausteine jetzt an der Cursorposition in den Rich-Text-Editor ein.

### Sicherheit
- **Strikte Sanitisierung** des Verlauf-HTML (Whitelist-Neuaufbau über `DOMParser`, alle Attribute
  und Fremd-Tags werden verworfen) beim Übernehmen aus dem Editor, vor jeder Anzeige (`innerHTML`)
  und vor der PDF-Erzeugung. Damit sind auch Verläufe aus fremden Sicherungsdateien unbedenklich
  (kein `script`/`style`/`img`/`a`, keine `on*`- oder `style`-Attribute).

### Nicht betroffen
- Krypto, Speicher, Rollenmodell sowie die übrigen PDFs (Einladung, Anwesenheitsliste, Übersichten)
  und die Felder Beschluss-Wortlaut und Erläuterung bleiben unverändert.

## [0.15.0] – 2026-07-10 – Anwesenheitsliste überarbeitet

### Geändert
- **Nur tatsächlich Anwesende**: Die generierte Anwesenheitsliste führt jetzt ausschließlich
  Mitglieder mit Status *anwesend* oder *Video/Telefon* auf. Mitglieder und Ersatzmitglieder mit
  Status *Offen* (sowie *Entschuldigt* / *Abwesend*) erscheinen nicht mehr.
- **Getrennte Blöcke** für **Betriebsratsmitglieder** und **Gäste** (Arbeitgeber, Gewerkschaft,
  SBV, JAV, Sachverständige) statt einer gemeinsamen Tabelle.
- **Spalten neu**: Die Spalte *Funktion* wurde durch **„Abw. Anwesenheit"** ersetzt (zeigt
  *Video/Telefon* bei abweichender Teilnahme, sonst leer); die separate Spalte *Teilnahme*
  entfällt. Die Rolle der BR-Mitglieder (Vorsitz, Schriftführung …) steht nun am Namen
  (z. B. „Anna Muster (Vorsitzende/r)"). Der Gäste-Block behält zusätzlich eine Spalte
  *Funktion/Organisation*.
- Betrifft ausschließlich die **Anwesenheitsliste**; alle übrigen PDFs (Einladung, Niederschrift
  inkl. Teilnahme-Abschnitt) bleiben unverändert.

## [0.14.0] – 2026-07-09 – UI-Revamp (bessere Nutzbarkeit, gleiche Funktionsweise)

### Geändert
- **Erscheinungsbild in externer Datei `br-design.css`**: Das komplette Stylesheet ist
  aus der HTML in eine Nachbardatei gewandert (Auslieferung jetzt **sechs Dateien**).
  In der HTML verbleibt ein kompakter Kern-Fallback – fehlt die CSS-Datei, bleibt die
  App benutzbar und zeigt einen Warnhinweis.
- **Seitenleiste neu gegliedert**: Navigationsleiste (Beschlüsse · Aufgaben · Dokumente ·
  Gremium & Mitglieder) mit Symbolen und **Aktiv-Markierung** direkt unter der Marke;
  darunter die Sektion „Sitzungen" mit Suche und Liste; kompakter Fuß (Rolle, Ausloggen,
  Sichern/Öffnen). Behebt u. a. den überlaufenden „Dokumente"-Knopf.
- **Reiterleiste bleibt beim Scrollen oben sichtbar** (sticky) – auch in langen
  Protokollen jederzeit Wechsel zwischen Sitzung/Tagesordnung/Protokoll/Export.
- **Ruhigere Typografie**: Feld-Beschriftungen in normaler Schreibweise (Großbuchstaben
  nur noch für Kartenköpfe/Überzeilen), einheitliche Knopfgrößen, dezente Zebra-Streifen
  und klarere Kopfzeilen in Tabellen; „Löschen" in der Sitzungs-Kopfzeile optisch
  zurückgenommen.
- **PDF-Exporte unverändert** – der Revamp betrifft ausschließlich die App-Oberfläche.

### Hinzugefügt
- **TOP-Sprungleiste** (ab vier Punkten) und **ein-/ausklappbare TOP-Blöcke** in
  Tagesordnung und Protokoll (Standard: aufgeklappt; Zustand nur für die Sitzungsdauer).
- **Zähl-Badges** („2 Beschlüsse · 1 Aufgabe") im TOP-Kopf des Protokolls.
- **Abschnittsnavigation im Admin-Bereich** (Gremium · Personen & Rollen · Standard-TOPs ·
  Textbausteine · Tags · Zugang) im festen Dialogkopf.
- **Passwort-Anzeigen-Umschalter** (Auge) am Login; Login-Karte mit Markenkopf.
- Warnhinweis beim Start, falls `br-design.css` fehlt.

## [0.13.0] – 2026-07-09 – Sicherheitshärtung Zugang

### Geändert
- **PBKDF2-Iterationen von 250 000 auf 600 000 angehoben** (OWASP-Empfehlung für
  PBKDF2-HMAC-SHA256). Konstante `PBKDF2_ITER` und die ausgelieferte `br-zugang.js`
  (`iter`) entsprechend erneuert. Der **Hauptschlüssel bleibt unverändert** – die
  Zugangsdatei wurde mit demselben Schlüssel neu verpackt, vorhandene Daten und
  Sicherungen bleiben zugänglich.

## [0.12.0] – 2026-07-09 – Textbausteine für die Protokollerstellung

### Hinzugefügt
- **Textbausteine in externer Datei `protokoll_vorlagen.js`**: wiederkehrende
  Formulierungen (je Eintrag `titel` fürs Menü und `text` als Baustein) liegen neben
  der HTML und werden beim Öffnen automatisch geladen. Die Datei ist **maßgeblich** –
  sie überschreibt eine abweichende, lokal gespeicherte Liste (analog zu
  `standard-tops.js`). Auslieferung jetzt als **fünf Dateien** (HTML + `pdf-lib.min.js`
  + `standard-tops.js` + `protokoll_vorlagen.js` + `br-zugang.js`).
- **„+ Textblock einfügen" je Tagesordnungspunkt** im Reiter „Protokoll" (auch für
  Unterpunkte): öffnet ein Auswahlmenü und fügt den gewählten Baustein an der
  Cursorposition ins Verlauf-/Ergebnis-Feld ein (bei nicht-leerem Feld durch einen
  Zeilenumbruch getrennt). Im Viewer-Modus ist der Knopf ausgeblendet.
- **Admin-Bereich „Textbausteine für Protokolle"**: Bausteine anlegen, bearbeiten,
  sortieren und löschen sowie **„protokoll_vorlagen.js herunterladen"** und eine Datei
  wieder laden – dasselbe Muster wie bei den Standard-Tagesordnungspunkten.

### Geändert
- Datenmodell um `protokollVorlagen` erweitert (Persistenz, Migration und
  Sicherungsdatei); Bestandsprojekte erhalten beim Laden eine Standard-Baustein-Liste.

## [0.11.0] – 2026-07-09 – Zugang in externer `br-zugang.js`, Login beim Öffnen

### Behoben
- **Default-Passwörter funktionierten beim ersten Start nicht**, wenn im Browser noch
  ein Zugang aus einer früheren (Test-)Version lag: Der alte, lokal gespeicherte
  Zugang „gewann", die ausgelieferten Passwörter griffen nie. Jetzt ist die externe
  Datei maßgeblich (siehe unten); passt der lokale Cache nicht zum Hauptschlüssel,
  wird ein leeres Projekt geseedet – die echten Daten kommen über „Vorhandene
  Sicherung öffnen".

### Geändert
- **Zugang/Passwörter in der externen Datei `br-zugang.js`**: Der Zugangsblock
  (Salts + je Rolle verschlüsselter Hauptschlüssel, **keine Klartext-Passwörter**)
  liegt neben der HTML und ist **maßgeblich** – er überschreibt veralteten lokalen
  Zustand. In der HTML steht **kein Passwort** mehr. Auslieferung jetzt als **vier
  Dateien** (HTML + `pdf-lib.min.js` + `standard-tops.js` + `br-zugang.js`).
- **Login beim Öffnen** statt automatischer Viewer-Ansicht: Die App verlangt beim
  Start immer ein Passwort; das eingegebene Passwort bestimmt die Rolle (Viewer/
  Arbeit/Admin). „Ausloggen" führt zurück zum Login-Sperrschirm; ein Rollenwechsel
  erfolgt durch erneutes Anmelden.
- Admin-Bereich „Zugang & Passwörter": neuer Knopf **„Zugangsdatei (br-zugang.js)
  herunterladen"**. Nach einer Passwort-Änderung die Datei neu herunterladen und neben
  der HTML ablegen; vorhandene Daten bleiben erhalten (gleicher Hauptschlüssel).
- **Copyright-Vermerk** in der App-Fußzeile ist jetzt **statisch in der HTML**
  hinterlegt (nicht mehr im Admin-Bereich einstellbar); das zugehörige Feld und
  `exportOptionen.copyright` entfielen.

### Hinzugefügt
- **Ersteinrichtungs-Dialog** als Fallback, falls `br-zugang.js` fehlt: drei
  Passwörter (Viewer/Arbeit/Admin) festlegen; die App bietet danach `br-zugang.js`
  zum Herunterladen an. Alte localStorage-Daten werden dabei weiterhin migriert.

## [0.10.0] – 2026-07-08 – Unterpunkte, Aufgabenübersicht, Beschluss-Status, E-Mail u. a.

### Hinzugefügt
- **Unterpunkte (2.1, 2.2 …)** in Tagesordnung und Protokoll – vollwertig, mit
  eigenen Beschlüssen und Aufgaben je Unterpunkt. Nummerierung, Beschluss-/
  Aufgabenübersicht und alle PDFs berücksichtigen die Unterpunkte.
- **Aufgabenübersicht** über alle Sitzungen (aus den Protokollen erzeugt), mit
  Filter (Jahr/Zuständig/Suche) und Export als CSV und PDF.
- **Beschluss-Status** „In Arbeit" / „Zugestellt": im Protokoll wählbar, in der
  Beschluss-Übersicht als Spalte und Filter, im CSV-/PDF-Export enthalten.
- **E-Mail-Adressen** in den Stammdaten (je Person) und **Einladung als `.eml`**:
  versandfertige E-Mail-Datei mit den BR-Mitgliedern als Empfänger und der
  Einladung als PDF-Anhang (öffnet in Outlook & anderen Clients).
- **Copyright-Vermerk** in der App-Fußzeile (im Admin-Bereich einstellbar,
  Standard „© <Jahr> <Gremium>, <Firma>").
- **Bearbeiter-Dialog beim Sichern**: bei jeder Sicherung wird die speichernde
  Person erfasst.

### Geändert
- Die **Einladung** wird ohne Unterschriftsbalken erzeugt (nur Grußformel und
  Name der/des Vorsitzenden). Das Protokoll behält seine Unterschriftenfelder.

## [0.9.0] – 2026-07-08 – Viewer-Standardansicht, Login-Button, pdf-lib ausgelagert

### Hinzugefügt
- **Viewer-Ansicht als Standard:** Beim Öffnen erscheint ohne Login-Dialog die
  Nur-Lese-Ansicht. Über einen **„Anmelden"-Knopf** in der Seitenleiste wechselt
  man in den Arbeits- bzw. Admin-Modus; „Ausloggen" kehrt in die Viewer-Ansicht
  zurück (kein Sperrschirm).
- **Drittes Rollen-Passwort „Viewer"** neben Arbeit und Admin. Der Hauptschlüssel
  wird dreifach verpackt; alle drei Passwörter sind im Admin-Bereich änderbar
  (kodiert, nie im Klartext).
- **Mitgelieferte Default-Session** mit vorbelegten Default-Kennwörtern
  (Viewer/Arbeit/Admin): Eine frische Installation ist sofort nutzbar; die App
  öffnet die Viewer-Ansicht automatisch mit dem bekannten Default-Viewer-Passwort.
- **Geheimer Leseschutz optional:** Setzt ein Admin ein eigenes Viewer-Passwort,
  verlangt die App es künftig beim Öffnen.
- **Nur-Lese-Durchsetzung** im Viewer: Eingabefelder gesperrt, Bearbeiten-Knöpfe
  ausgeblendet, Schreibvorgänge unterbunden; Ansehen, Navigation, Filter und
  PDF-/CSV-Export bleiben nutzbar.

### Geändert
- **pdf-lib ausgelagert** in die Nachbardatei `pdf-lib.min.js` (per
  `<script src>` geladen). Die HTML ist dadurch deutlich kleiner und lesbarer;
  Auslieferung jetzt als **drei Dateien** (HTML + `pdf-lib.min.js` +
  `standard-tops.js`), die zusammen im selben Ordner liegen.
- Kein Ersteinrichtungs-Dialog mehr; Passwörter werden im Admin-Bereich verwaltet.
  Alt-Installationen mit Zwei-Rollen-Zugang fragen beim Öffnen weiterhin ein
  Passwort ab, bis ein Admin ein Viewer-Passwort setzt.

### Hinweis
- Weil die App das Default-Viewer-Passwort kennt, ist die Verschlüsselung „at
  rest" in der Default-Konfiguration nur so stark wie das **geschützte
  Laufwerk**. Arbeits-/Admin-Passwörter sind weiche, client-seitige Schalter.
  Echten Leseschutz gibt es über ein geheimes Viewer-Passwort oder den
  Serverbetrieb.

## [0.8.0] – 2026-07-07 – Standard-TOPs, Beschluss-Tags, Dokument-Ordner

### Hinzugefügt
- Standard-Tagesordnungspunkte aus externer Datei `standard-tops.js` (im selben
  Ordner wie die HTML): beim Öffnen automatisch gelesen, beim Anlegen jeder
  Sitzung automatisch eingefügt, im Admin-Panel editierbar (Herunterladen/Laden).
- Farbige Beschluss-Tags: im Admin-Panel konfigurierbar, je Beschluss zuweisbar,
  in der Beschluss-Übersicht filterbar und im CSV-/PDF-Export enthalten.
- Ordner-Ansicht im Dokumentenmanagement: Dokumente je Sitzung in Ordnern;
  Uploads landen im geöffneten Ordner; „Dokumente dieser Sitzung" aus dem
  PDF-Export-Reiter.

### Hinweis
- Im `file://`-Betrieb kann `standard-tops.js` automatisch gelesen, aber nicht
  von der App zurückgeschrieben werden; Änderungen werden über „Herunterladen"
  und Ablegen im Ordner verteilt.

## [0.7.0] – 2026-07-07 – Phase 5: Sitzungs-Archiv & Ladekomfort

### Hinzugefügt
- Volltextsuche in der Sitzungsliste (Nr./Datum/Status/Art) und Gruppierung nach
  Jahr.
- Archivierung von Sitzungen (Archivieren/Zurückholen), Umschalter „Archiv
  anzeigen" mit Zähler; Archiv-Kennzeichen wird persistiert.

## [0.6.0] – 2026-07-07 – Phase 3: Dokumentenmanagement

### Hinzugefügt
- Verschlüsselter Blob-Dokumentenspeicher (IndexedDB) mit Metadaten-Index.
- Zentrales „Dokumente"-Panel: Upload, Filter (Kategorie/Sitzung/Suche), Ansehen,
  Herunterladen, Löschen; listet zusätzlich alle vorhandenen Sitzungs-Anlagen.
- Automatische Archivierung erzeugter PDFs (Einladung/Anwesenheitsliste/Protokoll)
  je Sitzung und Kategorie.

### Geändert
- Sicherungsdateien enthalten die Dokumente (verschlüsselt) und stellen sie beim
  Import bzw. beim Beitritt auf einem neuen Rechner wieder her.

## [0.5.0] – 2026-07-07 – Phase 2: Personen (BR/SBV/JAV) & Rollen

### Hinzugefügt
- Einheitliches `personen[]`-Modell mit Gruppe (`br` | `sbv` | `jav`), Rolle und
  Aktiv-Status; Rollenkataloge je Gruppe.
- Admin-Bereich verwaltet Betriebsrat, Schwerbehindertenvertretung (SBV) und
  Jugend- und Auszubildendenvertretung (JAV) getrennt.
- „SBV/JAV aus Stammdaten übernehmen" fügt aktive SBV-/JAV-Personen pro Sitzung
  als Gäste hinzu (ohne Duplikate).

### Geändert
- Anwesenheit und Beschlussfähigkeit zählen nur BR-Mitglieder (§ 33 BetrVG).
- Migration des bisherigen `mitglieder[]` nach `personen[]` (auch beim Import
  alter Sicherungen und aus dem alten localStorage).

## [0.4.0] – 2026-07-07 – Phase 1: Zwei-Passwort-Rollenmodell

### Hinzugefügt
- Rollen **Administrator** und **Arbeitsmodus** mit je eigenem Passwort; das
  verwendete Passwort bestimmt die Rolle.
- Geräteübergreifender Zugang: Passwörter reisen (als „verpackter" Hauptschlüssel)
  mit der Sicherungsdatei; Beitritt an neuen Rechnern über „Vorhandene Sicherung
  öffnen".
- Rollenanzeige und „Sperren"-Schaltfläche in der Seitenleiste; Passwortwechsel
  im Admin-Bereich.

### Geändert
- Backup-Format `enc-v2` (mit eingebettetem Zugang); Migration vom alten
  Einzelpasswort-Modell.
- Der Admin-Bereich ist im Arbeitsmodus ausgeblendet und gesperrt.

## [0.3.0] – 2026-07-07 – Netzlaufwerk-Härtung

### Hinzugefügt
- Fortlaufende **Revision** und Vermerk (Zeitpunkt + bearbeitende Person) je
  Sicherung; versionierte Dateinamen (`…_RevNNNN_JJJJ-MM-TT_HHMM.brenc.json`).
- Sicherungsstatus in der Seitenleiste inkl. Warnung bei nicht gesicherten
  Änderungen.
- Warnungen beim Import einer älteren Datei oder bei ungesicherten lokalen
  Änderungen; Workflow-Hinweis im Willkommensbildschirm.

## [0.2.0] – 2026-07-07 – Phase 4: Beschluss-Übersicht

### Hinzugefügt
- Gremiumsweite Beschluss-Übersicht über alle Sitzungen mit Filter
  (Jahr/Ergebnis/Suche) und Verlinkung ins jeweilige Protokoll.
- Export der Übersicht als CSV und als PDF.

## [0.1.0] – 2026-07-07 – Phase 0: Verschlüsselte Persistenz

### Hinzugefügt
- Verschlüsselte Ablage in IndexedDB (PBKDF2-SHA256 → AES-GCM-256), Schlüssel nur
  im Arbeitsspeicher; Sperrschirm für Einrichtung/Entsperren.
- Austauschbarer Speicher-Adapter (Vorbereitung für späteren Server-/SQLite-Betrieb).
- Verschlüsselte, selbsttragende Sicherungsdatei; Migration aus altem localStorage.
- Architektur-/Roadmap-Dokument `plan.md` und Mehrbenutzer-Konzept
  `konzept-serverbetrieb.md`.

### Geändert
- Ablösung des unverschlüsselten localStorage-Zwischenspeichers (Kapazitätsgrenze
  ~5 MB) durch IndexedDB.

## [0.0.0] – Ausgangszustand

- Bestehender BR-Sitzungsmanager als einzelne HTML-Datei: Sitzungen,
  Tagesordnungen, Protokolle, Beschlüsse und PDF-Export (Einladung,
  Anwesenheitsliste, Niederschrift), Ablage im Browser-localStorage.
