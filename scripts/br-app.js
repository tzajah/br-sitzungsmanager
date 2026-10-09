'use strict';
/* BR-Sitzungsmanager/-Protokoll – Zustand, Verschlüsselung/Persistenz, Seitenleiste, Reiter „Sitzung". */

const SPEICHER_SCHLUESSEL = 'br-sitzungsmanager.v1';   /* Alt-Zwischenspeicher – nur für die einmalige Migration */
/* Eigener Speicherstand je Betriebsart: unter file:// teilen sich alle Dateien einen Ursprung, daher Trennung über den Datenbanknamen statt über die HTML-Herkunft. */
const DB_NAME = 'br-sitzungsmanager' + (APP_MODUS === 'protokoll' ? '-protokoll' : '');
const DB_VERSION = 1;
const PBKDF2_ITER = 600000;   /* OWASP-Empfehlung für PBKDF2-HMAC-SHA256 */
const VERIFIER_KLARTEXT = 'br-sitzungsmanager/verifizierer';

let daten = null;
let ui = { sitzungId: null, tab: modusStartReiter(), ansicht: 'sitzung', beschlussFilter: { jahr: '', ergebnis: '', suche: '', tag: '', status: '', vonDatum: '', bisDatum: '' }, aufgabenFilter: { jahr: '', wer: '', suche: '', vonDatum: '', bisDatum: '' }, dokumentFilter: { kategorie: '', sitzungId: '', suche: '' }, dokumentOrdner: null, urlaubMonat: '', sitzungSuche: '', archivAnzeigen: false, speicherFehler: false, zugeklappt: new Set() };
let speicherTimer = null;
let anlagenZielCallback = null;

/* Laufzeit-Sicherheitszustand – wird NIE persistiert. */
let sitzungsSchluessel = null;   /* Hauptschlüssel MK (AES-GCM CryptoKey), nur im Arbeitsspeicher */
let sitzungsMkBytes = null;      /* Rohbytes des MK – nur im RAM, für erneutes Verpacken bei Passwortwechsel */
let sitzungsRolle = null;        /* 'viewer' | 'arbeit' | 'admin' – aus dem verwendeten Passwort abgeleitet */
let aktuellesZugang = null;      /* Zugangsblock (Salts + je Rolle verpackter MK) – reist mit den Daten */

/* Zugang kommt aus der externen Datei br-zugang.js (window.BR_ZUGANG) und ist maßgeblich, siehe externerZugang(). */

/* Änderungsverfolgung für gezieltes, sparsames Schreiben */
let dirtyMeta = false;
const dirtySitzungen = new Set();

/* Persistenz: WebCrypto (PBKDF2 → AES-GCM 256, § 79 BetrVG), IndexedDB hinter einem austauschbaren Adapter für einen späteren Server-/SQLite-Adapter. */

function bytesZuBase64(bytes) {
  let s = ''; const teil = 0x8000;
  for (let i = 0; i < bytes.length; i += teil) s += String.fromCharCode.apply(null, bytes.subarray(i, i + teil));
  return btoa(s);
}
function base64ZuBytes(b64) {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/* Krypto */
const Krypto = {
  async schluessel(passwort, salt, iter) {
    const basis = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passwort), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' },
      basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async chiffriere(schluessel, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const klar = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, schluessel, klar);
    return { iv: iv, ct: ct };
  },
  async dechiffriere(schluessel, iv, ct) {
    const ivv = iv instanceof Uint8Array ? iv : new Uint8Array(iv);
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivv }, schluessel, ct);
    return JSON.parse(new TextDecoder().decode(buf));
  },
  /* Hauptschlüssel MK: zufällig erzeugt, verschlüsselt die eigentlichen Daten. */
  async zufallsMk() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', true, ['encrypt', 'decrypt']);
    return { key: key, bytes: bytes };
  },
  async mkAusBytes(bytes) {
    return crypto.subtle.importKey('raw', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), 'AES-GCM', true, ['encrypt', 'decrypt']);
  },
  /* MK unter einem aus dem Passwort abgeleiteten Schlüssel „verpacken"/„entpacken". */
  async verpacke(passwortSchluessel, mkBytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, passwortSchluessel, mkBytes);
    return { iv: iv, ct: ct };
  },
  async entpacke(passwortSchluessel, iv, ct) {
    const ivv = iv instanceof Uint8Array ? iv : new Uint8Array(iv);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivv }, passwortSchluessel, ct);
  }
};

/* Zugang (drei Rollen): MK wird mit Viewer-, Arbeits- und Admin-Passwort je einmal verpackt; der Zugangsblock enthält nur Salts + verpackten MK und reist mit den Daten, dadurch gelten die Passwörter geräteübergreifend. */
async function zugangErzeugen(mkBytes, pws) {
  const iter = PBKDF2_ITER;
  const bau = async pw => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await Krypto.schluessel(pw, salt, iter);
    const { iv, ct } = await Krypto.verpacke(k, mkBytes);
    return { salt: Array.from(salt), iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
  };
  const z = { v: 2, iter: iter, admin: await bau(pws.admin), arbeit: await bau(pws.arbeit) };
  if (pws.viewer != null) z.viewer = await bau(pws.viewer);
  return z;
}

async function zugangEntsperren(zugang, passwort) {
  for (const [feld, rolle] of [['admin', 'admin'], ['arbeit', 'arbeit'], ['viewer', 'viewer']]) {
    const e = zugang && zugang[feld];
    if (!e) continue;
    try {
      const k = await Krypto.schluessel(passwort, new Uint8Array(e.salt), zugang.iter || PBKDF2_ITER);
      const mkBuf = await Krypto.entpacke(k, new Uint8Array(e.iv), base64ZuBytes(e.ct).buffer);
      const mkBytes = new Uint8Array(mkBuf);
      return { mk: await Krypto.mkAusBytes(mkBytes), mkBytes: mkBytes, rolle: rolle };
    } catch (err) { }
  }
  throw new Error('Passwort passt zu keiner Rolle');
}

async function zugangPasswortSetzen(feld, neuesPw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await Krypto.schluessel(neuesPw, salt, aktuellesZugang.iter || PBKDF2_ITER);
  const { iv, ct } = await Krypto.verpacke(k, sitzungsMkBytes);
  aktuellesZugang[feld] = { salt: Array.from(salt), iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct)) };
  await Speicher.metaSetzen('zugang', aktuellesZugang);
}

/* window.BR_ZUGANG (br-zugang.js) ist maßgeblich und überschreibt veralteten lokalen Zustand. */
function gueltigerZugangsEintrag(e) {
  return !!(e && Array.isArray(e.salt) && Array.isArray(e.iv) && typeof e.ct === 'string');
}
function externerZugang() {
  const z = (typeof window !== 'undefined') ? window.BR_ZUGANG : null;
  if (!z || typeof z !== 'object') return null;
  if (!(gueltigerZugangsEintrag(z.admin) || gueltigerZugangsEintrag(z.arbeit) || gueltigerZugangsEintrag(z.viewer))) return null;
  return z;
}
/* Signatur zum Vergleich „Datei ≠ gespeichert" – die verpackten MK-Chiffrate. */
function zugangSignatur(z) {
  if (!z) return '';
  return ['viewer', 'arbeit', 'admin'].map(f => (z[f] && z[f].ct) || '').join('|');
}
function zugangsdateiHerunterladen() {
  if (!aktuellesZugang) { zeigeToast('Kein Zugang zum Herunterladen vorhanden.', 'fehler'); return; }
  const kopf =
    '/* br-zugang.js – Zugang (Passwoerter) fuer den BR-Sitzungsmanager.\n' +
    '   Enthaelt den unter den Rollen-Passwoertern (Viewer/Arbeit/Debug-Mode) VERSCHLUESSELTEN\n' +
    '   Hauptschluessel – die Passwoerter selbst stehen NICHT im Klartext hier.\n' +
    '   Diese Datei in den Unterordner "scripts" legen; sie ist massgeblich.\n' +
    '   Erzeugt am ' + new Date().toISOString() + '. */\n';
  const js = kopf + 'window.BR_ZUGANG = ' + JSON.stringify(aktuellesZugang, null, 2) + ';\n';
  dateiHerunterladen(new Blob([js], { type: 'text/javascript' }), 'br-zugang.js');
}

function istAdmin() { return sitzungsRolle === 'admin'; }
/* Admin-Menü: nur mit Debug-Mode-Passwort und nur im Sitzungsmanager. */
function adminMenueVerfuegbar() { return istAdmin() && modusHatAnsicht('stammdaten'); }
/* Viewer darf nur lesen. */
function darfBearbeiten() { return sitzungsRolle === 'arbeit' || sitzungsRolle === 'admin'; }

/* Speicher-Adapter (IndexedDB): Async-API bewusst wie ein künftiges HTTP-/SQLite-Backend geschnitten – die „Naht" für späteren Serverbetrieb. */
const Speicher = {
  db: null,
  oeffnen() {
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return rej(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('sitzungen')) db.createObjectStore('sitzungen', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('dokumente')) db.createObjectStore('dokumente', { keyPath: 'id' });
      };
      req.onsuccess = () => { this.db = req.result; res(); };
      req.onerror = () => rej(req.error);
    });
  },
  _store(name, modus) { return this.db.transaction(name, modus).objectStore(name); },
  _req(anfrage) {
    return new Promise((res, rej) => { anfrage.onsuccess = () => res(anfrage.result); anfrage.onerror = () => rej(anfrage.error); });
  },
  metaHolen(name) { return this._req(this._store('meta', 'readonly').get(name)); },
  metaSetzen(name, wert) { return this._req(this._store('meta', 'readwrite').put(wert, name)); },
  sitzungenAlle() { return this._req(this._store('sitzungen', 'readonly').getAll()); },
  sitzungSetzen(rec) { return this._req(this._store('sitzungen', 'readwrite').put(rec)); },
  sitzungLoeschen(id) { return this._req(this._store('sitzungen', 'readwrite').delete(id)); },
  dokumentHolen(id) { return this._req(this._store('dokumente', 'readonly').get(id)); },
  dokumentSetzen(rec) { return this._req(this._store('dokumente', 'readwrite').put(rec)); },
  dokumentLoeschen(id) { return this._req(this._store('dokumente', 'readwrite').delete(id)); },
  storeLeeren(name) { return this._req(this._store(name, 'readwrite').clear()); }
};

/* Verschlüsselte Meta-/Sitzungs-Datensätze */
async function metaChiffriertSetzen(name, obj) {
  const { iv, ct } = await Krypto.chiffriere(sitzungsSchluessel, obj);
  await Speicher.metaSetzen(name, { iv: iv, ct: ct });
}
async function metaChiffriertHolen(name) {
  const rec = await Speicher.metaHolen(name);
  if (!rec) return null;
  return Krypto.dechiffriere(sitzungsSchluessel, rec.iv, rec.ct);
}
async function metaAllesSchreiben() {
  await metaChiffriertSetzen('appmeta', {
    app: 'br-sitzungsmanager', version: daten.version || 1,
    revision: daten.revision || 0, zuletztGesichert: daten.zuletztGesichert || null,
    aenderungsstand: daten.aenderungsstand || 0, exportStand: daten.exportStand || 0
  });
  await metaChiffriertSetzen('stammdaten', daten.stammdaten);
  await metaChiffriertSetzen('personen', daten.personen || []);
  await metaChiffriertSetzen('dokumente', daten.dokumente || []);
  await metaChiffriertSetzen('standardTops', daten.standardTops || []);
  await metaChiffriertSetzen('kategorien', daten.kategorien || []);
  await metaChiffriertSetzen('protokollVorlagen', daten.protokollVorlagen || []);
  await metaChiffriertSetzen('beschlussVorlagen', daten.beschlussVorlagen || []);
  await metaChiffriertSetzen('urlaub', daten.urlaub || []);
  await metaChiffriertSetzen('beschlussTags', daten.beschlussTags || []);
  await metaChiffriertSetzen('exportOptionen', daten.exportOptionen);
}
async function sitzungSchreibenP(s) {
  const { iv, ct } = await Krypto.chiffriere(sitzungsSchluessel, s);
  await Speicher.sitzungSetzen({ id: s.id, iv: iv, ct: ct });
}
async function alleDatenErsetzenP() {
  await Speicher.storeLeeren('sitzungen');
  await Speicher.storeLeeren('dokumente');
  await metaAllesSchreiben();
  for (const s of daten.sitzungen) await sitzungSchreibenP(s);
}

/* Dokumente (verschlüsselte Blobs) */
async function dokumentBytesSpeichern(id, bytes) {
  const { iv, ct } = await Krypto.verpacke(sitzungsSchluessel, bytes);
  await Speicher.dokumentSetzen({ id: id, iv: iv, ct: ct });
}
async function dokumentBytesLaden(id) {
  const rec = await Speicher.dokumentHolen(id);
  if (!rec) return null;
  return new Uint8Array(await Krypto.entpacke(sitzungsSchluessel, rec.iv, rec.ct));
}
async function dokumentAnlegen(bytes, meta) {
  if (!darfBearbeiten()) return null;
  /* Dokumentenablage führt der Sitzungsmanager; ohne diesen Riegel würde das Protokollmodul weiter still archivieren – daraus wachsen die verwaisten Blobs, die br-anlagen-entfernen.html aufräumt. */
  if (!modusHatAnsicht('dokumente')) return null;
  const eintrag = Object.assign({
    id: uid(), name: 'Dokument', mime: '', groesse: bytes.byteLength || bytes.length || 0,
    kategorie: 'sonstig', sitzungId: null, topId: null, erstelltAm: new Date().toISOString(), quelle: 'upload'
  }, meta || {});
  await dokumentBytesSpeichern(eintrag.id, bytes);
  daten.dokumente.push(eintrag);
  speichern();
  return eintrag;
}
async function dokumentEntfernen(id) {
  if (!darfBearbeiten()) return;
  daten.dokumente = (daten.dokumente || []).filter(d => d.id !== id);
  try { await Speicher.dokumentLoeschen(id); } catch (e) { }
  speichern();
}
/* Im Protokollmodul bleiben Anlagen-Dateien beim Sitzungsmanager, hier steht nur der Verweis fürs Anlagenverzeichnis. */
function anlageFehltMeldung() {
  return APP_MODUS === 'protokoll'
    ? 'Diese Datei liegt im Sitzungsmanager – hier steht nur der Verweis für das Anlagenverzeichnis.'
    : 'Datei nicht gefunden.';
}

/* Bytes einer Anlage – unterstützt Alt-Format (dataUrl) und Blob-Dokumente. */
async function anlageBytes(a) {
  if (a && a.dataUrl) return dataUrlZuBytes(a.dataUrl);
  if (a && a.dokumentId) return await dokumentBytesLaden(a.dokumentId);
  return null;
}
async function dokumenteFuerBackup() {
  const inhalte = {};
  for (const d of (daten.dokumente || [])) {
    const bytes = await dokumentBytesLaden(d.id);
    if (bytes) inhalte[d.id] = bytesZuBase64(bytes);
  }
  return inhalte;
}
async function dokumenteAusBackup(inhalte) {
  await Speicher.storeLeeren('dokumente');
  if (!inhalte) return;
  for (const id of Object.keys(inhalte)) await dokumentBytesSpeichern(id, base64ZuBytes(inhalte[id]));
}

/* Laden / Einrichten / Entsperren */
async function allesLaden() {
  const appmeta = await metaChiffriertHolen('appmeta') || {};
  const stammdaten = await metaChiffriertHolen('stammdaten');
  const personen = await metaChiffriertHolen('personen');
  const mitglieder = await metaChiffriertHolen('mitglieder');   /* Alt-Datensatz für Migration */
  const dokumente = await metaChiffriertHolen('dokumente');
  const standardTops = await metaChiffriertHolen('standardTops');
  const kategorien = await metaChiffriertHolen('kategorien');
  const protokollVorlagen = await metaChiffriertHolen('protokollVorlagen');
  const beschlussVorlagen = await metaChiffriertHolen('beschlussVorlagen');
  const urlaub = await metaChiffriertHolen('urlaub');
  const beschlussTags = await metaChiffriertHolen('beschlussTags');
  const exportOptionen = await metaChiffriertHolen('exportOptionen');
  const roh = await Speicher.sitzungenAlle();
  const sitzungen = [];
  for (const rec of roh) sitzungen.push(await Krypto.dechiffriere(sitzungsSchluessel, rec.iv, rec.ct));
  return migriere({
    app: 'br-sitzungsmanager', version: appmeta.version || 1,
    revision: appmeta.revision || 0, zuletztGesichert: appmeta.zuletztGesichert || null,
    aenderungsstand: appmeta.aenderungsstand || 0, exportStand: appmeta.exportStand || 0,
    stammdaten: stammdaten || undefined, personen: personen || undefined, mitglieder: mitglieder || undefined,
    dokumente: dokumente || undefined, standardTops: standardTops || undefined,
    kategorien: kategorien || undefined,
    protokollVorlagen: protokollVorlagen || undefined, beschlussVorlagen: beschlussVorlagen || undefined,
    urlaub: urlaub || undefined,
    beschlussTags: beschlussTags || undefined,
    sitzungen: sitzungen, exportOptionen: exportOptionen || undefined
  });
}

/* Angemeldete Sitzung übersteht das Neuladen der Seite: der MK liegt dafür im sessionStorage – nur in diesem Tab, weg beim Schließen. Bewusster Kompromiss zugunsten „Reload kostet weder Daten noch Passwort". */
const SITZUNG_MERKER = 'br-sitzungsmanager.sitzung' + (APP_MODUS === 'protokoll' ? '.protokoll' : '');

function sitzungMerken() {
  if (!sitzungsMkBytes) return;
  try { sessionStorage.setItem(SITZUNG_MERKER, JSON.stringify({ mk: bytesZuBase64(sitzungsMkBytes), rolle: sitzungsRolle })); } catch (e) { }
}
function sitzungVergessen() {
  try { sessionStorage.removeItem(SITZUNG_MERKER); } catch (e) { }
}
/* Liefert true, wenn Schlüssel, Rolle und Daten aus dem laufenden Tab wiederhergestellt wurden. */
async function sitzungFortsetzen() {
  let roh = null;
  try { roh = sessionStorage.getItem(SITZUNG_MERKER); } catch (e) { return false; }
  if (!roh) return false;
  try {
    const g = JSON.parse(roh);
    sitzungsMkBytes = base64ZuBytes(g.mk);
    sitzungsSchluessel = await Krypto.mkAusBytes(sitzungsMkBytes);
    sitzungsRolle = g.rolle; ui.rolle = g.rolle;
    daten = await allesLaden();
    return true;
  } catch (e) {
    console.warn('Gemerkte Sitzung ließ sich nicht fortsetzen:', e);
    sitzungVergessen();
    sitzungsSchluessel = null; sitzungsMkBytes = null; sitzungsRolle = null; ui.rolle = null; daten = null;
    return false;
  }
}

