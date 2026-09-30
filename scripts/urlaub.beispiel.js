/* Urlaubs-/Abwesenheitskalender für den BR-Manager (liegt in scripts/, wird beim Öffnen automatisch geladen).

   Reine Lesequelle: Einträge werden NICHT in der App bearbeitet, NICHT im Browser gespeichert
   und NICHT in die Sicherungsdatei übernommen. Ändern = diese Datei auf dem Netzlaufwerk anpassen;
   fehlt sie, läuft die App unverändert weiter.

   Wirkung in der App:
   - Reiter „Sitzung": Warnung, wer am Sitzungsdatum abwesend ist.
   - Reiter „Protokoll": diese Mitglieder werden als „Entschuldigt" vorbelegt, solange kein
     Teilnahmestatus erfasst ist (bereits erfasste Angaben bleiben unberührt).
   - Admin-Menü → „Urlaub": Gesamtübersicht, warnt bei Namen ohne Zuordnung zu den Stammdaten.

   Felder: name (exakt wie im Admin-Menü unter „Personen", Groß-/Kleinschreibung egal),
   von/bis (ISO JJJJ-MM-TT, bis weglassen = eintägig), grund (Freitext, Standard „Urlaub").

   Beispieleinträge unten durch die echten Zeiträume ersetzen.

   Datenschutz: Mit echten Namen enthält diese Datei personenbezogene Daten – wie
   br-zugang.js nur auf das geschützte BR-Laufwerk, nicht in die Versionsverwaltung. */
window.BR_URLAUB = [
  { "name": "Erika Mustermann", "von": "2026-08-10", "bis": "2026-08-28", "grund": "Urlaub" },
  { "name": "Max Mustermann",   "von": "2026-09-07", "bis": "2026-09-11", "grund": "Fortbildung" },
  { "name": "Max Mustermann",   "von": "2026-12-21", "bis": "2027-01-02", "grund": "Urlaub" }
];
