'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const DATEI = n => 'file:///' + path.join(__dirname, n).replace(/\\/g, '/');

const AUFBAU = `
  sitzungsRolle = 'arbeit';                     /* darfBearbeiten() → true, speichern() bleibt wirkungslos */
  daten = leeresProjekt();
  daten.personen = [
    { id: 'm1', name: 'Erika Mustermann', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true, email: '' },
    { id: 'm2', name: 'Max Mustermann',   gruppe: 'br', funktion: 'Mitglied',      aktiv: true, email: '' },
    { id: 'm3', name: 'Nie Verreist',     gruppe: 'br', funktion: 'Mitglied',      aktiv: true, email: '' }
  ];
  const s = neueSitzung(daten);
  s.datum = '2026-08-12';
  s.tops = [neuerTop({ titel: 'Testpunkt' })];
  daten.sitzungen = [s];
  ui.sitzungId = s.id;
  kategorienAnwenden();
`;

async function pruefe(datei, erwarteterModus) {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  /* Nachbardateien, die fehlen dürfen – alles andere ist ein echter Ladefehler.
     br-zugang.js liegt nur auf dem geschützten Laufwerk; ohne sie steht der Sperrschirm „gesperrt". */
  const OPTIONAL = ['Gremium', 'urlaub.js', 'br-zugang.js'];
  const fehler = [];
  let fehlendOptional = 0;
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  seite.on('requestfailed', r => {
    const name = r.url().split('/').pop();
    if (OPTIONAL.includes(name)) { fehlendOptional++; return; }
    fehler.push('request: ' + name);
  });
  seite.on('console', m => {
    if (m.type() !== 'error') return;
    if (fehlendOptional && /ERR_FILE_NOT_FOUND/.test(m.text())) { fehlendOptional--; return; }
    fehler.push('console: ' + m.text());
  });

  await seite.goto(DATEI(datei));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });

  assert.deepStrictEqual(fehler, [], datei + ': keine Ladefehler');
  assert.strictEqual(await seite.evaluate('APP_MODUS'), erwarteterModus, datei + ': Betriebsart');
  assert.ok(await seite.evaluate('!!document.querySelector(".sperrschirm")'), datei + ': Sperrschirm steht');
  assert.ok(await seite.evaluate('typeof erzeugeProtokollPdf === "function" && typeof renderTabTagesordnung === "function"'),
    datei + ': Funktionen aus allen fünf Modulen sind im gemeinsamen Scope');
  /* urlaub.js ist laut README optional und darf window.BR_URLAUB offen lassen. */
  assert.ok(await seite.evaluate('Array.isArray(window.BR_BESCHLUSS_VORLAGEN)'),
    datei + ': beschluss_vorlagen.js geladen');

  await seite.evaluate(AUFBAU);

  const reiter = await seite.evaluate(`
    (() => {
      const c = document.getElementById('hauptInhalt');
      renderHaupt();
      return Array.from(c.querySelectorAll('.tabs button')).map(b => b.dataset.tab);
    })()
  `);
  /* Die Tagesordnung führen beide Seiten, „Sitzung" bleibt bei der Sitzungsleitung */
  const erwartet = erwarteterModus === 'protokoll'
    ? ['tagesordnung', 'protokoll', 'export']
    : ['sitzung', 'tagesordnung', 'einladung', 'export'];
  assert.deepStrictEqual(reiter, erwartet, datei + ': Reiter');

  const exporte = await seite.evaluate(`
    (() => {
      const c = document.createElement('div');
      renderTabExport(c, daten.sitzungen[0]);
      return {
        karten: Array.from(c.querySelectorAll('[data-export]')).map(b => b.dataset.export),
        praesentation: !!c.querySelector('#exPraesentation'),
        protokollMail: !!c.querySelector('#exProtokollFertig')
      };
    })()
  `);
  if (erwarteterModus === 'protokoll') {
    assert.deepStrictEqual(exporte.karten.sort(), ['anwesenheit', 'protokoll', 'protokoll-gekuerzt']);
    assert.ok(!exporte.praesentation && exporte.protokollMail, datei + ': nur Protokoll-Mail');
  } else {
    assert.deepStrictEqual(exporte.karten.sort(), ['anwesenheit', 'einladung']);
    assert.ok(exporte.praesentation && !exporte.protokollMail, datei + ': nur Präsentation/Einladung');
  }

  if (erwarteterModus === 'sitzung') {
    const plan = await seite.evaluate(`
      (() => {
        const c = document.createElement('div');
        renderTabEinladung(c, daten.sitzungen[0]);
        const sel = c.querySelector('#tnPlan tr[data-mid] [data-f="status"]');
        sel.value = 'anwesend'; sel.onchange();
        const mid = sel.closest('tr').dataset.mid;
        ui.tab = 'einladung'; renderHaupt();
        const kopf = document.getElementById('quorumKopf');
        c.querySelector('#gastPlan [data-gast="neu"]').onclick();
        return { zeilen: c.querySelectorAll('#tnPlan tr[data-mid]').length,
                 gespeichert: (daten.sitzungen[0].teilnahme[mid] || {}).status,
                 gaeste: (daten.sitzungen[0].gaeste || []).length,
                 gastStamm: !!c.querySelector('#gastPlan [data-gast="stamm"]'),
                 gastZeilen: c.querySelectorAll('#gastPlan [data-gi]').length,
                 zahlen: c.querySelector('#quorumPlan').textContent,
                 kopfSchild: kopf ? kopf.textContent : '',
                 kopfTitel: kopf && kopf.firstElementChild ? (kopf.firstElementChild.title || '') : '',
                 kopfKlasse: kopf && kopf.firstElementChild ? kopf.firstElementChild.className : '' };
      })()
    `);
    assert.strictEqual(plan.zeilen, 3, datei + ': je Mitglied eine Planungszeile');
    assert.strictEqual(plan.gespeichert, 'anwesend', datei + ': die Planung landet in s.teilnahme');
    assert.strictEqual(plan.gaeste, 1, datei + ': Gäste lassen sich im Reiter „Einladung" erfassen');
    assert.strictEqual(plan.gastZeilen, 1, datei + ': und stehen sofort als Zeile da');
    assert.ok(plan.gastStamm, datei + ': SBV/JAV aus den Stammdaten sind übernehmbar');
    assert.ok(plan.zahlen.includes('teilnehmend'), datei + ': die Tafel führt die Zusammensetzung in Zahlen');
    assert.ok(plan.kopfSchild.includes('beschlussfähig'), datei + ': das Freigabeschild steht im Sitzungskopf');
    assert.ok(plan.kopfTitel.includes('Voraussichtlich'), datei + ': mit der vollständigen Aussage als Titel');
    assert.ok(/quorum/.test(plan.kopfKlasse), datei + ': und trägt die Schild-Auszeichnung');
  }

  const anlegenSichtbar = await seite.evaluate(`
    (() => { aktualisiereRollenUi(); return document.getElementById('btnNeueSitzung').style.display !== 'none'; })()
  `);
  assert.strictEqual(anlegenSichtbar, erwarteterModus === 'sitzung', datei + ': "+ Neue Sitzung"-Knopf');

  await browser.close();
  console.log('OK  ' + datei + ' lädt fehlerfrei als „' + erwarteterModus + '"');
}

/* Urlaubskalender und Beschluss-Bausteine am echten DOM */
async function pruefeFeatures() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Protokoll.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);

  await seite.evaluate(`
    daten.urlaub = [
      { id: 'u1', name: 'Erika Mustermann', von: '2026-08-10', bis: '2026-08-28', grund: 'Urlaub' },
      { id: 'u2', name: 'Max Mustermann', von: '2026-09-07', bis: '2026-09-11', grund: 'Fortbildung' }
    ];
  `);

  const warnung = await seite.evaluate(`urlaubHinweisHtml('2026-08-12')`);
  assert.ok(warnung.includes('Erika Mustermann'), 'Urlaubswarnung nennt die abwesende Person');
  assert.ok(warnung.includes('Ersatzmitglieder'), 'Urlaubswarnung weist auf Ersatzmitglieder hin');
  assert.strictEqual(await seite.evaluate(`urlaubHinweisHtml('2026-08-05')`), '', 'ohne Abwesende keine Warnung');
  assert.strictEqual(await seite.evaluate(`urlaubHinweisHtml('')`), '', 'ohne Datum keine Warnung');

  const teilnahme = await seite.evaluate(`
    (() => {
      const s = daten.sitzungen[0];
      const c = document.createElement('div');
      document.body.appendChild(c);
      renderTabProtokoll(c, s);
      const zeile = c.querySelector('tr[data-mid="m1"]');
      return {
        m1: (s.teilnahme.m1 || {}).status,
        m3: (s.teilnahme.m3 || {}).status,
        auswahl: zeile.querySelector('[data-f="status"]').value,
        zeileZeigtUrlaub: zeile.textContent.includes('Urlaub'),
        hinweis: (c.querySelector('#tnBereich .hinweis') || {}).textContent || ''
      };
    })()
  `);
  assert.strictEqual(teilnahme.m1, 'entschuldigt', 'abwesendes Mitglied wird vorbelegt');
  assert.strictEqual(teilnahme.auswahl, 'entschuldigt', 'die Vorbelegung steht auch im Auswahlfeld');
  assert.ok(!teilnahme.m3, 'anwesendes Mitglied bleibt unangetastet');
  assert.ok(teilnahme.zeileZeigtUrlaub, 'die Zeile weist den Urlaub aus');
  assert.ok(teilnahme.hinweis.includes('Urlaubskalender'), 'Hinweisblock über der Tabelle');

  /* Vorbelegung überschreibt keine bereits erfasste Angabe */
  const behalten = await seite.evaluate(`
    (() => {
      const s = daten.sitzungen[0];
      s.teilnahme.m1.status = 'anwesend';
      const c = document.createElement('div');
      document.body.appendChild(c);
      renderTabProtokoll(c, s);
      return s.teilnahme.m1.status;
    })()
  `);
  assert.strictEqual(behalten, 'anwesend', 'erfasste Anwesenheit wird nicht überschrieben');

  const baustein = await seite.evaluate(`
    (() => {
      const s = daten.sitzungen[0];
      const top = s.tops[0];
      const b = neuerBeschluss(daten, 2026);
      top.beschluesse = [b];
      const c = document.createElement('div');
      document.body.appendChild(c);
      c.appendChild(beschlussBlock(s, top, b, 0, () => {}, []));
      const btn = c.querySelector('[data-tu="baustein"]');
      btn.click();
      const dlg = document.getElementById('dlgVorlagen');
      const optionen = Array.from(dlg.querySelectorAll('.vorlage-option .vo-titel')).map(e => e.textContent);
      const feld = c.querySelector('[data-f="antrag"]');
      feld.value = 'Vorbemerkung.';
      dlg.querySelectorAll('.vorlage-option')[0].click();
      return {
        knopf: !!btn,
        kopf: dlg.querySelector('.dlg-kopf h3').textContent,
        optionen: optionen,
        wortlaut: feld.value,
        gespeichert: b.antrag
      };
    })()
  `);
  assert.ok(baustein.knopf, 'Beschluss hat einen Textbaustein-Knopf');
  assert.ok(baustein.kopf.includes('Beschluss'), 'eigener Dialogtitel für Beschlusstexte');
  assert.ok(baustein.optionen.length >= 5, 'Beschluss-Bausteine stehen zur Auswahl');
  assert.ok(baustein.optionen.includes('Zustimmung § 99 BetrVG'), 'Liste stammt aus beschluss_vorlagen.js');
  assert.ok(!baustein.optionen.includes('Kenntnisnahme'), 'nicht die Protokoll-Bausteine');
  assert.strictEqual(baustein.wortlaut, 'Vorbemerkung.\nDer Betriebsrat stimmt der personellen Maßnahme gemäß § 99 Abs. 1 BetrVG zu.',
    'Baustein wird mit Zeilenumbruch angehängt');
  assert.strictEqual(baustein.gespeichert, baustein.wortlaut, 'das input-Event schreibt in den Beschluss zurück');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Urlaubs-Vorbelegung und Beschluss-Textbausteine wirken im DOM');
}

/* Rückwärtskompatibilität: alte Sicherungsstände durch migriere() */
async function pruefeAltbestand() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Protokoll.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate('daten = leeresProjekt(); kategorienAnwenden();');

  /* (a) Klartext-Stand: mitglieder[] statt personen[], keine Kategorien/Bausteine, Verlauf als Klartext */
  const alt = await seite.evaluate(`
    (() => {
      const d = migriere({
        app: 'br-sitzungsmanager', version: 1,
        stammdaten: { gremium: 'Betriebsrat', firma: 'Alt GmbH' },
        mitglieder: [{ id: 'a1', name: 'Alt Mitglied', funktion: 'Vorsitzende/r' }],
        sitzungen: [{
          id: 's1', nr: '01/2020', datum: '2020-05-04',
          tops: [{ id: 't1', titel: 'Alter TOP', kategorie: 'beratung',
                   verlauf: 'Erster Absatz.\\n\\nZweiter Absatz.',
                   beschluesse: [{ id: 'b1', jahr: 2020, lfd: 1, antrag: 'Alt-Beschluss' }] }]
        }]
      });
      const top = d.sitzungen[0].tops[0];
      return {
        personen: d.personen.map(p => ({ name: p.name, gruppe: p.gruppe, aktiv: p.aktiv })),
        hatMitgliederFeld: 'mitglieder' in d,
        kategorien: d.kategorien.length,
        standardTops: d.standardTops.length,
        protokollVorlagen: d.protokollVorlagen.length,
        beschlussVorlagen: d.beschlussVorlagen.length,
        beschlussTags: d.beschlussTags.length,
        verlauf: top.verlauf,
        unterpunkte: Array.isArray(top.unterpunkte),
        anlagen: Array.isArray(top.anlagen),
        beschlussStatus: top.beschluesse[0].status,
        beschlussTagsArr: Array.isArray(top.beschluesse[0].tags),
        teilnahme: typeof d.sitzungen[0].teilnahme,
        gaeste: Array.isArray(d.sitzungen[0].gaeste),
        exportOptionen: d.exportOptionen.anwesenheitsLeerzeilen,
        revision: d.revision, aenderungsstand: d.aenderungsstand
      };
    })()
  `);
  assert.deepStrictEqual(alt.personen, [{ name: 'Alt Mitglied', gruppe: 'br', aktiv: true }], 'mitglieder[] → personen[]');
  assert.ok(!alt.hatMitgliederFeld, 'Alt-Feld wird entfernt');
  assert.ok(alt.kategorien >= 5 && alt.standardTops >= 4, 'Kategorien und Standard-TOPs werden ergänzt');
  assert.ok(alt.protokollVorlagen >= 5, 'Protokoll-Bausteine werden ergänzt');
  assert.ok(alt.beschlussVorlagen >= 5, 'NEU: Beschluss-Bausteine werden ergänzt statt undefined zu bleiben');
  assert.strictEqual(alt.beschlussTags, 0);
  assert.strictEqual(alt.verlauf, '<p>Erster Absatz.</p><p>Zweiter Absatz.</p>', 'Klartext-Verlauf wird zu HTML');
  assert.ok(alt.unterpunkte && alt.anlagen && alt.gaeste, 'fehlende Listen werden angelegt');
  assert.strictEqual(alt.beschlussStatus, 'in_arbeit');
  assert.ok(alt.beschlussTagsArr);
  assert.strictEqual(alt.teilnahme, 'object');
  assert.strictEqual(alt.exportOptionen, false);
  assert.strictEqual(alt.revision, 0);
  assert.strictEqual(alt.aenderungsstand, 0);

  /* (b) Sicherung 0.19-0.25: keine Kategorien/Beschluss-Bausteine – der Fix sichert sie ab sofort mit */
  const v25 = await seite.evaluate(`
    (() => {
      const d = migriere({
        app: 'br-sitzungsmanager', version: 1, revision: 7,
        stammdaten: { gremium: 'Betriebsrat', gremiumGroesse: 9 },
        personen: [{ id: 'p1', name: 'Erika Mustermann', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true }],
        standardTops: [{ id: 'st1', titel: 'Begrüßung', kategorie: 'formalia' }],
        protokollVorlagen: [{ id: 'v1', titel: 'Kenntnisnahme', text: 'Zur Kenntnis genommen.' }],
        beschlussTags: [{ id: 'tg1', name: 'Personal', farbe: '#0E6B57' }],
        exportOptionen: { anwesenheitsLeerzeilen: true },
        sitzungen: [{ id: 's1', nr: '03/2026', datum: '2026-08-12',
          teilnahme: { p1: { status: 'anwesend', vertretenDurch: '' } },
          tops: [{ id: 't1', titel: 'TOP', kategorie: 'beschluss', verlauf: '<p>Schon HTML.</p>',
                   beschluesse: [{ id: 'b1', jahr: 2026, lfd: 3, antrag: 'X', status: 'zugestellt', tags: ['tg1'] }] }] }]
      });
      return {
        beschlussVorlagen: d.beschlussVorlagen.length,
        protokollVorlagenErhalten: d.protokollVorlagen.map(v => v.titel),
        standardTopsErhalten: d.standardTops.map(t => t.titel),
        tagsErhalten: d.beschlussTags.map(t => t.name),
        kategorien: d.kategorien.map(k => k.key),
        verlauf: d.sitzungen[0].tops[0].verlauf,
        beschluss: d.sitzungen[0].tops[0].beschluesse[0],
        teilnahme: d.sitzungen[0].teilnahme.p1.status,
        exportOptionen: d.exportOptionen.anwesenheitsLeerzeilen,
        revision: d.revision
      };
    })()
  `);
  assert.ok(v25.beschlussVorlagen >= 5, 'Beschluss-Bausteine werden nachgerüstet');
  assert.deepStrictEqual(v25.protokollVorlagenErhalten, ['Kenntnisnahme'], 'vorhandene Bausteine bleiben unverändert');
  assert.deepStrictEqual(v25.standardTopsErhalten, ['Begrüßung'], 'Standard-TOPs bleiben');
  assert.deepStrictEqual(v25.tagsErhalten, ['Personal'], 'Tags bleiben');
  assert.ok(v25.kategorien.includes('formalia') && v25.kategorien.includes('beschluss'),
    'ohne mitgesicherte Kategorien greifen die Auslieferungs-Kategorien – die alten TOP-Schlüssel passen weiter');
  assert.strictEqual(v25.verlauf, '<p>Schon HTML.</p>', 'HTML-Verlauf wird nicht erneut migriert');
  assert.strictEqual(v25.beschluss.status, 'zugestellt', 'Beschlussstatus bleibt');
  assert.deepStrictEqual(v25.beschluss.tags, ['tg1'], 'Tag-Zuordnung bleibt');
  assert.strictEqual(v25.teilnahme, 'anwesend', 'erfasste Anwesenheit bleibt');
  assert.strictEqual(v25.exportOptionen, true, 'Exportoption bleibt');
  assert.strictEqual(v25.revision, 7, 'Revisionsnummer bleibt');

  /* (c) IndexedDB-Altbestand: allesLaden() reicht undefined durch, migriere muss das auffangen */
  const ausDb = await seite.evaluate(`
    migriere({ app: 'br-sitzungsmanager', version: 1, stammdaten: undefined, personen: undefined,
               standardTops: undefined, kategorien: undefined, protokollVorlagen: undefined,
               beschlussVorlagen: undefined, beschlussTags: undefined, sitzungen: [],
               exportOptionen: undefined }).beschlussVorlagen.length
  `);
  assert.ok(ausDb >= 5, 'alte IndexedDB-Ablage ohne den neuen Meta-Satz läuft in die Auslieferungsliste');

  /* (d) Neue Sicherung enthält Kategorien und Beschluss-Bausteine (der behobene Verlust) */
  const neueFelder = await seite.evaluate(`
    (() => {
      daten = migriere({ app: 'br-sitzungsmanager', version: 1, sitzungen: [] });
      daten.kategorien.push({ id: 'k9', key: 'eigen', label: 'Eigene Kategorie' });
      const gesamt = {
        standardTops: daten.standardTops, kategorien: daten.kategorien,
        protokollVorlagen: daten.protokollVorlagen, beschlussVorlagen: daten.beschlussVorlagen
      };
      const zurueck = migriere(Object.assign({ app: 'br-sitzungsmanager', version: 1, sitzungen: [] }, gesamt));
      return zurueck.kategorien.map(k => k.key);
    })()
  `);
  assert.ok(neueFelder.includes('eigen'), 'eigene Kategorien überleben jetzt den Weg durch die Sicherung');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Alte Sicherungen (Klartext, enc-v2 ohne Kategorien) migrieren verlustfrei');
}

