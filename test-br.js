'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MODULE = ['br-kern.js', 'br-app.js', 'br-tagesordnung.js', 'br-protokoll.js', 'br-export.js'];
const hier = path.join(__dirname, 'scripts');

const zusammen = MODULE.map(f => fs.readFileSync(path.join(hier, f), 'utf8')).join('\n');
new vm.Script(zusammen, { filename: 'alle-module.js' });   /* wirft bei Doppel-Deklaration */
console.log('OK  Module teilen sich den globalen Scope ohne Namenskollision');

/* Top-level const/function landen im lexikalischen Scope, nicht im Kontextobjekt – Zugriff über eval im selben Kontext */
const KERN_QUELLE = fs.readFileSync(path.join(hier, 'br-kern.js'), 'utf8');
function kernLaden(brModus, urlaub) {
  const ctx = vm.createContext({
    window: { BR_MODUS: brModus },
    daten: urlaub === undefined ? null : { urlaub: urlaub, personen: [] },
    crypto: require('crypto').webcrypto,
    console: console
  });
  vm.runInContext(KERN_QUELLE, ctx, { filename: 'br-kern.js' });
  return new Proxy({}, {
    get(_, name) {
      const wert = vm.runInContext(String(name), ctx);
      return typeof wert === 'function' ? (...args) => {
        ctx.__args = args;
        return vm.runInContext(String(name) + '(...__args)', ctx);
      } : wert;
    }
  });
}

/* Sandbox-Werte haben fremde Prototypen (anderes Realm) – für Strukturvergleiche nach JSON umkopieren */
const roh = x => JSON.parse(JSON.stringify(x));

const sitzung = kernLaden(undefined, []);
assert.strictEqual(sitzung.APP_MODUS, 'sitzung', 'ohne BR_MODUS gilt der Sitzungsmanager');
assert.deepStrictEqual(roh(sitzung.modusReiter()), ['sitzung', 'tagesordnung', 'einladung', 'export']);
assert.ok(sitzung.modusHatExport('einladung') && !sitzung.modusHatExport('protokoll'));

const prot = kernLaden('protokoll', []);
/* Export-Datei (mit Kommentar-Beispiel in eckigen Klammern) lässt sich wieder einlesen */
{
  const quelle = fs.readFileSync(path.join(hier, 'br-export.js'), 'utf8');
  const kopf = /const inhalt = ('\/\* Standard-Tagesordnungspunkte[\s\S]*?\*\/\\n') \+\s*'window\.BR_STANDARD_TOPS = '/.exec(quelle);
  assert.ok(kopf, 'Export-Kopf gefunden');
  const rein = [{ titel: 'A [x]', kategorie: '', unterpunkte: [{ titel: 'B' }] }];
  const datei = eval(kopf[1]) + 'window.BR_STANDARD_TOPS = ' + JSON.stringify(rein, null, 2) + ';\n';
  const t = sitzung.externesArrayText(datei);
  assert.deepStrictEqual(JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)), rein, 'Export -> Import ist verlustfrei');
  console.log('OK  Import exportierter Standard-TOP-Dateien trotz Kommentar mit [ ]');
}

/* Sitzungsnummer: höchste laufende Nummer + 1, auch nach Löschungen */
{
  const j = 2026, mk = nr => ({ nr: nr, datum: '2026-01-01' });
  assert.strictEqual(sitzung.neueSitzungsNummer({ sitzungen: [] }, j), '01/2026');
  assert.strictEqual(sitzung.neueSitzungsNummer({ sitzungen: [mk('01/2026'), mk('03/2026')] }, j), '04/2026', 'Lücke führt nicht zu Doppelvergabe');
  assert.strictEqual(sitzung.neueSitzungsNummer({ sitzungen: [mk('07/2025'), mk('Sonder'), mk('02/2026')] }, j), '03/2026', 'fremde Jahre/Formate ignoriert');
  console.log('OK  Neue Sitzungsnummer = höchste Nummer des Jahres + 1');
}

assert.strictEqual(prot.APP_MODUS, 'protokoll');
assert.deepStrictEqual(roh(prot.modusReiter()), ['tagesordnung', 'protokoll', 'export']);
assert.ok(prot.modusHatReiter('tagesordnung'), 'die Tagesordnung führen beide Module');
assert.ok(!prot.modusHatReiter('einladung'), 'geplant wird im Manager, nicht in der Schriftführung');
assert.ok(!prot.modusHatReiter('sitzung'), 'die Rahmendaten bleiben bei der Sitzungsleitung');
assert.strictEqual(prot.modusStartReiter(), 'protokoll', 'gestartet wird trotzdem im Protokoll');
assert.strictEqual(sitzung.modusStartReiter(), 'sitzung');
assert.ok(prot.modusHatExport('protokoll') && !prot.modusHatExport('einladung'));
assert.strictEqual(kernLaden('quatsch', []).APP_MODUS, 'sitzung', 'unbekannter Wert fällt auf sitzung zurück');
console.log('OK  Betriebsart schaltet Reiter und Exporte um');

const k = kernLaden(undefined, [
  { name: 'Erika Mustermann', von: '2026-08-10', bis: '2026-08-28', grund: 'Urlaub' },
  { name: '  max   mustermann ', von: '2026-09-07', bis: '2026-09-11' },
  { name: 'Eintagsfliege', von: '2026-08-15' },
  { name: 'Kaputt', von: '15.08.2026', bis: '2026-08-20' },
  { name: 'Verdreht', von: '2026-08-20', bis: '2026-08-10' },
  { name: '', von: '2026-08-01', bis: '2026-08-02' },
  { von: '2026-08-01' }
]);

