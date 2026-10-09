'use strict';

const WOCHENTAGE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

/* Sitzungsleitung/Schriftführung: getrennte Dateien mit je eigenem Speicherstand (DB_NAME in br-app.js); Aufgaben-, keine Rechtetrennung. */
const APP_MODUS = (typeof window !== 'undefined' && window.BR_MODUS === 'protokoll') ? 'protokoll' : 'sitzung';
const MODUS_LABEL = { sitzung: 'Sitzungsleitung', protokoll: 'Schriftführung' };
const MODUS_REITER = {
  sitzung:   ['sitzung', 'tagesordnung', 'einladung', 'export'],
  protokoll: ['tagesordnung', 'protokoll', 'export']
};
const MODUS_STARTREITER = { sitzung: 'sitzung', protokoll: 'protokoll' };
const MODUS_EXPORTE = {
  sitzung:   ['einladung', 'anwesenheit'],
  protokoll: ['protokoll', 'protokoll-gekuerzt', 'anwesenheit']
};
function modusReiter() { return MODUS_REITER[APP_MODUS] || MODUS_REITER.sitzung; }
function modusStartReiter() { return MODUS_STARTREITER[APP_MODUS] || modusReiter()[0]; }
const MODUS_ANSICHTEN = {
  sitzung:   ['beschluesse', 'aufgaben', 'dokumente', 'urlaub', 'stammdaten'],
  protokoll: []
};
function modusHatAnsicht(id) { return (MODUS_ANSICHTEN[APP_MODUS] || MODUS_ANSICHTEN.sitzung).includes(id); }

/* Gerichtete Übergabe: Sitzungsmanager→Protokoll sendet die Tagesordnung ('tagesordnung-v1'), Protokoll→Sitzungsmanager
   sendet Beschlüsse/Aufgaben/Teilnahme ('ergebnis-v1'); Teilnahme muss mit, weil quorumInfo() daraus das Ergebnis ableitet. */
const PROTOKOLL_FELDER = ['verlauf', 'beschluesse', 'aufgaben', 'pauseAktiv'];

function anlageVerweis(a) {
  return { id: a.id, name: a.name || 'Anlage', mime: a.mime || '', groesse: a.groesse || 0,
           dokumentId: a.dokumentId || null };
}

function punktOhneProtokoll(p) {
  const kopie = {};
  for (const k of Object.keys(p)) {
    if (PROTOKOLL_FELDER.includes(k) || k === 'unterpunkte' || k === 'anlagen') continue;
    kopie[k] = p[k];
  }
  kopie.anlagen = (p.anlagen || []).map(anlageVerweis);
  return kopie;
}

function tagesordnungNutzlast(s) {
  const sitzung = {};
  /* teilnahme/gaeste reisen mit: Protokoll startet mit der Planung aus „Einladung", Erfasstes gewinnt (siehe tagesordnungEinspielen). */
  const weg = ['tops', 'anlagenProt', 'beginnTatsaechlich', 'endeTatsaechlich'];
  for (const k of Object.keys(s)) if (!weg.includes(k)) sitzung[k] = s[k];
  sitzung.gaeste = (s.gaeste || []).map(g => Object.assign({}, g, { tops: (g.tops || []).slice() }));
  sitzung.tops = (s.tops || []).map(t => {
    const kopie = punktOhneProtokoll(t);
    kopie.unterpunkte = (t.unterpunkte || []).map(punktOhneProtokoll);
    return kopie;
  });
  sitzung.anlagenTO = (s.anlagenTO || []).map(anlageVerweis);
  return { sitzung: sitzung };
}

function ergebnisNutzlast(s) {
  const punkte = [];
  const sammle = p => {
    const beschluesse = p.beschluesse || [], aufgaben = p.aufgaben || [];
    if (beschluesse.length || aufgaben.length) punkte.push({ id: p.id, beschluesse: beschluesse, aufgaben: aufgaben });
  };
  (s.tops || []).forEach(t => { sammle(t); (t.unterpunkte || []).forEach(sammle); });
  return {
    sitzungId: s.id, nr: s.nr, datum: s.datum,
    teilnahme: s.teilnahme || {},
    beginnTatsaechlich: s.beginnTatsaechlich || '',
    endeTatsaechlich: s.endeTatsaechlich || '',
    punkte: punkte
  };
}

/* Spielt eine neue Tagesordnung ein und rettet protokollierte Inhalte über die IDs; Bilanz warnt vor echtem Verlust. */
function tagesordnungEinspielen(alt, neu) {
  const bilanz = { uebernommen: 0, erhalten: 0, verloren: [] };
  const altePunkte = new Map();
  if (alt) {
    const merke = p => altePunkte.set(p.id, p);
    (alt.tops || []).forEach(t => { merke(t); (t.unterpunkte || []).forEach(merke); });
  }
  const gesehen = new Set();
  const uebertrage = p => {
    bilanz.uebernommen++;
    gesehen.add(p.id);
    const vorher = altePunkte.get(p.id);
    if (!vorher) return p;
    let hatte = false;
    for (const f of PROTOKOLL_FELDER) {
      if (vorher[f] === undefined) continue;
      p[f] = vorher[f];
      if (f !== 'pauseAktiv' && (Array.isArray(vorher[f]) ? vorher[f].length : vorher[f])) hatte = true;
    }
    if (hatte) bilanz.erhalten++;
    return p;
  };
  (neu.tops || []).forEach(t => { uebertrage(t); (t.unterpunkte || []).forEach(uebertrage); });

  for (const [id, p] of altePunkte) {
    if (gesehen.has(id)) continue;
    const inhalt = (p.beschluesse || []).length || (p.aufgaben || []).length || (p.verlauf || '').trim();
    if (inhalt) bilanz.verloren.push(p.titel || '(ohne Titel)');
  }
  /* Anwesenheit/Gästeliste: Planung aus „Einladung" gilt, bis das Protokoll einen eigenen Eintrag hat – dann sticht die Doku vor Ort. */
  if (alt) {
    const eigeneAnwesenheit = Object.keys(alt.teilnahme || {})
      .some(id => ((alt.teilnahme[id] || {}).status || '').trim());
    if (eigeneAnwesenheit || !neu.teilnahme) neu.teilnahme = alt.teilnahme || {};
    if ((alt.gaeste || []).length || !neu.gaeste) neu.gaeste = alt.gaeste || [];
    neu.anlagenProt = alt.anlagenProt || [];
    neu.beginnTatsaechlich = alt.beginnTatsaechlich || '';
    neu.endeTatsaechlich = alt.endeTatsaechlich || '';
  }
  return bilanz;
}

function ergebnisseEinspielen(sitzung, nutzlast) {
  const bilanz = { punkte: 0, beschluesse: 0, aufgaben: 0, unbekannt: [] };
  const punkte = new Map();
  (sitzung.tops || []).forEach(t => {
    punkte.set(t.id, t);
    (t.unterpunkte || []).forEach(u => punkte.set(u.id, u));
  });
  for (const e of (nutzlast.punkte || [])) {
    const ziel = punkte.get(e.id);
    if (!ziel) { bilanz.unbekannt.push(e.id); continue; }
    ziel.beschluesse = e.beschluesse || [];
    ziel.aufgaben = e.aufgaben || [];
    bilanz.punkte++;
    bilanz.beschluesse += ziel.beschluesse.length;
    bilanz.aufgaben += ziel.aufgaben.length;
  }
  sitzung.teilnahme = nutzlast.teilnahme || {};
  if (nutzlast.beginnTatsaechlich) sitzung.beginnTatsaechlich = nutzlast.beginnTatsaechlich;
  if (nutzlast.endeTatsaechlich) sitzung.endeTatsaechlich = nutzlast.endeTatsaechlich;
  return bilanz;
}
function modusHatReiter(id) { return modusReiter().includes(id); }
function modusHatExport(id) { return (MODUS_EXPORTE[APP_MODUS] || MODUS_EXPORTE.sitzung).includes(id); }

const STANDARD_KATEGORIEN = [
  { key: 'formalia',    label: 'Formalia' },
  { key: 'information', label: 'Information' },
  { key: 'beratung',    label: 'Beratung' },
  { key: 'beschluss',   label: 'Beschlussfassung' },
  { key: 'sonstiges',   label: 'Sonstiges' }
];
let KATEGORIEN = Object.fromEntries(STANDARD_KATEGORIEN.map(k => [k.key, k.label]));

const BESCHLUSS_STATUS = { in_arbeit: 'In Arbeit', intern: 'Intern', zugestellt: 'Zugestellt' };
const BESCHLUSS_STATUS_KL = { in_arbeit: 'st-grau', intern: 'st-blau', zugestellt: 'st-gruen' };

const AUFGABE_STATUS = { offen: 'Offen', erledigt: 'Erledigt' };
const AUFGABE_STATUS_KL = { offen: 'st-grau', erledigt: 'st-gruen' };

const SITZUNGSART_GENITIV = {
  ordentlich: 'ordentlichen',
  ausserordentlich: 'außerordentlichen',
  konstituierend: 'konstituierenden'
};
const SITZUNGSART_AKK = {
  ordentlich: 'ordentliche',
  ausserordentlich: 'außerordentliche',
  konstituierend: 'konstituierende'
};
const SITZUNGSART_LABEL = {
  ordentlich: 'Ordentliche Sitzung',
  ausserordentlich: 'Außerordentliche Sitzung',
  konstituierend: 'Konstituierende Sitzung'
};

const STATUS_META = {
  entwurf:       { label: 'Entwurf',             kl: 'st-grau'  },
  eingeladen:    { label: 'Eingeladen',           kl: 'st-blau'  },
  protokoll:     { label: 'Protokoll in Arbeit',  kl: 'st-gelb'  },
  abgeschlossen: { label: 'Abgeschlossen',        kl: 'st-gruen' }
};

const GRUPPEN = {
  br: 'Betriebsrat',
  sbv: 'Schwerbehindertenvertretung (SBV)',
  jav: 'Jugend- und Auszubildendenvertretung (JAV)'
};
const ROLLEN = {
  br: ['Vorsitzende/r', 'Stellv. Vorsitzende/r', 'Schriftführer/in', 'Mitglied', 'Ersatzmitglied'],
  sbv: ['Vertrauensperson', 'Stellv. Vertrauensperson'],
  jav: ['Vorsitzende/r', 'Stellv. Vorsitzende/r', 'Mitglied', 'Ersatzmitglied']
};
const FUNKTIONEN = ROLLEN.br;   /* Rückwärtskompatibel */

const DOKUMENT_KATEGORIE = {
  protokoll: 'Protokoll',
  einladung: 'Einladung',
  anwesenheit: 'Anwesenheitsliste',
  'anlage-to': 'Anlage (Tagesordnung)',
  'anlage-prot': 'Anlage (Protokoll)',
  sonstig: 'Dokument'
};

const GAST_TYPEN = {
  arbeitgeber: 'Arbeitgeber',
  gewerkschaft: 'Gewerkschaftsbeauftragte/r',
  sbv: 'Schwerbehindertenvertretung',
  jav: 'Jugend- und Auszubildendenvertretung',
  sachverstaendig: 'Sachverständige/r',
  sonstig: 'Gast'
};

const TEILNAHME_LABEL = {
  anwesend: 'Anwesend',
  video: 'Video/Telefon',
  entschuldigt: 'Entschuldigt',
  fehlt: 'Unentschuldigt abwesend'
};

const STANDARD_TOPS = [
  { titel: 'Begrüßung und Eröffnung der Sitzung', kategorie: 'formalia' },
  { titel: 'Feststellung der ordnungsgemäßen Ladung und der Beschlussfähigkeit', kategorie: 'formalia' },
  { titel: 'Genehmigung der Tagesordnung', kategorie: 'beschluss' },
  { titel: 'Genehmigung der Niederschrift der letzten Sitzung', kategorie: 'beschluss' }
];

const TAG_FARBEN = ['#0E6B57', '#2C5B8A', '#8A6A1C', '#A63A20', '#5E4B8A', '#3C7A6B', '#8A5A2C', '#67727C'];

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Verlauf-HTML: Whitelist-Tags, sanitisiert. Sicherheitskritisch – wird via innerHTML angezeigt und kann aus fremden Sicherungsdateien stammen. */
/* DIV gehört dazu: Chrome legt beim Enter im Editor eine <div> je Zeile an – ohne sie ginge jeder Absatzumbruch schon beim Tippen verloren. */
const VERLAUF_TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI']);
/* Erkennt auch HTML-Entities: sonst hielt migriereVerlauf einzeiliges &nbsp; (ohne <p>) für Klartext und escapte es erneut. */
const VERLAUF_TAG_RE = /<(p|div|br|b|strong|i|em|u|ul|ol|li)(\s|>|\/)|&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]{1,8});/i;