/* Getrennte Speicherstände und die Sitzungs-Übergabe */
async function pruefeUebergabe() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const fehler = [];

  const oeffne = async datei => {
    const p = await ctx.newPage();
    p.on('pageerror', e => fehler.push(datei + ': ' + e.message));
    await p.goto(DATEI(datei));
    await p.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
    return p;
  };

  const sm = await oeffne('BR-Sitzungsmanager.html');
  const pm = await oeffne('BR-Protokoll.html');
  const dbSm = await sm.evaluate('DB_NAME');
  const dbPm = await pm.evaluate('DB_NAME');
  assert.strictEqual(dbSm, 'br-sitzungsmanager', 'der Sitzungsmanager behält den bisherigen Namen (Altbestand bleibt erreichbar)');
  assert.notStrictEqual(dbPm, dbSm, 'das Protokollmodul hat eine eigene Ablage');
  assert.strictEqual(await sm.evaluate('location.origin'), await pm.evaluate('location.origin'),
    'gleicher Ursprung – die Trennung kommt allein über DB_NAME');

  assert.ok(await sm.evaluate('modusHatReiter("tagesordnung")'), 'Sitzungsmanager führt die Tagesordnung');
  assert.ok(await pm.evaluate('modusHatReiter("tagesordnung")'), 'Protokollmodul führt die Tagesordnung ebenfalls');
  assert.strictEqual(await pm.evaluate('modusStartReiter()'), 'protokoll', 'startet aber im Protokoll');
  assert.strictEqual(await sm.evaluate('modusStartReiter()'), 'sitzung');

  for (const a of ['beschluesse', 'aufgaben', 'dokumente', 'stammdaten']) {
    assert.ok(await sm.evaluate(`modusHatAnsicht('${a}')`), 'Manager führt ' + a);
    assert.ok(!(await pm.evaluate(`modusHatAnsicht('${a}')`)), 'Protokollmodul führt ' + a + ' nicht');
  }
  const navSichtbar = async (p, id) => p.evaluate(
    `(() => { sitzungsRolle = 'admin'; aktualisiereRollenUi(); return document.getElementById('${id}').style.display !== 'none'; })()`);
  for (const id of ['btnBeschluesse', 'btnAufgaben', 'btnDokumente', 'btnStammdaten']) {
    assert.ok(await navSichtbar(sm, id), 'Manager zeigt ' + id);
    assert.ok(!(await navSichtbar(pm, id)), 'Protokollmodul blendet ' + id + ' aus');
  }
  const gesperrt = await pm.evaluate(`
    (async () => {
      ${AUFBAU}
      sitzungsRolle = 'admin';
      verkabeln();                                  /* die Knopf-Handler hängen sonst noch nicht */
      const raus = []; const echt = window.zeigeToast; zeigeToast = t => raus.push(t);
      oeffneStammdaten();
      const dlgOffen = document.getElementById('dlgStammdaten').open;
      document.getElementById('btnDokumente').click();
      ui.ansicht = 'dokumente'; renderHaupt();
      const nachRender = ui.ansicht;
      zeigeToast = echt;
      return { meldungen: raus, dlgOffen: dlgOffen, nachRender: nachRender };
    })()
  `);
  assert.ok(!gesperrt.dlgOffen, 'das Admin-Menü öffnet im Protokollmodul nicht');
  assert.ok(gesperrt.meldungen[0].includes('BR-Sitzungsmanager'), 'mit Verweis auf den Manager');
  assert.ok(gesperrt.meldungen[1].includes('Anlagen-Dateien liegen'), 'Dokumente-Knopf verweist auf den Manager');
  assert.strictEqual(gesperrt.nachRender, 'sitzung', 'eine geerbte Dokumenten-Ansicht wird abgefangen');
  const exportKnopf = await pm.evaluate(`
    (() => { const c = document.createElement('div'); renderTabExport(c, daten.sitzungen[0]); return !!c.querySelector('#exDokordner'); })()
  `);
  assert.ok(!exportKnopf, 'kein „Dokumente dieser Sitzung öffnen" im Protokollmodul');

  await sm.evaluate(AUFBAU);
  const to = await sm.evaluate(`
    (() => {
      const s = daten.sitzungen[0];
      s.ort = 'Raum 2.14';
      const t = s.tops[0];
      t.id = 'tp';
      t.titel = 'Geplanter TOP'; t.beschreibung = 'Von der Sitzungsleitung vorbereitet.';
      t.referent = 'Erika'; t.dauer = '20';
      t.anlagen = [{ id: 'a1', name: 'Beschlussvorlage.pdf', mime: 'application/pdf', groesse: 4096, dokumentId: 'dok1', dataUrl: 'data:...RIESIG...' }];
      t.unterpunkte = [{ id: 'u1', titel: 'Unterpunkt', beschreibung: 'dazu', anlagen: [], verlauf: '', beschluesse: [], aufgaben: [] }];
      /* Planungsseitig darf Protokollinhalt vorhanden sein – er darf NICHT mitreisen. */
      t.verlauf = '<p>Alter Verlauf im Manager.</p>';
      t.beschluesse = [{ id: 'bx', jahr: 2026, lfd: 9, antrag: 'Darf nicht mitreisen' }];
      t.aufgaben = [{ id: 'ax', was: 'auch nicht', wer: '', bis: '', status: 'offen' }];
      s.teilnahme = { m1: { status: 'anwesend', vertretenDurch: '' } };
      s.gaeste = [{ id: 'gp', name: 'Geladene SBV', typ: 'sbv', funktion: '', tops: [] }];
      s.anlagenProt = [{ id: 'ap', name: 'Scan.pdf' }];
      const n = tagesordnungNutzlast(s);
      return {
        nutzlast: n,
        top: n.sitzung.tops[0],
        felder: Object.keys(n.sitzung).sort()
      };
    })()
  `);
  assert.strictEqual(to.top.titel, 'Geplanter TOP');
  assert.strictEqual(to.top.beschreibung, 'Von der Sitzungsleitung vorbereitet.', 'Erläuterung reist mit');
  assert.strictEqual(to.top.referent, 'Erika');
  assert.strictEqual(to.top.dauer, '20');
  assert.strictEqual(to.top.unterpunkte.length, 1, 'Unterpunkte reisen mit');
  assert.strictEqual(to.top.verlauf, undefined, 'Verlauf bleibt beim Protokoll');
  assert.strictEqual(to.top.beschluesse, undefined, 'Beschlüsse bleiben beim Protokoll');
  assert.strictEqual(to.top.aufgaben, undefined, 'Aufgaben bleiben beim Protokoll');
  assert.deepStrictEqual(to.top.anlagen, [{ id: 'a1', name: 'Beschlussvorlage.pdf', mime: 'application/pdf', groesse: 4096, dokumentId: 'dok1' }],
    'nur der Name/Verweis der Anlage, keine Datei (dataUrl entfernt)');
  assert.ok(!to.felder.includes('anlagenProt'), 'Protokoll-Anlagen gehören dem Protokollmodul');
  assert.strictEqual((to.nutzlast.sitzung.teilnahme.m1 || {}).status, 'anwesend',
    'die im Reiter „Einladung" geplante Anwesenheit reist dagegen mit');
  assert.strictEqual((to.nutzlast.sitzung.gaeste[0] || {}).name, 'Geladene SBV',
    'die im Reiter „Einladung" geladenen Gäste reisen ebenfalls mit');
  assert.ok(to.felder.includes('datum') && to.felder.includes('ort') && to.felder.includes('nr'),
    'Rahmendaten reisen mit – sie stehen im Protokollkopf');
  assert.ok(!JSON.stringify(to.nutzlast).includes('RIESIG'), 'keine Anlagen-Bytes in der Datei');

  const uebernommen = await pm.evaluate(`
    (async () => {
      ${AUFBAU}
      const eigene = neueSitzung(daten);
      eigene.id = 'bleibt'; eigene.nr = '99/2026';
      daten.sitzungen.push(eigene);
      const vorher = daten.sitzungen.length;

      const da = neueSitzung(daten);
      da.id = 'S-ID'; da.nr = '04/2026';
      da.teilnahme = { m1: { status: 'anwesend', vertretenDurch: '' } };
      da.gaeste = [{ id: 'g1', name: 'Arbeitgeber', tops: [] }];
      da.tops = [
        { id: 'tp', titel: 'Alter Titel', verlauf: '<p>Schon protokolliert.</p>',
          beschluesse: [{ id: 'b1', jahr: 2026, lfd: 1, antrag: 'Bestehender Beschluss' }],
          aufgaben: [], anlagen: [], unterpunkte: [] },
        { id: 'weg', titel: 'Gestrichener TOP', verlauf: '<p>Text dazu.</p>',
          beschluesse: [], aufgaben: [], anlagen: [], unterpunkte: [] }
      ];
      daten.sitzungen.push(da);

      let schreibvorgaenge = 0;
      metaAllesSchreiben = async () => { schreibvorgaenge++; };
      sitzungSchreibenP = async () => { schreibvorgaenge++; };

      const nutzlast = ${JSON.stringify(to.nutzlast)};
      nutzlast.sitzung.id = 'S-ID';
      nutzlast.version = 1;
      const probe = JSON.parse(JSON.stringify(nutzlast.sitzung));
      const bilanz = tagesordnungEinspielen(daten.sitzungen.find(x => x.id === 'S-ID'), probe);

      await tagesordnungUebernehmen(nutzlast);
      const neu = daten.sitzungen.find(x => x.id === 'S-ID');
      return {
        bilanz: bilanz,
        vorher: vorher + 1, nachher: daten.sitzungen.length,
        andereBleibt: !!daten.sitzungen.find(x => x.id === 'bleibt'),
        topTitel: neu.tops[0].titel,
        beschreibung: neu.tops[0].beschreibung,
        anlage: neu.tops[0].anlagen[0].name,
        verlaufErhalten: neu.tops[0].verlauf,
        beschlussErhalten: (neu.tops[0].beschluesse[0] || {}).antrag,
        gestrichenWeg: !neu.tops.find(t => t.id === 'weg'),
        teilnahme: (neu.teilnahme.m1 || {}).status,
        gaeste: neu.gaeste.length, gastName: (neu.gaeste[0] || {}).name,
        ort: neu.ort,
        aktiverReiter: ui.tab, schreibvorgaenge: schreibvorgaenge
      };
    })()
  `);
  assert.strictEqual(uebernommen.nachher, uebernommen.vorher, 'keine zusätzliche Sitzung – die vorhandene wird aktualisiert');
  assert.ok(uebernommen.andereBleibt, 'andere Sitzungen bleiben unangetastet');
  assert.strictEqual(uebernommen.topTitel, 'Geplanter TOP', 'der Titel kommt aus der Tagesordnung');
  assert.strictEqual(uebernommen.beschreibung, 'Von der Sitzungsleitung vorbereitet.');
  assert.strictEqual(uebernommen.anlage, 'Beschlussvorlage.pdf', 'die Anlage steht fürs Verzeichnis bereit');
  assert.strictEqual(uebernommen.verlaufErhalten, '<p>Schon protokolliert.</p>', 'protokollierter Verlauf bleibt erhalten');
  assert.strictEqual(uebernommen.beschlussErhalten, 'Bestehender Beschluss', 'erfasste Beschlüsse bleiben erhalten');
  assert.strictEqual(uebernommen.teilnahme, 'anwesend', 'die Teilnahme bleibt beim Protokoll');
  assert.strictEqual(uebernommen.gaeste, 1, 'die eigene Gästeliste wird nicht verdoppelt');
  assert.strictEqual(uebernommen.gastName, 'Arbeitgeber', 'bereits erfasste Gäste schlagen die Planung');
  assert.strictEqual(uebernommen.ort, 'Raum 2.14', 'Rahmendaten werden aktualisiert');
  assert.strictEqual(uebernommen.bilanz.erhalten, 1, 'die Bilanz meldet den geretteten Punkt');
  assert.deepStrictEqual(uebernommen.bilanz.verloren, ['Gestrichener TOP'],
    'der gestrichene Punkt mit Inhalt wird vorab gemeldet');
  assert.ok(uebernommen.gestrichenWeg, 'und ist danach tatsächlich weg');
  assert.strictEqual(uebernommen.schreibvorgaenge, 2);
  assert.strictEqual(uebernommen.aktiverReiter, 'protokoll');

  const toBearbeitbar = await pm.evaluate(`
    (() => {
      const c = document.createElement('div');
      document.body.appendChild(c);
      renderTabTagesordnung(c, daten.sitzungen.find(x => x.id === 'S-ID'));
      return { neuerTopKnopf: !!c.querySelector('#toNeu'), titelFeld: !!c.querySelector('#topListe input') };
    })()
  `);
  assert.ok(toBearbeitbar.neuerTopKnopf, 'im Protokollmodul lassen sich TOPs ergänzen');
  assert.ok(toBearbeitbar.titelFeld, 'die vorhandenen TOP-Titel sind editierbar');

  const erg = await pm.evaluate(`
    (() => {
      const s = daten.sitzungen.find(x => x.id === 'S-ID');
      s.tops[0].beschluesse = [{ id: 'b1', jahr: 2026, lfd: 1, antrag: 'Der BR beschliesst X.',
                                 ja: '5', nein: '1', enthaltung: '0', ergebnis: 'auto', status: 'in_arbeit', tags: [] }];
      s.tops[0].aufgaben = [{ id: 'auf1', was: 'Schreiben aufsetzen', wer: 'Erika', bis: '2026-08-20', status: 'offen' }];
      s.teilnahme = { m1: { status: 'anwesend', vertretenDurch: '' },
                      m2: { status: 'anwesend', vertretenDurch: '' },
                      m3: { status: 'anwesend', vertretenDurch: '' } };
      s.beginnTatsaechlich = '16:05';
      s.endeTatsaechlich = '17:30';
      const n = ergebnisNutzlast(s);
      return { nutzlast: n, felder: Object.keys(n).sort(), roh: JSON.stringify(n) };
    })()
  `);
  assert.deepStrictEqual(erg.felder, ['beginnTatsaechlich', 'datum', 'endeTatsaechlich', 'nr', 'punkte', 'sitzungId', 'teilnahme']);
  assert.strictEqual(erg.nutzlast.punkte.length, 1, 'nur Punkte mit Inhalt');
  assert.ok(!erg.roh.includes('Geplanter TOP'), 'keine Tagesordnung im Rückweg');
  assert.ok(!erg.roh.includes('Schon protokolliert'), 'kein Verlauf im Rückweg – der bleibt im Protokoll');
  assert.ok(erg.roh.includes('Der BR beschliesst X.') && erg.roh.includes('Schreiben aufsetzen'));

  const rueck = await sm.evaluate(`
    (async () => {
      ${AUFBAU}
      const ziel = daten.sitzungen[0];
      ziel.id = 'S-ID'; ziel.nr = '04/2026';
      ziel.tops = [{ id: 'tp', titel: 'Geplanter TOP', anlagen: [], unterpunkte: [],
                     verlauf: '', beschluesse: [], aufgaben: [] }];
      let schreibvorgaenge = 0;
      metaAllesSchreiben = async () => { schreibvorgaenge++; };
      sitzungSchreibenP = async () => { schreibvorgaenge++; };

      const nutzlast = ${JSON.stringify(erg.nutzlast)};
      await ergebnisseUebernehmen(nutzlast);
      const neu = daten.sitzungen.find(x => x.id === 'S-ID');
      const uebersicht = beschlussUebersichtDaten();
      return {
        beschluss: neu.tops[0].beschluesse[0].antrag,
        aufgabe: neu.tops[0].aufgaben[0].was,
        titelUnveraendert: neu.tops[0].titel,
        teilnahme: Object.keys(neu.teilnahme).length,
        beginn: neu.beginnTatsaechlich,
        ende: neu.endeTatsaechlich,
        auswertungBasis: uebersicht[0].aus.basis,
        angenommen: uebersicht[0].aus.angenommen,
        aufgabenUebersicht: alleAufgabenGremium(daten).length,
        schreibvorgaenge: schreibvorgaenge
      };
    })()
  `);
  assert.strictEqual(rueck.beschluss, 'Der BR beschliesst X.', 'der Beschluss kommt an');
  assert.strictEqual(rueck.aufgabe, 'Schreiben aufsetzen', 'die Aufgabe kommt an');
  assert.strictEqual(rueck.titelUnveraendert, 'Geplanter TOP', 'die Tagesordnung des Managers bleibt seine');
  assert.strictEqual(rueck.teilnahme, 3, 'die Teilnahme reist mit');
  assert.strictEqual(rueck.beginn, '16:05', 'der tatsächliche Beginn reist mit');
  assert.strictEqual(rueck.ende, '17:30');
  assert.strictEqual(rueck.auswertungBasis, 3, 'die Beschluss-Übersicht rechnet gegen die drei Teilnehmenden');
  assert.strictEqual(rueck.angenommen, true, '5 Ja bei 3 Teilnehmenden – angenommen');
  assert.strictEqual(rueck.aufgabenUebersicht, 1, 'die Aufgabe erscheint in der gremiumsweiten Übersicht');
  assert.strictEqual(rueck.schreibvorgaenge, 2);

  const meldungen = async (p, faelle) => p.evaluate(`
    (async () => {
      const raus = [];
      const echt = window.zeigeToast;
      zeigeToast = t => raus.push(t);
      const alsDatei = o => new File([JSON.stringify(o)], 'x.json', { type: 'application/json' });
      for (const o of ${JSON.stringify(faelle)}) await uebergabeDateiOeffnen(alsDatei(o));
      zeigeToast = echt;
      return raus;
    })()
  `);
  const mPm = await meldungen(pm, [
    { app: 'br-sitzungsmanager', format: 'enc-v2', zugang: {}, iv: [], ct: '' },
    { app: 'br-sitzungsmanager', format: 'ergebnis-v1', zugang: {}, iv: [], ct: '' },
    { irgendwas: true }
  ]);
  assert.ok(mPm[0].includes('vollständige Sicherung'), 'Sicherung wird erkannt');
  assert.ok(mPm[1].includes('aus diesem Modul'), 'die eigene Ausgaberichtung wird erkannt');
  assert.ok(mPm[2].includes('Keine gültige'), 'Fremdformat wird abgewiesen');

  const mSm = await meldungen(sm, [
    { app: 'br-sitzungsmanager', format: 'tagesordnung-v1', zugang: {}, iv: [], ct: '' }
  ]);
  assert.ok(mSm[0].includes('aus diesem Modul'), 'auch im Manager herum');

  const mProjekt = await pm.evaluate(`
    (async () => {
      const raus = []; const echt = window.zeigeToast; zeigeToast = t => raus.push(t);
      await projektDateiOeffnen(new File([JSON.stringify({ app: 'br-sitzungsmanager', format: 'tagesordnung-v1' })], 'x.json'));
      zeigeToast = echt; return raus;
    })()
  `);
  assert.ok(mProjekt[0].includes('Übergabedatei') || mProjekt[0].includes('Keine gültige'),
    'Übergabedatei im Sicherungs-Import wird abgewiesen');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Getrennte Speicherstände, gerichtete Übergabe, Übersichten nur im Manager');
}