const e = k.urlaubEintraege();
assert.strictEqual(e.length, 3, 'nur die drei gültigen Einträge überleben, Rest wird verworfen');
assert.deepStrictEqual(roh(e.map(x => x.von)), ['2026-08-10', '2026-08-15', '2026-09-07'], 'nach Beginn sortiert');
assert.strictEqual(e[2].name, 'max mustermann', 'Mehrfach-Leerzeichen werden zusammengefasst');
assert.strictEqual(e[2].bis, '2026-09-11');
assert.strictEqual(e[2].grund, 'Urlaub', 'fehlender Grund wird zu „Urlaub"');
assert.strictEqual(e[1].bis, '2026-08-15', 'fehlendes bis = eintägig');

assert.strictEqual(k.abwesendAm('2026-08-09').length, 0, 'Tag vor Beginn');
assert.strictEqual(k.abwesendAm('2026-08-10').length, 1, 'erster Tag zählt');
assert.strictEqual(k.abwesendAm('2026-08-28').length, 1, 'letzter Tag zählt');
assert.strictEqual(k.abwesendAm('2026-08-29').length, 0, 'Tag nach Ende');
assert.strictEqual(k.abwesendAm('2026-08-15').length, 2, 'Erika + Eintagsfliege');
assert.strictEqual(k.abwesendAm('').length, 0, 'ohne Datum keine Treffer');
assert.strictEqual(k.abwesendAm('2026-08-15T10:00:00Z').length, 2, 'Zeitanteil wird abgeschnitten');

assert.ok(k.abwesenheitVon('Erika Mustermann', '2026-08-12'), 'exakter Name');
assert.ok(k.abwesenheitVon('  ERIKA   MUSTERMANN  ', '2026-08-12'), 'Groß/Klein + Leerzeichen egal');
assert.strictEqual(k.abwesenheitVon('Erika Mustermann', '2026-09-08'), null, 'anderer Zeitraum');
assert.strictEqual(k.abwesenheitVon('Unbekannt', '2026-08-12'), null);
assert.strictEqual(k.abwesenheitVon('', '2026-08-12'), null);

const offen = k.urlaubUnbekannteNamen({ personen: [{ name: 'Erika Mustermann' }, { name: 'Max Mustermann' }] });
assert.deepStrictEqual(roh(offen), ['Eintagsfliege'], 'nur der Name ohne Person bleibt übrig');
assert.deepStrictEqual(roh(k.urlaubUnbekannteNamen({ personen: [] })).sort(),
  ['Eintagsfliege', 'Erika Mustermann', 'max mustermann'], 'ohne Stammdaten ist alles unbekannt');

const ohne = kernLaden(undefined, undefined);
assert.deepStrictEqual(roh(ohne.urlaubEintraege()), []);
assert.deepStrictEqual(roh(ohne.abwesendAm('2026-08-12')), []);
assert.strictEqual(ohne.abwesenheitVon('Wer auch immer', '2026-08-12'), null);
assert.deepStrictEqual(roh(ohne.urlaubUnbekannteNamen(null)), []);
console.log('OK  Urlaubskalender: Filter, Zeitraumgrenzen, Namensabgleich, Fehlerfälle');

const leer = { verlauf: '', beschluesse: [], aufgaben: [] };
const mitText = { verlauf: '<p>Etwas protokolliert.</p>', beschluesse: [], aufgaben: [] };
const mitBeschluss = { verlauf: '', beschluesse: [{ id: 'b' }], aufgaben: [] };
const f = tops => k.protokollFortschritt({ tops: tops });

assert.deepStrictEqual(
  [f([Object.assign({ unterpunkte: [] }, leer)]).punkte, f([Object.assign({ unterpunkte: [] }, leer)]).erledigt],
  [1, 0], 'TOP ohne Unterpunkte und ohne Inhalt: 0 von 1');
assert.strictEqual(f([Object.assign({ unterpunkte: [] }, mitText)]).erledigt, 1, 'mit Verlauf erledigt');
assert.strictEqual(f([Object.assign({ unterpunkte: [] }, mitBeschluss)]).erledigt, 1, 'ein Beschluss genügt auch');

/* Kontraintuitiv: der TOP gilt über seine Unterpunkte als erledigt, auch ohne eigenen Inhalt */
const nurUnten = f([Object.assign({ unterpunkte: [Object.assign({}, mitText), Object.assign({}, mitText)] }, leer)]);
assert.strictEqual(nurUnten.punkte, 3, 'TOP und seine zwei Unterpunkte sind drei Einheiten');
assert.strictEqual(nurUnten.erledigt, 3, 'der TOP gilt über seine Unterpunkte als protokolliert – 100 %');

const halb = f([Object.assign({ unterpunkte: [Object.assign({}, mitText), Object.assign({}, leer)] }, leer)]);
assert.strictEqual(halb.erledigt, 2, 'die Lücke ist der leere Unterpunkt, nicht der TOP');
assert.strictEqual(halb.punkte, 3);

const nurOben = f([Object.assign({ unterpunkte: [Object.assign({}, leer), Object.assign({}, leer)] }, mitText)]);
assert.strictEqual(nurOben.erledigt, 1, 'ein Verlauf am TOP macht die Unterpunkte nicht erledigt');

const nichts = f([Object.assign({ unterpunkte: [Object.assign({}, leer)] }, leer)]);
assert.strictEqual(nichts.erledigt, 0);