function migriere(d) {
  const basis = leeresProjekt();
  d.stammdaten = Object.assign({}, basis.stammdaten, d.stammdaten || {});
  d.exportOptionen = Object.assign({}, basis.exportOptionen, d.exportOptionen || {});
  d.personen = d.personen || [];
  /* Alt-Modell: mitglieder[] → personen[] (Gruppe „br"). */
  if (!d.personen.length && Array.isArray(d.mitglieder) && d.mitglieder.length) {
    d.personen = d.mitglieder.map(m => ({
      id: m.id || uid(), name: m.name || '', gruppe: 'br',
      funktion: m.funktion || 'Mitglied', aktiv: m.aktiv !== false
    }));
  }
  d.personen = d.personen.map(p => Object.assign({ id: uid(), name: '', gruppe: 'br', funktion: 'Mitglied', aktiv: true, email: '' }, p, { gruppe: p.gruppe || 'br' }));
  delete d.mitglieder;
  d.dokumente = d.dokumente || [];
  d.beschlussTags = (d.beschlussTags || []).map(t => ({ id: t.id || uid(), name: t.name || '', farbe: t.farbe || TAG_FARBEN[0] }));
  /* Kategorien normalisieren; TOPs ohne Kategorie bleiben ohne (die Kategorie ist optional). */
  if (!Array.isArray(d.kategorien) || !d.kategorien.length) d.kategorien = kategorienDefault();
  else {
    const gesehen = new Set();
    d.kategorien = d.kategorien.filter(k => k && (k.key || k.label)).map(k => {
      const key = k.key || kategorieSchluessel(k.label, gesehen);
      gesehen.add(key);
      return { id: k.id || uid(), key: key, label: k.label || key };
    });
    if (!d.kategorien.length) d.kategorien = kategorienDefault();
  }
  if (!Array.isArray(d.standardTops) || !d.standardTops.length) d.standardTops = standardTopsDefault();
  else d.standardTops = d.standardTops.map(t => ({
    id: t.id || uid(), titel: t.titel || '', kategorie: t.kategorie || '',
    unterpunkte: standardUnterpunkteNorm(t.unterpunkte)   /* fehlt in Ständen vor v0.27.0 */
  }));
  if (!Array.isArray(d.protokollVorlagen)) d.protokollVorlagen = protokollVorlagenDefault();
  else d.protokollVorlagen = d.protokollVorlagen.map(t => ({ id: t.id || uid(), titel: t.titel || '', text: t.text || '' }));
  /* Sicherungen vor v0.26.0 kennen die Beschluss-Bausteine noch nicht → Auslieferungsliste. */
  if (!Array.isArray(d.beschlussVorlagen)) d.beschlussVorlagen = beschlussVorlagenDefault();
  else d.beschlussVorlagen = d.beschlussVorlagen.map(t => ({ id: t.id || uid(), titel: t.titel || '', text: t.text || '' }));
  /* Bis v0.28.0 stand der Urlaubskalender nur in der Nachbardatei urlaub.js. */
  d.urlaub = urlaubNormieren(d.urlaub, true);
  d.revision = d.revision || 0;
  d.zuletztGesichert = d.zuletztGesichert || null;
  if (typeof d.aenderungsstand !== 'number') d.aenderungsstand = 0;
  if (typeof d.exportStand !== 'number') d.exportStand = 0;
  const normBeschluss = b => {
    if (!Array.isArray(b.tags)) b.tags = [];
    if (!b.status) b.status = 'in_arbeit';
    return b;
  };
  const normPunkt = p => {
    p.verlauf = migriereVerlauf(p.verlauf);
    p.beschluesse = (p.beschluesse || []).map(normBeschluss);
    p.aufgaben = (p.aufgaben || []).map(a => { if (!a.status) a.status = 'offen'; return a; });
    p.anlagen = p.anlagen || [];
    return p;
  };
  d.sitzungen = (d.sitzungen || []).map(s => {
    s.tops = (s.tops || []).map(t => {
      t = normPunkt(Object.assign(neuerTop(), t));
      t.unterpunkte = (t.unterpunkte || []).map(u => normPunkt(Object.assign(neuerUnterpunkt(), u)));
      return t;
    });
    s.teilnahme = s.teilnahme || {};
    s.gaeste = (s.gaeste || []).map(g => { g.tops = Array.isArray(g.tops) ? g.tops : []; return g; });
    s.anlagenTO = s.anlagenTO || [];
    s.anlagenProt = s.anlagenProt || [];
    return s;
  });
  return d;
}

function speichern(sofort) {
  if (!sitzungsSchluessel) return;               /* vor dem Entsperren nichts schreiben */
  if (!darfBearbeiten()) return;
  daten.aenderungsstand = (daten.aenderungsstand || 0) + 1;
  dirtyMeta = true;
  if (ui.sitzungId) dirtySitzungen.add(ui.sitzungId);
  clearTimeout(speicherTimer);
  if (sofort) flushSpeicher();
  else speicherTimer = setTimeout(flushSpeicher, 500);
  sitzungsstandAuffrischen();
}

/* Sitzungsstand und Stand-Punkte im Inhaltsverzeichnis hängen an speichern() statt an jedem einzelnen Eingabeweg,
   entprellt gegen das Tippen. */
let standTimer = null;
function sitzungsstandAuffrischen() {
  clearTimeout(standTimer);
  standTimer = setTimeout(() => {
    if (APP_MODUS === 'protokoll') renderSitzungsstand();
    standPunkteAuffrischen();
  }, 250);
}

async function flushSpeicher() {
  if (!sitzungsSchluessel) return;
  try {
    if (dirtyMeta) { await metaAllesSchreiben(); dirtyMeta = false; }
    for (const id of Array.from(dirtySitzungen)) {
      const s = daten.sitzungen.find(x => x.id === id);
      if (s) await sitzungSchreibenP(s);
      dirtySitzungen.delete(id);
    }
    ui.speicherFehler = false;
    const t = new Date();
    setAutosaveInfo('Verschlüsselt gespeichert um ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ' Uhr (in diesem Browser)');
    aktualisiereSicherungInfo();
  } catch (e) {
    ui.speicherFehler = true;
    console.warn('Speichern fehlgeschlagen:', e);
    setAutosaveInfo('Speichern fehlgeschlagen – bitte über „Sichern (Datei)" sichern!', true);
  }
}

function aktualisiereSicherungInfo() {
  const el = document.getElementById('sicherungInfo');
  if (!el || !daten) return;
  const unexportiert = (daten.aenderungsstand || 0) > (daten.exportStand || 0);
  const z = daten.zuletztGesichert;
  const txt = z && z.am
    ? 'Sicherung: Rev. ' + (daten.revision || 0) + ' · ' + fmtDatumZeit(z.am) + (z.von ? ' · ' + z.von : '')
    : 'Noch keine Sicherung auf dem Netzlaufwerk abgelegt.';
  /* Die Warnform (Dreieck) kommt aus dem Stylesheet über .warnung, nicht als Zeichen. */
  el.textContent = (unexportiert ? 'Nicht gesicherte Änderungen — ' : '') + txt;
  el.classList.toggle('warnung', unexportiert);
}

function fmtDatumZeit(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* Name der bearbeitenden Person – geräte-lokal gemerkt (nicht vertraulich). */
function bearbeiterName(neuerName) {
  try {
    if (neuerName !== undefined) { localStorage.setItem('br-sitzungsmanager.bearbeiter', neuerName); return neuerName; }
    return localStorage.getItem('br-sitzungsmanager.bearbeiter') || '';
  } catch (e) { return ''; }
}

function setAutosaveInfo(text, fehler) {
  const el = document.getElementById('autosaveInfo');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('fehler', !!fehler);
}

/* Verschlüsselte, selbsttragende Sicherungsdatei (eigenes Salt, mit Passwort auf jedem Rechner wiederherstellbar). */
/* Hülle einer vollständigen Sicherung (enc-v2). Die Werkzeugseiten lesen und schreiben dasselbe Format mit eigenen Kopien des Krypto-Kerns; test-browser.js (pruefeFormatgleichheit) hält beide Seiten zusammen. */
async function sicherungVerpacken(mk, zugang, nutzlast) {
  const { iv, ct } = await Krypto.chiffriere(mk, nutzlast);
  return {
    app: 'br-sitzungsmanager', format: 'enc-v2',
    zugang: zugang,                                  /* Viewer-/Arbeits-/Admin-Zugang reist mit */
    iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct))
  };
}
async function sicherungEntpacken(d, passwort) {
  const auf = await zugangEntsperren(d.zugang, passwort);
  return Krypto.dechiffriere(auf.mk, new Uint8Array(d.iv), base64ZuBytes(d.ct).buffer);
}

async function projektDateiSpeichern() {
  if (!sitzungsSchluessel) return;
  try {
    let von = await textAbfrage('Sicherung erstellen', 'Name der bearbeitenden Person (erscheint im Sicherungsvermerk):', bearbeiterName());
    if (von == null) return;
    von = von.trim();
    if (von) bearbeiterName(von);
    const revision = (daten.revision || 0) + 1;
    const jetzt = new Date().toISOString();
    const vermerk = { am: jetzt, von: von || '' };
    const gesamt = {
      app: 'br-sitzungsmanager', version: daten.version || 1,
      revision: revision, zuletztGesichert: vermerk,
      stammdaten: daten.stammdaten, personen: daten.personen,
      dokumente: daten.dokumente, dokumentInhalte: await dokumenteFuerBackup(),
      standardTops: daten.standardTops, kategorien: daten.kategorien,
      protokollVorlagen: daten.protokollVorlagen, beschlussVorlagen: daten.beschlussVorlagen,
      urlaub: daten.urlaub,
      beschlussTags: daten.beschlussTags,
      sitzungen: daten.sitzungen, exportOptionen: daten.exportOptionen
    };
    const datei = await sicherungVerpacken(sitzungsSchluessel, aktuellesZugang, gesamt);
    const zeitTag = jetzt.slice(0, 10), zeitUhr = jetzt.slice(11, 16).replace(':', '');
    const name = 'BR-Sitzungen' + (daten.stammdaten.firma ? '_' + daten.stammdaten.firma.replace(/[^\wäöüÄÖÜß-]+/g, '-') : '') +
      '_Rev' + String(revision).padStart(4, '0') + '_' + zeitTag + '_' + zeitUhr + '.brenc.json';
    dateiHerunterladen(new Blob([JSON.stringify(datei)], { type: 'application/json' }), name);
    /* Direkt (ohne speichern()) persistieren, damit der Änderungsstand nicht weiterzählt. */
    daten.revision = revision;
    daten.zuletztGesichert = vermerk;
    daten.exportStand = daten.aenderungsstand || 0;
    await metaAllesSchreiben();
    aktualisiereSicherungInfo();
    zeigeToast('Sicherung „' + name + '" erstellt. Bitte auf dem Netzlaufwerk ablegen.', 'erfolg');
  } catch (e) {
    zeigeToast('Die Sicherung konnte nicht erstellt werden.', 'fehler');
  }
}

/* Gremium-Datei: Sitzungsmanager exportiert die Angaben des Admin-Menüs verschlüsselt (Installations-MK) in die Nachbardatei „Gremium"; das Protokollmodul übernimmt sie automatisch. Ohne die Datei nutzt es seinen eigenen Stand. */
const GREMIUM_FELDER = ['stammdaten', 'personen', 'standardTops', 'kategorien',
                        'protokollVorlagen', 'beschlussVorlagen', 'urlaub', 'beschlussTags',
                        /* exportOptionen: Konvention des Gremiums, nicht des Moduls – im Protokollmodul deshalb gesperrt. */
                        'exportOptionen'];

/* Vergleichswert, um „hat sich etwas geändert?" ohne Tiefenvergleich zu beantworten. */
function gremiumSignatur(q) {
  return JSON.stringify(GREMIUM_FELDER.map(f => q && q[f] !== undefined ? q[f] : null));
}

async function gremiumDateiErzeugen() {
  if (!sitzungsSchluessel) return;
  if (APP_MODUS !== 'sitzung') {
    return zeigeToast('Die Gremium-Datei wird im Sitzungsmanager erzeugt.', 'fehler');
  }
  try {
    const inhalt = { app: 'br-sitzungsmanager', erstelltAm: new Date().toISOString() };
    for (const f of GREMIUM_FELDER) inhalt[f] = daten[f];
    const { iv, ct } = await Krypto.chiffriere(sitzungsSchluessel, inhalt);
    const js =
      '/* Gremium – Stammdaten, Personen, Kategorien und Textbausteine des Betriebsrats,\n' +
      '   verschlüsselt unter dem Hauptschlüssel dieser Installation (br-zugang.js).\n' +
      '   Diese Datei in den Unterordner "scripts" legen – das\n' +
      '   Protokollmodul übernimmt sie beim Öffnen automatisch.\n' +
      '   Gepflegt wird sie ausschließlich im Admin-Menü des Sitzungsmanagers;\n' +
      '   nach jeder Änderung dort neu herunterladen und hier ersetzen.\n' +
      '   Erzeugt am ' + inhalt.erstelltAm + '. Nicht von Hand bearbeiten. */\n' +
      'window.BR_GREMIUM = ' + JSON.stringify({
        app: 'br-sitzungsmanager', format: 'gremium-v1', erstelltAm: inhalt.erstelltAm,
        iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct))
      }, null, 2) + ';\n';
    dateiHerunterladen(new Blob([js], { type: 'text/javascript;charset=utf-8' }), 'Gremium');
    zeigeToast('Datei „Gremium" erstellt. Bitte in den Unterordner „scripts" legen.', 'erfolg');
  } catch (e) {
    zeigeToast('Die Gremium-Datei konnte nicht erstellt werden.', 'fehler');
  }
}

/* Übernimmt window.BR_GREMIUM. Läuft nur im Protokollmodul – im Sitzungsmanager wird gepflegt, dort wäre die Datei nur ein Abbild des eigenen Standes. */
async function externesGremiumUebernehmen() {
  if (APP_MODUS !== 'protokoll') return false;
  const g = (typeof window !== 'undefined') ? window.BR_GREMIUM : null;
  if (!g || g.format !== 'gremium-v1' || !g.iv || !g.ct) return false;
  let inhalt;
  try {
    inhalt = await Krypto.dechiffriere(sitzungsSchluessel, new Uint8Array(g.iv), base64ZuBytes(g.ct).buffer);
  } catch (e) {
    /* Andere Installation (fremde br-zugang.js) – nicht entschlüsselbar. */
    console.warn('Die Datei „Gremium" passt nicht zu dieser Installation:', e);
    zeigeToast('Die Datei „Gremium" passt nicht zu dieser Installation und wurde übersprungen.', 'fehler');
    return false;
  }
  if (gremiumSignatur(inhalt) === gremiumSignatur(daten)) return false;
  for (const f of GREMIUM_FELDER) if (inhalt[f] !== undefined) daten[f] = inhalt[f];
  const norm = migriere(Object.assign({ app: 'br-sitzungsmanager', version: daten.version || 1, sitzungen: [] },
    Object.fromEntries(GREMIUM_FELDER.map(f => [f, daten[f]]))));
  for (const f of GREMIUM_FELDER) daten[f] = norm[f];
  kategorienAnwenden();
  return true;
}

/* Gerichtete Übergabe: Sitzungsmanager gibt die Tagesordnung heraus, Protokollmodul die Ergebnisse; jedes Modul nimmt nur die Gegenrichtung an. Nutzlast baut br-kern.js, hier nur Verschlüsselung/Datei/Rückfrage. */
const UEBERGABE = {
  sitzung:   { erzeugt: 'tagesordnung-v1', nimmt: 'ergebnis-v1' },
  protokoll: { erzeugt: 'ergebnis-v1', nimmt: 'tagesordnung-v1' }
};
const UEBERGABE_TEXT = {
  'tagesordnung-v1': { knopf: 'Tagesordnung übergeben', nehmen: 'Tagesordnung übernehmen',
                       was: 'Tagesordnung', endung: '.brto.json' },
  'ergebnis-v1':     { knopf: 'Ergebnisse übergeben', nehmen: 'Ergebnisse übernehmen',
                       was: 'Beschlüsse und Aufgaben', endung: '.brerg.json' }
};
function uebergabeErzeugt() { return (UEBERGABE[APP_MODUS] || UEBERGABE.sitzung).erzeugt; }
function uebergabeNimmt() { return (UEBERGABE[APP_MODUS] || UEBERGABE.sitzung).nimmt; }

async function uebergabeDateiSpeichern(s) {
  if (!sitzungsSchluessel) return;
  if (!s) return zeigeToast('Bitte zuerst eine Sitzung auswählen.', 'fehler');
  const art = uebergabeErzeugt();
  const txt = UEBERGABE_TEXT[art];
  try {
    let von = await textAbfrage(txt.knopf,
      'Name der übergebenden Person (erscheint im Übergabevermerk):', bearbeiterName());
    if (von == null) return;
    von = von.trim();
    if (von) bearbeiterName(von);

    const jetzt = new Date().toISOString();
    const nutzlast = Object.assign(
      { app: 'br-sitzungsmanager', version: daten.version || 1,
        uebergabe: { am: jetzt, von: von || '', von_modus: APP_MODUS } },
      art === 'tagesordnung-v1' ? tagesordnungNutzlast(s) : ergebnisNutzlast(s));

    const { iv, ct } = await Krypto.chiffriere(sitzungsSchluessel, nutzlast);
    const datei = {
      app: 'br-sitzungsmanager', format: art,
      zugang: aktuellesZugang,                         /* wie bei der Sicherung: Zugang reist mit */
      iv: Array.from(iv), ct: bytesZuBase64(new Uint8Array(ct))
    };
    const name = 'BR-' + (art === 'tagesordnung-v1' ? 'Tagesordnung' : 'Ergebnisse') +
      '_Nr' + String(s.nr || '').replace(/[^\wäöüÄÖÜß-]+/g, '-') +
      (s.datum ? '_' + s.datum : '') + '_' + jetzt.slice(11, 16).replace(':', '') + txt.endung;
    dateiHerunterladen(new Blob([JSON.stringify(datei)], { type: 'application/json' }), name);
    zeigeToast('Übergabedatei „' + name + '" erstellt (' + txt.was + ').', 'erfolg');
  } catch (e) {
    zeigeToast('Die Übergabedatei konnte nicht erstellt werden.', 'fehler');
  }
}

async function uebergabeDateiOeffnen(datei) {
  if (!darfBearbeiten()) return zeigeToast('Zum Übernehmen bitte anmelden.', 'fehler');
  const erwartet = uebergabeNimmt();
  let d;
  try { d = JSON.parse(await datei.text()); }
  catch (e) { return zeigeToast('Keine gültige Übergabedatei dieses Programms.', 'fehler'); }
  if (d && (d.format === 'enc-v2' || d.format === 'enc-v1')) {
    return zeigeToast('Das ist eine vollständige Sicherung – bitte über „Öffnen" laden.', 'fehler');
  }
  if (d && d.format === uebergabeErzeugt()) {
    return zeigeToast('Diese Datei stammt aus diesem Modul – sie gehört in die Gegenstelle.', 'fehler');
  }
  if (!d || d.format !== erwartet || !d.zugang || !d.iv || !d.ct) {
    return zeigeToast('Keine gültige Übergabedatei dieses Programms (erwartet: ' +
      UEBERGABE_TEXT[erwartet].was + ').', 'fehler');
  }
  try {
    const passwort = await passwortAbfrage(UEBERGABE_TEXT[erwartet].nehmen,
      'Bitte Ihr Passwort (Arbeitsmodus oder Debug-Mode) eingeben.');
    if (passwort == null) return;
    const auf = await zugangEntsperren(d.zugang, passwort);   /* wirft bei falschem Passwort */
    const p = await Krypto.dechiffriere(auf.mk, new Uint8Array(d.iv), base64ZuBytes(d.ct).buffer);
    const vermerk = 'Übergeben von ' + (p.uebergabe && p.uebergabe.von ? p.uebergabe.von : 'unbekannt') +
      (p.uebergabe && p.uebergabe.am ? ' am ' + fmtDatum(p.uebergabe.am.slice(0, 10), true) : '') + '.';
    if (erwartet === 'tagesordnung-v1') return tagesordnungRueckfrage(p, vermerk);
    return ergebnisseRueckfrage(p, vermerk);
  } catch (e) {
    zeigeToast('Die Übergabedatei konnte nicht geladen werden (falsches Passwort oder beschädigt).', 'fehler');
  }
}

/* Protokollmodul nimmt eine Tagesordnung an */
function tagesordnungRueckfrage(p, vermerk) {
  if (!p || !p.sitzung || !p.sitzung.id) return zeigeToast('Die Datei enthält keine Tagesordnung.', 'fehler');
  const alt = (daten.sitzungen || []).find(x => x.id === p.sitzung.id);
  const nr = p.sitzung.nr || '(ohne Nummer)';
  /* Probelauf auf einer Kopie, um vor echtem Verlust warnen zu können. */
  const probe = JSON.parse(JSON.stringify(p.sitzung));
  const bilanz = tagesordnungEinspielen(alt, probe);
  const teile = [];
  if (alt) {
    teile.push('Die Tagesordnung der Sitzung Nr. ' + nr + ' wird aktualisiert (' + bilanz.uebernommen + ' Punkte).');
    if (bilanz.erhalten) teile.push('Bereits Protokolliertes zu ' + bilanz.erhalten + ' Punkt(en) bleibt erhalten.');
    if (bilanz.verloren.length) {
      teile.push('ACHTUNG: ' + bilanz.verloren.length + ' Punkt(e) mit Protokollinhalt sind in der neuen Tagesordnung nicht mehr enthalten und gehen verloren: ' +
        bilanz.verloren.slice(0, 5).join(', ') + (bilanz.verloren.length > 5 ? ' …' : '') + '.');
    }
  } else {
    teile.push('Sitzung Nr. ' + nr + ' wird mit ' + bilanz.uebernommen + ' Tagesordnungspunkt(en) angelegt.');
  }
  teile.push('Anlagen sind als Verweis enthalten; die Dateien selbst bleiben im Sitzungsmanager.');
  teile.push(vermerk);
  bestaetigen(alt ? 'Tagesordnung aktualisieren?' : 'Tagesordnung übernehmen?', teile.join(' '),
    () => tagesordnungUebernehmen(p), alt ? 'Aktualisieren' : 'Übernehmen', bilanz.verloren.length > 0);
}