function sanitizeVerlaufHtml(html) {
  if (html == null) return '';
  const s = String(html);
  if (!s.trim()) return '';
  const doc = new DOMParser().parseFromString(s, 'text/html');
  const ziel = document.createElement('div');
  const bau = (quelle, senke) => {
    for (const n of quelle.childNodes) {
      if (n.nodeType === 3) {
        senke.appendChild(document.createTextNode(n.nodeValue));
      } else if (n.nodeType === 1) {
        if (VERLAUF_TAGS.has(n.nodeName)) {
          const neu = document.createElement(n.nodeName.toLowerCase());
          bau(n, neu);
          senke.appendChild(neu);
        } else {
          bau(n, senke);
        }
      }
    }
  };
  bau(doc.body, ziel);
  return ziel.innerHTML;
}

/* Migration Legacy-Klartext → HTML; enthält der String bereits ein bekanntes Tag, gilt er als neues Format. */
function migriereVerlauf(text) {
  const s0 = text == null ? '' : String(text);
  if (!s0) return '';
  /* Heilt doppelt escapte Entities aus Altdaten („&amp;nbsp;" → „&nbsp;"); idempotent. */
  const s = s0.replace(/&amp;(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,8});/g, '&$1;');
  if (VERLAUF_TAG_RE.test(s)) return s;
  return s.split(/\n\n+/)
    .map(a => a.trim() === '' ? '' : '<p>' + esc(a).replace(/\n/g, '<br>') + '</p>')
    .filter(Boolean)
    .join('');
}

function verlaufZuBloecken(html) {
  const clean = sanitizeVerlaufHtml(html);
  const bloecke = [];
  if (!clean) return bloecke;
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const nurBasis = { bold: false, italic: false, underline: false };
  const stilFuer = (tag, basis) => {
    const st = { bold: basis.bold, italic: basis.italic, underline: basis.underline };
    if (tag === 'B' || tag === 'STRONG') st.bold = true;
    else if (tag === 'I' || tag === 'EM') st.italic = true;
    else if (tag === 'U') st.underline = true;
    return st;
  };
  const inhaltRuns = (knoten, basis, runs) => {
    for (const k of knoten.childNodes) {
      if (k.nodeType === 3) {
        if (k.nodeValue) runs.push({ text: k.nodeValue, bold: basis.bold, italic: basis.italic, underline: basis.underline });
      } else if (k.nodeType === 1) {
        if (k.nodeName === 'BR') { runs.push({ text: '\n', bold: basis.bold, italic: basis.italic, underline: basis.underline }); continue; }
        /* Verschachtelte Blöcke (eingefügter Text aus Word/Outlook) sonst zu einer Zeile verschmolzen. */
        if ((k.nodeName === 'DIV' || k.nodeName === 'P') && runs.length) {
          runs.push({ text: '\n', bold: basis.bold, italic: basis.italic, underline: basis.underline });
        }
        inhaltRuns(k, stilFuer(k.nodeName, basis), runs);
      }
    }
    return runs;
  };
  let lose = [];
  const spuelen = () => {
    if (lose.some(r => r.text.replace(/\n/g, '').trim() !== '')) bloecke.push({ typ: 'absatz', runs: lose });
    lose = [];
  };
  for (const n of doc.body.childNodes) {
    if (n.nodeType === 3) { if (n.nodeValue) lose.push({ text: n.nodeValue, bold: false, italic: false, underline: false }); continue; }
    if (n.nodeType !== 1) continue;
    const t = n.nodeName;
    if (t === 'UL' || t === 'OL') {
      spuelen();
      let idx = 0;
      for (const li of n.childNodes) {
        if (li.nodeType === 1 && li.nodeName === 'LI') {
          idx++;
          const prefix = t === 'OL' ? (idx + '. ') : '• ';
          bloecke.push({ typ: 'liste', prefix, runs: inhaltRuns(li, nurBasis, []) });
        }
      }
    } else if (t === 'P' || t === 'DIV' || t === 'LI') {
      spuelen();
      bloecke.push({ typ: 'absatz', runs: inhaltRuns(n, nurBasis, []) });
    } else if (t === 'BR') {
      lose.push({ text: '\n', bold: false, italic: false, underline: false });
    } else {
      inhaltRuns(n, stilFuer(t, nurBasis), lose);
    }
  }
  spuelen();
  return bloecke;
}

function heuteIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDatum(iso, mitWochentag) {
  if (!iso) return '';
  const t = String(iso).split('-');
  if (t.length !== 3) return String(iso);
  const [j, m, d] = t.map(Number);
  if (!j || !m || !d) return String(iso);
  const s = String(d).padStart(2, '0') + '.' + String(m).padStart(2, '0') + '.' + j;
  if (!mitWochentag) return s;
  const dt = new Date(j, m - 1, d);
  return WOCHENTAGE[dt.getDay()] + ', ' + s;
}

function fmtZeit(t) { return t ? t + ' Uhr' : ''; }

function jahrAus(iso) {
  const j = parseInt(String(iso || '').slice(0, 4), 10);
  return Number.isFinite(j) && j > 1900 ? j : new Date().getFullYear();
}

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function dataUrlZuBytes(dataUrl) {
  const idx = String(dataUrl).indexOf(',');
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function istPdfAnlage(a) {
  return a.mime === 'application/pdf' || /\.pdf$/i.test(a.name || '');
}
function istBildAnlage(a) {
  return /^image\/(png|jpeg|jpg)$/i.test(a.mime || '') || /\.(png|jpe?g)$/i.test(a.name || '');
}

function standardTopsDefault() {
  return STANDARD_TOPS.concat([{ titel: 'Verschiedenes', kategorie: 'sonstiges' }])
    .map(t => ({ id: uid(), titel: t.titel, kategorie: t.kategorie,
                 unterpunkte: (t.unterpunkte || []).map(u => ({ id: uid(), titel: u.titel, kategorie: u.kategorie || '' })) }));
}

function standardUnterpunkteNorm(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .map(u => (typeof u === 'string' ? { titel: u } : u))
    .filter(u => u && String(u.titel || '').trim())
    .map(u => ({ id: u.id || uid(), titel: String(u.titel).trim(), kategorie: u.kategorie || '' }));
}

function kategorienDefault() {
  return STANDARD_KATEGORIEN.map(k => ({ id: uid(), key: k.key, label: k.label }));
}

function kategorieSchluessel(label, vorhanden) {
  let basis = String(label || '').toLowerCase()
    .replace(/[äàáâ]/g, 'a').replace(/[öòóô]/g, 'o').replace(/[üùúû]/g, 'u')
    .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!basis) basis = 'kat-' + uid();
  let key = basis, n = 2;
  while (vorhanden && vorhanden.has(key)) key = basis + '-' + (n++);
  return key;
}

/* Nach jedem Laden, jeder Bearbeitung und jeder externen Übernahme aufrufen. */
function kategorienAnwenden() {
  const liste = (daten && Array.isArray(daten.kategorien) && daten.kategorien.length)
    ? daten.kategorien : kategorienDefault();
  KATEGORIEN = Object.fromEntries(liste.filter(k => k && k.key).map(k => [k.key, k.label || k.key]));
}

/* Die Kategorie ist optional: '' heißt „ohne". Ein unbekannter Schlüssel (gelöschte Kategorie) zählt ebenfalls als „ohne". */
function kategorieOderLeer(k) { return KATEGORIEN[k] ? k : ''; }
function kategorieOptionenHtml() {
  return '<option value="">– ohne –</option>' +
    Object.keys(KATEGORIEN).map(k => '<option value="' + esc(k) + '">' + esc(KATEGORIEN[k]) + '</option>').join('');
}
function kategorieText(p) { return p && p.kategorie ? (KATEGORIEN[p.kategorie] || p.kategorie) : ''; }

function protokollVorlagenDefault() {
  return [
    { titel: 'Ordnungsgemäße Ladung', text: 'Die Ladung erfolgte form- und fristgerecht; der Betriebsrat ist beschlussfähig.' },
    { titel: 'Kenntnisnahme', text: 'Der Betriebsrat nimmt die Information zur Kenntnis.' },
    { titel: 'Keine Aussprache', text: 'Zu diesem Tagesordnungspunkt gab es keine weitere Aussprache.' },
    { titel: 'Vertagung', text: 'Die Beratung dieses Punktes wird auf die nächste Sitzung vertagt.' },
    { titel: 'Einstimmiger Beschluss', text: 'Der Beschluss wurde einstimmig gefasst.' }
  ].map(t => ({ id: uid(), titel: t.titel, text: t.text }));
}

function beschlussVorlagenDefault() {
  return [
    { titel: 'Zustimmung § 99 BetrVG', text: 'Der Betriebsrat stimmt der personellen Maßnahme gemäß § 99 Abs. 1 BetrVG zu.' },
    { titel: 'Zustimmungsverweigerung § 99 BetrVG', text: 'Der Betriebsrat verweigert die Zustimmung zu der personellen Maßnahme gemäß § 99 Abs. 2 BetrVG. Die Gründe werden dem Arbeitgeber innerhalb der Wochenfrist schriftlich mitgeteilt.' },
    { titel: 'Widerspruch gegen Kündigung § 102 BetrVG', text: 'Der Betriebsrat widerspricht der beabsichtigten Kündigung gemäß § 102 Abs. 3 BetrVG. Die Begründung wird dem Arbeitgeber fristgerecht schriftlich zugeleitet.' },
    { titel: 'Bedenken gegen Kündigung', text: 'Der Betriebsrat erhebt gegen die beabsichtigte Kündigung Bedenken gemäß § 102 Abs. 2 BetrVG.' },
    { titel: 'Betriebsvereinbarung abschließen', text: 'Der Betriebsrat beschließt, die vorliegende Betriebsvereinbarung in der Fassung vom … abzuschließen. Die/der Vorsitzende wird beauftragt, sie zu unterzeichnen.' },
    { titel: 'Zustimmung Überstunden § 87 BetrVG', text: 'Der Betriebsrat stimmt der beantragten Mehrarbeit gemäß § 87 Abs. 1 Nr. 3 BetrVG im beantragten Umfang zu.' },
    { titel: 'Sachverständige/n hinzuziehen', text: 'Der Betriebsrat beschließt, gemäß § 80 Abs. 3 BetrVG eine sachverständige Person hinzuzuziehen, und beauftragt die/den Vorsitzende/n, hierüber mit dem Arbeitgeber eine Vereinbarung zu treffen.' },
    { titel: 'Schulungsteilnahme § 37 Abs. 6 BetrVG', text: 'Der Betriebsrat beschließt die Teilnahme von … an der Schulungsveranstaltung … vom … bis … gemäß § 37 Abs. 6 BetrVG. Die vermittelten Kenntnisse sind für die Betriebsratsarbeit erforderlich.' },
    { titel: 'Ausschuss beauftragen', text: 'Der Betriebsrat überträgt die Angelegenheit zur weiteren Bearbeitung dem Ausschuss … und behält sich die abschließende Beschlussfassung vor.' },
    { titel: 'Vertagung', text: 'Der Betriebsrat vertagt die Beschlussfassung auf die nächste Sitzung.' }
  ].map(t => ({ id: uid(), titel: t.titel, text: t.text }));
}

/* Externe urlaub.js (window.BR_URLAUB) hat beim Öffnen Vorrang. Datumsangaben sind ISO, beide Grenzen einschließlich. */
function urlaubNameSchluessel(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/* Einzige Normalisierungsstelle für Urlaubseinträge; Einträge ohne Namen oder mit kaputtem/verdrehtem Zeitraum fallen weg. */
function urlaubNormieren(liste, mitId) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter(e => e && e.name && e.von)
    .map(e => {
      const n = { name: String(e.name).trim().replace(/\s+/g, ' '),
                  von: String(e.von).slice(0, 10),
                  bis: String(e.bis || e.von).slice(0, 10),
                  grund: String(e.grund || 'Urlaub').trim() || 'Urlaub' };
      if (mitId) n.id = e.id || uid();
      return n;
    })
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.von) && /^\d{4}-\d{2}-\d{2}$/.test(e.bis) && e.bis >= e.von)
    .sort((a, b) => a.von < b.von ? -1 : a.von > b.von ? 1 : a.name.localeCompare(b.name, 'de'));
}

function urlaubEintraege() {
  if (typeof daten === 'undefined' || !daten) return [];
  return urlaubNormieren(daten.urlaub);
}

