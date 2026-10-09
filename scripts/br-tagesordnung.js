'use strict';

function dateienEinlesen(dateiListe, fertig) {
  const dateien = Array.from(dateiListe || []);
  if (!dateien.length) return fertig([]);
  const ergebnisse = [];
  let offen = dateien.length;
  dateien.forEach(f => {
    if (f.size > 15 * 1024 * 1024) {
      zeigeToast('„' + f.name + '" ist sehr groß (' + fmtBytes(f.size) + '). Große Anlagen vergrößern die Projektdatei erheblich.', 'fehler');
    }
    const r = new FileReader();
    r.onload = () => {
      ergebnisse.push({ id: uid(), name: f.name, mime: f.type || '', size: f.size, dataUrl: r.result });
      if (--offen === 0) fertig(ergebnisse);
    };
    r.onerror = () => { zeigeToast('Datei konnte nicht gelesen werden: ' + f.name, 'fehler'); if (--offen === 0) fertig(ergebnisse); };
    r.readAsDataURL(f);
  });
}

/* Nur lesend im Protokollmodul: Anlagen-Dateien liegen beim Sitzungsmanager, ein Upload hier käme nirgends an. */
function renderAnlagenWidget(c, liste, beschriftung, nachAenderung) {
  const nurLesen = !modusHatAnsicht('dokumente');
  const neuZeichnen = () => {
    c.innerHTML =
      (beschriftung ? '<label style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--grau);font-weight:600">' + esc(beschriftung) + '</label>' : '') +
      liste.map((a, i) => {
        const kuerzel = istPdfAnlage(a) ? 'PDF' : istBildAnlage(a) ? 'BILD' : (a.name.split('.').pop() || 'DATEI').slice(0, 4).toUpperCase();
        return '<div class="anlage-zeile" data-i="' + i + '">' +
          '<div class="a-symbol" title="Anlage – im Anlagenverzeichnis der PDFs aufgeführt">' + kuerzel + '</div>' +
          '<div class="a-name" title="' + esc(a.name) + '">' + esc(a.name) + '</div>' +
          '<div class="a-meta">' + fmtBytes(a.size) + '</div>' +
          (nurLesen ? '' :
            '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
            '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>') +
          ((istPdfAnlage(a) || istBildAnlage(a))
            ? '<button class="btn btn-symbol btn-geist" data-tu="ansehen" title="Im Browser ansehen">&#128065;</button>'
            : '<button class="btn btn-symbol btn-geist" data-tu="laden" title="Datei herunterladen">&#8681;</button>') +
          (nurLesen ? '' : '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button>') +
        '</div>';
      }).join('') +
      (nurLesen
        ? '<div class="anlage-hinzu"><span class="klein-grau">' +
          (liste.length ? 'Diese Anlagen sind Verweise für das Anlagenverzeichnis – die Dateien selbst liegen im BR-Sitzungsmanager. '
                        : 'Keine Anlagen. ') +
          'Anlagen legt die Sitzungsleitung im BR-Sitzungsmanager ab; sie kommen mit der Tagesordnung hierher.</span></div>'
        : '<div class="anlage-hinzu"><button class="btn btn-klein" data-tu="neu">+ Anlage(n) hinzufügen</button>' +
          ' <span class="klein-grau">Anlagen werden im Anlagenverzeichnis der PDFs aufgeführt und sind über den BR-Sitzungsmanager einsehbar (keine Einbettung ins PDF).</span></div>');

    c.querySelectorAll('[data-tu]').forEach(btn => btn.onclick = async () => {
      const zeile = btn.closest('.anlage-zeile');
      const i = zeile ? parseInt(zeile.dataset.i, 10) : -1;
      const tu = btn.dataset.tu;
      if (tu === 'neu') {
        anlagenZielCallback = neue => {
          liste.push(...neue);
          speichern(); neuZeichnen();
          if (nachAenderung) nachAenderung();
        };
        document.getElementById('dateiAnlagen').click();
      } else if (tu === 'weg') {
        liste.splice(i, 1); speichern(); neuZeichnen(); if (nachAenderung) nachAenderung();
      } else if (tu === 'hoch' && i > 0) {
        [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; speichern(); neuZeichnen();
      } else if (tu === 'runter' && i < liste.length - 1) {
        [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]]; speichern(); neuZeichnen();
      } else if (tu === 'ansehen') {
        const a = liste[i];
        const bytes = await anlageBytes(a);
        if (!bytes) return zeigeToast(anlageFehltMeldung(), 'fehler');
        const url = URL.createObjectURL(new Blob([bytes], { type: a.mime || 'application/octet-stream' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else if (tu === 'laden') {
        const a = liste[i];
        dateiHerunterladen(new Blob([dataUrlZuBytes(a.dataUrl)], { type: a.mime || 'application/octet-stream' }), a.name);
      }
    });
  };
  neuZeichnen();
}

/* Reiter „Tagesordnung" */

function renderTabTagesordnung(c, s) {
  c.innerHTML =
    '<div class="karte"><div class="karte-kopf"><h3>Tagesordnung zur Einladung</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-klein" id="toStandard">Standard-TOPs einfügen</button>' +
      '<button class="btn btn-klein btn-primaer" id="toNeu">+ Tagesordnungspunkt</button></div></div>' +
    '<div class="karte-koerper">' + topSprungleisteHtml(s) + '<div id="topListe"></div></div>' +
    '<div class="karte-fuss">Formulieren Sie jeden TOP so konkret, dass sich alle Mitglieder vorbereiten können – zu unbestimmte Punkte gefährden die Wirksamkeit der Beschlüsse. Unter „Verschiedenes" sollten keine Beschlüsse gefasst werden; eine Ergänzung der Tagesordnung in der Sitzung ist nur bei Beschlussfähigkeit und Einstimmigkeit aller Anwesenden möglich.</div></div>' +
    '<div class="karte"><div class="karte-kopf"><h3>Weitere Anlagen zur Einladung</h3></div>' +
    '<div class="karte-koerper"><div id="anlTO"></div>' +
    '<p class="klein-grau" style="margin-top:10px">Anlagen einzelner TOPs fügen Sie direkt beim jeweiligen Punkt hinzu. Alle Anlagen werden im PDF automatisch fortlaufend nummeriert und im Anlagenverzeichnis der Einladung aufgeführt.</p>' +
    '</div></div>';

  c.querySelector('#toNeu').onclick = () => { s.tops.push(neuerTop()); speichern(); renderHaupt(); };
  c.querySelector('#toStandard').onclick = () => {
    const eingefuegt = standardTopsEinfuegen(s);
    speichern(); renderHaupt();
    zeigeToast(eingefuegt ? eingefuegt + ' Standard-TOP(s) eingefügt.' : 'Standard-TOPs sind bereits vorhanden.');
  };

  const liste = c.querySelector('#topListe');
  if (!s.tops.length) {
    liste.innerHTML = '<p class="klein-grau">Noch keine Tagesordnungspunkte. Nutzen Sie „Standard-TOPs einfügen" für die üblichen Formalia (Begrüßung, Ladung/Beschlussfähigkeit, Genehmigung von Tagesordnung und letzter Niederschrift) und ergänzen Sie Ihre Sachthemen.</p>';
  }
  s.tops.forEach((top, i) => liste.appendChild(topEditor(s, top, i)));
  topSprungleisteVerdrahten(c);
  renderAnlagenWidget(c.querySelector('#anlTO'), s.anlagenTO, '');
}

function topEditor(s, top, i) {
  const wrap = document.createElement('div');
  wrap.className = 'top-eintrag';
  wrap.setAttribute('data-topanker', top.id || '');
  wrap.innerHTML =
    '<div class="top-kopf"><span class="top-nr">TOP ' + (i + 1) + '</span>' +
    '<input class="top-titel-eingabe" placeholder="Titel des Tagesordnungspunkts" aria-label="Titel TOP ' + (i + 1) + '">' +
    '<div class="top-werkzeuge">' +
    klappButtonHtml(top) +
    '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
    '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
    '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="TOP entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
    '</div></div>' +
    '<div class="top-koerper"><div class="raster s3">' +
    '<div class="feld"><label>Art des TOP</label><select data-f="kategorie">' + kategorieOptionenHtml() + '</select></div>' +
    '<div class="feld"><label>Referent/in</label><input data-f="referent" placeholder="optional"></div>' +
    '<div class="feld"><label>Geplante Dauer (Min.)</label><input data-f="dauer" type="number" min="0" step="5" placeholder="optional"></div>' +
    '</div>' +
    '<div class="feld" style="margin-top:12px"><label>Erläuterung / Beschlussvorlage für die Einladung</label>' +
    '<textarea data-f="beschreibung" placeholder="Worum geht es? Bei Beschluss-TOPs empfiehlt sich der vorbereitete Antragstext, damit sich alle vorbereiten können."></textarea></div>' +
    '<div class="anlagen-bereich" data-anlagen></div>' +
    '</div>';

  const titel = wrap.querySelector('.top-titel-eingabe');
  bindeText(titel, () => top.titel, v => { top.titel = v; });
  const kat = wrap.querySelector('[data-f="kategorie"]');
  kat.value = kategorieOderLeer(top.kategorie);
  kat.onchange = () => { top.kategorie = kat.value; speichern(); };
  bindeText(wrap.querySelector('[data-f="referent"]'), () => top.referent, v => { top.referent = v; });
  bindeText(wrap.querySelector('[data-f="dauer"]'), () => top.dauer, v => { top.dauer = v; });
  bindeText(wrap.querySelector('[data-f="beschreibung"]'), () => top.beschreibung, v => { top.beschreibung = v; });

  wrap.querySelectorAll('.top-werkzeuge [data-tu]').forEach(btn => btn.onclick = () => {
    const tu = btn.dataset.tu;
    if (tu === 'weg') {
      bestaetigen('TOP entfernen?', '„TOP ' + (i + 1) + (top.titel ? ': ' + top.titel : '') + '" wird samt Anlagen, Beschlüssen und Protokolltext entfernt.',
        () => { s.tops.splice(i, 1); speichern(); renderHaupt(); }, 'Entfernen', true);
    } else if (tu === 'hoch' && i > 0) {
      [s.tops[i - 1], s.tops[i]] = [s.tops[i], s.tops[i - 1]]; speichern(); renderHaupt();
    } else if (tu === 'runter' && i < s.tops.length - 1) {
      [s.tops[i + 1], s.tops[i]] = [s.tops[i], s.tops[i + 1]]; speichern(); renderHaupt();
    }
  });

  klappVerdrahten(wrap, top);
  renderAnlagenWidget(wrap.querySelector('[data-anlagen]'), top.anlagen, 'Anlagen zu diesem TOP');

  const upBox = document.createElement('div');
  upBox.className = 'unterpunkte-bereich';
  wrap.querySelector('.top-koerper').appendChild(upBox);
  renderUnterpunkteEditor(upBox, s, top, i);
  return wrap;
}

function renderUnterpunkteEditor(container, s, top, i) {
  const liste = top.unterpunkte || (top.unterpunkte = []);
  container.innerHTML =
    '<div class="up-titel">Unterpunkte</div><div data-upliste></div>' +
    '<button class="btn btn-klein btn-geist" data-tu="neu" style="margin-top:7px">+ Unterpunkt</button>';
  const box = container.querySelector('[data-upliste]');
  const neuBtn = container.querySelector('[data-tu="neu"]');   /* Vor zeichne() holen: Unterpunkt-Anlagen-Widgets erzeugen selbst data-tu="neu"-Buttons. */
  const zeichne = () => {
    box.innerHTML = '';
    liste.forEach((u, j) => {
      const nr = (i + 1) + '.' + (j + 1);
      const z = document.createElement('div');
      z.className = 'unterpunkt-zeile';
      z.setAttribute('data-upanker', u.id || '');
      z.innerHTML =
        '<div class="up-kopf"><span class="top-nr">' + nr + '</span>' +
        '<input class="top-titel-eingabe" data-f="titel" placeholder="Titel des Unterpunkts">' +
        '<div class="up-werkzeuge">' +
        '<button class="btn btn-symbol btn-geist" data-tu="hoch" title="Nach oben"><svg class="ic"><use href="#ic-hoch"/></svg></button>' +
        '<button class="btn btn-symbol btn-geist" data-tu="runter" title="Nach unten"><svg class="ic"><use href="#ic-runter"/></svg></button>' +
        '<button class="btn btn-symbol btn-geist btn-gefahr" data-tu="weg" title="Unterpunkt entfernen"><svg class="ic"><use href="#ic-weg"/></svg></button>' +
        '</div></div>' +
        '<div class="feld up-kategorie"><label>Art des Unterpunkts</label><select data-f="kategorie">' + kategorieOptionenHtml() + '</select></div>' +
        '<div class="feld"><textarea data-f="beschreibung" placeholder="Erläuterung / Beschlussvorlage für die Einladung"></textarea></div>' +
        '<div class="anlagen-bereich" data-anlagen></div>';
      box.appendChild(z);
      bindeText(z.querySelector('[data-f="titel"]'), () => u.titel, v => { u.titel = v; });
      const ukat = z.querySelector('[data-f="kategorie"]');
      ukat.value = kategorieOderLeer(u.kategorie);
      ukat.onchange = () => { u.kategorie = ukat.value; speichern(); };
      bindeText(z.querySelector('[data-f="beschreibung"]'), () => u.beschreibung, v => { u.beschreibung = v; });
      renderAnlagenWidget(z.querySelector('[data-anlagen]'), u.anlagen || (u.anlagen = []), 'Anlagen zu diesem Unterpunkt');
      z.querySelectorAll('.up-werkzeuge [data-tu]').forEach(btn => btn.onclick = () => {
        const tu = btn.dataset.tu;
        if (tu === 'weg') {
          bestaetigen('Unterpunkt entfernen?', 'Unterpunkt ' + nr + (u.titel ? ': ' + u.titel : '') + ' wird samt Beschlüssen und Aufgaben entfernt.',
            () => { liste.splice(j, 1); speichern(); renderHaupt(); }, 'Entfernen', true);
        } else if (tu === 'hoch' && j > 0) {
          [liste[j - 1], liste[j]] = [liste[j], liste[j - 1]]; speichern(); renderHaupt();
        } else if (tu === 'runter' && j < liste.length - 1) {
          [liste[j + 1], liste[j]] = [liste[j], liste[j + 1]]; speichern(); renderHaupt();
        }
      });
    });
  };
  zeichne();
  /* Neuer Unterpunkt startet mit der Kategorie des TOP und lässt sich danach frei ändern. */
  neuBtn.onclick = () => { liste.push(neuerUnterpunkt({ kategorie: kategorieOderLeer(top.kategorie) })); speichern(); renderHaupt(); };
}
