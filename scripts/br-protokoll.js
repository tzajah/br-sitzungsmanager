'use strict';

function renderTabProtokoll(c, s) {
  const updater = [];   // Ergebnis-Anzeigen, die bei Anwesenheitsänderung neu rechnen

  c.innerHTML = protTocHtml(s) +
    '<div class="karte" data-tocanker="anwesenheit"><div class="karte-kopf"><h3>Anwesenheit &amp; Beschlussfähigkeit</h3>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span id="quorumAnzeige"></span>' +
      '<button class="btn btn-klein" id="alleAnwesend">Alle Mitglieder als anwesend markieren</button></div></div>' +
    '<div class="karte-koerper">' +
      '<div id="tnBereich"></div>' +
      '<hr class="trenner"><h3 class="unter-ueberschrift">Gäste (Arbeitgeber, Gewerkschaft, SBV, JAV, Sachverständige)</h3>' +
      '<div id="gastBereich"></div>' +
      '<div class="raster s3" style="margin-top:16px">' +
        zeitMitJetztHtml('fBeginnT', 'Tatsächlicher Sitzungsbeginn', 'erscheint im Eröffnungssatz der Niederschrift') +
        zeitMitJetztHtml('fEndeT', 'Tatsächliches Sitzungsende', 'erscheint im Schlusssatz der Niederschrift') +
      '</div>' +
    '</div>' +
    '<div class="karte-fuss">Beschlussfähig ist der Betriebsrat, wenn mindestens die Hälfte der Mitglieder an der Beschlussfassung teilnimmt; Ersatzmitglieder zählen mit. Die eigenhändig unterschriebene Anwesenheitsliste ist der Niederschrift beizufügen.</div></div>' +

    '<div class="karte" data-tocanker="tops"><div class="karte-kopf"><h3>Protokoll je Tagesordnungspunkt</h3></div>' +
    '<div class="karte-koerper">' + topSprungleisteHtml(s, true) + '<div id="protTops"></div></div>' +
    '<div class="karte-fuss">Pflichtinhalt jeder Niederschrift: der <b>Wortlaut</b> jedes Beschlusses und die <b>Stimmenmehrheit</b> mit exakten Zahlen (Ja / Nein / Enthaltungen). Angaben wie „einstimmig" allein genügen nicht – die App druckt daher stets die genauen Stimmenzahlen.</div></div>' +

    '<div class="karte" data-tocanker="anlagen"><div class="karte-kopf"><h3>Anlagen zum Protokoll</h3></div><div class="karte-koerper">' +
      '<div class="hinweis recht" style="margin-top:0"><b>Anlage 1</b> ist automatisch die Anwesenheitsliste (abschaltbar im Export). Hier hochgeladene Dateien werden ab <b>Anlage 2</b> fortlaufend nummeriert – z. B. die unterschriebene, eingescannte Anwesenheitsliste, Textform-Bestätigungen bei Videoteilnahme, Beschlussvorlagen oder erhobene Einwendungen.</div>' +
      '<div id="anlProt"></div>' +
    '</div></div>';

  /* Anwesenheitstabelle: geteilt mit Reiter "Einladung" (anwesenheitTabelle in br-app.js). */
  const mitglieder = anwesenheitTabelle(c.querySelector('#tnBereich'), s, () => aktualisiereQuorum());

  c.querySelector('#alleAnwesend').onclick = () => {
    /* Nur ordentliche Mitglieder – Ersatzmitglieder werden bewusst nicht markiert. */
    for (const m of mitglieder.filter(m => m.funktion !== 'Ersatzmitglied')) {
      if (!s.teilnahme[m.id]) s.teilnahme[m.id] = { status: '', vertretenDurch: '' };
      s.teilnahme[m.id].status = 'anwesend';
    }
    speichern(); renderHaupt();
  };

  function aktualisiereQuorum() {
    c.querySelector('#quorumAnzeige').innerHTML = quorumZahlenHtml(s);
    quorumAnzeigeSetzen(document.getElementById('quorumKopf'), s, false, true);
    updater.forEach(fn => fn());
  }

  /* Gästeliste: vom Reiter "Einladung" vorbelegt (gaesteBlock in br-app.js), hier korrigiert. */
  gaesteBlock(c.querySelector('#gastBereich'), s);

  zeitMitJetztVerdrahten(c, 'fBeginnT', () => s.beginnTatsaechlich, v => { s.beginnTatsaechlich = v; });
  zeitMitJetztVerdrahten(c, 'fEndeT', () => s.endeTatsaechlich, v => { s.endeTatsaechlich = v; });

  const protTops = c.querySelector('#protTops');
  if (!s.tops.length) {
    protTops.innerHTML = '<p class="klein-grau">Es sind noch keine Tagesordnungspunkte vorhanden – bitte zunächst im Reiter „Tagesordnung" anlegen.</p>';
  }
  s.tops.forEach((top, i) => protTops.appendChild(protokollTopBlock(s, top, i, updater)));
  topSprungleisteVerdrahten(c);
  protTocVerdrahten(c);

  renderAnlagenWidget(c.querySelector('#anlProt'), s.anlagenProt, '');
  aktualisiereQuorum();
}

