# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Zwei Rollen eines **Betriebsratsgremiums**, die dieselbe Sitzung von zwei Seiten führen:

- **Sitzungsleitung** (in der Regel der/die Vorsitzende) arbeitet in `BR-Sitzungsmanager.html`:
  Termin, Rahmendaten, Tagesordnung, geplante Anwesenheit, Einladung, Präsentation,
  gremiumsweite Übersichten über Beschlüsse, Aufgaben und Dokumente.
- **Schriftführung** arbeitet in `BR-Protokoll.html`: Anwesenheit, Verlauf je Punkt,
  Beschlüsse im Wortlaut, Aufgaben, Niederschrift.

Beide sind ehrenamtliche Betriebsratsmitglieder, keine IT-Fachleute, und arbeiten an
Firmen-Notebooks unter Windows. Die Mitglieder des Gremiums sind eine dritte, passive
Nutzergruppe: Sie sehen die projizierte Präsentation und die verteilten PDFs, bedienen
die App aber nicht. `br-urlaub-melden.html` ist die einzige Datei, die alle Mitglieder
selbst öffnen (ohne Passwort).

## Product Purpose

Ein vollständiger Sitzungsmanager für einen Betriebsrat: Sitzungen planen, protokollieren
und die nach BetrVG erforderlichen Dokumente erzeugen – Einladung (§ 29 Abs. 2),
Anwesenheitsliste (§ 34 Abs. 1 S. 3) und Niederschrift (§ 34) – ohne Server, ohne
Cloud-Dienst, ohne Installation. Erfolg heißt: Eine Sitzung ist rechtssicher dokumentiert,
und niemand musste dafür personenbezogene Daten aus der Hand geben.

## Positioning

Die App läuft **per Doppelklick aus dem Dateisystem** (`file://`) auf einem geschützten
BR-Laufwerk, verschlüsselt ihre Ablage im Browser (WebCrypto, AES-GCM) und kommt ohne
Server, Build-Schritt und Netzwerkzugriff aus. Kein Anbieter, keine Datenverarbeitung im
Auftrag, keine Mitbestimmungsfrage über das eigene Werkzeug. Die Fachlichkeit ist auf das
BetrVG zugeschnitten: Beschlussfähigkeit nach § 33 Abs. 2, Abstimmungsauswertung nach
§ 33 Abs. 1 mit ausgewiesenen Stimmenzahlen, Ersatzmitglieder, Ladung.

## Operating Context

- **Drei Bildschirmszenen:** Vorbereitung am großen Monitor der Docking-Station,
  Führung der Sitzung am 13–15"-Notebook im Sitzungsraum, und die **Projektion vor dem
  Gremium** über Beamer oder Raum-TV (eigener Präsentations-Export).
- **Tastaturbedienung ist wichtig:** Während der Sitzung wird geschrieben, die Maus liegt
  daneben. Fokusführung und Tastenwege müssen tragen.
- **Die erzeugten PDFs verlassen das Gremium:** Sie gehen an Arbeitgeber und
  Geschäftsleitung, an Gewerkschaft und Behörden und im Streitfall an Anwalt,
  Einigungsstelle oder Gericht. Sie müssen als Beweismittel formal über jeden Zweifel
  erhaben sein.
- **PDFs werden schwarzweiß vervielfältigt:** am Kopierer, in Graustufen. Farbe darf
  in den Dokumenten nie alleiniger Bedeutungsträger sein.
- Die Anwesenheitsliste wird **vor** der Sitzung gedruckt und dort von Hand ausgefüllt
  und unterschrieben; sie ist der Niederschrift beizufügen.
- Beide Module haben eigene Speicherstände und tauschen gerichtet über Dateien aus
  (`.brto.json` hin, `.brerg.json` zurück); Stammdaten kommen aus der Nachbardatei
  `Gremium`.

## Capabilities and Constraints

- **Kein Build-Schritt, kein Bundler, kein npm zur Laufzeit.** Klassische `<script src>`-Tags
  im gemeinsamen globalen Scope, Reihenfolge in den HTML-Dateien festgelegt. Node dient
  ausschließlich den Tests.
- **`file://`-Betrieb:** Es gibt keinen Server und keine Netzverbindung. Externe Ressourcen
  (Webfonts, CDN, Icon-Bibliotheken, Analytics) sind technisch ausgeschlossen. Alles
  Sichtbare muss aus den mitgelieferten Dateien kommen. Die File System Access API ist
  unter `file://` gesperrt.