const gemischt = f([
  Object.assign({ unterpunkte: [{ verlauf: '', beschluesse: [{ id: 'x' }], aufgaben: [{ id: 'y' }], pauseAktiv: true }] }, leer),
  Object.assign({ unterpunkte: [] }, mitBeschluss)
]);
assert.strictEqual(gemischt.beschluesse, 2, 'Beschlüsse aus TOPs und Unterpunkten');
assert.strictEqual(gemischt.aufgaben, 1);
assert.strictEqual(gemischt.pause, true, 'eine Pause am Unterpunkt zählt');
assert.strictEqual(f([]).punkte, 0, 'ohne TOPs kein Nenner');
console.log('OK  Fortschritt: Unterpunkte allein genügen für 100 %');

assert.ok(k.beschlussVorlagenDefault().length >= 5);
assert.ok(k.beschlussVorlagenDefault().every(v => v.id && v.titel && v.text));
assert.notDeepStrictEqual(
  roh(k.beschlussVorlagenDefault().map(v => v.titel)),
  roh(k.protokollVorlagenDefault().map(v => v.titel)),
  'Beschluss- und Protokoll-Bausteine sind getrennte Listen');
assert.ok(k.leeresProjekt().beschlussVorlagen.length, 'neues Projekt bringt Beschluss-Bausteine mit');
console.log('OK  Beschluss-Textbausteine als eigene Liste vorhanden');

/* Migration darf HTML-Entities nicht erneut escapen und heilt bereits doppelt escapte Bestandsdaten */
assert.strictEqual(k.migriereVerlauf('Text&nbsp;mit Leerraum'), 'Text&nbsp;mit Leerraum',
  'Entity ohne umgebendes Tag gilt als HTML, nicht als Klartext');
assert.strictEqual(k.migriereVerlauf('<p>Alt&amp;nbsp;kaputt</p>'), '<p>Alt&nbsp;kaputt</p>',
  'doppelt escapte Entity wird zurückgedreht');
assert.strictEqual(k.migriereVerlauf(k.migriereVerlauf('<p>Alt&amp;nbsp;kaputt</p>')), '<p>Alt&nbsp;kaputt</p>',
  'die Heilung ist idempotent');
assert.strictEqual(k.migriereVerlauf('Firma A & B beschließt'), '<p>Firma A &amp; B beschließt</p>',
  'echter Klartext wird weiterhin migriert und escapt');
console.log('OK  Verlauf-Migration lässt HTML-Entities in Ruhe');

/* Geplante Anwesenheit reist mit der Tagesordnung ins Protokoll, nur solange dort nichts erfasst ist */
const planung = { id: 's1', nr: '1', tops: [], gaeste: [{ id: 'g1', name: 'Gast' }],
                  teilnahme: { m1: { status: 'entschuldigt', vertretenDurch: 'Ersatzmitglied' } } };
const nutzlast = k.tagesordnungNutzlast(planung);
assert.deepStrictEqual(nutzlast.sitzung.teilnahme, planung.teilnahme, 'die Planung ist Teil der Nutzlast');
assert.strictEqual((nutzlast.sitzung.gaeste || []).map(g => g.name).join(), 'Gast',
  'die geladenen Gäste sind Teil der Nutzlast');

const frisch = { teilnahme: {}, tops: [], gaeste: [] };
const eingespielt = JSON.parse(JSON.stringify(nutzlast.sitzung));
k.tagesordnungEinspielen(frisch, eingespielt);
assert.strictEqual(eingespielt.teilnahme.m1.status, 'entschuldigt', 'leeres Protokoll übernimmt die Planung');
assert.strictEqual(eingespielt.gaeste.length, 1, 'leeres Protokoll übernimmt die geladenen Gäste');

const laufend = { teilnahme: { m1: { status: 'anwesend', vertretenDurch: '' } }, tops: [],
                  gaeste: [{ id: 'g9', name: 'Vor Ort erfasst', tops: [] }] };
const eingespielt2 = JSON.parse(JSON.stringify(nutzlast.sitzung));
k.tagesordnungEinspielen(laufend, eingespielt2);
assert.strictEqual(eingespielt2.teilnahme.m1.status, 'anwesend', 'erfasste Anwesenheit schlägt die Planung');
assert.strictEqual(eingespielt2.gaeste[0].name, 'Vor Ort erfasst', 'erfasste Gäste schlagen die Planung');
const korrigiert = Object.assign({}, laufend, { besetzung: { am: '2026-02-01', groesse: 5, mitglieder: [] } });
const eingespielt3 = Object.assign(JSON.parse(JSON.stringify(nutzlast.sitzung)), { besetzung: { am: '2026-01-01', groesse: 3, mitglieder: [] } });
k.tagesordnungEinspielen(korrigiert, eingespielt3);
assert.strictEqual(eingespielt3.besetzung.groesse, 5, 'eigene Besetzung des Protokolls schlägt die aus der Tagesordnung');
console.log('OK  Geplante Anwesenheit und Gästeliste reisen mit, überschreiben aber nichts Erfasstes');

