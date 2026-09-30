'use strict';
/* Muss als letzte Datei geladen werden – startet die App. */

/* PDF-Export */

function pdfDateiname(praefix, s) {
  return praefix + '_BR-Sitzung_' + String(s.nr || 'x').replace(/[\/\\\s]+/g, '-') + (s.datum ? '_' + s.datum : '') + '.pdf';
}

function exportPruefungen(s) {
  const p = [];
  if (!aktiveMitglieder(daten).length) p.push('Es sind keine Mitglieder erfasst („Gremium & Mitglieder") – Anwesenheitsliste und Teilnahmeübersicht bleiben leer.');
  if (!s.datum) p.push('Die Sitzung hat noch kein Datum.');
  if (!s.tops.length) p.push('Die Tagesordnung enthält noch keine Punkte.');
  const q = quorumInfo(daten, s);
  const beschluesse = sitzungBeschlussZahl(s);
  const pruefePunkt = (punkt, nr) => (punkt.beschluesse || []).forEach(b => {
    if (!(b.antrag || '').trim()) p.push('TOP ' + nr + ': Beschluss Nr. ' + beschlussNrText(b) + ' hat noch keinen Wortlaut.');
    const abg = (parseInt(b.ja, 10) || 0) + (parseInt(b.nein, 10) || 0) + (parseInt(b.enthaltung, 10) || 0);
    if (abg === 0) p.push('TOP ' + nr + ': Für Beschluss Nr. ' + beschlussNrText(b) + ' sind keine Stimmen erfasst.');
    const basis = abstimmungsBasis(daten, s, b, punkt);
    if (q.beschlussfaehig && !basis.beschlussfaehig) {
      p.push('TOP ' + nr + ': Bei Beschluss Nr. ' + beschlussNrText(b) + ' sind nur ' + basis.teilnehmend +
        ' Mitglieder an der Abstimmung beteiligt – für diese Abstimmung nicht beschlussfähig (erforderlich: ' + basis.erforderlich + ').');
    }
  });
  s.tops.forEach((t, i) => {
    pruefePunkt(t, String(i + 1));
    (t.unterpunkte || []).forEach((u, j) => pruefePunkt(u, (i + 1) + '.' + (j + 1)));
  });
  if (beschluesse > 0 && q.erfasst && !q.beschlussfaehig) p.push('Es sind Beschlüsse erfasst, aber die Anwesenheit ergibt keine Beschlussfähigkeit.');
  if (beschluesse > 0 && !q.erfasst) p.push('Es sind Beschlüsse erfasst, aber noch keine Anwesenheit – die Stimmbasis für die Auswertung fehlt.');
  return p;
}

function renderTabExport(c, s) {
  const anlTO = anlagenTagesordnung(s), anlPr = anlagenProtokoll(s);
  const pruef = exportPruefungen(s);
  c.innerHTML =
    (pruef.length ? '<div class="hinweis warnung"><b>Vor dem Export prüfen:</b><br>' + pruef.map(esc).join('<br>') + '</div>' : '') +
    '<div class="karte"><div class="karte-kopf"><h3>Exportoptionen</h3></div><div class="karte-koerper">' +
    '<div class="raster s2">' +
      '<label class="pruefreihe"><input type="checkbox" id="optVertraulich"> Vertraulichkeitsvermerk in der Fußzeile</label>' +
      '<label class="pruefreihe"><input type="checkbox" id="optLeerzeilen"> Leerzeilen in der Anwesenheitsliste für handschriftliche Nachträge</label>' +
    '</div>' +
    '<p class="klein-grau" style="margin-top:8px">Ohne Leerzeilen enthält die Anwesenheitsliste genau eine Zeile je Person und passt in aller Regel auf eine Seite. Eingeschaltet stehen unter beiden Tabellen zwei freie Zeilen – und der Gäste-Block erscheint auch dann, wenn noch keine Gäste erfasst sind.</p>' +
    (APP_MODUS === 'protokoll'
      ? '<div class="hinweis">Diese Einstellungen gelten für das ganze Gremium und werden im <b>BR-Sitzungsmanager</b> gesetzt. Sie kommen über die Datei <code>Gremium</code> hierher, damit die Anwesenheitsliste in beiden Modulen gleich aussieht.</div>'
      : '') +
    '<p class="klein-grau" style="margin-top:10px">Hochgeladene Anlagen werden nicht mehr in die PDFs eingebettet, sondern im <b>Anlagenverzeichnis</b> mit Nummer und Namen aufgeführt; die Dateien sind über den BR-Sitzungsmanager (Reiter „Dokumente") einsehbar.</p>' +
    '</div></div>' +

    /* Nur die Exporte der eigenen Betriebsart – siehe MODUS_EXPORTE in br-kern.js. */
    '<div class="export-raster">' +
    (modusHatExport('einladung') ? exportKarte('einladung', 'Einladung mit Tagesordnung','Anhänge sind über den BR-Manager einsehbar',
      'Briefkopf, Termin/Ort, nummerierte TOPs mit Erläuterung und Anlagenverweisen' + (anlTO.length ? ' + ' + anlTO.length + ' Anlage(n)' : '') + '.') : '') +
    (modusHatExport('anwesenheit') ? exportKarte('anwesenheit', 'Anwesenheitsliste','Generiert über BR-Manager',
      'Unterschriftenliste zum Ausdrucken für die Sitzung: alle geladenen Mitglieder und Gäste mit Feld für die eigenhändige Unterschrift, zzgl. Leerzeilen.') : '') +
    (modusHatExport('protokoll') ? exportKarte('protokoll', 'Niederschrift (Protokoll)', 'Export aus dem BR-Manager',
          'Rahmendaten, Teilnahme mit Beschlussfähigkeitsfeststellung, je TOP Verlauf und hervorgehobene Beschlüsse mit Wortlaut und exaktem Stimmenverhältnis, Aufgabenübersicht, Unterschriftenfelder, Anlagenverzeichnis' + ((anlPr.length ? ' + ' + anlPr.length + ' Anlage(n)' : '')) + '.') : '') +
    (modusHatExport('protokoll-gekuerzt') ? exportKarte('protokoll-gekuerzt', 'Gekürztes Protokoll (Gast)', 'Auszug für einen Gast',
      'Enthält ausschließlich die Tagesordnungspunkte, an denen der gewählte Gast teilgenommen hat (nur Gäste mit TOP-Zuweisung; ohne Teilnahmeliste und Unterschriften).') : '') +
    '</div>' +

    '<div class="hinweis"><b>Tipp für die Ablage:</b> Das Protokoll-PDF führt die Anwesenheitsliste immer als Anlage 1 im Anlagenverzeichnis; alle Anlagen werden dort benannt, aber nie eingebettet. Nach der Sitzung ausdrucken, unterschreiben (Vorsitz + ein weiteres Mitglied) und die unterschriebene Fassung zusätzlich als Scan unter „Anlagen zum Protokoll" ablegen.</div>' +
    '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      (APP_MODUS === 'sitzung'
        ? '<button class="btn btn-primaer" id="exPraesentation" title="Tagesordnung als Vollbild-Präsentation für den Beamer (öffnet in neuem Tab)">Tagesordnung als Präsentation</button>' +
          '<button class="btn" id="exEinladungEml" title="Einladung als versandfertige E-Mail-Datei – vollständiger Inhalt im Mailtext, ohne PDF-Anhang (öffnet in Outlook)">Einladung als E-Mail (.eml)</button>'
        : '<button class="btn" id="exProtokollFertig" title="Info-E-Mail an die Teilnehmenden: Protokoll liegt auf dem Laufwerk (ohne Anhang)">Protokoll fertig (E-Mail)</button>') +
      (modusHatAnsicht('dokumente') ? '<button class="btn" id="exDokordner">Dokumente dieser Sitzung öffnen</button>' : '') +
      '</div>';

  bindePruef(c.querySelector('#optVertraulich'), () => daten.stammdaten.vertraulich, v => { daten.stammdaten.vertraulich = v; });
  bindePruef(c.querySelector('#optLeerzeilen'), () => daten.exportOptionen.anwesenheitsLeerzeilen, v => { daten.exportOptionen.anwesenheitsLeerzeilen = v; });
  /* Im Protokollmodul nur Anzeige: Werte kommen aus Datei „Gremium" und würden sonst überschrieben. */
  if (APP_MODUS === 'protokoll') {
    ['#optVertraulich', '#optLeerzeilen'].forEach(w => {
      const e = c.querySelector(w);
      if (e) { e.disabled = true; e.closest('label').style.opacity = '.65'; }
    });
  }

  c.querySelectorAll('[data-export]').forEach(btn => btn.onclick = () => starteExport(btn, btn.dataset.export, s));
  const pr = c.querySelector('#exPraesentation');
  if (pr) pr.onclick = () => oeffnePraesentation(s);
  const eml = c.querySelector('#exEinladungEml');
  if (eml) eml.onclick = () => starteEinladungEml(eml, s);
  const pf = c.querySelector('#exProtokollFertig');
  if (pf) pf.onclick = () => starteProtokollFertigEml(pf, s);
  const dok = c.querySelector('#exDokordner');
  if (dok) dok.onclick = () => { ui.ansicht = 'dokumente'; ui.dokumentOrdner = s.id; ui.dokumentFilter.kategorie = ''; ui.dokumentFilter.suche = ''; renderAlles(); };
}

