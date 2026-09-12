---
name: BR-Sitzungsmanager
description: Industrielle Signaletik für die Sitzungsführung – Kennfeld, Emailleschild, Bodenmarkierung.
colors:
  akzent: "#009057"
  akzent-dunkel: "#00673E"
  akzent-hell: "#E2F1EA"
  akzent-rand: "#9CCDB7"
  signal-hell: "#35C68C"
  warn-signal: "#E4B429"
  warn: "#8A5B12"
  warn-bg: "#FBF1D6"
  gefahr-signal: "#B4231C"
  gefahr: "#A32017"
  gefahr-bg: "#F8E5E3"
  blau: "#245C86"
  blau-bg: "#E3EDF4"
  tinte: "#0D1113"
  tinte-weich: "#39434A"
  grau: "#5F6B72"
  hell: "#6C7780"
  papier: "#F4F5F3"
  panel: "#FFFFFF"
  linie: "#D5D9D6"
  linie-stark: "#AEB5B1"
  grau-bg: "#E8EBE8"
  seitenleiste: "#151A18"
  seitenleiste-tief: "#0E1211"
  seitenleiste-text: "#E4E8E5"
  seitenleiste-dim: "#8E9A93"
typography:
  display:
    fontFamily: "Bahnschrift, 'DIN 1451 Std', 'DIN Condensed', 'Archivo Narrow', 'Roboto Condensed', system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "0.015em"
    fontStretch: "87.5%"
  headline:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.03em"
    fontStretch: "87.5%"
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1, 'ss01' 1"
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  keine: "0"
  kreis: "50%"
spacing:
  takt: "4px"
  eng: "8px"
  feld: "12px"
  block: "16px"
  tafel: "20px"
  raum: "32px"
components:
  kennfeld:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinte}"
    typography: "{typography.label}"
    rounded: "{rounded.keine}"
    padding: "3px 8px"
  kennfeld-frei:
    backgroundColor: "{colors.akzent}"
    textColor: "#FFFFFF"
  kennfeld-warn:
    backgroundColor: "{colors.warn-signal}"
    textColor: "#231A05"
  kennfeld-halt:
    backgroundColor: "{colors.gefahr-signal}"
    textColor: "#FFFFFF"
  kennfeld-offen:
    backgroundColor: "{colors.grau-bg}"
    textColor: "{colors.tinte-weich}"
  quorum-ok:
    backgroundColor: "{colors.akzent-dunkel}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.keine}"
    padding: "7px 12px"
  quorum-nein:
    backgroundColor: "{colors.warn-signal}"
    textColor: "#231A05"
  quorum-offen:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinte-weich}"
  btn:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinte}"
    typography: "{typography.title}"
    rounded: "{rounded.keine}"
    padding: "7px 13px"
    height: "34px"
  btn-hover:
    backgroundColor: "{colors.grau-bg}"
    textColor: "{colors.tinte}"
  btn-primaer:
    backgroundColor: "{colors.akzent-dunkel}"
    textColor: "#FFFFFF"
  btn-primaer-hover:
    backgroundColor: "{colors.akzent}"
    textColor: "#FFFFFF"
  btn-geist:
    backgroundColor: "transparent"
    textColor: "{colors.grau}"
  btn-gefahr:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.gefahr}"
  btn-dunkel:
    backgroundColor: "rgba(255,255,255,.07)"
    textColor: "{colors.seitenleiste-text}"
  btn-gross:
    padding: "11px 18px"
    height: "44px"
  btn-klein:
    padding: "4px 10px"
    height: "28px"
  eingabe:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.tinte}"
    rounded: "{rounded.keine}"
    padding: "7px 10px"
  eingabe-focus:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.tinte}"
  chip-gruen:
    backgroundColor: "{colors.akzent-hell}"
    textColor: "{colors.akzent-dunkel}"
    typography: "{typography.label}"
    rounded: "{rounded.keine}"
    padding: "2px 8px"
  chip-gelb:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
  chip-rot:
    backgroundColor: "{colors.gefahr-bg}"
    textColor: "{colors.gefahr}"
  chip-blau:
    backgroundColor: "{colors.blau-bg}"
    textColor: "{colors.blau}"
  chip-grau:
    backgroundColor: "{colors.grau-bg}"
    textColor: "{colors.tinte-weich}"
  top-nr:
    backgroundColor: "{colors.tinte}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.keine}"
    padding: "3px 9px"
  karte:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.keine}"
    padding: "16px 18px"
  tabellenkopf:
    backgroundColor: "{colors.tinte}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.keine}"
    padding: "7px 8px"
  nav-btn:
    backgroundColor: "transparent"
    textColor: "{colors.seitenleiste-text}"
    typography: "{typography.title}"
    rounded: "{rounded.keine}"
    padding: "8px 10px"
  nav-btn-aktiv:
    backgroundColor: "rgba(255,255,255,.11)"
    textColor: "#FFFFFF"