/* Ergebnisübergabe: Protokoll besitzt den Inhalt, der Sitzungsmanager den Umsetzungsstatus */
{
  const lokal = () => ({ teilnahme: {}, beginnTatsaechlich: '16:00', endeTatsaechlich: '17:00', tops: [
    { id: 't1', beschluesse: [{ id: 'b1', antrag: 'alt', status: 'zugestellt' }, { id: 'b2', antrag: 'weg', status: 'zugestellt' }],
      aufgaben: [{ id: 'a1', was: 'alt', status: 'erledigt' }, { id: 'a2', was: 'weg', status: 'offen' }], unterpunkte: [] },
    { id: 't2', beschluesse: [{ id: 'b3', antrag: 'x', status: 'intern' }], aufgaben: [], unterpunkte: [] }
  ] });
  const datei = () => ({ vollstaendig: true, teilnahme: {}, beginnTatsaechlich: '', endeTatsaechlich: '', punkte: [
    { id: 't1', beschluesse: [{ id: 'b1', antrag: 'neu', status: 'in_arbeit' }, { id: 'b9', antrag: 'frisch', status: 'intern' }],
      aufgaben: [{ id: 'a1', was: 'neu', status: 'offen' }] },
    { id: 't2', beschluesse: [], aufgaben: [] }
  ] });
  const s = lokal();
  const bil = k.ergebnisseEinspielen(s, datei());
  const [b1, b9] = s.tops[0].beschluesse;
  assert.strictEqual(b1.status, 'zugestellt', 'Status aus dem Sitzungsmanager überlebt die erneute Übergabe');
  assert.strictEqual(b1.antrag, 'neu', 'Antrag kommt aus dem Protokoll');
  assert.strictEqual(b9.status, 'intern', 'neuer Beschluss startet mit dem Protokollstatus');
  assert.strictEqual(s.tops[0].aufgaben[0].status, 'erledigt', 'erledigte Aufgabe bleibt erledigt');
  assert.strictEqual(s.tops[0].aufgaben[0].was, 'neu');
  assert.strictEqual(s.tops[1].beschluesse.length, 0, 'geleerter TOP wird mit vollstaendig geleert');
  assert.strictEqual(bil.entfallen.beschluesse.length + '/' + bil.entfallen.aufgaben.length, '2/1', 'entfallene Einträge gezählt');
  assert.strictEqual(bil.entfallen.beschluesse[0].status, 'zugestellt', 'entfallen trägt den Status');
  assert.strictEqual(s.beginnTatsaechlich + s.endeTatsaechlich, '', 'geleerte Zeiten werden übertragen');

  const alt = lokal(), ohneFlag = datei();
  delete ohneFlag.vollstaendig; ohneFlag.punkte.pop();
  k.ergebnisseEinspielen(alt, ohneFlag);
  assert.strictEqual(alt.tops[1].beschluesse.length, 1, 'ältere Datei: nicht gelistete TOPs bleiben unberührt');
  assert.strictEqual(alt.beginnTatsaechlich, '16:00', 'ältere Datei: leere Zeit überschreibt nicht');

  /* Im Protokoll ganz gelöschter TOP fehlt in der vollständigen Datei: Ergebnisse entfallen, der TOP bleibt. */
  const geloescht = lokal(), ohneT2 = datei();
  ohneT2.punkte.pop();
  const bilG = k.ergebnisseEinspielen(geloescht, ohneT2);
  assert.strictEqual(geloescht.tops.length, 2, 'gelöschter TOP bleibt im Sitzungsmanager');
  assert.strictEqual(geloescht.tops[1].beschluesse.length, 0, 'Beschlüsse des gelöschten TOPs entfallen');
  assert.ok(bilG.entfallen.beschluesse.some(b => b.id === 'b3' && b.status === 'intern'), 'entfallen enthält den gepflegten Beschluss des gelöschten TOPs');
  const ohneT2Flag = datei(); ohneT2Flag.punkte.pop(); delete ohneT2Flag.vollstaendig;
  const altG = lokal();
  assert.ok(!k.ergebnisseEinspielen(altG, ohneT2Flag).entfallen.beschluesse.some(b => b.id === 'b3'), 'ältere Datei: fehlender TOP entfällt nicht');

  const prot = lokal(); prot.besetzung = { am: '2026-01-01', groesse: 3, mitglieder: [] };
  const ziel = lokal();
  k.ergebnisseEinspielen(ziel, k.ergebnisNutzlast(prot));
  assert.strictEqual(ziel.besetzung && ziel.besetzung.groesse, 3, 'eingefrorene Besetzung reist mit der Übergabe');
  delete prot.besetzung;
  k.ergebnisseEinspielen(ziel, k.ergebnisNutzlast(prot));
  assert.strictEqual(ziel.besetzung, null, 'wieder geöffnetes Protokoll hebt die Besetzung auch im Manager auf (null = nicht nachtragen)');
  console.log('OK  Ergebnisübergabe: Status bleibt, geleerte Punkte/Zeiten werden übernommen, alte Dateien schonend');
}

/* Kategorien sind optional – neue Punkte starten ohne, gelöschte Kategorien fallen auf „ohne" zurück */
assert.strictEqual(k.neuerTop().kategorie, '', 'neuer TOP startet ohne Kategorie');
assert.strictEqual(k.neuerUnterpunkt().kategorie, '', 'Unterpunkte haben ein eigenes, leeres Kategoriefeld');
assert.strictEqual(k.kategorieOderLeer('beschluss'), 'beschluss');
assert.strictEqual(k.kategorieOderLeer('gibt-es-nicht'), '', 'unbekannte Kategorie gilt als „ohne"');
assert.strictEqual(k.kategorieText({ kategorie: '' }), '', 'ohne Kategorie kein Text');
assert.ok(k.kategorieOptionenHtml().startsWith('<option value="">'), 'die Auswahl beginnt mit „– ohne –"');
console.log('OK  Kategorien optional, auch für Unterpunkte');

/* Nicht an der Abstimmung Beteiligte verkleinern die Stimmbasis des einzelnen Beschlusses */
const gremium = { stammdaten: { gremiumGroesse: '5' },
  personen: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id.toUpperCase(), gruppe: 'br', funktion: 'Mitglied', aktiv: true })) };