/* Unterpunkte in den Standard-TOPs */
async function pruefeStandardUnterpunkte() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);

  const angelegt = await seite.evaluate(`
    (() => {
      daten.standardTops = [
        { id: 'v1', titel: 'Berichte', kategorie: 'information',
          unterpunkte: [{ id: 'vu1', titel: 'Bericht Vorsitz' }, { id: 'vu2', titel: 'Bericht Ausschüsse' }] },
        { id: 'v2', titel: 'Verschiedenes', kategorie: 'sonstiges', unterpunkte: [] }
      ];
      const s = neueSitzung(daten);
      const zahl = standardTopsEinfuegen(s);
      const top = s.tops[0];
      const nochmal = standardTopsEinfuegen(s);
      return {
        zahl: zahl, nochmal: nochmal, tops: s.tops.length,
        titel: top.titel,
        unterTitel: top.unterpunkte.map(u => u.titel),
        eigeneIds: top.unterpunkte.every(u => u.id !== 'vu1' && u.id !== 'vu2'),
        vollstaendig: top.unterpunkte.every(u =>
          Array.isArray(u.beschluesse) && Array.isArray(u.aufgaben) && Array.isArray(u.anlagen) && 'verlauf' in u),
        ohneUnter: s.tops[1].unterpunkte.length
      };
    })()
  `);
  assert.strictEqual(angelegt.zahl, 2, 'beide Standard-TOPs eingefügt');
  assert.strictEqual(angelegt.nochmal, 0, 'kein Verdoppeln beim zweiten Einfügen');
  assert.deepStrictEqual(angelegt.unterTitel, ['Bericht Vorsitz', 'Bericht Ausschüsse'],
    'die Unterpunkte werden mit angelegt');
  assert.ok(angelegt.eigeneIds, 'jede Sitzung bekommt eigene IDs, nicht die der Vorlage');
  assert.ok(angelegt.vollstaendig, 'die Unterpunkte sind vollwertig (Beschlüsse, Aufgaben, Anlagen, Verlauf)');
  assert.strictEqual(angelegt.ohneUnter, 0, 'TOPs ohne Unterpunkte bleiben ohne');

  const extern = await seite.evaluate(`
    (() => {
      daten.standardTops = [];
      window.BR_STANDARD_TOPS = [
        { titel: 'Berichte', kategorie: 'information',
          unterpunkte: [{ titel: ' Vorsitz ' }, { titel: '' }, null, { titel: 'Ausschüsse' }] },
        { titel: 'Kurzform', kategorie: 'formalia', unterpunkte: ['Eins', '  ', 'Zwei'] },
        { titel: 'Ohne', kategorie: 'sonstiges' }
      ];
      const geaendert = externeStandardTopsUebernehmen();
      const nochmal = externeStandardTopsUebernehmen();
      return {
        geaendert: geaendert, nochmal: nochmal,
        lang: daten.standardTops[0].unterpunkte.map(u => u.titel),
        kurz: daten.standardTops[1].unterpunkte.map(u => u.titel),
        ohne: daten.standardTops[2].unterpunkte.length
      };
    })()
  `);
  assert.strictEqual(extern.geaendert, true);
  assert.strictEqual(extern.nochmal, false, 'die Signatur erkennt „schon aktuell" auch mit Unterpunkten');
  assert.deepStrictEqual(extern.lang, ['Vorsitz', 'Ausschüsse'], 'leere Einträge fallen weg, Titel getrimmt');
  assert.deepStrictEqual(extern.kurz, ['Eins', 'Zwei'], 'Kurzform als reine Zeichenketten funktioniert');
  assert.strictEqual(extern.ohne, 0);

  const aenderung = await seite.evaluate(`
    (() => {
      window.BR_STANDARD_TOPS[0].unterpunkte = [{ titel: 'Vorsitz' }, { titel: 'Neu dazu' }];
      return { erkannt: externeStandardTopsUebernehmen(), jetzt: daten.standardTops[0].unterpunkte.map(u => u.titel) };
    })()
  `);
  assert.strictEqual(aenderung.erkannt, true, 'eine reine Unterpunkt-Änderung wird übernommen');
  assert.deepStrictEqual(aenderung.jetzt, ['Vorsitz', 'Neu dazu']);

  const alt = await seite.evaluate(`
    (() => {
      const d = migriere({ app: 'br-sitzungsmanager', version: 1, sitzungen: [],
        standardTops: [{ id: 'a', titel: 'Alt ohne Unterpunkte', kategorie: 'formalia' }] });
      return { unterpunkte: d.standardTops[0].unterpunkte, titel: d.standardTops[0].titel };
    })()
  `);
  assert.deepStrictEqual(alt.unterpunkte, [], 'fehlendes Feld wird zur leeren Liste');
  assert.strictEqual(alt.titel, 'Alt ohne Unterpunkte');

  const panel = await seite.evaluate(`
    (async () => {
      sitzungsRolle = 'admin';
      daten.standardTops = [{ id: 'v1', titel: 'Berichte', kategorie: 'formalia',
        unterpunkte: [{ id: 'u1', titel: 'Erster' }, { id: 'u2', titel: 'Zweiter' }] }];
      oeffneStammdaten();
      const dlg = document.getElementById('dlgStammdaten');
      const block = dlg.querySelector('.std-top[data-i="0"]');
      const nummern = Array.from(block.querySelectorAll('[data-u] .klein-grau')).map(e => e.textContent);
      const titel = Array.from(block.querySelectorAll('[data-f="utitel"]')).map(e => e.value);
      block.querySelector('[data-tu="uneu"]').click();
      const nachNeu = daten.standardTops[0].unterpunkte.length;
      const block2 = dlg.querySelector('.std-top[data-i="0"]');
      block2.querySelector('[data-u="1"] [data-utu="hoch"]').click();
      const nachTausch = daten.standardTops[0].unterpunkte.map(u => u.titel);
      const block3 = dlg.querySelector('.std-top[data-i="0"]');
      block3.querySelector('[data-u="0"] [data-utu="weg"]').click();
      const nachWeg = daten.standardTops[0].unterpunkte.map(u => u.titel);
      const topsVorher = daten.standardTops.length;
      dlg.close();
      return { nummern: nummern, titel: titel, nachNeu: nachNeu,
               nachTausch: nachTausch, nachWeg: nachWeg, topsVorher: topsVorher };
    })()
  `);
  assert.deepStrictEqual(panel.nummern, ['1.1', '1.2'], 'die Nummerierung entspricht der Tagesordnung');
  assert.deepStrictEqual(panel.titel, ['Erster', 'Zweiter']);
  assert.strictEqual(panel.nachNeu, 3, '„+ Unterpunkt" legt an');
  assert.deepStrictEqual(panel.nachTausch, ['Zweiter', 'Erster', ''], 'nach oben schieben wirkt nur im Unterbaum');
  assert.deepStrictEqual(panel.nachWeg, ['Erster', ''], 'löschen entfernt nur den Unterpunkt');
  assert.strictEqual(panel.topsVorher, 1, 'der Standard-TOP selbst bleibt stehen');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Standard-TOPs mit Unterpunkten: anlegen, extern pflegen, im Panel bearbeiten');
}

/* Urlaubskalender im Admin-Menü */
async function pruefeUrlaubEditor() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);

  assert.deepStrictEqual(await seite.evaluate('leeresProjekt().urlaub'), []);
  assert.deepStrictEqual(
    await seite.evaluate(`migriere({ app: 'br-sitzungsmanager', version: 1, sitzungen: [] }).urlaub`), [],
    'Sicherungen vor v0.28.0 kennen das Feld nicht');

  const bedient = await seite.evaluate(`
    (() => {
      sitzungsRolle = 'admin';
      daten.urlaub = [];
      oeffneStammdaten();
      const dlg = document.getElementById('dlgStammdaten');
      const uc = dlg.querySelector('#sdUrlaub');
      dlg.querySelector('#sdUrlaubNeu').click();
      const angelegt = JSON.parse(JSON.stringify(daten.urlaub));

      const setz = (feld, wert) => {
        const el = dlg.querySelector('#sdUrlaub [data-i="0"] [data-f="' + feld + '"]');
        el.value = wert; el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setz('name', 'Erika Mustermann');
      setz('von', '2030-08-10');
      const bisNachVon = daten.urlaub[0].bis;
      setz('bis', '2030-08-28');
      setz('grund', 'Elternzeit');

      const namensvorschlaege = Array.from(dlg.querySelectorAll('#sdUrlaubNamen option')).map(o => o.value);
      const listeAmFeld = dlg.querySelector('#sdUrlaub [data-i="0"] [data-f="name"]').getAttribute('list');
      const datumsfelder = Array.from(dlg.querySelectorAll('#sdUrlaub [data-i="0"] input'))
        .filter(i => i.type === 'date').length;
      return { angelegt: angelegt, bisNachVon: bisNachVon, eintrag: JSON.parse(JSON.stringify(daten.urlaub[0])),
               namensvorschlaege: namensvorschlaege, listeAmFeld: listeAmFeld, datumsfelder: datumsfelder };
    })()
  `);
  assert.strictEqual(bedient.angelegt.length, 1, '„+ Abwesenheit" legt einen Eintrag an');
  assert.strictEqual(bedient.angelegt[0].grund, 'Urlaub', 'mit sinnvollem Vorschlag');
  assert.strictEqual(bedient.bisNachVon, '2030-08-10', 'ein früheres Bis zieht mit dem Von mit');
  assert.strictEqual(bedient.eintrag.name, 'Erika Mustermann');
  assert.strictEqual(bedient.eintrag.von, '2030-08-10');
  assert.strictEqual(bedient.eintrag.bis, '2030-08-28');
  assert.strictEqual(bedient.eintrag.grund, 'Elternzeit');
  assert.strictEqual(bedient.datumsfelder, 2, 'Von und Bis sind native Datumsfelder');
  assert.strictEqual(bedient.listeAmFeld, 'sdUrlaubNamen', 'das Namensfeld schlägt Personen vor');
  assert.ok(bedient.namensvorschlaege.includes('Erika Mustermann') && bedient.namensvorschlaege.includes('Max Mustermann'),
    'die Vorschläge kommen aus den Stammdaten');

  const wirkung = await seite.evaluate(`
    (() => ({
      warnung: urlaubHinweisHtml('2030-08-12'),
      keine: urlaubHinweisHtml('2030-09-01'),
      treffer: !!abwesenheitVon('erika   MUSTERMANN', '2030-08-28'),
      danach: !!abwesenheitVon('Erika Mustermann', '2030-08-29')
    }))()
  `);
  assert.ok(wirkung.warnung.includes('Erika Mustermann') && wirkung.warnung.includes('Elternzeit'));
  assert.strictEqual(wirkung.keine, '', 'außerhalb des Zeitraums keine Warnung');
  assert.ok(wirkung.treffer, 'letzter Tag zählt, Schreibweise egal');
  assert.ok(!wirkung.danach, 'der Tag danach nicht mehr');

  const kaputt = await seite.evaluate(`
    (() => {
      const dlg = document.getElementById('dlgStammdaten');
      daten.urlaub.push({ id: 'x', name: '', von: '2026-10-05', bis: '2026-10-01', grund: '' });
      oeffneStammdaten();
      const zeile = dlg.querySelector('#sdUrlaub [data-i="1"]');
      return { warnzeichen: zeile.textContent.includes('\\u26a0'),
               gespeichert: daten.urlaub.length,
               wirksam: urlaubEintraege().length };
    })()
  `);
  assert.ok(kaputt.warnzeichen, 'der unbrauchbare Eintrag wird markiert');
  assert.strictEqual(kaputt.gespeichert, 2, 'er bleibt zum Korrigieren stehen');
  assert.strictEqual(kaputt.wirksam, 1, 'wirkt aber nicht');

  const aufgeraeumt = await seite.evaluate(`
    (() => {
      const dlg = document.getElementById('dlgStammdaten');
      daten.urlaub = [
        { id: 'alt', name: 'Alt', von: '2020-01-01', bis: '2020-01-10', grund: 'Urlaub' },
        { id: 'neu', name: 'Neu', von: '2099-01-01', bis: '2099-01-10', grund: 'Urlaub' }
      ];
      oeffneStammdaten();
      dlg.querySelector('#sdUrlaubAufraeumen').click();
      document.getElementById('dlgBestaetigen').querySelector('#bstOk').click();
      const nachAufraeumen = daten.urlaub.map(e => e.id);
      dlg.querySelector('#sdUrlaub [data-i="0"] [data-tu="weg"]').click();
      return { nachAufraeumen: nachAufraeumen, nachLoeschen: daten.urlaub.length };
    })()
  `);
  assert.deepStrictEqual(aufgeraeumt.nachAufraeumen, ['neu'], 'nur vollständig vergangene Zeiträume fallen weg');
  assert.strictEqual(aufgeraeumt.nachLoeschen, 0, 'einzelne Einträge lassen sich löschen');

  const datei = await seite.evaluate(`
    (async () => {
      const dlg = document.getElementById('dlgStammdaten');
      daten.urlaub = [
        { id: 'b', name: 'Zweiter', von: '2026-09-01', bis: '2026-09-05', grund: 'Kur' },
        { id: 'a', name: 'Erster', von: '2026-08-01', bis: '2026-08-05', grund: 'Urlaub' },
        { id: 'c', name: '', von: '', bis: '', grund: '' }
      ];
      oeffneStammdaten();
      let ab = null;
      const echt = dateiHerunterladen;
      dateiHerunterladen = (blob, name) => { ab = { name: name, blob: blob }; };
      dlg.querySelector('#sdUrlaubDownload').click();
      dateiHerunterladen = echt;
      const text = await ab.blob.text();
      /* Wie der <script src="urlaub.js">-Tag: ausführen und wieder übernehmen. */
      daten.urlaub = [];
      (0, eval)(text);
      const uebernommen = externeUrlaubUebernehmen();
      const nochmal = externeUrlaubUebernehmen();
      window.BR_URLAUB = undefined;
      return { name: ab.name, text: text, uebernommen: uebernommen, nochmal: nochmal,
               zurueck: daten.urlaub.map(e => e.name + '|' + e.von + '|' + e.grund) };
    })()
  `);
  assert.strictEqual(datei.name, 'urlaub.js');
  assert.ok(datei.text.includes('window.BR_URLAUB'), 'setzt window.BR_URLAUB');
  assert.ok(datei.text.includes('personenbezogene Daten'), 'mit Datenschutzhinweis im Kopf');
  assert.strictEqual(datei.uebernommen, true, 'die erzeugte Datei lässt sich zurücklesen');
  assert.strictEqual(datei.nochmal, false, 'unverändert → kein zweites Übernehmen');
  assert.deepStrictEqual(datei.zurueck,
    ['Erster|2026-08-01|Urlaub', 'Zweiter|2026-09-01|Kur'],
    'nach Beginn sortiert, der unbrauchbare Eintrag fehlt');

  const vorrang = await seite.evaluate(`
    (() => {
      daten.urlaub = [{ id: 'app', name: 'Aus der App', von: '2026-01-01', bis: '2026-01-02', grund: 'Urlaub' }];
      window.BR_URLAUB = [{ name: 'Aus der Datei', von: '2026-02-01', bis: '2026-02-02' }];
      const geaendert = externeUrlaubUebernehmen();
      const namen = daten.urlaub.map(e => e.name);
      window.BR_URLAUB = [];
      const beiLeer = externeUrlaubUebernehmen();
      window.BR_URLAUB = undefined;
      return { geaendert: geaendert, namen: namen, beiLeer: beiLeer, ids: daten.urlaub.every(e => !!e.id) };
    })()
  `);
  assert.strictEqual(vorrang.geaendert, true);
  assert.deepStrictEqual(vorrang.namen, ['Aus der Datei'], 'die Datei ist maßgeblich');
  assert.strictEqual(vorrang.beiLeer, false, 'eine leere Datei überschreibt nichts');
  assert.ok(vorrang.ids, 'übernommene Einträge bekommen IDs');

  assert.ok(await seite.evaluate(`GREMIUM_FELDER.includes('urlaub')`),
    'urlaub gehört zu den Stammdaten und wandert zum Protokollmodul');
  assert.ok(await seite.evaluate(`GREMIUM_FELDER.includes('exportOptionen')`),
    'die Exporteinstellungen gelten fürs ganze Gremium');

  await seite.evaluate(`document.getElementById('dlgStammdaten').close()`);
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Urlaubskalender im Admin-Menü: erfassen, aufräumen, als urlaub.js ausgeben');
}