- **Zielbrowser:** Chrome und Edge (Chromium) unter Windows 11.
- **Ein Stylesheet:** `br-design.css` im Stammverzeichnis. Fehlt sie, hält ein in den
  HTML-Dateien eingebetteter Kern-Fallback die App bedienbar und warnt sichtbar.
- **Die PDFs haben ein eigenes Layout**, unabhängig vom Stylesheet: eine hauseigene
  Layout-Engine über `pdf-lib` in `scripts/br-kern.js`. Deren Standardschriften sind
  WinAnsi-kodiert (Helvetica/Times/Courier); Zeichen außerhalb werden ersetzt oder
  transliteriert. Eine andere Schrift wäre nur als eingebettete Schriftdatei möglich.
- Rollen über drei Passwörter (Viewer, Arbeitsmodus, Debug-Mode); der verschlüsselte
  Hauptschlüssel liegt in `scripts/br-zugang.js` mit `scripts/key` und ist maßgeblich.
- Fachbegriffe sind gesetzlich vorgegeben und nicht verhandelbar: Gremium, Tagesordnung,
  Tagesordnungspunkt (TOP), Niederschrift, Beschlussfähigkeit, Ersatzmitglied,
  Entschuldigt, Ladung, SBV, JAV.
- Sprache der Oberfläche und aller Dokumente ist **Deutsch**.

## Brand Commitments

- Name: **BR-Sitzungsmanager** (Repository und Paket: *BR-Manager*).
- Copyright-Vermerk in der Fußzeile der App, statisch im HTML.
- Kein Logo, keine Hausfarben eines Unternehmens: Das Werkzeug gehört dem Betriebsrat,
  nicht dem Arbeitgeber. In die PDFs lässt sich ein **eigenes Logo des Gremiums** laden.
- **Primäre Akzentfarbe: `#009057`** (bindende Vorgabe des Auftraggebers). Auf Weiß
  erreicht sie 4,1:1 – für Flächen, Marken- und Zustandsfarbe ausreichend, für kleinen
  Text auf hellem Grund braucht es eine abgedunkelte Variante derselben Farbe.

## Evidence on Hand

- Vollständige, laufende Anwendung mit Testabdeckung (`test-br.js`, `test-browser.js`
  über Playwright) und gepflegtem CHANGELOG (aktuell v0.34.0).
- `README.md` beschreibt Funktionsumfang, Dateien und Betrieb; `LIESMICH.txt` im
  Release-Paket richtet sich an das Gremium.
- Es gibt **keine** Kundenstimmen, Nutzerzahlen, Benchmarks, Preise oder Referenzen –
  und keine Aussagen über Zertifizierung oder Rechtsberatung. Nichts davon darf
  erfunden werden.

## Product Principles

1. **Rechtssicherheit vor Bequemlichkeit.** Wo das BetrVG eine Form verlangt (Wortlaut
   des Beschlusses, exakte Stimmenzahlen, unterschriebene Anwesenheitsliste), setzt die
   App sie durch, statt sie abzukürzen.
2. **Die Daten bleiben im Haus.** Kein Netzwerkzugriff, keine externe Abhängigkeit zur
   Laufzeit – auch nicht für Schriften oder Symbole.
3. **Das Dokument ist das Produkt.** Bildschirm und PDF müssen dieselbe Sache sagen; im
   Zweifel gewinnt, was auf dem Papier beweistauglich ist.
4. **Ehrenamt unter Zeitdruck.** Wer die Sitzung führt, hat keine Einarbeitungszeit:
   Der nächste Schritt muss sichtbar sein, ohne dass jemand ein Handbuch liest.
5. **Zwei Rollen, ein Vorgang.** Sitzungsleitung und Schriftführung arbeiten getrennt,
   dürfen sich aber nie gegenseitig überschreiben.

## Accessibility & Inclusion

- **Tastaturbedienung** ist erklärter Bedarf: sichtbarer Fokus, sinnvolle Tab-Reihenfolge,
  keine Funktion nur per Maus.
- **Graustufen-Tauglichkeit der Dokumente:** Status, Ergebnis und Warnung müssen sich
  ohne Farbe erschließen (Text, Form, Position).
- Die Projektion vor dem Gremium verlangt im Präsentations-Export große Schrift und
  hohen Kontrast auf Entfernung.