const abst = { teilnahme: { a: { status: 'anwesend' }, b: { status: 'anwesend' }, c: { status: 'video' }, d: { status: 'anwesend' } } };
const bs = { ja: '2', nein: '1', enthaltung: '0', ergebnis: 'auto', nichtBeteiligt: {} };
let basis = k.abstimmungsBasis(gremium, abst, bs);
assert.strictEqual(basis.teilnehmend, 4);
assert.ok(!k.beschlussAuswertung(bs, basis.teilnehmend).angenommen, '2 Ja von 4 Teilnehmenden ist keine Mehrheit');
bs.nichtBeteiligt = { d: 'nicht_stimmberechtigt', e: 'abwesend' };   /* e nimmt an der Sitzung gar nicht teil */
basis = k.abstimmungsBasis(gremium, abst, bs);
assert.strictEqual(basis.teilnehmend, 3, 'nur Teilnehmende können von der Abstimmung ausgenommen sein');
assert.ok(k.beschlussAuswertung(bs, basis.teilnehmend).angenommen, '2 Ja von 3 Beteiligten ist die Mehrheit');
assert.ok(basis.beschlussfaehig, '3 von 5 genügen');
assert.strictEqual(k.nichtBeteiligtText(basis), 'D (nicht stimmberechtigt)');
bs.nichtBeteiligt.c = 'abwesend';
basis = k.abstimmungsBasis(gremium, abst, bs);
assert.ok(!basis.beschlussfaehig, '2 von 5 sind für diese Abstimmung zu wenig');
assert.strictEqual(k.nichtBeteiligtText(basis), 'C (abwesend), D (nicht stimmberechtigt)');
assert.deepStrictEqual(roh(k.neuerBeschluss({ sitzungen: [] }, 2026).nichtBeteiligt), {}, 'neue Beschlüsse: alle stimmen ab');
console.log('OK  Stimmbasis je Beschluss ohne nicht beteiligte Mitglieder');

/* Teil-Anwesenheit: wer nur bei einzelnen TOPs da ist, zählt nur für deren Beschlüsse */
const up2 = { id: 'u2', titel: 'Teil', beschluesse: [] };
const teilSitzung = {
  tops: [{ id: 't1', unterpunkte: [] }, { id: 't2', unterpunkte: [up2] }],
  teilnahme: { a: { status: 'anwesend' }, b: { status: 'anwesend' }, d: { status: 'video' },
               c: { status: 'anwesend', tops: ['t2'] } }
};
const ohneAusnahme = { nichtBeteiligt: {} };
assert.strictEqual(k.abstimmungsBasis(gremium, teilSitzung, ohneAusnahme, teilSitzung.tops[0]).teilnehmend, 3,
  'bei TOP 1 zählt das nur für TOP 2 anwesende Mitglied nicht');
assert.strictEqual(k.abstimmungsBasis(gremium, teilSitzung, ohneAusnahme, up2).teilnehmend, 4, 'Unterpunkte zählen zu ihrem TOP');
assert.ok(k.abstimmungsBasis(gremium, teilSitzung, ohneAusnahme, teilSitzung.tops[0]).reduziert);
assert.strictEqual(k.abstimmungsBasis(gremium, teilSitzung, ohneAusnahme).teilnehmend, 4, 'ohne Punkt gilt die ganze Sitzung');
assert.strictEqual(k.teilweiseText(teilSitzung, teilSitzung.teilnahme.c), 'nur TOP 2');
assert.strictEqual(k.teilweiseText(teilSitzung, { status: 'anwesend', tops: [] }), 'bei keinem TOP');
assert.strictEqual(k.teilweiseText(teilSitzung, teilSitzung.teilnahme.a), '', 'ganze Sitzung: kein Vermerk');
console.log('OK  Teil-Anwesenheit zählt nur für die Beschlüsse der gewählten TOPs');

/* Historische Anwesenheit: deaktivierte/gelöschte Mitglieder bleiben, abgeschlossene Sitzungen frieren die Besetzung ein */
{
  const gr = { stammdaten: { gremiumGroesse: '3' }, personen: [
    { id: 'v', name: 'Vera', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true },
    { id: 'm', name: 'Max', gruppe: 'br', funktion: 'Mitglied', aktiv: false },
    { id: 'j', name: 'Jana', gruppe: 'jav', funktion: 'Mitglied', aktiv: true }] };
  const offen = { teilnahme: { m: { status: 'anwesend' }, j: { status: 'anwesend' }, x: { status: 'anwesend' } } };
  assert.deepStrictEqual(roh(k.besetzungVon(gr, offen).map(m => m.name)), ['Vera', 'Max', '(gelöschtes Mitglied)'],
    'deaktiviert mit Status bleibt, gelöschte ID zählt weiter, andere Gremien nicht');
  assert.strictEqual(k.quorumInfo(gr, { teilnahme: { m: { status: 'anwesend' } } }).teilnehmend, 1, 'deaktiviertes Mitglied „anwesend" zählt mit');
  assert.strictEqual(k.quorumInfo(gr, { teilnahme: { m: { status: '' } } }).groesse, 3);
  assert.deepStrictEqual(roh(k.besetzungVon(gr, { teilnahme: {} }).map(m => m.id)), ['v'], 'deaktiviert ohne Status taucht nicht auf');

  const zu = { status: 'abgeschlossen', sitzungsleitung: '', teilnahme: { v: { status: 'anwesend' }, m: { status: 'anwesend' } } };
  k.besetzungEinfrieren(gr, zu);
  assert.strictEqual(zu.besetzung.groesse, 3);
  assert.deepStrictEqual(roh(zu.besetzung.mitglieder.map(m => m.id)), ['v', 'm']);
  gr.stammdaten.gremiumGroesse = '9';
  gr.personen = gr.personen.filter(p => p.id !== 'v');   /* Vorsitzende gelöscht */
  gr.personen.push({ id: 'n', name: 'Neu', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true });
  const q = k.quorumInfo(gr, zu);
  assert.ok(q.groesse === 3 && q.beschlussfaehig, 'spätere Gremiumgröße ändert das Quorum der abgeschlossenen Sitzung nicht');
  assert.deepStrictEqual(roh(k.anwesenheitsDaten(gr, zu).mitglieder.map(m => m.name)), ['Vera (Vorsitzende/r)', 'Max'],
    'gelöschte Person behält Name und Funktion aus dem Schnappschuss');
  assert.strictEqual(k.vorsitzName(gr, zu), 'Vera', 'Vorsitz aus dem Schnappschuss');
  assert.strictEqual(k.sitzungsleitungRolle(gr, zu), 'Vorsitzende/r des Betriebsrats');
  assert.strictEqual(k.vorsitzName(gr), 'Neu', 'ohne Sitzung gilt der heutige Vorsitz');
  assert.ok(roh(k.besetzungVon(gr, { teilnahme: {} }).map(m => m.id)).includes('n'), 'offene Sitzung: neues aktives Mitglied erscheint');
  assert.ok(!k.besetzungVon(gr, zu).some(m => m.id === 'n'), 'abgeschlossene Sitzung: neues Mitglied bleibt draußen');
}
console.log('OK  Historische Anwesenheit/Quorum aus eingefrorener Besetzung');