/* Anwesenheitsliste: Ausfüllfelder vollständig, aber keine Leerzeilen für nicht geladene Personen */
async function pruefeAnwesenheitsliste() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof PDFLib !== "undefined" && typeof APP_MODUS !== "undefined"', null, { timeout: 8000 });

  const bauen = `
    async (anzahl, gaeste, video) => {
      daten = leeresProjekt();
      daten.stammdaten.firma = 'Test GmbH';
      daten.stammdaten.gremiumGroesse = anzahl;
      daten.personen = Array.from({ length: anzahl }, (_, i) => ({
        id: 'm' + i, name: 'Mitglied Nummer ' + (i + 1), gruppe: 'br',
        funktion: i === 0 ? 'Vorsitzende/r' : 'Mitglied', aktiv: true
      }));
      const s = neueSitzung(daten);
      s.datum = '2026-08-12'; s.ort = 'Raum 2.14';
      s.teilnahme = {};
      for (let i = 0; i < anzahl; i++) s.teilnahme['m' + i] = { status: (video && i === 0) ? 'video' : 'anwesend', vertretenDurch: '' };
      s.gaeste = Array.from({ length: gaeste }, (_, i) => ({ id: 'g' + i, name: 'Gast ' + (i + 1), typ: 'arbeitgeber', funktion: '', tops: [] }));
      daten.sitzungen = [s]; ui.sitzungId = s.id;
      kategorienAnwenden();
      const bytes = await erzeugeAnwesenheitslistePdf(daten, s, {});
      const pdf = await PDFLib.PDFDocument.load(bytes);
      return { seiten: pdf.getPageCount(), groesse: bytes.length };
    }
  `;

  /* Die Grenzen (16 Mitglieder ohne Gäste, 12 mit zweien) sind gemessen – festhalten schützt vor unbemerktem Umbruch auf zwei Seiten */
  assert.strictEqual((await seite.evaluate(`(${bauen})(9, 2, false)`)).seiten, 1,
    '9 Mitglieder und 2 Gäste passen auf eine Seite');
  assert.strictEqual((await seite.evaluate(`(${bauen})(12, 2, false)`)).seiten, 1,
    '12 Mitglieder und 2 Gäste passen noch');
  assert.strictEqual((await seite.evaluate(`(${bauen})(16, 0, false)`)).seiten, 1,
    'ohne Gäste reicht die Seite für 16 Mitglieder');
  assert.strictEqual((await seite.evaluate(`(${bauen})(24, 4, false)`)).seiten, 2,
    'ein sehr großes Gremium läuft sauber auf die zweite Seite');

  const spalten = await seite.evaluate(`
    (async () => {
      const gemessen = [];
      const echt = PdfBuilder.prototype.tabelle;
      PdfBuilder.prototype.tabelle = function (o) { gemessen.push({ titel: o.spalten.map(s => s.titel), zeilen: o.zeilen.length }); return echt.call(this, o); };
      const ueberschriften = [];
      const echtU = PdfBuilder.prototype.ueberschrift;
      PdfBuilder.prototype.ueberschrift = function (t, n) { ueberschriften.push(t); return echtU.call(this, t, n); };
      await (${bauen})(5, 0, false);
      const ohneGaeste = { tabellen: gemessen.slice(), ueberschriften: ueberschriften.slice() };
      gemessen.length = 0; ueberschriften.length = 0;
      await (${bauen})(5, 2, true);
      const mitAllem = { tabellen: gemessen.slice(), ueberschriften: ueberschriften.slice() };
      PdfBuilder.prototype.tabelle = echt;
      PdfBuilder.prototype.ueberschrift = echtU;
      return { ohneGaeste: ohneGaeste, mitAllem: mitAllem };
    })()
  `);

  const o = spalten.ohneGaeste, m = spalten.mitAllem;
  assert.strictEqual(o.tabellen.length, 1, 'ohne Gäste wird nur eine Tabelle gezeichnet');
  assert.ok(!o.ueberschriften.includes('Gäste (Arbeitgeber, Gewerkschaft, SBV, JAV, Sachverständige)'),
    'und auch die Gäste-Überschrift entfällt');
  assert.deepStrictEqual(o.tabellen[0].titel, ['Nr.', 'Name', 'Abw. Anwesenheit', 'Unterschrift'],
    'die Spalte steht auch ohne erfasste Video-Teilnahme');
  assert.strictEqual(o.tabellen[0].zeilen, 5, 'genau eine Zeile je Mitglied, keine Leerzeilen');

  assert.strictEqual(m.tabellen.length, 2, 'mit Gästen zwei Tabellen');
  assert.deepStrictEqual(m.tabellen[0].titel, ['Nr.', 'Name', 'Abw. Anwesenheit', 'Unterschrift'],
    'mit erfasster Video-Teilnahme unverändert');
  assert.strictEqual(m.tabellen[0].zeilen, 5, 'weiterhin keine Leerzeilen');
  assert.deepStrictEqual(m.tabellen[1].titel, ['Nr.', 'Name', 'Funktion/Organisation', 'Abw. Anwesenheit', 'Unterschrift'],
    'auch Gäste können per Video teilnehmen – die Spalte steht dort ebenfalls');
  assert.strictEqual(m.tabellen[1].zeilen, 2, 'genau eine Zeile je Gast');

  const eingetragen = await seite.evaluate(`
    (async () => {
      const zellen = [];
      const echt = PdfBuilder.prototype.tabelle;
      PdfBuilder.prototype.tabelle = function (o) { zellen.push(o.zeilen.map(z => z[2])); return echt.call(this, o); };
      await (${bauen})(3, 0, true);
      PdfBuilder.prototype.tabelle = echt;
      return zellen[0];
    })()
  `);
  assert.deepStrictEqual(eingetragen, ['Video/Telefon', '', ''],
    'erfasste Video-Teilnahme steht in der Spalte, die übrigen Felder bleiben zum Ausfüllen frei');

  const schalter = await seite.evaluate(`
    (async () => {
      const gemessen = [];
      const echt = PdfBuilder.prototype.tabelle;
      PdfBuilder.prototype.tabelle = function (o) { gemessen.push(o.zeilen.length); return echt.call(this, o); };
      const lauf = async an => {
        gemessen.length = 0;
        await (${bauen})(5, 1, false);
        daten.exportOptionen.anwesenheitsLeerzeilen = an;
        const bytes = await erzeugeAnwesenheitslistePdf(daten, daten.sitzungen[0], {});
        const seiten = (await PDFLib.PDFDocument.load(bytes)).getPageCount();
        return { zeilen: gemessen.slice(-2), seiten: seiten };
      };
      const aus = await lauf(false);
      const an = await lauf(true);
      gemessen.length = 0;
      await (${bauen})(5, 0, false);
      daten.exportOptionen.anwesenheitsLeerzeilen = true;
      await erzeugeAnwesenheitslistePdf(daten, daten.sitzungen[0], {});
      /* der Aufbau erzeugt selbst schon eine Liste – nur der zweite Lauf zählt */
      const ohneGaesteMitSchalter = gemessen.slice(-2);
      gemessen.length = 0;
      daten.exportOptionen.anwesenheitsLeerzeilen = false;
      await erzeugeAnwesenheitslistePdf(daten, daten.sitzungen[0], {});
      const ohneGaesteOhneSchalter = gemessen.slice();
      PdfBuilder.prototype.tabelle = echt;
      return { aus: aus, an: an, ohneGaesteMitSchalter: ohneGaesteMitSchalter, ohneGaesteOhneSchalter: ohneGaesteOhneSchalter };
    })()
  `);
  assert.deepStrictEqual(schalter.aus.zeilen, [5, 1], 'ausgeschaltet: genau eine Zeile je Person');
  assert.deepStrictEqual(schalter.an.zeilen, [7, 3], 'eingeschaltet: je zwei Leerzeilen mehr');
  assert.strictEqual(schalter.aus.seiten, 1);
  assert.strictEqual(schalter.an.seiten, 1, 'auch mit Leerzeilen bleibt ein kleines Gremium einseitig');
  assert.deepStrictEqual(schalter.ohneGaesteMitSchalter, [7, 2],
    'ohne Gäste erscheint der Block mit Schalter trotzdem – für den unangemeldeten Gast');
  assert.deepStrictEqual(schalter.ohneGaesteOhneSchalter, [5],
    'ohne Schalter bleibt er weg');

  assert.strictEqual(await seite.evaluate('leeresProjekt().exportOptionen.anwesenheitsLeerzeilen'), false);
  assert.strictEqual(await seite.evaluate(
    `migriere({ app: 'br-sitzungsmanager', version: 1, sitzungen: [], exportOptionen: {} }).exportOptionen.anwesenheitsLeerzeilen`),
    false, 'ältere Sicherungen kennen die Option nicht – Voreinstellung greift');

  const anteile = await seite.evaluate(`
    (async () => {
      const summen = [];
      const echt = PdfBuilder.prototype.tabelle;
      PdfBuilder.prototype.tabelle = function (o) { summen.push(o.spalten.reduce((n, s) => n + s.anteil, 0)); return echt.call(this, o); };
      await (${bauen})(4, 1, false);
      await (${bauen})(4, 1, true);
      PdfBuilder.prototype.tabelle = echt;
      return summen;
    })()
  `);
  for (const summe of anteile) {
    assert.ok(Math.abs(summe - 1) < 0.001, 'die Spaltenanteile ergeben 100 % (war ' + summe + ')');
  }

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Anwesenheitsliste: Ausfüllfelder vollständig, ohne Leerzeilen einseitig');
}

/* Meldewerkzeug und Kalenderansicht */
async function pruefeUrlaubMeldung() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const fehler = [];

  const melden = await ctx.newPage();
  melden.on('pageerror', e => fehler.push('melden: ' + e.message));
  await melden.goto(DATEI('br-urlaub-melden.html'));
  await melden.waitForFunction('!!window.WERKZEUG', null, { timeout: 5000 });

  const gemeldet = await melden.evaluate(`
    (async () => {
      document.getElementById('name').value = '  Erika   Mustermann ';
      window.WERKZEUG.eintraege = [
        { von: '2026-08-28', bis: '2026-08-10', grund: '' },
        { von: '2026-09-01', bis: '2026-09-05', grund: 'Kur' },
        { von: '2026-08-10', bis: '2026-08-28', grund: '' },
        { von: '', bis: '', grund: 'unvollständig' }
      ];
      window.WERKZEUG.zeichne();
      let ab = null;
      const echt = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { ab = { name: this.download, href: this.href }; };
      document.getElementById('speichern').click();
      HTMLAnchorElement.prototype.click = echt;
      const text = await (await fetch(ab.href)).text();
      return { name: ab.name, text: text, meldung: document.getElementById('meldung').textContent };
    })()
  `);
  const inhalt = JSON.parse(gemeldet.text);
  assert.strictEqual(inhalt.format, 'urlaub-v1');
  assert.strictEqual(inhalt.name, 'Erika Mustermann', 'Mehrfach-Leerzeichen werden zusammengefasst');
  assert.strictEqual(inhalt.eintraege.length, 2, 'verdrehte und unvollständige Zeilen fallen weg');
  assert.deepStrictEqual(inhalt.eintraege.map(e => e.von), ['2026-08-10', '2026-09-01'], 'nach Beginn sortiert');
  assert.strictEqual(inhalt.eintraege[0].grund, 'Urlaub', 'fehlender Grund wird ergänzt');
  assert.ok(gemeldet.name.startsWith('Urlaub_Erika-Mustermann_'), 'sprechender Dateiname');
  assert.ok(gemeldet.meldung.includes('2 unvollständige'), 'die verworfenen Zeilen werden benannt');

  const zurueck = await melden.evaluate(`
    (async () => {
      window.WERKZEUG.eintraege = []; document.getElementById('name').value = '';
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(gemeldet.text)}], 'meldung.json', { type: 'application/json' }));
      const inp = document.getElementById('datei');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 120));
      return { name: document.getElementById('name').value,
               zeilen: document.querySelectorAll('#liste .zeile').length,
               meldung: document.getElementById('meldung').textContent };
    })()
  `);
  assert.strictEqual(zurueck.name, 'Erika Mustermann', 'der Name kommt zurück');
  assert.strictEqual(zurueck.zeilen, 2, 'die Zeiträume ebenfalls');
  assert.ok(zurueck.meldung.includes('geladen'));

  /* Eine Meldung ganz ohne Zeitraum ist die gültige Aussage „ich bin da" */
  const ohne = await melden.evaluate(`
    (async () => {
      window.WERKZEUG.eintraege = []; window.WERKZEUG.zeichne();
      document.getElementById('name').value = 'Max Mustermann';
      let ab = null;
      const echt = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { ab = this.href; };
      document.getElementById('speichern').click();
      HTMLAnchorElement.prototype.click = echt;
      return await (await fetch(ab)).text();
    })()
  `);
  assert.deepStrictEqual(JSON.parse(ohne).eintraege, [], 'leere Meldung ist erlaubt');

  const ohneName = await melden.evaluate(`
    (() => { document.getElementById('name').value = ''; document.getElementById('speichern').click();
             return document.getElementById('meldung').textContent; })()
  `);
  assert.ok(ohneName.includes('Namen'), 'ohne Namen wird nicht gespeichert');

  const sm = await ctx.newPage();
  sm.on('pageerror', e => fehler.push('manager: ' + e.message));
  await sm.goto(DATEI('BR-Sitzungsmanager.html'));
  await sm.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await sm.evaluate(AUFBAU);

  const eingelesen = await sm.evaluate(`
    (() => {
      daten.urlaub = [
        { id: 'alt', name: 'Erika Mustermann', von: '2026-01-01', bis: '2026-01-05', grund: 'Alt' },
        { id: 'fremd', name: 'Nie Verreist', von: '2026-03-01', bis: '2026-03-02', grund: 'Bleibt' }
      ];
      const m = urlaubMeldungLesen(${JSON.stringify(gemeldet.text)});
      const b = urlaubMeldungenZusammenfuehren([m]);
      return { bilanz: b, jetzt: daten.urlaub.map(e => e.name + '|' + e.von + '|' + e.grund) };
    })()
  `);
  assert.strictEqual(eingelesen.bilanz.ersetzt, 1, 'der alte Zeitraum dieser Person wird ersetzt');
  assert.strictEqual(eingelesen.bilanz.neu, 2);
  assert.deepStrictEqual(eingelesen.bilanz.personen, ['Erika Mustermann']);
  assert.deepStrictEqual(eingelesen.jetzt, [
    'Nie Verreist|2026-03-01|Bleibt',
    'Erika Mustermann|2026-08-10|Urlaub',
    'Erika Mustermann|2026-09-01|Kur'
  ], 'andere Personen bleiben unangetastet, sortiert nach Beginn');

  const geleert = await sm.evaluate(`
    (() => {
      const b = urlaubMeldungenZusammenfuehren([urlaubMeldungLesen(${JSON.stringify(ohne.replace(/Max Mustermann/, 'Erika Mustermann'))})]);
      return { ohne: b.ohne, namen: daten.urlaub.map(e => e.name) };
    })()
  `);
  assert.deepStrictEqual(geleert.ohne, ['Erika Mustermann'], 'die leere Meldung wird gemeldet');
  assert.deepStrictEqual(geleert.namen, ['Nie Verreist'], 'und räumt die Zeiträume dieser Person ab');

  const abgelehnt = await sm.evaluate(`
    (() => [
      urlaubMeldungLesen('kein json').fehler,
      urlaubMeldungLesen(JSON.stringify({ format: 'anders' })).fehler,
      urlaubMeldungLesen(JSON.stringify({ format: 'urlaub-v1', name: '  ' })).fehler
    ])()
  `);
  assert.ok(abgelehnt[0].includes('JSON'));
  assert.ok(abgelehnt[1].includes('Urlaubsmeldung'));
  assert.ok(abgelehnt[2].includes('Namen'));

  const daten0Nr = await sm.evaluate('daten.sitzungen[0].nr');
  const kal = await sm.evaluate(`
    (() => {
      daten.urlaub = [{ id: 'u', name: 'Erika Mustermann', von: '2026-08-10', bis: '2026-08-28', grund: 'Urlaub' }];
      daten.sitzungen[0].datum = '2026-08-12';
      const k = urlaubKalender(daten, '2026-08', '2026-08-06');
      const tage = k.wochen.flat();
      const finde = iso => tage.find(t => t.iso === iso);
      return {
        monatName: k.monatName, jahr: k.jahr,
        ersterTag: tage[0].iso,                       /* 2026-08-01 ist ein Samstag → Woche ab Mo 27.07. */
        wochenlaenge: k.wochen.every(w => w.length === 7),
        vorher: finde('2026-08-09').abwesend.length,
        erster: finde('2026-08-10').abwesend.map(e => e.name),
        letzter: finde('2026-08-28').abwesend.length,
        danach: finde('2026-08-29').abwesend.length,
        sitzungstag: finde('2026-08-12').sitzungen.length,
        sitzungNr: (finde('2026-08-12').sitzungen[0] || {}).nr,
        heute: tage.filter(t => t.heute).map(t => t.iso),
        wochenende: finde('2026-08-08').wochenende,
        werktag: finde('2026-08-10').wochenende,
        fremd: finde('2026-07-31').imMonat,
        kaputt: urlaubKalender(daten, 'unsinn', '2026-08-06')
      };
    })()
  `);
  assert.strictEqual(kal.monatName, 'August');
  assert.strictEqual(kal.jahr, 2026);
  assert.strictEqual(kal.ersterTag, '2026-07-27', 'die Woche beginnt am Montag');
  assert.ok(kal.wochenlaenge, 'jede Zeile hat sieben Tage');
  assert.strictEqual(kal.vorher, 0, 'Tag vor Beginn frei');
  assert.deepStrictEqual(kal.erster, ['Erika Mustermann'], 'erster Tag zählt');
  assert.strictEqual(kal.letzter, 1, 'letzter Tag zählt');
  assert.strictEqual(kal.danach, 0, 'Tag nach Ende frei');
  assert.strictEqual(kal.sitzungstag, 1, 'der Sitzungstermin liegt im selben Raster');
  assert.strictEqual(kal.sitzungNr, daten0Nr, 'und trägt die richtige Nummer');
  assert.deepStrictEqual(kal.heute, ['2026-08-06'], 'heute wird markiert');
  assert.strictEqual(kal.wochenende, true, 'Samstag ist Wochenende');
  assert.strictEqual(kal.werktag, false);
  assert.strictEqual(kal.fremd, false, 'Tage aus dem Vormonat sind gekennzeichnet');
  assert.strictEqual(kal.kaputt, null, 'ein unsinniger Monat liefert nichts');

  assert.strictEqual(await sm.evaluate(`monatVerschieben('2026-01', -1)`), '2025-12', 'Jahreswechsel rückwärts');
  assert.strictEqual(await sm.evaluate(`monatVerschieben('2026-12', 1)`), '2027-01', 'Jahreswechsel vorwärts');

  /* Die Ansicht rechnet gegen das echte „heute" (heuteIso), daher liegt das Fixture im laufenden Monat – sonst bestünde der Test nur im August 2026. */
  const ansicht = await sm.evaluate(`
    (() => {
      sitzungsRolle = 'arbeit';
      const tagPlus = (iso, n) => {
        const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      };
      const heute = heuteIso(), monat = heute.slice(0, 7);
      daten.urlaub = [{ id: 'u', name: 'Erika Mustermann', von: heute, bis: tagPlus(heute, 3), grund: 'Urlaub' }];
      daten.sitzungen[0].datum = heute;
      ui.ansicht = 'urlaub'; ui.urlaubMonat = monat;
      const c = document.getElementById('hauptInhalt');
      renderHaupt();
      const vorher = ui.urlaubMonat;
      c.querySelector('#kalZurueck').click();
      const zurueck = ui.urlaubMonat;
      c.querySelector('#kalVor').click(); c.querySelector('#kalVor').click();
      const vor = ui.urlaubMonat;
      c.querySelector('#kalHeute').click();
      return {
        vorher: vorher, zurueck: zurueck, vor: vor, heute: ui.urlaubMonat, monat: monat,
        zurueckSoll: monatVerschieben(monat, -1), vorSoll: monatVerschieben(monat, 1),
        zellen: c.querySelectorAll('.kal-tag').length,
        abwesend: c.querySelectorAll('.kal-weg').length,
        sitzungsmarken: c.querySelectorAll('.kal-sitzung').length,
        legende: c.querySelectorAll('.kal-legende span').length,
        liste: c.querySelectorAll('.tn-tabelle tbody tr').length
      };
    })()
  `);
  assert.strictEqual(ansicht.zurueck, ansicht.zurueckSoll, 'ein Monat zurück');
  assert.strictEqual(ansicht.vor, ansicht.vorSoll, 'zwei vor');
  assert.strictEqual(ansicht.heute, ansicht.monat, '„Heute" springt auf den laufenden Monat');
  assert.ok(ansicht.abwesend > 0, 'die laufende Abwesenheit steht im Kalender');
  assert.ok(ansicht.zellen === 35 || ansicht.zellen === 42, 'fünf oder sechs volle Wochen');
  assert.strictEqual(ansicht.sitzungsmarken, 1, 'der Sitzungstermin ist markiert');
  assert.strictEqual(ansicht.legende, 3, 'die Legende erklärt alle drei Marken');
  assert.strictEqual(ansicht.liste, 1, 'die kommende Abwesenheit steht in der Liste');

  const pm = await ctx.newPage();
  await pm.goto(DATEI('BR-Protokoll.html'));
  await pm.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  assert.ok(!(await pm.evaluate(`modusHatAnsicht('urlaub')`)), 'das Protokollmodul führt den Kalender nicht');
  assert.ok(await sm.evaluate(`modusHatAnsicht('urlaub')`));

  const schalterstand = async (p, wo) => p.evaluate(`
    (() => {
      ${AUFBAU}
      const c = document.createElement('div');
      document.body.appendChild(c);
      renderTabExport(c, daten.sitzungen[0]);
      const ids = ['optVertraulich', 'optLeerzeilen'];
      return { gesperrt: ids.every(i => c.querySelector('#' + i).disabled),
               frei: ids.every(i => !c.querySelector('#' + i).disabled),
               hinweis: (c.textContent.match(/gelten für das ganze Gremium/) || []).length };
    })()
  `);
  const imManager = await schalterstand(sm);
  const imProtokoll = await schalterstand(pm);
  assert.ok(imManager.frei, 'im Sitzungsmanager sind die Schalter bedienbar');
  assert.strictEqual(imManager.hinweis, 0, 'dort ohne Hinweis');
  assert.ok(imProtokoll.gesperrt, 'im Protokollmodul sind sie gesperrt');
  assert.strictEqual(imProtokoll.hinweis, 1, 'mit Verweis auf den Sitzungsmanager');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Urlaubsmeldung der Mitglieder und Kalenderansicht im Manager');
}

