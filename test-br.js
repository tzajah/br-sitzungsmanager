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
console.log('OK  Geplante Anwesenheit und Gästeliste reisen mit, überschreiben aber nichts Erfasstes');

console.log('\nAlle Prüfungen bestanden.');
