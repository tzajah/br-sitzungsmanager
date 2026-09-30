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

console.log('\nAlle Prüfungen bestanden.');