/* Nachbardatei „Gremium" */
async function pruefeGremium() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const fehler = [];
  const oeffne = async datei => {
    const p = await ctx.newPage();
    p.on('pageerror', e => fehler.push(datei + ': ' + e.message));
    await p.goto(DATEI(datei));
    await p.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
    return p;
  };
  const sm = await oeffne('BR-Sitzungsmanager.html');
  const pm = await oeffne('BR-Protokoll.html');

  const erzeugt = await sm.evaluate(`
    (async () => {
      ${AUFBAU}
      daten.stammdaten.firma = 'Gremium GmbH';
      daten.stammdaten.gremiumGroesse = 7;
      daten.kategorien.push({ id: 'k9', key: 'eigen', label: 'Eigene Kategorie' });
      daten.beschlussTags = [{ id: 'tg1', name: 'Personal', farbe: '#0E6B57' }];
      sitzungsSchluessel = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      window.__mk = await crypto.subtle.exportKey('raw', sitzungsSchluessel);

      /* gremiumDateiErzeugen() wartet nicht auf dateiHerunterladen – ein async-Stub liefe ins Leere */
      let heruntergeladen = null;
      const meldungen = [];
      const echterToast = window.zeigeToast;
      zeigeToast = t => meldungen.push(t);
      dateiHerunterladen = (blob, name) => { heruntergeladen = { name: name, blob: blob }; };
      await gremiumDateiErzeugen();
      zeigeToast = echterToast;
      if (!heruntergeladen) throw new Error('kein Download – Meldung: ' + meldungen.join(' | '));
      return { name: heruntergeladen.name, text: await heruntergeladen.blob.text(),
               mk: Array.from(new Uint8Array(window.__mk)),
               felder: GREMIUM_FELDER };
    })()
  `);
  assert.strictEqual(erzeugt.name, 'Gremium', 'die Datei heißt genau „Gremium"');
  assert.ok(erzeugt.text.startsWith('/*'), 'mit erklärendem Kopfkommentar');
  assert.ok(erzeugt.text.includes('window.BR_GREMIUM'), 'setzt window.BR_GREMIUM');
  assert.ok(!erzeugt.text.includes('Gremium GmbH'), 'der Inhalt ist verschlüsselt, nicht im Klartext lesbar');
  assert.ok(!erzeugt.text.includes('Erika Mustermann'), 'auch keine Personennamen im Klartext');
  assert.ok(erzeugt.felder.includes('personen') && erzeugt.felder.includes('stammdaten') &&
            erzeugt.felder.includes('kategorien') && erzeugt.felder.includes('beschlussVorlagen'),
    'alle Angaben aus dem Admin-Menü sind enthalten');

  const uebernommen = await pm.evaluate(`
    (async () => {
      ${AUFBAU}
      daten.stammdaten.firma = 'Alt und falsch';
      sitzungsSchluessel = await crypto.subtle.importKey('raw', new Uint8Array(${JSON.stringify(erzeugt.mk)}),
        'AES-GCM', true, ['encrypt', 'decrypt']);
      ${erzeugt.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}
      const ersteUebernahme = await externesGremiumUebernehmen();
      const zweiteUebernahme = await externesGremiumUebernehmen();
      return {
        ersteUebernahme: ersteUebernahme, zweiteUebernahme: zweiteUebernahme,
        firma: daten.stammdaten.firma,
        groesse: daten.stammdaten.gremiumGroesse,
        personen: daten.personen.map(p => p.name),
        kategorien: daten.kategorien.map(k => k.key),
        tags: daten.beschlussTags.map(t => t.name),
        beschlussVorlagen: daten.beschlussVorlagen.length,
        katAktiv: KATEGORIEN.eigen
      };
    })()
  `);
  assert.strictEqual(uebernommen.ersteUebernahme, true, 'die Datei wird übernommen');
  assert.strictEqual(uebernommen.zweiteUebernahme, false, 'unverändert → kein zweites Schreiben');
  assert.strictEqual(uebernommen.firma, 'Gremium GmbH', 'Stammdaten kommen aus der Datei');
  assert.strictEqual(uebernommen.groesse, 7, 'auch die Gremiumgröße für die Beschlussfähigkeit');
  assert.deepStrictEqual(uebernommen.personen, ['Erika Mustermann', 'Max Mustermann', 'Nie Verreist']);
  assert.ok(uebernommen.kategorien.includes('eigen'), 'eigene Kategorien kommen mit');
  assert.strictEqual(uebernommen.katAktiv, 'Eigene Kategorie', 'und sind sofort aktiv');
  assert.deepStrictEqual(uebernommen.tags, ['Personal']);
  assert.ok(uebernommen.beschlussVorlagen >= 5);

  const fremd = await pm.evaluate(`
    (async () => {
      const raus = []; const echt = window.zeigeToast; zeigeToast = t => raus.push(t);
      sitzungsSchluessel = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const ergebnis = await externesGremiumUebernehmen();
      zeigeToast = echt;
      return { ergebnis: ergebnis, meldung: raus[0] || '' };
    })()
  `);
  assert.strictEqual(fremd.ergebnis, false, 'fremde Datei wird nicht übernommen');
  assert.ok(fremd.meldung.includes('passt nicht zu dieser Installation'), 'und sauber gemeldet');

  assert.strictEqual(await sm.evaluate('externesGremiumUebernehmen()'), false,
    'der Manager übernimmt seine eigene Datei nicht');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Gremium-Datei: verschlüsselt erzeugt, im Protokollmodul automatisch übernommen');
}

/* Umwandler br-sicherung-teilen.html */
async function pruefeUmwandler() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('br-sicherung-teilen.html'));
  await seite.waitForFunction('!!window.WERKZEUG', null, { timeout: 5000 });

  /* Echte enc-v2-Sicherung bauen: Zugang mit drei Rollen, MK verschlüsselt exakt wie projektDateiSpeichern() */
  const gebaut = await seite.evaluate(`
    (async () => {
      const { Krypto, bytesZuBase64 } = window.WERKZEUG;
      const mkBytes = crypto.getRandomValues(new Uint8Array(32));
      const mk = await Krypto.mkAusBytes(mkBytes);
      const iter = 1000;                              /* im Test niedrig, sonst dauert PBKDF2 zu lang */
      const zugang = { v: 2, iter: iter };
      for (const [feld, pw] of [['admin', 'geheim-admin'], ['arbeit', 'geheim-arbeit'], ['viewer', 'geheim-viewer']]) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const k = await Krypto.schluessel(pw, salt, iter);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, mkBytes);
        zugang[feld] = { salt: Array.from(salt), iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
      }
      const nutzlast = {
        app: 'br-sitzungsmanager', version: 1, revision: 12,
        stammdaten: { gremium: 'Betriebsrat', firma: 'Teil GmbH' },
        personen: [{ id: 'p1', name: 'Erika Mustermann', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true },
                   { id: 'p2', name: 'Max Mustermann', gruppe: 'br', funktion: 'Mitglied', aktiv: true }],
        dokumente: [{ id: 'dok1', name: 'Beschlussvorlage.pdf', kategorie: 'anlage-to', sitzungId: 's1', groesse: 3000 }],
        dokumentInhalte: { dok1: bytesZuBase64(new Uint8Array(3000).fill(65)) },
        sitzungen: [{ id: 's1', nr: '01/2026', datum: '2026-03-04',
          tops: [{ id: 't1', titel: 'TOP', verlauf: '<p>Protokolltext.</p>',
                   anlagen: [{ id: 'a1', name: 'Beschlussvorlage.pdf', dokumentId: 'dok1' }],
                   beschluesse: [{ id: 'b1', jahr: 2026, lfd: 1, antrag: 'Wortlaut' }] }] }],
        exportOptionen: { anwesenheitsLeerzeilen: true }
      };
      const { iv, ct } = await Krypto.chiffriere(mk, nutzlast);
      const datei = { app: 'br-sitzungsmanager', format: 'enc-v2', zugang: zugang,
                      iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
      window.__sicherung = JSON.stringify(datei);
      return { groesse: window.__sicherung.length };
    })()
  `);
  assert.ok(gebaut.groesse > 3000, 'Testsicherung enthält die Anlagen-Bytes');

  /* mit dem Arbeits-Passwort, nicht dem ersten in der Liste */
  const geteilt = await seite.evaluate(`
    (async () => {
      const f = new File([window.__sicherung], 'BR-Sitzungen_Rev0012.brenc.json', { type: 'application/json' });
      const r = await window.WERKZEUG.aufteilen(f, 'geheim-arbeit');
      window.__sm = r.sm; window.__pm = r.pm;
      return { statistik: r.statistik, smName: r.sm.name, pmName: r.pm.name };
    })()
  `);
  assert.strictEqual(geteilt.smName, 'BR-Sitzungen_Rev0012_Sitzungsmanager.brenc.json');
  assert.strictEqual(geteilt.pmName, 'BR-Sitzungen_Rev0012_Protokoll.brenc.json');
  assert.strictEqual(geteilt.statistik.sitzungen, 1);
  assert.strictEqual(geteilt.statistik.personen, 2);
  assert.strictEqual(geteilt.statistik.anlagen, 1);
  assert.strictEqual(geteilt.statistik.revision, 12);
  assert.ok(geteilt.statistik.smGroesse > geteilt.statistik.pmGroesse * 1.5,
    'die Protokoll-Datei ist deutlich kleiner, weil die Anlagen-Bytes fehlen');

  const zurueck = await seite.evaluate(`
    (async () => {
      const { Krypto, base64ZuBytes, zugangEntsperren } = window.WERKZEUG;
      const lies = async text => {
        const d = JSON.parse(text);
        const auf = await zugangEntsperren(d.zugang, 'geheim-viewer');
        return { modul: d.modul, rolle: auf.rolle, p: await Krypto.dechiffriere(auf.mk, d.iv, base64ZuBytes(d.ct).buffer) };
      };
      const sm = await lies(window.__sm.text);
      const pm = await lies(window.__pm.text);
      return {
        smModul: sm.modul, pmModul: pm.modul, rolle: sm.rolle,
        smAnlagen: Object.keys(sm.p.dokumentInhalte || {}).length,
        pmAnlagen: Object.keys(pm.p.dokumentInhalte || {}).length,
        smDokMeta: (sm.p.dokumente || []).map(d => d.name),
        pmDokMeta: (pm.p.dokumente || []).map(d => d.name),
        smSitzungen: sm.p.sitzungen.length, pmSitzungen: pm.p.sitzungen.length,
        pmVerlauf: pm.p.sitzungen[0].tops[0].verlauf,
        pmBeschluss: pm.p.sitzungen[0].tops[0].beschluesse[0].antrag,
        pmAnlagenVerweis: pm.p.sitzungen[0].tops[0].anlagen.map(a => a.name),
        pmPersonen: pm.p.personen.length, pmFirma: pm.p.stammdaten.firma,
        pmRevision: pm.p.revision
      };
    })()
  `);
  assert.strictEqual(zurueck.rolle, 'viewer', 'auch das Viewer-Passwort öffnet die neuen Dateien');
  assert.strictEqual(zurueck.smModul, 'sitzung');
  assert.strictEqual(zurueck.pmModul, 'protokoll');
  assert.strictEqual(zurueck.smAnlagen, 1, 'die Anlagen-Datei bleibt beim Sitzungsmanager');
  assert.strictEqual(zurueck.pmAnlagen, 0, 'das Protokollmodul bekommt keine Anlagen-Bytes');
  assert.deepStrictEqual(zurueck.pmDokMeta, ['Beschlussvorlage.pdf'], 'die Verweise bleiben aber erhalten');
  assert.deepStrictEqual(zurueck.smDokMeta, zurueck.pmDokMeta, 'beide führen dieselben Anlagen im Verzeichnis');
  assert.deepStrictEqual(zurueck.pmAnlagenVerweis, ['Beschlussvorlage.pdf'], 'auch am TOP');
  assert.strictEqual(zurueck.smSitzungen, 1);
  assert.strictEqual(zurueck.pmSitzungen, 1, 'die Sitzungen stehen vollständig in beiden Dateien');
  assert.strictEqual(zurueck.pmVerlauf, '<p>Protokolltext.</p>', 'Protokollinhalte bleiben');
  assert.strictEqual(zurueck.pmBeschluss, 'Wortlaut');
  assert.strictEqual(zurueck.pmPersonen, 2);
  assert.strictEqual(zurueck.pmFirma, 'Teil GmbH');
  assert.strictEqual(zurueck.pmRevision, 12, 'die Revisionsnummer bleibt in beiden erhalten');

  const meldungen = await seite.evaluate(`
    (async () => {
      const raus = [];
      const versuch = async (inhalt, pw) => {
        try { await window.WERKZEUG.aufteilen(new File([inhalt], 'x.json'), pw); raus.push('(kein Fehler)'); }
        catch (e) { raus.push(e.message); }
      };
      await versuch(window.__sicherung, 'falsch');
      await versuch(JSON.stringify({ app: 'br-sitzungsmanager', format: 'sitzung-v1' }), 'egal');
      await versuch('kein json', 'egal');
      await versuch(JSON.stringify({ was: 'anderes' }), 'egal');
      return raus;
    })()
  `);
  assert.ok(meldungen[0].includes('Passwort passt nicht'), 'falsches Passwort wird benannt');
  assert.ok(meldungen[1].includes('Übergabedatei'), 'Übergabedatei wird erkannt');
  assert.ok(meldungen[2].includes('JSON'), 'kaputte Datei wird benannt');
  assert.ok(meldungen[3].includes('Keine Sicherung'), 'Fremddatei wird abgewiesen');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Umwandler teilt eine Sicherung; Passwörter und Verweise bleiben gültig');
}