async function tagesordnungUebernehmen(p) {
  try {
    const alt = (daten.sitzungen || []).find(x => x.id === p.sitzung.id) || null;
    const norm = migriere({ app: 'br-sitzungsmanager', version: p.version || 1, sitzungen: [p.sitzung] });
    const neu = norm.sitzungen[0];
    const bilanz = tagesordnungEinspielen(alt, neu);
    const i = daten.sitzungen.findIndex(x => x.id === neu.id);
    if (i >= 0) daten.sitzungen[i] = neu; else daten.sitzungen.unshift(neu);
    await uebergabeSchreiben(neu,
      'Tagesordnung der Sitzung Nr. ' + (neu.nr || '') + ' übernommen (' + bilanz.uebernommen + ' Punkte).');
  } catch (e) {
    zeigeToast('Die Tagesordnung konnte nicht übernommen werden.', 'fehler');
  }
}

/* Sitzungsmanager nimmt Beschlüsse und Aufgaben an */
function ergebnisseRueckfrage(p, vermerk) {
  if (!p || !p.sitzungId) return zeigeToast('Die Datei enthält keine Ergebnisse.', 'fehler');
  const ziel = (daten.sitzungen || []).find(x => x.id === p.sitzungId);
  if (!ziel) {
    return zeigeToast('Zu diesen Ergebnissen gibt es hier keine Sitzung Nr. ' + (p.nr || '?') +
      ' – bitte zuerst die Tagesordnung übergeben.', 'fehler');
  }
  const probe = JSON.parse(JSON.stringify(ziel));
  const bilanz = ergebnisseEinspielen(probe, p);
  const teile = ['Für Sitzung Nr. ' + (ziel.nr || '') + ' werden ' + bilanz.beschluesse +
    ' Beschluss/Beschlüsse und ' + bilanz.aufgaben + ' Aufgabe(n) zu ' + bilanz.punkte +
    ' Punkt(en) übernommen; die bisherigen dort werden ersetzt.'];
  if (bilanz.unbekannt.length) {
    teile.push('ACHTUNG: ' + bilanz.unbekannt.length + ' Punkt(e) aus der Datei gibt es hier nicht mehr – deren Ergebnisse gehen verloren.');
  }
  teile.push('Die Teilnahme wird mit übernommen, damit die Beschluss-Übersicht richtig auswertet.');
  teile.push(vermerk);
  bestaetigen('Ergebnisse übernehmen?', teile.join(' '),
    () => ergebnisseUebernehmen(p), 'Übernehmen', bilanz.unbekannt.length > 0);
}

async function ergebnisseUebernehmen(p) {
  try {
    const ziel = (daten.sitzungen || []).find(x => x.id === p.sitzungId);
    if (!ziel) return;
    const bilanz = ergebnisseEinspielen(ziel, p);
    /* Über die Migration nachziehen: Beschlussfelder, Aufgabenstatus, Verlauf-Form. */
    const norm = migriere({ app: 'br-sitzungsmanager', version: daten.version || 1,
                            beschlussTags: daten.beschlussTags, sitzungen: [ziel] });
    const i = daten.sitzungen.findIndex(x => x.id === ziel.id);
    daten.sitzungen[i] = norm.sitzungen[0];
    await uebergabeSchreiben(daten.sitzungen[i],
      bilanz.beschluesse + ' Beschluss/Beschlüsse und ' + bilanz.aufgaben +
      ' Aufgabe(n) zu Sitzung Nr. ' + (ziel.nr || '') + ' übernommen.');
  } catch (e) {
    zeigeToast('Die Ergebnisse konnten nicht übernommen werden.', 'fehler');
  }
}

/* Schreibt gezielt statt alleDatenErsetzenP() (würde übrige Sitzungen löschen); scheitert das Schreiben, ist die Änderung trotzdem im Speicher – Oberfläche nachziehen und deutlich warnen. */
async function uebergabeSchreiben(sitzung, erfolgsText) {
  daten.aenderungsstand = (daten.aenderungsstand || 0) + 1;
  let geschrieben = true;
  try {
    await metaAllesSchreiben();
    await sitzungSchreibenP(sitzung);
  } catch (schreibFehler) {
    geschrieben = false;
    console.warn('Übernahme konnte nicht gespeichert werden:', schreibFehler);
  }
  ui.sitzungId = sitzung.id;
  ui.tab = modusStartReiter();
  ui.ansicht = 'sitzung';
  aktualisiereRollenUi();
  renderAlles();
  aktualisiereSicherungInfo();
  zeigeToast(geschrieben ? erfolgsText
    : erfolgsText + ' ABER NICHT GESPEICHERT – bitte erneut übernehmen oder sichern.',
    geschrieben ? 'erfolg' : 'fehler');
}

async function projektDateiOeffnen(datei) {
  if (!darfBearbeiten()) return zeigeToast('Zum Öffnen einer anderen Datei bitte anmelden.', 'fehler');
  let d;
  try { d = JSON.parse(await datei.text()); }
  catch (e) { return zeigeToast('Keine gültige Projektdatei dieses Programms.', 'fehler'); }
  try {
    let projekt;
    if (d && d.format === 'enc-v2') {
      if (!d.zugang) return zeigeToast('Sicherung ohne Zugang – bitte eine aktuelle Sicherung verwenden.', 'fehler');
      const passwort = await passwortAbfrage('Sicherung entschlüsseln', 'Bitte Ihr Passwort (Arbeitsmodus oder Debug-Mode) eingeben.');
      if (passwort == null) return;
      projekt = await sicherungEntpacken(d, passwort);
      /* Installation (br-zugang.js) bleibt maßgeblich: der Schlüssel der Sicherung dient nur zum Entschlüsseln, gespeichert wird unter dem aktuellen Installations-MK. */
    } else if (d && d.format === 'enc-v1') {
      const passwort = await passwortAbfrage('Sicherung entschlüsseln', 'Bitte das Passwort dieser Sicherungsdatei eingeben.');
      if (passwort == null) return;
      const key = await Krypto.schluessel(passwort, new Uint8Array(d.kdf.salt), d.kdf.iter || PBKDF2_ITER);
      projekt = await Krypto.dechiffriere(key, new Uint8Array(d.iv), base64ZuBytes(d.ct).buffer);
    } else if (d && UEBERGABE_TEXT[d.format]) {
      /* Ohne diese Weiche liefe die Übergabedatei unten als „Klartext-Altformat" durch und ersetzte den gesamten Bestand durch eine einzelne Sitzung. */
      return zeigeToast('Das ist eine Übergabedatei (' + UEBERGABE_TEXT[d.format].was +
        '), keine vollständige Sicherung – bitte über „' + UEBERGABE_TEXT[d.format].nehmen + '" laden.', 'fehler');
    } else if (d && d.app === 'br-sitzungsmanager') {
      projekt = d;   /* Alt-/Klartextformat: Interop & Erst-Migration */
    } else {
      return zeigeToast('Keine gültige Projektdatei dieses Programms.', 'fehler');
    }
    /* Schutz vor Datenverlust: vor dem Ersetzen auf veralteten Stand / ungesicherte Änderungen hinweisen. */
    const warnungen = [];
    if ((daten.aenderungsstand || 0) > (daten.exportStand || 0)) {
      warnungen.push('Der aktuelle Stand in diesem Browser enthält Änderungen, die noch nicht als Sicherung abgelegt wurden – diese gehen beim Laden verloren.');
    }
    const fileRev = projekt.revision || 0, lokalRev = daten.revision || 0;
    if (fileRev && lokalRev && fileRev < lokalRev) {
      warnungen.push('Die gewählte Datei (Rev. ' + fileRev + ') ist älter als der aktuelle Stand (Rev. ' + lokalRev + ').');
    }
    if (warnungen.length) {
      bestaetigen('Sicherung wirklich laden?', warnungen.join(' ') + ' Fortfahren und den aktuellen Stand ersetzen?',
        () => projektUebernehmen(projekt), 'Trotzdem laden', true);
    } else {
      await projektUebernehmen(projekt);
    }
  } catch (e) {
    zeigeToast('Die Datei konnte nicht geladen werden (falsches Passwort oder beschädigt).', 'fehler');
  }
}

async function projektUebernehmen(projekt) {
  /* Installation (br-zugang.js) bleibt maßgeblich: gespeichert wird unter dem aktuellen Installations-MK, Zugang/Rolle der Anmeldung bleiben unverändert. */
  daten = migriere(projekt);
  ui.sitzungId = daten.sitzungen[0] ? daten.sitzungen[0].id : null;
  ui.tab = modusStartReiter();   /* im Protokoll-Modus gibt es keinen Reiter „Sitzung" */
  ui.ansicht = 'sitzung';
  daten.exportStand = daten.aenderungsstand || 0;
  await alleDatenErsetzenP();
  await dokumenteAusBackup(projekt.dokumentInhalte);
  aktualisiereRollenUi();
  renderAlles();
  aktualisiereSicherungInfo();
  zeigeToast('Sicherung geladen · Rev. ' + (daten.revision || 0) +
    (daten.zuletztGesichert && daten.zuletztGesichert.am ? ' vom ' + fmtDatumZeit(daten.zuletztGesichert.am) : '') +
    ' · ' + daten.sitzungen.length + ' Sitzung(en).', 'erfolg');
}

function textAbfrage(titel, text, vorgabe) {
  return new Promise(res => {
    const dlg = document.getElementById('dlgBestaetigen');
    dlg.innerHTML = '<div class="dlg-kopf"><h3>' + esc(titel) + '</h3></div>' +
      '<div class="dlg-koerper"><p>' + esc(text) + '</p>' +
      '<input type="text" id="txtEingabe" class="eingabe" style="width:100%;margin-top:8px" value="' + esc(vorgabe || '') + '"></div>' +
      '<div class="dlg-fuss"><button class="btn" id="txtAbbr">Abbrechen</button>' +
      '<button class="btn btn-primaer" id="txtOk">OK</button></div>';
    const feld = dlg.querySelector('#txtEingabe');
    const fertig = wert => { dlg.close(); res(wert); };
    dlg.querySelector('#txtAbbr').onclick = () => fertig(null);
    dlg.querySelector('#txtOk').onclick = () => fertig(feld.value);
    feld.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fertig(feld.value); } };
    dlg.showModal();
    setTimeout(() => { feld.focus(); feld.select(); }, 30);
  });
}

function gastAuswahlDialog(kandidaten, s) {
  return new Promise(res => {
    const dlg = document.getElementById('dlgBestaetigen');
    const opts = kandidaten.map((g, i) =>
      '<option value="' + i + '">' + esc((g.name || 'Gast ' + (i + 1)) + ' (' + gastPunkteBezeichnung(s, g) + ')') + '</option>').join('');
    dlg.innerHTML = '<div class="dlg-kopf"><h3>Gekürztes Protokoll – Gast wählen</h3></div>' +
      '<div class="dlg-koerper"><p>Für welchen Gast soll der Protokollauszug erzeugt werden? Enthalten sind nur die dem Gast zugewiesenen TOPs.</p>' +
      '<select id="gastSel" class="eingabe" style="width:100%;margin-top:8px">' + opts + '</select></div>' +
      '<div class="dlg-fuss"><button class="btn" id="gaAbbr">Abbrechen</button>' +
      '<button class="btn btn-primaer" id="gaOk">PDF erzeugen</button></div>';
    const sel = dlg.querySelector('#gastSel');
    const fertig = wert => { dlg.close(); res(wert); };
    dlg.querySelector('#gaAbbr').onclick = () => fertig(null);
    dlg.querySelector('#gaOk').onclick = () => fertig(kandidaten[parseInt(sel.value, 10)] || null);
    dlg.showModal();
    setTimeout(() => sel.focus(), 30);
  });
}

function passwortAbfrage(titel, text) {
  return new Promise(res => {
    const dlg = document.getElementById('dlgBestaetigen');
    dlg.innerHTML = '<div class="dlg-kopf"><h3>' + esc(titel) + '</h3></div>' +
      '<div class="dlg-koerper"><p>' + esc(text) + '</p>' +
      '<input type="password" id="pwEingabe" class="eingabe" style="width:100%;margin-top:8px" autocomplete="current-password"></div>' +
      '<div class="dlg-fuss"><button class="btn" id="pwAbbr">Abbrechen</button>' +
      '<button class="btn btn-primaer" id="pwOk">Entschlüsseln</button></div>';
    const feld = dlg.querySelector('#pwEingabe');
    const fertig = wert => { dlg.close(); res(wert); };
    dlg.querySelector('#pwAbbr').onclick = () => fertig(null);
    dlg.querySelector('#pwOk').onclick = () => fertig(feld.value);
    feld.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fertig(feld.value); } };
    dlg.showModal();
    setTimeout(() => feld.focus(), 30);
  });
}

function passwortDoppeltAbfrage(titel, text) {
  return new Promise(res => {
    const dlg = document.getElementById('dlgBestaetigen');
    dlg.innerHTML = '<div class="dlg-kopf"><h3>' + esc(titel) + '</h3></div>' +
      '<div class="dlg-koerper"><p>' + esc(text) + '</p>' +
      '<input type="password" id="pwA" class="eingabe" style="width:100%;margin-top:8px" placeholder="Neues Passwort" autocomplete="new-password">' +
      '<input type="password" id="pwB" class="eingabe" style="width:100%;margin-top:8px" placeholder="Wiederholen" autocomplete="new-password">' +
      '<div class="sperr-fehler" id="pwDFehler" style="margin-top:8px"></div></div>' +
      '<div class="dlg-fuss"><button class="btn" id="pwDAbbr">Abbrechen</button>' +
      '<button class="btn btn-primaer" id="pwDOk">Speichern</button></div>';
    const a = dlg.querySelector('#pwA'), b = dlg.querySelector('#pwB'), f = dlg.querySelector('#pwDFehler');
    dlg.querySelector('#pwDAbbr').onclick = () => { dlg.close(); res(null); };
    dlg.querySelector('#pwDOk').onclick = () => {
      if (a.value.length < 8) { f.textContent = 'Bitte mindestens 8 Zeichen wählen.'; return; }
      if (a.value !== b.value) { f.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
      dlg.close(); res(a.value);
    };
    dlg.showModal();
    setTimeout(() => a.focus(), 30);
  });
}

/* Beitritt an neuem Rechner: vorhandene Sicherung öffnen (enthält den Zugang); auch vom Sperrschirm genutzt. */
function beitretenPerDatei() {
  const inp = document.getElementById('dateiBeitritt');
  inp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) projektBeitreten(f); };
  inp.click();
}

async function projektBeitreten(datei) {
  let d;
  try { d = JSON.parse(await datei.text()); }
  catch (e) { return zeigeToast('Keine gültige Projektdatei dieses Programms.', 'fehler'); }
  if (!d || d.format !== 'enc-v2' || !d.zugang) {
    return zeigeToast('Diese Datei enthält keinen Zugang. Bitte eine aktuelle Sicherung (mit Passwörtern) verwenden.', 'fehler');
  }
  const passwort = await passwortAbfrage('Sicherung öffnen', 'Bitte Ihr Passwort (Arbeitsmodus oder Debug-Mode) eingeben.');
  if (passwort == null) return;
  try {
    /* Installation (br-zugang.js) ist maßgeblich: erst lokalen Zugang entsperren, dann unter diesem Installations-MK speichern (unabhängig vom MK der Sicherung). */
    const zugang = externerZugang();
    let inst;
    try { inst = await zugangEntsperren(zugang, passwort); }
    catch (e) { return zeigeToast('Falsches Passwort für die lokale br-zugang.js.', 'fehler'); }
    const projekt = await sicherungEntpacken(d, passwort);
    sitzungsSchluessel = inst.mk; sitzungsMkBytes = inst.mkBytes;
    sitzungsRolle = inst.rolle; ui.rolle = inst.rolle;
    aktuellesZugang = zugang;
    await Speicher.metaSetzen('zugang', zugang);
    daten = migriere(projekt);
    daten.exportStand = daten.aenderungsstand || 0;
    await alleDatenErsetzenP();
    await dokumenteAusBackup(projekt.dokumentInhalte);
    sitzungMerken();
    await appStarten(); sperrschirmWeg();
    zeigeToast('Angemeldet als ' + (inst.rolle === 'admin' ? 'Debug-Mode' : (inst.rolle === 'arbeit' ? 'Arbeitsmodus' : 'Nur-Lese-Ansicht')) + '.', 'erfolg');
  } catch (e) {
    zeigeToast('Die Sicherung ließ sich nicht öffnen (Passwort passt nicht zu dieser Sicherung oder Datei beschädigt).', 'fehler');
  }
}

/* Rollenabhängige Oberfläche: Viewer liest nur, Arbeit bearbeitet, Admin verwaltet. Rollenwechsel = Neuanmeldung mit anderem Passwort. */
function aktualisiereRollenUi() {
  const rolle = sitzungsRolle;
  const bearbeiten = darfBearbeiten();
  const ra = document.getElementById('rolleAnzeige');
  if (ra) ra.textContent = rolle === 'admin' ? 'Debug-Mode' : (rolle === 'arbeit' ? 'Arbeitsmodus' : 'Nur-Lese-Ansicht');
  const sd = document.getElementById('btnStammdaten');
  if (sd) sd.style.display = adminMenueVerfuegbar() ? '' : 'none';
  document.body.classList.toggle('rolle-viewer', !bearbeiten);
  /* Sitzungen anlegen ist zusätzlich der Sitzungsleitung vorbehalten (BR-Sitzungsmanager.html). */
  const nn = document.getElementById('btnNeueSitzung');
  if (nn) nn.style.display = (bearbeiten && APP_MODUS === 'sitzung') ? '' : 'none';
  const po = document.getElementById('btnProjektOeffnen'); if (po) po.style.display = bearbeiten ? '' : 'none';
  /* Übernehmen schreibt Daten – Übergeben ist auch in der Nur-Lese-Ansicht erlaubt. */
  const si = document.getElementById('btnSitzungImport'); if (si) si.style.display = bearbeiten ? '' : 'none';
  /* Übersichten, Dokumentenablage und Admin-Menü führt nur der Sitzungsmanager. */
  for (const [ansicht, id] of Object.entries(NAV_KNOEPFE)) {
    const b = document.getElementById(id);
    if (b && !modusHatAnsicht(ansicht)) b.style.display = 'none';
  }
  const b = document.getElementById('btnSperren');
  if (b) {
    b.textContent = 'Datei schließen';
    b.title = 'Datei schließen – danach ist wieder Datei und Passwort nötig';
  }
}

function sperren() {
  clearTimeout(speicherTimer);
  if (darfBearbeiten()) speichern(true);
  sitzungVergessen();
  sitzungsSchluessel = null; sitzungsMkBytes = null;
  sitzungsRolle = null; ui.rolle = null;
  zeigeSperrschirm('login');
  zeigeToast('Datei geschlossen.');
}