assert.deepStrictEqual(roh(k.standardUnterpunkteNorm([{ titel: 'A', kategorie: 'beratung' }, 'B']).map(u => [u.titel, u.kategorie])),
  [['A', 'beratung'], ['B', '']], 'Standard-Unterpunkte behalten ihre Kategorie');
console.log('OK  Unterpunkte der Standard-TOPs tragen eine Kategorie');

/* Erscheinungsbild: aus einer Akzentfarbe abgeleitete Varianten, Kontrastregel bleibt gewahrt */
const std = roh(k.akzentPalette(undefined));
assert.deepStrictEqual([std.akzent, std.dunkel, std.hell, std.rand], ['#009057', '#00673E', '#E2F1EA', '#9CCDB7'],
  'ohne Wahl bleibt das Freigabegrün aus DESIGN.md exakt erhalten');
assert.strictEqual(k.akzentPalette('kein-hex').akzent, '#009057', 'ungültige Eingabe fällt auf den Standard zurück');
for (const [hex] of roh(k.AKZENT_VORSCHLAEGE)) {
  const p = roh(k.akzentPalette(hex));
  assert.ok(k.farbKontrast(p.akzent, '#FFFFFF') >= 3, hex + ': Fläche mindestens 3:1 auf Weiß');
  assert.ok(k.farbKontrast(p.dunkel, '#FFFFFF') >= 4.5, hex + ': weiße Schrift auf der dunklen Variante mindestens 4,5:1');
  assert.ok(k.farbKontrast(p.praesDunkel, '#0E1211') >= 6, hex + ': Präsentation dunkel lesbar');
}
const gelb = roh(k.akzentPalette('#ffd400'));
assert.ok(gelb.angepasst && gelb.akzent !== '#FFD400', 'zu helles Gelb wird abgedunkelt');
assert.ok(k.farbKontrast(gelb.akzent, '#FFFFFF') >= 3 && k.farbKontrast(gelb.dunkel, '#FFFFFF') >= 4.5);
assert.ok(!k.akzentPalette('#1F5FAD').angepasst, 'ein ausreichend dunkles Blau bleibt unverändert');
assert.deepStrictEqual(roh(k.erscheinung(undefined)), { akzent: '#009057', name: '', untertitel: '', logoSeitenleiste: false },
  'ältere Stände ohne Erscheinungsbild bekommen die Vorgaben');
const pdfF = k.pdfFarben((r, g, b) => [r, g, b], k.akzentPalette('#1F5FAD'));
assert.deepStrictEqual(roh(pdfF.akzent).map(v => Math.round(v * 255)), [0x1F, 0x5F, 0xAD], 'die PDFs übernehmen die Akzentfarbe');
assert.deepStrictEqual(roh(pdfF.gruen), [0, 0.404, 0.243], '„angenommen" bleibt grün');
console.log('OK  Erscheinungsbild: Akzentfarbe mit abgeleiteten Varianten, Kontrast gewahrt');

/* PDF-Tabelle: eine Zeile, die höher als eine Seite ist, wird zeilenweise auf Folgeseiten fortgesetzt */
{
  const ys = [];
  const font = { widthOfTextAtSize: () => 500 };
  const doc = { addPage() { ys.push([]); const l = ys[ys.length - 1]; return { drawText(_, o) { l.push(o.y); }, drawLine() {}, drawRectangle() {} }; } };
  const farbe = { kopfFuellung: 0, weiss: 0, linie: 0, linieHell: 0, ink: 0, grau: 0 };
  const lang = Array.from({ length: 100 }, (_, i) => 'Zeile' + i).join('\n');
  k['((doc, f, c, cfg) => { const b = new PdfBuilder(doc, { reg: f, fett: f }, c, {}, {}); b.neueSeite(); b.tabelle(cfg); })'](doc, font, farbe,
    { spalten: [{ titel: 'A', anteil: 0.3 }, { titel: 'B', anteil: 0.7 }], zeilen: [['x', lang], ['y', 'kurz']], gitter: true });
  assert.ok(ys.length >= 3, 'sehr lange Zeile verteilt sich auf mehrere Seiten');
  assert.ok(Math.min(...ys.flat()) >= 68, 'nichts wird unter den unteren Seitenrand gezeichnet');
}
console.log('OK  PDF-Tabelle: überhohe Zeile läuft auf Folgeseiten weiter');