/* Aufräum-Werkzeug br-anlagen-entfernen.html */
async function pruefeAufraeumen() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('br-anlagen-entfernen.html'));
  await seite.waitForFunction('!!window.WERKZEUG', null, { timeout: 5000 });

  const gebaut = await seite.evaluate(`
    (async () => {
      const { Krypto, bytesZuBase64 } = window.WERKZEUG;
      const mkBytes = crypto.getRandomValues(new Uint8Array(32));
      const mk = await Krypto.mkAusBytes(mkBytes);
      const iter = 1000;
      const zugang = { v: 2, iter: iter };
      for (const [feld, pw] of [['arbeit', 'pw-arbeit'], ['viewer', 'pw-viewer']]) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const k = await Krypto.schluessel(pw, salt, iter);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, mkBytes);
        zugang[feld] = { salt: Array.from(salt), iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
      }
      const nutzlast = {
        app: 'br-sitzungsmanager', version: 1, revision: 5,
        stammdaten: { firma: 'Aufraeum GmbH' },
        personen: [{ id: 'p1', name: 'Erika Mustermann', gruppe: 'br' }],
        dokumente: [{ id: 'd1', name: 'Protokoll.pdf', kategorie: 'protokoll', quelle: 'generiert' },
                    { id: 'd2', name: 'Anlage.pdf', kategorie: 'anlage-to', quelle: 'upload' }],
        dokumentInhalte: { d1: bytesZuBase64(new Uint8Array(60000).fill(65)),
                           d2: bytesZuBase64(new Uint8Array(20000).fill(66)) },
        sitzungen: [{ id: 's1', nr: '01/2026',
          tops: [{ id: 't1', titel: 'TOP', anlagen: [{ id: 'a1', name: 'Anlage.pdf', dokumentId: 'd2' }],
                   beschluesse: [{ id: 'b1', antrag: 'Wortlaut' }] }] }],
        exportOptionen: {}
      };
      const { iv, ct } = await Krypto.chiffriere(mk, nutzlast);
      window.__sicherung = JSON.stringify({ app: 'br-sitzungsmanager', format: 'enc-v2', zugang: zugang,
        iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) });
      return { groesse: window.__sicherung.length };
    })()
  `);
  assert.ok(gebaut.groesse > 100000, 'Testsicherung enthält die Anlagen-Bytes');

  const bereinigt = await seite.evaluate(`
    (async () => {
      const f = new File([window.__sicherung], 'BR-Sitzungen_Rev0005.brenc.json', { type: 'application/json' });
      const r = await window.WERKZEUG.anlagenAusDatei(f, 'pw-arbeit');
      const d = JSON.parse(r.text);
      const auf = await window.WERKZEUG.zugangEntsperren(d.zugang, 'pw-viewer');
      const p = await window.WERKZEUG.Krypto.dechiffriere(auf.mk, d.iv, window.WERKZEUG.base64ZuBytes(d.ct).buffer);
      return {
        statistik: r.statistik, name: r.name,
        inhalte: Object.keys(p.dokumentInhalte || {}).length,
        verweise: (p.dokumente || []).map(x => x.name),
        anlageAmTop: p.sitzungen[0].tops[0].anlagen.map(a => a.name),
        beschluss: p.sitzungen[0].tops[0].beschluesse[0].antrag,
        firma: p.stammdaten.firma, personen: p.personen.length, revision: p.revision
      };
    })()
  `);
  assert.strictEqual(bereinigt.name, 'BR-Sitzungen_Rev0005_ohne-Anlagen.brenc.json');
  assert.strictEqual(bereinigt.statistik.anzahl, 2, 'beide Anlagen-Dateien entfernt');
  assert.ok(bereinigt.statistik.bytes > 70000, 'die eingesparte Menge wird beziffert');
  assert.strictEqual(bereinigt.statistik.verweise, 2, 'die Verweise werden gezählt');
  assert.ok(bereinigt.statistik.nachher < bereinigt.statistik.vorher / 2, 'die Datei schrumpft deutlich');
  assert.strictEqual(bereinigt.inhalte, 0, 'keine Anlagen-Bytes mehr enthalten');
  assert.deepStrictEqual(bereinigt.verweise, ['Protokoll.pdf', 'Anlage.pdf'], 'die Verweisliste bleibt vollständig');
  assert.deepStrictEqual(bereinigt.anlageAmTop, ['Anlage.pdf'], 'auch der Verweis am TOP bleibt');
  assert.strictEqual(bereinigt.beschluss, 'Wortlaut', 'Protokollinhalte bleiben unberührt');
  assert.strictEqual(bereinigt.firma, 'Aufraeum GmbH');
  assert.strictEqual(bereinigt.personen, 1);
  assert.strictEqual(bereinigt.revision, 5, 'die Revisionsnummer bleibt');

  const meldungen = await seite.evaluate(`
    (async () => {
      const raus = [];
      const versuch = async (inhalt, pw) => {
        try { await window.WERKZEUG.anlagenAusDatei(new File([inhalt], 'x.json'), pw); raus.push('(kein Fehler)'); }
        catch (e) { raus.push(e.message); }
      };
      await versuch(window.__sicherung, 'falsch');
      await versuch(JSON.stringify({ app: 'br-sitzungsmanager', format: 'tagesordnung-v1' }), 'egal');
      await versuch('kein json', 'egal');
      await versuch(JSON.stringify({ was: 'anderes' }), 'egal');
      return raus;
    })()
  `);
  assert.ok(meldungen[0].includes('Passwort passt nicht'), 'falsches Passwort wird benannt');
  assert.ok(meldungen[1].includes('Übergabedatei'), 'Übergabedatei wird erkannt');
  assert.ok(meldungen[2].includes('JSON'), 'kaputte Datei wird benannt');
  assert.ok(meldungen[3].includes('Keine Sicherung'), 'Fremddatei wird abgewiesen');

  const angelegt = await seite.evaluate(`
    (async () => {
      const db = await new Promise((ok, err) => {
        const r = indexedDB.open('br-sitzungsmanager-protokoll', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          d.createObjectStore('meta');
          d.createObjectStore('sitzungen', { keyPath: 'id' });
          d.createObjectStore('dokumente', { keyPath: 'id' });
        };
        r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
      });
      await new Promise((ok, err) => {
        const tx = db.transaction(['dokumente', 'sitzungen'], 'readwrite');
        for (let i = 0; i < 3; i++) {
          tx.objectStore('dokumente').put({ id: 'dok' + i, iv: new Uint8Array(12), ct: new Uint8Array(50000).buffer });
        }
        tx.objectStore('sitzungen').put({ id: 's1', iv: new Uint8Array(12), ct: new Uint8Array(100).buffer });
        tx.oncomplete = () => ok(); tx.onerror = () => err(tx.error);
      });
      db.close();
      return true;
    })()
  `);
  assert.ok(angelegt);

  const gezaehlt = await seite.evaluate(`window.WERKZEUG.ablageZaehlen('br-sitzungsmanager-protokoll')`);
  assert.strictEqual(gezaehlt.anzahl, 3, 'die drei Blobs werden gefunden');
  assert.ok(gezaehlt.bytes >= 150000, 'der Umfang wird aus dem Chiffrat geschätzt');
  assert.strictEqual(gezaehlt.fehlt, false);

  const vorher = await seite.evaluate('window.WERKZEUG.vorhandeneDbs()');
  const fehlend = await seite.evaluate(`window.WERKZEUG.ablageZaehlen('br-gibt-es-nicht')`);
  const nachher = await seite.evaluate('window.WERKZEUG.vorhandeneDbs()');
  assert.strictEqual(fehlend.fehlt, true, 'nicht vorhandene Ablage wird erkannt');
  assert.deepStrictEqual(nachher, vorher, 'und dabei keine leere Datenbank angelegt');

  const geleert = await seite.evaluate(`
    (async () => {
      const weg = await window.WERKZEUG.ablageLeeren('br-sitzungsmanager-protokoll');
      const danach = await window.WERKZEUG.ablageZaehlen('br-sitzungsmanager-protokoll');
      const db = await new Promise((ok, err) => {
        const r = indexedDB.open('br-sitzungsmanager-protokoll');
        r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
      });
      const sitzungen = await new Promise((ok, err) => {
        const g = db.transaction('sitzungen', 'readonly').objectStore('sitzungen').getAll();
        g.onsuccess = () => ok(g.result.length); g.onerror = () => err(g.error);
      });
      db.close();
      return { weg: weg, danach: danach.anzahl, sitzungen: sitzungen };
    })()
  `);
  assert.strictEqual(geleert.weg, 3, 'drei Blobs entfernt');
  assert.strictEqual(geleert.danach, 0, 'die Ablage ist danach leer');
  assert.strictEqual(geleert.sitzungen, 1, 'Sitzungen bleiben unangetastet');

  await seite.evaluate(`indexedDB.deleteDatabase('br-sitzungsmanager-protokoll')`);
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Aufräum-Werkzeug: Sicherung bereinigen und Browser-Ablage leeren');
}

/* Anmeldung: nur „Datei laden", Reload ohne Passwort, „Datei schließen" sperrt wieder.
   Nutzt die lokalen Wegwerf-Passwoerter aus scripts/br-zugang.js (nicht im Repo auf GitHub). */
async function pruefeAnmeldung() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.waitForSelector('#sperrschirm .sperr-karte');

  /* Ohne die lokale br-zugang.js gibt es kein Passwort zum Anmelden – dann bleibt nur der Sperrschirm zu prüfen. */
  if (!(await seite.evaluate('!!externerZugang()'))) {
    await browser.close();
    console.log('--  Anmeldung: übersprungen (scripts/br-zugang.js fehlt)');
    return;
  }

  const schirm = await seite.evaluate(`
    (() => {
      const el = document.getElementById('sperrschirm');
      return { knoepfe: Array.from(el.querySelectorAll('button')).map(b => b.textContent.trim()),
               passwortfelder: el.querySelectorAll('input[type=password]').length };
    })()
  `);
  assert.deepStrictEqual(schirm.knoepfe, ['Datei laden'], 'der Sperrschirm bietet genau eine Option');
  assert.strictEqual(schirm.passwortfelder, 0, 'und fragt das Passwort erst nach der Dateiwahl');

  /* Sicherung aus der lokalen br-zugang.js bauen und wie eine gewaehlte Datei einspielen. */
  const angemeldet = await seite.evaluate(`
    (async () => {
      const auf = await zugangEntsperren(window.BR_ZUGANG, 'worktest');
      const projekt = leeresProjekt();
      projekt.stammdaten.gremium = 'Testgremium';
      projekt.sitzungen = [neueSitzung(projekt)];
      const { iv, ct } = await Krypto.chiffriere(auf.mk, projekt);
      const datei = { app: 'br-sitzungsmanager', format: 'enc-v2', zugang: window.BR_ZUGANG,
                      iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
      /* passwortAbfrage() ueberbruecken: der Dialog wuerde auf eine Eingabe warten. */
      window.passwortAbfrage = () => Promise.resolve('worktest');
      await projektBeitreten(new File([JSON.stringify(datei)], 'Test.brenc.json'));
      return { schirm: !!document.getElementById('sperrschirm'), rolle: sitzungsRolle,
               gremium: daten.stammdaten.gremium, sitzungen: daten.sitzungen.length,
               gemerkt: !!sessionStorage.getItem('br-sitzungsmanager.sitzung') };
    })()
  `);
  assert.strictEqual(angemeldet.schirm, false, 'nach dem Laden der Datei ist der Sperrschirm weg');
  assert.strictEqual(angemeldet.rolle, 'arbeit', 'das Arbeits-Passwort öffnet den Bearbeitungsmodus');
  assert.strictEqual(angemeldet.gremium, 'Testgremium', 'die Daten der Datei sind da');
  assert.ok(angemeldet.gemerkt, 'die Sitzung ist für den Tab gemerkt');

  await seite.reload();
  await seite.waitForFunction('typeof daten !== "undefined" && daten !== null', null, { timeout: 5000 });
  const nachReload = await seite.evaluate(`
    ({ schirm: !!document.getElementById('sperrschirm'), rolle: sitzungsRolle,
       gremium: daten.stammdaten.gremium, sitzungen: daten.sitzungen.length })
  `);
  assert.strictEqual(nachReload.schirm, false, 'das Neuladen verlangt kein Passwort');
  assert.strictEqual(nachReload.rolle, 'arbeit', 'die Rolle bleibt erhalten');
  assert.strictEqual(nachReload.gremium, 'Testgremium', 'und die Daten gehen nicht verloren');
  assert.strictEqual(nachReload.sitzungen, 1, 'die Sitzungen sind vollständig');

  const geschlossen = await seite.evaluate(`
    (() => {
      sperren();
      return { schirm: !!document.getElementById('sperrschirm'), schluessel: sitzungsSchluessel,
               gemerkt: sessionStorage.getItem('br-sitzungsmanager.sitzung') };
    })()
  `);
  assert.ok(geschlossen.schirm, '„Datei schließen" führt zurück zum Sperrschirm');
  assert.strictEqual(geschlossen.schluessel, null, 'der Schlüssel ist aus dem Speicher');
  assert.strictEqual(geschlossen.gemerkt, null, 'und der Tab merkt sich nichts mehr');

  await seite.evaluate(`indexedDB.deleteDatabase('br-sitzungsmanager')`);
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Anmeldung: nur Datei laden, Reload ohne Passwort, Schließen sperrt');
}

/* Erstinbetriebnahme: der Verschluesselungsgenerator liefert einen leeren Speicherstand, den die Module laden koennen. */
async function pruefeErstinbetriebnahme() {
  if (!fs.existsSync(path.join(__dirname, 'br-verschluesselung-generator.html'))) {
    console.log('--  Erstinbetriebnahme: übersprungen (br-verschluesselung-generator.html fehlt)');
    return;
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const fehler = [];
  const gen = await ctx.newPage();
  gen.on('pageerror', e => fehler.push('generator: ' + e.message));
  await gen.goto(DATEI('br-verschluesselung-generator.html'));
  await gen.fill('#viewer', 'viewertest');
  await gen.fill('#arbeit', 'worktest');
  await gen.fill('#admin', 'debugtest');
  await gen.click('#erzeugen');
  await gen.waitForSelector('#ergebnis.an', { timeout: 60000 });

  const stand = await gen.evaluate('standInhalt');
  const datei = JSON.parse(stand);
  assert.strictEqual(datei.format, 'enc-v2', 'der Speicherstand hat das Sicherungsformat der App');
  assert.ok(datei.zugang && datei.zugang.arbeit && datei.zugang.viewer, 'und trägt den Zugang mit');
  assert.ok(await gen.evaluate('!!zugangInhalt'), 'br-zugang.js entsteht weiterhin');

  const app = await ctx.newPage();
  app.on('pageerror', e => fehler.push('protokoll: ' + e.message));
  await app.goto(DATEI('BR-Protokoll.html'));
  await app.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  if (!(await app.evaluate('!!externerZugang()'))) {
    await browser.close();
    console.log('--  Erstinbetriebnahme: übersprungen (scripts/br-zugang.js fehlt)');
    return;
  }

  /* Der lokale Zugang bleibt maßgeblich – dasselbe Arbeits-Passwort öffnet beide. */
  const geladen = await app.evaluate(`
    (async () => {
      window.passwortAbfrage = () => Promise.resolve('worktest');
      await projektBeitreten(new File([${JSON.stringify(stand)}], 'Start.brenc.json'));
      return { schirm: !!document.getElementById('sperrschirm'), rolle: sitzungsRolle,
               sitzungen: daten.sitzungen.length, kategorien: daten.kategorien.length,
               standardTops: daten.standardTops.length, revision: daten.revision };
    })()
  `);
  assert.strictEqual(geladen.schirm, false, 'der erzeugte Speicherstand öffnet das Protokollmodul');
  assert.strictEqual(geladen.rolle, 'arbeit', 'mit der Rolle aus dem eingegebenen Passwort');
  assert.strictEqual(geladen.sitzungen, 0, 'er startet ohne Sitzungen');
  assert.ok(geladen.kategorien >= 5 && geladen.standardTops >= 4, 'die Vorgabewerte ergänzt migriere() beim Laden');
  assert.strictEqual(geladen.revision, 1, 'Revision 1 als Startstand');

  await app.evaluate(`indexedDB.deleteDatabase('br-sitzungsmanager-protokoll')`);
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Erstinbetriebnahme: Verschlüsselungsgenerator liefert ladbare Speicherstände');
}

/* Zeilenumbrueche im Verlauf: Enter im Editor, Speichern/Laden und PDF-Bloecke. */
async function pruefeVerlaufUmbrueche() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  await seite.goto(DATEI('BR-Protokoll.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });

  const ergebnis = await seite.evaluate(`
    (() => {
      /* Enter erzeugt in Chrome eine <div> je Zeile, Umschalt+Enter ein <br>. */
      const ed = document.createElement('div');
      ed.contentEditable = 'true'; document.body.appendChild(ed); ed.focus();
      document.execCommand('insertText', false, 'Zeile eins');
      document.execCommand('insertParagraph');
      document.execCommand('insertText', false, 'Zeile zwei');
      document.execCommand('insertLineBreak');
      document.execCommand('insertText', false, 'Zeile drei');
      const gespeichert = sanitizeVerlaufHtml(ed.innerHTML);
      ed.remove();
      /* Wie beim Laden einer Sicherung durch migriere() geschickt. */
      const geladen = migriere({ app: 'br-sitzungsmanager', version: 1, sitzungen: [
        { id: 's1', nr: '01/2026', tops: [{ id: 't1', titel: 'TOP', verlauf: gespeichert }] }
      ] }).sitzungen[0].tops[0].verlauf;
      const text = html => verlaufZuBloecken(html).map(b => b.runs.map(r => r.text).join('')).join('|');
      return {
        gespeichert: gespeichert, geladen: geladen,
        bloecke: text(gespeichert), nachLaden: text(geladen),
        verschachtelt: text('<div><div>oben</div><div>unten</div></div>'),
        alterKlartext: text(migriereVerlauf('Alt eins' + String.fromCharCode(10) + 'Alt zwei'))
      };
    })()
  `);
  assert.ok(/Zeile eins/.test(ergebnis.gespeichert) && /Zeile zwei/.test(ergebnis.gespeichert));
  assert.strictEqual(ergebnis.bloecke, 'Zeile eins|Zeile zwei\nZeile drei',
    'Enter trennt Absätze, Umschalt+Enter setzt einen Zeilenumbruch');
  assert.strictEqual(ergebnis.geladen, ergebnis.gespeichert, 'das Laden lässt den Verlauf unverändert');
  assert.strictEqual(ergebnis.nachLaden, ergebnis.bloecke, 'und die Umbrüche stehen auch im PDF-Export');
  assert.strictEqual(ergebnis.verschachtelt, 'oben\nunten', 'verschachtelte Blöcke verschmelzen nicht zu einer Zeile');
  assert.strictEqual(ergebnis.alterKlartext, 'Alt eins\nAlt zwei', 'Klartext-Altbestand behält seine Umbrüche');

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Verlauf: Zeilenumbrüche überleben Speichern, Laden und Export');
}

/* Kategorie am Unterpunkt, nicht beteiligte Mitglieder je Beschluss, tatsächlicher Sitzungsbeginn */
async function pruefeUnterpunktKategorieBeteiligungBeginn() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Protokoll.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);

  const erg = await seite.evaluate(`
    (async () => {
      const s = daten.sitzungen[0];
      const top = s.tops[0];
      top.unterpunkte = [neuerUnterpunkt({ titel: 'Teilfrage' })];
      const to = document.createElement('div');
      document.body.appendChild(to);
      to.appendChild(topEditor(s, top, 0));
      const topKat = to.querySelector('.top-koerper > .raster [data-f="kategorie"]').value;
      const ukat = to.querySelector('.unterpunkt-zeile [data-f="kategorie"]');
      const ukatStart = ukat.value;
      ukat.value = 'beschluss'; ukat.dispatchEvent(new Event('change'));
      top.kategorie = 'beratung';
      const to2 = document.createElement('div');
      to2.appendChild(topEditor(s, top, 0));
      to2.querySelector('.unterpunkte-bereich > [data-tu="neu"]').click();
      const geerbt = top.unterpunkte[1].kategorie;
      top.unterpunkte.pop();

      /* Teil-Anwesenheit über die Tabelle: m3 nur bei einem anderen TOP */
      s.tops.push(neuerTop({ titel: 'Zweiter TOP' }));
      const tn = document.createElement('div');
      for (const id of ['m1', 'm2', 'm3']) s.teilnahme[id] = { status: 'anwesend', vertretenDurch: '' };
      anwesenheitTabelle(tn, s, null);
      const zeile3 = tn.querySelector('tr[data-mid="m3"]');
      const tw = zeile3.querySelector('[data-f="teilweise"]');
      tw.checked = true; tw.dispatchEvent(new Event('change'));
      const topCb = zeile3.querySelectorAll('[data-topwahl] input');
      topCb[1].checked = true; topCb[1].dispatchEvent(new Event('change'));
      const teilTops = s.teilnahme.m3.tops.slice();
      const basisTop1 = abstimmungsBasis(daten, s, { nichtBeteiligt: {} }, top).teilnehmend;
      delete s.teilnahme.m3.tops;
      s.tops.pop();

      for (const id of ['m1', 'm2', 'm3']) s.teilnahme[id] = { status: 'anwesend', vertretenDurch: '' };
      const b = neuerBeschluss(daten, 2026);
      Object.assign(b, { antrag: 'Wortlaut', ja: '1', nein: '0', enthaltung: '0' });
      top.beschluesse = [b];
      const c = document.createElement('div');
      document.body.appendChild(c);
      renderTabProtokoll(c, s);
      const block = c.querySelector('.beschluss-block');
      const vorher = block.querySelector('[data-ergebnis]').textContent;
      const waehle = (id, grund) => {
        const sel = block.querySelector('[data-mitglied="' + id + '"]');
        sel.value = grund; sel.dispatchEvent(new Event('change'));
      };
      waehle('m2', 'abwesend');
      waehle('m3', 'nicht_stimmberechtigt');

      c.querySelector('[data-jetzt="fBeginnT"]').click();
      c.querySelector('[data-jetzt="fEndeT"]').click();
      const pdf = await erzeugeProtokollPdf(daten, s, {});
      return {
        topKat, ukatStart, ukatGespeichert: top.unterpunkte[0].kategorie, geerbt,
        topCbZahl: topCb.length, teilTops, basisTop1,
        vorher, nachher: block.querySelector('[data-ergebnis]').textContent,
        warnung: block.querySelector('[data-warnung]').textContent,
        titel: block.querySelector('[data-beteiligung-titel]').textContent,
        auswahl: block.querySelectorAll('[data-mitglied]').length,
        gespeichert: b.nichtBeteiligt,
        beginn: s.beginnTatsaechlich, beginnFeld: c.querySelector('#fBeginnT').value, ende: s.endeTatsaechlich,
        pdf: pdf.length
      };
    })()
  `);
  assert.strictEqual(erg.topKat, '', 'neuer TOP steht in der Auswahl auf „– ohne –"');
  assert.strictEqual(erg.ukatStart, '', 'Unterpunkt startet ohne Kategorie');
  assert.strictEqual(erg.ukatGespeichert, 'beschluss', 'Kategorie am Unterpunkt wird gespeichert');
  assert.strictEqual(erg.geerbt, 'beratung', 'neuer Unterpunkt übernimmt die Kategorie des TOP');
  assert.strictEqual(erg.topCbZahl, 2, 'Teil-Anwesenheit bietet jeden TOP zur Auswahl');
  assert.strictEqual(erg.teilTops.length, 1, 'die gewählten TOPs werden gespeichert');
  assert.strictEqual(erg.basisTop1, 2, 'wer nur bei TOP 2 da ist, stimmt bei TOP 1 nicht mit');
  assert.ok(erg.vorher.startsWith('Abgelehnt'), '1 Ja von 3 Teilnehmenden ist keine Mehrheit');
  assert.ok(erg.nachher.startsWith('Angenommen'), '1 Ja vom einzig Beteiligten ist die Mehrheit');
  assert.ok(erg.warnung.includes('nicht beschlussfähig'), 'zu wenige Beteiligte werden gemeldet');
  assert.strictEqual(erg.titel, 'Nicht an der Abstimmung beteiligt (2)');
  assert.strictEqual(erg.auswahl, 3, 'zur Auswahl stehen die teilnehmenden Mitglieder');
  assert.deepStrictEqual(erg.gespeichert, { m2: 'abwesend', m3: 'nicht_stimmberechtigt' });
  assert.ok(/^\d\d:\d\d$/.test(erg.beginn) && erg.beginnFeld === erg.beginn, '„Jetzt" trägt den Beginn ein');
  assert.ok(/^\d\d:\d\d$/.test(erg.ende), '„Jetzt" trägt auch das Ende ein');
  assert.ok(erg.pdf > 1000, 'die Niederschrift entsteht');
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Unterpunkt-Kategorie, Beteiligung je Beschluss, tatsächlicher Sitzungsbeginn');
}