/* Sperrschirm */
function zeigeSperrschirm(modus, kontext) {
  let el = document.getElementById('sperrschirm');
  if (!el) { el = document.createElement('div'); el.id = 'sperrschirm'; el.className = 'sperrschirm'; document.body.appendChild(el); }

  if (modus === 'gesperrt') {
    /* Bewusst kein Weg, hier Passwörter ohne Zugangsdatei zu setzen. */
    el.innerHTML =
      '<div class="sperr-karte">' +
        '<h2>Anwendung gesperrt</h2>' +
        '<div class="ueberzeile">BR-Sitzungsmanager</div>' +
        '<p>' + (kontext || 'Die Anwendung ist gesperrt.') + '</p>' +
        '<p class="klein-grau">Bitte legen Sie eine gültige <code>br-zugang.js</code> in den Unterordner <code>scripts</code> und laden Sie die Seite neu.</p>' +
      '</div>';

  } else {
    /* Einziger Weg hinein: Speicherdatei wählen. Das danach abgefragte Passwort bestimmt die Rolle. */
    el.innerHTML =
      '<div class="sperr-karte">' +
        '<h2>' + (APP_MODUS === 'protokoll' ? 'BR-Protokoll' : 'BR-Sitzungsmanager') + '</h2>' +
        '<div class="ueberzeile">Betriebsrat</div>' +
        '<div class="doppelkante"></div>' +
        '<p>Bitte die Speicherdatei (Sicherung <code>.brenc.json</code>) auswählen. Danach wird das Passwort abgefragt: das <b>Viewer-Passwort</b> öffnet die Nur-Lese-Ansicht, das <b>Arbeits-Passwort</b> den Bearbeitungsmodus.</p>' +
        '<button class="btn btn-primaer" id="pwDatei">Datei laden</button>' +
      '</div>';
    el.querySelector('#pwDatei').onclick = beitretenPerDatei;
    setTimeout(() => el.querySelector('#pwDatei').focus(), 40);
  }
}
function sperrschirmWeg() { const el = document.getElementById('sperrschirm'); if (el) el.remove(); }

function dateiHerunterladen(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Helfer */

function aktSitzung() { return daten.sitzungen.find(s => s.id === ui.sitzungId) || null; }

function zeigeToast(text, art) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast' + (art ? ' ' + art : '');
  t.textContent = text;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 4200);
}

function bestaetigen(titel, text, aktion, aktionLabel, gefahr) {
  const dlg = document.getElementById('dlgBestaetigen');
  dlg.innerHTML = '<div class="dlg-kopf"><h3>' + esc(titel) + '</h3></div>' +
    '<div class="dlg-koerper"><p>' + esc(text) + '</p></div>' +
    '<div class="dlg-fuss"><button class="btn" id="bstAbbr">Abbrechen</button>' +
    '<button class="btn ' + (gefahr ? 'btn-gefahr' : 'btn-primaer') + '" id="bstOk">' + esc(aktionLabel || 'OK') + '</button></div>';
  dlg.querySelector('#bstAbbr').onclick = () => dlg.close();
  dlg.querySelector('#bstOk').onclick = () => { dlg.close(); aktion(); };
  dlg.showModal();
}

function bindeText(el, holen, setzen, nach) {
  if (!el) return;
  const w = holen();
  el.value = w == null ? '' : w;
  if (!darfBearbeiten()) { el.disabled = true; return; }
  el.addEventListener('input', () => { setzen(el.value); speichern(); if (nach) nach(); });
}
function bindePruef(el, holen, setzen, nach) {
  if (!el) return;
  el.checked = !!holen();
  if (!darfBearbeiten()) { el.disabled = true; return; }
  el.addEventListener('change', () => { setzen(el.checked); speichern(); if (nach) nach(); });
}
/* Beim Anzeigen und Speichern wird stets sanitisiert (XSS-Schutz). */
function bindeRichText(editor, holen, setzen) {
  if (!editor) return;
  editor.innerHTML = sanitizeVerlaufHtml(holen() || '');
  if (!darfBearbeiten()) {
    editor.contentEditable = 'false';
    editor.setAttribute('aria-readonly', 'true');
    return;
  }
  editor.addEventListener('input', () => { setzen(sanitizeVerlaufHtml(editor.innerHTML)); speichern(); });
}

function feldHtml(id, label, typ, extra, hinweis) {
  const eingabe = typ === 'textarea'
    ? '<textarea id="' + id + '" ' + (extra || '') + '></textarea>'
    : '<input id="' + id + '" type="' + (typ || 'text') + '" ' + (extra || '') + '>';
  return '<div class="feld"><label for="' + id + '">' + label + '</label>' + eingabe +
    (hinweis ? '<span class="feldhinweis">' + hinweis + '</span>' : '') + '</div>';
}

/* Seitenleiste */

function sitzungKarteHtml(s) {
  const st = STATUS_META[s.status] || STATUS_META.entwurf;
  const spine = st.kl.replace('st-', 'sp-');
  return '<button class="sitzung-karte ' + spine + (s.id === ui.sitzungId ? ' aktiv' : '') + (s.archiviert ? ' archiviert' : '') + '" data-id="' + s.id + '">' +
    '<div class="sk-nr">Sitzung ' + esc(s.nr) + (s.archiviert ? ' <span class="sk-archiv">Archiv</span>' : '') + '</div>' +
    '<div class="sk-datum">' + (s.datum ? esc(fmtDatum(s.datum, true)) : 'Termin offen') + '</div>' +
    '<div class="sk-status">' + esc(st.label) + '</div></button>';
}

/* Erscheinungsbild des Gremiums auf die Oberfläche anwenden: Akzentfarbe (CSS-Variablen), Name, Untertitel, Logo.
   Vor dem Entschlüsseln sind keine Stammdaten da – dann gilt das Standard-Erscheinungsbild. */
function erscheinungAnwenden() {
  if (typeof document === 'undefined') return;
  const st = (daten && daten.stammdaten) || {};
  const e = erscheinung(st);
  const p = akzentPalette(e.akzent);
  const vars = {
    '--akzent': p.akzent, '--akzent-dunkel': p.dunkel, '--akzent-hell': p.hell, '--akzent-rand': p.rand,
    '--akzent-flaeche': 'rgba(' + hexZuRgb(p.akzent).join(',') + ',.16)', '--akzent-auf-dunkel': p.praesDunkel
  };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) {
    if (e.akzent === STANDARD_AKZENT) root.removeProperty(k); else root.setProperty(k, v);
  }
  const marke = document.querySelector('.seitenleiste .marke');
  if (!marke) return;
  const h1 = marke.querySelector('h1'), ut = marke.querySelector('.untertitel');
  if (h1 && h1.dataset.standard == null) h1.dataset.standard = h1.textContent;
  if (ut && ut.dataset.standard == null) ut.dataset.standard = ut.textContent;
  if (h1) h1.textContent = e.name || h1.dataset.standard;
  if (ut) ut.textContent = e.untertitel || ut.dataset.standard;
  if (document.body.dataset.titelStandard == null) document.body.dataset.titelStandard = document.title;
  document.title = e.name ? e.name + ' – ' + (APP_MODUS === 'protokoll' ? 'Protokoll' : 'Sitzungsmanager') : document.body.dataset.titelStandard;
  let logo = marke.querySelector('.marke-logo');
  if (e.logoSeitenleiste && st.logo && st.logo.dataUrl) {
    if (!logo) { logo = document.createElement('img'); logo.className = 'marke-logo'; marke.insertBefore(logo, marke.firstChild); }
    logo.alt = 'Logo ' + (st.gremium || 'Betriebsrat');
    if (logo.getAttribute('src') !== st.logo.dataUrl) logo.src = st.logo.dataUrl;
  } else if (logo) logo.remove();
}