function abwesendAm(datum) {
  const d = String(datum || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return [];
  return urlaubEintraege().filter(e => e.von <= d && d <= e.bis);
}

function abwesenheitVon(name, datum) {
  const n = urlaubNameSchluessel(name);
  if (!n) return null;
  return abwesendAm(datum).find(e => urlaubNameSchluessel(e.name) === n) || null;
}

function isoTag(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function urlaubKalender(daten, monat, heute) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monat || ''));
  if (!m) return null;
  const jahr = parseInt(m[1], 10), mon = parseInt(m[2], 10) - 1;
  const erster = new Date(jahr, mon, 1);
  /* Montag als Wochenbeginn: getDay() liefert 0 für Sonntag. */
  const versatz = (erster.getDay() + 6) % 7;
  const start = new Date(jahr, mon, 1 - versatz);

  const eintraege = urlaubNormieren(daten && daten.urlaub);
  const sitzungen = ((daten && daten.sitzungen) || []).filter(s => s.datum && !s.archiviert);

  const wochen = [];
  const cursor = new Date(start);
  while (wochen.length < 6) {
    const woche = [];
    for (let i = 0; i < 7; i++) {
      const iso = isoTag(cursor);
      woche.push({
        iso: iso,
        tag: cursor.getDate(),
        imMonat: cursor.getMonth() === mon,
        wochenende: i >= 5,
        heute: iso === heute,
        abwesend: eintraege.filter(e => e.von <= iso && iso <= e.bis),
        sitzungen: sitzungen.filter(s => s.datum.slice(0, 10) === iso)
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    wochen.push(woche);
    if (cursor.getMonth() !== mon && wochen.length >= 5) break;
  }
  return {
    monat: monat, jahr: jahr, monatName: MONATE[mon], wochen: wochen,
    imMonat: eintraege.filter(e => e.von <= letzterTagImMonat(jahr, mon) && e.bis >= isoTag(erster))
  };
}
function letzterTagImMonat(jahr, mon) { return isoTag(new Date(jahr, mon + 1, 0)); }
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function monatVerschieben(monat, n) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monat || ''));
  if (!m) return monat;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function urlaubUnbekannteNamen(daten) {
  const bekannt = new Set((daten && daten.personen ? daten.personen : [])
    .map(p => urlaubNameSchluessel(p.name)).filter(Boolean));
  const offen = new Set();
  for (const e of urlaubEintraege()) {
    if (!bekannt.has(urlaubNameSchluessel(e.name))) offen.add(e.name);
  }
  return Array.from(offen);
}

function leeresProjekt() {
  return {
    app: 'br-sitzungsmanager',
    version: 1,
    stammdaten: {
      gremium: 'Betriebsrat',
      firma: '',
      ort: '',
      gremiumGroesse: 9,
      vertraulich: true,
      nachrichtlich: 'Schwerbehindertenvertretung, Jugend- und Auszubildendenvertretung',
      verteiler: '',   /* optionaler E-Mail-Verteiler der ordentlichen Mitglieder */
      sbvVerteiler: '',   /* optionaler E-Mail-Verteiler der SBV */
      javVerteiler: '',   /* optionaler E-Mail-Verteiler der JAV */
      logo: null
    },
    personen: [],
    dokumente: [],
    standardTops: standardTopsDefault(),
    kategorien: kategorienDefault(),
    protokollVorlagen: protokollVorlagenDefault(),
    beschlussVorlagen: beschlussVorlagenDefault(),
    urlaub: [],
    beschlussTags: [],
    sitzungen: [],
    exportOptionen: {
      anwesenheitsLeerzeilen: false
    },
    revision: 0,               /* Zählt hoch bei jeder Datei-Sicherung (gemeinsame Ablage) */
    zuletztGesichert: null,    /* { am: ISO, von: Name } der letzten Datei-Sicherung */
    aenderungsstand: 0,        /* monoton, steigt bei jeder Speicherung in diesem Browser */
    exportStand: 0             /* aenderungsstand zum Zeitpunkt der letzten Datei-Sicherung */
  };
}

function neueSitzungsNummer(daten, jahr) {
  const n = daten.sitzungen.filter(s => jahrAus(s.datum || s.angelegtAm) === jahr).length + 1;
  return String(n).padStart(2, '0') + '/' + jahr;
}

function neueSitzung(daten) {
  const jahr = new Date().getFullYear();
  return {
    id: uid(),
    angelegtAm: heuteIso(),
    nr: neueSitzungsNummer(daten, jahr),
    art: 'ordentlich',
    status: 'entwurf',
    datum: '',
    beginn: '',
    endeGeplant: '',
    beginnTatsaechlich: '',
    endeTatsaechlich: '',
    ort: '',
    videokonferenz: false,
    videoHinweis: '',
    einladungDatum: heuteIso(),
    einladungHinweis: '',
    sitzungsleitung: '',
    protokollfuehrung: '',
    tops: [],
    anlagenTO: [],
    anlagenProt: [],
    teilnahme: {},
    gaeste: []
  };
}

function neuerTop(vorlage) {
  return Object.assign({
    id: uid(),
    titel: '',
    kategorie: '',
    beschreibung: '',
    referent: '',
    dauer: '',
    anlagen: [],
    verlauf: '',
    beschluesse: [],
    aufgaben: [],
    unterpunkte: []
  }, vorlage || {});
}

function neuerUnterpunkt(vorlage) {
  return Object.assign({
    id: uid(),
    titel: '',
    kategorie: '',
    beschreibung: '',
    referent: '',
    dauer: '',
    anlagen: [],
    verlauf: '',
    beschluesse: [],
    aufgaben: []
  }, vorlage || {});
}

function neuerBeschluss(daten, jahr) {
  return {
    id: uid(),
    jahr: jahr,
    lfd: naechsteBeschlussLfd(daten, jahr),
    antrag: '',
    ja: '',
    nein: '',
    enthaltung: '',
    ergebnis: 'auto',
    status: 'in_arbeit',
    tags: [],
    nichtBeteiligt: {}   /* mitgliedId → Grund (NICHT_BETEILIGT) */
  };
}

function neueAufgabe() { return { id: uid(), was: '', wer: '', bis: '', status: 'offen' }; }

function personenDerGruppe(daten, gruppe) {
  return (daten.personen || []).filter(p => (p.gruppe || 'br') === gruppe);
}
function aktivePersonen(daten, gruppe) {
  return personenDerGruppe(daten, gruppe).filter(p => p.aktiv !== false);
}
function aktiveMitglieder(daten) {
  return aktivePersonen(daten, 'br');
}
function personenTauschen(a, b) {
  const ia = daten.personen.indexOf(a), ib = daten.personen.indexOf(b);
  if (ia < 0 || ib < 0) return;
  const t = daten.personen[ia]; daten.personen[ia] = daten.personen[ib]; daten.personen[ib] = t;
}

function vorsitzName(daten) {
  const v = aktiveMitglieder(daten).find(m => m.funktion === 'Vorsitzende/r');
  if (v) return v.name;
  const sv = aktiveMitglieder(daten).find(m => m.funktion === 'Stellv. Vorsitzende/r');
  return sv ? sv.name : '';
}

function sitzungsleitungRolle(daten, s) {
  const leit = (s.sitzungsleitung || '').trim();
  let funktion = '';
  if (leit) {
    const p = aktiveMitglieder(daten).find(m => (m.name || '').trim() === leit);
    funktion = p ? p.funktion : '';
  } else {
    const v = aktiveMitglieder(daten).find(m => m.funktion === 'Vorsitzende/r');
    funktion = v ? 'Vorsitzende/r'
      : (aktiveMitglieder(daten).find(m => m.funktion === 'Stellv. Vorsitzende/r') ? 'Stellv. Vorsitzende/r' : 'Vorsitzende/r');
  }
  if (funktion === 'Stellv. Vorsitzende/r') return 'Stellv. Vorsitzende/r des Betriebsrats';
  if (funktion === 'Vorsitzende/r' || !funktion) return 'Vorsitzende/r des Betriebsrats';
  return funktion + ' des Betriebsrats';
}

function schriftfuehrerName(daten) {
  const s = aktiveMitglieder(daten).find(m => m.funktion === 'Schriftführer/in');
  return s ? s.name : '';
}

function teilnahmeVon(sitzung, mitgliedId) {
  return (sitzung.teilnahme && sitzung.teilnahme[mitgliedId]) || { status: '', vertretenDurch: '' };
}

/* Teilnahme nur an einzelnen TOPs (z. B. nachgerücktes Ersatzmitglied, spät gekommen): t.tops = [TOP-IDs].
   Fehlt das Feld, gilt die ganze Sitzung. Unterpunkte zählen zu ihrem TOP. */
function nurEinzelneTops(t) { return !!t && Array.isArray(t.tops); }
function anwesendBeiTop(t, topId) { return !nurEinzelneTops(t) || !topId || t.tops.includes(topId); }
function hauptTopVon(sitzung, punkt) {
  return ((sitzung && sitzung.tops) || []).find(t => t === punkt || (t.unterpunkte || []).includes(punkt)) || null;
}
function teilweiseText(sitzung, t) {
  if (!nurEinzelneTops(t)) return '';
  const nrn = (sitzung.tops || []).map((top, i) => t.tops.includes(top.id) ? String(i + 1) : '').filter(Boolean);
  return nrn.length ? 'nur TOP ' + nrn.join(', ') : 'bei keinem TOP';
}

function teilnehmerGruppen(daten, sitzung) {
  const g = { teilnehmend: [], entschuldigt: [], fehlt: [], offen: [] };
  for (const m of aktiveMitglieder(daten)) {
    const t = teilnahmeVon(sitzung, m.id);
    if (t.status === 'anwesend' || t.status === 'video') g.teilnehmend.push({ m, t });
    else if (t.status === 'entschuldigt') g.entschuldigt.push({ m, t });
    else if (t.status === 'fehlt') g.fehlt.push({ m, t });
    else g.offen.push({ m, t });
  }
  return g;
}

function nameMitRolle(m) {
  return m.name + (m.funktion && m.funktion !== 'Mitglied' ? ' (' + m.funktion + ')' : '');
}

/* Nur tatsächlich Anwesende; Video/Telefon zählt als „Abw. Anwesenheit". */
function anwesenheitsDaten(daten, s) {
  const mitglieder = teilnehmerGruppen(daten, s).teilnehmend.map(({ m, t }) => ({
    name: nameMitRolle(m),
    abw: [t.status === 'video' ? 'Video/Telefon' : '', teilweiseText(s, t)].filter(Boolean).join(', ')
  }));
  const gaeste = (s.gaeste || []).map(g => ({
    name: g.name || '',
    funktion: g.funktion || GAST_TYPEN[g.typ] || 'Gast',
    abw: ''
  }));
  return { mitglieder, gaeste };
}

/* Beschlussfähigkeit: mindestens die Hälfte der Betriebsratsmitglieder nimmt teil (Ersatzmitglieder zählen mit). */
function quorumInfo(daten, sitzung) {
  const groesse = parseInt(daten.stammdaten.gremiumGroesse, 10) ||
    aktiveMitglieder(daten).filter(m => m.funktion !== 'Ersatzmitglied').length || 0;
  const erforderlich = Math.ceil(groesse / 2);
  const g = teilnehmerGruppen(daten, sitzung);
  const teilnehmend = g.teilnehmend.length;
  return {
    groesse, erforderlich, teilnehmend,
    beschlussfaehig: groesse > 0 && teilnehmend >= erforderlich,
    erfasst: teilnehmend + g.entschuldigt.length + g.fehlt.length > 0
  };
}

const NICHT_BETEILIGT = { nicht_stimmberechtigt: 'nicht stimmberechtigt', abwesend: 'abwesend' };

/* Stimmbasis eines Beschlusses: die teilnehmenden Mitglieder ohne die, die an dieser Abstimmung nicht beteiligt waren
   (nicht stimmberechtigt oder zeitweise abwesend). Beschlussfähig nur, wenn mindestens die Hälfte an der Beschlussfassung teilnimmt. */