/* Einladungs-Mail: multipart/alternative mit Text- und HTML-Teil im Layout des PDFs, Logo per Content-ID */
function mimeTeile(roh) {
  const kopfEnde = roh.indexOf('\r\n\r\n');
  const kopf = roh.slice(0, kopfEnde), rumpf = roh.slice(kopfEnde + 4);
  const grenze = (/boundary="([^"]+)"/.exec(kopf) || [])[1];
  const typ = (/Content-Type: ([^;\r\n]+)/i.exec(kopf) || [])[1];
  if (!grenze) {
    const b64 = /Content-Transfer-Encoding: base64/i.test(kopf);
    return [{ typ, kopf, inhalt: b64 ? Buffer.from(rumpf.replace(/\s+/g, ''), 'base64') : Buffer.from(rumpf) }];
  }
  return rumpf.split('--' + grenze).slice(1, -1).map(t => t.replace(/^\r\n/, '').replace(/\r\n$/, ''))
    .flatMap(mimeTeile);
}
async function pruefeEinladungsMail() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);
  const erg = await seite.evaluate(`
    (() => {
      const s = daten.sitzungen[0];
      s.nr = '07/2026'; s.beginn = '14:00'; s.ort = 'Raum 3 <Nord>';
      s.tops[0].kategorie = 'beratung'; s.tops[0].beschreibung = 'Zeile 1\\nZeile 2';
      s.tops[0].unterpunkte = [neuerUnterpunkt({ titel: 'Teilpunkt', kategorie: 'beschluss' })];
      daten.stammdaten.erscheinung = { akzent: '#8E1B3A' };
      daten.stammdaten.vertraulich = true;
      const ohneLogo = erzeugeEinladungEml(daten, s);
      daten.stammdaten.logo = { name: 'Mein "Logo" ä.png', mime: 'image/png', size: 70,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' };
      return { ohneLogo, mitLogo: erzeugeEinladungEml(daten, s), text: einladungVolltext(daten, s),
               dunkel: akzentPalette('#8E1B3A').dunkel };
    })()
  `);
  const teile = mimeTeile(erg.mitLogo);
  const typen = teile.map(t => t.typ);
  assert.deepStrictEqual(typen, ['text/plain', 'text/html', 'image/png'], 'Text, HTML und Logo');
  assert.ok(/^Content-Type: multipart\/alternative;/m.test(erg.mitLogo), 'Text und HTML als Alternativen');
  assert.ok(/^X-Unsent: 1$/m.test(erg.mitLogo), 'öffnet in Outlook als Entwurf');
  assert.ok(erg.mitLogo.split('\r\n').every(z => z.length <= 998), 'keine Zeile über dem SMTP-Limit');
  assert.strictEqual(teile[0].inhalt.toString('utf8').trim(), erg.text.trim(), 'der Textteil ist die bisherige Fassung');
  const html = teile[1].inhalt.toString('utf8');
  for (const erwartet of ['EINLADUNG ZUR ORDENTLICHEN BETRIEBSRATSSITZUNG NR. 07/2026'.toLowerCase(), 'tagesordnung', 'hinweise', 'mit freundlichen grüßen']) {
    assert.ok(html.toLowerCase().includes(erwartet), 'HTML enthält „' + erwartet + '"');
  }
  assert.ok(html.includes('Testpunkt') && html.includes('1.1&nbsp;&nbsp;Teilpunkt'), 'TOPs und Unterpunkte');
  assert.ok(html.includes('Beratung') && html.includes('Beschlussfassung'), 'Kategorien von TOP und Unterpunkt');
  assert.ok(html.includes('Zeile 1<br>Zeile 2'), 'Zeilenumbrüche der Erläuterung bleiben');
  assert.ok(html.includes('Raum 3 &lt;Nord&gt;') && !html.includes('<Nord>'), 'Eingaben werden escapt');
  assert.ok(html.includes('dashed #8E1B3A') && html.includes('color:' + erg.dunkel), 'Akzentfarbe des Gremiums');
  assert.ok(html.includes('Vertraulich – nur für den internen Gebrauch des Gremiums'), 'Vertraulich-Vermerk wie im PDF');
  assert.ok(html.includes('14:00 Uhr') && !html.includes('Uhr Uhr'), 'Uhrzeit ohne doppeltes „Uhr"');
  assert.ok(!erg.text.includes('Uhr Uhr'), 'auch die Textfassung');
  assert.ok(html.includes('src="cid:logo@br-sitzungsmanager"'), 'Logo über die Content-ID');
  assert.ok(/Content-ID: <logo@br-sitzungsmanager>/.test(erg.mitLogo) && /filename="logo\.png"/.test(erg.mitLogo),
    'Logo-Teil mit sicherem Dateinamen');
  assert.ok(teile[2].inhalt.slice(1, 4).toString() === 'PNG', 'das Logo kommt unverändert an');
  const ohne = mimeTeile(erg.ohneLogo);
  assert.deepStrictEqual(ohne.map(t => t.typ), ['text/plain', 'text/html'], 'ohne Logo kein Bildteil');
  assert.ok(!ohne[1].inhalt.toString('utf8').includes('cid:'), 'und kein Bildverweis');
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Einladungs-Mail: HTML im Layout des PDFs, Textfassung als Alternative, Logo eingebettet');
}

/* Admin-Menü: nur im Debug-Mode, ein Reiter je Bereich, merkt sich den zuletzt gewählten */
async function pruefeAdminMenue() {
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Sitzungsmanager.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);

  const erg = await seite.evaluate(`
    (() => {
      const dlg = document.getElementById('dlgStammdaten');
      const knopf = document.getElementById('btnStammdaten');
      aktualisiereRollenUi();
      const arbeitKnopf = knopf.style.display;
      oeffneStammdaten();
      const arbeitOffen = dlg.open;

      sitzungsRolle = 'admin';
      aktualisiereRollenUi();
      ui.adminReiter = undefined;
      oeffneStammdaten();
      const sichtbar = () => Array.from(dlg.querySelectorAll('.adm-reiter')).filter(s => !s.hidden).map(s => s.dataset.reiter);
      const reiter = Array.from(dlg.querySelectorAll('.dlg-nav [data-reiter]')).map(b => b.textContent);
      const start = sichtbar();
      dlg.querySelector('.dlg-nav [data-reiter="urlaub"]').click();
      const nachKlick = sichtbar();
      const gewaehlt = dlg.querySelector('.dlg-nav [aria-selected="true"]').dataset.reiter;
      const urlaubSichtbar = !!dlg.querySelector('#sdUrlaub').offsetParent;
      const gremiumVerdeckt = !dlg.querySelector('#sdGremium').offsetParent;
      dlg.querySelector('#sdFertig').click();
      oeffneStammdaten();
      const wiederOffen = sichtbar();
      const resetImReiter = dlg.querySelector('#sdReset').closest('.adm-reiter').dataset.reiter;
      const resetImFuss = !!dlg.querySelector('.dlg-fuss #sdReset');
      dlg.close();
      return {
        arbeitKnopf, arbeitOffen, adminKnopf: knopf.style.display, titel: knopf.textContent.trim(),
        kopf: dlg.querySelector('.dlg-kopf h3').textContent,
        reiter, start, nachKlick, gewaehlt, urlaubSichtbar, gremiumVerdeckt, wiederOffen, resetImReiter, resetImFuss
      };
    })()
  `);
  assert.strictEqual(erg.arbeitKnopf, 'none', 'im Arbeitsmodus ist der Knopf ausgeblendet');
  assert.ok(!erg.arbeitOffen, 'im Arbeitsmodus öffnet das Admin-Menü nicht');
  assert.strictEqual(erg.adminKnopf, '', 'im Debug-Mode ist der Knopf sichtbar');
  assert.strictEqual(erg.titel, 'Admin-Menü');
  assert.strictEqual(erg.kopf, 'Admin-Menü');
  assert.deepStrictEqual(erg.reiter, ['Gremium', 'Erscheinungsbild', 'Personen', 'Tagesordnung', 'Textbausteine', 'Beschluss-Tags', 'Urlaub', 'Zugang & System']);
  assert.deepStrictEqual(erg.start, ['gremium'], 'es ist immer genau ein Bereich sichtbar');
  assert.deepStrictEqual(erg.nachKlick, ['urlaub']);
  assert.strictEqual(erg.gewaehlt, 'urlaub', 'der Reiter ist als gewählt markiert');
  assert.ok(erg.urlaubSichtbar && erg.gremiumVerdeckt);
  assert.deepStrictEqual(erg.wiederOffen, ['urlaub'], 'beim erneuten Öffnen geht es beim letzten Reiter weiter');
  assert.strictEqual(erg.resetImReiter, 'zugang', 'Zurücksetzen steht im Gefahrenbereich, nicht mehr neben „Fertig"');
  assert.ok(!erg.resetImFuss);

  const mail = await seite.evaluate(`
    (() => {
      daten.personen = [
        { id: 'o1', name: 'Ordentlich Eins', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true, email: 'eins@firma.de' },
        { id: 'o2', name: 'Ordentlich Zwei', gruppe: 'br', funktion: 'Mitglied', aktiv: true, email: 'zwei@firma.de' },
        { id: 'e1', name: 'Ersatz Eins', gruppe: 'br', funktion: 'Ersatzmitglied', aktiv: true, email: 'ersatz@firma.de' },
        { id: 'x1', name: 'Ausgeschieden', gruppe: 'br', funktion: 'Ersatzmitglied', aktiv: false, email: 'alt@firma.de' }
      ];
      const s = daten.sitzungen[0];
      const offen = einladungEmpfaenger(daten, s);
      s.teilnahme.e1 = { status: 'anwesend', vertretenDurch: '' };
      const ohne = einladungEmpfaenger(daten, s);
      const dlg = document.getElementById('dlgStammdaten');
      oeffneStammdaten();
      dlg.querySelector('.dlg-nav [data-reiter="gremium"]').click();
      const feld = dlg.querySelector('#sdVerteiler');
      feld.value = ' br-verteiler@firma.de ';
      feld.dispatchEvent(new Event('input', { bubbles: true }));
      dlg.close();
      const mit = einladungEmpfaenger(daten, s);
      const to = erzeugeEinladungEml(daten, s).split(String.fromCharCode(13, 10)).find(z => z.startsWith('To: '));
      daten.personen.push({ id: 'e2', name: 'Ersatz Zwei', gruppe: 'br', funktion: 'Ersatzmitglied', aktiv: true, email: 'vertretung@firma.de' });
      s.teilnahme = { o2: { status: 'entschuldigt', vertretenDurch: '  ersatz zwei ' } };
      const vertretung = einladungEmpfaenger(daten, s);
      daten.personen.push({ id: 's1', name: 'Vertrauens Person', gruppe: 'sbv', funktion: 'Vertrauensperson', aktiv: true, email: 'vp@firma.de' });
      s.teilnahme = {};
      const sbvOhneGast = einladungEmpfaenger(daten, s);
      s.gaeste = [{ id: 'g1', name: 'Vertrauens Person', typ: 'sbv', funktion: '', tops: [] }];
      const sbvEinzeln = einladungEmpfaenger(daten, s);
      oeffneStammdaten();
      dlg.querySelector('.dlg-nav [data-reiter="gremium"]').click();
      const sbvFeld = dlg.querySelector('#sdSbvVerteiler');
      sbvFeld.value = ' sbv@firma.de ';
      sbvFeld.dispatchEvent(new Event('input', { bubbles: true }));
      dlg.close();
      const sbvMit = einladungEmpfaenger(daten, s);
      s.teilnahme = { e1: { status: 'anwesend', vertretenDurch: '' } };
      const protokoll = protokollFertigEmpfaenger(daten, s);
      s.teilnahme = {};
      daten.personen.push({ id: 'j1', name: 'Jugend Vertreter', gruppe: 'jav', funktion: 'Vorsitzende/r', aktiv: true, email: 'jv@firma.de' });
      s.gaeste.push({ id: 'g2', name: 'Jugend Vertreter', typ: 'jav', funktion: '', tops: [] });
      const javEinzeln = einladungEmpfaenger(daten, s);
      daten.stammdaten.javVerteiler = 'jav@firma.de';
      const javMit = einladungEmpfaenger(daten, s);
      const javProtokoll = protokollFertigEmpfaenger(daten, s);
      s.gaeste = [];
      const sbvNichtGeladen = einladungEmpfaenger(daten, s);
      return { offen, ohne, mit, to, vertretung, gespeichert: daten.stammdaten.verteiler,
        sbvOhneGast, sbvEinzeln, sbvMit, protokoll, javEinzeln, javMit, javProtokoll,
        javFeld: !!dlg.querySelector('#sdJavVerteiler'), sbvNichtGeladen, sbvGespeichert: daten.stammdaten.sbvVerteiler };
    })()
  `);
  assert.deepStrictEqual(mail.offen, ['eins@firma.de', 'zwei@firma.de'], 'Ersatzmitglied mit Status „offen" wird nicht eingeladen');
  assert.deepStrictEqual(mail.ohne, ['eins@firma.de', 'zwei@firma.de', 'ersatz@firma.de'], 'ohne Verteiler: alle aktiven einzeln, das geladene Ersatzmitglied dazu');
  assert.deepStrictEqual(mail.vertretung, ['br-verteiler@firma.de', 'vertretung@firma.de'],
    'ein unter „Vertreten durch" genanntes Ersatzmitglied ist geladen, auch ohne eigenen Status');
  assert.strictEqual(mail.gespeichert, 'br-verteiler@firma.de', 'der Verteiler wird im Admin-Menü gespeichert');
  assert.deepStrictEqual(mail.mit, ['br-verteiler@firma.de', 'ersatz@firma.de'],
    'mit Verteiler: der Verteiler statt der ordentlichen Mitglieder, Ersatzmitglieder weiter einzeln');
  assert.strictEqual(mail.to, 'To: br-verteiler@firma.de, ersatz@firma.de');
  assert.deepStrictEqual(mail.sbvOhneGast, ['br-verteiler@firma.de'], 'nicht geladene SBV bekommt keine Einladung');
  assert.deepStrictEqual(mail.sbvEinzeln, ['br-verteiler@firma.de', 'vp@firma.de'], 'ohne SBV-Verteiler: geladene SBV einzeln');
  assert.strictEqual(mail.sbvGespeichert, 'sbv@firma.de', 'der SBV-Verteiler wird im Admin-Menü gespeichert');
  assert.deepStrictEqual(mail.sbvMit, ['br-verteiler@firma.de', 'sbv@firma.de'], 'mit SBV-Verteiler: der Verteiler statt der Einzeladresse');
  assert.deepStrictEqual(mail.protokoll, ['br-verteiler@firma.de', 'ersatz@firma.de', 'sbv@firma.de'],
    '„Protokoll fertig": beide Verteiler statt Einzeladressen, anwesende Ersatzmitglieder einzeln');
  assert.ok(mail.javFeld, 'Feld für den JAV-Verteiler im Admin-Menü');
  assert.deepStrictEqual(mail.javEinzeln, ['br-verteiler@firma.de', 'sbv@firma.de', 'jv@firma.de'], 'ohne JAV-Verteiler: geladene JAV einzeln');
  assert.deepStrictEqual(mail.javMit, ['br-verteiler@firma.de', 'sbv@firma.de', 'jav@firma.de'], 'mit JAV-Verteiler: der Verteiler statt der Einzeladresse');
  assert.deepStrictEqual(mail.javProtokoll, ['br-verteiler@firma.de', 'sbv@firma.de', 'jav@firma.de'], '„Protokoll fertig" nutzt auch den JAV-Verteiler');
  assert.deepStrictEqual(mail.sbvNichtGeladen, ['br-verteiler@firma.de'], 'SBV-Verteiler nur, wenn die SBV geladen ist');

  const look = await seite.evaluate(`
    (() => {
      const dlg = document.getElementById('dlgStammdaten');
      const root = document.documentElement.style;
      const h1 = document.querySelector('.seitenleiste .marke h1');
      daten.stammdaten.logo = { name: 'logo.png', mime: 'image/png', size: 70,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' };
      renderAlles();
      const vorher = { akzent: root.getPropertyValue('--akzent'), h1: h1.textContent, titel: document.title };
      oeffneStammdaten();
      dlg.querySelector('.dlg-nav [data-reiter="erscheinung"]').click();
      dlg.querySelector('.farbfeld[data-farbe="#1F5FAD"]').click();
      const name = dlg.querySelector('#sdAppName');
      name.value = 'BR Werk Nord'; name.dispatchEvent(new Event('input', { bubbles: true }));
      const ut = dlg.querySelector('#sdUntertitel');
      ut.value = 'Sitzungen des Betriebsrats'; ut.dispatchEvent(new Event('input', { bubbles: true }));
      const cb = dlg.querySelector('#sdLogoLeiste');
      cb.checked = true; cb.dispatchEvent(new Event('change'));
      const nachher = {
        akzent: root.getPropertyValue('--akzent'), dunkel: root.getPropertyValue('--akzent-dunkel'),
        gewaehlt: dlg.querySelector('.farbfeld[aria-pressed="true"]').dataset.farbe,
        h1: h1.textContent, untertitel: document.querySelector('.seitenleiste .marke .untertitel').textContent,
        titel: document.title, logo: !!document.querySelector('.seitenleiste .marke-logo'),
        praes: praesentationHtml(daten, daten.sitzungen[0]).includes('--akz:#1F5FAD'),
        gespeichert: JSON.stringify(daten.stammdaten.erscheinung)
      };
      const gelb = dlg.querySelector('#sdAkzent');
      gelb.value = '#ffd400'; gelb.dispatchEvent(new Event('input'));
      const gelbInfo = dlg.querySelector('#sdAkzentInfo').textContent;
      dlg.querySelector('#sdErscheinungStandard').click();
      const zurueck = { akzent: root.getPropertyValue('--akzent'), h1: h1.textContent, titel: document.title,
                        logo: !!document.querySelector('.seitenleiste .marke-logo') };
      dlg.close();
      return { vorher, nachher, gelbInfo, zurueck };
    })()
  `);
  assert.strictEqual(look.vorher.akzent, '', 'Standard: keine Überschreibung der CSS-Variablen');
  assert.strictEqual(look.nachher.akzent, '#1F5FAD', 'die gewählte Farbe wird sofort angewendet');
  assert.ok(look.nachher.dunkel && look.nachher.dunkel !== '#00673E', 'die dunkle Variante wird abgeleitet');
  assert.strictEqual(look.nachher.gewaehlt, '#1F5FAD', 'das Farbfeld ist als gewählt markiert');
  assert.strictEqual(look.nachher.h1, 'BR Werk Nord');
  assert.strictEqual(look.nachher.untertitel, 'Sitzungen des Betriebsrats');
  assert.strictEqual(look.nachher.titel, 'BR Werk Nord – Sitzungsmanager');
  assert.ok(look.nachher.logo, 'das Logo steht in der Seitenleiste');
  assert.ok(look.nachher.praes, 'die Präsentation übernimmt die Farbe');
  assert.deepStrictEqual(JSON.parse(look.nachher.gespeichert),
    { akzent: '#1F5FAD', name: 'BR Werk Nord', untertitel: 'Sitzungen des Betriebsrats', logoSeitenleiste: true });
  assert.ok(look.gelbInfo.includes('abgedunkelt'), 'zu helle Farben werden sichtbar angepasst');
  assert.deepStrictEqual(look.zurueck, { akzent: '', h1: look.vorher.h1, titel: look.vorher.titel, logo: false },
    'Standard wiederherstellen setzt alles zurück');
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Admin-Menü: nur im Debug-Mode, Reiter je Bereich; Einladung über den Verteiler');
}