/* Termine (Kern): Normalisierung, Fälligkeit, Gelesen-Schlüssel, Kalendertage */
{
const k = kernLaden(undefined, []);
const n = roh(k.terminNormieren([
  { id: 'a', titel: ' Kündigung Müller ', von: '2026-11-10', vorlauf: 3 },
  { id: 'b', titel: '', von: '2026-11-10' },
  { id: 'c', titel: 'Verdreht', von: '2026-11-10', bis: '2026-11-01' },
  { id: 'd', titel: 'Schulung', von: '2026-11-02', bis: '2026-11-06', uhrzeit: '25:99', vorlauf: 5 },
  { id: 'e', titel: 'Ohne', von: '2026-11-03', vorlauf: null }
]));
assert.deepStrictEqual(n.map(t => t.id), ['d', 'e', 'a']);
assert.strictEqual(n[2].titel, 'Kündigung Müller');
assert.strictEqual(n[2].bis, '2026-11-10');
assert.strictEqual(n[0].uhrzeit, '');
assert.strictEqual(n[0].vorlauf, 7);
assert.strictEqual(n[1].vorlauf, null);
const [schulung, ohne, kuendigung] = n;
assert.strictEqual(k.terminErinnerungAb(kuendigung), '2026-11-07');
assert.strictEqual(k.terminErinnerungAb(ohne), null);
assert.strictEqual(k.isoPlusTage('2026-03-01', -1), '2026-02-28');
const e1 = roh(k.erinnerungen(n, '2026-11-06', new Set()));
assert.deepStrictEqual(e1.faellig.map(f => f.termin.id), ['d']);          // mehrtägig, letzter Tag
assert.deepStrictEqual(e1.demnaechst.map(t => t.id), ['a']);              // noch nicht fällig, < 30 Tage
const e2 = roh(k.erinnerungen(n, '2026-11-07', new Set([k.terminGelesenSchluessel(kuendigung)])));
assert.deepStrictEqual(e2.faellig.map(f => [f.termin.id, f.gelesen]), [['a', true]]);
const e3 = roh(k.erinnerungen(n, '2026-11-11', new Set()));
assert.deepStrictEqual(e3.faellig, []);                                    // nach bis verschwunden
const heuteAngelegt = roh(k.terminNormieren([{ id: 'x', titel: 'Frist', von: '2026-11-20', vorlauf: 14 }]));
assert.strictEqual(roh(k.erinnerungen(heuteAngelegt, '2026-11-20', new Set())).faellig.length, 1);
assert.strictEqual(k.terminGelesenSchluessel(kuendigung), 'a|2026-11-10|3');
/* nur echte Kalenderdaten: Monat 13, 30. Februar, fünfstelliges Jahr fallen weg */
assert.deepStrictEqual(roh(k.terminNormieren([
  { id: 'm', titel: 'Monat 13', von: '2026-13-45' },
  { id: 'f', titel: '30. Februar', von: '2026-02-30' },
  { id: 'j', titel: 'Jahr', von: '20261-11-10' },
  { id: 'o', titel: 'Bis kaputt', von: '2026-11-01', bis: '2026-11-31' }
])), []);
const kal = roh(k.urlaubKalender({ urlaub: [], sitzungen: [], termine: n }, '2026-11', '2026-11-01'));
const tag4 = kal.wochen.flat().find(t => t.iso === '2026-11-04');
assert.deepStrictEqual(tag4.termine.map(t => t.id), ['d']);
assert.deepStrictEqual(roh(k.leeresProjekt().termine), []);
console.log('OK  Termine: Normalisierung, Fälligkeit, Gelesen-Schlüssel, Kalendertage');
/* Termine (Kern): Randfälle – 30-Tage-Grenze, bis-Rückfall, Schaltjahr */
{
const k = kernLaden(undefined, []);
const heute = '2026-11-06';
const t = roh(k.terminNormieren([
  { id: 'g30', titel: 'Tag 30', von: k.isoPlusTage(heute, 30), vorlauf: null },
  { id: 'g31', titel: 'Tag 31', von: k.isoPlusTage(heute, 31), vorlauf: null }
]));
assert.deepStrictEqual(roh(k.erinnerungen(t, heute, new Set())).demnaechst.map(x => x.id), ['g30'], 'Tag 30 demnächst, Tag 31 nicht');
const [ohneBis] = roh(k.terminNormieren([{ id: 'o', titel: 'Ohne bis', von: '2026-11-10' }]));
assert.strictEqual(ohneBis.bis, '2026-11-10', 'fehlendes bis → von');
assert.strictEqual(ohneBis.vorlauf, 7, 'fehlender Vorlauf → 7');
assert.deepStrictEqual(roh(k.terminNormieren([
  { id: 'a', titel: 'Schaltjahr', von: '2028-02-29' },
  { id: 'b', titel: 'Kein Schaltjahr', von: '2027-02-29' }
])).map(x => x.id), ['a'], '29.02.2028 gültig, 29.02.2027 nicht');
}
console.log('OK  Termine: 30-Tage-Grenze, bis-Rückfall, Schaltjahr');
}