---

# Design System: BR-Sitzungsmanager

## Overview

**Creative North Star: "Das Leitsystem"**

Die Oberfläche ist ein Werk, kein Dashboard. Sie führt wie eine Halle mit
Kennzeichnung: dunkle Wand mit der Torliste der Sitzungen, quer darüber das
Kennfeld der laufenden Sitzung, daneben das Emailleschild der
Beschlussfähigkeit, und darunter die Schreibfläche an einer durchgehenden
Bodenmarkierung. Jedes Element ist ein Schild mit Kante, keine schwebende
Kachel. Rechteckige Plaketten mit 2px-Tintenkante, Haarlinien für alles
Untergeordnete, Versalien in der Kennfeld-Schrift für alles, was benennt.

Der Werkstoff ist Werkpapier (#F4F5F3), beschrieben mit Tinte (#0D1113).
Farbe tritt nur als Signal auf – Freigabegrün, Warngelb, Haltrot – und nie
allein: Bedeutung liegt zuerst in der Form. Das ist keine Stilfrage, sondern
Betriebsbedingung. Die erzeugten Dokumente werden in Graustufen
vervielfältigt und müssen dieselbe Aussage tragen wie der Bildschirm.

Die These verweigert ausdrücklich das gleichförmige Kartenraster aus weißen
Kacheln mit Icon-Reihe. Wo andere Systeme Kacheln setzen – Exporte,
Dokumentordner – steht hier eine Zeilenliste mit Kennfeld und Kopfkante. Die
Dichte ist hoch: Die App wird während einer laufenden Sitzung unter Zeitdruck
bedient, nicht durchgeblättert.

**Key Characteristics:**
- Form vor Farbe: Rechteck = Freigabe, Dreieck = Warnung, Kreis = Halt
- Ein einziges Grundmaß (`--takt: 4px`); jede Höhe und jeder Abstand ist ein Vielfaches
- Radius null überall; die einzige Rundung ist der Halt-Kreis
- Kanten statt Schatten: 2px Tinte oben, 1px Haarlinie ringsum
- Zonen tragen ihren Namen offen als Versalzeile, nicht als Symbol
- Alles Sichtbare kommt aus mitgelieferten Dateien: keine Webfonts, keine Icon-Pakete

## Colors

Werkpapier und Tinte als Werkstoff, drei Sicherheitsfarben als Signal, eine
dunkle Halle als Trägerfläche – mehr gibt es nicht.

### Primary
- **Freigabegrün** (`akzent`): Die bindende Marken- und Signalfarbe. Sie trägt
  Flächen, Sicherheitsformen, Kanten, die Bodenmarkierung (`.marke::after`,
  `.doppelkante`), die aktive Reiterkante und die Führungslinie eines Punktes,
  der bereits einen Beschluss trägt.
- **Freigabegrün Tief** (`akzent-dunkel`): Dieselbe Farbe abgedunkelt, für alles,
  was weiße Schrift oder kleinen Text trägt: primärer Schalter, Erfolgsmeldung,
  Links, Fokusrahmen, Schreibmarke, Zählerplakette des aktiven Reiters.
- **Freigabe Hell** (`akzent-hell`) und **Freigabe Rand** (`akzent-rand`):
  Auflagefläche für grüne Chips, Zeilenhover in Übersichtstabellen,
  Sitzungstag im Kalender.
- **Hallengrün** (`signal-hell`): Die Freigabe auf dunklem Grund (6,1:1) –
  Seitenleisten-Fokus, Sitzungsstand, aktives Nav-Icon, Toast-Kopfkante.

### Secondary
- **Warngelb** (`warn-signal`): Der Zustand, der Aufmerksamkeit verlangt, aber
  nichts verbietet: fehlende Beschlussfähigkeit, laufende Pause, ungesicherte
  Änderungen, nicht einbettbare Anlage, Viewer-Rolle. Schrift darauf ist immer
  `#231A05`, nie Weiß.
- **Warngelb Tief** (`warn`) auf **Warngelb Grund** (`warn-bg`): dieselbe
  Aussage in Textgröße – Warnhinweis, gelber Chip, Kalender-Abwesenheit.

### Tertiary
- **Haltrot** (`gefahr-signal`) und **Haltrot Tief** (`gefahr`) auf
  **Haltrot Grund** (`gefahr-bg`): Ablehnung, Löschung, Fehler. Selten und
  immer mit Kreisform.
- **Vermerkblau** (`blau`) auf **Vermerkblau Grund** (`blau-bg`): der eine
  neutrale Zustand, der weder freigibt noch warnt (geladen, versendet).

### Neutral
- **Tinte** (`tinte`): Fließtext, Tabellenkopfleiste, Kennziffernfeld,
  2px-Kanten, Toast-Grund. Zugleich `--kante`.
- **Tinte Weich** (`tinte-weich`) / **Werkgrau** (`grau`) / **Blass** (`hell`):
  die drei Stufen nachgeordneter Schrift. Auf Werkpapier trägt `hell` den
  Kontrastboden nicht mehr – dort steht `grau`.
- **Werkpapier** (`papier`): Seitengrund, Tafelfuß, Zebrastreifen der Tabellen.
- **Tafelweiß** (`panel`): die beschreibbare Fläche – Tafel, Eingabe, Zeile.
- **Haarlinie** (`linie`) / **Kante Hell** (`linie-stark`): Trennung und
  Eingaberand.
- **Hallenwand** (`seitenleiste`) / **Hallentief** (`seitenleiste-tief`):
  die dunkle Wand, an der die Schilder hängen, und der Sperrschirm dahinter.
  Beschriftet mit **Hallenlicht** (`seitenleiste-text`) und
  **Hallendämmer** (`seitenleiste-dim`).

### Named Rules

**Die Kontrastregel des Akzents.** `#009057` erreicht auf Weiß 4,1:1. Sie trägt
damit Flächen, Formen und Kanten – aber keinen Text. Sobald weiße Schrift auf
der Farbe steht oder die Farbe selbst zu Text wird, füllt `akzent-dunkel`
(6,9:1). Auf dunklem Grund übernimmt `signal-hell` (6,1:1). Das ist eine
Kontrastregel, keine Geschmacksfrage.

**Die Signalregel.** Es gibt genau drei Signalfarben und jede hat genau eine
Bedeutung: Grün gibt frei, Gelb warnt, Rot hält an. Eine vierte Signalfarbe
oder eine zweite Bedeutung für dieselbe Farbe gibt es nicht.

**Die Graustufenregel.** Farbe bestätigt, sie trägt nie allein. Prüftest: Ein
Schwarzweißdruck des Bildschirms muss dieselbe Aussage machen. Deshalb hat
jeder farbige Zustand zusätzlich seine Sicherheitsform und seinen ausgeschriebenen
Namen.

## Typography

**Display Font:** Bahnschrift / DIN 1451 (mit `font-stretch: 87.5%`, Fallback-Kette
DIN 1451 Std → DIN Condensed → Archivo Narrow → Roboto Condensed → system-ui)
**Body Font:** Systemschrift (system-ui → Segoe UI → Roboto → Arial)
**Ziffern:** durchgehend `font-variant-numeric: tabular-nums`

**Character:** Die Kennfeld-Schrift ist die Engschrift der Hallenschilder und
Wegweiser: gesperrt, in Versalien, technisch und laut. Sie benennt. Der
Fließtext bleibt Systemschrift – das ist der Werkstoff, in dem stundenlang
protokolliert wird, und er soll sich nicht behaupten.

### Hierarchy
- **Display** (700, 38px, 1.02, `letter-spacing: .015em`, Versalien): Der
  Sitzungstitel in der Kopfzeile über der 2px-Tintenkante. Genau einmal je Ansicht.
- **Headline** (700, 24px, 1.05, Versalien): Der Werkname in der Hallenwand;
  Dialogtitel (18px) und Sperrschirmtitel (26px) sind dieselbe Stufe.
- **Title** (600, 14px, `letter-spacing: .1em`, Versalien): Tafelköpfe, Reiter,
  Navigationsziele. Alles, was eine Zone benennt.
- **Body** (400, 14.5px, 1.5): Protokolltext, Eingaben, Beschreibungen. Die
  Arbeitsfläche ist auf 1100px begrenzt, der Rich-Text-Editor läuft mit 1.55.
- **Label** (600–700, 10–11.5px, `letter-spacing: .08–.16em`, Versalien):
  Feldbeschriftungen, Sektionsmarken, Chips, Plaketten, Kennziffern.

### Named Rules

**Die Beschriftungsregel.** Die Kennfeld-Schrift steht ausschließlich in
Versalien und gesperrt. Sie benennt – Zonen, Zustände, Zahlen – und schreibt
nie Fließtext. Umgekehrt trägt die Systemschrift nie eine Überschrift.

**Die Ziffernregel.** Jede Zahl, die sich ändert oder mit einer anderen
verglichen wird – Sitzungsnummer, Stimmenzahl, Quorum, Datum, Uhrzeit,
Dateigröße – steht in Tabellenziffern. Zahlen dürfen beim Neuzeichnen nicht
springen.

**Die offene Lücke.** Die Displayschrift ist die auf Windows vorhandene
Bahnschrift. Unter `file://` sind Webfonts technisch ausgeschlossen; es gibt
keine eingebettete Schriftdatei. Auf einem System ohne Bahnschrift und ohne
DIN-Variante endet die Kette auf `system-ui`, und die Welt verliert ihre
Displaystimme. Das ist eine bekannte, offene Lücke, kein gelöstes Problem –
wer sie schließen will, braucht eine mitgelieferte Schriftdatei.

## Layout

Zwei Spalten: die Hallenwand mit fester Breite (290px, `position: sticky`,
volle Höhe, eigener Bildlauf) und die Arbeitsfläche daneben. Die Arbeitsfläche
ist auf 1100px begrenzt und zentriert, mit Innenabstand 24px/32px und großzügigem
Fußraum (80px), damit der letzte TOP nicht am Fensterrand klebt.

**Das Grundmaß.** `--takt: 4px` ist die einzige Maßquelle. Jeder Abstand, jede
Polsterung, jede Mindesthöhe ist `calc(var(--takt) * n)` – die Leiter läuft in
Viertelschritten von 0,75 bis 20. Freie Pixelwerte gibt es nur dort, wo eine
physische Größe gemeint ist: Haarlinien (1px), Emaillekanten (2px),
Sicherheitsformen (8–12px), Bodenmarkierungen (6px).

Innerhalb der Tafeln arbeitet ein Raster mit 2, 3 oder 4 gleichen Spalten
(`.raster.s2/.s3/.s4`) beziehungsweise `auto-fit` ab 165px für Filterzeilen.
Zeilenlayouts mit fester Spaltenbreite (Mitglieder, Personen, Aufgaben) sind
Gitter, keine Flexreihen – die Spalten müssen über alle Zeilen fluchten.

Reiterleiste und Tabellenkopfleisten stehen `sticky`; deshalb trägt alles
Fokussierbare in der Arbeitsfläche `scroll-margin-top: 76px`, sonst parkt der
getabbte Fokus unter der Leiste. Breite Tabellen scrollen in ihrem Container,
nie die ganze Seite.

**Responsives Verhalten:** Es gibt keinen gepflegten Breakpoint-Satz und keine
Mobilfassung – das Werkzeug läuft auf Windows-Notebooks und Docking-Monitoren.
Zwei Media-Queries halten die App auf schmalen Fenstern lediglich bedienbar:
unter 920px legt sich die Hallenwand über die Arbeitsfläche statt daneben,
unter 760px fallen mehrspaltige Raster auf eine Spalte. Das ist Notbetrieb,
kein Zielformat; neue Flächen müssen nicht mobil entworfen werden.

## Elevation & Depth

Das System ist flach. Tiefe entsteht durch **Kante und Ton**, nicht durch
Schatten: Werkpapier trägt Tafelweiß, die Tafel bekommt oben eine 2px-Tintenkante
und ringsum eine Haarlinie. Wo etwas hervortritt, verdunkelt sich der Grund
(`grau-bg`, `akzent-hell`) oder die Kante wird kräftiger – nicht die Höhe.

Schatten gibt es ausschließlich für Ebenen, die tatsächlich über allem
schweben. Sie sind weich und weit gestreut, nie ein harter Versatz.

### Shadow Vocabulary
- **Modal** (`box-shadow: 0 24px 60px rgba(10,14,12,.4)`): Dialoge über einem
  Hintergrund von `rgba(10,14,12,.55)`.
- **Sperrschirm** (`box-shadow: 0 24px 60px rgba(0,0,0,.5)`): die Zugangskarte
  vor der geschlossenen Halle.
- **Meldung** (`box-shadow: 0 8px 26px rgba(10,14,12,.35)`): Toasts unten rechts.

### Named Rules

**Die Kantenregel.** Eine Fläche, die im Dokumentfluss steht, bekommt niemals
einen Schatten. Sie bekommt oben eine 2px-Tintenkante und ringsum eine
Haarlinie. Schatten ist ausschließlich der Beleg dafür, dass etwas den Fluss
verlassen hat: Dialog, Sperrschirm, Meldung.

## Shapes

Radius null. Jede Fläche, jeder Schalter, jede Eingabe, jeder Chip, jeder
Dialog ist rechteckig – `border-radius: 0` steht überall dort explizit, wo der
Browser sonst rundet. Die einzige Rundung im System ist der Kreis, und der ist
kein Radius, sondern eine Bedeutung.

**Die Sicherheitsformen** sind das Fundament der Welt. Sie erscheinen als
`::before`-Pseudoelement in `currentColor` an jedem Zustandsträger – Chip,
Ampel, Quorum, Statuszeile, Ergebnisanzeige, Toast:

- **Rechteck** (`.form-frei`, 11×11px, gefüllt): Freigabe, zulässig, erledigt
- **Dreieck** (`.form-warn`, 12px Grundlinie, Spitze nach oben): Warnung
- **Kreis** (`.form-halt`, 11×11px, `border-radius: 50%`): Halt, Ablehnung, Fehler
- **Umriss** (2px Rand ohne Füllung): offen, noch nicht entschieden

**Kantenvokabular:** 2px Tinte = Emaillekante eines Schildes oder Kopfkante
einer Tafel. 1px `linie-stark` = Eingaberand. 1px `linie` = Trennung. 3px
Akzent unter dem aktiven Reiter.

**Die Bodenmarkierung** ist die zweite Signatur der Welt: ein sich
wiederholender Verlauf, der als Spur über oder durch eine Fläche läuft.
Waagerecht in Akzentgrün mit 18px Strich / 8px Lücke bei 6px Höhe
(`.marke::after`, `.sperr-karte .doppelkante`), senkrecht in `linie-stark` mit
7px/5px als Führungslinie durch einen TOP (`.top-koerper::before`) und in
6px/4px an seinen Unterpunkten (`.unterpunkt-prot::before`).

### Named Rules

**Die Formregel.** Ein Zustand ohne Form ist kein Zustand. Jeder farbige
Zustandsträger führt seine Sicherheitsform mit – wer eine neue Zustandsanzeige
baut, setzt zuerst die Form, dann die Farbe.

**Die Spurregel.** Fortschritt und Zugehörigkeit werden als Bodenmarkierung
gezeigt, nie als Balken mit Rundung und nie als farbiger Seitenstreifen an
einer Karte. Sobald ein TOP einen Beschluss trägt, wechselt seine Führungslinie
von `linie-stark` auf Akzentgrün.

## Components

### Buttons
- **Shape:** Rechteck ohne Radius, 1px `linie-stark`, Mindesthöhe 34px, Beschriftung
  in Kennfeld-Schrift, 600, gesperrt (`.05em`).
- **Standard:** Weiß auf Tafelweiß; im Hover verdichtet sich die Kante auf Tinte
  und der Grund auf `grau-bg`.
- **Primär:** `akzent-dunkel` mit weißer Schrift – die abgedunkelte Variante,
  weil Text darauf steht. Im Hover hellt sie auf `akzent` auf.
- **Geist:** randlos und grau, für Reihenwerkzeuge; Hover setzt `grau-bg`.
- **Gefahr:** Schrift in `gefahr`, Hover füllt `gefahr-bg` und setzt die Kante.
- **Dunkel:** die Variante für die Hallenwand, `rgba(255,255,255,.07)` auf
  transparentem Rand, volle Breite.
- **Größen:** klein (28px), Symbol (28×28px), groß (44px – nur für den einen
  entscheidenden Schalter eines Schirms).
- **Zustände:** `:active` schiebt einen Pixel nach unten. `:disabled` senkt die
  Deckkraft auf .45. Fokus ist immer ein 2px-Rahmen in `akzent-dunkel` mit 2px
  Versatz (in der Hallenwand `signal-hell`).

### Chips
- **Style:** Rechteck, 1px in `currentColor`, Kennfeld-Schrift 11,5px, 700,
  Versalien, mit vorangestellter Sicherheitsform.
- **State:** fünf Zustandsklassen mit Grund + Schrift aus derselben Familie –
  grün (frei), gelb (Warnung, Dreieck), rot (Halt, Kreis), blau (neutral),
  grau (offen). `.ampel` ist derselbe Baustein eine Stufe kleiner für
  Tabellenzellen, `.tag-chip` die schaltbare Variante ohne Form.

### Cards / Containers
- **Corner Style:** kein Radius.
- **Background:** Tafelweiß auf Werkpapier; der Tafelfuß kehrt auf Werkpapier zurück.
- **Shadow Strategy:** keiner – siehe Kantenregel.
- **Border:** 1px `linie` ringsum, oben 2px Tinte. Diese Kopfkante ist die
  Signatur jedes eigenständigen Blocks (Tafel, Ausgabeliste, Ordnerregal,
  Rechtshinweis, Gastzuweisung, Leerzustandsschritt).
- **Internal Padding:** Kopf 12px/18px, Körper 16px/18px, Fuß 10px/18px.

### Inputs / Fields
- **Style:** 1px `linie-stark` auf Weiß, kein Radius, Polsterung 7px/10px.
  Die Beschriftung steht darüber in Kennfeld-Versalien 11,5px.
- **Focus:** Die Kante wechselt auf `akzent` und ein `inset 0 0 0 1px` derselben
  Farbe verdoppelt sie – die Eingabe wird umrandet, nicht angeleuchtet.
- **Editierbarer Titel:** Das TOP-Titelfeld ist im Ruhezustand randlos und
  transparent, zeigt seinen Rand erst im Hover und seine Akzentkante im Fokus.
- **Nur-Lesen:** Werkpapiergrund, Haarlinienrand, Deckkraft .72.

### Navigation
- **Hallenwand:** Wegweiser tragen ihren Namen offen in Kennfeld-Schrift 14px
  neben einem gezeichneten SVG-Icon. Hover hellt den Grund um 7 %, aktiv um
  11 %, und die aktive Zone bekommt ihre Markierung am **Boden**
  (2px Akzent, `::after`), nicht am Rand.
- **Reiter:** Versalien in Kennfeld-Schrift über einer 2px-Tintenkante. Der
  aktive Reiter steht auf Tafelweiß mit 3px Akzentkante; seine Zählerplakette
  wechselt auf `akzent-dunkel`.
- **Torliste:** jede Sitzung eine Zeile mit Kennziffer links hinter einer
  senkrechten Trennlinie, Datum, und Zustand als Versalzeile mit Sicherheitsform.
  Die aktive Sitzung bekommt `rgba(0,144,87,.16)` und die Akzentkante.

### Das Freigabeschild (`.quorum`)
Die wichtigste Aussage der App und das Herz der Welt: eine emaillierte Plakette
mit 2px-Kante in `currentColor`, Versalien, Tabellenziffern, davor die
Sicherheitsform.

- **Beschlussfähig:** `akzent-dunkel` mit weißer Schrift, Form = weißes Rechteck.
- **Nicht beschlussfähig:** `warn-signal` mit Tintenkante und `#231A05`,
  Form = Dreieck. Eine fehlende Beschlussfähigkeit ist eine Warnung, kein Fehler.
- **Offen:** Tafelweiß mit `linie-stark`, Form = leerer Umriss.
- Das Schild erscheint **einmal je Bildschirm**: im Sitzungskopf oder im
  Sitzungsstand der Hallenwand. Die Anwesenheitstafel zeigt an seiner Stelle nur
  die Zahlen (`.quorum-zahlen`) – zweimal dieselbe Plakette wäre Wiederholung,
  keine Aussage.

### Kennfeld und Kennziffer
`.kennfeld` ist die kleine Emailleplakette: Rechteck, 2px Tintenkante,
Versalien 11,5px, mit vier Zustandsfüllungen (frei / warn / halt / offen).
`.top-nr` ist die Hallennummer eines Punktes: gefülltes Tintenfeld mit weißer
Kennziffer, immer vor dem Titel. Beide sind eckig gesetzt und werden nie
kreisförmig, nie als Badge mit Radius.

### Tabellen
`.tn-tabelle` (Anwesenheit) und `.beschluss-tabelle` (Übersichten) teilen eine
Kopfleiste in Tinte mit weißen Kennfeld-Versalien – die Leiste steht in
Übersichten `sticky`. Zebrastreifen in Werkpapier, Trennung als Haarlinie,
Zeilenhover in `akzent-hell` dort, wo die Zeile anklickbar ist, sonst
Werkpapier.

### Meldungen und Hinweise
Toasts sind angeschlagene Zettel: Tintengrund, weiße Schrift, 2px-Kopfkante in
`signal-hell` und die Sicherheitsform vorn; der Fehler-Toast wechselt auf
`gefahr` mit Kreisform, der Erfolgs-Toast auf `akzent-dunkel`. Statische
Hinweise (`.hinweis`) tragen ihre Art in der Kopfkante: 2px Tinte für den
Rechtshinweis, 3px `warn-signal` plus eingerücktes Dreieck für die Warnung.

### Motion
Der Haushalt ist bewusst klein und vollständig aufzählbar:

- **Zustandswechsel:** `--uebergang: .14s cubic-bezier(.2,.8,.2,1)`, angewandt
  ausschließlich auf `background`, `border-color`, `color` und `transform`.
- **Der eine autorisierte Moment:** Kippt die Beschlussfähigkeit, legt das Schild
  einmal hart um (`.quorum.schaltet`, Keyframes `schild-frei` / `schild-warn`,
  0,3s in `steps(1,end)`) – wie eine Signalleuchte, nicht wie ein Übergang. Der
  Blitz bleibt in der Palette (Tinte), statt Farben zu invertieren. Ausgelöst
  wird er in `quorumAnzeigeSetzen` nur beim echten Klassenwechsel, nie beim
  Neuzeichnen.
- **Die laufende Pause** (`.st-pause`) schaltet dauerhaft im 2s-Takt zwischen
  `warn-signal` und `#6B5210` – der einzige Dauerhinweis, weil eine vergessene
  Pause das Protokoll verfälscht.
- **Toast-Einzug:** 0,18s Versatz von 12px.
- Alles davon ist unter `prefers-reduced-motion: reduce` abgeschaltet; `--uebergang`
  fällt dort auf `0s`.

## Die Welt in drei Medien

Dieselbe Welt gilt auf Bildschirm, Papier und Projektion – jeweils mit eigenen
Mitteln, weil die Medien nichts teilen können.

**PDF** (`scripts/br-kern.js`): eine eigene Layout-Engine über `pdf-lib` mit
eigener Palette (`pdfFarben`) in denselben Werten – Tinte, Werkpapier,
Akzent #009057, Akzent Tief #00673E für Text, Warngelb, Haltrot. Der
`briefkopf` setzt den Gremiumsnamen als gesperrte Versalzeile über einer
Tintenkante mit Bodenmarkierung in Akzentgrün darunter; `schild` zeichnet die
Emailleplakette mit ihrer Sicherheitsform; `spur` die Bodenmarkierung; `tabelle`
die Kopfleiste in Tinte; `beschlussKasten` das Beschlussfeld. Die Schrift ist
Helvetica (WinAnsi) – die Bahnschrift steht auf Papier nicht zur Verfügung, die
Wirkung trägt dort allein Sperrung, Versalie, Kante und Form. Zeichen außerhalb
WinAnsi werden transliteriert.

**Projektion** (`PRAES_CSS` in `scripts/br-export.js`): eine eigenständige
HTML-Präsentation mit eigenem, minimalem Tokensatz für hell und dunkel
(`--bg/--fg/--dim/--akz`). Hell übernimmt Werkpapier und Akzent unverändert,
dunkel setzt `#0E1211` mit `signal-hell` als Akzent, damit auf Entfernung der
Kontrast trägt. Die Kennziffer ist dort ein **gefülltes Feld** in Akzentfarbe
(34px), der Titel steht bei 76–86px, und der Fortschritt läuft als
Bodenmarkierung über die volle Fensterbreite – dieselbe Spur wie in App und PDF.

## Do's and Don'ts

### Do:
- **Do** jede Größe und jeden Abstand als `calc(var(--takt) * n)` schreiben.
  Freie Pixelwerte nur für Haarlinie, Kante, Sicherheitsform und Bodenmarkierung.
- **Do** jedem Zustandsträger seine Sicherheitsform geben: Rechteck frei,
  Dreieck Warnung, Kreis Halt, Umriss offen.
- **Do** `akzent-dunkel` verwenden, sobald weiße Schrift auf der Marke steht
  oder die Marke selbst zu Text wird; auf dunklem Grund `signal-hell`.
- **Do** Zonen mit ihrem ausgeschriebenen Namen in Kennfeld-Versalien beschriften.
- **Do** Blöcke mit einer 2px-Tintenkante oben und einer Haarlinie ringsum
  absetzen.
- **Do** jede sich ändernde Zahl in Tabellenziffern setzen.
- **Do** Icons als Inline-SVG aus dem Sprite in den HTML-Dateien nehmen, mit
  einer Strichstärke (1,8) und eckigen Enden.
- **Do** neue Bewegung gegen den Haushalt prüfen: es gibt genau einen
  autorisierten Moment, und er gehört dem Freigabeschild.

### Don't:
- **Don't** ein Kachelraster aus gleichförmigen weißen Karten mit Icon-Reihe
  bauen. Sammlungen sind Zeilenlisten mit Kennfeld und Kopfkante
  (`.export-raster`, `.ordner-raster`).
- **Don't** einen Radius setzen. Die einzige Rundung im System ist der
  Halt-Kreis.
- **Don't** einer Fläche im Dokumentfluss einen Schatten geben; Schatten haben
  nur Dialog, Sperrschirm und Meldung.
- **Don't** Bedeutung allein über Farbe transportieren – ohne Form und ohne
  ausgeschriebenen Namen ist ein Zustand in Graustufen verloren.
- **Don't** `--hell` (#6C7780) für Text auf Werkpapier verwenden; dort trägt
  `grau` den Kontrastboden.
- **Don't** Weiß auf `warn-signal` setzen; die Schrift auf Warngelb ist `#231A05`.
- **Don't** dasselbe Freigabeschild zweimal auf einem Bildschirm zeigen; die
  zweite Stelle bekommt die Zahlen.
- **Don't** einen farbigen Seitenstreifen an eine Karte setzen, um Zugehörigkeit
  zu zeigen – das macht die Bodenmarkierung oder die Kopfkante.
- **Don't** eine externe Ressource einbinden: keine Webfonts, kein CDN, keine
  Icon-Bibliothek, kein Build-Schritt. Die App läuft per Doppelklick unter
  `file://`; alles Sichtbare muss aus den mitgelieferten Dateien kommen, und
  jede HTML-Datei trägt ihren Kern-Fallback für den Fall, dass `br-design.css`
  fehlt.
- **Don't** Emoji oder Glyphen als Symbol verwenden; das Fachzeichen ist ein
  gezeichnetes SVG im Kennfeld.