/* Inhaltsverzeichnis wie der Navigationsbereich in Word: steht im freien Rand links neben dem Protokoll
   und scrollt mit (.prot-toc in br-design.css); auf schmalen Bildschirmen bleibt nur die TOP-Sprungleiste. */
function protTocHtml(s) {
  const eintrag = (ziel, text, ebene, nr, punkt) => '<button type="button" class="toc-e toc-' + ebene + '" data-toc="' + ziel + '">' +
    (punkt || '') + (nr ? '<span class="toc-nr">' + nr + '</span>' : '') + '<span class="toc-t">' + esc(text) + '</span></button>';
  const stand = t => '<span class="' + topStand(t).klasse + '"></span>';
  /* Einklappbar zu einer schmalen Leiste; der Zustand wird geräte-lokal gemerkt (tocZu). */
  const zu = tocZu();
  return '<nav class="prot-toc' + (zu ? ' zu' : '') + '" aria-label="Inhalt des Protokolls"><div class="toc-kopf"><span>Inhalt</span>' +
    '<button type="button" class="btn btn-symbol btn-geist toc-klapp" aria-expanded="' + !zu + '" aria-controls="tocListe" ' +
    'title="' + (zu ? 'Inhaltsverzeichnis einblenden' : 'Inhaltsverzeichnis einklappen') + '"><svg class="ic"><use href="#ic-chevron"/></svg></button></div>' +
    '<div id="tocListe">' +
    eintrag('anwesenheit', 'Anwesenheit & Beschlussfähigkeit', 1) +
    eintrag('tops', 'Protokoll je TOP', 1) +
    s.tops.map((t, i) => eintrag('top-' + i, t.titel || '(ohne Titel)', 2, 'TOP ' + (i + 1), stand(t)) +
      (t.unterpunkte || []).map((u, j) => eintrag('up-' + i + '-' + j, u.titel || '(ohne Titel)', 3, (i + 1) + '.' + (j + 1))).join('')).join('') +
    eintrag('anlagen', 'Anlagen zum Protokoll', 1) +
    '</div></nav>';
}
/* Live (Inhaltsverzeichnis und TOP-Sprungleiste): hängt über sitzungsstandAuffrischen (br-app.js) an speichern(), also an jeder Eingabe, entprellt. */
function standPunkteAuffrischen() {
  const s = aktSitzung();
  if (!s) return;
  document.querySelectorAll('.prot-toc [data-toc^="top-"] .ts-punkt').forEach(punkt => {
    const t = s.tops[parseInt(punkt.parentNode.dataset.toc.slice(4), 10)];
    if (t) punkt.className = topStand(t).klasse;
  });
  /* TOP-Sprungleiste (schmale Fenster, eingeklapptes Verzeichnis): Punkt und Tooltip */
  document.querySelectorAll('.top-sprung.mit-stand .ts-chip').forEach(chip => {
    const i = s.tops.findIndex(t => t.id === chip.dataset.ziel);
    if (i < 0) return;
    chip.querySelector('.ts-punkt').className = topStand(s.tops[i]).klasse;
    chip.title = topChipTitel(s.tops[i], i);
  });
}
/* Einklapp-Zustand des Inhaltsverzeichnisses – geräte-lokal gemerkt wie bearbeiterName (nicht vertraulich). */
function tocZu(wert) {
  try {
    if (wert !== undefined) { localStorage.setItem('br-sitzungsmanager.tocZu', wert ? '1' : ''); return wert; }
    return localStorage.getItem('br-sitzungsmanager.tocZu') === '1';
  } catch (e) { return !!wert; }
}
function protTocVerdrahten(c) {
  const toc = c.querySelector('.prot-toc'), klapp = toc.querySelector('.toc-klapp');
  klapp.onclick = () => {
    const zu = tocZu(toc.classList.toggle('zu'));
    klapp.setAttribute('aria-expanded', String(!zu));
    klapp.title = zu ? 'Inhaltsverzeichnis einblenden' : 'Inhaltsverzeichnis einklappen';
    protTocMarkieren();
  };
  c.querySelectorAll('.prot-toc [data-toc]').forEach(e => e.onclick = () => {
    const ziel = c.querySelector('[data-tocanker="' + e.dataset.toc + '"]');
    if (!ziel) return;
    /* Unterpunkt in einem zugeklappten TOP: erst aufklappen, sonst gibt es kein Ziel. */
    const top = ziel.closest('.top-eintrag.zu');
    if (top && top !== ziel) top.querySelector('[data-klapp]').click();
    ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  protTocMarkieren();
}
/* Markiert den Abschnitt, in dem man gerade steht: den letzten, dessen Anfang oben unter der Reiterleiste liegt. */
function protTocMarkieren() {
  const toc = document.querySelector('.prot-toc');
  if (!toc) return;
  const eintraege = Array.from(toc.querySelectorAll('[data-toc]'));
  let aktiv = eintraege[0];
  for (const e of eintraege) {
    const ziel = document.querySelector('[data-tocanker="' + e.dataset.toc + '"]');
    if (ziel && ziel.offsetParent && ziel.getBoundingClientRect().top <= 100) aktiv = e;
  }
  for (const e of eintraege) {
    e.classList.toggle('aktiv', e === aktiv);
    if (e === aktiv) e.setAttribute('aria-current', 'location'); else e.removeAttribute('aria-current');
  }
  /* Langes Verzeichnis: aktiven Eintrag sichtbar halten (scrollTop statt scrollIntoView, das bräche das sanfte Scrollen ab). */
  if (aktiv && (aktiv.offsetTop < toc.scrollTop || aktiv.offsetTop + aktiv.offsetHeight > toc.scrollTop + toc.clientHeight)) {
    toc.scrollTop = aktiv.offsetTop - toc.clientHeight / 3;
  }
}
window.addEventListener('scroll', protTocMarkieren, { passive: true });

function zeitMitJetztHtml(id, label, hinweis) {
  return '<div class="feld"><label for="' + id + '">' + label + '</label>' +
    '<div style="display:flex;gap:8px"><input id="' + id + '" type="time">' +
    '<button type="button" class="btn btn-klein" data-jetzt="' + id + '" title="Aktuelle Uhrzeit eintragen">Jetzt</button></div>' +
    '<span class="feldhinweis">' + hinweis + '</span></div>';
}
function zeitMitJetztVerdrahten(c, id, holen, setzen) {
  const feld = c.querySelector('#' + id);
  bindeText(feld, holen, setzen);
  const knopf = c.querySelector('[data-jetzt="' + id + '"]');
  if (!darfBearbeiten()) { knopf.style.display = 'none'; return; }
  /* Über das input-Event, damit bindeText wie bei einer Eingabe speichert. */
  knopf.onclick = () => { feld.value = uhrzeitJetzt(); feld.dispatchEvent(new Event('input', { bubbles: true })); };
}

function topBadgesHtml(top) {
  const alleP = [top].concat(top.unterpunkte || []);
  const b = alleP.reduce((m, p) => m + (p.beschluesse || []).length, 0);
  const a = alleP.reduce((m, p) => m + (p.aufgaben || []).length, 0);
  const teile = [];
  if (b) teile.push('<span class="top-badge">' + b + (b === 1 ? ' Beschluss' : ' Beschlüsse') + '</span>');
  if (a) teile.push('<span class="top-badge">' + a + (a === 1 ? ' Aufgabe' : ' Aufgaben') + '</span>');
  return teile.length ? '<span class="top-badges">' + teile.join('') + '</span>' : '';
}

function protokollTopBlock(s, top, i, updater) {
  const wrap = document.createElement('div');
  wrap.className = 'top-eintrag';
  wrap.setAttribute('data-topanker', top.id || '');
  wrap.setAttribute('data-tocanker', 'top-' + i);
  wrap.innerHTML =
    '<div class="top-kopf"><span class="top-nr">TOP ' + (i + 1) + '</span>' +
    '<span style="flex:1;font-weight:650;padding:4px 8px">' + esc(top.titel || '(ohne Titel)') + '</span>' +
    topBadgesHtml(top) +
    '<span class="klein-grau">' + esc(KATEGORIEN[top.kategorie] || '') + '</span>' +
    klappButtonHtml(top) + '</div>' +
    '<div class="top-koerper"><div class="punkt-kern" data-kern>' + punktKernHtml('Verlauf / Ergebnis der Beratung') + '</div>' +
    '<div class="unterpunkte-prot" data-upprot></div></div>';

  klappVerdrahten(wrap, top);
  bestueckePunkt(wrap.querySelector('[data-kern]'), s, top, updater);

  const upBox = wrap.querySelector('[data-upprot]');
  (top.unterpunkte || []).forEach((u, j) => {
    const sub = document.createElement('div');
    sub.className = 'unterpunkt-prot';
    sub.setAttribute('data-tocanker', 'up-' + i + '-' + j);
    sub.innerHTML =
      '<div class="up-kopf"><span class="top-nr">' + (i + 1) + '.' + (j + 1) + '</span>' +
      '<span style="flex:1;font-weight:600;padding:4px 8px">' + esc(u.titel || '(ohne Titel)') + '</span>' +
      '<span class="klein-grau">' + esc(kategorieText(u)) + '</span></div>' +
      '<div class="punkt-kern" data-kern>' + punktKernHtml('Verlauf / Ergebnis') + '</div>';
    upBox.appendChild(sub);
    bestueckePunkt(sub.querySelector('[data-kern]'), s, u, updater);
  });
  return wrap;
}

function punktKernHtml(verlaufLabel) {
  return '<div class="feld">' +
    '<label class="verlauf-label">' + verlaufLabel + '</label>' +
    '<div class="rt-toolbar" role="toolbar" aria-label="Textformatierung">' +
      '<button type="button" class="rt-btn" data-cmd="bold" title="Fett (Strg+B)" aria-label="Fett"><b>F</b></button>' +
      '<button type="button" class="rt-btn" data-cmd="italic" title="Kursiv (Strg+I)" aria-label="Kursiv"><i>K</i></button>' +
      '<button type="button" class="rt-btn" data-cmd="underline" title="Unterstrichen (Strg+U)" aria-label="Unterstrichen"><u>U</u></button>' +
      '<button type="button" class="rt-btn" data-cmd="insertUnorderedList" title="Aufzählungsliste" aria-label="Aufzählungsliste"><svg class="ic"><use href="#ic-liste"/></svg></button>' +
      '<button type="button" class="rt-btn" data-cmd="insertOrderedList" title="Nummerierte Liste" aria-label="Nummerierte Liste">1.</button>' +
      '<span class="rt-trenner" aria-hidden="true"></span>' +
      '<button type="button" class="btn btn-klein btn-geist rt-baustein" data-tu="baustein" title="Vordefinierten Textbaustein einfügen">+ Textblock einfügen</button>' +
      '<button type="button" class="btn btn-klein btn-geist rt-pause" data-tu="pause" title="Sitzungspause mit Uhrzeit dokumentieren">Pause beginnen</button>' +
    '</div>' +
    '<div class="rt-editor" data-f="verlauf" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + verlaufLabel + '" data-platzhalter="Wesentliche Informationen, Argumente und Ergebnisse – so knapp wie möglich, so ausführlich wie nötig."></div></div>' +
    '<div data-beschluesse></div>' +
    '<button class="btn btn-klein" data-tu="beschlussNeu" style="margin-top:10px">+ Beschluss</button>' +
    '<div data-aufgaben style="margin-top:12px"></div>';
}

function vorlageMenueOeffnen(editor, quelle) {
  if (!editor) return;
  const beschluss = quelle === 'beschluss';
  const liste = (beschluss ? daten.beschlussVorlagen : daten.protokollVorlagen) || [];
  const dlg = document.getElementById('dlgVorlagen');
  const kopf = '<div class="dlg-kopf"><h3>' + (beschluss ? 'Beschluss-Textbaustein einfügen' : 'Textblock einfügen') +
    '</h3><button class="btn btn-geist" id="tvAbbr">Schließen</button></div>';
  let koerper;
  if (!liste.length) {
    koerper = '<div class="dlg-koerper"><p class="klein-grau">Es sind noch keine Textbausteine hinterlegt.</p></div>';
  } else {
    koerper = '<div class="dlg-koerper"><div class="vorlagen-wahl">' +
      liste.map((v, i) => {
        const txt = v.text || '';
        return '<button type="button" class="vorlage-option" data-i="' + i + '">' +
          '<span class="vo-titel">' + esc(v.titel || '(ohne Titel)') + '</span>' +
          '<span class="vo-text">' + esc(txt.slice(0, 140)) + (txt.length > 140 ? '…' : '') + '</span>' +
        '</button>';
      }).join('') +
    '</div></div>';
  }
  dlg.innerHTML = kopf + koerper;
  dlg.querySelector('#tvAbbr').onclick = () => dlg.close();
  dlg.querySelectorAll('.vorlage-option').forEach(btn => btn.onclick = () => {
    const v = liste[parseInt(btn.dataset.i, 10)];
    dlg.close();
    textblockEinfuegen(editor, v.text || '');
  });
  dlg.showModal();
}

/* Löst ein input-Event aus, damit bindeRichText/bindeText sanitisiert und speichert. */
function textblockEinfuegen(editor, text) {
  if (!editor) return;
  if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
    editor.focus();
    const start = editor.selectionStart == null ? editor.value.length : editor.selectionStart;
    const ende = editor.selectionEnd == null ? start : editor.selectionEnd;
    const vor = editor.value.slice(0, start);
    const einsatz = (vor.trim() && !/\n$/.test(vor) ? '\n' : '') + text;
    editor.setRangeText(einsatz, start, ende, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  editor.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    if (sel) { sel.removeAllRanges(); sel.addRange(r); }
  }
  const vorhandener = editor.innerText || '';
  let einsatz = text;
  if (vorhandener.trim() && !/\n$/.test(vorhandener)) einsatz = '\n' + einsatz;
  document.execCommand('insertText', false, einsatz);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function uhrzeitJetzt() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* Hängt immer ans Ende an (nicht an Cursorposition), damit Pause-Zeilen untereinander stehen. */
function pauseZeileAnhaengen(editor, text) {
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(editor);
  r.collapse(false);
  if (sel) { sel.removeAllRanges(); sel.addRange(r); }
  const vorhandener = editor.innerText || '';
  let einsatz = text;
  if (vorhandener.trim() && !/\n$/.test(vorhandener)) einsatz = '\n' + einsatz;
  document.execCommand('insertText', false, einsatz);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function bestueckePunkt(el, s, punkt, updater) {
  const verlaufFeld = el.querySelector('[data-f="verlauf"]');
  bindeRichText(verlaufFeld, () => punkt.verlauf, v => { punkt.verlauf = v; });
  const toolbar = el.querySelector('.rt-toolbar');
  if (toolbar && darfBearbeiten()) {
    toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());   /* Auswahl im Editor halten */
      btn.addEventListener('click', () => {
        verlaufFeld.focus();
        try { document.execCommand('styleWithCSS', false, false); } catch (e) {}   /* Tags statt style-Attribute */
        document.execCommand(btn.dataset.cmd, false, null);
        verlaufFeld.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }
  const bausteinBtn = el.querySelector('[data-tu="baustein"]');
  if (bausteinBtn) bausteinBtn.onclick = () => { if (darfBearbeiten()) vorlageMenueOeffnen(verlaufFeld); };

  const pauseBtn = el.querySelector('[data-tu="pause"]');
  if (pauseBtn) {
    if (!darfBearbeiten()) {
      pauseBtn.style.display = 'none';   /* Nur-Lese-Ansicht: Pause dokumentiert nichts */
    } else {
      const pauseLabel = () => {
        pauseBtn.textContent = punkt.pauseAktiv ? 'Pause beenden' : 'Pause beginnen';
        pauseBtn.classList.toggle('aktiv', !!punkt.pauseAktiv);
      };
      pauseLabel();
      pauseBtn.onclick = () => {
        const zeit = uhrzeitJetzt();
        if (!punkt.pauseAktiv) {
          pauseZeileAnhaengen(verlaufFeld, '— Sitzung um ' + zeit + ' Uhr unterbrochen —');
          punkt.pauseAktiv = true;
        } else {
          pauseZeileAnhaengen(verlaufFeld, '— Sitzung um ' + zeit + ' Uhr fortgesetzt —');
          punkt.pauseAktiv = false;
        }
        speichern();
        pauseLabel();
      };
    }
  }

  const bContainer = el.querySelector('[data-beschluesse]');
  const renderBeschluesse = () => {
    bContainer.innerHTML = '';
    (punkt.beschluesse || []).forEach((b, bi) => bContainer.appendChild(beschlussBlock(s, punkt, b, bi, renderBeschluesse, updater)));
  };
  renderBeschluesse();
  el.querySelector('[data-tu="beschlussNeu"]').onclick = () => {
    punkt.beschluesse.push(neuerBeschluss(daten, jahrAus(s.datum)));
    speichern(); renderBeschluesse();
  };

  const aContainer = el.querySelector('[data-aufgaben]');
  const renderAufgaben = () => {
    aContainer.innerHTML =
      '<label class="aufgaben-label">Aufgaben (wer macht was bis wann)</label>' +
      (punkt.aufgaben || []).map((a, ai) =>
        '<div class="aufgabe-zeile" data-ai="' + ai + '">' +
        '<input data-f="was" placeholder="Aufgabe" class="eingabe">' +
        '<input data-f="wer" placeholder="Zuständig" class="eingabe">' +
        '<input data-f="bis" type="date" class="eingabe">' +
        '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button></div>'
      ).join('') +
      '<button class="btn btn-klein btn-geist" data-tu="neu" style="margin-top:7px">+ Aufgabe</button>';
    aContainer.querySelectorAll('[data-ai]').forEach(zeile => {
      const a = punkt.aufgaben[parseInt(zeile.dataset.ai, 10)];
      bindeText(zeile.querySelector('[data-f="was"]'), () => a.was, v => { a.was = v; });
      bindeText(zeile.querySelector('[data-f="wer"]'), () => a.wer, v => { a.wer = v; });
      bindeText(zeile.querySelector('[data-f="bis"]'), () => a.bis, v => { a.bis = v; });
      zeile.querySelector('[data-tu="weg"]').onclick = () => { punkt.aufgaben.splice(parseInt(zeile.dataset.ai, 10), 1); speichern(); renderAufgaben(); };
    });
    aContainer.querySelector('[data-tu="neu"]').onclick = () => { punkt.aufgaben.push(neueAufgabe()); speichern(); renderAufgaben(); };
  };
  renderAufgaben();
}

function beschlussBlock(s, top, b, bi, neuZeichnen, updater) {
  const el = document.createElement('div');
  el.className = 'beschluss-block';
  el.innerHTML =
    '<div class="bb-kopf"><span class="bb-nr">Beschluss Nr. ' +
      '<input data-f="lfd" type="number" min="1" class="bb-lfd"> / ' + b.jahr + '</span>' +
      '<span class="ergebnis-anzeige" data-ergebnis></span>' +
      '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Beschluss entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button></div>' +
    '<div class="feld"><label>Wortlaut des Beschlusses</label>' +
    '<textarea data-f="antrag" placeholder=\'z. B. „Der Betriebsrat beschließt, ..."\'></textarea>' +
    '<div style="margin-top:6px"><button type="button" class="btn btn-klein btn-geist" data-tu="baustein" ' +
      'title="Vorformulierten Beschlusstext einfügen">+ Textblock einfügen</button></div></div>' +
    '<div class="raster s4" style="margin-top:10px">' +
    '<div class="feld"><label>Ja-Stimmen</label><input data-f="ja" type="number" min="0"></div>' +
    '<div class="feld"><label>Nein-Stimmen</label><input data-f="nein" type="number" min="0"></div>' +
    '<div class="feld"><label>Enthaltungen</label><input data-f="enthaltung" type="number" min="0"></div>' +
    '<div class="feld"><label>Ergebnis</label><select data-f="ergebnis">' +
      '<option value="auto">automatisch</option><option value="angenommen">angenommen</option><option value="abgelehnt">abgelehnt</option>' +
    '</select></div></div>' +
    '<div class="feld" style="margin-top:10px;max-width:240px"><label>Status (Umsetzung)</label><select data-f="status">' +
      Object.keys(BESCHLUSS_STATUS).map(k => '<option value="' + k + '">' + BESCHLUSS_STATUS[k] + '</option>').join('') +
    '</select></div>' +
    '<details class="bb-beteiligung" style="margin-top:10px"><summary data-beteiligung-titel></summary>' +
      '<p class="klein-grau" style="margin:6px 0">Anwesende Mitglieder, die an dieser Abstimmung nicht teilnehmen – etwa weil sie selbst betroffen und deshalb nicht stimmberechtigt sind oder den Raum verlassen haben. Die Mehrheit wird dann nur aus den Beteiligten berechnet.</p>' +
      '<div data-beteiligung></div></details>' +
    '<div class="klein-grau" data-warnung style="margin-top:6px"></div>' +
    '<div class="bb-tags" data-tags style="margin-top:8px"></div>';

  const zeige = () => {
    const q = abstimmungsBasis(daten, s, b, top);
    const aus = beschlussAuswertung(b, q.teilnehmend);
    const anz = el.querySelector('[data-ergebnis]');
    anz.textContent = (aus.angenommen ? 'Angenommen' : 'Abgelehnt') +
      ' · ' + aus.ja + ' Ja / ' + aus.nein + ' Nein / ' + aus.enth + ' Enth.' + (aus.manuell ? ' (manuell)' : '');
    anz.className = 'ergebnis-anzeige ' + (aus.angenommen ? 'st-gruen' : 'st-rot');
    const w = el.querySelector('[data-warnung]');
    let hinweis = '';
    if (q.reduziert && q.erfasst && !q.beschlussfaehig) {
      hinweis = '⚠ Nur ' + q.teilnehmend + ' Mitglieder sind an dieser Abstimmung beteiligt – für diese Abstimmung nicht beschlussfähig (erforderlich: ' + q.erforderlich + ').';
    } else if (aus.warnung) hinweis = '⚠ ' + aus.warnung;
    else if (!aus.manuell && q.teilnehmend > 0 && !aus.angenommen && aus.ja > aus.nein) {
      hinweis = 'Hinweis: Mehr Ja- als Nein-Stimmen, aber keine Mehrheit der ' + q.teilnehmend + ' teilnehmenden Mitglieder – Enthaltungen wirken wie Nein-Stimmen.';
    }
    w.textContent = hinweis;
    el.querySelector('[data-beteiligung-titel]').textContent = 'Nicht an der Abstimmung beteiligt' +
      (q.ausgenommen.length ? ' (' + q.ausgenommen.length + ')' : '');
  };

  /* Zur Auswahl stehen die bei diesem TOP anwesenden Mitglieder; bei geänderter Anwesenheit neu aufbauen. */
  const renderBeteiligung = () => {
    const box = el.querySelector('[data-beteiligung]');
    const dabei = abstimmungsBasis(daten, s, b, top).dabei;
    if (!dabei.length) { box.innerHTML = '<span class="klein-grau">Für diesen TOP ist noch keine Anwesenheit erfasst.</span>'; return; }
    b.nichtBeteiligt = b.nichtBeteiligt || {};
    box.innerHTML = dabei.map(m =>
      '<div class="mitglied-zeile" style="margin-top:4px"><span style="flex:1">' + esc(nameMitRolle(m)) + '</span>' +
      '<select class="eingabe" data-mitglied="' + esc(m.id) + '" aria-label="Beteiligung ' + esc(m.name) + '">' +
        '<option value="">stimmt ab</option>' +
        Object.keys(NICHT_BETEILIGT).map(k => '<option value="' + k + '">' + NICHT_BETEILIGT[k] + '</option>').join('') +
      '</select></div>').join('');
    box.querySelectorAll('[data-mitglied]').forEach(sel => {
      sel.value = b.nichtBeteiligt[sel.dataset.mitglied] || '';
      sel.disabled = !darfBearbeiten();
      sel.onchange = () => {
        if (sel.value) b.nichtBeteiligt[sel.dataset.mitglied] = sel.value;
        else delete b.nichtBeteiligt[sel.dataset.mitglied];
        speichern(); zeige();
      };
    });
  };
  updater.push(() => { renderBeteiligung(); zeige(); });
  renderBeteiligung();

  bindeText(el.querySelector('[data-f="lfd"]'), () => b.lfd, v => { b.lfd = parseInt(v, 10) || b.lfd; });
  const antragFeld = el.querySelector('[data-f="antrag"]');
  bindeText(antragFeld, () => b.antrag, v => { b.antrag = v; });
  const bausteinBtn = el.querySelector('[data-tu="baustein"]');
  if (bausteinBtn) bausteinBtn.onclick = () => { if (darfBearbeiten()) vorlageMenueOeffnen(antragFeld, 'beschluss'); };
  ['ja', 'nein', 'enthaltung'].forEach(f =>
    bindeText(el.querySelector('[data-f="' + f + '"]'), () => b[f], v => { b[f] = v; }, zeige));
  const erg = el.querySelector('[data-f="ergebnis"]');
  erg.value = b.ergebnis || 'auto';
  erg.disabled = !darfBearbeiten();
  erg.onchange = () => { b.ergebnis = erg.value; speichern(); zeige(); };
  const stat = el.querySelector('[data-f="status"]');
  stat.value = b.status || 'in_arbeit';
  stat.disabled = !darfBearbeiten();
  stat.onchange = () => { b.status = stat.value; speichern(); };
  el.querySelector('[data-tu="weg"]').onclick = () =>
    bestaetigen('Beschluss entfernen?', 'Beschluss Nr. ' + beschlussNrText(b) + ' wird aus dem Protokoll entfernt.',
      () => { top.beschluesse.splice(bi, 1); speichern(); neuZeichnen(); }, 'Entfernen', true);

  const tagBox = el.querySelector('[data-tags]');
  const renderTagChips = () => {
    const tags = daten.beschlussTags || [];
    if (!tags.length) { tagBox.innerHTML = '<span class="klein-grau">Noch keine Schlagworte hinterlegt.</span>'; return; }
    b.tags = b.tags || [];
    tagBox.innerHTML = '<span class="klein-grau" style="margin-right:4px">Tags:</span>' + tags.map(t => {
      const an = b.tags.includes(t.id);
      return '<button class="tag-chip' + (an ? ' an' : '') + '" data-tag="' + t.id + '"' +
        (an ? ' style="background:' + t.farbe + ';border-color:' + t.farbe + '"' : '') + '>' + esc(t.name || 'Tag') + '</button>';
    }).join('');
    if (!darfBearbeiten()) return;   /* Nur-Lese-Ansicht: Tags nur anzeigen, nicht umschaltbar */
    tagBox.querySelectorAll('[data-tag]').forEach(ch => ch.onclick = () => {
      const id = ch.dataset.tag;
      if (b.tags.includes(id)) b.tags = b.tags.filter(x => x !== id); else b.tags.push(id);
      speichern(); renderTagChips();
    });
  };
  renderTagChips();

  zeige();
  return el;
}

function beschlussTagObjekte(b) {
  return ((b && b.tags) || []).map(id => (daten.beschlussTags || []).find(t => t.id === id)).filter(Boolean);
}