/* Empfänger: aktive BR-Mitglieder + als Gast erfasste SBV/JAV-Personen (Gäste selbst haben keine E-Mail). */
function einladungEmpfaenger(daten, s) {
  const map = new Map();
  const add = email => { const e = (email || '').trim(); if (e) map.set(e.toLowerCase(), e); };
  personenDerGruppe(daten, 'br').filter(p => p.aktiv !== false).forEach(p => add(p.email));
  const gastNamen = new Set(((s || {}).gaeste || []).map(g => (g.name || '').trim().toLowerCase()).filter(Boolean));
  for (const gruppe of ['sbv', 'jav']) {
    for (const p of aktivePersonen(daten, gruppe)) {
      if (gastNamen.has((p.name || '').trim().toLowerCase())) add(p.email);
    }
  }
  return Array.from(map.values());
}
function emlBetreff(txt) {
  if (/^[\x00-\x7F]*$/.test(txt)) return txt;
  return '=?utf-8?B?' + bytesZuBase64(new TextEncoder().encode(txt)) + '?=';
}
/* From-/Adressfeld mit Anzeigename (RFC-2047-kodiert, falls Nicht-ASCII). */
function emlAdresse(name, email) {
  const n = (name || '').trim();
  if (!n) return email || '';
  return emlBetreff(n) + ' <' + email + '>';
}
function einladungVolltext(daten, s) {
  const z = [];
  z.push('Einladung zur ' + (SITZUNGSART_GENITIV[s.art] || 'ordentlichen') + ' Betriebsratssitzung Nr. ' + s.nr);
  z.push('');
  z.push('Termin:              ' + (fmtDatum(s.datum, true) || 'noch offen'));
  z.push('Beginn:              ' + (fmtZeit(s.beginn) ? fmtZeit(s.beginn) + ' Uhr' : '–'));
  if (s.endeGeplant) z.push('Voraussichtl. Ende:  ' + fmtZeit(s.endeGeplant) + ' Uhr');
  z.push('Ort / Raum:          ' + (s.ort || '–'));
  if (s.videokonferenz) z.push('Video/Telefon:       Teilnahme per Video-/Telefonkonferenz möglich.' + (s.videoHinweis ? ' ' + s.videoHinweis : ''));
  z.push('');
  z.push('Liebe Kolleginnen und Kollegen,');
  z.push('');
  z.push('hiermit lade ich euch unter Mitteilung der nachfolgenden Tagesordnung zur oben genannten Sitzung des Betriebsrats ein.');
  z.push('');
  z.push('Tagesordnung');
  const anlTO = anlagenTagesordnung(s);
  const anlNrVon = a => anlTO.findIndex(e => e.a.id === a.id) + 1;
  if (!s.tops || !s.tops.length) z.push('(Es wurden noch keine Tagesordnungspunkte erfasst.)');
  (s.tops || []).forEach((top, i) => {
    z.push('');
    z.push('TOP ' + (i + 1) + ': ' + (top.titel || '(ohne Titel)'));
    const teile = [];
    if (top.kategorie) teile.push(KATEGORIEN[top.kategorie] || top.kategorie);
    if (top.referent) teile.push('Referent/in: ' + top.referent);
    if (top.dauer) teile.push('ca. ' + top.dauer + ' Min.');
    const nrn = (top.anlagen || []).map(a => anlNrVon(a)).filter(n => n > 0);
    if (nrn.length) teile.push((nrn.length > 1 ? 'Anlagen ' : 'Anlage ') + nrn.join(', '));
    if (teile.length) z.push('   ' + teile.join('   ·   '));
    if (top.beschreibung) z.push('   ' + top.beschreibung);
    (top.unterpunkte || []).forEach((u, j) => {
      z.push('   ' + (i + 1) + '.' + (j + 1) + '  ' + (u.titel || '(ohne Titel)'));
      if (kategorieText(u)) z.push('      ' + kategorieText(u));
      if (u.beschreibung) z.push('      ' + u.beschreibung);
      const uNrn = (u.anlagen || []).map(a => anlNrVon(a)).filter(n => n > 0);
      if (uNrn.length) z.push('      ' + (uNrn.length > 1 ? 'Anlagen ' : 'Anlage ') + uNrn.join(', '));
    });
  });
  z.push('');
  z.push('Hinweise');
  z.push('Verhinderte Mitglieder werden gebeten, dies unverzüglich der/dem Vorsitzenden mitzuteilen, damit das jeweilige Ersatzmitglied geladen werden kann.');
  if (s.einladungHinweis) z.push(s.einladungHinweis);
  if (anlTO.length) {
    z.push('');
    z.push('Anlagen');
    anlTO.forEach((e, i) => z.push('Anlage ' + (i + 1) + ':  ' + (e.a.name || 'Anlage') + (e.quelle ? ' (' + e.quelle + ')' : '')));
    z.push('Die aufgeführten Anlagen sind über den BR-Sitzungsmanager einsehbar.');
  }
  z.push('');
  z.push('Mit freundlichen Grüßen');
  const grussName = s.sitzungsleitung || vorsitzName(daten) || '';
  if (grussName) z.push(grussName);
  z.push(sitzungsleitungRolle(daten, s));
  return z.join('\r\n');
}
function erzeugeEinladungEml(daten, s) {
  const empf = einladungEmpfaenger(daten, s);
  const betreff = 'Einladung zur Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' am ' + fmtDatum(s.datum) : '');
  const body = einladungVolltext(daten, s) + '\r\n';
  const kopf = [
    'MIME-Version: 1.0',
    'To: ' + empf.join(', '),
    'Subject: ' + emlBetreff(betreff),
    'Date: ' + new Date().toUTCString(),
    'X-Unsent: 1',
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit'
  ].join('\r\n');
  return kopf + '\r\n\r\n' + body;
}
async function starteEinladungEml(btn, s) {
  const alt = btn.textContent;
  btn.disabled = true; btn.textContent = 'E-Mail wird erstellt …';
  try {
    const eml = erzeugeEinladungEml(daten, s);
    const name = pdfDateiname('Einladung', s).replace(/\.pdf$/i, '') + '.eml';
    dateiHerunterladen(new Blob([eml], { type: 'message/rfc822' }), name);
    const n = einladungEmpfaenger(daten, s).length;
    zeigeToast('E-Mail-Datei erstellt' + (n ? ' (' + n + ' Empfänger)' : ' – noch keine BR-E-Mail-Adressen hinterlegt') + '.', 'erfolg');
  } catch (e) {
    console.error(e);
    zeigeToast('E-Mail konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  } finally {
    btn.disabled = false; btn.textContent = alt;
  }
}

/* Empfänger „Protokoll fertig": BR-Mitglieder (Ersatzmitglieder nur wenn anwesend) + Gast-SBV/JAV. Absender = Schriftführer/in. */
function protokollFertigEmpfaenger(daten, s) {
  const map = new Map();
  const add = email => { const e = (email || '').trim(); if (e) map.set(e.toLowerCase(), e); };
  const anwesend = m => { const st = teilnahmeVon(s, m.id).status; return st === 'anwesend' || st === 'video'; };
  for (const m of aktivePersonen(daten, 'br')) {
    if (m.funktion !== 'Ersatzmitglied' || anwesend(m)) add(m.email);
  }
  const gastNamen = new Set((s.gaeste || []).map(g => (g.name || '').trim().toLowerCase()).filter(Boolean));
  for (const gruppe of ['sbv', 'jav']) {
    for (const p of aktivePersonen(daten, gruppe)) {
      if (gastNamen.has((p.name || '').trim().toLowerCase())) add(p.email);
    }
  }
  return Array.from(map.values());
}
function protokollAbsender(daten, s) {
  const name = ((s.protokollfuehrung || '').trim()) || schriftfuehrerName(daten) || '';
  let email = '';
  if (name) {
    const p = personenDerGruppe(daten, 'br').find(m => (m.name || '').trim().toLowerCase() === name.toLowerCase());
    if (p) email = (p.email || '').trim();
  }
  return { name: name, email: email };
}
function erzeugeProtokollFertigEml(daten, s, link) {
  const empf = protokollFertigEmpfaenger(daten, s);
  const abs = protokollAbsender(daten, s);
  const betreff = 'Protokoll der Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' vom ' + fmtDatum(s.datum) : '') + ' liegt vor';
  const body =
    'Liebe Kolleginnen und Kollegen,\r\n\r\n' +
    'die Niederschrift der Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' vom ' + fmtDatum(s.datum, true) : '') +
    ' ist fertiggestellt und auf dem Laufwerk abgelegt.\r\n\r\n' +
    (link ? 'Ablageort / Link:\r\n' + link + '\r\n\r\n' : '') +
    'Bitte seht euch das Protokoll dort an. Einwendungen bitte wie gewohnt melden.\r\n\r\n' +
    'Mit freundlichen Grüßen\r\n' + (abs.name || '') + '\r\n';
  const kopf = [
    'MIME-Version: 1.0',
    (abs.email ? 'From: ' + emlAdresse(abs.name, abs.email) : (abs.name ? 'From: ' + emlBetreff(abs.name) : null)),
    'To: ' + empf.join(', '),
    'Subject: ' + emlBetreff(betreff),
    'Date: ' + new Date().toUTCString(),
    'X-Unsent: 1',
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit'
  ].filter(Boolean).join('\r\n');
  return kopf + '\r\n\r\n' + body;
}
async function starteProtokollFertigEml(btn, s) {
  const link = await textAbfrage('Protokoll fertig – E-Mail erstellen',
    'Bitte den Ablageort/Link des Protokolls auf dem Laufwerk einfügen (erscheint in der E-Mail):', '');
  if (link == null) return;
  const alt = btn.textContent;
  btn.disabled = true; btn.textContent = 'E-Mail wird erstellt …';
  try {
    const eml = erzeugeProtokollFertigEml(daten, s, link.trim());
    const name = pdfDateiname('Protokoll-fertig', s).replace(/\.pdf$/i, '') + '.eml';
    dateiHerunterladen(new Blob([eml], { type: 'message/rfc822' }), name);
    const n = protokollFertigEmpfaenger(daten, s).length;
    zeigeToast('E-Mail-Datei erstellt' + (n ? ' (' + n + ' Empfänger)' : ' – keine E-Mail-Adressen hinterlegt') + '.', 'erfolg');
  } catch (e) {
    console.error(e);
    zeigeToast('E-Mail konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  } finally {
    btn.disabled = false; btn.textContent = alt;
  }
}

/* Tagesordnung als Beamer-Präsentation */
const PRAES_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:"Bahnschrift","DIN 1451 Std","Archivo Narrow","Roboto Condensed",system-ui,'Segoe UI',Arial,sans-serif;
  background:var(--bg);color:var(--fg);overflow:hidden;-webkit-font-smoothing:antialiased;
  font-variant-numeric:tabular-nums}
body[data-theme="hell"]{--bg:#F4F5F3;--fg:#0D1113;--dim:#5F6B72;--akz:#009057;--akz-fg:#fff;--linie2:#AEB5B1;--btn:#fff}
body[data-theme="dunkel"]{--bg:#0E1211;--fg:#F1F4F2;--dim:#9AA79F;--akz:#35C68C;--akz-fg:#06231A;--linie2:#33403A;--btn:rgba(255,255,255,.07)}
.folie{position:fixed;inset:0;display:none;align-items:center;justify-content:center}
.folie.aktiv{display:flex}
.fit{transform-origin:center center;max-width:1240px;text-align:left}
.kopf{display:flex;justify-content:space-between;align-items:center;gap:28px;
  border-bottom:3px solid var(--fg);padding-bottom:14px;margin-bottom:34px;color:var(--dim);font-size:21px;
  letter-spacing:.06em;text-transform:uppercase}
.kopf-r{display:flex;align-items:center;gap:18px}
.logo{height:48px;width:auto;object-fit:contain}
.deck-titel{font-size:86px;font-weight:700;letter-spacing:.01em;text-transform:uppercase;line-height:1.02}
.deck-titel::after{content:"";display:block;height:7px;margin-top:16px;width:100%;
  background:repeating-linear-gradient(90deg,var(--akz) 0 34px,transparent 34px 48px)}
.deck-meta{font-size:25px;color:var(--dim);margin:18px 0 34px;letter-spacing:.04em}
.to-liste{list-style:none;display:flex;flex-direction:column;gap:18px}
.to-liste>li{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:start}
.to-nr{font-size:34px;font-weight:700;color:var(--akz-fg);background:var(--akz);
  min-width:1.9em;text-align:center;padding:6px 10px;line-height:1.1}
.to-titel{font-size:42px;font-weight:600;line-height:1.12}
.to-unter{list-style:none;margin:8px 0 0;padding:0}
.to-unter li{font-size:25px;color:var(--dim);margin-top:6px}
.deck-fuss{margin-top:38px;font-size:20px;color:var(--dim);text-transform:uppercase;letter-spacing:.18em;
  border-top:1px solid var(--linie2);padding-top:16px}
.leer{font-size:34px;color:var(--dim)}
.top-nr{display:inline-block;font-size:30px;font-weight:700;letter-spacing:.1em;
  background:var(--fg);color:var(--bg);padding:6px 16px;margin-bottom:14px}
.top-titel{font-size:76px;font-weight:700;line-height:1.06;letter-spacing:.005em}
.top-text{margin-top:28px;font-size:30px;line-height:1.42;color:var(--dim)}
.unter-liste{list-style:none;margin:34px 0 0;display:flex;flex-direction:column;gap:18px}
.unter-liste li{font-size:40px;display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:baseline}
.u-nr{color:var(--fg);font-weight:700;border-bottom:4px solid var(--akz);line-height:1.05}
.u-text{margin-top:10px;font-size:26px;line-height:1.35;color:var(--dim)}
.top-meta{margin-top:38px;font-size:22px;color:var(--dim);text-transform:uppercase;letter-spacing:.12em;
  border-top:1px solid var(--linie2);padding-top:16px}
.leiste{position:fixed;left:0;bottom:0;height:7px;width:100%;transform:scaleX(0);transform-origin:left center;
  transition:transform .22s cubic-bezier(.2,.8,.2,1);z-index:9;
  background:repeating-linear-gradient(90deg,var(--akz) 0 34px,transparent 34px 48px)}
.zaehler{position:fixed;bottom:20px;left:22px;font-size:16px;color:var(--dim);z-index:10;letter-spacing:.08em}
.steuer{position:fixed;bottom:18px;right:20px;display:flex;gap:8px;z-index:10}
.steuer button{font:inherit;line-height:0;padding:10px 14px;border:1px solid var(--linie2);background:var(--btn);
  color:var(--fg);cursor:pointer}
.steuer button:hover{border-color:var(--akz);color:var(--akz)}
.steuer svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:square;stroke-linejoin:miter}
.hinweis{position:fixed;top:18px;left:50%;transform:translateX(-50%);font-size:15px;color:var(--dim);
  background:var(--btn);border:1px solid var(--linie2);padding:7px 18px;letter-spacing:.08em;text-transform:uppercase;
  transition:opacity .6s ease;z-index:10}
.hinweis.weg{opacity:0}
.vermerk{position:fixed;top:18px;left:22px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--bg);background:var(--fg);padding:3px 10px;z-index:10}
@media(prefers-reduced-motion:reduce){.leiste{transition:none}}
`;
const PRAES_JS = `
(function(){
  var folien = Array.prototype.slice.call(document.querySelectorAll('.folie'));
  var idx = 0;
  var zaehler = document.getElementById('zaehler');
  var fortschritt = document.getElementById('fortschritt');
  function fit(f){
    if(!f) return;
    var box = f.querySelector('.fit');
    if(!box) return;
    box.style.transform = 'none';
    var sw = (window.innerWidth * 0.92) / box.offsetWidth;
    var sh = (window.innerHeight * 0.86) / box.offsetHeight;
    var sc = Math.min(sw, sh, 3.4);
    if(!isFinite(sc) || sc <= 0) sc = 1;
    box.style.transform = 'scale(' + sc + ')';
  }
  function zeige(n){
    idx = Math.max(0, Math.min(folien.length - 1, n));
    for(var i=0;i<folien.length;i++){ folien[i].classList.toggle('aktiv', i === idx); }
    fit(folien[idx]);
    if(zaehler) zaehler.textContent = (idx + 1) + ' / ' + folien.length;
    if(fortschritt) fortschritt.style.transform = 'scaleX(' + ((idx + 1) / folien.length) + ')';
  }
  function weiter(){ zeige(idx + 1); }
  function zurueck(){ zeige(idx - 1); }
  function vollbild(){
    if(!document.fullscreenElement){ if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
    else if(document.exitFullscreen){ document.exitFullscreen(); }
  }
  function themeWechsel(){
    document.body.dataset.theme = document.body.dataset.theme === 'dunkel' ? 'hell' : 'dunkel';
    fit(folien[idx]);
  }
  document.addEventListener('keydown', function(e){
    var k = e.key;
    if(k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter'){ weiter(); e.preventDefault(); }
    else if(k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp'){ zurueck(); e.preventDefault(); }
    else if(k === 'Home'){ zeige(0); }
    else if(k === 'End'){ zeige(folien.length - 1); }
    else if(k === 'f' || k === 'F'){ vollbild(); }
    else if(k === 'd' || k === 'D'){ themeWechsel(); }
  });
  document.addEventListener('click', function(e){
    if(e.target.closest && e.target.closest('.steuer')) return;
    if(e.clientX < window.innerWidth * 0.33){ zurueck(); } else { weiter(); }
  });
  window.addEventListener('resize', function(){ fit(folien[idx]); });
  window.addEventListener('load', function(){ fit(folien[idx]); });
  var b;
  if((b = document.getElementById('btnWeiter'))) b.onclick = function(e){ e.stopPropagation(); weiter(); };
  if((b = document.getElementById('btnZurueck'))) b.onclick = function(e){ e.stopPropagation(); zurueck(); };
  if((b = document.getElementById('btnVoll'))) b.onclick = function(e){ e.stopPropagation(); vollbild(); };
  if((b = document.getElementById('btnTheme'))) b.onclick = function(e){ e.stopPropagation(); themeWechsel(); };
  setTimeout(function(){ var h = document.getElementById('hinweis'); if(h) h.className = 'hinweis weg'; }, 5000);
  zeige(0);
})();
`;

/* Nur Nutzertexte werden per esc() eingesetzt; das eingebettete Deck-JS ist statisch (kein XSS-Risiko). */
function praesentationHtml(daten, s) {
  const st = daten.stammdaten || {};
  const logo = st.logo && st.logo.dataUrl ? st.logo.dataUrl : '';
  const kopfLinks = esc([st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '));
  const nrDatum = 'Nr. ' + esc(s.nr || '–') + (s.datum ? ' · ' + esc(fmtDatum(s.datum, true)) : '');
  const kopf = '<div class="kopf"><div class="kopf-l">' + kopfLinks + '</div>' +
    '<div class="kopf-r"><span>' + nrDatum + '</span>' + (logo ? '<img class="logo" src="' + logo + '" alt="">' : '') + '</div></div>';

  const metaTeile = [esc(SITZUNGSART_LABEL[s.art] || 'Sitzung')];
  if (s.beginn) metaTeile.push(esc(s.beginn + (s.endeGeplant ? '–' + s.endeGeplant : '') + ' Uhr'));
  if (s.ort) metaTeile.push(esc(s.ort));
  if (s.videokonferenz) metaTeile.push('Video-/Telefonkonferenz möglich');

  const tops = s.tops || [];
  const folien = [];

  const uebersicht = tops.length
    ? '<ol class="to-liste">' + tops.map((t, i) => {
        const unter = (t.unterpunkte || []).length
          ? '<ul class="to-unter">' + t.unterpunkte.map((u, j) =>
              '<li>' + (i + 1) + '.' + (j + 1) + '  ' + esc(u.titel || '(ohne Titel)') + '</li>').join('') + '</ul>'
          : '';
        return '<li><span class="to-nr">' + (i + 1) + '</span><div><div class="to-titel">' +
          esc(t.titel || '(ohne Titel)') + '</div>' + unter + '</div></li>';
      }).join('') + '</ol>'
    : '<div class="leer">Es wurden noch keine Tagesordnungspunkte erfasst.</div>';
  folien.push('<section class="folie aktiv"><div class="fit">' + kopf +
    '<h1 class="deck-titel">Tagesordnung</h1>' +
    '<div class="deck-meta">' + metaTeile.join('&nbsp; · &nbsp;') + '</div>' +
    uebersicht +
    '<div class="deck-fuss">Feststellung der Tagesordnung</div></div></section>');

  tops.forEach((t, i) => {
    const besch = t.beschreibung
      ? '<div class="top-text">' + esc(t.beschreibung).replace(/\n/g, '<br>') + '</div>'
      : '';
    const unter = (t.unterpunkte || []).length
      ? '<ul class="unter-liste">' + t.unterpunkte.map((u, j) =>
          '<li><span class="u-nr">' + (i + 1) + '.' + (j + 1) + '</span><span>' + esc(u.titel || '(ohne Titel)') +
          (kategorieText(u) ? '<div class="u-text">' + esc(kategorieText(u)) + '</div>' : '') +
          (u.beschreibung ? '<div class="u-text">' + esc(u.beschreibung).replace(/\n/g, '<br>') + '</div>' : '') +
          '</span></li>').join('') + '</ul>'
      : '';
    const m = [];
    if (t.kategorie) m.push(esc(KATEGORIEN[t.kategorie] || t.kategorie));
    if (t.referent) m.push('Referent/in: ' + esc(t.referent));
    if (t.dauer) m.push('ca. ' + esc(t.dauer) + ' Min.');
    const meta = m.length ? '<div class="top-meta">' + m.join('&nbsp; · &nbsp;') + '</div>' : '';
    folien.push('<section class="folie"><div class="fit">' + kopf +
      '<div class="top-nr">TOP ' + (i + 1) + '</div>' +
      '<h2 class="top-titel">' + esc(t.titel || '(ohne Titel)') + '</h2>' +
      besch + unter + meta + '</div></section>');
  });

  const vermerk = st.vertraulich ? '<div class="vermerk">Vertraulich</div>' : '';
  const titel = esc('Tagesordnung – ' + (st.gremium || 'Betriebsrat') + ' Nr. ' + (s.nr || ''));

  return '<!DOCTYPE html>\n<html lang="de"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + titel + '</title><style>' + PRAES_CSS + '</style></head>' +
    '<body data-theme="hell">' + folien.join('') +
    '<div class="leiste" id="fortschritt"></div>' +
    '<div class="zaehler" id="zaehler"></div>' + vermerk +
    '<div class="steuer">' +
      '<button id="btnZurueck" title="Zurück" aria-label="Zurück"><svg viewBox="0 0 24 24"><polyline points="15 5 8 12 15 19"/></svg></button>' +
      '<button id="btnWeiter" title="Weiter" aria-label="Weiter"><svg viewBox="0 0 24 24"><polyline points="9 5 16 12 9 19"/></svg></button>' +
      '<button id="btnTheme" title="Hell/Dunkel (D)" aria-label="Hell oder dunkel"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/><path d="M12 4v16" /><path d="M12 4h8v16h-8z" fill="currentColor"/></svg></button>' +
      '<button id="btnVoll" title="Vollbild (F)" aria-label="Vollbild"><svg viewBox="0 0 24 24"><polyline points="4 9 4 4 9 4"/><polyline points="15 4 20 4 20 9"/><polyline points="20 15 20 20 15 20"/><polyline points="9 20 4 20 4 15"/></svg></button></div>' +
    '<div class="hinweis" id="hinweis">&#8592; &#8594; blättern · F Vollbild · D Hell/Dunkel</div>' +
    '<script>' + PRAES_JS + '<\/script></body></html>';
}

function oeffnePraesentation(s) {
  try {
    const html = praesentationHtml(daten, s);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank');
    if (!w) {
      dateiHerunterladen(new Blob([html], { type: 'text/html' }), pdfDateiname('Tagesordnung-Praesentation', s).replace(/\.pdf$/i, '') + '.html');
      zeigeToast('Popup blockiert – Präsentation als Datei gespeichert (im Browser öffnen).', 'fehler');
    } else {
      zeigeToast('Präsentation in neuem Tab geöffnet.', 'erfolg');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error(e);
    zeigeToast('Präsentation konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  }
}

function exportKarte(id, titel, recht, text) {
  return '<div class="export-karte"><div class="e-recht">' + recht + '</div><div class="e-titel">' + titel + '</div>' +
    '<div class="e-text">' + text + '</div>' +
    '<button class="btn btn-primaer" data-export="' + id + '">Als PDF erzeugen</button></div>';
}

async function starteExport(btn, art, s) {
  const alt = btn.textContent;
  btn.disabled = true; btn.textContent = 'PDF wird erstellt …';
  const opt = {
    vertraulich: !!daten.stammdaten.vertraulich
  };
  try {
    let bytes, name, kategorie;
    if (art === 'einladung') { bytes = await erzeugeEinladungPdf(daten, s, opt); name = pdfDateiname('Einladung', s); kategorie = 'einladung'; }
    else if (art === 'anwesenheit') { bytes = await erzeugeAnwesenheitslistePdf(daten, s, opt); name = pdfDateiname('Anwesenheitsliste', s); kategorie = 'anwesenheit'; }
    else if (art === 'protokoll-gekuerzt') {
      const kandidaten = (s.gaeste || []).filter(g => gastTops(s, g).length);
      if (!kandidaten.length) { zeigeToast('Kein Gast hat zugewiesene TOPs – bitte zuerst im Reiter „Protokoll" einem Gast TOPs zuweisen.', 'fehler'); return; }
      const gast = kandidaten.length === 1 ? kandidaten[0] : await gastAuswahlDialog(kandidaten, s);
      if (!gast) return;
      bytes = await erzeugeGekuerztesProtokollPdf(daten, s, gast, opt);
      name = pdfDateiname('Protokoll-Auszug-' + (gast.name || 'Gast').replace(/[\/\\\s]+/g, '-'), s);
      kategorie = 'protokoll-auszug';
    }
    else { bytes = await erzeugeProtokollPdf(daten, s, opt); name = pdfDateiname('Protokoll', s); kategorie = 'protokoll'; }
    dateiHerunterladen(new Blob([bytes], { type: 'application/pdf' }), name);
    /* Automatisch archivieren: je Kategorie und Sitzung nur die aktuelle Fassung behalten. */
    try {
      const bytesKopie = bytes.slice();
      for (const alt of (daten.dokumente || []).filter(d => d.quelle === 'generiert' && d.kategorie === kategorie && d.sitzungId === s.id)) {
        await dokumentEntfernen(alt.id);
      }
      await dokumentAnlegen(bytesKopie, { name: name, mime: 'application/pdf', groesse: bytesKopie.byteLength, kategorie: kategorie, sitzungId: s.id, quelle: 'generiert' });
    } catch (e) { console.warn('Archivierung fehlgeschlagen:', e); }
    zeigeToast(name + ' wurde erzeugt und im Dokumentenbereich archiviert.', 'erfolg');
  } catch (e) {
    console.error(e);
    zeigeToast('PDF konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  } finally {
    btn.disabled = false; btn.textContent = alt;
  }
}

/* Stammdaten-Dialog */

function oeffneStammdaten() {
  if (!modusHatAnsicht('stammdaten')) {
    zeigeToast('Gremium, Personen und Bausteine werden im BR-Sitzungsmanager gepflegt und kommen über die Datei „Gremium" hierher.', 'fehler');
    return;
  }
  if (!istAdmin()) { zeigeToast('Dieser Bereich ist nur im Debug-Mode verfügbar.', 'fehler'); return; }
  const dlg = document.getElementById('dlgStammdaten');
  const st = daten.stammdaten;
  dlg.innerHTML =
    '<div class="dlg-kopf"><h3>Debug-Panel · Gremium &amp; Mitglieder</h3><button class="btn btn-geist" id="sdZu">Schließen</button>' +
      '<div class="dlg-nav">' +
        '<button type="button" data-ziel="anfang">Gremium</button>' +
        '<button type="button" data-ziel="sdSekPersonen">Personen &amp; Rollen</button>' +
        '<button type="button" data-ziel="sdSekTops">Standard-TOPs</button>' +
        '<button type="button" data-ziel="sdSekKategorien">Kategorien</button>' +
        '<button type="button" data-ziel="sdSekVorlagen">Textbausteine</button>' +
        '<button type="button" data-ziel="sdSekBeschlussVorlagen">Beschlusstexte</button>' +
        '<button type="button" data-ziel="sdSekUrlaub">Urlaub</button>' +
        '<button type="button" data-ziel="sdSekTags">Tags</button>' +
        '<button type="button" data-ziel="sdSekZugang">Zugang</button>' +
      '</div></div>' +
    '<div class="dlg-koerper">' +
    (APP_MODUS === 'protokoll'
      ? '<div class="hinweis warnung" style="margin-top:0"><b>Diese Angaben werden im Sitzungsmanager gepflegt.</b> ' +
        'Sie stammen aus der Nachbardatei <code>Gremium</code> und werden beim Öffnen automatisch übernommen – ' +
        'Änderungen hier gehen beim nächsten Start verloren. Bitte im <b>BR-Sitzungsmanager</b> ändern, dort die ' +
        'Datei <code>Gremium</code> neu erzeugen und in den Unterordner „scripts" legen.' +
        (window.BR_GREMIUM && window.BR_GREMIUM.erstelltAm
          ? ' Vorliegende Fassung vom ' + esc(fmtDatum(String(window.BR_GREMIUM.erstelltAm).slice(0, 10), true)) + '.'
          : ' <b>Zurzeit liegt keine Datei <code>Gremium</code> vor.</b>') +
        '</div>'
      : '<div class="hinweis" style="margin-top:0">Diese Angaben gelten für beide Module. Nach Änderungen bitte unten ' +
        '<b>„Gremium-Datei erzeugen"</b> und die Datei <code>Gremium</code> in den Unterordner „scripts" legen – das ' +
        'Protokollmodul übernimmt sie dann beim Öffnen automatisch.</div>') +
    '<div class="raster s3">' +
      feldHtml('sdGremium', 'Bezeichnung des Gremiums', 'text', 'placeholder="Betriebsrat"') +
      feldHtml('sdFirma', 'Firma / Betrieb', 'text') +
      feldHtml('sdOrt', 'Ort (für Briefkopf & Datumszeile)', 'text') +
    '</div><div class="raster s3" style="margin-top:14px">' +
      feldHtml('sdGroesse', 'Gremiumgröße', 'number', 'min="1" max="99"', 'Basis der Beschlussfähigkeitsprüfung') +
      feldHtml('sdNachrichtlich', 'Einladung nachrichtlich an', 'text', '', 'z. B. SBV und JAV; leer = keine Zeile') +
      '<div class="feld"><label>Logo für den Briefkopf (PNG/JPG)</label><div style="display:flex;gap:8px;align-items:center">' +
        '<button class="btn btn-klein" id="sdLogoWahl">Logo wählen …</button>' +
        '<span id="sdLogoInfo" class="klein-grau"></span>' +
        '<button class="btn btn-klein btn-geist btn-gefahr" id="sdLogoWeg" style="display:none">entfernen</button></div></div>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekPersonen">Personen &amp; Rollen</h3>' +
    '<p class="klein-grau">Betriebsrat, Schwerbehindertenvertretung (SBV) und Jugend- und Auszubildendenvertretung (JAV) getrennt erfassen. Nur BR-Mitglieder zählen für Anwesenheit und Beschlussfähigkeit; die BR-Reihenfolge ist die Anwesenheitsliste. SBV und JAV lassen sich pro Sitzung als Gäste übernehmen. „Aktiv" abwählen statt löschen, wenn jemand ausscheidet.</p>' +
    '<div id="sdPersonen" style="margin-top:6px"></div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekTops">Standard-Tagesordnungspunkte</h3>' +
    '<p class="klein-grau">Werden beim Anlegen jeder neuen Sitzung automatisch eingefügt – mitsamt den hier hinterlegten <b>Unterpunkten</b> (erscheinen dann als 1.1, 1.2 …). Für alle Nutzer auf dem Netzlaufwerk: „standard-tops.js herunterladen" und in den Unterordner „scripts" legen – die App liest die Datei beim Öffnen automatisch (sie hat dann Vorrang vor dieser Liste).</p>' +
    '<div id="sdStandardTops" style="margin-top:6px"></div>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein btn-primaer" id="sdTopNeu">+ TOP</button>' +
      '<button class="btn btn-klein" id="sdTopDownload">standard-tops.js herunterladen</button>' +
      '<button class="btn btn-klein" id="sdTopLaden">Datei laden …</button>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekKategorien">Kategorien für Tagesordnungspunkte</h3>' +
    '<p class="klein-grau">Die Art jedes Tagesordnungspunkts (z. B. Formalia, Beratung, Beschlussfassung). Für alle Nutzer auf dem Netzlaufwerk: „category.js herunterladen" und in den Unterordner „scripts" legen – die App liest die Datei beim Öffnen automatisch (sie hat dann Vorrang vor dieser Liste). Ein interner Schlüssel wird automatisch vergeben; bereits vergebene Kategorien bleiben bestehen.</p>' +
    '<div id="sdKategorien" style="margin-top:6px"></div>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein btn-primaer" id="sdKatNeu">+ Kategorie</button>' +
      '<button class="btn btn-klein" id="sdKatDownload">category.js herunterladen</button>' +
      '<button class="btn btn-klein" id="sdKatLaden">Datei laden …</button>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekVorlagen">Textbausteine für Protokolle</h3>' +
    '<p class="klein-grau">Wiederkehrende Formulierungen, die bei der Protokollerstellung je Tagesordnungspunkt über „+ Textblock einfügen" auswählbar sind. Für alle Nutzer auf dem Netzlaufwerk: „protokoll_vorlagen.js herunterladen" und in den Unterordner „scripts" legen – die Datei wird beim Öffnen automatisch geladen (sie hat dann Vorrang vor dieser Liste).</p>' +
    '<div id="sdVorlagen" style="margin-top:6px"></div>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein btn-primaer" id="sdVorlageNeu">+ Baustein</button>' +
      '<button class="btn btn-klein" id="sdVorlagenDownload">protokoll_vorlagen.js herunterladen</button>' +
      '<button class="btn btn-klein" id="sdVorlagenLaden">Datei laden …</button>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekBeschlussVorlagen">Textbausteine für Beschlüsse</h3>' +
    '<p class="klein-grau">Vorformulierte Beschlusstexte, die im Protokoll je Beschluss über „+ Textblock einfügen" in den <b>Wortlaut</b> übernommen werden – getrennt von den Protokoll-Bausteinen oben. Für alle Nutzer auf dem Netzlaufwerk: „beschluss_vorlagen.js herunterladen" und in den Unterordner „scripts" legen – die Datei wird beim Öffnen automatisch geladen (sie hat dann Vorrang vor dieser Liste). Platzhalter wie „…" bewusst stehen lassen; sie werden beim Protokollieren ausgefüllt.</p>' +
    '<div id="sdBeschlussVorlagen" style="margin-top:6px"></div>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein btn-primaer" id="sdBVorlageNeu">+ Baustein</button>' +
      '<button class="btn btn-klein" id="sdBVorlagenDownload">beschluss_vorlagen.js herunterladen</button>' +
      '<button class="btn btn-klein" id="sdBVorlagenLaden">Datei laden …</button>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekUrlaub">Urlaubskalender</h3>' +
    '<p class="klein-grau">Abwesenheiten des Gremiums. Beim Sitzungsdatum warnt die App, wer abwesend ist; im Protokoll werden diese Mitglieder als „Entschuldigt" vorbelegt, solange noch kein Status erfasst ist. Der Abgleich läuft über den <b>Namen</b> aus „Personen &amp; Rollen" – Groß-/Kleinschreibung ist egal. Beide Tage sind einschließlich; ein eintägiger Urlaub hat gleiches Von und Bis. Wer den Kalender lieber zentral pflegt, legt <code>urlaub.js</code> in den Unterordner <code>scripts</code> – die Datei hat dann beim Öffnen Vorrang vor dieser Liste.</p>' +
    '<div id="sdUrlaub" style="margin-top:6px"></div>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein btn-primaer" id="sdUrlaubMeldungen">Meldungen einlesen …</button>' +
      '<button class="btn btn-klein" id="sdUrlaubNeu">+ Abwesenheit</button>' +
      '<button class="btn btn-klein" id="sdUrlaubDownload">urlaub.js herunterladen</button>' +
      '<button class="btn btn-klein" id="sdUrlaubLaden">Datei laden …</button>' +
      '<button class="btn btn-klein btn-geist" id="sdUrlaubAufraeumen" title="Alle Zeiträume entfernen, die vollständig in der Vergangenheit liegen">Vergangene aufräumen</button>' +
    '</div>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekTags">Beschluss-Schlagworte (Tags)</h3>' +
    '<p class="klein-grau">Farbige Tags zum Kategorisieren von Beschlüssen – im Protokoll je Beschluss zuweisbar, in der Beschluss-Übersicht filter- und exportierbar.</p>' +
    '<div id="sdTags" style="margin-top:6px"></div>' +
    '<button class="btn btn-klein btn-primaer" id="sdTagNeu" style="margin-top:8px">+ Tag</button>' +
    '<hr class="trenner">' +
    '<h3 class="dlg-sektion" id="sdSekZugang">Zugang &amp; Passwörter</h3>' +
    '<p class="klein-grau">Drei Rollen: Das <b>Viewer-Passwort</b> öffnet die Nur-Lese-Ansicht, das <b>Arbeits-Passwort</b> den Bearbeitungsmodus, das <b>Debug-Mode-Passwort</b> zusätzlich die Verwaltung. Die Passwörter (verschlüsselt) liegen in der Nachbardatei <code>br-zugang.js</code>; beim Öffnen wird immer eines abgefragt.</p>' +
    '<p class="klein-grau">Nach einer Passwort-Änderung <b>die Zugangsdatei neu herunterladen</b> und in den Unterordner „scripts" auf dem Laufwerk legen – erst dann gilt das neue Passwort für alle Nutzer. Vorhandene Daten bleiben erhalten (gleicher Hauptschlüssel).</p>' +
    '<div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-klein" id="sdPwViewer">Viewer-Passwort ändern</button>' +
      '<button class="btn btn-klein" id="sdPwArbeit">Arbeits-Passwort ändern</button>' +
      '<button class="btn btn-klein" id="sdPwAdmin">Debug-Mode-Passwort ändern</button>' +
      '<button class="btn btn-klein btn-primaer" id="sdZugangDownload">Zugangsdatei (br-zugang.js) herunterladen</button>' +
    '</div>' +
    '</div>' +
    '<div class="dlg-fuss"><button class="btn btn-gefahr" id="sdReset">Alle Daten zurücksetzen …</button>' +
    '<span style="flex:1"></span>' +
    (APP_MODUS === 'sitzung'
      ? '<button class="btn" id="sdGremiumDatei" title="Alle Angaben dieses Panels verschlüsselt in die Nachbardatei „Gremium" schreiben">Gremium-Datei erzeugen</button>'
      : '') +
    '<button class="btn btn-primaer" id="sdFertig">Fertig</button></div>';

  dlg.querySelectorAll('.dlg-nav [data-ziel]').forEach(b => b.onclick = () => {
    if (b.dataset.ziel === 'anfang') { dlg.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const z = dlg.querySelector('#' + b.dataset.ziel);
    if (z) z.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  bindeText(dlg.querySelector('#sdGremium'), () => st.gremium, v => { st.gremium = v; });
  bindeText(dlg.querySelector('#sdFirma'), () => st.firma, v => { st.firma = v; });
  bindeText(dlg.querySelector('#sdOrt'), () => st.ort, v => { st.ort = v; });
  bindeText(dlg.querySelector('#sdGroesse'), () => st.gremiumGroesse, v => { st.gremiumGroesse = parseInt(v, 10) || ''; });
  bindeText(dlg.querySelector('#sdNachrichtlich'), () => st.nachrichtlich, v => { st.nachrichtlich = v; });

  const logoInfo = dlg.querySelector('#sdLogoInfo'), logoWeg = dlg.querySelector('#sdLogoWeg');
  const logoAnzeigen = () => {
    logoInfo.textContent = st.logo ? st.logo.name + ' (' + fmtBytes(st.logo.size) + ')' : 'kein Logo';
    logoWeg.style.display = st.logo ? '' : 'none';
  };
  logoAnzeigen();
  dlg.querySelector('#sdLogoWahl').onclick = () => document.getElementById('dateiLogo').click();
  document.getElementById('dateiLogo').onchange = e => {
    dateienEinlesen(e.target.files, ergebnisse => {
      if (ergebnisse[0]) {
        if (ergebnisse[0].size > 1024 * 1024) zeigeToast('Das Logo ist recht groß – kleiner als 1 MB ist ideal.', 'fehler');
        st.logo = ergebnisse[0]; speichern(); logoAnzeigen();
      }
    });
    e.target.value = '';
  };
  logoWeg.onclick = () => { st.logo = null; speichern(); logoAnzeigen(); };

  const pc = dlg.querySelector('#sdPersonen');
  const renderGruppe = g => {
    const cont = pc.querySelector('[data-liste="' + g + '"]');
    const liste = personenDerGruppe(daten, g);
    if (!liste.length) { cont.innerHTML = '<p class="klein-grau">Noch keine Person erfasst.</p>'; return; }
    cont.innerHTML = liste.map(p => {
      const i = daten.personen.indexOf(p);
      return '<div class="person-zeile" data-i="' + i + '">' +
        '<input data-f="name" class="eingabe" placeholder="Vor- und Nachname">' +
        '<input data-f="email" type="email" class="eingabe" placeholder="E-Mail (optional)">' +
        '<select data-f="funktion" class="eingabe">' + ROLLEN[g].map(f => '<option>' + f + '</option>').join('') + '</select>' +
        '<label class="pruefreihe"><input type="checkbox" data-f="aktiv"> aktiv</label>' +
        '<div class="mz-werkzeuge">' +
          '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</div></div>';
    }).join('');
    cont.querySelectorAll('.person-zeile').forEach(zeile => {
      const i = parseInt(zeile.dataset.i, 10);
      const p = daten.personen[i];
      bindeText(zeile.querySelector('[data-f="name"]'), () => p.name, v => { p.name = v; });
      bindeText(zeile.querySelector('[data-f="email"]'), () => p.email, v => { p.email = v; });
      const fu = zeile.querySelector('[data-f="funktion"]');
      fu.value = p.funktion || ROLLEN[g][0];
      fu.onchange = () => { p.funktion = fu.value; speichern(); };
      bindePruef(zeile.querySelector('[data-f="aktiv"]'), () => p.aktiv !== false, v => { p.aktiv = v; });
      zeile.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu;
        if (tu === 'weg') { daten.personen.splice(i, 1); speichern(); renderGruppe(g); return; }
        const gi = liste.indexOf(p);
        if (tu === 'hoch' && gi > 0) { personenTauschen(p, liste[gi - 1]); speichern(); renderGruppe(g); }
        else if (tu === 'runter' && gi < liste.length - 1) { personenTauschen(p, liste[gi + 1]); speichern(); renderGruppe(g); }
      });
    });
  };
  const renderPersonen = () => {
    pc.innerHTML = Object.keys(GRUPPEN).map(g =>
      '<div class="pg-block">' +
        '<div class="pg-kopf"><h4>' + esc(GRUPPEN[g]) + '</h4>' +
          '<button class="btn btn-klein btn-primaer" data-neu="' + g + '">+ Person</button></div>' +
        '<div class="pg-liste" data-liste="' + g + '"></div>' +
      '</div>'
    ).join('');
    Object.keys(GRUPPEN).forEach(g => renderGruppe(g));
    pc.querySelectorAll('[data-neu]').forEach(b => b.onclick = () => {
      const g = b.dataset.neu;
      const funktion = g === 'br' ? (personenDerGruppe(daten, g).length ? 'Mitglied' : 'Vorsitzende/r') : ROLLEN[g][0];
      daten.personen.push({ id: uid(), name: '', gruppe: g, funktion: funktion, aktiv: true, email: '' });
      speichern(); renderGruppe(g);
      const feld = pc.querySelector('[data-liste="' + g + '"] .person-zeile:last-child [data-f="name"]');
      if (feld) feld.focus();
    });
  };
  renderPersonen();

  const stc = dlg.querySelector('#sdStandardTops');
  const renderStandardTops = () => {
    const liste = daten.standardTops || [];
    if (!liste.length) { stc.innerHTML = '<p class="klein-grau">Keine Standard-TOPs.</p>'; return; }
    stc.innerHTML = liste.map((t, i) =>
      '<div class="std-top" data-i="' + i + '" style="margin-bottom:10px">' +
      '<div class="mitglied-zeile">' +
        '<input data-f="titel" class="eingabe" placeholder="Titel des Tagesordnungspunkts">' +
        '<select data-f="kategorie" class="eingabe" aria-label="Kategorie">' + kategorieOptionenHtml() + '</select>' +
        '<div class="mz-werkzeuge">' +
          '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div data-unter style="margin:4px 0 0 26px;border-left:2px solid var(--linie,#DCE1DF);padding-left:10px">' +
        (t.unterpunkte || []).map((u, j) =>
          '<div class="mitglied-zeile" data-u="' + j + '" style="margin-top:4px">' +
          '<span class="klein-grau" style="min-width:34px">' + (i + 1) + '.' + (j + 1) + '</span>' +
          '<input data-f="utitel" class="eingabe" placeholder="Titel des Unterpunkts">' +
          '<select data-f="ukategorie" class="eingabe" aria-label="Kategorie des Unterpunkts">' + kategorieOptionenHtml() + '</select>' +
          '<div class="mz-werkzeuge">' +
            '<button class="btn btn-symbol btn-geist" data-utu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
            '<button class="btn btn-symbol btn-geist" data-utu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
            '<button class="btn btn-symbol btn-geist btn-gefahr" data-utu="weg" title="Unterpunkt löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
          '</div></div>').join('') +
        '<button class="btn btn-klein btn-geist" data-tu="uneu" style="margin-top:5px">+ Unterpunkt</button>' +
      '</div></div>'
    ).join('');
    stc.querySelectorAll('.std-top').forEach(block => {
      const i = parseInt(block.dataset.i, 10);
      const t = daten.standardTops[i];
      const kopf = block.querySelector('.mitglied-zeile');
      bindeText(kopf.querySelector('[data-f="titel"]'), () => t.titel, v => { t.titel = v; });
      const kat = kopf.querySelector('[data-f="kategorie"]'); kat.value = kategorieOderLeer(t.kategorie);
      kat.onchange = () => { t.kategorie = kat.value; speichern(); };
      kopf.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu, arr = daten.standardTops;
        if (tu === 'weg') { arr.splice(i, 1); speichern(); renderStandardTops(); }
        else if (tu === 'hoch' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; speichern(); renderStandardTops(); }
        else if (tu === 'runter' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; speichern(); renderStandardTops(); }
      });

      t.unterpunkte = t.unterpunkte || [];
      block.querySelectorAll('[data-u]').forEach(zeile => {
        const j = parseInt(zeile.dataset.u, 10);
        const u = t.unterpunkte[j];
        bindeText(zeile.querySelector('[data-f="utitel"]'), () => u.titel, v => { u.titel = v; });
        const ukat = zeile.querySelector('[data-f="ukategorie"]'); ukat.value = kategorieOderLeer(u.kategorie);
        ukat.onchange = () => { u.kategorie = ukat.value; speichern(); };
        zeile.querySelectorAll('[data-utu]').forEach(btn => btn.onclick = () => {
          const tu = btn.dataset.utu, arr = t.unterpunkte;
          if (tu === 'weg') { arr.splice(j, 1); speichern(); renderStandardTops(); }
          else if (tu === 'hoch' && j > 0) { [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]]; speichern(); renderStandardTops(); }
          else if (tu === 'runter' && j < arr.length - 1) { [arr[j + 1], arr[j]] = [arr[j], arr[j + 1]]; speichern(); renderStandardTops(); }
        });
      });
      block.querySelector('[data-tu="uneu"]').onclick = () => {
        t.unterpunkte.push({ id: uid(), titel: '', kategorie: kategorieOderLeer(t.kategorie) });   /* startet mit der Kategorie des TOP */
        speichern(); renderStandardTops();
        const f = stc.querySelector('.std-top[data-i="' + i + '"] [data-u]:last-of-type [data-f="utitel"]');
        if (f) f.focus();
      };
    });
  };
  renderStandardTops();
  dlg.querySelector('#sdTopNeu').onclick = () => {
    daten.standardTops.push({ id: uid(), titel: '', kategorie: '', unterpunkte: [] });
    speichern(); renderStandardTops();
    const f = stc.querySelector('.std-top:last-of-type [data-f="titel"]'); if (f) f.focus();
  };
  dlg.querySelector('#sdTopDownload').onclick = () => {
    const rein = (daten.standardTops || []).filter(t => (t.titel || '').trim())
      .map(t => {
        const e = { titel: t.titel.trim(), kategorie: kategorieOderLeer(t.kategorie) };
        const unter = (t.unterpunkte || []).filter(u => (u.titel || '').trim()).map(u => {
          const k = kategorieOderLeer(u.kategorie);
          return k ? { titel: u.titel.trim(), kategorie: k } : { titel: u.titel.trim() };
        });
        if (unter.length) e.unterpunkte = unter;
        return e;
      });
    const inhalt = '/* Standard-Tagesordnungspunkte für den BR-Sitzungsmanager.\n' +
      '   Diese Datei in den Unterordner "scripts" legen; sie wird beim Öffnen automatisch geladen.\n' +
      '   Optional je Punkt "unterpunkte": [{ "titel": "…" }] – sie werden beim Anlegen einer\n' +
      '   Sitzung als Unterpunkte 1.1, 1.2 … mit erzeugt. */\n' +
      'window.BR_STANDARD_TOPS = ' + JSON.stringify(rein, null, 2) + ';\n';
    dateiHerunterladen(new Blob([inhalt], { type: 'text/javascript;charset=utf-8' }), 'standard-tops.js');
    zeigeToast('standard-tops.js erstellt. Bitte in den Unterordner „scripts" legen.', 'erfolg');
  };
  dlg.querySelector('#sdTopLaden').onclick = () => document.getElementById('dateiStandardTops').click();

  const kc = dlg.querySelector('#sdKategorien');
  const kategorieInNutzung = key => !!key && (daten.sitzungen || []).some(s => (s.tops || []).some(t =>
    t.kategorie === key || (t.unterpunkte || []).some(u => u.kategorie === key)));
  const renderKategorien = () => {
    const liste = daten.kategorien || [];
    if (!liste.length) { kc.innerHTML = '<p class="klein-grau">Keine Kategorien.</p>'; return; }
    kc.innerHTML = liste.map((k, i) =>
      '<div class="kat-zeile" data-i="' + i + '" style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:7px">' +
      '<input data-f="label" class="eingabe" placeholder="Bezeichnung der Kategorie">' +
      '<div class="mz-werkzeuge">' +
        '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
        '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
        '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
      '</div></div>'
    ).join('');
    kc.querySelectorAll('.kat-zeile').forEach(zeile => {
      const i = parseInt(zeile.dataset.i, 10);
      const k = daten.kategorien[i];
      const inp = zeile.querySelector('[data-f="label"]');
      bindeText(inp, () => k.label, v => { k.label = v; }, kategorienAnwenden);
      inp.addEventListener('change', () => {
        if (!k.key && (k.label || '').trim()) {
          const belegt = new Set(daten.kategorien.filter(x => x !== k).map(x => x.key).filter(Boolean));
          k.key = kategorieSchluessel(k.label, belegt);
          kategorienAnwenden(); speichern();
        }
      });
      zeile.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu, arr = daten.kategorien;
        if (tu === 'weg') {
          const weg = () => { arr.splice(i, 1); kategorienAnwenden(); speichern(); renderKategorien(); };
          if (kategorieInNutzung(k.key)) {
            bestaetigen('Kategorie entfernen', 'Diese Kategorie wird noch von mindestens einem Tagesordnungspunkt verwendet. Diese Punkte behalten den bisherigen Wert, bis er neu gesetzt wird. Trotzdem entfernen?', weg, 'Entfernen', true);
          } else weg();
        }
        else if (tu === 'hoch' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; kategorienAnwenden(); speichern(); renderKategorien(); }
        else if (tu === 'runter' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; kategorienAnwenden(); speichern(); renderKategorien(); }
      });
    });
  };
  renderKategorien();
  dlg.querySelector('#sdKatNeu').onclick = () => {
    daten.kategorien.push({ id: uid(), key: '', label: '' });
    speichern(); renderKategorien();
    const f = kc.querySelector('.kat-zeile:last-child [data-f="label"]'); if (f) f.focus();
  };
  dlg.querySelector('#sdKatDownload').onclick = () => {
    const belegt = new Set();
    const rein = (daten.kategorien || []).filter(k => (k.label || '').trim() || k.key).map(k => {
      const key = k.key || kategorieSchluessel(k.label, belegt);
      belegt.add(key);
      return { key: key, label: (k.label || key).trim() };
    });
    if (!rein.length) { zeigeToast('Keine Kategorien zum Herunterladen.', 'fehler'); return; }
    const inhalt = '/* TOP-Kategorien für den BR-Sitzungsmanager.\n' +
      '   Diese Datei in den Unterordner "scripts" legen; sie wird beim Öffnen automatisch geladen.\n' +
      '   Bequem bearbeiten im Debug-Panel („Kategorien" → „category.js herunterladen"). */\n' +
      'window.BR_KATEGORIEN = ' + JSON.stringify(rein, null, 2) + ';\n';
    dateiHerunterladen(new Blob([inhalt], { type: 'text/javascript;charset=utf-8' }), 'category.js');
    zeigeToast('category.js erstellt. Bitte in den Unterordner „scripts" legen.', 'erfolg');
  };
  dlg.querySelector('#sdKatLaden').onclick = () => document.getElementById('dateiKategorien').click();

  const vc = dlg.querySelector('#sdVorlagen');
  const renderVorlagen = () => {
    const liste = daten.protokollVorlagen || [];
    if (!liste.length) { vc.innerHTML = '<p class="klein-grau">Noch keine Textbausteine.</p>'; return; }
    vc.innerHTML = liste.map((v, i) =>
      '<div class="vorlage-zeile" data-i="' + i + '">' +
      '<div class="vz-kopf">' +
        '<input data-f="titel" class="eingabe" placeholder="Bezeichnung (erscheint im Auswahlmenü)">' +
        '<div class="mz-werkzeuge">' +
          '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<textarea data-f="text" class="eingabe" placeholder="Textbaustein – wird an der Cursorposition ins Verlauf-Feld eingefügt"></textarea>' +
      '</div>'
    ).join('');
    vc.querySelectorAll('.vorlage-zeile').forEach(zeile => {
      const i = parseInt(zeile.dataset.i, 10);
      const v = daten.protokollVorlagen[i];
      bindeText(zeile.querySelector('[data-f="titel"]'), () => v.titel, val => { v.titel = val; });
      bindeText(zeile.querySelector('[data-f="text"]'), () => v.text, val => { v.text = val; });
      zeile.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu, arr = daten.protokollVorlagen;
        if (tu === 'weg') { arr.splice(i, 1); speichern(); renderVorlagen(); }
        else if (tu === 'hoch' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; speichern(); renderVorlagen(); }
        else if (tu === 'runter' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; speichern(); renderVorlagen(); }
      });
    });
  };
  renderVorlagen();
  dlg.querySelector('#sdVorlageNeu').onclick = () => {
    daten.protokollVorlagen.push({ id: uid(), titel: '', text: '' });
    speichern(); renderVorlagen();
    const f = vc.querySelector('.vorlage-zeile:last-child [data-f="titel"]'); if (f) f.focus();
  };
  dlg.querySelector('#sdVorlagenDownload').onclick = () => {
    const rein = (daten.protokollVorlagen || []).filter(v => (v.titel || '').trim() || (v.text || '').trim())
      .map(v => ({ titel: (v.titel || '').trim(), text: v.text || '' }));
    const inhalt = '/* Textbausteine für die Protokollerstellung im BR-Sitzungsmanager.\n' +
      '   Diese Datei in den Unterordner "scripts" legen; sie wird beim Öffnen automatisch geladen. */\n' +
      'window.BR_PROTOKOLL_VORLAGEN = ' + JSON.stringify(rein, null, 2) + ';\n';
    dateiHerunterladen(new Blob([inhalt], { type: 'text/javascript;charset=utf-8' }), 'protokoll_vorlagen.js');
    zeigeToast('protokoll_vorlagen.js erstellt. Bitte in den Unterordner „scripts" legen.', 'erfolg');
  };
  dlg.querySelector('#sdVorlagenLaden').onclick = () => document.getElementById('dateiVorlagen').click();

  const bvc = dlg.querySelector('#sdBeschlussVorlagen');
  const renderBeschlussVorlagen = () => {
    const liste = daten.beschlussVorlagen || [];
    if (!liste.length) { bvc.innerHTML = '<p class="klein-grau">Noch keine Beschluss-Bausteine.</p>'; return; }
    bvc.innerHTML = liste.map((v, i) =>
      '<div class="vorlage-zeile" data-i="' + i + '">' +
      '<div class="vz-kopf">' +
        '<input data-f="titel" class="eingabe" placeholder="Bezeichnung (erscheint im Auswahlmenü)">' +
        '<div class="mz-werkzeuge">' +
          '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
          '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<textarea data-f="text" class="eingabe" placeholder="Beschlusstext – wird in den Wortlaut des Beschlusses eingefügt"></textarea>' +
      '</div>'
    ).join('');
    bvc.querySelectorAll('.vorlage-zeile').forEach(zeile => {
      const i = parseInt(zeile.dataset.i, 10);
      const v = daten.beschlussVorlagen[i];
      bindeText(zeile.querySelector('[data-f="titel"]'), () => v.titel, val => { v.titel = val; });
      bindeText(zeile.querySelector('[data-f="text"]'), () => v.text, val => { v.text = val; });
      zeile.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu, arr = daten.beschlussVorlagen;
        if (tu === 'weg') { arr.splice(i, 1); speichern(); renderBeschlussVorlagen(); }
        else if (tu === 'hoch' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; speichern(); renderBeschlussVorlagen(); }
        else if (tu === 'runter' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; speichern(); renderBeschlussVorlagen(); }
      });
    });
  };
  renderBeschlussVorlagen();
  dlg.querySelector('#sdBVorlageNeu').onclick = () => {
    daten.beschlussVorlagen.push({ id: uid(), titel: '', text: '' });
    speichern(); renderBeschlussVorlagen();
    const f = bvc.querySelector('.vorlage-zeile:last-child [data-f="titel"]'); if (f) f.focus();
  };
  dlg.querySelector('#sdBVorlagenDownload').onclick = () => {
    const rein = (daten.beschlussVorlagen || []).filter(v => (v.titel || '').trim() || (v.text || '').trim())
      .map(v => ({ titel: (v.titel || '').trim(), text: v.text || '' }));
    const inhalt = '/* Textbausteine für Beschlüsse im BR-Manager.\n' +
      '   Diese Datei in den Unterordner "scripts" legen;\n' +
      '   sie wird beim Öffnen automatisch geladen. */\n' +
      'window.BR_BESCHLUSS_VORLAGEN = ' + JSON.stringify(rein, null, 2) + ';\n';
    dateiHerunterladen(new Blob([inhalt], { type: 'text/javascript;charset=utf-8' }), 'beschluss_vorlagen.js');
    zeigeToast('beschluss_vorlagen.js erstellt. Bitte in den Unterordner „scripts" legen.', 'erfolg');
  };
  dlg.querySelector('#sdBVorlagenLaden').onclick = () => document.getElementById('dateiBeschlussVorlagen').click();

  const uc = dlg.querySelector('#sdUrlaub');
  const namensListe = '<datalist id="sdUrlaubNamen">' +
    (daten.personen || []).filter(p => p.aktiv !== false && (p.name || '').trim())
      .map(p => '<option value="' + esc(p.name) + '"></option>').join('') + '</datalist>';

  const renderUrlaub = () => {
    daten.urlaub = daten.urlaub || [];
    const heute = heuteIso();
    const unbekannt = urlaubUnbekannteNamen(daten);
    uc.innerHTML = namensListe +
      (unbekannt.length ? '<div class="hinweis warnung">Ohne Zuordnung in den Stammdaten (Tippfehler im Namen?): ' +
        unbekannt.map(esc).join(', ') + '</div>' : '') +
      (!daten.urlaub.length ? '<p class="klein-grau">Noch keine Abwesenheiten erfasst.</p>' :
        daten.urlaub.map((e, i) => {
          const vorbei = (e.bis || e.von || '') < heute;
          const kaputt = !(e.name || '').trim() || !e.von || !e.bis || e.bis < e.von;
          return '<div class="mitglied-zeile" data-i="' + i + '" style="margin-bottom:6px' + (vorbei ? ';opacity:.55' : '') + '">' +
            '<input data-f="name" class="eingabe" list="sdUrlaubNamen" placeholder="Name (wie in Personen &amp; Rollen)">' +
            '<input data-f="von" type="date" class="eingabe" title="Erster Abwesenheitstag">' +
            '<input data-f="bis" type="date" class="eingabe" title="Letzter Abwesenheitstag (einschließlich)">' +
            '<input data-f="grund" class="eingabe" placeholder="Grund (z. B. Urlaub)">' +
            '<div class="mz-werkzeuge">' +
              (kaputt ? '<span class="klein-grau" title="Unvollständig oder Bis vor Von – dieser Eintrag wirkt nicht">&#9888;</span>' : '') +
              '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Eintrag entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
            '</div></div>';
        }).join('')) +
      '<p class="klein-grau" style="margin-top:6px">' + daten.urlaub.length + ' Eintrag/Einträge · ' +
        'vergangene Zeiträume sind ausgegraut. Sortiert wird beim erneuten Öffnen nach Beginn.</p>';

    uc.querySelectorAll('[data-i]').forEach(zeile => {
      const e = daten.urlaub[parseInt(zeile.dataset.i, 10)];
      const nach = () => { const a = document.activeElement; renderUrlaub();
        if (a && a.dataset && a.dataset.f) {
          const w = uc.querySelector('[data-i="' + zeile.dataset.i + '"] [data-f="' + a.dataset.f + '"]');
          if (w) { w.focus(); if (w.type !== 'date') w.setSelectionRange(w.value.length, w.value.length); }
        } };
      bindeText(zeile.querySelector('[data-f="name"]'), () => e.name, v => { e.name = v; }, nach);
      bindeText(zeile.querySelector('[data-f="von"]'), () => e.von, v => { e.von = v; if (!e.bis || e.bis < v) e.bis = v; }, nach);
      bindeText(zeile.querySelector('[data-f="bis"]'), () => e.bis, v => { e.bis = v; }, nach);
      bindeText(zeile.querySelector('[data-f="grund"]'), () => e.grund, v => { e.grund = v; });
      zeile.querySelector('[data-tu="weg"]').onclick = () => {
        daten.urlaub.splice(parseInt(zeile.dataset.i, 10), 1); speichern(); renderUrlaub();
      };
    });
  };
  renderUrlaub();

  dlg.querySelector('#sdUrlaubNeu').onclick = () => {
    daten.urlaub.push({ id: uid(), name: '', von: heuteIso(), bis: heuteIso(), grund: 'Urlaub' });
    speichern(); renderUrlaub();
    const f = uc.querySelector('[data-i]:last-of-type [data-f="name"]'); if (f) f.focus();
  };
  dlg.querySelector('#sdUrlaubAufraeumen').onclick = () => {
    const heute = heuteIso();
    const weg = daten.urlaub.filter(e => (e.bis || e.von || '') < heute).length;
    if (!weg) return zeigeToast('Es gibt keine vollständig vergangenen Zeiträume.', 'fehler');
    bestaetigen('Vergangene Zeiträume entfernen?',
      weg + ' Eintrag/Einträge liegen vollständig vor dem heutigen Tag und werden gelöscht.',
      () => {
        daten.urlaub = daten.urlaub.filter(e => (e.bis || e.von || '') >= heute);
        speichern(); renderUrlaub();
        zeigeToast(weg + ' vergangene(r) Eintrag/Einträge entfernt.', 'erfolg');
      }, 'Entfernen', true);
  };
  dlg.querySelector('#sdUrlaubDownload').onclick = () => {
    const rein = urlaubNormieren(daten.urlaub).map(e => ({ name: e.name, von: e.von, bis: e.bis, grund: e.grund }));
    const inhalt = '/* Urlaubs- und Abwesenheitskalender für den BR-Manager.\n' +
      '   Diese Datei in den Unterordner "scripts" legen; sie wird beim Öffnen automatisch\n' +
      '   geladen und hat dann Vorrang vor der in der App gepflegten Liste.\n' +
      '   Datenschutz: enthält personenbezogene Daten – nur auf das geschützte BR-Laufwerk. */\n' +
      'window.BR_URLAUB = ' + JSON.stringify(rein, null, 2) + ';\n';
    dateiHerunterladen(new Blob([inhalt], { type: 'text/javascript;charset=utf-8' }), 'urlaub.js');
    zeigeToast('urlaub.js erstellt (' + rein.length + ' Eintrag/Einträge).', 'erfolg');
  };
  dlg.querySelector('#sdUrlaubLaden').onclick = () => document.getElementById('dateiUrlaub').click();
  dlg.querySelector('#sdUrlaubMeldungen').onclick = () => document.getElementById('dateiUrlaubMeldung').click();

  document.getElementById('dateiUrlaubMeldung').onchange = async e => {
    const dateien = Array.from(e.target.files || []); e.target.value = '';
    if (!dateien.length) return;
    const gelesen = [], abgelehnt = [];
    for (const f of dateien) {
      let m;
      try { m = urlaubMeldungLesen(await f.text()); }
      catch (err) { m = { fehler: 'Datei nicht lesbar' }; }
      if (m.fehler) abgelehnt.push(f.name + ': ' + m.fehler); else gelesen.push(m);
    }
    if (!gelesen.length) {
      return zeigeToast('Keine Meldung übernommen. ' + abgelehnt.join(' · '), 'fehler');
    }
    const namen = gelesen.map(m => m.name);
    bestaetigen('Meldungen übernehmen?',
      'Von ' + namen.length + ' Person(en) werden die gemeldeten Zeiträume übernommen: ' +
      namen.join(', ') + '. Bisher erfasste Zeiträume dieser Personen werden dabei ersetzt; ' +
      'alle anderen bleiben unverändert.' +
      (abgelehnt.length ? ' Nicht gelesen: ' + abgelehnt.join(' · ') + '.' : ''),
      () => {
        const b = urlaubMeldungenZusammenfuehren(gelesen);
        speichern(); renderUrlaub();
        zeigeToast(b.neu + ' Zeitraum/Zeiträume von ' + b.personen.length + ' Person(en) übernommen' +
          (b.ersetzt ? ' (' + b.ersetzt + ' ersetzt)' : '') +
          (b.ohne.length ? ' · ohne Abwesenheit gemeldet: ' + b.ohne.join(', ') : '') + '.', 'erfolg');
      }, 'Übernehmen');
  };

  document.getElementById('dateiUrlaub').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const a = txt.indexOf('['), b = txt.lastIndexOf(']');
        if (a < 0 || b < a) throw new Error('kein Array');
        const norm = urlaubNormieren(JSON.parse(txt.slice(a, b + 1)), true);
        if (!norm.length) throw new Error('leer');
        daten.urlaub = norm; speichern(); renderUrlaub();
        zeigeToast(norm.length + ' Abwesenheit(en) aus Datei übernommen.', 'erfolg');
      } catch (err) { zeigeToast('Die Datei konnte nicht gelesen werden (erwartet: urlaub.js).', 'fehler'); }
    };
    r.readAsText(f);
  };

  const tagc = dlg.querySelector('#sdTags');
  const renderTags = () => {
    const liste = daten.beschlussTags || [];
    if (!liste.length) { tagc.innerHTML = '<p class="klein-grau">Noch keine Tags.</p>'; return; }
    tagc.innerHTML = liste.map((t, i) =>
      '<div class="tag-zeile" data-i="' + i + '">' +
      '<input data-f="name" class="eingabe" placeholder="Tag-Name">' +
      '<div class="tag-farben" data-farben></div>' +
      '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
      '</div>'
    ).join('');
    tagc.querySelectorAll('.tag-zeile').forEach(zeile => {
      const i = parseInt(zeile.dataset.i, 10);
      const t = daten.beschlussTags[i];
      bindeText(zeile.querySelector('[data-f="name"]'), () => t.name, v => { t.name = v; });
      const fc = zeile.querySelector('[data-farben]');
      fc.innerHTML = TAG_FARBEN.map(f => '<button class="tag-swatch' + (t.farbe === f ? ' aktiv' : '') + '" data-farbe="' + f + '" style="background:' + f + '" title="Farbe wählen"></button>').join('');
      fc.querySelectorAll('.tag-swatch').forEach(sw => sw.onclick = () => { t.farbe = sw.dataset.farbe; speichern(); renderTags(); });
      zeile.querySelector('[data-tu="weg"]').onclick = () => bestaetigen('Tag löschen?',
        'Der Tag „' + (t.name || '') + '" wird gelöscht und aus allen Beschlüssen entfernt.',
        () => {
          const wegId = t.id;
          daten.beschlussTags.splice(i, 1);
          daten.sitzungen.forEach(s => (s.tops || []).forEach(top => (top.beschluesse || []).forEach(b => { if (Array.isArray(b.tags)) b.tags = b.tags.filter(id => id !== wegId); })));
          daten.sitzungen.forEach(s => dirtySitzungen.add(s.id));
          speichern(true); renderTags();
        }, 'Löschen', true);
    });
  };
  renderTags();
  dlg.querySelector('#sdTagNeu').onclick = () => {
    daten.beschlussTags.push({ id: uid(), name: '', farbe: TAG_FARBEN[daten.beschlussTags.length % TAG_FARBEN.length] });
    speichern(); renderTags();
    const f = tagc.querySelector('.tag-zeile:last-child [data-f="name"]'); if (f) f.focus();
  };

  document.getElementById('dateiStandardTops').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const a = txt.indexOf('['), b = txt.lastIndexOf(']');
        if (a < 0 || b < a) throw new Error('kein Array');
        const arr = JSON.parse(txt.slice(a, b + 1));
        const norm = (arr || []).filter(t => t && t.titel).map(t => ({
          id: uid(), titel: String(t.titel).trim(),
          kategorie: kategorieOderLeer(t.kategorie),
          unterpunkte: standardUnterpunkteNorm(t.unterpunkte)
        }));
        if (!norm.length) throw new Error('leer');
        daten.standardTops = norm; speichern(); renderStandardTops();
        zeigeToast(norm.length + ' Standard-TOP(s) aus Datei übernommen.', 'erfolg');
      } catch (err) { zeigeToast('Die Datei konnte nicht gelesen werden (erwartet: standard-tops.js).', 'fehler'); }
    };
    r.readAsText(f);
  };

  document.getElementById('dateiVorlagen').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const a = txt.indexOf('['), b = txt.lastIndexOf(']');
        if (a < 0 || b < a) throw new Error('kein Array');
        const arr = JSON.parse(txt.slice(a, b + 1));
        const norm = (arr || []).filter(t => t && (t.titel || t.text)).map(t => ({ id: uid(), titel: String(t.titel || '').trim(), text: String(t.text || '') }));
        if (!norm.length) throw new Error('leer');
        daten.protokollVorlagen = norm; speichern(); renderVorlagen();
        zeigeToast(norm.length + ' Textbaustein(e) aus Datei übernommen.', 'erfolg');
      } catch (err) { zeigeToast('Die Datei konnte nicht gelesen werden (erwartet: protokoll_vorlagen.js).', 'fehler'); }
    };
    r.readAsText(f);
  };

  document.getElementById('dateiBeschlussVorlagen').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const a = txt.indexOf('['), b = txt.lastIndexOf(']');
        if (a < 0 || b < a) throw new Error('kein Array');
        const arr = JSON.parse(txt.slice(a, b + 1));
        const norm = (arr || []).filter(t => t && (t.titel || t.text)).map(t => ({ id: uid(), titel: String(t.titel || '').trim(), text: String(t.text || '') }));
        if (!norm.length) throw new Error('leer');
        daten.beschlussVorlagen = norm; speichern(); renderBeschlussVorlagen();
        zeigeToast(norm.length + ' Beschluss-Baustein(e) aus Datei übernommen.', 'erfolg');
      } catch (err) { zeigeToast('Die Datei konnte nicht gelesen werden (erwartet: beschluss_vorlagen.js).', 'fehler'); }
    };
    r.readAsText(f);
  };

  document.getElementById('dateiKategorien').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const a = txt.indexOf('['), b = txt.lastIndexOf(']');
        if (a < 0 || b < a) throw new Error('kein Array');
        const arr = JSON.parse(txt.slice(a, b + 1));
        const belegt = new Set();
        const norm = (arr || []).filter(k => k && (k.key || k.label)).map(k => {
          const key = String(k.key || kategorieSchluessel(k.label, belegt)).trim();
          belegt.add(key);
          return { id: uid(), key: key, label: String(k.label || key).trim() };
        }).filter(k => k.key);
        if (!norm.length) throw new Error('leer');
        daten.kategorien = norm; kategorienAnwenden(); speichern(); renderKategorien();
        zeigeToast(norm.length + ' Kategorie(n) aus Datei übernommen.', 'erfolg');
      } catch (err) { zeigeToast('Die Datei konnte nicht gelesen werden (erwartet: category.js).', 'fehler'); }
    };
    r.readAsText(f);
  };

  const pwAendern = async (feld, label) => {
    const neu = await passwortDoppeltAbfrage(label + ' ändern', 'Neues ' + label + ' festlegen (mindestens 8 Zeichen).');
    if (neu == null) return;
    /* Kollision verhindern: neues Passwort darf zu keiner der anderen Rollen passen. */
    for (const anderesFeld of ['viewer', 'arbeit', 'admin']) {
      if (anderesFeld === feld) continue;
      const anderes = aktuellesZugang[anderesFeld];
      if (!anderes) continue;
      try {
        const k = await Krypto.schluessel(neu, new Uint8Array(anderes.salt), aktuellesZugang.iter || PBKDF2_ITER);
        await Krypto.entpacke(k, new Uint8Array(anderes.iv), base64ZuBytes(anderes.ct).buffer);
        zeigeToast('Die Passwörter der drei Rollen müssen sich unterscheiden.', 'fehler');
        return;
      } catch (e) {}
    }
    await zugangPasswortSetzen(feld, neu);
    zeigeToast(label + ' geändert. Bitte jetzt „Zugangsdatei (br-zugang.js) herunterladen" und die Datei in den Unterordner „scripts" legen, damit das neue Passwort für alle gilt.', 'erfolg');
  };
  dlg.querySelector('#sdPwViewer').onclick = () => pwAendern('viewer', 'Viewer-Passwort');
  dlg.querySelector('#sdPwAdmin').onclick = () => pwAendern('admin', 'Debug-Mode-Passwort');
  dlg.querySelector('#sdPwArbeit').onclick = () => pwAendern('arbeit', 'Arbeits-Passwort');
  dlg.querySelector('#sdZugangDownload').onclick = () => {
    zugangsdateiHerunterladen();
    zeigeToast('Zugangsdatei erzeugt. Bitte br-zugang.js in den Unterordner „scripts" auf dem Laufwerk legen (bestehende ersetzen).', 'erfolg');
  };
  dlg.querySelector('#sdReset').onclick = () => bestaetigen('Wirklich alles zurücksetzen?',
    'Sämtliche Sitzungen, Mitglieder und Anlagen werden aus dem Zwischenspeicher dieses Browsers entfernt. Nicht als Datei gesicherte Daten gehen verloren.',
    () => { daten = leeresProjekt(); ui.sitzungId = null; dirtyMeta = false; dirtySitzungen.clear(); alleDatenErsetzenP().then(() => { dlg.close(); renderAlles(); zeigeToast('Alle Daten wurden zurückgesetzt.'); }); },
    'Alles löschen', true);

  const schliessen = () => { dlg.close(); renderAlles(); };
  dlg.querySelector('#sdZu').onclick = schliessen;
  dlg.querySelector('#sdFertig').onclick = schliessen;
  const gd = dlg.querySelector('#sdGremiumDatei');
  if (gd) gd.onclick = gremiumDateiErzeugen;
  dlg.showModal();
}

/* Initialisierung */

async function initialisieren() {
  /* Sentinel aus br-design.css; fehlt sie, greift der eingebettete Kern-Fallback (App bleibt benutzbar). */
  if (!getComputedStyle(document.documentElement).getPropertyValue('--br-design').trim()) {
    zeigeToast('Hinweis: br-design.css wurde nicht gefunden. Bitte die Datei neben BR-Sitzungsmanager.html ablegen (vereinfachte Darstellung aktiv).', 'fehler');
  }
  try { await Speicher.oeffnen(); }
  catch (e) {
    document.body.innerHTML = '<div style="max-width:520px;margin:12vh auto;padding:24px;font-family:system-ui">' +
      '<h2>Lokaler Datenspeicher nicht verfügbar</h2>' +
      '<p>Diese Anwendung benötigt den verschlüsselten Browser-Datenspeicher (IndexedDB). ' +
      'Er ist im privaten/Inkognito-Modus oder bei sehr strengen Browser-Einstellungen mitunter gesperrt. ' +
      'Bitte in einem normalen Browserfenster öffnen oder die Datei über einen lokalen Webserver bereitstellen.</p></div>';
    console.error('IndexedDB nicht verfügbar:', e);
    return;
  }
  /* br-zugang.js (window.BR_ZUGANG) ist maßgeblich; ohne gültige Datei bleibt die App gesperrt. */
  const extern = externerZugang();

  if (!extern) {
    zeigeSperrschirm('gesperrt', 'Die Zugangsdatei <code>br-zugang.js</code> fehlt oder ist ungültig.');
    return;
  }

  const gespeichert = await Speicher.metaHolen('zugang');
  if (zugangSignatur(extern) !== zugangSignatur(gespeichert)) {
    await Speicher.metaSetzen('zugang', extern);
  }
  aktuellesZugang = extern;
  /* Neuladen der Seite darf weder Daten noch Passwort kosten: läuft im Tab noch eine Sitzung, geht es ohne Sperrschirm weiter. */
  if (await sitzungFortsetzen()) { await appStarten(); return; }
  zeigeSperrschirm('login');
}

let globaleListenerAktiv = false;
function verkabeln() {
  document.getElementById('btnNeueSitzung').onclick = () => {
    if (APP_MODUS !== 'sitzung') { zeigeToast('Neue Sitzungen legt die Sitzungsleitung in BR-Sitzungsmanager.html an.', 'fehler'); return; }
    sitzungAnlegen();
  };
  /* Beschriftung je Betriebsart: Sitzungsmanager gibt TO heraus/nimmt Ergebnisse, Protokollmodul umgekehrt. */
  const exp = document.getElementById('btnSitzungExport');
  const imp = document.getElementById('btnSitzungImport');
  exp.textContent = UEBERGABE_TEXT[uebergabeErzeugt()].knopf;
  exp.title = 'Nur ' + UEBERGABE_TEXT[uebergabeErzeugt()].was + ' dieser Sitzung als verschlüsselte Übergabedatei ausgeben';
  imp.textContent = UEBERGABE_TEXT[uebergabeNimmt()].nehmen;
  imp.title = UEBERGABE_TEXT[uebergabeNimmt()].was + ' aus einer Übergabedatei der Gegenstelle einlesen';
  exp.onclick = () => uebergabeDateiSpeichern(aktSitzung());
  imp.onclick = () => document.getElementById('dateiSitzung').click();
  document.getElementById('dateiSitzung').onchange = e => {
    const f = e.target.files[0]; e.target.value = '';
    if (f) uebergabeDateiOeffnen(f);
  };
  document.getElementById('slSuche').oninput = e => { ui.sitzungSuche = e.target.value; renderSeitenleiste(); };
  document.getElementById('slArchiv').onchange = e => { ui.archivAnzeigen = e.target.checked; renderSeitenleiste(); };
  document.getElementById('btnBeschluesse').onclick = () => { ui.ansicht = 'beschluesse'; renderAlles(); };
  document.getElementById('btnAufgaben').onclick = () => { ui.ansicht = 'aufgaben'; renderAlles(); };
  document.getElementById('btnUrlaub').onclick = () => {
    if (!modusHatAnsicht('urlaub')) return;
    ui.ansicht = 'urlaub'; renderAlles();
  };
  document.getElementById('btnDokumente').onclick = () => {
    if (!modusHatAnsicht('dokumente')) return zeigeToast('Die Anlagen-Dateien liegen im BR-Sitzungsmanager.', 'fehler');
    ui.ansicht = 'dokumente'; ui.dokumentOrdner = null; renderAlles();
  };
  document.getElementById('btnStammdaten').onclick = oeffneStammdaten;
  document.getElementById('btnSperren').onclick = sperren;
  document.getElementById('btnProjektSpeichern').onclick = projektDateiSpeichern;
  document.getElementById('btnProjektOeffnen').onclick = () => document.getElementById('dateiProjekt').click();
  if (globaleListenerAktiv) return;
  globaleListenerAktiv = true;
  document.getElementById('dateiProjekt').onchange = e => {
    if (e.target.files[0]) projektDateiOeffnen(e.target.files[0]);
    e.target.value = '';
  };
  document.getElementById('dateiAnlagen').onchange = e => {
    const cb = anlagenZielCallback; anlagenZielCallback = null;
    dateienEinlesen(e.target.files, ergebnisse => { if (cb) cb(ergebnisse); });
    e.target.value = '';
  };
  document.getElementById('dateiDokument').onchange = e => {
    const dateien = Array.from(e.target.files || []); e.target.value = '';
    if (!dateien.length) return;
    const sid = (ui.ansicht === 'dokumente' && ui.dokumentOrdner && ui.dokumentOrdner !== '__ohne') ? ui.dokumentOrdner : null;
    let offen = dateien.length, zahl = 0;
    dateien.forEach(f => {
      const r = new FileReader();
      r.onload = async () => {
        try { await dokumentAnlegen(new Uint8Array(r.result), { name: f.name, mime: f.type || '', groesse: f.size, kategorie: 'sonstig', sitzungId: sid, quelle: 'upload' }); zahl++; }
        catch (err) { zeigeToast('„' + f.name + '" konnte nicht gespeichert werden.', 'fehler'); }
        if (--offen === 0) { if (zahl) zeigeToast(zahl + ' Dokument(e) hinzugefügt.', 'erfolg'); if (ui.ansicht === 'dokumente') renderHaupt(); }
      };
      r.onerror = () => { if (--offen === 0 && ui.ansicht === 'dokumente') renderHaupt(); };
      r.readAsArrayBuffer(f);
    });
  };
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (sitzungsSchluessel) projektDateiSpeichern(); }
  });
}

async function appStarten() {
  /* Reihenfolge bewusst: externe Dateien haben Vorrang, „Gremium" kommt zuletzt und überschreibt die Einzeldateien. */
  let externUebernommen = externeStandardTopsUebernehmen();
  if (externeVorlagenUebernehmen()) externUebernommen = true;
  if (externeBeschlussVorlagenUebernehmen()) externUebernommen = true;
  if (externeUrlaubUebernehmen()) externUebernommen = true;
  if (await externesGremiumUebernehmen()) externUebernommen = true;
  if (externeKategorienUebernehmen()) externUebernommen = true;
  kategorienAnwenden();
  if (externUebernommen) speichern();
  ui.sitzungId = daten.sitzungen[0] ? daten.sitzungen[0].id : null;
  ui.ansicht = 'sitzung';
  verkabeln();
  aktualisiereRollenUi();

  window.APP = {
    get daten() { return daten; }, set daten(d) { daten = d; },
    get rolle() { return sitzungsRolle; },
    modus: APP_MODUS, modusReiter, modusHatReiter, modusHatExport, modusHatAnsicht,
    uebergabeErzeugt, uebergabeNimmt, uebergabeDateiSpeichern, uebergabeDateiOeffnen,
    tagesordnungNutzlast, ergebnisNutzlast, tagesordnungEinspielen, ergebnisseEinspielen,
    tagesordnungUebernehmen, ergebnisseUebernehmen,
    gremiumDateiErzeugen, externesGremiumUebernehmen, gremiumSignatur, GREMIUM_FELDER,
    urlaubEintraege, abwesendAm, abwesenheitVon, urlaubUnbekannteNamen, urlaubHinweisHtml,
    urlaubNormieren, externeUrlaubUebernehmen,
    darfBearbeiten, istAdmin,
    ui, renderAlles, sitzungAnlegen, leeresProjekt, speichern,
    projektDateiSpeichern, projektDateiOeffnen, projektBeitreten, sperren,
    dokumentBytesLaden, dokumentAnlegen, anwesenheitsDaten, anlagenTagesordnung,
    erzeugeEinladungPdf, erzeugeAnwesenheitslistePdf, erzeugeProtokollPdf, erzeugeGekuerztesProtokollPdf,
    gastTops, praesentationHtml, sanitizeVerlaufHtml, verlaufZuBloecken
  };

  renderAlles();
  const startLabel = darfBearbeiten()
    ? 'Angemeldet als ' + (istAdmin() ? 'Debug-Mode' : 'Arbeitsmodus') + ' · Änderungen werden verschlüsselt gespeichert.'
    : 'Nur-Lese-Ansicht · zum Bearbeiten mit dem Arbeits-Passwort anmelden.';
  setAutosaveInfo(startLabel);
  aktualisiereSicherungInfo();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialisieren);
  else initialisieren();
}