/* Persistenz (br-app.js): Schreibreihenfolge, Schließen erst nach dem Speichern, Import atomar. IndexedDB ist durch einen Speicher-Stub ersetzt. */
async function pruefePersistenz() {
  const ctx = vm.createContext({
    window: {}, crypto: require('crypto').webcrypto, console: { log() {}, warn() {} },
    setTimeout, clearTimeout, TextEncoder, TextDecoder, btoa, atob
  });
  vm.runInContext(['br-kern.js', 'br-app.js'].map(f => fs.readFileSync(path.join(hier, f), 'utf8')).join('\n'), ctx, { filename: 'kern+app.js' });
  const run = code => vm.runInContext(code, ctx);
  run(`
    var toasts = [], schreibLog = [], laufend = 0, maxLaufend = 0, fehlerBeim = null, warte = null, ersetzt = null;
    setAutosaveInfo = () => {}; aktualisiereSicherungInfo = () => {}; sitzungsstandAuffrischen = () => {};
    zeigeToast = (t, art) => toasts.push(art || ''); zeigeSperrschirm = () => {};
    aktualisiereRollenUi = () => {}; renderAlles = () => {};
    var schreib = async was => {
      laufend++; maxLaufend = Math.max(maxLaufend, laufend);
      try {
        if (warte) await warte();
        if (fehlerBeim === was) throw new Error('Schreibfehler');
        schreibLog.push(was);
      } finally { laufend--; }
    };
    Speicher.metaSetzen = () => schreib('meta');
    Speicher.sitzungSetzen = rec => schreib('sitzung:' + rec.id);
    Speicher.allesErsetzen = async (m, s, d) => { if (fehlerBeim === 'ersetzen') throw new Error('Quota'); ersetzt = { m: m.length, s: s.length, d: d.length }; };
    sitzungsRolle = 'arbeit';
    daten = leeresProjekt(); daten.sitzungen = [{ id: 's1', tops: [] }]; ui.sitzungId = 's1';
  `);
  await run(`Krypto.zufallsMk().then(mk => { sitzungsSchluessel = mk.key; })`);

  /* Autospeichern: Änderung während des Schreibens bleibt markiert; Läufe überlappen nicht */
  const e5 = await run(`(async () => {
    warte = () => new Promise(r => setTimeout(r, 20));
    dirtyMeta = true; dirtySitzungen.add('s1');
    const p1 = flushSpeicher();
    await new Promise(r => setTimeout(r, 30));          /* Meta wird gerade geschrieben … */
    dirtyMeta = true; dirtySitzungen.add('s1');          /* … da kommt eine neue Änderung */
    const p2 = flushSpeicher();
    await p1; const nachErstem = dirtyMeta;
    await p2;
    return JSON.stringify({ nachErstem, maxLaufend, restMeta: dirtyMeta, rest: dirtySitzungen.size });
  })()`).then(JSON.parse);
  assert.strictEqual(e5.nachErstem, true, 'Änderung während des Schreibens bleibt markiert');
  assert.strictEqual(e5.maxLaufend, 1, 'zwei Speicherläufe schreiben nie gleichzeitig');
  assert.ok(!e5.restMeta && e5.rest === 0, 'der zweite Lauf schreibt die Nachzügler');
  run(`warte = null; fehlerBeim = 'sitzung:s1'; dirtySitzungen.add('s1');`);
  assert.strictEqual(await run('flushSpeicher()'), false, 'Schreibfehler wird gemeldet');
  assert.ok(run(`dirtySitzungen.has('s1')`), 'nach Schreibfehler bleibt die Sitzung markiert');
  console.log('OK  Autospeichern: keine verlorenen Markierungen, Läufe nacheinander');

  /* Datei schließen: wartet aufs Speichern; scheitert es, bleibt die Datei offen */
  await run('sperren()');
  assert.ok(run('sitzungsSchluessel !== null') && run(`toasts.pop() === 'fehler'`), 'Speicherfehler: Datei bleibt offen, Fehlermeldung');
  run(`fehlerBeim = null; warte = () => new Promise(r => setTimeout(r, 20)); schreibLog.length = 0;`);
  await run('sperren()');
  assert.ok(run(`schreibLog.includes('sitzung:s1')`), 'die Änderung wurde vor dem Schließen geschrieben');
  assert.strictEqual(run('sitzungsSchluessel'), null, 'danach ist der Schlüssel weg');
  console.log('OK  Datei schließen: erst speichern, dann Schlüssel verwerfen');

  /* Import: erst alles verschlüsseln und schreiben, dann umschalten */
  await run(`Krypto.zufallsMk().then(mk => { sitzungsSchluessel = mk.key; sitzungsRolle = 'arbeit'; warte = null; })`);
  const projekt = inhalte => JSON.stringify({ app: 'br-sitzungsmanager', sitzungen: [{ id: 'neu1' }, { id: 'neu2' }], dokumentInhalte: inhalte });
  await run(`projektUebernehmen(${projekt({ d1: '%%kaputt%%' })})`);
  assert.ok(run(`ersetzt === null && daten.sitzungen[0].id === 's1' && toasts.pop() === 'fehler'`), 'kaputte Anlage: nichts geschrieben, alter Stand bleibt');
  run(`fehlerBeim = 'ersetzen';`);
  await run(`projektUebernehmen(${projekt({ d1: 'AAEC' })})`);
  assert.ok(run(`daten.sitzungen[0].id === 's1' && toasts.pop() === 'fehler'`), 'Schreibfehler: alter Stand bleibt');
  run(`fehlerBeim = null;`);
  await run(`projektUebernehmen(${projekt({ d1: 'AAEC' })})`);
  assert.deepStrictEqual(roh(run('ersetzt')), { m: 12, s: 2, d: 1 }, 'alles in einem Schritt ersetzt');
  assert.ok(run(`daten.sitzungen.length === 2 && toasts.pop() === 'erfolg'`), 'danach gilt der neue Stand');
  console.log('OK  Import: erst alles verschlüsseln und schreiben, dann umschalten');
}

pruefePersistenz().then(() => console.log('\nAlle Prüfungen bestanden.'), e => { console.error(e); process.exit(1); });