function abstimmungsBasis(daten, sitzung, b, punkt) {
  const q = quorumInfo(daten, sitzung);
  const top = punkt ? hauptTopVon(sitzung, punkt) : null;
  const markiert = (b && b.nichtBeteiligt) || {};
  const dabei = teilnehmerGruppen(daten, sitzung).teilnehmend.filter(({ t }) => anwesendBeiTop(t, top && top.id));
  const ausgenommen = dabei
    .filter(({ m }) => NICHT_BETEILIGT[markiert[m.id]])
    .map(({ m }) => ({ m, grund: markiert[m.id] }));
  const teilnehmend = dabei.length - ausgenommen.length;
  return {
    dabei: dabei.map(({ m }) => m), teilnehmend, ausgenommen, erforderlich: q.erforderlich, erfasst: q.erfasst,
    reduziert: teilnehmend < q.teilnehmend,   /* weniger als in der Sitzung – nur dann lohnt die eigene Warnung */
    beschlussfaehig: q.groesse > 0 && teilnehmend >= q.erforderlich
  };
}
function nichtBeteiligtText(basis) {
  return basis.ausgenommen.map(e => e.m.name + ' (' + NICHT_BETEILIGT[e.grund] + ')').join(', ');
}

function alleBeschluesse(daten) {
  const liste = [];
  for (const s of daten.sitzungen) {
    (s.tops || []).forEach((t, i) => {
      (t.beschluesse || []).forEach(b => liste.push({ sitzung: s, top: t, b, nr: String(i + 1) }));
      (t.unterpunkte || []).forEach((u, j) => {
        const nr = (i + 1) + '.' + (j + 1);
        (u.beschluesse || []).forEach(b => liste.push({ sitzung: s, top: u, b, nr: nr }));
      });
    });
  }
  return liste;
}

/* Ein TOP mit Unterpunkten gilt schon als protokolliert, sobald ein Unterpunkt Inhalt hat – sonst käme man
   bei unterpunktweiser Mitschrift nie auf 100 %. */
function protokollFortschritt(s) {
  const stand = { punkte: 0, erledigt: 0, beschluesse: 0, aufgaben: 0, pause: false };
  const hatInhalt = p =>
    !!((p.beschluesse || []).length || (p.aufgaben || []).length ||
       (p.verlauf || '').replace(/<[^>]*>/g, '').trim());
  const zaehle = (p, auchOhneEigenen) => {
    stand.punkte++;
    stand.beschluesse += (p.beschluesse || []).length;
    stand.aufgaben += (p.aufgaben || []).length;
    if (hatInhalt(p) || auchOhneEigenen) stand.erledigt++;
    if (p.pauseAktiv) stand.pause = true;
  };
  ((s && s.tops) || []).forEach(t => {
    const unter = t.unterpunkte || [];
    zaehle(t, unter.some(hatInhalt));
    unter.forEach(u => zaehle(u, false));
  });
  return stand;
}

function sitzungBeschlussZahl(s) {
  return (s.tops || []).reduce((n, t) =>
    n + (t.beschluesse || []).length +
    (t.unterpunkte || []).reduce((m, u) => m + (u.beschluesse || []).length, 0), 0);
}

function naechsteBeschlussLfd(daten, jahr) {
  let max = 0;
  for (const e of alleBeschluesse(daten)) {
    if (e.b.jahr === jahr && Number(e.b.lfd) > max) max = Number(e.b.lfd);
  }
  return max + 1;
}

function beschlussNrText(b) { return b.lfd + '/' + b.jahr; }

/* Mehrheit der teilnehmenden Mitglieder; Enthaltungen wirken faktisch wie Nein-Stimmen, bei Stimmengleichheit abgelehnt. */
function beschlussAuswertung(b, basisTeilnehmend) {
  const ja = parseInt(b.ja, 10) || 0;
  const nein = parseInt(b.nein, 10) || 0;
  const enth = parseInt(b.enthaltung, 10) || 0;
  const abgegeben = ja + nein + enth;
  const basis = basisTeilnehmend > 0 ? basisTeilnehmend : abgegeben;
  let angenommen;
  if (b.ergebnis === 'angenommen') angenommen = true;
  else if (b.ergebnis === 'abgelehnt') angenommen = false;
  else angenommen = basis > 0 ? ja > basis / 2 : false;
  let text = angenommen ? 'Der Antrag ist angenommen.' : 'Der Antrag ist abgelehnt.';
  if (angenommen && nein === 0 && enth === 0 && ja > 0) text = 'Der Antrag ist einstimmig angenommen.';
  else if (angenommen && nein === 0 && enth > 0) text = 'Der Antrag ist ohne Gegenstimmen angenommen.';
  const warnung = (basisTeilnehmend > 0 && abgegeben > basisTeilnehmend)
    ? 'Es wurden mehr Stimmen erfasst, als Mitglieder teilnehmen.' : '';
  return { angenommen, ja, nein, enth, basis, text, warnung, manuell: b.ergebnis !== 'auto' };
}

function anlagenTagesordnung(sitzung) {
  const liste = [];
  (sitzung.tops || []).forEach((t, i) => {
    (t.anlagen || []).forEach(a => liste.push({ a, quelle: 'zu TOP ' + (i + 1) }));
    (t.unterpunkte || []).forEach((u, j) => {
      (u.anlagen || []).forEach(a => liste.push({ a, quelle: 'zu TOP ' + (i + 1) + '.' + (j + 1) }));
    });
  });
  (sitzung.anlagenTO || []).forEach(a => liste.push({ a, quelle: 'Allgemein' }));
  return liste;
}

function anlagenProtokoll(sitzung) {
  return (sitzung.anlagenProt || []).map(a => ({ a, quelle: '' }));
}

/* Leere Zuweisung (gast.tops) = Teilnahme an der gesamten Sitzung; nicht mehr vorhandene IDs werden ignoriert. */
function gastTops(sitzung, gast) {
  const ids = new Set(gast && Array.isArray(gast.tops) ? gast.tops : []);
  const res = [];
  (sitzung.tops || []).forEach((t, i) => {
    const voll = ids.has(t.id);
    const subs = (t.unterpunkte || []).map((u, j) => ({ u, unr: (i + 1) + '.' + (j + 1) })).filter(x => ids.has(x.u.id));
    if (voll || subs.length) res.push({ top: t, nr: i + 1, voll: voll, unterpunkte: subs });
  });
  return res;
}
function gastAuswahlAnzahl(sitzung, gast) {
  const ids = new Set(gast && Array.isArray(gast.tops) ? gast.tops : []);
  let n = 0;
  (sitzung.tops || []).forEach(t => {
    if (ids.has(t.id)) n++;
    (t.unterpunkte || []).forEach(u => { if (ids.has(u.id)) n++; });
  });
  return n;
}
function gastPunkteBezeichnung(sitzung, gast) {
  const list = [];
  gastTops(sitzung, gast).forEach(x => {
    if (x.voll) list.push('TOP ' + x.nr);
    else x.unterpunkte.forEach(sp => list.push('TOP ' + sp.unr));
  });
  return list.join(', ');
}

function alleAufgaben(sitzung) {
  const liste = [];
  (sitzung.tops || []).forEach((t, i) => {
    (t.aufgaben || []).forEach(auf => {
      if ((auf.was || '').trim()) liste.push({ topNr: String(i + 1), nr: String(i + 1), top: t, auf });
    });
    (t.unterpunkte || []).forEach((u, j) => {
      const nr = (i + 1) + '.' + (j + 1);
      (u.aufgaben || []).forEach(auf => {
        if ((auf.was || '').trim()) liste.push({ topNr: nr, nr: nr, top: u, auf });
      });
    });
  });
  return liste;
}

function alleAufgabenGremium(daten) {
  const liste = [];
  for (const s of daten.sitzungen) {
    for (const e of alleAufgaben(s)) liste.push({ sitzung: s, top: e.top, auf: e.auf, nr: e.nr });
  }
  return liste.sort((x, y) => {
    const dx = x.sitzung.datum || x.sitzung.angelegtAm || '';
    const dy = y.sitzung.datum || y.sitzung.angelegtAm || '';
    return dy.localeCompare(dx);
  });
}
/* Kernmodul 2: PDF-Layout-Engine (pdf-lib) */

const PDF_A4 = { w: 595.28, h: 841.89 };

/* Zeichen außerhalb WinAnsi (CP1252) ersetzen, damit pdf-lib-Standardschriften nie eine Kodierungs-Exception werfen. */
const PDF_ERSATZ = {
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2015': '-', '\u2212': '-',
  '\u00A0': ' ', '\u202F': ' ', '\u2009': ' ', '\u200B': '',
  '\u2192': '->', '\u2190': '<-', '\u21D2': '=>',
  '\u2713': 'x', '\u2714': 'x', '\u2717': 'x', '\u25A1': '[ ]', '\u2610': '[ ]',
  '\u201F': '"', '\u2032': "'", '\u2033': '"'
};
const PDF_CP1252_EXTRA = new Set('\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178'.split(''));

const PDF_TRANSLIT = {
  '\u0141': 'L', '\u0142': 'l', '\u0110': 'D', '\u0111': 'd',
  '\u0131': 'i', '\u0130': 'I', '\u1E9E': 'SS', '\u02BC': "'"
};

function pdfText(s) {
  if (s == null) return '';
  const erlaubt = c => (c >= 0x20 && c <= 0x7E) || (c >= 0xA1 && c <= 0xFF);
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (ch === '\n') { out += '\n'; continue; }
    if (ch === '\r') continue;
    if (ch === '\t') { out += '  '; continue; }
    if (PDF_ERSATZ[ch] !== undefined) { out += PDF_ERSATZ[ch]; continue; }
    if (PDF_TRANSLIT[ch] !== undefined) { out += PDF_TRANSLIT[ch]; continue; }
    if (erlaubt(c) || PDF_CP1252_EXTRA.has(ch)) { out += ch; continue; }
    if (c === 0xAD) continue;
    const basis = ch.normalize ? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
    for (const n of basis) {
      const nc = n.codePointAt(0);
      if (erlaubt(nc) || PDF_CP1252_EXTRA.has(n)) out += n;
    }
  }
  return out;
}

/* Zustände bekommen zusätzlich eine Form (Rechteck=Freigabe, Dreieck=Warnung) für Graustufendruck und Farbfehlsichtigkeit. */
/* Erscheinungsbild: Das Gremium wählt eine Akzentfarbe; die Varianten werden daraus abgeleitet, und die
   Kontrastregel aus DESIGN.md bleibt gewahrt (Flächen ≥ 3:1 auf Weiß, weiße Schrift auf der dunklen Variante ≥ 4,5:1). */
const STANDARD_AKZENT = '#009057';
const AKZENT_VORSCHLAEGE = [
  ['#009057', 'Freigabegrün'], ['#1F5FAD', 'Blau'], ['#00707A', 'Petrol'], ['#8E1B3A', 'Bordeaux'],
  ['#5B3E96', 'Violett'], ['#B34700', 'Orange'], ['#3A4650', 'Anthrazit']
];