/* Formatgleichheit: Die Werkzeugseiten führen eigene Kopien des Krypto-Kerns. Hier schreibt und liest die echte App
   (sicherungVerpacken/sicherungEntpacken, zugangErzeugen) – ohne br-zugang.js, also auch in einem frischen Klon. */
async function pruefeFormatgleichheit() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const fehler = [];
  const oeffne = async datei => {
    const s = await ctx.newPage();
    s.on('pageerror', e => fehler.push(datei + ': ' + e.message));
    await s.goto(DATEI(datei));
    return s;
  };

  const app = await oeffne('BR-Sitzungsmanager.html');
  await app.waitForFunction('typeof sicherungVerpacken === "function"', null, { timeout: 5000 });
  const iterApp = await app.evaluate('PBKDF2_ITER');

  /* App → Datei: Zugang mit der vollen Iterationszahl, genau wie im Betrieb. */
  const sicherung = await app.evaluate(`
    (async () => {
      const mk = await Krypto.zufallsMk();
      const zugang = await zugangErzeugen(mk.bytes, { admin: 'fg-admin', arbeit: 'fg-arbeit', viewer: 'fg-viewer' });
      const nutzlast = {
        app: 'br-sitzungsmanager', version: 1, revision: 7,
        stammdaten: { gremium: 'Betriebsrat', firma: 'Format GmbH' },
        personen: [{ id: 'p1', name: 'Erika Mustermann', gruppe: 'br', funktion: 'Vorsitzende/r', aktiv: true }],
        dokumente: [{ id: 'dok1', name: 'Vorlage.pdf', kategorie: 'anlage-to', sitzungId: 's1', groesse: 2000 }],
        dokumentInhalte: { dok1: bytesZuBase64(new Uint8Array(2000).fill(66)) },
        sitzungen: [{ id: 's1', nr: '07/2026', datum: '2026-09-30',
          tops: [{ id: 't1', titel: 'TOP', verlauf: '<p>Text.</p>',
                   anlagen: [{ id: 'a1', name: 'Vorlage.pdf', dokumentId: 'dok1' }],
                   beschluesse: [{ id: 'b1', jahr: 2026, lfd: 1, antrag: 'Wortlaut' }] }] }]
      };
      return JSON.stringify(await sicherungVerpacken(mk.key, zugang, nutzlast));
    })()
  `);
  const liesInApp = (text, pw) => {
    const d = JSON.parse(text);   /* diese Weiche prüfen projektDateiOeffnen()/projektBeitreten() vor dem Entpacken */
    assert.ok(d.app === 'br-sitzungsmanager' && d.format === 'enc-v2' && d.zugang, 'Hülle im Sicherungsformat der App');
    return app.evaluate(([t, p]) => sicherungEntpacken(JSON.parse(t), p), [text, pw]);
  };

  /* Datei → Werkzeug → Datei → App */
  const teilen = await oeffne('br-sicherung-teilen.html');
  await teilen.waitForFunction('!!window.WERKZEUG', null, { timeout: 5000 });
  const geteilt = await teilen.evaluate(async t => {
    const r = await window.WERKZEUG.aufteilen(new File([t], 'BR-Sitzungen_Rev0007.brenc.json'), 'fg-arbeit');
    return { sm: r.sm.text, pm: r.pm.text };
  }, sicherung);
  const sm = await liesInApp(geteilt.sm, 'fg-viewer');
  const pm = await liesInApp(geteilt.pm, 'fg-admin');
  assert.strictEqual(sm.stammdaten.firma, 'Format GmbH', 'App liest die Sitzungsmanager-Datei aus „Sicherung teilen"');
  assert.strictEqual(Object.keys(sm.dokumentInhalte).length, 1);
  assert.strictEqual(pm.sitzungen[0].tops[0].beschluesse[0].antrag, 'Wortlaut', 'App liest die Protokoll-Datei aus „Sicherung teilen"');
  assert.strictEqual(Object.keys(pm.dokumentInhalte || {}).length, 0);

  const anlagen = await oeffne('br-anlagen-entfernen.html');
  await anlagen.waitForFunction('!!window.WERKZEUG', null, { timeout: 5000 });
  const bereinigt = await anlagen.evaluate(async t =>
    (await window.WERKZEUG.anlagenAusDatei(new File([t], 'BR-Sitzungen_Rev0007.brenc.json'), 'fg-viewer')).text, sicherung);
  const ohne = await liesInApp(bereinigt, 'fg-arbeit');
  assert.strictEqual(ohne.revision, 7, 'App liest die Datei aus „Anlagen entfernen"');
  assert.strictEqual(Object.keys(ohne.dokumentInhalte || {}).length, 0);
  assert.deepStrictEqual(ohne.sitzungen[0].tops[0].anlagen.map(a => a.name), ['Vorlage.pdf']);

  /* Generator → App: Startdatei und Zugang aus der Kopie, gelesen und entsperrt von der App. */
  const gen = await oeffne('br-verschluesselung-generator.html');
  await gen.fill('#viewer', 'gen-viewer');
  await gen.fill('#arbeit', 'gen-arbeit');
  await gen.fill('#admin', 'gen-admin');
  await gen.click('#erzeugen');
  await gen.waitForSelector('#ergebnis.an', { timeout: 60000 });
  const stand = await gen.evaluate('standInhalt');
  const start = await liesInApp(stand, 'gen-arbeit');
  assert.strictEqual(start.revision, 1, 'App liest die Startdatei des Generators');
  const rollen = await app.evaluate(async t => {
    const z = JSON.parse(t).zugang, r = [];
    for (const pw of ['gen-viewer', 'gen-arbeit', 'gen-admin']) r.push((await zugangEntsperren(z, pw)).rolle);
    return r;
  }, stand);
  assert.deepStrictEqual(rollen, ['viewer', 'arbeit', 'admin'], 'jede Rolle aus dem Generator-Zugang entsperrt in der App');

  /* iter reist im Zugang mit – eine abweichende Konstante fiele sonst beim Laden nicht auf. */
  for (const [seite, name] of [[teilen, 'teilen'], [anlagen, 'anlagen'], [gen, 'generator']]) {
    assert.strictEqual(await seite.evaluate('PBKDF2_ITER'), iterApp, name + ': PBKDF2_ITER wie in br-app.js');
  }

  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Formatgleichheit: App ↔ Sicherung teilen, Anlagen entfernen, Generator');
}

/* Inhaltsverzeichnis im Reiter „Protokoll": im linken Rand, scrollt mit, springt (auch in zugeklappte TOPs), markiert die Stelle */
async function pruefeProtokollInhalt() {
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 1600, height: 800 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  await seite.goto(DATEI('BR-Protokoll.html'));
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);
  const erg = await seite.evaluate(`
    (async () => {
      const s = daten.sitzungen[0];
      for (let i = 2; i <= 5; i++) s.tops.push(neuerTop({ titel: 'Punkt ' + i }));
      s.tops[3].unterpunkte = [neuerUnterpunkt({ titel: 'Teilfrage' })];
      ui.zugeklappt.add(klappSchluessel(s.tops[3]));
      ui.tab = 'protokoll'; renderHaupt();
      const toc = document.querySelector('.prot-toc');
      const eintraege = Array.from(toc.querySelectorAll('[data-toc]')).map(e => e.textContent);
      const tocRechts = toc.getBoundingClientRect().right;
      const inhaltLinks = document.getElementById('hauptInhalt').getBoundingClientRect().left;
      const chips = getComputedStyle(document.querySelector('.top-sprung')).display;
      toc.querySelector('[data-toc="up-3-0"]').click();
      await new Promise(r => setTimeout(r, 900));
      const ziel = document.querySelector('[data-tocanker="up-3-0"]');
      return { eintraege, tocRechts, inhaltLinks, chips, scrollY: window.scrollY,
        zielOben: ziel.getBoundingClientRect().top,
        aufgeklappt: !document.querySelector('[data-tocanker="top-3"]').classList.contains('zu'),
        aktiv: toc.querySelector('.toc-e.aktiv').dataset.toc,
        tocOben: toc.getBoundingClientRect().top };
    })()
  `);
  assert.deepStrictEqual(erg.eintraege, ['Anwesenheit & Beschlussfähigkeit', 'Protokoll je TOP', 'TOP 1Testpunkt', 'TOP 2Punkt 2',
    'TOP 3Punkt 3', 'TOP 4Punkt 4', '4.1Teilfrage', 'TOP 5Punkt 5', 'Anlagen zum Protokoll'], 'Gliederung wie in Word: Abschnitte, TOPs, Unterpunkte');
  assert.ok(erg.tocRechts <= erg.inhaltLinks, 'das Verzeichnis steht im freien Rand, nicht über dem Protokoll');
  assert.strictEqual(erg.chips, 'none', 'die TOP-Chips entfallen neben dem Verzeichnis');
  assert.ok(erg.aufgeklappt, 'ein zugeklappter TOP klappt beim Sprung auf seinen Unterpunkt auf');
  assert.ok(erg.scrollY > 0 && erg.zielOben >= 0 && erg.zielOben < 120, 'der Unterpunkt steht oben unter der Reiterleiste: ' + erg.zielOben);
  assert.strictEqual(erg.aktiv, 'up-3-0', 'die aktuelle Stelle ist markiert');
  assert.ok(erg.tocOben >= 0 && erg.tocOben < 40, 'das Verzeichnis scrollt mit');
  const klapp = await seite.evaluate(`(() => {
    const toc = document.querySelector('.prot-toc'), knopf = toc.querySelector('.toc-klapp');
    const breitOffen = toc.getBoundingClientRect().width;
    knopf.click();
    const zu = { klasse: toc.classList.contains('zu'), aria: knopf.getAttribute('aria-expanded'), breite: toc.getBoundingClientRect().width,
      liste: getComputedStyle(document.getElementById('tocListe')).display, chips: getComputedStyle(document.querySelector('.top-sprung')).display,
      tocRechts: toc.getBoundingClientRect().right, inhaltLinks: document.getElementById('hauptInhalt').getBoundingClientRect().left };
    renderHaupt();
    const nachRender = document.querySelector('.prot-toc').classList.contains('zu');
    document.querySelector('.prot-toc .toc-klapp').click();
    return { breitOffen, zu, nachRender, wiederOffen: !document.querySelector('.prot-toc').classList.contains('zu') };
  })()`);
  assert.ok(klapp.zu.klasse && klapp.zu.aria === 'false' && klapp.zu.liste === 'none', 'das Verzeichnis klappt ein');
  assert.ok(klapp.zu.breite < 60 && klapp.breitOffen > 200, 'eingeklappt bleibt nur eine schmale Leiste: ' + klapp.zu.breite);
  assert.ok(klapp.zu.tocRechts <= klapp.zu.inhaltLinks, 'auch eingeklappt nicht über dem Protokoll');
  assert.notStrictEqual(klapp.zu.chips, 'none', 'eingeklappt sind die TOP-Chips wieder da');
  assert.ok(klapp.nachRender, 'der Zustand bleibt beim Neuaufbau erhalten');
  assert.ok(klapp.wiederOffen, 'und lässt sich wieder aufklappen');
  const live = await seite.evaluate(`(async () => {
    /* speichern() wirkt erst mit Schlüssel; geschrieben wird hier nichts. */
    sitzungsSchluessel = {}; flushSpeicher = async () => {};
    const punkt = () => document.querySelector('.prot-toc [data-toc="top-1"] .ts-punkt').className;
    const vorher = punkt();
    const ed = document.querySelector('[data-tocanker="top-1"] [data-f="verlauf"]');
    ed.focus(); document.execCommand('insertText', false, 'Erörtert');
    await new Promise(r => setTimeout(r, 400));
    return { vorher, nachher: punkt() };
  })()`);
  assert.strictEqual(live.vorher, 'ts-punkt', 'leerer TOP: offener Punkt');
  assert.strictEqual(live.nachher, 'ts-punkt voll', 'der Stand-Punkt füllt sich beim Tippen, ohne Neuaufbau');
  if (process.env.BR_SCREENSHOTS) await seite.addStyleTag({ content: '.sperrschirm{display:none !important}' }).then(() => seite.screenshot({ path: path.join(process.env.BR_SCREENSHOTS, 'protokoll-inhalt.png') }));

  await seite.setViewportSize({ width: 1000, height: 800 });
  const schmal = await seite.evaluate(`({ toc: getComputedStyle(document.querySelector('.prot-toc')).display,
    chips: getComputedStyle(document.querySelector('.top-sprung')).display })`);
  assert.strictEqual(schmal.toc, 'none', 'auf schmalen Bildschirmen kein Verzeichnis');
  assert.notStrictEqual(schmal.chips, 'none', 'dort bleibt die TOP-Sprungleiste');

  /* Der Einklapp-Zustand übersteht ein Neuladen. */
  await seite.evaluate(`document.querySelector('.prot-toc .toc-klapp').click()`);
  await seite.reload();
  await seite.waitForFunction('typeof APP_MODUS !== "undefined"', null, { timeout: 5000 });
  await seite.evaluate(AUFBAU);
  const nachReload = await seite.evaluate(`(() => {
    ui.tab = 'protokoll'; renderHaupt();
    const zu = document.querySelector('.prot-toc').classList.contains('zu');
    localStorage.removeItem('br-sitzungsmanager.tocZu');
    return zu;
  })()`);
  assert.ok(nachReload, 'eingeklappt bleibt eingeklappt, auch nach dem Neuladen');
  assert.deepStrictEqual(fehler, [], 'keine Laufzeitfehler');
  await browser.close();
  console.log('OK  Protokoll: Inhaltsverzeichnis im Rand, springt, markiert die Stelle, scrollt mit');
}

(async () => {
  await pruefe('BR-Sitzungsmanager.html', 'sitzung');
  await pruefe('BR-Protokoll.html', 'protokoll');
  await pruefeFeatures();
  await pruefeAltbestand();
  await pruefeUebergabe();
  await pruefeStandardUnterpunkte();
  await pruefeUrlaubEditor();
  await pruefeUrlaubMeldung();
  await pruefeAnwesenheitsliste();
  await pruefeGremium();
  await pruefeUmwandler();
  await pruefeAufraeumen();
  await pruefeFormatgleichheit();
  await pruefeUnterpunktKategorieBeteiligungBeginn();
  await pruefeAdminMenue();
  await pruefeEinladungsMail();
  await pruefeAnmeldung();
  await pruefeErstinbetriebnahme();
  await pruefeVerlaufUmbrueche();
  await pruefeProtokollInhalt();
  console.log('\nAlle Browser-Prüfungen bestanden.');
})().catch(e => { console.error(e); process.exit(1); });