function renderSeitenleiste() {
  const c = document.getElementById('sitzungListe');
  const alle = daten.sitzungen || [];

  const st = daten.stammdaten || {};
  const kennfeldEl = document.getElementById('markeKennfeld');
  if (kennfeldEl) kennfeldEl.textContent = [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · ');
  erscheinungAnwenden();

  const archivZahl = alle.filter(s => s.archiviert).length;
  const zahlEl = document.getElementById('slArchivZahl');
  if (zahlEl) zahlEl.textContent = archivZahl ? '(' + archivZahl + ')' : '';
  const sucheEl = document.getElementById('slSuche');
  if (sucheEl && sucheEl.value !== (ui.sitzungSuche || '')) sucheEl.value = ui.sitzungSuche || '';
  const archivEl = document.getElementById('slArchiv');
  if (archivEl) archivEl.checked = !!ui.archivAnzeigen;

  if (!alle.length) {
    c.innerHTML = '<div class="sl-leer">Noch keine Sitzungen.<br>Erstelle die erste Sitzung.</div>';
    return;
  }
  const q = (ui.sitzungSuche || '').trim().toLowerCase();
  const gefiltert = alle.filter(s => {
    if (s.archiviert && !ui.archivAnzeigen) return false;
    if (!q) return true;
    const heu = ('Sitzung ' + (s.nr || '') + ' ' + fmtDatum(s.datum, true) + ' ' +
      (STATUS_META[s.status] || STATUS_META.entwurf).label + ' ' + (SITZUNGSART_LABEL[s.art] || '')).toLowerCase();
    return heu.includes(q);
  });
  if (!gefiltert.length) {
    c.innerHTML = '<div class="sl-leer">Keine Sitzung passt zur Suche.' +
      (archivZahl && !ui.archivAnzeigen ? '<br>' + archivZahl + ' im Archiv (oben einblenden).' : '') + '</div>';
    return;
  }
  /* Entwürfe ohne Termin stehen ganz oben – sonst verschwänden sie im Jahr ihrer Anlage. */
  const ohneTermin = gefiltert.filter(s => !s.datum)
    .sort((a, b) => (b.angelegtAm || '').localeCompare(a.angelegtAm || ''));
  const mitTermin = gefiltert.filter(s => s.datum)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const gruppen = ohneTermin.length ? [{ jahr: 'Ohne Termin', items: ohneTermin }] : [];
  for (const s of mitTermin) {
    const j = jahrAus(s.datum);
    if (!gruppen.length || gruppen[gruppen.length - 1].jahr !== j) gruppen.push({ jahr: j, items: [] });
    gruppen[gruppen.length - 1].items.push(s);
  }
  c.innerHTML = gruppen.map(g =>
    '<div class="sl-jahr">' + g.jahr + '</div>' + g.items.map(sitzungKarteHtml).join('')
  ).join('');
  c.querySelectorAll('.sitzung-karte').forEach(el => el.onclick = () => {
    ui.sitzungId = el.dataset.id;
    ui.ansicht = 'sitzung';
    renderAlles();
  });
}

/* Hauptbereich */

function renderAlles() { renderSeitenleiste(); renderSitzungsstand(); renderHaupt(); }

/* Urlaubskalender: Sitzungstermine liegen im selben Raster, damit Kollisionen ohne Suche sichtbar sind. */
/* Kurzform „Erika M." für die Tageszellen; volle Namen stehen im Titel/in der Liste. */
function urlaubKurzname(name) {
  const teile = String(name || '').trim().split(/\s+/);
  if (teile.length < 2) return teile[0] || '';
  return teile[0] + ' ' + teile[teile.length - 1].charAt(0) + '.';
}

function renderUrlaubAnsicht(c) {
  const heute = heuteIso();
  if (!ui.urlaubMonat) ui.urlaubMonat = heute.slice(0, 7);
  const k = urlaubKalender(daten, ui.urlaubMonat, heute);
  if (!k) { ui.urlaubMonat = heute.slice(0, 7); return renderUrlaubAnsicht(c); }

  const alle = urlaubNormieren(daten.urlaub);
  const kommend = alle.filter(e => e.bis >= heute);

  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<h2>Urlaubskalender</h2>' +
      '<div class="kopf-kennung">Abwesenheiten des Gremiums</div></div>' +
      '<div class="kopf-aktionen">' +
        '<div class="kal-nav">' +
          '<button class="btn btn-symbol" id="kalZurueck" title="Vorheriger Monat" aria-label="Vorheriger Monat"><svg class="ic"><use href="#ic-links"/></svg></button>' +
          '<span class="kal-monat">' + esc(k.monatName) + ' ' + k.jahr + '</span>' +
          '<button class="btn btn-symbol" id="kalVor" title="Nächster Monat" aria-label="Nächster Monat"><svg class="ic"><use href="#ic-rechts"/></svg></button>' +
        '</div>' +
        '<button class="btn" id="kalHeute">Heute</button>' +
      '</div></div>' +

    (!alle.length
      ? '<div class="karte"><div class="karte-koerper klein-grau">Noch keine Abwesenheiten erfasst. ' +
        'Die Mitglieder melden ihre Zeiträume mit <b>br-urlaub-melden.html</b>; die Meldungen werden unter ' +
        '„Admin-Menü" → „Urlaub" eingelesen.</div></div>'
      : '') +

    '<div class="karte"><div class="karte-koerper">' +
      '<div class="kal-raster">' +
        ['Mo','Di','Mi','Do','Fr','Sa','So'].map(t => '<div class="kal-kopf">' + t + '</div>').join('') +
        k.wochen.map(w => w.map(t => {
          const kl = ['kal-tag'];
          if (!t.imMonat) kl.push('fremd');
          if (t.wochenende) kl.push('we');
          if (t.heute) kl.push('heute');
          if (t.sitzungen.length) kl.push('sitzung');
          return '<div class="' + kl.join(' ') + '">' +
            '<div class="kal-zahl">' + t.tag + '</div>' +
            t.sitzungen.map(s => '<div class="kal-sitzung" title="' + esc('Sitzung Nr. ' + s.nr) + '">Sitzung ' + esc(s.nr) + '</div>').join('') +
            t.abwesend.map(e => '<div class="kal-weg" title="' + esc(e.name + ' · ' + e.grund + ' · ' +
              fmtDatum(e.von) + ' bis ' + fmtDatum(e.bis)) + '">' + esc(urlaubKurzname(e.name)) + '</div>').join('') +
          '</div>';
        }).join('')).join('') +
      '</div>' +
      '<div class="kal-legende">' +
        '<span><i class="lg-sitzung"></i>Sitzungstermin</span>' +
        '<span><i class="lg-weg"></i>Abwesend</span>' +
        '<span><i class="lg-heute"></i>Heute</span>' +
      '</div>' +
    '</div></div>' +

    (kommend.length
      ? '<div class="karte"><div class="karte-kopf"><h3>Kommende Abwesenheiten</h3></div>' +
        '<div class="karte-koerper"><table class="tn-tabelle"><thead><tr>' +
        '<th style="width:34%">Person</th><th style="width:30%">Zeitraum</th><th style="width:12%">Tage</th><th>Grund</th>' +
        '</tr></thead><tbody>' +
        kommend.map(e => {
          const tage = Math.round((new Date(e.bis) - new Date(e.von)) / 86400000) + 1;
          const laeuft = e.von <= heute;
          return '<tr><td><b>' + esc(e.name) + '</b>' +
            (laeuft ? ' <span class="kal-jetzt">läuft</span>' : '') + '</td>' +
            '<td>' + esc(fmtDatum(e.von)) + ' – ' + esc(fmtDatum(e.bis)) + '</td>' +
            '<td class="mono">' + tage + '</td>' +
            '<td>' + esc(e.grund) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="klein-grau" style="margin-top:8px">Vergangene Zeiträume sind ausgeblendet; im Kalender oben sind sie weiterhin sichtbar.</p>' +
        '</div></div>'
      : '');

  c.querySelector('#kalZurueck').onclick = () => { ui.urlaubMonat = monatVerschieben(ui.urlaubMonat, -1); renderHaupt(); };
  c.querySelector('#kalVor').onclick = () => { ui.urlaubMonat = monatVerschieben(ui.urlaubMonat, 1); renderHaupt(); };
  c.querySelector('#kalHeute').onclick = () => { ui.urlaubMonat = heute.slice(0, 7); renderHaupt(); };
}

/* Sitzungsstand: nur im Protokollmodul, dauerhaft sichtbar (Beschlussfähigkeit, Fortschritt, Pause – sonst weggescrollt). */
function renderSitzungsstand() {
  const c = document.getElementById('sitzungsstand');
  if (!c) return;
  if (APP_MODUS !== 'protokoll' || !daten) { c.innerHTML = ''; return; }
  const s = aktSitzung();
  if (!s) {
    c.innerHTML = '<div class="sl-sektion">Sitzungsstand</div>' +
      '<p class="st-leer">Keine Sitzung geöffnet. Übernimm eine Tagesordnung aus dem Sitzungsmanager.</p>';
    return;
  }
  const q = quorumInfo(daten, s);
  const f = protokollFortschritt(s);
  const anteil = f.punkte ? Math.round(f.erledigt / f.punkte * 100) : 0;

  const ampel = !q.groesse ? { kl: 'offen', text: 'Gremiumgröße fehlt', unter: 'In den Stammdaten hinterlegen' }
    : !q.erfasst ? { kl: 'offen', text: 'Anwesenheit offen', unter: 'Noch niemand erfasst' }
    : q.beschlussfaehig ? { kl: 'ok', text: 'Beschlussfähig', unter: q.teilnehmend + ' von ' + q.groesse + ' · mindestens ' + q.erforderlich }
    : { kl: 'nein', text: 'Nicht beschlussfähig', unter: q.teilnehmend + ' von ' + q.groesse + ' · mindestens ' + q.erforderlich };

  c.innerHTML =
    '<div class="sl-sektion">Sitzungsstand</div>' +
    '<div class="st-block">' +
      '<div class="st-ampel ' + ampel.kl + '"><span class="st-punkt"></span>' + esc(ampel.text) + '</div>' +
      '<div class="st-unter">' + esc(ampel.unter) + '</div>' +

      '<div class="st-zeile"><span>Protokolliert</span><b>' + f.erledigt + ' / ' + f.punkte + '</b></div>' +
      '<div class="st-balken" role="img" aria-label="' + anteil + ' Prozent der Punkte protokolliert">' +
        '<span style="transform:scaleX(' + (anteil / 100) + ')"></span></div>' +

      '<div class="st-zahlen">' +
        '<div><b>' + f.beschluesse + '</b><span>Beschlüsse</span></div>' +
        '<div><b>' + f.aufgaben + '</b><span>Aufgaben</span></div>' +
        '<div><b>' + (s.gaeste || []).length + '</b><span>Gäste</span></div>' +
      '</div>' +

      (f.pause ? '<div class="st-pause"><svg class="ic"><use href="#ic-pause"/></svg>Sitzung unterbrochen</div>' : '') +
    '</div>';
}

/* Ansicht → Knopf; Sichtbarkeit steuert aktualisiereRollenUi mit MODUS_ANSICHTEN (br-kern.js). */
const NAV_KNOEPFE = { beschluesse: 'btnBeschluesse', aufgaben: 'btnAufgaben',
                      dokumente: 'btnDokumente', urlaub: 'btnUrlaub', stammdaten: 'btnStammdaten' };

function aktualisiereNavUi() {
  const zu = { beschluesse: 'btnBeschluesse', aufgaben: 'btnAufgaben', dokumente: 'btnDokumente', urlaub: 'btnUrlaub' };
  for (const [ansicht, id] of Object.entries(zu)) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('aktiv', ui.ansicht === ansicht);
  }
}

/* Ein-/Ausklappen von TOP-Blöcken: Zustand lebt nur im Arbeitsspeicher, wird nicht persistiert. */
function klappSchluessel(top) { return ui.tab + ':' + (top.id || ''); }
function klappButtonHtml(top) {
  const zu = ui.zugeklappt.has(klappSchluessel(top));
  return '<button type="button" class="btn btn-symbol btn-geist klapp-btn" data-klapp ' +
    'title="' + (zu ? 'Aufklappen' : 'Zuklappen') + '" aria-expanded="' + (zu ? 'false' : 'true') + '">' +
    '<svg class="ic"><use href="#ic-chevron"/></svg></button>';
}
function klappVerdrahten(wrap, top) {
  if (ui.zugeklappt.has(klappSchluessel(top))) wrap.classList.add('zu');
  const btn = wrap.querySelector('[data-klapp]');
  if (!btn) return;
  btn.onclick = () => {
    const k = klappSchluessel(top);
    if (ui.zugeklappt.has(k)) ui.zugeklappt.delete(k); else ui.zugeklappt.add(k);
    wrap.classList.toggle('zu');
    const zu = wrap.classList.contains('zu');
    btn.title = zu ? 'Aufklappen' : 'Zuklappen';
    btn.setAttribute('aria-expanded', zu ? 'false' : 'true');
  };
}

/* Protokollstand eines TOP für die Stand-Punkte in Sprungleiste und Inhaltsverzeichnis. */
function topStand(t) {
  const f = protokollFortschritt({ tops: [t] });
  const fertig = f.erledigt === f.punkte, angefangen = f.erledigt > 0;
  return { klasse: 'ts-punkt' + (fertig ? ' voll' : angefangen ? ' teil' : ''),
    text: fertig ? 'protokolliert' : angefangen ? 'teilweise protokolliert' : 'noch nichts erfasst' };
}
const topChipTitel = (t, i) => (t.titel || 'TOP ' + (i + 1)) + ' – ' + topStand(t).text;

/* Sprungleiste „TOP 1 … n" (ab vier Punkten). Mit `mitStand` (Protokoll-Reiter) zeigt ein Punkt je Chip, ob dazu schon protokolliert wurde. */
function topSprungleisteHtml(s, mitStand) {
  if ((s.tops || []).length < 4) return '';
  return '<div class="top-sprung' + (mitStand ? ' mit-stand' : '') + '">' + s.tops.map((t, i) => {
    const punkt = mitStand ? '<span class="' + topStand(t).klasse + '"></span>' : '';
    return '<button type="button" class="ts-chip" data-ziel="' + esc(t.id) + '" title="' +
      esc(mitStand ? topChipTitel(t, i) : t.titel || 'TOP ' + (i + 1)) + '">' + punkt +
      'TOP ' + (i + 1) + (t.titel ? ' · ' + esc(t.titel.length > 22 ? t.titel.slice(0, 22) + '…' : t.titel) : '') + '</button>';
  }).join('') + '</div>';
}
function topSprungleisteVerdrahten(c) {
  c.querySelectorAll('.top-sprung .ts-chip').forEach(chip => chip.onclick = () => {
    const ziel = c.querySelector('[data-topanker="' + chip.dataset.ziel + '"]');
    if (ziel) ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* Copyright-Vermerk steht statisch in der HTML (.sl-copyright), wird nicht mehr zur Laufzeit gesetzt. */

function renderHaupt() {
  const c = document.getElementById('hauptInhalt');
  aktualisiereNavUi();
  /* Aus einer Sicherung kann eine Ansicht gesetzt sein, die diese Betriebsart nicht führt. */
  if (ui.ansicht !== 'sitzung' && !modusHatAnsicht(ui.ansicht)) ui.ansicht = 'sitzung';
  if (ui.ansicht === 'beschluesse') { renderBeschlussUebersicht(c); return; }
  if (ui.ansicht === 'aufgaben') { renderAufgabenUebersicht(c); return; }
  if (ui.ansicht === 'urlaub') { renderUrlaubAnsicht(c); return; }
  if (ui.ansicht === 'dokumente') { renderDokumente(c); return; }
  const s = aktSitzung();
  if (!s) { renderLeerzustand(c); return; }

  const anzTops = (s.tops || []).length;
  const anzBeschl = sitzungBeschlussZahl(s);
  /* Aus einer Sicherung o. Ä. kann ein Reiter gesetzt sein, den diese Datei nicht führt. */
  if (!modusHatReiter(ui.tab)) ui.tab = modusStartReiter();
  const reiterLabel = { sitzung: 'Sitzung', tagesordnung: 'Tagesordnung', einladung: 'Einladung', protokoll: 'Protokoll', export: 'PDF-Export' };
  const reiterZahl = { tagesordnung: anzTops, protokoll: anzBeschl };
  /* Sitzung anlegen, duplizieren, archivieren und löschen bleibt der Sitzungsleitung. */
  const sitzungsAktionen = APP_MODUS === 'sitzung';
  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<h2>Betriebsratssitzung Nr. ' + esc(s.nr) + '</h2>' +
      '<div class="kopf-kennung"><span class="kennfeld">' + esc(SITZUNGSART_LABEL[s.art] || 'Sitzung') + '</span>' +
        (s.datum ? '<span>' + esc(fmtDatum(s.datum, true)) + '</span>' : '') + '</div></div>' +
      '<div class="kopf-aktionen">' +
        /* Freigabeschild steht im Kopf: Beschlussfähigkeit muss die erste Zeile beantworten. */
        '<span id="quorumKopf" class="quorum-kopf"></span>' +
        '<div class="feld" style="min-width:190px"><label for="kStatus">Status</label><select id="kStatus">' +
          Object.keys(STATUS_META).map(k => '<option value="' + k + '">' + STATUS_META[k].label + '</option>').join('') +
        '</select></div>' +
        (sitzungsAktionen
          ? '<button class="btn" id="kDuplizieren" title="Tagesordnung als neue Sitzung übernehmen">Duplizieren</button>' +
            '<button class="btn" id="kArchiv" title="Sitzung ins Archiv legen / daraus zurückholen">' + (s.archiviert ? 'Aus Archiv holen' : 'Archivieren') + '</button>' +
            '<button class="btn btn-geist btn-gefahr" id="kLoeschen">Löschen</button>'
          : '') +
      '</div></div>' +
    '<div class="tabs" role="tablist">' +
      modusReiter().map(id => tabKnopf(id, reiterLabel[id] || id, reiterZahl[id])).join('') +
    '</div>' +
    '<div id="tabInhalt"></div>';

  quorumAnzeigeSetzen(c.querySelector('#quorumKopf'), s, APP_MODUS !== 'protokoll', true);

  const stSel = c.querySelector('#kStatus');
  stSel.value = s.status || 'entwurf';
  stSel.disabled = !darfBearbeiten();
  stSel.onchange = () => { s.status = stSel.value; speichern(); renderSeitenleiste(); };
  if (sitzungsAktionen) {
    c.querySelector('#kDuplizieren').onclick = () => sitzungDuplizieren(s);
    c.querySelector('#kArchiv').onclick = () => {
      s.archiviert = !s.archiviert;
      if (s.archiviert && !ui.archivAnzeigen) ui.archivAnzeigen = true;
      speichern(); renderAlles();
      zeigeToast(s.archiviert ? 'Sitzung ins Archiv gelegt.' : 'Sitzung aus dem Archiv geholt.', 'erfolg');
    };
    c.querySelector('#kLoeschen').onclick = () => bestaetigen('Sitzung löschen?',
      'Die Sitzung Nr. ' + s.nr + ' wird mit Tagesordnung, Protokoll und allen Anlagen endgültig entfernt.',
      () => { const wegId = s.id; daten.sitzungen = daten.sitzungen.filter(x => x.id !== wegId); ui.sitzungId = daten.sitzungen[0] ? daten.sitzungen[0].id : null; dirtySitzungen.delete(wegId); Speicher.sitzungLoeschen(wegId).catch(() => {}); speichern(true); renderAlles(); },
      'Endgültig löschen', true);
  }
  c.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    const stelle = aktuelleStelle();
    ui.tab = b.dataset.tab; renderHaupt();
    if (stelle) springeZuStelle(stelle);
  });

  renderTab(c.querySelector('#tabInhalt'), s);
}

/* Reiterwechsel Tagesordnung ↔ Protokoll: dort weiter, wo man war. Maßgeblich ist der TOP bzw. Unterpunkt, der oben
   unter der Reiterleiste steht (wie die Markierung im Inhaltsverzeichnis). Ganz oben auf der Seite: kein Sprung. */
function aktuelleStelle() {
  let stelle = null;
  document.querySelectorAll('#tabInhalt [data-topanker], #tabInhalt [data-upanker]').forEach(el => {
    const id = el.dataset.upanker || el.dataset.topanker;
    if (id && el.offsetParent && el.getBoundingClientRect().top <= 100) stelle = { attr: el.dataset.upanker ? 'data-upanker' : 'data-topanker', id };
  });
  return stelle;
}
function springeZuStelle(stelle) {
  let ziel = document.querySelector('#tabInhalt [' + stelle.attr + '="' + CSS.escape(stelle.id) + '"]');
  if (ziel && !ziel.offsetParent) ziel = ziel.closest('.top-eintrag');   /* Unterpunkt in zugeklapptem TOP */
  if (ziel) ziel.scrollIntoView({ block: 'start' });
}

function tabKnopf(id, label, zahl) {
  return '<button role="tab" data-tab="' + id + '" class="' + (ui.tab === id ? 'aktiv' : '') + '">' + label +
    (zahl ? '<span class="tab-zahl">' + zahl + '</span>' : '') + '</button>';
}

function renderTab(c, s) {
  const tab = modusHatReiter(ui.tab) ? ui.tab : modusStartReiter();
  if (tab === 'tagesordnung') return renderTabTagesordnung(c, s);
  if (tab === 'einladung') return renderTabEinladung(c, s);
  if (tab === 'protokoll') return renderTabProtokoll(c, s);
  if (tab === 'export') return renderTabExport(c, s);
  return renderTabSitzung(c, s);
}

/* Beschluss-Übersicht (gremiumsweit) */

function beschlussUebersichtDaten() {
  return alleBeschluesse(daten).map(e => {
    const basis = abstimmungsBasis(daten, e.sitzung, e.b, e.top).teilnehmend;
    return { sitzung: e.sitzung, top: e.top, b: e.b, nr: e.nr, aus: beschlussAuswertung(e.b, basis) };
  }).sort((x, y) => {
    const dx = x.sitzung.datum || x.sitzung.angelegtAm || '';
    const dy = y.sitzung.datum || y.sitzung.angelegtAm || '';
    if (dx !== dy) return dy.localeCompare(dx);
    return (Number(x.b.lfd) || 0) - (Number(y.b.lfd) || 0);
  });
}

function renderBeschlussUebersicht(c) {
  const alle = beschlussUebersichtDaten();
  const jahre = Array.from(new Set(alle.map(e => e.b.jahr).filter(Boolean))).sort((a, b) => b - a);
  const f = ui.beschlussFilter;

  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<h2>Beschlüsse</h2>' +
      '<div class="kopf-kennung">Gremiumsweite Übersicht</div></div>' +
      '<div class="kopf-aktionen">' +
        '<button class="btn" id="buCsv">CSV exportieren</button>' +
        '<button class="btn btn-primaer" id="buPdf">Als PDF</button>' +
      '</div></div>' +
    '<div class="karte"><div class="karte-koerper">' +
      '<div class="raster filter">' +
        '<div class="feld"><label for="buJahr">Jahr</label><select id="buJahr"><option value="">Alle Jahre</option>' +
          jahre.map(j => '<option value="' + j + '">' + j + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="buErg">Ergebnis</label><select id="buErg">' +
          '<option value="">Alle</option><option value="angenommen">Angenommen</option><option value="abgelehnt">Abgelehnt</option></select></div>' +
        '<div class="feld"><label for="buStatus">Status</label><select id="buStatus"><option value="">Alle</option>' +
          Object.keys(BESCHLUSS_STATUS).map(k => '<option value="' + k + '">' + BESCHLUSS_STATUS[k] + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="buTag">Tag</label><select id="buTag"><option value="">Alle Tags</option>' +
          (daten.beschlussTags || []).map(t => '<option value="' + t.id + '">' + esc(t.name || 'Tag') + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="buVon">Von (Datum)</label><input id="buVon" type="date"></div>' +
        '<div class="feld"><label for="buBis">Bis (Datum)</label><input id="buBis" type="date"></div>' +
        '<div class="feld"><label for="buSuche">Suche (Antrag, TOP, Sitzung)</label><input id="buSuche" type="search" placeholder="Stichwort …"></div>' +
      '</div>' +
    '</div></div>' +
    '<div id="buSumme" class="klein-grau" style="margin:2px 2px 10px"></div>' +
    '<div id="buTabelle"></div>';

  const jSel = c.querySelector('#buJahr'); jSel.value = f.jahr || '';
  const eSel = c.querySelector('#buErg'); eSel.value = f.ergebnis || '';
  const stSel = c.querySelector('#buStatus'); stSel.value = f.status || '';
  const tSel = c.querySelector('#buTag'); tSel.value = f.tag || '';
  const vonInp = c.querySelector('#buVon'); vonInp.value = f.vonDatum || '';
  const bisInp = c.querySelector('#buBis'); bisInp.value = f.bisDatum || '';
  const sInp = c.querySelector('#buSuche'); sInp.value = f.suche || '';

  const gefiltert = () => alle.filter(e => {
    if (f.jahr && String(e.b.jahr) !== String(f.jahr)) return false;
    if (f.vonDatum || f.bisDatum) {
      const d = e.sitzung.datum || e.sitzung.angelegtAm || '';
      if (!d) return false;
      if (f.vonDatum && d < f.vonDatum) return false;
      if (f.bisDatum && d > f.bisDatum) return false;
    }
    if (f.ergebnis === 'angenommen' && !e.aus.angenommen) return false;
    if (f.ergebnis === 'abgelehnt' && e.aus.angenommen) return false;
    if (f.status && (e.b.status || 'in_arbeit') !== f.status) return false;
    if (f.tag && !((e.b.tags || []).includes(f.tag))) return false;
    if (f.suche) {
      const heu = ((e.b.antrag || '') + ' ' + (e.top.titel || '') + ' ' + (e.sitzung.nr || '')).toLowerCase();
      if (!heu.includes(f.suche.toLowerCase())) return false;
    }
    return true;
  });

  const zeichne = () => {
    const rows = gefiltert();
    const tab = c.querySelector('#buTabelle');
    const summe = c.querySelector('#buSumme');
    const ang = rows.filter(e => e.aus.angenommen).length;
    summe.textContent = rows.length
      ? rows.length + ' Beschluss/Beschlüsse · ' + ang + ' angenommen · ' + (rows.length - ang) + ' abgelehnt'
      : '';
    if (!alle.length) {
      tab.innerHTML = '<div class="karte"><div class="karte-koerper klein-grau">Noch keine Beschlüsse erfasst. Beschlüsse entstehen im Reiter „Protokoll" einer Sitzung.</div></div>';
      return;
    }
    if (!rows.length) {
      tab.innerHTML = '<div class="karte"><div class="karte-koerper klein-grau">Kein Beschluss passt zu den gewählten Filtern.</div></div>';
      return;
    }
    tab.innerHTML = '<table class="beschluss-tabelle"><thead><tr>' +
      '<th style="width:7%">Nr.</th><th style="width:9%">Datum</th><th style="width:7%">Sitzung</th>' +
      '<th>Antrag / TOP</th><th style="width:12%">Tags</th><th style="width:10%">Ergebnis</th><th style="width:11%">Status</th><th style="width:12%">Ja / Nein / Enth.</th></tr></thead><tbody>' +
      rows.map((e, i) => {
        const kl = e.aus.angenommen ? 'st-gruen' : 'st-rot';
        const label = e.aus.angenommen ? 'Angenommen' : 'Abgelehnt';
        const stStatus = e.b.status || 'in_arbeit';
        const stKl = BESCHLUSS_STATUS_KL[stStatus] || 'st-grau';
        const statusZelle = darfBearbeiten()
          ? '<select data-status class="ampel-select ' + stKl + '">' +
              Object.keys(BESCHLUSS_STATUS).map(k => '<option value="' + k + '"' + (k === stStatus ? ' selected' : '') + '>' + BESCHLUSS_STATUS[k] + '</option>').join('') +
            '</select>'
          : '<span class="ampel ' + stKl + '">' + esc(BESCHLUSS_STATUS[stStatus] || BESCHLUSS_STATUS.in_arbeit) + '</span>';
        const tagChips = beschlussTagObjekte(e.b).map(t => '<span class="tag-chip an" style="background:' + t.farbe + ';border-color:' + t.farbe + '">' + esc(t.name || 'Tag') + '</span>').join(' ');
        return '<tr data-sid="' + e.sitzung.id + '" data-ri="' + i + '" title="Zum Protokoll dieser Sitzung">' +
          '<td class="mono">' + esc(beschlussNrText(e.b)) + '</td>' +
          '<td>' + (e.sitzung.datum ? esc(fmtDatum(e.sitzung.datum)) : '–') + '</td>' +
          '<td>' + esc(e.sitzung.nr || '') + '</td>' +
          '<td><div class="bu-antrag">' + esc(e.b.antrag || '(kein Wortlaut erfasst)') + '</div>' +
            (e.top.titel ? '<div class="klein-grau">TOP ' + esc(e.nr) + ': ' + esc(e.top.titel) + '</div>' : '') + '</td>' +
          '<td><div class="tag-chips">' + tagChips + '</div></td>' +
          '<td><span class="ampel ' + kl + '">' + label + '</span>' + (e.aus.manuell ? '<div class="klein-grau">manuell</div>' : '') + '</td>' +
          '<td>' + statusZelle + '</td>' +
          '<td class="mono">' + e.aus.ja + ' / ' + e.aus.nein + ' / ' + e.aus.enth + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
    tab.querySelectorAll('tr[data-sid]').forEach(tr => {
      tr.onclick = () => {
        ui.sitzungId = tr.dataset.sid; ui.ansicht = 'sitzung';
        /* Sitzungsmanager führt keinen Protokoll-Reiter – dort zur Tagesordnung. */
        ui.tab = modusHatReiter('protokoll') ? 'protokoll' : 'tagesordnung';
        renderAlles();
      };
      const sel = tr.querySelector('select[data-status]');
      if (sel) {
        const e = rows[parseInt(tr.dataset.ri, 10)];
        sel.onclick = ev => ev.stopPropagation();
        sel.onchange = ev => {
          ev.stopPropagation();
          e.b.status = sel.value;
          dirtySitzungen.add(e.sitzung.id);
          speichern();
          sel.className = 'ampel-select ' + (BESCHLUSS_STATUS_KL[sel.value] || 'st-grau');
        };
      }
    });
  };
  zeichne();

  jSel.onchange = () => { f.jahr = jSel.value; zeichne(); };
  eSel.onchange = () => { f.ergebnis = eSel.value; zeichne(); };
  stSel.onchange = () => { f.status = stSel.value; zeichne(); };
  tSel.onchange = () => { f.tag = tSel.value; zeichne(); };
  vonInp.onchange = () => { f.vonDatum = vonInp.value; zeichne(); };
  bisInp.onchange = () => { f.bisDatum = bisInp.value; zeichne(); };
  sInp.oninput = () => { f.suche = sInp.value; zeichne(); };

  c.querySelector('#buCsv').onclick = () => beschluesseCsvExport(gefiltert());
  c.querySelector('#buPdf').onclick = ev => beschluessePdfExport(ev.currentTarget, gefiltert());
}

function beschluesseCsvExport(rows) {
  const z = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const kopf = ['Nr', 'Datum', 'Sitzung', 'Antrag', 'TOP', 'Tags', 'Ergebnis', 'Status', 'Ja', 'Nein', 'Enthaltungen'];
  const zeilen = rows.map(e => [
    beschlussNrText(e.b), e.sitzung.datum ? fmtDatum(e.sitzung.datum) : '', e.sitzung.nr || '',
    e.b.antrag || '', (e.top.titel ? e.nr + ' ' + e.top.titel : e.nr), beschlussTagObjekte(e.b).map(t => t.name).join(', '),
    e.aus.angenommen ? 'Angenommen' : 'Abgelehnt', BESCHLUSS_STATUS[e.b.status] || BESCHLUSS_STATUS.in_arbeit, e.aus.ja, e.aus.nein, e.aus.enth
  ].map(z).join(';'));
  const csv = '﻿' + [kopf.map(z).join(';')].concat(zeilen).join('\r\n');
  const name = 'BR-Beschluesse' + (daten.stammdaten.firma ? '_' + daten.stammdaten.firma.replace(/[^\wäöüÄÖÜß-]+/g, '-') : '') + '_' + heuteIso() + '.csv';
  dateiHerunterladen(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
  zeigeToast(rows.length + ' Beschluss/Beschlüsse als CSV exportiert.', 'erfolg');
}

async function beschluessePdfExport(btn, rows) {
  const alt = btn.textContent;
  btn.disabled = true; btn.textContent = 'PDF wird erstellt …';
  try {
    const bytes = await erzeugeBeschlussUebersichtPdf(daten, rows, { vertraulich: !!daten.stammdaten.vertraulich });
    const name = 'BR-Beschluesse' + (daten.stammdaten.firma ? '_' + daten.stammdaten.firma.replace(/[^\wäöüÄÖÜß-]+/g, '-') : '') + '_' + heuteIso() + '.pdf';
    dateiHerunterladen(new Blob([bytes], { type: 'application/pdf' }), name);
    zeigeToast(name + ' wurde erzeugt.', 'erfolg');
  } catch (e) {
    console.error(e);
    zeigeToast('PDF konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  } finally {
    btn.disabled = false; btn.textContent = alt;
  }
}

async function erzeugeBeschlussUebersichtPdf(daten, rows, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Beschlussübersicht' },
    { links: 'Beschlussübersicht · ' + (st.gremium || 'Betriebsrat'), vertraulich: !!opt.vertraulich });
  b.neueSeite();
  briefkopf(b, daten, logo, true);
  b.ueberschrift('Beschlussübersicht', 1);
  b.absatz('Alle erfassten Beschlüsse des Gremiums · Stand ' + fmtDatum(heuteIso()) + ' · ' + rows.length + ' Beschluss/Beschlüsse.',
    { size: 10, farbe: b.c.grau, abstandDanach: 8 });
  if (rows.length) {
    b.tabelle({
      spalten: [
        { titel: 'Nr.', anteil: 0.10, nowrap: true },
        { titel: 'Datum', anteil: 0.13, nowrap: true },
        { titel: 'Sitzung', anteil: 0.09, nowrap: true },
        { titel: 'Antrag / TOP', anteil: 0.29 },
        { titel: 'Ergebnis', anteil: 0.15, fett: true, nowrap: true },
        { titel: 'Status', anteil: 0.11, nowrap: true },
        { titel: 'Ja/Nein/Enth.', anteil: 0.13, align: 'right', nowrap: true }
      ],
      zeilen: rows.map(e => [
        beschlussNrText(e.b),
        e.sitzung.datum ? fmtDatum(e.sitzung.datum) : '–',
        e.sitzung.nr || '',
        (e.b.antrag || '(kein Wortlaut erfasst)') + (e.top.titel ? '  ·  TOP ' + e.nr + ': ' + e.top.titel : '') +
          (beschlussTagObjekte(e.b).length ? '  ·  Tags: ' + beschlussTagObjekte(e.b).map(t => t.name).join(', ') : ''),
        e.aus.angenommen ? 'Angenommen' : 'Abgelehnt',
        BESCHLUSS_STATUS[e.b.status] || BESCHLUSS_STATUS.in_arbeit,
        e.aus.ja + '/' + e.aus.nein + '/' + e.aus.enth
      ]),
      gitter: true, size: 9
    });
  } else {
    b.absatz('Es sind keine Beschlüsse erfasst.', { farbe: b.c.grau });
  }
  b.abschliessen();
  return doc.save();
}

/* Aufgaben-Übersicht (gremiumsweit) */

function renderAufgabenUebersicht(c) {
  const alle = alleAufgabenGremium(daten);
  const jahre = Array.from(new Set(alle.map(e => jahrAus(e.sitzung.datum || e.sitzung.angelegtAm)).filter(Boolean))).sort((a, b) => b - a);
  const werte = Array.from(new Set(alle.map(e => (e.auf.wer || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const f = ui.aufgabenFilter;

  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<h2>Aufgaben</h2>' +
      '<div class="kopf-kennung">Gremiumsweite Übersicht</div></div>' +
      '<div class="kopf-aktionen">' +
        '<button class="btn" id="auCsv">CSV exportieren</button>' +
        '<button class="btn btn-primaer" id="auPdf">Als PDF</button>' +
      '</div></div>' +
    '<div class="karte"><div class="karte-koerper">' +
      '<div class="raster s3">' +
        '<div class="feld"><label for="auJahr">Jahr</label><select id="auJahr"><option value="">Alle Jahre</option>' +
          jahre.map(j => '<option value="' + j + '">' + j + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="auWer">Zuständig</label><select id="auWer"><option value="">Alle</option>' +
          werte.map(w => '<option value="' + esc(w) + '">' + esc(w) + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="auVon">Von (Datum)</label><input id="auVon" type="date"></div>' +
        '<div class="feld"><label for="auBis">Bis (Datum)</label><input id="auBis" type="date"></div>' +
        '<div class="feld"><label for="auSuche">Suche (Aufgabe, TOP, Sitzung)</label><input id="auSuche" type="search" placeholder="Stichwort …"></div>' +
      '</div>' +
    '</div></div>' +
    '<div id="auSumme" class="klein-grau" style="margin:2px 2px 10px"></div>' +
    '<div id="auTabelle"></div>';

  const jSel = c.querySelector('#auJahr'); jSel.value = f.jahr || '';
  const wSel = c.querySelector('#auWer'); wSel.value = f.wer || '';
  const vonInp = c.querySelector('#auVon'); vonInp.value = f.vonDatum || '';
  const bisInp = c.querySelector('#auBis'); bisInp.value = f.bisDatum || '';
  const sInp = c.querySelector('#auSuche'); sInp.value = f.suche || '';

  const gefiltert = () => alle.filter(e => {
    if (f.jahr && String(jahrAus(e.sitzung.datum || e.sitzung.angelegtAm)) !== String(f.jahr)) return false;
    if (f.vonDatum || f.bisDatum) {
      const d = e.sitzung.datum || e.sitzung.angelegtAm || '';
      if (!d) return false;
      if (f.vonDatum && d < f.vonDatum) return false;
      if (f.bisDatum && d > f.bisDatum) return false;
    }
    if (f.wer && (e.auf.wer || '').trim() !== f.wer) return false;
    if (f.suche) {
      const heu = ((e.auf.was || '') + ' ' + (e.auf.wer || '') + ' ' + (e.top.titel || '') + ' ' + (e.sitzung.nr || '')).toLowerCase();
      if (!heu.includes(f.suche.toLowerCase())) return false;
    }
    return true;
  });

  const zeichne = () => {
    const rows = gefiltert();
    const tab = c.querySelector('#auTabelle');
    c.querySelector('#auSumme').textContent = rows.length ? rows.length + ' Aufgabe(n)' : '';
    if (!alle.length) {
      tab.innerHTML = '<div class="karte"><div class="karte-koerper klein-grau">Noch keine Aufgaben erfasst. Aufgaben entstehen im Reiter „Protokoll" einer Sitzung (wer macht was bis wann).</div></div>';
      return;
    }
    if (!rows.length) {
      tab.innerHTML = '<div class="karte"><div class="karte-koerper klein-grau">Keine Aufgabe passt zu den gewählten Filtern.</div></div>';
      return;
    }
    tab.innerHTML = '<table class="beschluss-tabelle"><thead><tr>' +
      '<th style="width:10%">Datum</th><th style="width:8%">Sitzung</th><th style="width:7%">TOP</th>' +
      '<th>Aufgabe</th><th style="width:18%">Zuständig</th><th style="width:11%">Fällig</th><th style="width:11%">Status</th></tr></thead><tbody>' +
      rows.map((e, i) => {
        const auStatus = e.auf.status || 'offen';
        const stKl = AUFGABE_STATUS_KL[auStatus] || 'st-grau';
        const statusZelle = darfBearbeiten()
          ? '<select data-status class="ampel-select ' + stKl + '">' +
              Object.keys(AUFGABE_STATUS).map(k => '<option value="' + k + '"' + (k === auStatus ? ' selected' : '') + '>' + AUFGABE_STATUS[k] + '</option>').join('') +
            '</select>'
          : '<span class="ampel ' + stKl + '">' + esc(AUFGABE_STATUS[auStatus] || AUFGABE_STATUS.offen) + '</span>';
        return '<tr data-sid="' + e.sitzung.id + '" data-ri="' + i + '" title="Zum Protokoll dieser Sitzung">' +
          '<td>' + (e.sitzung.datum ? esc(fmtDatum(e.sitzung.datum)) : '–') + '</td>' +
          '<td>' + esc(e.sitzung.nr || '') + '</td>' +
          '<td class="mono">' + esc(e.nr) + '</td>' +
          '<td><div class="bu-antrag">' + esc(e.auf.was || '') + '</div>' +
            (e.top.titel ? '<div class="klein-grau">TOP ' + esc(e.nr) + ': ' + esc(e.top.titel) + '</div>' : '') + '</td>' +
          '<td>' + esc(e.auf.wer || '–') + '</td>' +
          '<td>' + (e.auf.bis ? esc(fmtDatum(e.auf.bis)) : '–') + '</td>' +
          '<td>' + statusZelle + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
    tab.querySelectorAll('tr[data-sid]').forEach(tr => {
      tr.onclick = () => {
        ui.sitzungId = tr.dataset.sid; ui.ansicht = 'sitzung';
        /* Sitzungsmanager führt keinen Protokoll-Reiter – dort zur Tagesordnung. */
        ui.tab = modusHatReiter('protokoll') ? 'protokoll' : 'tagesordnung';
        renderAlles();
      };
      const sel = tr.querySelector('select[data-status]');
      if (sel) {
        const e = rows[parseInt(tr.dataset.ri, 10)];
        sel.onclick = ev => ev.stopPropagation();
        sel.onchange = ev => {
          ev.stopPropagation();
          e.auf.status = sel.value;
          dirtySitzungen.add(e.sitzung.id);
          speichern();
          sel.className = 'ampel-select ' + (AUFGABE_STATUS_KL[sel.value] || 'st-grau');
        };
      }
    });
  };
  zeichne();

  jSel.onchange = () => { f.jahr = jSel.value; zeichne(); };
  wSel.onchange = () => { f.wer = wSel.value; zeichne(); };
  vonInp.onchange = () => { f.vonDatum = vonInp.value; zeichne(); };
  bisInp.onchange = () => { f.bisDatum = bisInp.value; zeichne(); };
  sInp.oninput = () => { f.suche = sInp.value; zeichne(); };
  c.querySelector('#auCsv').onclick = () => aufgabenCsvExport(gefiltert());
  c.querySelector('#auPdf').onclick = ev => aufgabenPdfExport(ev.currentTarget, gefiltert());
}

function aufgabenCsvExport(rows) {
  const z = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const kopf = ['Datum', 'Sitzung', 'TOP', 'Aufgabe', 'Zuständig', 'Fällig', 'Status'];
  const zeilen = rows.map(e => [
    e.sitzung.datum ? fmtDatum(e.sitzung.datum) : '', e.sitzung.nr || '', e.nr,
    e.auf.was || '', e.auf.wer || '', e.auf.bis ? fmtDatum(e.auf.bis) : '',
    AUFGABE_STATUS[e.auf.status] || AUFGABE_STATUS.offen
  ].map(z).join(';'));
  const csv = '﻿' + [kopf.map(z).join(';')].concat(zeilen).join('\r\n');
  const name = 'BR-Aufgaben' + (daten.stammdaten.firma ? '_' + daten.stammdaten.firma.replace(/[^\wäöüÄÖÜß-]+/g, '-') : '') + '_' + heuteIso() + '.csv';
  dateiHerunterladen(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
  zeigeToast(rows.length + ' Aufgabe(n) als CSV exportiert.', 'erfolg');
}

async function aufgabenPdfExport(btn, rows) {
  const alt = btn.textContent;
  btn.disabled = true; btn.textContent = 'PDF wird erstellt …';
  try {
    const bytes = await erzeugeAufgabenUebersichtPdf(daten, rows, { vertraulich: !!daten.stammdaten.vertraulich });
    const name = 'BR-Aufgaben' + (daten.stammdaten.firma ? '_' + daten.stammdaten.firma.replace(/[^\wäöüÄÖÜß-]+/g, '-') : '') + '_' + heuteIso() + '.pdf';
    dateiHerunterladen(new Blob([bytes], { type: 'application/pdf' }), name);
    zeigeToast(name + ' wurde erzeugt.', 'erfolg');
  } catch (e) {
    console.error(e);
    zeigeToast('PDF konnte nicht erstellt werden: ' + (e && e.message ? e.message : e), 'fehler');
  } finally {
    btn.disabled = false; btn.textContent = alt;
  }
}

async function erzeugeAufgabenUebersichtPdf(daten, rows, opt) {
  opt = opt || {};
  const st = daten.stammdaten;
  const { doc, fonts, farben } = await pdfGrundlagen(daten);
  const logo = await ladeLogo(doc, st);
  const b = new PdfBuilder(doc, fonts, farben,
    { links: [st.gremium || 'Betriebsrat', st.firma].filter(Boolean).join(' · '), rechts: 'Aufgabenübersicht' },
    { links: 'Aufgabenübersicht · ' + (st.gremium || 'Betriebsrat'), vertraulich: !!opt.vertraulich });
  b.neueSeite();
  briefkopf(b, daten, logo, true);
  b.ueberschrift('Aufgabenübersicht', 1);
  b.absatz('Alle offenen und erfassten Aufgaben des Gremiums · Stand ' + fmtDatum(heuteIso()) + ' · ' + rows.length + ' Aufgabe(n).',
    { size: 10, farbe: b.c.grau, abstandDanach: 8 });
  if (rows.length) {
    b.tabelle({
      spalten: [
        { titel: 'Datum', anteil: 0.12, nowrap: true },
        { titel: 'Sitzung', anteil: 0.10 },
        { titel: 'TOP', anteil: 0.07 },
        { titel: 'Aufgabe', anteil: 0.33 },
        { titel: 'Zuständig', anteil: 0.14, fett: true },
        { titel: 'Fällig', anteil: 0.12, align: 'right', nowrap: true },
        { titel: 'Status', anteil: 0.12 }
      ],
      zeilen: rows.map(e => [
        e.sitzung.datum ? fmtDatum(e.sitzung.datum) : '–',
        e.sitzung.nr || '',
        e.nr,
        e.auf.was || '',
        e.auf.wer || '–',
        e.auf.bis ? fmtDatum(e.auf.bis) : '–',
        AUFGABE_STATUS[e.auf.status] || AUFGABE_STATUS.offen
      ]),
      gitter: true, size: 9
    });
  } else {
    b.absatz('Es sind keine Aufgaben erfasst.', { farbe: b.c.grau });
  }
  b.abschliessen();
  return doc.save();
}

/* Dokumentenmanagement */

/* Vereinheitlichte Zeilen: Blob-Dokumente (Uploads/archivierte PDFs) und Sitzungs-Anlagen (Inline). */
function dokumenteAlleZeilen() {
  const zeilen = [];
  for (const d of (daten.dokumente || [])) {
    const s = d.sitzungId ? daten.sitzungen.find(x => x.id === d.sitzungId) : null;
    zeilen.push({
      art: 'dokument', name: d.name || 'Dokument', mime: d.mime || '', groesse: d.groesse || 0,
      kategorie: d.kategorie || 'sonstig', quelle: d.quelle === 'generiert' ? 'Erzeugt' : 'Hochgeladen',
      sitzungId: d.sitzungId || '', sitzungNr: s ? s.nr : '', datum: d.erstelltAm || '', ref: d
    });
  }
  const ausAnlage = (a, s, kategorie, quelleText, container) => zeilen.push({
    art: 'anlage', name: a.name || 'Anlage', mime: a.mime || '', groesse: a.size || 0,
    kategorie: kategorie, quelle: 'Anlage · ' + quelleText, sitzungId: s.id, sitzungNr: s.nr,
    datum: s.datum || s.angelegtAm || '', ref: { a: a, container: container }
  });
  for (const s of (daten.sitzungen || [])) {
    (s.tops || []).forEach((t, i) => {
      (t.anlagen || []).forEach(a => ausAnlage(a, s, 'anlage-to', 'TOP ' + (i + 1), t.anlagen));
      (t.unterpunkte || []).forEach((u, j) => (u.anlagen || []).forEach(a => ausAnlage(a, s, 'anlage-to', 'TOP ' + (i + 1) + '.' + (j + 1), u.anlagen)));
    });
    (s.anlagenTO || []).forEach(a => ausAnlage(a, s, 'anlage-to', 'Einladung', s.anlagenTO));
    (s.anlagenProt || []).forEach(a => ausAnlage(a, s, 'anlage-prot', 'Protokoll', s.anlagenProt));
  }
  return zeilen;
}

function dokumentOrdnerListe(alle) {
  const map = new Map();
  for (const z of alle) {
    const key = z.sitzungId || '__ohne';
    const e = map.get(key) || { anzahl: 0, groesse: 0 };
    e.anzahl++; e.groesse += (z.groesse || 0);
    map.set(key, e);
  }
  const ordner = [];
  daten.sitzungen.slice()
    .filter(s => map.has(s.id))
    .sort((a, b) => (b.datum || b.angelegtAm || '').localeCompare(a.datum || a.angelegtAm || ''))
    .forEach(s => {
      const e = map.get(s.id);
      ordner.push({ id: s.id, titel: 'Sitzung ' + s.nr, unter: s.datum ? fmtDatum(s.datum) : 'Termin offen', anzahl: e.anzahl, groesse: e.groesse });
    });
  if (map.has('__ohne')) {
    const e = map.get('__ohne');
    ordner.push({ id: '__ohne', titel: 'Allgemein', unter: 'ohne Sitzung', anzahl: e.anzahl, groesse: e.groesse });
  }
  return ordner;
}

function dokumentTabelleZeichnen(c, rows, neuZeichnen) {
  const laden = async z => z.art === 'dokument' ? await dokumentBytesLaden(z.ref.id) : await anlageBytes(z.ref.a);
  const tab = c.querySelector('#dokTabelle');
  const summe = c.querySelector('#dokSumme');
  const gesamt = rows.reduce((n, z) => n + (z.groesse || 0), 0);
  summe.textContent = rows.length ? rows.length + ' Dokument(e) · ' + fmtBytes(gesamt) : '';
  if (!rows.length) { tab.innerHTML = '<div class="karte"><div class="karte-koerper klein-grau">Kein Dokument passt zu den Filtern.</div></div>'; return; }
  tab.innerHTML = '<table class="beschluss-tabelle dok-tabelle"><thead><tr>' +
    '<th>Name</th><th style="width:18%">Kategorie</th><th style="width:17%">Quelle</th>' +
    '<th style="width:10%">Größe</th><th style="width:13%">Aktionen</th></tr></thead><tbody>' +
    rows.map((z, i) =>
      '<tr data-i="' + i + '">' +
        '<td><div class="bu-antrag">' + esc(z.name) + '</div>' + (z.datum ? '<div class="klein-grau">' + esc(fmtDatum(String(z.datum).slice(0, 10)) || '') + '</div>' : '') + '</td>' +
        '<td>' + esc(DOKUMENT_KATEGORIE[z.kategorie] || z.kategorie) + '</td>' +
        '<td>' + esc(z.quelle) + '</td>' +
        '<td class="mono">' + fmtBytes(z.groesse) + '</td>' +
        '<td class="dok-akt">' +
          '<button class="btn btn-symbol btn-geist" data-tu="ansehen" title="Ansehen">&#128065;</button>' +
          '<button class="btn btn-symbol btn-geist" data-tu="laden" title="Herunterladen">&#8681;</button>' +
          '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Löschen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</td>' +
      '</tr>').join('') + '</tbody></table>';
  tab.querySelectorAll('tr[data-i]').forEach(tr => {
    const z = rows[parseInt(tr.dataset.i, 10)];
    tr.querySelector('[data-tu="ansehen"]').onclick = async () => {
      const bytes = await laden(z);
      if (!bytes) return zeigeToast(anlageFehltMeldung(), 'fehler');
      const url = URL.createObjectURL(new Blob([bytes], { type: z.mime || 'application/octet-stream' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    tr.querySelector('[data-tu="laden"]').onclick = async () => {
      const bytes = await laden(z);
      if (!bytes) return zeigeToast(anlageFehltMeldung(), 'fehler');
      dateiHerunterladen(new Blob([bytes], { type: z.mime || 'application/octet-stream' }), z.name);
    };
    tr.querySelector('[data-tu="weg"]').onclick = () => bestaetigen('Dokument löschen?',
      (z.art === 'anlage' ? 'Die Anlage „' + z.name + '" wird aus der Sitzung entfernt.' : 'Das Dokument „' + z.name + '" wird gelöscht.'),
      async () => {
        if (z.art === 'dokument') { await dokumentEntfernen(z.ref.id); }
        else { const idx = z.ref.container.indexOf(z.ref.a); if (idx >= 0) z.ref.container.splice(idx, 1); speichern(); }
        neuZeichnen();
      }, 'Löschen', true);
  });
}

function renderDokumente(c) {
  const alle = dokumenteAlleZeilen();
  if (!ui.dokumentOrdner) return renderDokumenteUebersicht(c, alle);
  return renderDokumenteOrdner(c, alle);
}

function renderDokumenteUebersicht(c, alle) {
  const ordner = dokumentOrdnerListe(alle);
  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<h2>Dokumente</h2>' +
      '<div class="kopf-kennung">Dokumentenmanagement · Ordner je Sitzung</div></div>' +
      '<div class="kopf-aktionen">' +
        '<button class="btn btn-primaer" id="dokUpload">+ Dokument hochladen</button>' +
      '</div></div>' +
    (ordner.length
      ? '<div class="ordner-raster">' + ordner.map(o =>
          '<button class="ordner-kachel" data-ordner="' + esc(o.id) + '">' +
            '<div class="ok-symbol"><svg class="ic"><use href="#ic-doc"/></svg></div>' +
            '<div class="ok-titel">' + esc(o.titel) + '</div>' +
            '<div class="ok-unter">' + esc(o.unter) + '</div>' +
            '<div class="ok-meta">' + o.anzahl + ' Dokument(e) · ' + fmtBytes(o.groesse) + '</div>' +
          '</button>').join('') + '</div>'
      : '<div class="karte"><div class="karte-koerper klein-grau">Noch keine Dokumente. Laden Sie ein Dokument hoch oder erzeugen Sie ein PDF (wird automatisch archiviert).</div></div>');
  c.querySelectorAll('[data-ordner]').forEach(el => el.onclick = () => { ui.dokumentOrdner = el.dataset.ordner; ui.dokumentFilter.kategorie = ''; ui.dokumentFilter.suche = ''; renderHaupt(); });
  c.querySelector('#dokUpload').onclick = () => document.getElementById('dateiDokument').click();
}

function renderDokumenteOrdner(c, alle) {
  const ordner = ui.dokumentOrdner;
  const s = ordner !== '__ohne' ? daten.sitzungen.find(x => x.id === ordner) : null;
  if (ordner !== '__ohne' && !s) { ui.dokumentOrdner = null; return renderDokumente(c); }
  const titel = ordner === '__ohne' ? 'Allgemein' : ('Sitzung ' + s.nr + (s.datum ? ' · ' + fmtDatum(s.datum) : ''));
  const f = ui.dokumentFilter;
  const imOrdner = alle.filter(z => ordner === '__ohne' ? !z.sitzungId : z.sitzungId === ordner);

  c.innerHTML =
    '<div class="kopfzeile"><div>' +
      '<div class="kopf-zurueck"><button class="sperr-link" id="dokZurueck">← Alle Ordner</button></div>' +
      '<h2>' + esc(titel) + '</h2></div>' +
      '<div class="kopf-aktionen">' +
        '<button class="btn btn-primaer" id="dokUpload">+ Dokument in diesen Ordner</button>' +
      '</div></div>' +
    '<div class="karte"><div class="karte-koerper">' +
      '<div class="raster s2">' +
        '<div class="feld"><label for="dokKat">Kategorie</label><select id="dokKat"><option value="">Alle</option>' +
          Object.keys(DOKUMENT_KATEGORIE).map(k => '<option value="' + k + '">' + DOKUMENT_KATEGORIE[k] + '</option>').join('') + '</select></div>' +
        '<div class="feld"><label for="dokSuche">Suche (Dateiname)</label><input id="dokSuche" type="search" placeholder="Stichwort …"></div>' +
      '</div>' +
    '</div></div>' +
    '<div id="dokSumme" class="klein-grau" style="margin:2px 2px 10px"></div>' +
    '<div id="dokTabelle"></div>';

  const kSel = c.querySelector('#dokKat'); kSel.value = f.kategorie || '';
  const suche = c.querySelector('#dokSuche'); suche.value = f.suche || '';
  const gefiltert = () => imOrdner.filter(z => {
    if (f.kategorie && z.kategorie !== f.kategorie) return false;
    if (f.suche && !(z.name || '').toLowerCase().includes(f.suche.toLowerCase())) return false;
    return true;
  });
  const zeichne = () => dokumentTabelleZeichnen(c, gefiltert(), () => renderDokumente(c));
  zeichne();
  kSel.onchange = () => { f.kategorie = kSel.value; zeichne(); };
  suche.oninput = () => { f.suche = suche.value; zeichne(); };
  c.querySelector('#dokZurueck').onclick = () => { ui.dokumentOrdner = null; renderHaupt(); };
  c.querySelector('#dokUpload').onclick = () => document.getElementById('dateiDokument').click();
}

function renderLeerzustand(c) {
  c.innerHTML =
    '<div class="leerzustand"><div class="karte"><div class="karte-kopf"><h3>Willkommen</h3></div>' +
    '<div class="karte-koerper">' +
    '<h2 style="margin-bottom:8px">Tagesordnungen &amp; Protokolle für den Betriebsrat</h2>' +
    '<p class="klein-grau">Diese Anwendung läuft vollständig lokal im Browser – ohne Internetverbindung und ohne Server. ' +
    'Alle Eingaben werden automatisch in diesem Browser zwischengespeichert; für die dauerhafte Ablage sichere das Projekt als Datei (z. B. auf dem geschützten BR-Laufwerk).</p>' +
    '<div class="schritt"><div class="nr">1</div><div><b>Gremium &amp; Mitglieder im Admin-Menü erfassen</b><br><span class="klein-grau">Name des Gremiums, Firma, Gremiumgröße nach und die Mitgliederliste – daraus entstehen später Anwesenheitsliste und Unterschriftenfelder.</span></div></div>' +
    '<div class="schritt"><div class="nr">2</div><div><b>Sitzung anlegen &amp; Tagesordnung aufstellen</b><br><span class="klein-grau">Termin, Ort und Tagesordnungspunkte (inkl. Anlagen) erfassen – die Einladung nach entsteht daraus als PDF.</span></div></div>' +
    '<div class="schritt"><div class="nr">3</div><div><b>Protokollieren &amp; als PDF exportieren</b><br><span class="klein-grau">Anwesenheit, Beschlüsse im Wortlaut und Abstimmungsergebnisse festhalten – die Niederschrift inkl. Anwesenheitsliste und Anlagen wird als PDF erzeugt.</span></div></div>' +
    '<div class="hinweis"><b>Getrennte Speicherstände:</b> Die Sitzungsleitung plant in <b>BR-Sitzungsmanager.html</b>, die Schriftführung protokolliert in <b>BR-Protokoll.html</b>. Beide Module haben eine <b>eigene</b> Ablage und kommen sich nicht in die Quere. Eine geplante Sitzung wandert über <b>„Sitzung übergeben"</b> (links unten) als verschlüsselte Datei zur Gegenseite, die sie mit <b>„Sitzung übernehmen"</b> einliest. Der Browser-Zwischenstand liegt nur auf <i>diesem</i> PC – verlässlich ist die <b>verschlüsselte Sicherungsdatei</b> („Sichern (Datei)") auf dem BR-Laufwerk.</div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
    (adminMenueVerfuegbar() ? '<button class="btn btn-primaer btn-gross" id="lzStamm">Admin-Menü öffnen</button>' : '') +
    (APP_MODUS === 'sitzung' ? '<button class="btn btn-gross" id="lzNeu">Erste Sitzung anlegen</button>' : '') +
    '<button class="btn btn-gross' + (adminMenueVerfuegbar() ? '' : ' btn-primaer') + '" id="lzImport">' +
      esc(UEBERGABE_TEXT[uebergabeNimmt()].nehmen) + ' …</button>' +
    '</div>' +
    (APP_MODUS === 'protokoll' ? '<p class="klein-grau" style="margin-top:12px">Sitzungen legt die Sitzungsleitung in <b>BR-Sitzungsmanager.html</b> an und übergibt sie von dort. Die Tagesordnung lässt sich anschließend auch hier bearbeiten – etwa für in der Sitzung beschlossene Änderungen.</p>' : '') +
    '</div><div class="karte-fuss">Verschlüsselt in diesem Browser · Dauerhafte, gemeinsame Ablage: „Sichern (Datei)" auf dem BR-Laufwerk.</div></div>' +
    '<div class="fusszeile-app">' + (APP_MODUS === 'protokoll' ? 'BR-Protokoll' : 'BR-Sitzungsmanager') + ' · arbeitet vollständig offline</div></div>';
  const lzStamm = c.querySelector('#lzStamm');
  if (lzStamm) lzStamm.onclick = oeffneStammdaten;
  const lzNeu = c.querySelector('#lzNeu');
  if (lzNeu) lzNeu.onclick = sitzungAnlegen;
  c.querySelector('#lzImport').onclick = () => document.getElementById('dateiSitzung').click();
}

/* Sitzungsaktionen */

/* Übernimmt window.BR_STANDARD_TOPS (standard-tops.js), falls vorhanden und abweichend. */
function externeStandardTopsUebernehmen() {
  const ext = window.BR_STANDARD_TOPS;
  if (!Array.isArray(ext) || !ext.length) return false;
  const norm = ext.filter(t => t && t.titel).map(t => ({
    titel: String(t.titel).trim(), kategorie: kategorieOderLeer(t.kategorie),
    unterpunkte: standardUnterpunkteNorm(t.unterpunkte)
  }));
  if (!norm.length) return false;
  const sig = arr => (arr || []).map(t => (t.titel || '').trim() + '|' + (t.kategorie || '') +
    '|' + (t.unterpunkte || []).map(u => (u.titel || '').trim() + '·' + (u.kategorie || '')).join('␟')).join('\n');
  if (sig(norm) === sig(daten.standardTops)) return false;   /* bereits aktuell */
  daten.standardTops = norm.map(t => ({ id: uid(), titel: t.titel, kategorie: t.kategorie,
                                        unterpunkte: t.unterpunkte.map(u => ({ id: uid(), titel: u.titel, kategorie: u.kategorie })) }));
  return true;
}

/* Übernimmt window.BR_PROTOKOLL_VORLAGEN (protokoll_vorlagen.js), falls vorhanden und abweichend. */
function externeVorlagenUebernehmen() {
  const ext = window.BR_PROTOKOLL_VORLAGEN;
  if (!Array.isArray(ext) || !ext.length) return false;
  const norm = ext.filter(t => t && (t.titel || t.text)).map(t => ({
    titel: String(t.titel || '').trim(), text: String(t.text || '')
  }));
  if (!norm.length) return false;
  const sig = arr => (arr || []).map(t => (t.titel || '').trim() + '␟' + (t.text || '')).join('\n');
  if (sig(norm) === sig(daten.protokollVorlagen)) return false;   /* bereits aktuell */
  daten.protokollVorlagen = norm.map(t => ({ id: uid(), titel: t.titel, text: t.text }));
  return true;
}

/* Übernimmt window.BR_BESCHLUSS_VORLAGEN (beschluss_vorlagen.js), falls vorhanden und abweichend. */
function externeBeschlussVorlagenUebernehmen() {
  const ext = window.BR_BESCHLUSS_VORLAGEN;
  if (!Array.isArray(ext) || !ext.length) return false;
  const norm = ext.filter(t => t && (t.titel || t.text)).map(t => ({
    titel: String(t.titel || '').trim(), text: String(t.text || '')
  }));
  if (!norm.length) return false;
  const sig = arr => (arr || []).map(t => (t.titel || '').trim() + '␟' + (t.text || '')).join('\n');
  if (sig(norm) === sig(daten.beschlussVorlagen)) return false;   /* bereits aktuell */
  daten.beschlussVorlagen = norm.map(t => ({ id: uid(), titel: t.titel, text: t.text }));
  return true;
}

/* Übernimmt window.BR_URLAUB (urlaub.js): die Datei ist maßgeblich und überschreibt den in der App bearbeiteten Stand. */
function externeUrlaubUebernehmen() {
  const ext = window.BR_URLAUB;
  if (!Array.isArray(ext) || !ext.length) return false;
  const norm = urlaubNormieren(ext);
  if (!norm.length) return false;
  const sig = arr => (arr || []).map(e => e.name + '␟' + e.von + '␟' + e.bis + '␟' + e.grund).join('\n');
  if (sig(norm) === sig(urlaubNormieren(daten.urlaub))) return false;   /* bereits aktuell */
  daten.urlaub = norm.map(e => Object.assign({ id: uid() }, e));
  return true;
}

/* Urlaubsmeldungen (br-urlaub-melden.html, Format 'urlaub-v1'): eine Meldung ersetzt nur die Zeiträume ihrer Person. Bewusst ohne Passwort – daher läuft alles durch urlaubNormieren(). */
function urlaubMeldungLesen(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return { fehler: 'keine gültige JSON-Datei' }; }
  if (!d || d.format !== 'urlaub-v1') return { fehler: 'keine Urlaubsmeldung (erwartet: Datei aus br-urlaub-melden.html)' };
  const name = String(d.name || '').trim().replace(/\s+/g, ' ');
  if (!name) return { fehler: 'die Meldung nennt keinen Namen' };
  /* Der Name steht nur einmal oben in der Datei – auf die Einträge verteilen. */
  const eintraege = urlaubNormieren((Array.isArray(d.eintraege) ? d.eintraege : [])
    .map(e => Object.assign({}, e, { name: name })), true);
  return { name: name, eintraege: eintraege, gemeldetAm: d.gemeldetAm || '' };
}

/* Führt gelesene Meldungen zusammen. Liefert eine Bilanz für die Rückmeldung. */
function urlaubMeldungenZusammenfuehren(meldungen) {
  const bilanz = { personen: [], neu: 0, ersetzt: 0, ohne: [] };
  daten.urlaub = daten.urlaub || [];
  for (const m of meldungen) {
    const schluessel = urlaubNameSchluessel(m.name);
    const vorher = daten.urlaub.filter(e => urlaubNameSchluessel(e.name) === schluessel).length;
    daten.urlaub = daten.urlaub.filter(e => urlaubNameSchluessel(e.name) !== schluessel);
    daten.urlaub.push(...m.eintraege);
    bilanz.ersetzt += vorher;
    bilanz.neu += m.eintraege.length;
    bilanz.personen.push(m.name);
    /* Eine Meldung ohne Zeiträume ist die gültige Aussage „ich bin nicht abwesend". */
    if (!m.eintraege.length) bilanz.ohne.push(m.name);
  }
  daten.urlaub = urlaubNormieren(daten.urlaub, true);
  return bilanz;
}

/* Übernimmt window.BR_KATEGORIEN (category.js), falls vorhanden und abweichend. */
function externeKategorienUebernehmen() {
  const ext = window.BR_KATEGORIEN;
  if (!Array.isArray(ext) || !ext.length) return false;
  const gesehen = new Set();
  const norm = ext.filter(k => k && (k.key || k.label)).map(k => {
    const key = String(k.key || kategorieSchluessel(k.label, gesehen)).trim();
    gesehen.add(key);
    return { key: key, label: String(k.label || key).trim() };
  }).filter(k => k.key);
  if (!norm.length) return false;
  const sig = arr => (arr || []).map(k => (k.key || '') + '␟' + (k.label || '')).join('\n');
  if (sig(norm) === sig(daten.kategorien)) return false;   /* bereits aktuell */
  daten.kategorien = norm.map(k => ({ id: uid(), key: k.key, label: k.label }));
  return true;
}

function standardTopsEinfuegen(sitzung) {
  const vorhanden = new Set((sitzung.tops || []).map(t => (t.titel || '').trim().toLowerCase()));
  let eingefuegt = 0;
  (daten.standardTops || []).forEach(v => {
    const titel = (v.titel || '').trim();
    if (titel && !vorhanden.has(titel.toLowerCase())) {
      sitzung.tops.push(neuerTop({
        titel: titel,
        kategorie: kategorieOderLeer(v.kategorie),
        /* Eigene IDs je Sitzung – die Vorlagen-IDs dürfen nicht geteilt werden. */
        unterpunkte: (v.unterpunkte || []).map(u => neuerUnterpunkt({ titel: u.titel || '', kategorie: kategorieOderLeer(u.kategorie) }))
      }));
      vorhanden.add(titel.toLowerCase());
      eingefuegt++;
    }
  });
  return eingefuegt;
}

function sitzungAnlegen() {
  if (!darfBearbeiten()) return;
  const s = neueSitzung(daten);
  standardTopsEinfuegen(s);
  daten.sitzungen.push(s);
  ui.sitzungId = s.id;
  ui.tab = 'sitzung';
  ui.ansicht = 'sitzung';
  speichern();
  renderAlles();
}

function sitzungDuplizieren(quelle) {
  if (!darfBearbeiten()) return;
  const s = neueSitzung(daten);
  s.art = quelle.art;
  s.ort = quelle.ort;
  s.beginn = quelle.beginn;
  s.endeGeplant = quelle.endeGeplant;
  s.videokonferenz = quelle.videokonferenz;
  s.videoHinweis = quelle.videoHinweis;
  s.tops = (quelle.tops || []).map(t => neuerTop({
    titel: t.titel, kategorie: t.kategorie, beschreibung: t.beschreibung,
    referent: t.referent, dauer: t.dauer
  }));
  daten.sitzungen.push(s);
  ui.sitzungId = s.id;
  ui.tab = 'sitzung';
  ui.ansicht = 'sitzung';
  speichern();
  renderAlles();
  zeigeToast('Sitzung dupliziert – Tagesordnung übernommen (ohne Anlagen und Protokoll).');
}

/* Reiter „Sitzung" */

/* Wer ist laut urlaub.js abwesend – nur Personen aus den Stammdaten; Namen ohne Zuordnung meldet das Admin-Menü. */
function urlaubHinweisHtml(datum) {
  const d = String(datum || '').slice(0, 10);
  if (!d) return '';
  const betroffen = (daten.personen || [])
    .filter(p => p.aktiv !== false)
    .map(p => ({ p: p, u: abwesenheitVon(p.name, d) }))
    .filter(x => x.u);
  if (!betroffen.length) return '';
  const mitglieder = betroffen.filter(x => (x.p.gruppe || 'br') === 'br');
  return '<div class="hinweis warnung"><b>Urlaubskalender:</b> Am ' + esc(fmtDatum(d, true)) + ' ' +
    (betroffen.length === 1 ? 'ist' : 'sind') + ' laut <code>urlaub.js</code> abwesend: ' +
    betroffen.map(x => esc(x.p.name) + ' <span class="klein-grau">(' + esc(x.u.grund) + ' bis ' + esc(fmtDatum(x.u.bis)) + ')</span>').join(', ') + '.' +
    (mitglieder.length
      ? ' Davon ' + mitglieder.length + ' Betriebsratsmitglied(er) – bitte rechtzeitig Ersatzmitglieder laden. Im Protokoll werden sie als „Entschuldigt" vorbelegt.'
      : '') +
    '</div>';
}

/* Anwesenheitstabelle auf gemeinsamem Feld `s.teilnahme`: „Einladung" plant vor, „Protokoll" dokumentiert. `beiAenderung` läuft nach jeder Statusänderung (Beschlussfähigkeit neu rechnen). */
function anwesenheitTabelle(el, s, beiAenderung) {
  const mitglieder = aktiveMitglieder(daten);
  if (!mitglieder.length) {
    el.innerHTML = '<div class="hinweis warnung">Es sind noch keine Mitglieder erfasst. Bitte zuerst im <b>Admin-Menü</b> (links unten, Reiter „Personen") die Mitgliederliste anlegen – daraus entstehen Anwesenheitsliste und Teilnahmeübersicht.</div>';
    return mitglieder;
  }
  /* Wer laut urlaub.js abwesend ist und noch keinen Status hat, wird einmalig als „Entschuldigt" vorbelegt; erfasste Angaben bleiben unangetastet. */
  const urlaubJe = {};
  let vorbelegt = 0;
  for (const m of mitglieder) {
    const u = abwesenheitVon(m.name, s.datum);
    if (!u) continue;
    urlaubJe[m.id] = u;
    if (!darfBearbeiten()) continue;
    if (!s.teilnahme[m.id]) s.teilnahme[m.id] = { status: '', vertretenDurch: '' };
    if (!s.teilnahme[m.id].status) { s.teilnahme[m.id].status = 'entschuldigt'; vorbelegt++; }
  }
  if (vorbelegt) speichern();

  el.innerHTML =
    (Object.keys(urlaubJe).length
      ? '<div class="hinweis warnung" style="margin-top:0"><b>Urlaubskalender:</b> ' + Object.keys(urlaubJe).length +
        ' Mitglied(er) sind am Sitzungstag abwesend' +
        (vorbelegt ? ' – ' + vorbelegt + ' davon wurde(n) als „Entschuldigt" vorbelegt' : '') +
        '. Bitte prüfen und ggf. das geladene Ersatzmitglied eintragen.</div>'
      : '') +
    '<table class="tn-tabelle"><thead><tr><th style="width:34%">Mitglied</th><th style="width:24%">Status</th><th>Vertreten durch (Ersatzmitglied) / Teilnahme</th></tr></thead><tbody>' +
    mitglieder.map(m =>
      '<tr data-mid="' + m.id + '"><td><b>' + esc(m.name) + '</b><br><span class="klein-grau">' + esc(m.funktion) +
        (urlaubJe[m.id] ? ' · <b>' + esc(urlaubJe[m.id].grund) + ' bis ' + esc(fmtDatum(urlaubJe[m.id].bis)) + '</b>' : '') + '</span></td>' +
      '<td><select data-f="status"><option value="">– offen –</option>' +
        Object.keys(TEILNAHME_LABEL).map(k => '<option value="' + k + '">' + TEILNAHME_LABEL[k] + '</option>').join('') +
      '</select></td>' +
      '<td><input data-f="vertreten" placeholder="nur bei „Entschuldigt" relevant">' +
        '<div data-teil><label class="tn-teilweise"><input type="checkbox" data-f="teilweise"> nur bei einzelnen TOPs anwesend</label>' +
        '<div class="tn-topwahl" data-topwahl></div></div></td></tr>'
    ).join('') + '</tbody></table>';

  el.querySelectorAll('tr[data-mid]').forEach(tr => {
    const mid = tr.dataset.mid;
    const t = () => {
      if (!s.teilnahme[mid]) s.teilnahme[mid] = { status: '', vertretenDurch: '' };
      return s.teilnahme[mid];
    };
    const sel = tr.querySelector('[data-f="status"]');
    const ver = tr.querySelector('[data-f="vertreten"]');
    sel.value = teilnahmeVon(s, mid).status || '';
    ver.value = teilnahmeVon(s, mid).vertretenDurch || '';
    /* Teil-Anwesenheit: z. B. ein Ersatzmitglied, das nur für einen TOP nachrückt. Zählt für die Beschlüsse genau dieser TOPs. */
    const teil = tr.querySelector('[data-teil]');
    const teilweise = tr.querySelector('[data-f="teilweise"]');
    const topwahl = tr.querySelector('[data-topwahl]');
    const zeichneTopwahl = () => {
      const tn = teilnahmeVon(s, mid);
      teilweise.checked = nurEinzelneTops(tn);
      if (!teilweise.checked) { topwahl.innerHTML = ''; return; }
      topwahl.innerHTML = (s.tops || []).length
        ? s.tops.map((top, i) => '<label title="' + esc(top.titel || '') + '"><input type="checkbox" value="' + esc(top.id) + '"' +
            (tn.tops.includes(top.id) ? ' checked' : '') + '> TOP ' + (i + 1) + '</label>').join('')
        : '<span class="klein-grau">Noch keine TOPs.</span>';
      topwahl.querySelectorAll('input').forEach(cb => {
        cb.disabled = !darfBearbeiten();
        cb.onchange = () => {
          t().tops = Array.from(topwahl.querySelectorAll('input:checked')).map(x => x.value);
          speichern(); if (beiAenderung) beiAenderung();
        };
      });
    };
    teilweise.disabled = !darfBearbeiten();
    teilweise.onchange = () => {
      if (teilweise.checked) t().tops = []; else delete t().tops;
      speichern(); zeichneTopwahl(); if (beiAenderung) beiAenderung();
    };
    zeichneTopwahl();
    const sichtbarkeit = () => {
      ver.style.display = sel.value === 'entschuldigt' ? '' : 'none';
      teil.style.display = sel.value === 'anwesend' || sel.value === 'video' ? '' : 'none';
    };
    sichtbarkeit();
    sel.onchange = () => { t().status = sel.value; speichern(); sichtbarkeit(); if (beiAenderung) beiAenderung(); };
    ver.oninput = () => { t().vertretenDurch = ver.value; speichern(); };
  });
  return mitglieder;
}

/* Gäste-Block auf gemeinsamem Feld `s.gaeste`: „Einladung" plant, „Protokoll" korrigiert. TOP-Zuweisung steuert das gekürzte Protokoll. */
function gaesteBlock(el, s) {
  el.innerHTML =
    '<div data-gastliste style="margin-top:8px"></div>' +
    '<button class="btn btn-klein" data-gast="neu" style="margin-top:8px">+ Gast erfassen</button>' +
    '<button class="btn btn-klein" data-gast="stamm" style="margin-top:8px;margin-left:8px" title="Aktive SBV- und JAV-Personen aus den Stammdaten als Gäste hinzufügen">SBV/JAV aus Stammdaten übernehmen</button>';
  const gastBereich = el.querySelector('[data-gastliste]');
  const topBtnLabel = g => { const n = gastAuswahlAnzahl(s, g); return n ? 'Auswahl (' + n + ')' : 'alle Punkte'; };
  const renderGaeste = () => {
    gastBereich.innerHTML = (s.gaeste || []).map((g, i) => {
      const topPanel = (s.tops || []).length
        ? (s.tops || []).map((t, ti) => {
            const topChecked = (g.tops || []).includes(t.id);
            const subHtml = (t.unterpunkte || []).map((u, ui) =>
              '<label class="pruefreihe" style="margin:2px 0 2px 22px"><input type="checkbox" data-sub="' + u.id + '"' +
              ((g.tops || []).includes(u.id) ? ' checked' : '') + (topChecked ? ' disabled' : '') + '> ' +
              (ti + 1) + '.' + (ui + 1) + '  ' + esc(u.titel || '(ohne Titel)') + '</label>').join('');
            return '<div data-topgroup>' +
              '<label class="pruefreihe" style="margin:2px 0"><input type="checkbox" data-top="' + t.id + '"' +
              (topChecked ? ' checked' : '') + '> <b>TOP ' + (ti + 1) + ': ' + esc(t.titel || '(ohne Titel)') + '</b></label>' +
              subHtml + '</div>';
          }).join('') +
          '<div class="klein-grau" style="margin-top:4px">Keine Auswahl = Gast nimmt an der gesamten Sitzung teil. Ein angehakter TOP schließt alle seine Unterpunkte ein.</div>'
        : '<div class="klein-grau">Noch keine Tagesordnungspunkte erfasst.</div>';
      return '<div style="margin-bottom:9px" data-gi="' + i + '">' +
        '<div class="raster" style="grid-template-columns:1fr 220px 1fr auto 40px;gap:8px;align-items:center">' +
        '<input data-f="name" placeholder="Name" class="eingabe">' +
        '<select data-f="typ" class="eingabe">' + Object.keys(GAST_TYPEN).map(k => '<option value="' + k + '">' + GAST_TYPEN[k] + '</option>').join('') + '</select>' +
        '<input data-f="funktion" placeholder="Funktion/Organisation (optional, z. B. IG BCE)" class="eingabe">' +
        '<button class="btn btn-klein" data-tu="tops" title="Nur bestimmte TOPs zuweisen (leer = ganze Sitzung)">' + topBtnLabel(g) + '</button>' +
        '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button></div>' +
        '<div class="gast-tops" data-tops hidden>' + topPanel + '</div>' +
        '</div>';
    }).join('');
    gastBereich.querySelectorAll('[data-gi]').forEach(zeile => {
      const g = s.gaeste[parseInt(zeile.dataset.gi, 10)];
      bindeText(zeile.querySelector('[data-f="name"]'), () => g.name, v => { g.name = v; });
      bindeText(zeile.querySelector('[data-f="funktion"]'), () => g.funktion, v => { g.funktion = v; });
      const typ = zeile.querySelector('[data-f="typ"]');
      typ.value = g.typ || 'sonstig';
      typ.onchange = () => { g.typ = typ.value; speichern(); };
      const panel = zeile.querySelector('[data-tops]');
      const topBtn = zeile.querySelector('[data-tu="tops"]');
      topBtn.onclick = () => { panel.hidden = !panel.hidden; };
      const setzeId = (id, an) => {
        g.tops = g.tops || [];
        if (an) { if (!g.tops.includes(id)) g.tops.push(id); }
        else { g.tops = g.tops.filter(x => x !== id); }
      };
      panel.querySelectorAll('[data-topgroup]').forEach(grp => {
        const topCb = grp.querySelector('input[data-top]');
        const subCbs = Array.from(grp.querySelectorAll('input[data-sub]'));
        topCb.onchange = () => {
          setzeId(topCb.dataset.top, topCb.checked);
          subCbs.forEach(scb => { scb.disabled = topCb.checked; });   /* ganzer TOP schließt Unterpunkte ein */
          speichern();
          topBtn.textContent = topBtnLabel(g);
        };
        subCbs.forEach(scb => {
          scb.onchange = () => { setzeId(scb.dataset.sub, scb.checked); speichern(); topBtn.textContent = topBtnLabel(g); };
        });
      });
      zeile.querySelector('[data-tu="weg"]').onclick = () => { s.gaeste.splice(parseInt(zeile.dataset.gi, 10), 1); speichern(); renderGaeste(); };
    });
  };
  renderGaeste();
  el.querySelector('[data-gast="neu"]').onclick = () => {
    s.gaeste = s.gaeste || [];
    s.gaeste.push({ id: uid(), name: '', typ: 'sonstig', funktion: '', tops: [] });
    speichern(); renderGaeste();
  };
  el.querySelector('[data-gast="stamm"]').onclick = () => {
    let zahl = 0;
    s.gaeste = s.gaeste || [];
    ['sbv', 'jav'].forEach(gruppe => aktivePersonen(daten, gruppe).forEach(p => {
      if (!(p.name || '').trim()) return;
      const vorhanden = s.gaeste.some(x => x.typ === gruppe && (x.name || '').trim().toLowerCase() === p.name.trim().toLowerCase());
      if (!vorhanden) { s.gaeste.push({ id: uid(), name: p.name, typ: gruppe, funktion: p.funktion || '', tops: [] }); zahl++; }
    }));
    if (zahl) { speichern(); renderGaeste(); zeigeToast(zahl + ' Person(en) aus SBV/JAV als Gäste übernommen.', 'erfolg'); }
    else zeigeToast('Keine (weiteren) aktiven SBV-/JAV-Personen vorhanden.', 'fehler');
  };
}

/* Schild schaltet nur um, wenn der Zustand wirklich kippt – nicht bei jedem Neuzeichnen. */
function quorumAnzeigeSetzen(el, s, geplant, kompakt) {
  if (!el) return;
  const vorher = el.firstElementChild ? el.firstElementChild.className : '';
  el.innerHTML = quorumAnzeigeHtml(s, geplant, kompakt);
  const jetzt = el.firstElementChild;
  if (jetzt && vorher && vorher !== jetzt.className) jetzt.classList.add('schaltet');
}

/* Nur Zahlen für die Anwesenheitstafel – das Schild selbst steht bereits im Sitzungskopf/-stand. */
function quorumZahlenHtml(s) {
  const q = quorumInfo(daten, s);
  if (!q.groesse) return '';
  if (!q.erfasst) return '<span class="quorum-zahlen">Noch keine Anwesenheit erfasst</span>';
  return '<span class="quorum-zahlen"><b>' + q.teilnehmend + '</b> von ' + q.groesse +
    ' teilnehmend · mindestens <b>' + q.erforderlich + '</b> erforderlich</span>';
}

/* `geplant` = Blick voraus im Einladungs-Reiter, sonst Stand der laufenden Sitzung. */
function quorumAnzeigeHtml(s, geplant, kompakt) {
  const q = quorumInfo(daten, s);
  if (!q.groesse) return '';
  if (!q.erfasst) {
    return '<span class="quorum offen">' + (kompakt ? 'Anwesenheit offen'
      : 'Beschlussfähigkeit: noch ' + (geplant ? 'nichts geplant' : 'keine Anwesenheit erfasst')) + '</span>';
  }
  /* Form (Rechteck/Dreieck) kommt aus dem Stylesheet, hier nur der Text. `kompakt` = Fassung fürs Kopfschild (halbe Breite). */
  const lang = (geplant ? 'Voraussichtlich ' : '') +
    (q.beschlussfaehig ? (geplant ? 'beschlussfähig' : 'Beschlussfähig') : (geplant ? 'nicht beschlussfähig' : 'Nicht beschlussfähig')) +
    ' · ' + q.teilnehmend + ' von ' + q.groesse + ' (mind. ' + q.erforderlich + ')';
  const text = kompakt
    ? (geplant ? 'Vorauss. ' : '') + (q.beschlussfaehig ? 'beschlussfähig' : 'nicht beschlussfähig') +
      ' · ' + q.teilnehmend + '/' + q.groesse
    : lang;
  return '<span class="quorum ' + (q.beschlussfaehig ? 'ok' : 'nein') + '"' +
    (kompakt ? ' title="' + esc(lang) + '"' : '') + '>' + esc(text) + '</span>';
}

/* Reiter „Einladung": plant Anwesenheit im selben Feld wie das Protokollmodul; die Schriftführung korrigiert später. */
function renderTabEinladung(c, s) {
  c.innerHTML =
    '<div class="karte"><div class="karte-kopf"><h3>Geplante Anwesenheit</h3>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="quorumPlan"></span>' +
      '<button class="btn btn-klein" id="alleAnwesend">Alle Mitglieder als anwesend markieren</button></div></div>' +
    '<div class="karte-koerper"><div id="tnPlan"></div></div>' +
    '<div class="karte-fuss">Diese Planung dient der Ladung: Wer absagt, macht den Platz für das Ersatzmitglied frei – tragen Sie es gleich unter „Vertreten durch" ein. In der Sitzung führt die Schriftführung die tatsächliche Anwesenheit im Protokollmodul; deren Stand kommt mit der Ergebnis-Übergabe zurück und überschreibt die Planung.</div></div>' +

    '<div class="karte"><div class="karte-kopf"><h3>Zu ladende Gäste (Arbeitgeber, Gewerkschaft, SBV, JAV, Sachverständige)</h3></div>' +
    '<div class="karte-koerper"><div id="gastPlan"></div></div>' +
    '<div class="karte-fuss">Die Gästeliste reist mit der Tagesordnung ins Protokollmodul und steht dort zur Korrektur bereit – solange die Schriftführung noch keine eigenen Gäste erfasst hat. Wer hier als SBV oder JAV steht und in den Stammdaten eine E-Mail-Adresse hat, bekommt die Einladungs-Mail mit.</div></div>' +

    '<div class="hinweis recht">Die/der Vorsitzende lädt alle Mitglieder rechtzeitig unter Mitteilung der Tagesordnung. Verhinderte Mitglieder melden sich unverzüglich, damit das jeweilige Ersatzmitglied geladen werden kann. SBV und JAV sind ebenfalls zu laden, soweit teilnahmeberechtigt bzw. vorhanden. Einladung und Anwesenheitsliste selbst erzeugt der Reiter <b>PDF-Export</b>.</div>';

  const zeigeQuorum = () => {
    c.querySelector('#quorumPlan').innerHTML = quorumZahlenHtml(s);
    quorumAnzeigeSetzen(document.getElementById('quorumKopf'), s, true, true);
  };
  const mitglieder = anwesenheitTabelle(c.querySelector('#tnPlan'), s, zeigeQuorum);
  gaesteBlock(c.querySelector('#gastPlan'), s);
  zeigeQuorum();

  c.querySelector('#alleAnwesend').onclick = () => {
    /* Nur ordentliche Mitglieder – Ersatzmitglieder werden bewusst nicht markiert. */
    for (const m of mitglieder.filter(m => m.funktion !== 'Ersatzmitglied')) {
      if (!s.teilnahme[m.id]) s.teilnahme[m.id] = { status: '', vertretenDurch: '' };
      s.teilnahme[m.id].status = 'anwesend';
    }
    speichern(); renderHaupt();
  };
}

function renderTabSitzung(c, s) {
  c.innerHTML =
    '<div class="karte"><div class="karte-kopf"><h3>Rahmendaten der Sitzung</h3></div><div class="karte-koerper">' +
    '<div class="raster s4">' +
      feldHtml('fNr', 'Sitzungs-Nr.', 'text') +
      '<div class="feld"><label for="fArt">Sitzungsart</label><select id="fArt">' +
        Object.keys(SITZUNGSART_LABEL).map(k => '<option value="' + k + '">' + SITZUNGSART_LABEL[k] + '</option>').join('') + '</select></div>' +
      feldHtml('fDatum', 'Datum', 'date') +
      feldHtml('fOrt', 'Ort / Raum', 'text', 'placeholder="z. B. Betriebsratsbüro, Raum 2.14"') +
    '</div><div class="raster s4" style="margin-top:14px">' +
      feldHtml('fBeginn', 'Beginn', 'time') +
      feldHtml('fEndeG', 'Voraussichtl. Ende', 'time') +
      feldHtml('fEinlDatum', 'Einladung vom', 'date', '', 'Ladung „rechtzeitig" mit Tagesordnung.') +
      '<div class="feld"><label>Video/Telefon</label><label class="pruefreihe" style="margin-top:6px"><input type="checkbox" id="fVideo"> Teilnahme möglich</label></div>' +
    '</div>' +
    '<div class="raster s2" style="margin-top:14px" id="videoZeile">' +
      feldHtml('fVideoHinweis', 'Zugangshinweis Video/Telefon', 'text', 'placeholder="z. B. Einwahldaten folgen gesondert"') +
      feldHtml('fEinlHinweis', 'Zusätzlicher Hinweis auf der Einladung', 'text', 'placeholder="optional"') +
    '</div>' +
    '<div class="raster s2" style="margin-top:14px">' +
      '<div class="feld"><label for="fLeitung">Sitzungsleitung</label>' +
        '<select id="fLeitung">' +
          '<option value="">— ' + esc(vorsitzName(daten) || 'Vorsitzende/r') + ' (Vorsitz aus Stammdaten) —</option>' +
          aktiveMitglieder(daten).map(m => '<option value="' + esc(m.name) + '"' + (s.sitzungsleitung === m.name ? ' selected' : '') + '>' +
            esc(m.name) + (m.funktion && m.funktion !== 'Mitglied' ? ' (' + esc(m.funktion) + ')' : '') + '</option>').join('') +
          ((s.sitzungsleitung || '').trim() && !aktiveMitglieder(daten).some(m => m.name === s.sitzungsleitung)
            ? '<option value="' + esc(s.sitzungsleitung) + '" selected>' + esc(s.sitzungsleitung) + '</option>' : '') +
        '</select>' +
        '<span class="feldhinweis">leer = Vorsitzende/r aus den Stammdaten</span></div>' +
      feldHtml('fProtokoll', 'Protokollführung', 'text', 'placeholder="' + esc(schriftfuehrerName(daten) || 'Weiteres Mitglied') + '"', 'unterzeichnet als weiteres Mitglied') +
    '</div>' +
    '</div></div>' +
    '<div id="urlaubHinweis"></div>' +
    '<div class="hinweis recht"><b>Rechtlicher Rahmen:</b> Die/der Vorsitzende lädt alle Mitglieder rechtzeitig unter Mitteilung der Tagesordnung; §HIERPASSENDENPARAGRAPHENDERGOERGÄNZEN. Verhinderte Mitglieder melden sich unverzüglich, damit Ersatzmitglieder geladen werden können. SBV und JAV sind ebenfalls zu laden, soweit teilnahmeberechtigt bzw. vorhanden.</div>';

  const urlaubBox = c.querySelector('#urlaubHinweis');
  const zeigeUrlaub = () => {
    urlaubBox.innerHTML = urlaubHinweisHtml(s.datum);
  };
  zeigeUrlaub();

  bindeText(c.querySelector('#fNr'), () => s.nr, v => { s.nr = v; }, () => { renderSeitenleiste(); });
  const art = c.querySelector('#fArt'); art.value = s.art || 'ordentlich';
  art.onchange = () => { s.art = art.value; speichern(); renderHaupt(); };
  bindeText(c.querySelector('#fDatum'), () => s.datum, v => { s.datum = v; }, () => { renderSeitenleiste(); zeigeUrlaub(); });
  bindeText(c.querySelector('#fOrt'), () => s.ort, v => { s.ort = v; });
  bindeText(c.querySelector('#fBeginn'), () => s.beginn, v => { s.beginn = v; });
  bindeText(c.querySelector('#fEndeG'), () => s.endeGeplant, v => { s.endeGeplant = v; });
  bindeText(c.querySelector('#fEinlDatum'), () => s.einladungDatum, v => { s.einladungDatum = v; });
  bindeText(c.querySelector('#fVideoHinweis'), () => s.videoHinweis, v => { s.videoHinweis = v; });
  bindeText(c.querySelector('#fEinlHinweis'), () => s.einladungHinweis, v => { s.einladungHinweis = v; });
  const fLeitung = c.querySelector('#fLeitung');
  if (fLeitung) fLeitung.onchange = () => { s.sitzungsleitung = fLeitung.value; speichern(); };
  bindeText(c.querySelector('#fProtokoll'), () => s.protokollfuehrung, v => { s.protokollfuehrung = v; });
  bindePruef(c.querySelector('#fVideo'), () => s.videokonferenz, v => { s.videokonferenz = v; });
}