function hexNorm(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  return m ? '#' + m[1].toUpperCase() : null;
}
function hexZuRgb(hex) { const n = parseInt(hexNorm(hex).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgbZuHex(rgb) { return '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
/* t = Anteil von b (0 … 1) */
function farbMischung(a, b, t) { const x = hexZuRgb(a), y = hexZuRgb(b); return rgbZuHex(x.map((v, i) => v + (y[i] - v) * t)); }
function farbKontrast(a, b) {
  const lum = hex => {
    const [r, g, bl] = hexZuRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/* Schiebt die Farbe so wenig wie nötig Richtung „zu", bis sie gegen „gegen" den Kontrast erreicht. */
function farbeBisKontrast(hex, zu, gegen, ziel) {
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const f = farbMischung(hex, zu, t);
    if (farbKontrast(f, gegen) >= ziel) return f;
  }
  return zu;
}

function akzentPalette(wunsch) {
  const hex = hexNorm(wunsch) || STANDARD_AKZENT;
  if (hex === STANDARD_AKZENT) {
    return { wunsch: hex, akzent: '#009057', dunkel: '#00673E', hell: '#E2F1EA', rand: '#9CCDB7',
             praesDunkel: '#35C68C', praesDunkelFg: '#06231A', angepasst: false };
  }
  const akzent = farbeBisKontrast(hex, '#000000', '#FFFFFF', 3);
  const dunkel = farbeBisKontrast(farbMischung(akzent, '#000000', 0.285), '#000000', '#FFFFFF', 4.5);
  return {
    wunsch: hex, akzent, dunkel,
    hell: farbMischung(akzent, '#FFFFFF', 0.88), rand: farbMischung(akzent, '#FFFFFF', 0.6),
    praesDunkel: farbeBisKontrast(akzent, '#FFFFFF', '#0E1211', 6), praesDunkelFg: '#0E1211',
    angepasst: akzent !== hex
  };
}

/* Einstellungen mit Vorgaben; fehlt der Block (ältere Stände), gilt das Standard-Erscheinungsbild. */
function erscheinung(st) {
  const e = (st && st.erscheinung) || {};
  return {
    akzent: hexNorm(e.akzent) || STANDARD_AKZENT,
    name: String(e.name || '').trim(),
    untertitel: String(e.untertitel || '').trim(),
    logoSeitenleiste: !!e.logoSeitenleiste
  };
}

function pdfFarben(rgb, palette) {
  return {
    ink:     rgb(0.051, 0.067, 0.075),
    grau:    rgb(0.373, 0.420, 0.447),
    hell:    rgb(0.545, 0.584, 0.608),
    linie:   rgb(0.682, 0.710, 0.694),
    linieHell: rgb(0.835, 0.851, 0.839),
    akzent:  rgb(...hexZuRgb(palette.akzent).map(v => v / 255)),
    akzentTief: rgb(...hexZuRgb(palette.dunkel).map(v => v / 255)),
    fuellung: rgb(0.957, 0.961, 0.953),
    kopfFuellung: rgb(0.051, 0.067, 0.075),
    warn:    rgb(0.894, 0.706, 0.161),
    warnTief: rgb(0.541, 0.357, 0.071),
    gruen:   rgb(0.000, 0.404, 0.243),   /* Status „angenommen" – bleibt grün, unabhängig von der Akzentfarbe */
    rot:     rgb(0.639, 0.125, 0.090),
    weiss:   rgb(1, 1, 1)
  };
}

class PdfBuilder {
  constructor(doc, fonts, farben, kopf, fuss) {
    this.doc = doc;
    this.f = fonts;
    this.c = farben;
    this.kopf = kopf || {};
    this.fuss = fuss || {};
    this.rand = { o: 62, u: 68, l: 57, r: 57 };
    this.seite = null;
    this.y = 0;
    this.alleSeiten = [];
    this._breitenCache = new Map();
  }

  /* pdf-lib misst mit AFM-Kerning, rendert Tj aber ohne – darum hier kerningfreie Messung je Zeichen. */
  breiteVon(text, font, size) {
    let cache = this._breitenCache.get(font);
    if (!cache) { cache = new Map(); this._breitenCache.set(font, cache); }
    let w = 0;
    for (const ch of String(text)) {
      let cw = cache.get(ch);
      if (cw === undefined) { cw = font.widthOfTextAtSize(ch, 1000); cache.set(ch, cw); }
      w += cw;
    }
    return w * size / 1000;
  }

  get breite() { return PDF_A4.w - this.rand.l - this.rand.r; }
  get xL() { return this.rand.l; }
  get xR() { return PDF_A4.w - this.rand.r; }

  neueSeite() {
    this.seite = this.doc.addPage([PDF_A4.w, PDF_A4.h]);
    this.alleSeiten.push({ page: this.seite, eigen: true });
    this.y = PDF_A4.h - this.rand.o;
    if (this.alleSeiten.filter(s => s.eigen).length > 1) this._laufkopf();
  }


  _laufkopf() {
    const p = this.seite, yk = PDF_A4.h - 38;
    const l = pdfText(this.kopf.links || '');
    const r = pdfText(this.kopf.rechts || '');
    if (l) p.drawText(l, { x: this.xL, y: yk, size: 8, font: this.f.reg, color: this.c.grau });
    if (r) {
      const w = this.breiteVon(r, this.f.reg, 8);
      p.drawText(r, { x: this.xR - w, y: yk, size: 8, font: this.f.reg, color: this.c.grau });
    }
    p.drawLine({ start: { x: this.xL, y: yk - 7 }, end: { x: this.xR, y: yk - 7 }, thickness: 0.5, color: this.c.linie });
    this.y = yk - 28;
  }

  platz(h) { if (this.y - h < this.rand.u) { this.neueSeite(); return true; } return false; }
  abstand(h) { this.y -= h; if (this.y < this.rand.u) this.neueSeite(); }

  umbrechen(text, font, size, maxW) {
    const zeilen = [];
    for (const roh of pdfText(text).split('\n')) {
      if (roh.trim() === '') { zeilen.push(''); continue; }
      const worte = roh.split(/ +/);
      let akt = '';
      const passt = t => this.breiteVon(t, font, size) <= maxW;
      for (let wort of worte) {
        while (!passt(wort) && wort.length > 1) {
          let i = wort.length - 1;
          while (i > 1 && !passt((akt ? akt + ' ' : '') + wort.slice(0, i))) i--;
          if (akt && !passt(akt + ' ' + wort.slice(0, i))) { zeilen.push(akt); akt = ''; continue; }
          zeilen.push((akt ? akt + ' ' : '') + wort.slice(0, i));
          akt = ''; wort = wort.slice(i);
        }
        const test = akt ? akt + ' ' + wort : wort;
        if (passt(test)) akt = test;
        else { if (akt) zeilen.push(akt); akt = wort; }
      }
      zeilen.push(akt);
    }
    while (zeilen.length > 1 && zeilen[zeilen.length - 1] === '') zeilen.pop();
    return zeilen;
  }

  absatz(text, o) {
    o = o || {};
    const size = o.size || 10.5;
    const font = o.font || this.f.reg;
    const farbe = o.farbe || this.c.ink;
    const einzug = o.einzug || 0;
    const maxW = (o.maxW || this.breite) - einzug;
    const lh = size * (o.zeilenFaktor || 1.42);
    const zeilen = this.umbrechen(text, font, size, maxW);
    for (const z of zeilen) {
      this.platz(lh);
      if (z) this.seite.drawText(z, { x: this.xL + einzug, y: this.y - size, size, font, color: farbe });
      this.y -= lh;
    }
    this.abstand(o.abstandDanach != null ? o.abstandDanach : 6);
  }

  absatzRich(runs, o) {
    o = o || {};
    const size = o.size || 10.5;
    const lh = size * (o.zeilenFaktor || 1.42);
    const xText = o.xText != null ? o.xText : this.xL;
    const xRechts = o.xRechts != null ? o.xRechts : this.xR;
    const farbe = o.farbe || this.c.ink;
    const maxW = xRechts - xText;
    const fontFor = a => (a.bold && a.italic) ? this.f.fettKursiv : a.bold ? this.f.fett : a.italic ? this.f.kursiv : this.f.reg;

    const atoms = [];
    for (const run of (runs || [])) {
      const stil = { bold: !!run.bold, italic: !!run.italic, underline: !!run.underline };
      const teile = pdfText(run.text == null ? '' : run.text).split('\n');
      teile.forEach((teil, i) => {
        if (i > 0) atoms.push({ br: true });
        for (const st of teil.split(/(\s+)/)) {
          if (st === '') continue;
          atoms.push(Object.assign({ br: false, leer: /^\s+$/.test(st), text: st }, stil));
        }
      });
    }

    let zeile = [], breiteAkt = 0, erste = true;
    const zeichneZeile = () => {
      this.platz(lh);
      if (erste && o.prefix) {
        this.seite.drawText(pdfText(o.prefix), { x: (o.xPrefix != null ? o.xPrefix : xText), y: this.y - size, size, font: this.f.reg, color: farbe });
      }
      let x = xText;
      for (const a of zeile) {
        if (!a.leer && a.text) {
          const font = fontFor(a);
          this.seite.drawText(a.text, { x, y: this.y - size, size, font, color: farbe });
          if (a.underline) this.seite.drawLine({ start: { x, y: this.y - size - 1.6 }, end: { x: x + a._w, y: this.y - size - 1.6 }, thickness: 0.5, color: farbe });
        }
        x += a._w;
      }
      this.y -= lh;
      erste = false; zeile = []; breiteAkt = 0;
    };

    for (const a of atoms) {
      if (a.br) { zeichneZeile(); continue; }
      const font = fontFor(a);
      a._w = this.breiteVon(a.text, font, size);
      if (a.leer) {
        if (zeile.length === 0) continue;
        if (breiteAkt + a._w > maxW) { zeichneZeile(); continue; }
        zeile.push(a); breiteAkt += a._w; continue;
      }
      if (a._w <= maxW) {
        if (breiteAkt + a._w > maxW && zeile.length) zeichneZeile();
        zeile.push(a); breiteAkt += a._w;
      } else {
        if (zeile.length) zeichneZeile();
        let rest = a.text;
        while (rest.length) {
          let i = rest.length;
          while (i > 1 && this.breiteVon(rest.slice(0, i), font, size) > maxW) i--;
          const chunk = rest.slice(0, i), cw = this.breiteVon(chunk, font, size);
          zeile.push(Object.assign({}, a, { text: chunk, _w: cw }));
          breiteAkt += cw; rest = rest.slice(i);
          if (rest.length) zeichneZeile();
        }
      }
    }
    if (zeile.length) zeichneZeile();
  }

  verlaufBloeckeZeichnen(bloecke, o) {
    o = o || {};
    const size = o.size || 10.5;
    bloecke = bloecke || [];
    bloecke.forEach((bl, i) => {
      if (bl.typ === 'liste') {
        const prefix = bl.prefix || '• ';
        const xPrefix = this.xL + 6;
        const prefixW = this.breiteVon(pdfText(prefix), this.f.reg, size);
        this.absatzRich(bl.runs, { size, xText: xPrefix + prefixW, xRechts: this.xR, prefix, xPrefix });
        this.abstand(2);
      } else {
        this.absatzRich(bl.runs, { size, xText: this.xL, xRechts: this.xR });
        if (i < bloecke.length - 1) this.abstand(4);
      }
    });
    this.abstand(o.abstandDanach != null ? o.abstandDanach : 6);
  }

  /* Nur zwei Linienstärken im ganzen Dokument: Ebene 1 Tintenkante, Ebene 2 Haarlinie. */
  ueberschrift(text, ebene) {
    const s = ebene === 1 ? 15 : ebene === 2 ? 12 : 10.5;
    const oben = ebene === 1 ? 6 : ebene === 2 ? 10 : 6;
    const lh = s * 1.28;
    const versal = ebene === 1;
    const roh = versal ? String(text == null ? '' : text).toUpperCase() : text;
    const sperrung = versal ? s * 0.05 : 0;
    const zeilen = this.umbrechen(roh, this.f.fett, s, this.breite - sperrung * 8);
    this.platz(zeilen.length * lh + oben + 22);
    this.abstand(oben);
    for (const z of zeilen) {
      if (z) this.seite.drawText(z, { x: this.xL, y: this.y - s, size: s, font: this.f.fett, color: this.c.ink, characterSpacing: sperrung });
      this.y -= lh;
    }
    this.y -= 2;
    if (ebene === 1) {
      this.seite.drawRectangle({ x: this.xL, y: this.y - 2, width: this.breite, height: 2, color: this.c.ink });
      for (let x = this.xL; x < this.xR; x += 19) {
        this.seite.drawRectangle({ x, y: this.y - 6.6, width: Math.min(13, this.xR - x), height: 2.2, color: this.c.akzent });
      }
      this.y -= 12;
    } else if (ebene === 2) {
      this.seite.drawLine({ start: { x: this.xL, y: this.y }, end: { x: this.xR, y: this.y }, thickness: 0.6, color: this.c.linie });
      this.y -= 9;
    } else this.y -= 4;
  }

  metaZeile(label, wert, o) {
    o = o || {};
    const size = o.size || 10.5;
    const labelW = o.labelW || 128;
    const lh = size * 1.4;
    const zeilen = this.umbrechen(wert || '–', o.wertFont || this.f.reg, size, this.breite - labelW);
    this.platz(lh * zeilen.length + 2);
    this.seite.drawText(pdfText(label), { x: this.xL, y: this.y - size, size, font: this.f.reg, color: this.c.grau });
    zeilen.forEach((z, i) => {
      if (i > 0) this.platz(lh);
      if (z) this.seite.drawText(z, { x: this.xL + labelW, y: this.y - size, size, font: o.wertFont || this.f.reg, color: this.c.ink });
      this.y -= lh;
    });
    this.abstand(o.abstandDanach != null ? o.abstandDanach : 2);
  }

  linie(o) {
    o = o || {};
    this.platz(8);
    this.seite.drawLine({ start: { x: this.xL, y: this.y }, end: { x: this.xR, y: this.y }, thickness: o.staerke || 0.6, color: o.farbe || this.c.linie });
    this.abstand(o.abstandDanach != null ? o.abstandDanach : 10);
  }

  spur(o) {
    o = o || {};
    const laenge = o.laenge || 13, luecke = o.luecke || 6, staerke = o.staerke || 2.4;
    this.platz(staerke + 6);
    for (let x = this.xL; x < this.xR; x += laenge + luecke) {
      const bis = Math.min(x + laenge, this.xR);
      this.seite.drawRectangle({ x, y: this.y - staerke, width: bis - x, height: staerke, color: o.farbe || this.c.akzent });
    }
    this.abstand(o.abstandDanach != null ? o.abstandDanach : 10);
  }

  schild(text, art, o) {
    o = o || {};
    const size = o.size || 10;
    const pad = 7, formB = 9, abstand = 7;
    const t = pdfText(text);
    const tw = this.breiteVon(t, this.f.fett, size);
    const w = o.breite || (pad + formB + abstand + tw + pad);
    const h = o.hoehe || (size + 2 * pad - 2);
    const x = o.x != null ? o.x : this.xL;
    if (o.x == null) this.platz(h + 6);
    const yTop = o.y != null ? o.y : this.y;
    const yUnten = yTop - h;

    const frei = art === 'frei', warn = art === 'warn';
    const grund = frei ? this.c.akzent : warn ? this.c.warn : this.c.fuellung;
    const kante = frei ? this.c.akzent : this.c.ink;
    const schrift = frei ? this.c.weiss : this.c.ink;
    this.seite.drawRectangle({ x, y: yUnten, width: w, height: h, color: grund, borderColor: kante, borderWidth: 1.4 });

    const fy = yUnten + (h - formB) / 2;
    if (warn) {
      /* Dreieck aus drei Linien – pdf-lib zeichnet keine Polygone. */
      const s = formB + 1, xm = x + pad + s / 2, yb = yUnten + (h - s) / 2;
      const p = [[x + pad, yb], [x + pad + s, yb], [xm, yb + s], [x + pad, yb]];
      for (let i = 0; i < p.length - 1; i++) {
        this.seite.drawLine({ start: { x: p[i][0], y: p[i][1] }, end: { x: p[i + 1][0], y: p[i + 1][1] }, thickness: 1.6, color: this.c.ink });
      }
    } else {
      this.seite.drawRectangle({ x: x + pad, y: fy, width: formB, height: formB, color: frei ? this.c.weiss : this.c.ink });
    }
    this.seite.drawText(t, { x: x + pad + formB + abstand, y: yUnten + (h - size) / 2 + 1.5, size, font: this.f.fett, color: schrift });

    if (o.x == null && o.y == null) { this.y = yUnten; this.abstand(o.abstandDanach != null ? o.abstandDanach : 10); }
    return w;
  }

  zellenUmbruch(txt, font, size, maxW, spalte) {
    const s = String(txt == null ? '' : txt);
    if (spalte && spalte.nowrap) return [pdfText(s).replace(/\n/g, ' ')];
    return this.umbrechen(s, font, size, maxW);
  }

  tabelle(cfg) {
    const size = cfg.size || 9.5;
    const lh = size * 1.35;
    const pad = cfg.zellAbstand != null ? cfg.zellAbstand : 5;
    const breiten = cfg.spalten.map(s => s.anteil * this.breite);
    const xPos = [this.xL];
    for (const b of breiten) xPos.push(xPos[xPos.length - 1] + b);

    const zelleZeichnen = (txt, i, yTop, font, farbe, spalte) => {
      const zl = this.zellenUmbruch(txt, font, size, breiten[i] - 2 * pad, spalte);
      let ty = yTop - pad - size;
      for (const z of zl) {
        if (!z) { ty -= lh; continue; }
        let x = xPos[i] + pad;
        if (cfg.spalten[i].align === 'right') x = xPos[i + 1] - pad - this.breiteVon(z, font, size);
        this.seite.drawText(z, { x, y: ty, size, font, color: farbe });
        ty -= lh;
      }
      return zl.length;
    };

    const kopfZeichnen = () => {
      const maxZ = Math.max(...cfg.spalten.map((s, i) => this.umbrechen(s.titel, this.f.fett, size, breiten[i] - 2 * pad).length));
      const h = maxZ * lh + 2 * pad;
      this.platz(h + lh * 2);
      this.seite.drawRectangle({ x: this.xL, y: this.y - h, width: this.breite, height: h, color: this.c.kopfFuellung });
      cfg.spalten.forEach((s, i) => zelleZeichnen(s.titel, i, this.y, this.f.fett, this.c.weiss, null));
      if (cfg.gitter) for (const x of xPos) this.seite.drawLine({ start: { x, y: this.y }, end: { x, y: this.y - h }, thickness: 0.5, color: this.c.linieHell });
      this.seite.drawLine({ start: { x: this.xL, y: this.y }, end: { x: this.xR, y: this.y }, thickness: 0.7, color: this.c.linie });
      this.y -= h;
      this.seite.drawLine({ start: { x: this.xL, y: this.y }, end: { x: this.xR, y: this.y }, thickness: 0.7, color: this.c.linie });
    };

    kopfZeichnen();
    for (const zeile of cfg.zeilen) {
      const zellZeilen = zeile.map((z, i) => this.zellenUmbruch(z, (cfg.spalten[i].fett ? this.f.fett : this.f.reg), size, breiten[i] - 2 * pad, cfg.spalten[i]));
      const h = Math.max(cfg.minZeilenHoehe || 0, Math.max(1, ...zellZeilen.map(l => l.length)) * lh + 2 * pad);
      if (this.y - h < this.rand.u) { this.neueSeite(); kopfZeichnen(); }
      const yTop = this.y;
      zeile.forEach((z, i) => zelleZeichnen(z, i, yTop, (cfg.spalten[i].fett ? this.f.fett : this.f.reg), this.c.ink, cfg.spalten[i]));
      if (cfg.gitter) for (const x of xPos) this.seite.drawLine({ start: { x, y: yTop }, end: { x, y: yTop - h }, thickness: 0.5, color: this.c.linie });
      this.y -= h;
      this.seite.drawLine({ start: { x: this.xL, y: this.y }, end: { x: this.xR, y: this.y }, thickness: 0.5, color: cfg.gitter ? this.c.linie : this.c.linieHell });
    }
    this.abstand(10);
  }

  beschlussKasten(k) {
    const size = 10.5, lh = size * 1.42, pad = 11;
    const maxW = this.breite - 2 * pad - 4;
    const titelZ = this.umbrechen(k.titel, this.f.fett, size, maxW);
    const wortZ = this.umbrechen(k.wortlaut || '(kein Wortlaut erfasst)', this.f.reg, size, maxW);
    const stimmZ = this.umbrechen(k.abstimmung, this.f.reg, 9.5, maxW);
    const ergZ = this.umbrechen(k.ergebnisText, this.f.fett, 10, maxW);
    const ergSchildH = 24;
    const inhaltH = titelZ.length * lh + 5 + wortZ.length * lh + 7 + stimmZ.length * 9.5 * 1.4 + 5 + ergSchildH;
    const h = inhaltH + 2 * pad;
    const maxSeitenH = PDF_A4.h - this.rand.o - this.rand.u - 40;

    if (h <= maxSeitenH) {
      this.platz(h + 4);
      const yTop = this.y;
      this.seite.drawRectangle({ x: this.xL, y: yTop - h, width: this.breite, height: h, color: this.c.fuellung, borderColor: this.c.linie, borderWidth: 0.7 });
      this.seite.drawRectangle({ x: this.xL, y: yTop - 2, width: this.breite, height: 2, color: this.c.akzent });
      let ty = yTop - pad - size;
      const schreib = (zeilen, font, sz, farbe, zf) => {
        for (const z of zeilen) {
          if (z) this.seite.drawText(z, { x: this.xL + pad + 4, y: ty, size: sz, font, color: farbe });
          ty -= sz * zf;
        }
      };
      schreib(titelZ, this.f.fett, size, this.c.ink, 1.42); ty -= 5;
      schreib(wortZ, this.f.reg, size, this.c.ink, 1.42); ty -= 7;
      schreib(stimmZ, this.f.reg, 9.5, this.c.grau, 1.4); ty -= 5;
      this.schild(String(k.ergebnisText || '').toUpperCase(), k.angenommen ? 'frei' : 'warn',
        { size: 9.5, x: this.xL + pad + 4, y: ty + 9.5, hoehe: ergSchildH - 4 });
      this.y = yTop - h;
      this.abstand(10);
    } else {
      this.absatz(k.titel, { font: this.f.fett, abstandDanach: 3 });
      this.absatz(k.wortlaut || '(kein Wortlaut erfasst)', { abstandDanach: 5 });
      this.absatz(k.abstimmung, { size: 9.5, farbe: this.c.grau, abstandDanach: 4 });
      this.schild(String(k.ergebnisText || '').toUpperCase(), k.angenommen ? 'frei' : 'warn',
        { size: 9.5, abstandDanach: 10 });
    }
  }

  unterschriften(bloecke) {
    const h = 70;
    this.platz(h + 26);
    this.abstand(24);
    const spaltW = (this.breite - 30) / 2;
    bloecke.forEach((bl, i) => {
      const x = this.xL + (i % 2) * (spaltW + 30);
      if (i > 0 && i % 2 === 0) this.abstand(h + 16);
      const yLinie = this.y - 26;
      this.seite.drawLine({ start: { x, y: yLinie }, end: { x: x + spaltW, y: yLinie }, thickness: 0.7, color: this.c.ink });
      this.seite.drawText(pdfText(bl.name || ''), { x, y: yLinie - 12, size: 10, font: this.f.reg, color: this.c.ink });
      const unterZ = this.umbrechen(bl.rolle || '', this.f.reg, 8.5, spaltW);
      let ty = yLinie - 24;
      for (const z of unterZ) { if (z) this.seite.drawText(z, { x, y: ty, size: 8.5, font: this.f.reg, color: this.c.grau }); ty -= 11; }
    });
    this.y -= h;
  }

  abschliessen() {
    const n = this.alleSeiten.length;
    this.alleSeiten.forEach((e, i) => {
      const { width, height } = e.page.getSize();
      const nrTxt = 'Seite ' + (i + 1) + ' von ' + n;
      const w = this.breiteVon(nrTxt, this.f.reg, 8);
      if (e.eigen) {
        e.page.drawLine({ start: { x: this.rand.l, y: this.rand.u - 22 }, end: { x: width - this.rand.r, y: this.rand.u - 22 }, thickness: 0.5, color: this.c.linie });
        const l = pdfText(this.fuss.links || '');
        if (l) e.page.drawText(l, { x: this.rand.l, y: this.rand.u - 34, size: 8, font: this.f.reg, color: this.c.grau });
        if (this.fuss.vertraulich) {
          const vt = 'Vertraulich - nur für den internen Gebrauch des Gremiums';
          const vw = this.breiteVon(vt, this.f.kursiv, 7.5);
          e.page.drawText(vt, { x: (width - vw) / 2, y: this.rand.u - 45, size: 7.5, font: this.f.kursiv, color: this.c.hell });
        }
        e.page.drawText(nrTxt, { x: width - this.rand.r - w, y: this.rand.u - 34, size: 8, font: this.f.reg, color: this.c.grau });
      } else {
        e.page.drawText(nrTxt, { x: width - 46 - w, y: 16, size: 8, font: this.f.reg, color: this.c.grau });
      }
    });
  }
}
/* Kernmodul 3: Dokumentgeneratoren */

async function pdfGrundlagen(daten) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    fett: await doc.embedFont(StandardFonts.HelveticaBold),
    kursiv: await doc.embedFont(StandardFonts.HelveticaOblique),
    fettKursiv: await doc.embedFont(StandardFonts.HelveticaBoldOblique)
  };
  return { doc, fonts, farben: pdfFarben(rgb, akzentPalette(erscheinung(daten && daten.stammdaten).akzent)) };
}

async function ladeLogo(doc, stamm) {
  if (!stamm.logo || !stamm.logo.dataUrl) return null;
  try {
    const bytes = dataUrlZuBytes(stamm.logo.dataUrl);
    const istPng = /png/i.test(stamm.logo.mime || '') || /\.png$/i.test(stamm.logo.name || '');
    return istPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (e) { return null; }
}

function briefkopf(b, daten, logoImg, klein) {
  const st = daten.stammdaten;
  const nameS = klein ? 12 : 14;
  const name = pdfText((st.gremium || 'Betriebsrat').toUpperCase());
  b.seite.drawText(name, { x: b.xL, y: b.y - nameS, size: nameS, font: b.f.fett, color: b.c.ink, characterSpacing: nameS * 0.06 });
  const unter = [st.firma, st.ort].filter(Boolean).join('  ·  ');
  let yUnter = b.y - nameS - 13;
  if (unter) b.seite.drawText(pdfText(unter), { x: b.xL, y: yUnter, size: 9.5, font: b.f.reg, color: b.c.grau });
  if (logoImg) {
    const zielH = klein ? 26 : 34;
    const sk = zielH / logoImg.height;
    const w = logoImg.width * sk;
    b.seite.drawImage(logoImg, { x: b.xR - w, y: b.y - zielH, width: w, height: zielH });
  }
  const yl = (unter ? yUnter : b.y - nameS) - 12;
  b.seite.drawRectangle({ x: b.xL, y: yl, width: b.breite, height: 2, color: b.c.ink });
  for (let x = b.xL; x < b.xR; x += 19) {
    b.seite.drawRectangle({ x, y: yl - 5, width: Math.min(13, b.xR - x), height: 2.2, color: b.c.akzent });
  }
  b.y = yl - 22;
}

function rechtsText(b, text, size, farbe, font) {
  const f = font || b.f.reg;
  const t = pdfText(text);
  const w = b.breiteVon(t, f, size);
  b.platz(size * 1.5);
  b.seite.drawText(t, { x: b.xR - w, y: b.y - size, size, font: f, color: farbe || b.c.ink });
  b.y -= size * 1.5;
}

/* Anlagen werden ausschließlich benannt, nie in das PDF eingebettet. */
function anlagenVerzeichnis(b, eintraege, vorspann) {
  if ((!eintraege || !eintraege.length) && (!vorspann || !vorspann.length)) return 0;
  b.ueberschrift('Anlagen', 2);
  let nr = 1;
  for (const v of (vorspann || [])) {
    b.absatz('Anlage ' + nr + ':  ' + v, { size: 10, abstandDanach: 3 });
    nr++;
  }
  for (const e of eintraege) {
    b.absatz('Anlage ' + nr + ':  ' + (e.a.name || 'Anlage') + (e.quelle ? ' (' + e.quelle + ')' : ''), { size: 10, abstandDanach: 3 });
    nr++;
  }
  if (eintraege && eintraege.length) {
    b.absatz('Die aufgeführten Anlagen sind über den BR-Sitzungsmanager einsehbar.', { size: 9, farbe: b.c.grau, abstandDanach: 3 });
  }
  return nr - 1;
}

async function erzeugeEinladungPdf(daten, s, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Einladung · Sitzung Nr. ' + s.nr },
    { links: 'Einladung zur Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' am ' + fmtDatum(s.datum) : ''), vertraulich: !!opt.vertraulich });
  b.neueSeite();
  briefkopf(b, daten, logo, false);

  rechtsText(b, (st.ort ? st.ort + ', den ' : '') + fmtDatum(s.einladungDatum || heuteIso()), 10, b.c.ink);
  b.abstand(8);
  b.absatz('An die Mitglieder des Betriebsrats', { size: 10.5, abstandDanach: 1 });
  if (st.nachrichtlich) b.absatz('nachrichtlich: ' + st.nachrichtlich + ' (§ 29 Abs. 2 Satz 4 BetrVG)', { size: 9, farbe: b.c.grau, abstandDanach: 4 });

  b.ueberschrift('Einladung zur ' + (SITZUNGSART_GENITIV[s.art] || 'ordentlichen') + ' Betriebsratssitzung Nr. ' + s.nr, 1);

  b.metaZeile('Termin:', fmtDatum(s.datum, true) || 'noch offen', { wertFont: b.f.fett });
  b.metaZeile('Beginn:', fmtZeit(s.beginn) || '–');
  if (s.endeGeplant) b.metaZeile('Voraussichtl. Ende:', fmtZeit(s.endeGeplant));
  b.metaZeile('Ort / Raum:', s.ort || '–');
  if (s.videokonferenz) b.metaZeile('Video/Telefon:', 'Teilnahme per Video-/Telefonkonferenz möglich. ' + (s.videoHinweis || ''));
  b.abstand(8);

  b.absatz('Liebe Kolleginnen und Kollegen,', { abstandDanach: 4 });
  b.absatz('hiermit lade ich euch unter Mitteilung der nachfolgenden Tagesordnung zur oben genannten Sitzung des Betriebsrats ein.', { abstandDanach: 4 });

  b.ueberschrift('Tagesordnung', 2);
  const anlTO = anlagenTagesordnung(s);
  const anlNrVon = a => anlTO.findIndex(e => e.a.id === a.id) + 1;

  if (!s.tops || !s.tops.length) {
    b.absatz('(Es wurden noch keine Tagesordnungspunkte erfasst.)', { farbe: b.c.grau });
  }
  (s.tops || []).forEach((top, i) => {
    const labelW = 52, size = 11, lh = size * 1.42;
    const titelZ = b.umbrechen(top.titel || '(ohne Titel)', b.f.fett, size, b.breite - labelW);
    b.platz(lh * titelZ.length + 4);
    b.seite.drawText('TOP ' + (i + 1), { x: b.xL, y: b.y - size, size, font: b.f.fett, color: b.c.akzent });
    titelZ.forEach((z, k) => {
      if (k > 0) b.platz(lh);
      if (z) b.seite.drawText(z, { x: b.xL + labelW, y: b.y - size, size, font: b.f.fett, color: b.c.ink });
      b.y -= lh;
    });
    const teile = [];
    if (top.kategorie) teile.push(KATEGORIEN[top.kategorie] || top.kategorie);
    if (top.referent) teile.push('Referent/in: ' + top.referent);
    if (top.dauer) teile.push('ca. ' + top.dauer + ' Min.');
    const nrn = (top.anlagen || []).map(a => anlNrVon(a)).filter(n => n > 0);
    if (nrn.length) teile.push((nrn.length > 1 ? 'Anlagen ' : 'Anlage ') + nrn.join(', '));
    if (teile.length) b.absatz(teile.join('   ·   '), { size: 8.5, farbe: b.c.grau, einzug: labelW, abstandDanach: 2 });
    if (top.beschreibung) b.absatz(top.beschreibung, { size: 10, einzug: labelW, abstandDanach: 3 });
    (top.unterpunkte || []).forEach((u, j) => {
      b.absatz((i + 1) + '.' + (j + 1) + '  ' + (u.titel || '(ohne Titel)'), { size: 10, einzug: labelW, abstandDanach: u.beschreibung || u.kategorie ? 1 : 2 });
      if (kategorieText(u)) b.absatz(kategorieText(u), { size: 8.5, farbe: b.c.grau, einzug: labelW + 12, abstandDanach: u.beschreibung ? 1 : 2 });
      if (u.beschreibung) b.absatz(u.beschreibung, { size: 9.5, farbe: b.c.grau, einzug: labelW + 12, abstandDanach: 2 });
      const uNrn = (u.anlagen || []).map(a => anlNrVon(a)).filter(n => n > 0);
      if (uNrn.length) b.absatz((uNrn.length > 1 ? 'Anlagen ' : 'Anlage ') + uNrn.join(', '), { size: 8.5, farbe: b.c.grau, einzug: labelW + 12, abstandDanach: 2 });
    });
    b.abstand(7);
  });

  b.abstand(4);
  b.ueberschrift('Hinweise', 3);
  b.absatz('Verhinderte Mitglieder werden gebeten, dies unverzüglich der/dem Vorsitzenden mitzuteilen, damit das jeweilige Ersatzmitglied geladen werden kann.', { size: 9.5, farbe: b.c.grau, abstandDanach: 4 });
  if (s.einladungHinweis) b.absatz(s.einladungHinweis, { size: 9.5, farbe: b.c.grau, abstandDanach: 4 });

  b.abstand(6);
  b.platz(80);
  b.absatz('Mit freundlichen Grüßen', { abstandDanach: 16 });
  const grussName = s.sitzungsleitung || vorsitzName(daten) || '';
  if (grussName) b.absatz(grussName, { size: 10.5, abstandDanach: 0 });
  b.absatz(sitzungsleitungRolle(daten, s), { size: 9, farbe: b.c.grau, abstandDanach: 4 });

  anlagenVerzeichnis(b, anlTO, []);
  b.abschliessen();
  return doc.save();
}

function zeichneAnwesenheitsliste(b, daten, s, opts) {
  opts = opts || {};
  b.neueSeite();
  briefkopf(b, daten, opts.logo || null, true);
  if (opts.alsAnlage) rechtsText(b, 'Anlage ' + opts.anlageNr + ' zur Niederschrift Nr. ' + s.nr, 9.5, b.c.akzent, b.f.fett);
  b.ueberschrift('Anwesenheitsliste', 1);
  b.absatz('zur ' + (SITZUNGSART_GENITIV[s.art] || 'ordentlichen') + ' Sitzung des Betriebsrats Nr. ' + s.nr +
    (s.datum ? ' am ' + fmtDatum(s.datum, true) : '') + (s.ort ? ', ' + s.ort : ''), { size: 11, abstandDanach: 3 });
  b.absatz('Jede Teilnehmerin und jeder Teilnehmer der Sitzung haben sich eigenhändig in diese Liste einzutragen.', { size: 9.5, farbe: b.c.grau, abstandDanach: 10 });

  const d = anwesenheitsDaten(daten, s);

  /* Spalte „Abw. Anwesenheit" steht immer, auch leer: die Liste wird vor der Sitzung gedruckt und von Hand ausgefüllt. */
  const leerzeilen = (daten.exportOptionen || {}).anwesenheitsLeerzeilen ? 2 : 0;
  const leere = n => Array.from({ length: leerzeilen }, () => new Array(n).fill(''));

  b.ueberschrift('Betriebsratsmitglieder', 2);
  let nr = 1;
  b.tabelle({
    spalten: [
      { titel: 'Nr.', anteil: 0.06 },
      { titel: 'Name', anteil: 0.42 },
      { titel: 'Abw. Anwesenheit', anteil: 0.22 },
      { titel: 'Unterschrift', anteil: 0.30 }
    ],
    zeilen: d.mitglieder.map(m => [nr++, m.name, m.abw, '']).concat(leere(4)),
    gitter: true, minZeilenHoehe: 30, size: 9.5
  });

  if (d.gaeste.length || leerzeilen) {
    b.ueberschrift('Gäste (Arbeitgeber, Gewerkschaft, SBV, JAV, Sachverständige)', 2);
    let gnr = 1;
    b.tabelle({
      spalten: [
        { titel: 'Nr.', anteil: 0.06 },
        { titel: 'Name', anteil: 0.30 },
        { titel: 'Funktion/Organisation', anteil: 0.26 },
        { titel: 'Abw. Anwesenheit', anteil: 0.14 },
        { titel: 'Unterschrift', anteil: 0.24 }
      ],
      zeilen: d.gaeste.map(g => [gnr++, g.name, g.funktion, g.abw, '']).concat(leere(5)),
      gitter: true, minZeilenHoehe: 30, size: 9.5
    });
  }

  const video = d.mitglieder.some(m => m.abw);
  if (video || s.videokonferenz) {
    b.absatz('Bei Teilnahme per Video- oder Telefonkonferenz: Das Betriebsratsmitglied bestätigt seine Teilnahme gegenüber der/dem Vorsitzenden in Textform; die Bestätigung ist der Niederschrift beizufügen.', { size: 9, farbe: b.c.grau });
  }
}

async function erzeugeAnwesenheitslistePdf(daten, s, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Anwesenheitsliste · Sitzung Nr. ' + s.nr },
    { links: 'Anwesenheitsliste zur Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' am ' + fmtDatum(s.datum) : ''), vertraulich: !!opt.vertraulich });
  zeichneAnwesenheitsliste(b, daten, s, { logo });
  b.abschliessen();
  return doc.save();
}

/* Protokoll */

function pdfPunktInhalt(b, daten, s, punkt) {
  if (punkt.verlauf) b.verlaufBloeckeZeichnen(verlaufZuBloecken(sanitizeVerlaufHtml(punkt.verlauf)), { abstandDanach: 6 });
  for (const be of (punkt.beschluesse || [])) {
    const basis = abstimmungsBasis(daten, s, be, punkt);
    const aus = beschlussAuswertung(be, basis.teilnehmend);
    let stimmen = 'Abstimmungsergebnis: ' + aus.ja + ' Ja-Stimme(n), ' + aus.nein + ' Nein-Stimme(n), ' + aus.enth + ' Enthaltung(en)';
    if (basis.teilnehmend > 0) stimmen += ' bei ' + basis.teilnehmend + ' an der Beschlussfassung teilnehmenden Mitgliedern.';
    else stimmen += '.';
    if (basis.ausgenommen.length) stimmen += ' An der Abstimmung nicht beteiligt: ' + nichtBeteiligtText(basis) + '.';
    if (aus.warnung) stimmen += '  Achtung: ' + aus.warnung;
    if (basis.reduziert && basis.erfasst && !basis.beschlussfaehig) {
      stimmen += '  Achtung: Für diese Abstimmung war der Betriebsrat nicht beschlussfähig (erforderlich: ' + basis.erforderlich + ').';
    }
    b.beschlussKasten({
      titel: 'Beschluss Nr. ' + beschlussNrText(be) + '  (' + (BESCHLUSS_STATUS[be.status] || BESCHLUSS_STATUS.in_arbeit) + ')',
      wortlaut: '"' + (be.antrag || '') + '"',
      abstimmung: stimmen,
      ergebnisText: aus.text,
      angenommen: aus.angenommen
    });
  }
  const auf = (punkt.aufgaben || []).filter(a => (a.was || '').trim());
  if (auf.length) {
    b.absatz('Aufgaben:', { size: 9, font: b.f.fett, farbe: b.c.grau, abstandDanach: 3 });
    b.tabelle({
      spalten: [
        { titel: 'Aufgabe', anteil: 0.56 },
        { titel: 'Zuständig', anteil: 0.24 },
        { titel: 'Bis wann', anteil: 0.20 }
      ],
      zeilen: auf.map(a => [a.was, a.wer || '–', a.bis ? fmtDatum(a.bis) : '–']),
      size: 9
    });
  }
}

async function erzeugeProtokollPdf(daten, s, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Niederschrift · Sitzung Nr. ' + s.nr },
    { links: 'Niederschrift der Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' vom ' + fmtDatum(s.datum) : ''), vertraulich: !!opt.vertraulich });
  b.neueSeite();
  briefkopf(b, daten, logo, false);

  b.ueberschrift('Niederschrift der Betriebsratssitzung Nr. ' + s.nr, 1);
  b.absatz('Sitzungsniederschrift gemäß § 34 Abs. 1 BetrVG über die ' + (SITZUNGSART_AKK[s.art] || 'ordentliche') + ' Sitzung des Betriebsrats', { size: 9.5, farbe: b.c.grau, abstandDanach: 10 });

  const q = quorumInfo(daten, s);
  b.metaZeile('Datum:', fmtDatum(s.datum, true) || '–', { wertFont: b.f.fett });
  b.metaZeile('Beginn / Ende:', (fmtZeit(s.beginnTatsaechlich || s.beginn) || '–') + '  bis  ' + (fmtZeit(s.endeTatsaechlich || s.endeGeplant) || '–'));
  b.metaZeile('Ort:', s.ort || '–');
  b.metaZeile('Sitzungsleitung:', s.sitzungsleitung || vorsitzName(daten) || '–');
  b.metaZeile('Protokollführung:', s.protokollfuehrung || schriftfuehrerName(daten) || '–');
  if (s.einladungDatum) b.metaZeile('Geladen am:', fmtDatum(s.einladungDatum) + ' unter Mitteilung der Tagesordnung');
  b.abstand(6);

  b.ueberschrift('Teilnahme', 2);
  const g = teilnehmerGruppen(daten, s);
  const nameMitFunktion = e => e.m.name + (e.m.funktion && e.m.funktion !== 'Mitglied' ? ' (' + e.m.funktion + ')' : '') + (e.t.status === 'video' ? ' [per Video/Telefon]' : '') + (nurEinzelneTops(e.t) ? ' [' + teilweiseText(s, e.t) + ']' : '');
  b.metaZeile('Anwesend (' + g.teilnehmend.length + '):', g.teilnehmend.length ? g.teilnehmend.map(nameMitFunktion).join(', ') : '–');
  if (g.entschuldigt.length) b.metaZeile('Entschuldigt:', g.entschuldigt.map(e => e.m.name + (e.t.vertretenDurch ? ' (vertreten wegen ' + e.t.vertretenDurch + ')' : '')).join(', '));
  if (g.fehlt.length) b.metaZeile('Unentschuldigt:', g.fehlt.map(e => e.m.name).join(', '));
  if ((s.gaeste || []).length) b.metaZeile('Gäste:', s.gaeste.map(x => x.name + ' (' + (x.funktion || GAST_TYPEN[x.typ] || 'Gast') + ')').join(', '));
  b.abstand(4);

  if (q.groesse > 0) {
    b.schild(q.beschlussfaehig
      ? 'BESCHLUSSFÄHIG · ' + q.teilnehmend + ' VON ' + q.groesse
      : 'NICHT BESCHLUSSFÄHIG · ' + q.teilnehmend + ' VON ' + q.groesse,
      q.beschlussfaehig ? 'frei' : 'warn', { size: 10.5, abstandDanach: 7 });
    b.absatz('An der Sitzung nehmen ' + q.teilnehmend + ' von ' + q.groesse + ' Mitgliedern des Betriebsrats teil (erforderlich: mindestens ' + q.erforderlich + ').' +
      (q.beschlussfaehig ? ' Der Betriebsrat ist beschlussfähig.' : ' Der Betriebsrat ist damit nicht beschlussfähig.'),
      { size: 10, farbe: q.beschlussfaehig ? b.c.ink : b.c.rot, abstandDanach: 4 });
  }
  b.absatz('Die Anwesenheit ist in der Anwesenheitsliste dokumentiert (Anlage 1).', { size: 9.5, farbe: b.c.grau, abstandDanach: 2 });
  const videoTeilnahme = g.teilnehmend.some(e => e.t.status === 'video');
  if (videoTeilnahme) {
    b.absatz('Die per Video-/Telefonkonferenz teilnehmenden Mitglieder haben ihre Teilnahme gegenüber der Sitzungsleitung in Textform bestätigt; die Bestätigungen sind dieser Niederschrift beigefügt.', { size: 9.5, farbe: b.c.grau, abstandDanach: 2 });
  }

  if (s.beginnTatsaechlich) {
    b.abstand(4);
    b.absatz('Die Sitzungsleitung eröffnet die Sitzung um ' + fmtZeit(s.beginnTatsaechlich) + '.', { abstandDanach: 2 });
  }

  /* Alle Anlagen der Sitzung werden im Protokoll benannt – die zum Protokoll wie die zur Tagesordnung. */
  const anlProt = anlagenProtokoll(s).concat(anlagenTagesordnung(s));
  (s.tops || []).forEach((top, i) => {
    b.ueberschrift('TOP ' + (i + 1) + ':  ' + (top.titel || '(ohne Titel)'), 2);
    const teile = [];
    if (top.kategorie) teile.push(KATEGORIEN[top.kategorie] || top.kategorie);
    if (top.referent) teile.push('Referent/in: ' + top.referent);
    if (teile.length) b.absatz(teile.join('   ·   '), { size: 8.5, farbe: b.c.grau, abstandDanach: 4 });
    pdfPunktInhalt(b, daten, s, top);
    (top.unterpunkte || []).forEach((u, j) => {
      b.ueberschrift((i + 1) + '.' + (j + 1) + '  ' + (u.titel || '(ohne Titel)'), 3);
      if (kategorieText(u)) b.absatz(kategorieText(u), { size: 8.5, farbe: b.c.grau, abstandDanach: 4 });
      pdfPunktInhalt(b, daten, s, u);
    });
  });

  if (s.endeTatsaechlich) {
    b.abstand(4);
    b.absatz('Die Sitzungsleitung schließt die Sitzung um ' + fmtZeit(s.endeTatsaechlich) + '.', { abstandDanach: 6 });
  }

  const aufgaben = alleAufgaben(s);
  if (aufgaben.length) {
    b.ueberschrift('Aufgabenübersicht', 2);
    b.tabelle({
      spalten: [
        { titel: 'TOP', anteil: 0.09 },
        { titel: 'Aufgabe', anteil: 0.49 },
        { titel: 'Zuständig', anteil: 0.23 },
        { titel: 'Bis wann', anteil: 0.19 }
      ],
      zeilen: aufgaben.map(e => [String(e.topNr), e.auf.was, e.auf.wer || '–', e.auf.bis ? fmtDatum(e.auf.bis) : '–']),
      size: 9
    });
  }

  const agOderGewerkschaft = (s.gaeste || []).some(x => x.typ === 'arbeitgeber' || x.typ === 'gewerkschaft');
  if (agOderGewerkschaft) {
    b.absatz('Hinweis: Da der Arbeitgeber bzw. eine/ein Gewerkschaftsbeauftragte/r an der Sitzung teilgenommen hat, ist ihr/ihm der entsprechende Teil dieser Niederschrift abschriftlich auszuhändigen; Einwendungen gegen die Niederschrift sind unverzüglich schriftlich zu erheben und der Niederschrift beizufügen.', { size: 9, farbe: b.c.grau, abstandDanach: 6 });
  }

  b.abstand(8);
  b.platz(150);
  b.absatz((st.ort ? st.ort + ', den ' : 'Ort, Datum: ') + '________________', { size: 10, abstandDanach: 0 });
  b.unterschriften([
    { name: s.sitzungsleitung || vorsitzName(daten) || '', rolle: sitzungsleitungRolle(daten, s) },
    { name: s.protokollfuehrung || schriftfuehrerName(daten) || '', rolle: 'Weiteres Betriebsratsmitglied / Protokollführung' }
  ]);

  /* Die Anwesenheitsliste ist immer Anlage 1 – benannt, aber wie jede Anlage nicht eingebettet. */
  anlagenVerzeichnis(b, anlProt, ['Anwesenheitsliste zur Sitzung']);
  if (videoTeilnahme) {
    b.absatz('Ferner beizufügen: Textform-Bestätigungen der per Video-/Telefonkonferenz teilnehmenden Mitglieder.', { size: 9, farbe: b.c.grau, abstandDanach: 4 });
  }
  b.abschliessen();
  return doc.save();
}

/* Gekürztes Protokoll für einen Gast: nur die zugewiesenen TOPs, ohne Teilnahme-Abschnitt, Aufgabenübersicht und Unterschriften. */
async function erzeugeGekuerztesProtokollPdf(daten, s, gast, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Protokollauszug · Sitzung Nr. ' + s.nr },
    { links: 'Protokollauszug der Betriebsratssitzung Nr. ' + s.nr + (s.datum ? ' vom ' + fmtDatum(s.datum) : ''), vertraulich: !!opt.vertraulich });
  b.neueSeite();
  briefkopf(b, daten, logo, false);

  b.ueberschrift('Protokollauszug – Betriebsratssitzung Nr. ' + s.nr, 1);
  b.metaZeile('Datum:', fmtDatum(s.datum, true) || '–', { wertFont: b.f.fett });
  b.metaZeile('Ort:', s.ort || '–');
  b.abstand(4);

  const auswahl = gastTops(s, gast);
  const gastFunktion = gast.funktion || GAST_TYPEN[gast.typ] || 'Gast';
  const bezeichnung = gastPunkteBezeichnung(s, gast);
  b.absatz('Auszug für Gast: ' + (gast.name || '–') + ' (' + gastFunktion + ').', { size: 10, font: b.f.fett, abstandDanach: 2 });
  b.absatz('Dieser Auszug enthält ausschließlich die Punkte, an denen der Gast teilgenommen hat: ' +
    (bezeichnung || '–') + '.', { size: 9.5, farbe: b.c.grau, abstandDanach: 8 });

  auswahl.forEach(({ top, nr, voll, unterpunkte }) => {
    b.ueberschrift('TOP ' + nr + ':  ' + (top.titel || '(ohne Titel)'), 2);
    const teile = [];
    if (top.kategorie) teile.push(KATEGORIEN[top.kategorie] || top.kategorie);
    if (top.referent) teile.push('Referent/in: ' + top.referent);
    if (teile.length) b.absatz(teile.join('   ·   '), { size: 8.5, farbe: b.c.grau, abstandDanach: 4 });
    if (voll) {
      pdfPunktInhalt(b, daten, s, top);
      (top.unterpunkte || []).forEach((u, j) => {
        b.ueberschrift(nr + '.' + (j + 1) + '  ' + (u.titel || '(ohne Titel)'), 3);
        if (kategorieText(u)) b.absatz(kategorieText(u), { size: 8.5, farbe: b.c.grau, abstandDanach: 4 });
        pdfPunktInhalt(b, daten, s, u);
      });
    } else {
      unterpunkte.forEach(({ u, unr }) => {
        b.ueberschrift(unr + '  ' + (u.titel || '(ohne Titel)'), 3);
        if (kategorieText(u)) b.absatz(kategorieText(u), { size: 8.5, farbe: b.c.grau, abstandDanach: 4 });
        pdfPunktInhalt(b, daten, s, u);
      });
    }
  });

  b.abschliessen();
  return doc.save();
}
