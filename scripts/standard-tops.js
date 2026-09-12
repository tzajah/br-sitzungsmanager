/* Hat Vorrang vor der in der App gespeicherten Liste. kategorie: formalia | information | beratung | beschluss | sonstiges.
   Optional „unterpunkte": [{"titel":"…"}] (Kurzform: ["Erster","Zweiter"]) – erzeugt Unterpunkte 1.1, 1.2 … */
window.BR_STANDARD_TOPS = [
  { "titel": "Begrüßung und Eröffnung der Sitzung", "kategorie": "formalia" },
  { "titel": "Feststellung der ordnungsgemäßen Ladung und der Beschlussfähigkeit", "kategorie": "formalia" },
  { "titel": "Genehmigung der Tagesordnung", "kategorie": "beschluss" },
  { "titel": "Genehmigung der Niederschrift der letzten Sitzung", "kategorie": "beschluss" },
  {
    "titel": "Berichte", "kategorie": "information",
    "unterpunkte": [
      { "titel": "Bericht der/des Vorsitzenden" },
      { "titel": "Bericht aus den Ausschüssen" },
      { "titel": "Bericht der Schwerbehindertenvertretung" }
    ]
  },
  { "titel": "Verschiedenes", "kategorie": "sonstiges" }
];
