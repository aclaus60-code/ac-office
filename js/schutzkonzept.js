/* =====================================================================
   AC Office – Schutzkonzept-Assistent (schutzkonzept.js)
   Daten:  schutzkonzepte/SK-2026-001.json   (jederzeit weiter bearbeitbar)
   PDF:    schutzkonzepte/SK-2026-001_Kunde_Objekt_v1.0.pdf
   Aufbau wie die Word-Vorlage: Deckblatt + 8 Abschnitte, jeder auf neuer Seite
   ===================================================================== */
'use strict';
const SK = AC.SK = {
  /* ---------- Bausteinbibliotheken (Ergänzungen einfach hier eintragen) ---------- */
  LIB: {
    bedrohungen: [
      ['Einbruch / Diebstahl außerhalb der Betriebszeit', 'Sachwerte, Lager'], ['Diebstahl während der Betriebszeit (Innentäter)', 'Sachwerte, Waren'],
      ['Vandalismus / Sachbeschädigung', 'Gebäude, Fahrzeuge'], ['Sabotage an Anlagen', 'Betriebsablauf'], ['Brandstiftung', 'Gebäude, Personen'],
      ['Unbefugter Zutritt / unbefugte Zufahrt', 'Personen, Sachwerte'], ['Überfall / Übergriff auf Beschäftigte', 'Personen'],
      ['Bedrohung und Aggression im Kundenkontakt', 'Personen'], ['Spionage / Informationsabfluss', 'Informationen'],
      ['Ausfall von Sicherheitstechnik oder Stromversorgung', 'Betriebsablauf'], ['Metalldiebstahl auf dem Freigelände', 'Sachwerte'],
      ['Störungen bei Veranstaltungen / Menschenansammlungen', 'Personen, Ansehen'],
    ],
    schutzgueter: ['Personen (Mitarbeitende, Besucher, Fremdfirmen)', 'Sachwerte (Gebäude, Anlagen, Waren, Fahrzeuge)', 'Informationen (Daten, Unterlagen, Know-how)', 'Betriebsablauf (Produktion, Lieferketten)', 'Ansehen und Vertrauen des Unternehmens'],
    ziele: [
      ['Sachwerte', 'Unbefugtes Eindringen wird erkannt, bevor Schaden entsteht.', 'Alarm bei Öffnung; Intervention schneller als Widerstandszeit'],
      ['Personen, Sachwerte', 'Zutritt ist nur Berechtigten möglich und wird dokumentiert.', 'Zutritt nur mit Ausweis/Schlüssel; Protokoll'],
      ['Personen', 'Beschäftigte sind vor Übergriffen geschützt und können jederzeit Hilfe rufen.', 'Notruf jederzeit möglich; Hilfe in wenigen Minuten'],
      ['Personen, Gebäude', 'Brände werden früh erkannt und gemeldet.', 'Aufschaltung BMA; Alarmierung Feuerwehr'],
      ['Informationen', 'Vertrauliche Informationen bleiben geschützt.', 'Zugriff nur nach Berechtigung; Clean-Desk'],
      ['Betriebsablauf', 'Der Betrieb läuft bei Störungen geordnet weiter.', 'Notfallplan vorhanden und geübt'],
    ],
    T: [
      ['Perimeter', 'Zaunanlage ertüchtigen, Übersteigschutz, Tore schließen', ''], ['Beleuchtung', 'Außenbeleuchtung mit Bewegungsmeldern', ''],
      ['Mechanik', 'Einbruchhemmende Türen und Fenster (Widerstandsklasse RC 2 / RC 3)', 'DIN EN 1627'], ['Schließanlage', 'Schließanlage mit Sicherungskarte bzw. elektronische Schließanlage', ''],
      ['Einbruchmeldetechnik', 'Einbruchmeldeanlage mit Aufschaltung auf NSL', 'DIN EN 50131, DIN VDE 0833'], ['Videoüberwachung', 'Videoüberwachung kritischer Bereiche', 'DIN EN 62676-4'],
      ['Zutrittskontrolle', 'Elektronische Zutrittskontrolle', 'DIN EN 60839-11-1'], ['Brandmeldetechnik', 'Brandmeldeanlage mit Aufschaltung', 'DIN 14675, DIN VDE 0833-2'],
      ['Überfallmeldung', 'Überfalltaster / Personen-Notsignal-Anlage', 'DGUV Regel 112-139'], ['Übertragung / Notstrom', 'Redundanter Übertragungsweg und Notstromversorgung', 'DIN EN 50136'],
      ['Wertbehältnis', 'Wertschutzschrank', 'DIN EN 1143-1'],
    ],
    O: [
      ['Dienstanweisung', 'Dienst- und Postenanweisungen erstellen bzw. aktualisieren', ''], ['Alarmplan', 'Alarm- und Interventionsplan erstellen, Erreichbarkeiten pflegen', ''],
      ['Schlüssel / Ausweise', 'Schlüssel- und Ausweisverwaltung mit Ausgabeprotokoll', ''], ['Besucher / Fremdfirmen', 'Besucher- und Fremdfirmenmanagement mit Anmeldung', ''],
      ['Kontrollgänge', 'Kontrollgänge und Schließrunden mit Wächterkontrollsystem', ''], ['Notfallmanagement', 'Notfall- und Krisenplan mit Übungen', ''],
      ['Meldewege', 'Melde- und Eskalationswege festlegen', ''], ['Wartung', 'Wartung und Prüfung der Sicherheitstechnik dokumentieren', 'DIN VDE 0833-1'],
      ['Informationsschutz', 'Clean-Desk-Regel, Aktenvernichtung', 'DIN 66399'],
    ],
    P: [
      ['Empfang / Pforte', 'Empfangs- und Pfortendienst', '§ 34a GewO'], ['Revierdienst', 'Revier- und Streifendienst außerhalb der Betriebszeit', '§ 34a GewO'],
      ['Intervention', 'Interventionsdienst bei Alarm', '§ 34a GewO, DIN 77200-1'], ['Sensibilisierung', 'Unterweisung und Sensibilisierung der Beschäftigten', '§ 12 ArbSchG'],
      ['Erste Hilfe / Brandschutz', 'Ersthelfer und Brandschutzhelfer ausbilden', 'DGUV Vorschrift 1, ASR A2.2'], ['Deeskalation', 'Deeskalationstraining für Beschäftigte mit Kundenkontakt', ''],
    ],
    quellen: ['Objektbegehung', 'Gespräche mit Verantwortlichen', 'Lage-, Grundriss- und Fluchtwegpläne', 'Vorfall- und Schadensstatistik', 'Bestehende Dienstanweisungen', 'Gefährdungsbeurteilung (ArbSchG)', 'Wartungs- und Prüfprotokolle Technik', 'Versicherungsunterlagen'],
    quali: ['Unterrichtung nach § 34a GewO', 'Sachkundeprüfung nach § 34a GewO (wo vorgeschrieben)', 'Geprüfte Schutz- und Sicherheitskraft / Fachkraft für Schutz und Sicherheit', 'Ersthelfer / Brandschutzhelfer', 'Objektbezogene Einweisung'],
    ausstattung: ['Dienstkleidung mit Kennzeichnung (§ 18 BewachV)', 'Funk / Mobiltelefon, Notruf', 'Taschenlampe, Erste-Hilfe-Material', 'Wächterkontrollsystem', 'Alleinarbeitsschutz (Personen-Notsignal)'],
    eval: [['Anzahl Vorfälle je Quartal', 'Auswertung Wachbuch / Meldungen', 'quartalsweise'], ['Falschalarme der EMA', 'Auswertung NSL-Protokolle', 'monatlich'],
      ['Funktionsfähigkeit der Technik', 'Wartungs- und Prüfprotokolle', 'jährlich'], ['Wirksamkeit Alarmplan', 'Übung mit Auswertung', 'jährlich'],
      ['Interventionszeit', 'Protokoll NSL / Interventionsdienst', 'je Alarm'], ['Sicherheitsgefühl der Beschäftigten', 'Kurzbefragung', 'jährlich']],
  },
  SECT: [
    ['Grunddaten', ''], ['Informationssammlung', 'vollständiges Bild des Objekts, seiner Nutzung und der bestehenden Sicherheitslage als Grundlage aller weiteren Schritte.'],
    ['Risikoanalyse', 'Bedrohungen erkennen und nach Eintrittswahrscheinlichkeit (EW) und Schadensausmaß (SA) bewerten. Risikowert = EW × SA.'],
    ['Schutzzieldefinition', 'festlegen, was geschützt werden soll, in welchem Umfang und woran die Zielerreichung gemessen wird.'],
    ['Maßnahmen – technisch', 'baulich-mechanische und elektronische Sicherungen, die die Schutzziele unterstützen.'],
    ['Maßnahmen – organisatorisch', 'Abläufe, Regeln und Zuständigkeiten, die den sicheren Betrieb und die richtige Reaktion im Ereignisfall sicherstellen.'],
    ['Maßnahmen – personell', 'Bedarf, Qualifikation und Einsatz des Sicherheitspersonals festlegen.'],
    ['Kostenaufstellung', 'Investitionen und laufende Kosten aller empfohlenen Maßnahmen transparent darstellen.'],
    ['Empfehlung an den Kunden und Evaluierung', 'klare Handlungsempfehlung geben und festlegen, wie die Wirksamkeit der Maßnahmen überprüft wird.'],
  ],
  EW: ['1 selten', '2 möglich', '3 wahrscheinlich', '4 häufig'], SA: ['1 gering', '2 spürbar', '3 erheblich', '4 existenzbedrohend'],
  stufe: v => v >= 9 ? 'h' : v >= 4 ? 'm' : 'g', STXT: { g: 'gering', m: 'mittel', h: 'hoch' },

  async loadAll() { return (await FS.readAll('schutzkonzepte')).sort((a, b) => b.id.localeCompare(a.id)); },
  blank() {
    return { id: '', status: 'in Arbeit', kundeId: '', objekt: '', standort: '', nutzung: '', ansprechpartner: '', datum: U.today(), version: '1.0', naechstePruefung: U.addDays(U.today(), 365), verteiler: '',
      info: { lage: '', gebaeude: '', betrieb: '', personen: '', zugaenge: '', technik: '', personal: '', intervention: '', vorfaelle: '', auflagen: '', begehung: U.today(), quellen: ['Objektbegehung', 'Gespräche mit Verantwortlichen'], gespraeche: [], eindruecke: '' },
      risiken: [], schwachstellen: '', schutzgueter: [], ziele: [], restrisiko: '', massnahmen: [], zustaendigkeiten: [],
      personal: [], quali: [], ausstattung: [], umsetzungsform: '', kostenBasis: 'Erfahrungswerten', kostenArt: 'netto', empfehlung: '', evaluierung: [] };
  },
  nextNr(list, prefix) { const n = list.filter(x => x.nr && x.nr.startsWith(prefix)).map(x => parseInt(x.nr.slice(prefix.length)) || 0); return prefix + ((n.length ? Math.max(...n) : 0) + 1); },
  async save(sk) {
    if (!sk.id) { const n = AC.settings.nummern, y = new Date().getFullYear(); if (n.schutzkonzeptJahr !== y) { n.schutzkonzeptJahr = y; n.schutzkonzept = 1; }
      sk.id = `SK-${y}-${U.pad(n.schutzkonzept, 3)}`; n.schutzkonzept++; await AC.saveSettings(); sk.erstellt = new Date().toISOString(); }
    sk.geaendert = new Date().toISOString(); const d = Object.assign({}, sk); delete d._file;
    await FS.writeJSON(`schutzkonzepte/${sk.id}.json`, d);
  },
  kosten(sk) {
    const z = { T: [0, 0], O: [0, 0], P: [0, 0] };
    sk.massnahmen.forEach(m => { z[m.art][0] += U.num(m.einmalig); z[m.art][1] += U.num(m.laufend); });
    z.G = [z.T[0] + z.O[0] + z.P[0], z.T[1] + z.O[1] + z.P[1]]; return z;
  },

  /* ---------- PDF ---------- */
  pdf(sk) {
    const k = sk.kunde || K.get(sk.kundeId) || {}, a = AC.settings.absender;
    const ctx = PDF.create('report', { title: `Schutzkonzept ${sk.objekt}`, footer: 'Schutzkonzept · VERTRAULICH' }), { doc } = ctx;
    const C = PDF.C, P = PDF, starts = [];
    const tbl2 = (rows) => P.table(ctx, null, rows.map(([l, v]) => [l, v || '']), { zebra: false, at: { columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fillColor: [228, 228, 214] } } } });
    const sec = (n) => { P.addPage(ctx); starts[n] = doc.getNumberOfPages(); ctx.y = 24;
      P.font(doc, 8, 'bold', C.olive); doc.text(`ABSCHNITT ${n}`, ctx.left, ctx.y, { charSpace: 0.6 }); ctx.y += 2;
      P.font(doc, 19, 'bold'); doc.text(SK.SECT[n][0], ctx.left, ctx.y + 6.5); ctx.y += 9.5;
      doc.setDrawColor(...C.olive); doc.setLineWidth(0.7); doc.line(ctx.left, ctx.y, ctx.left + ctx.w, ctx.y); ctx.y += 4;
      P.text(ctx, 'Ziel: ' + SK.SECT[n][1], { size: 9.5, color: C.grau, after: 3 }); };
    const sub = t => P.h(ctx, t, { size: 11.5, line: false, before: 2 });
    const ital = { fontStyle: 'italic', textColor: C.grau };
    const mTable = (art) => { const rows = sk.massnahmen.filter(m => m.art === art);
      P.table(ctx, ['Nr.', 'Bereich', 'Ist-Zustand', 'Maßnahme', 'Bezug', 'Prio', 'Norm / Grundlage'], rows.length ? rows.map(m => [m.nr, m.bereich, m.ist, m.massnahme, m.bezug, m.prio, m.norm]) : [[{ content: 'Keine Maßnahmen in diesem Bereich.', colSpan: 7, styles: ital }]],
        { size: 9, at: { columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 28 }, 4: { cellWidth: 15, halign: 'center' }, 5: { cellWidth: 11, halign: 'center' }, 6: { cellWidth: 28 } } } });
      P.text(ctx, 'Priorität: A = kurzfristig (bis 3 Monate) · B = mittelfristig (bis 12 Monate) · C = langfristig / bei Gelegenheit', { size: 8.5, color: C.grau, after: 3 }); };

    /* Deckblatt */
    ctx.y = 46; P.font(doc, 9, 'bold', C.rot); doc.text('VERTRAULICH', ctx.left, ctx.y, { charSpace: 0.8 }); ctx.y += 12;
    P.font(doc, 34, 'bold'); doc.text('Schutzkonzept', ctx.left, ctx.y); ctx.y += 9;
    P.font(doc, 14, 'normal', C.grau); doc.text(P.clean(`Objekt: ${sk.objekt || '–'}`), ctx.left, ctx.y); ctx.y += 4;
    doc.setDrawColor(...C.olive); doc.setLineWidth(1); doc.line(ctx.left, ctx.y, ctx.left + 40, ctx.y); ctx.y += 7;
    tbl2([['Auftraggeber', K.name(k) + (k.ort ? ', ' + K.ort(k) : '')], ['Objekt / Standort', [sk.objekt, sk.standort].filter(Boolean).join(', ')], ['Nutzung des Objekts', sk.nutzung], ['Ansprechpartner', sk.ansprechpartner],
      ['Erstellt am / Version', `${U.de(sk.datum)} / Version ${sk.version}`], ['Nächste Überprüfung', U.de(sk.naechstePruefung)], ['Verfasser', `${a.name}, ${a.titel}, ${a.quali}`], ['Verteiler', sk.verteiler]]);
    P.h(ctx, 'Inhalt', { size: 13, before: 4 }); const tocY = ctx.y; ctx.y += 8 * 6.2 + 4;
    P.box(ctx, 'Umgang mit diesem Dokument', 'Das Schutzkonzept enthält Angaben über Schwachstellen und Sicherungsmaßnahmen des Objekts. Es ist vertraulich zu behandeln, nur dem Verteiler zugänglich zu machen und verschlossen aufzubewahren. Kopien und Weitergabe nur mit Zustimmung des Auftraggebers.');

    /* 1 Informationssammlung */
    sec(1); const i = sk.info;
    sub('1.1  Objektdaten'); tbl2([['Lage und Umgebung', i.lage], ['Gebäude / Gelände', i.gebaeude], ['Nutzung / Betriebszeiten', i.betrieb], ['Personen im Objekt', i.personen], ['Zugänge / Zufahrten', i.zugaenge],
      ['Vorhandene Sicherheitstechnik', i.technik], ['Vorhandenes Sicherheitspersonal', i.personal], ['Interventionszeiten', i.intervention], ['Vorfälle der letzten 3 Jahre', i.vorfaelle], ['Auflagen / Vorgaben', i.auflagen]]);
    sub('1.2  Informationsquellen'); P.checks(ctx, SK.LIB.quellen.map(q => q === 'Objektbegehung' && i.begehung ? `Objektbegehung am ${U.de(i.begehung)}` : q), i.quellen.map(q => q === 'Objektbegehung' && i.begehung ? `Objektbegehung am ${U.de(i.begehung)}` : q));
    if (i.gespraeche.length) { sub('1.3  Gesprächspartner'); P.table(ctx, ['Name', 'Funktion', 'Datum', 'Thema'], i.gespraeche.map(g => [g.name, g.funktion, U.de(g.datum), g.thema])); }
    if (i.eindruecke) { sub(`${i.gespraeche.length ? '1.4' : '1.3'}  Erste Eindrücke aus der Begehung`); P.text(ctx, i.eindruecke, { size: 10 }); }

    /* 2 Risikoanalyse */
    sec(2); sub('2.1  Bewertungsmatrix');
    const fill = { g: [220, 230, 207], m: [244, 228, 174], h: [235, 192, 185] };
    const cnt = (e, s) => sk.risiken.filter(r => +r.ew === e && +r.sa === s).map(r => r.nr).join(', ');
    P.table(ctx, ['EW ↓ / SA →', ...SK.SA], [4, 3, 2, 1].map(e => [SK.EW[e - 1], ...[1, 2, 3, 4].map(s => ({ content: `${e * s}${cnt(e, s) ? '\n' + cnt(e, s) : ''}`, styles: { fillColor: fill[SK.stufe(e * s)], halign: 'center' } }))]),
      { size: 9, zebra: false, at: { columnStyles: Object.assign({ 0: { cellWidth: 34, fontStyle: 'bold', fillColor: [228, 228, 214] } }, ...[1, 2, 3, 4].map(c => ({ [c]: { cellWidth: (ctx.w - 34) / 4 } }))), didParseCell: d => { if (d.section === 'head') d.cell.styles.halign = 'center'; } } });
    P.text(ctx, 'Stufen: gering (1–3) beobachten · mittel (4–8) planbar reduzieren · hoch (9–16) kurzfristig handeln. In den Feldern stehen die Nummern der bewerteten Bedrohungen.', { size: 8.5, color: C.grau, after: 3 });
    sub('2.2  Bedrohungen und Bewertung');
    P.table(ctx, ['Nr.', 'Bedrohung / Szenario', 'Betroffenes Schutzgut', 'EW', 'SA', 'Risiko', 'Stufe'], sk.risiken.length ? sk.risiken.map(r => { const v = r.ew * r.sa, s = SK.stufe(v);
      return [r.nr, r.bedrohung, r.schutzgut, r.ew, r.sa, { content: String(v), styles: { fontStyle: 'bold' } }, { content: SK.STXT[s], styles: { fillColor: fill[s], fontStyle: 'bold' } }]; }) : [[{ content: 'Noch keine Bedrohungen erfasst.', colSpan: 7, styles: ital }]],
      { at: { columnStyles: { 0: { cellWidth: 11 }, 3: { cellWidth: 11, halign: 'center' }, 4: { cellWidth: 11, halign: 'center' }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 19, halign: 'center' } } } });
    if (sk.schwachstellen) { sub('2.3  Erkannte Schwachstellen'); P.text(ctx, sk.schwachstellen, { size: 10 }); }

    /* 3 Schutzziele */
    sec(3); sub('3.1  Schutzgüter'); P.checks(ctx, SK.LIB.schutzgueter, sk.schutzgueter);
    sub('3.2  Schutzziele'); P.table(ctx, ['Nr.', 'Schutzgut', 'Schutzziel', 'Messgröße / Nachweis', 'Bezug Risiko'], sk.ziele.length ? sk.ziele.map(z => [z.nr, z.schutzgut, z.ziel, z.mess, z.bezug]) : [[{ content: 'Noch keine Schutzziele erfasst.', colSpan: 5, styles: ital }]],
      { at: { columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 30 }, 4: { cellWidth: 20, halign: 'center' } } } });
    sub('3.3  Grundsatz der Sicherung');
    P.table(ctx, null, [[['Abschrecken', 'sichtbare Sicherung, Beleuchtung, Beschilderung'], ['Erkennen', 'Detektion durch Technik oder Personal'], ['Verzögern', 'mechanischer Widerstand, Zutrittshürden'], ['Reagieren', 'Alarmierung und Intervention']]
      .map(([t, x]) => ({ content: `${t}\n${x}`, styles: { halign: 'center', fillColor: [228, 228, 214] } }))], { zebra: false, size: 9,
      at: { didDrawCell: d => { if (d.section === 'body') { const t = d.cell.raw.content.split('\n')[0]; doc.setFillColor(228, 228, 214); doc.rect(d.cell.x + 0.3, d.cell.y + 0.3, d.cell.width - 0.6, 5, 'F'); P.font(doc, 10, 'bold', C.olive); doc.text(t, d.cell.x + d.cell.width / 2, d.cell.y + 4.4, { align: 'center' }); } } } });
    P.text(ctx, 'Merksatz: Die Widerstandszeit der Mechanik muss länger sein als die Zeit von der Alarmierung bis zum Eintreffen der Intervention.', { size: 9, style: 'italic', after: 3 });
    if (sk.restrisiko) { sub('3.4  Akzeptiertes Restrisiko'); P.text(ctx, sk.restrisiko, { size: 10 }); }

    /* 4–6 Maßnahmen */
    sec(4); mTable('T');
    if (sk.massnahmen.some(m => m.art === 'T' && /video/i.test(m.bereich + m.massnahme))) P.box(ctx, 'Datenschutz bei Videoüberwachung', 'Rechtsgrundlage meist Art. 6 Abs. 1 lit. f DSGVO, für öffentlich zugängliche Räume zusätzlich § 4 BDSG. Hinweisschild nach Art. 13 DSGVO, Eintrag im Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO), Speicherdauer festlegen. Bei Beschäftigten Mitbestimmung des Betriebsrats nach § 87 Abs. 1 Nr. 6 BetrVG beachten.', { size: 9 });
    sec(5); mTable('O');
    if (sk.zustaendigkeiten.length) { sub('Zuständigkeiten'); P.table(ctx, ['Aufgabe', 'Verantwortlich', 'Vertretung'], sk.zustaendigkeiten.map(z => [z.aufgabe, z.verantwortlich, z.vertretung])); }
    sec(6); sub('6.1  Personalbedarf');
    const sumStd = sk.personal.reduce((s, p) => s + U.num(p.std), 0), sumMa = sk.personal.reduce((s, p) => s + U.num(p.anzahl), 0);
    P.table(ctx, ['Posten / Tätigkeit', 'Einsatzzeiten', 'Tage', 'Std./Woche', 'Anzahl MA', 'Qualifikation'], sk.personal.length ? [...sk.personal.map(p => [p.posten, p.zeiten, p.tage, U.nf(U.num(p.std)), U.nf(U.num(p.anzahl)), p.quali]),
      [{ content: 'Summe', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, { content: U.nf(sumStd), styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, { content: U.nf(sumMa), styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, { content: '', styles: { fillColor: [228, 228, 214] } }]]
      : [[{ content: 'Kein zusätzliches Sicherheitspersonal vorgesehen.', colSpan: 6, styles: ital }]], { at: { columnStyles: { 2: { cellWidth: 13, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 19, halign: 'center' } } } });
    sub('6.2  Qualifikation'); P.checks(ctx, SK.LIB.quali, sk.quali, 1);
    sub('6.3  Ausstattung'); P.checks(ctx, SK.LIB.ausstattung, sk.ausstattung, 2);
    if (sk.umsetzungsform) { sub('6.4  Umsetzungsform'); P.text(ctx, sk.umsetzungsform, { size: 10 }); }
    sub(sk.umsetzungsform ? '6.5  Weitere personelle Maßnahmen' : '6.4  Weitere personelle Maßnahmen'); mTable('P');

    /* 7 Kosten */
    sec(7); const ko = SK.kosten(sk);
    P.table(ctx, ['Nr.', 'Maßnahme', 'Art', 'einmalig €', 'laufend € / Jahr', 'Grundlage'], sk.massnahmen.length ? sk.massnahmen.map(m => [m.nr, m.massnahme, m.art, U.n2(U.num(m.einmalig)), U.n2(U.num(m.laufend)), m.grundlage || '']) : [[{ content: 'Keine Maßnahmen erfasst.', colSpan: 6, styles: ital }]],
      { at: { columnStyles: { 0: { cellWidth: 11 }, 2: { cellWidth: 11, halign: 'center' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 27, halign: 'right' }, 5: { cellWidth: 28 } }, didParseCell: d => { if (d.section === 'head' && (d.column.index === 3 || d.column.index === 4)) d.cell.styles.halign = 'right'; } } });
    P.text(ctx, 'Art: T = technisch · O = organisatorisch · P = personell', { size: 8.5, color: C.grau, after: 3 });
    sub('Zusammenfassung');
    const kr = (l, z, b) => [{ content: l, styles: b ? { fontStyle: 'bold', fillColor: [228, 228, 214] } : {} }, ...[z[0], z[1], z[0] + z[1]].map(x => ({ content: U.eur(x), styles: Object.assign({ halign: 'right' }, b ? { fontStyle: 'bold', fillColor: [228, 228, 214] } : {}) }))];
    P.table(ctx, ['Kategorie', 'einmalig', 'laufend / Jahr', 'Summe 1. Jahr'], [kr('Technisch', ko.T), kr('Organisatorisch', ko.O), kr('Personell', ko.P), kr('Gesamt', ko.G, true)],
      { at: { didParseCell: d => { if (d.section === 'head' && d.column.index) d.cell.styles.halign = 'right'; } } });
    P.box(ctx, 'Hinweise zur Kostenaufstellung', `Die Beträge sind Schätzungen auf Grundlage von ${sk.kostenBasis || 'Erfahrungswerten'} und verstehen sich ${sk.kostenArt}. Verbindlich sind ausschließlich die Angebote der ausführenden Unternehmen. Förderprogramme (z. B. KfW-Einbruchschutz) und Auswirkungen auf Versicherungsprämien sind gesondert zu prüfen.`, { size: 9 });

    /* 8 Empfehlung */
    sec(8); sub('8.1  Empfehlung'); P.text(ctx, sk.empfehlung || '–', { size: 10, after: 3 });
    const st = [['A', '1 – Sofort', 'bis 3 Monate'], ['B', '2 – Mittelfristig', 'bis 12 Monate'], ['C', '3 – Langfristig', 'nach Bedarf']].map(([p, s, z]) => { const ms = sk.massnahmen.filter(m => m.prio === p);
      return [{ content: s, styles: { fontStyle: 'bold' } }, z, ms.map(m => m.nr).join(', ') || '–', U.eur(ms.reduce((x, m) => x + U.num(m.einmalig) + U.num(m.laufend), 0))]; });
    P.table(ctx, ['Stufe', 'Zeitraum', 'Maßnahmen (Nr.)', 'Kosten 1. Jahr'], st, { at: { columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 30 }, 3: { cellWidth: 30, halign: 'right' } }, didParseCell: d => { if (d.section === 'head' && d.column.index === 3) d.cell.styles.halign = 'right'; } } });
    sub('8.2  Evaluierung der Wirksamkeit');
    P.table(ctx, ['Prüfpunkt / Kennzahl', 'Methode', 'Intervall', 'Verantwortlich'], sk.evaluierung.length ? sk.evaluierung.map(e => [e.punkt, e.methode, e.intervall, e.verantwortlich]) : [[{ content: 'Noch keine Prüfpunkte festgelegt.', colSpan: 4, styles: ital }]]);
    P.text(ctx, 'Anlässe für eine außerplanmäßige Überprüfung: sicherheitsrelevanter Vorfall · bauliche Änderung oder Nutzungsänderung · neue Bedrohungslage · Änderung gesetzlicher oder versicherungsseitiger Vorgaben.', { size: 9.5, after: 2 });
    P.text(ctx, `Nächste reguläre Überprüfung des Schutzkonzepts: ${U.de(sk.naechstePruefung)}`, { size: 10, style: 'bold', after: 3 });
    P.box(ctx, 'Hinweise', 'Das Schutzkonzept gibt den Stand zum Zeitpunkt der Erstellung wieder und beruht auf den zur Verfügung gestellten Informationen. Die Empfehlungen sind fachliche Einschätzungen; über ihre Umsetzung entscheidet der Auftraggeber. Das Konzept enthält keine Rechtsberatung im Sinne des Rechtsdienstleistungsgesetzes (RDG).', { size: 9 });
    const ou = P.ou('für das Schutzkonzept keine Form vorgeschrieben ist');
    P.sign(ctx, [`Ort, Datum · ${a.name} (Verfasser)`, 'Ort, Datum · Auftraggeber (Kenntnisnahme)'], 14, ou && Object.assign({ i: 0 }, ou));

    /* Inhaltsverzeichnis mit Seitenzahlen nachtragen */
    doc.setPage(1); let y = tocY;
    for (let n = 1; n <= 8; n++) { P.font(doc, 11, 'normal'); doc.text(`${n}`, ctx.left, y + 4); doc.text(SK.SECT[n][0], ctx.left + 8, y + 4);
      const tw = doc.getTextWidth(SK.SECT[n][0]); P.font(doc, 11, 'normal', C.grau); doc.setLineDashPattern([0.3, 1.2], 0); doc.setDrawColor(...C.khaki); doc.line(ctx.left + 10 + tw, y + 4, ctx.left + ctx.w - 8, y + 4); doc.setLineDashPattern([], 0);
      doc.text(String(starts[n]), ctx.left + ctx.w, y + 4, { align: 'right' }); y += 6.2; }
    return P.finish(ctx);
  },
};

/* ---------- Ansicht: Liste ---------- */
AC.views.schutzkonzepte = async (v) => {
  await K.load(); const all = await SK.loadAll();
  AC.head('Schutzkonzepte', 'Ablage: Ordner „schutzkonzepte“ (Daten + PDF)', `<button class="btn ghost" id="sNeu">+ Neues Schutzkonzept</button>`);
  document.getElementById('sNeu').onclick = () => AC.go('schutzkonzept');
  v.innerHTML = all.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Kunde</th><th>Objekt</th><th>Datum</th><th>Version</th><th>Risiken</th><th>Maßnahmen</th><th>Status</th></tr></thead><tbody>
    ${all.map(s => `<tr class="click" data-s="${s.id}"><td><b>${s.id}</b></td><td>${U.esc(K.name(s.kunde || K.get(s.kundeId)))}</td><td>${U.esc(s.objekt)}</td><td>${U.de(s.datum)}</td><td>${U.esc(s.version)}</td>
    <td>${['h', 'm', 'g'].map(x => { const n = s.risiken.filter(r => SK.stufe(r.ew * r.sa) === x).length; return n ? `<span class="badge ${x}">${n} ${SK.STXT[x]}</span>` : ''; }).join(' ')}</td><td>${s.massnahmen.length}</td><td><span class="badge">${U.esc(s.status)}</span></td></tr>`).join('')}</tbody></table></div>`
    : '<div class="card empty">Noch kein Schutzkonzept. Starte mit „+ Neues Schutzkonzept“ – der Assistent führt dich durch die acht Bausteine.</div>';
  v.querySelectorAll('[data-s]').forEach(t => t.onclick = () => AC.go('schutzkonzept', t.dataset.s));
};

/* ---------- Ansicht: Assistent ---------- */
AC.views.schutzkonzept = async (v, id, startTab = 0) => {
  await K.load();
  const sk = id ? await FS.readJSON(`schutzkonzepte/${id}.json`) : SK.blank(); if (!sk) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const F = AC.F, L = SK.LIB; let tab = startTab, dirty = false;
  const head = () => AC.head(sk.id ? `Schutzkonzept ${sk.id}` : 'Neues Schutzkonzept', [K.name(K.get(sk.kundeId)), sk.objekt].filter(x => x && x !== '–').join(' · ') || 'Baustein für Baustein ausfüllen',
    `<button class="btn ghost" id="sBack">← Liste</button><button class="btn ghost" id="sSave">Speichern</button><button class="btn ghost" id="sPrev">PDF-Vorschau</button><button class="btn light" id="sPdf">PDF erstellen und ablegen</button>`);

  /* Tabellen-Editor für Listen (Risiken, Maßnahmen, …) */
  const ed = (path, cols, rows) => `<div class="tw"><table class="t"><thead><tr>${cols.map(c => `<th${c.w ? ` style="width:${c.w}"` : ''}>${c.l}</th>`).join('')}<th style="width:34px"></th></tr></thead><tbody>
    ${rows.length ? rows.map(({ o, i }) => `<tr>${cols.map(c => {
      const p = `${path}.${i}.${c.k}`, val = o[c.k] ?? '';
      if (c.ro) return `<td class="${c.num ? 'num' : ''}" data-ro="${c.k}:${i}">${U.esc(c.ro(o))}</td>`;
      if (c.opts) return `<td><select data-p="${p}">${c.opts.map(x => { const [vv, tt] = Array.isArray(x) ? x : [x, x]; return `<option value="${U.esc(vv)}"${String(vv) === String(val) ? ' selected' : ''}>${U.esc(tt)}</option>`; }).join('')}</select></td>`;
      if (c.area) return `<td><textarea data-p="${p}" rows="2">${U.esc(val)}</textarea></td>`;
      return `<td><input data-p="${p}"${c.t ? ` type="${c.t}"` : ''}${c.t === 'number' ? ' step="any"' : ''} value="${U.esc(val)}"></td>`; }).join('')}<td><button class="x" data-del="${path}:${i}">✕</button></td></tr>`).join('')
      : `<tr><td colspan="${cols.length + 1}" class="muted small">Noch keine Einträge – Baustein oben anklicken oder Zeile hinzufügen.</td></tr>`}</tbody></table></div>`;
  const chips = (items, key) => `<div class="chips">${items.map((x, i) => `<button class="chip" data-chip="${key}:${i}">${U.esc(Array.isArray(x) ? (x[1] && key !== 'bed' ? x[1] : x[0]) : x)}</button>`).join('')}</div>`;
  const checks = (path, items, sel) => `<div class="checks">${items.map(x => `<label><input type="checkbox" data-chk="${path}" value="${U.esc(x)}"${sel.includes(x) ? ' checked' : ''}> ${U.esc(x)}</label>`).join('')}</div>`;
  const mass = (art) => sk.massnahmen.map((o, i) => ({ o, i })).filter(x => x.o.art === art);
  const mCols = [{ k: 'nr', l: 'Nr.', w: '60px' }, { k: 'bereich', l: 'Bereich', w: '14%' }, { k: 'ist', l: 'Ist-Zustand', area: 1 }, { k: 'massnahme', l: 'Maßnahme', area: 1 }, { k: 'bezug', l: 'Bezug Risiko', w: '90px' },
    { k: 'prio', l: 'Prio', opts: ['A', 'B', 'C'], w: '70px' }, { k: 'norm', l: 'Norm / Grundlage', w: '14%' }];
  const risikoMatrix = () => `<div class="matrix"><div class="hd">EW ↓ / SA →</div>${SK.SA.map(s => `<div class="hd">${s}</div>`).join('')}
    ${[4, 3, 2, 1].map(e => `<div class="hd">${SK.EW[e - 1]}</div>${[1, 2, 3, 4].map(s => { const r = sk.risiken.filter(x => +x.ew === e && +x.sa === s); return `<div class="c ${SK.stufe(e * s)}"><b>${e * s}</b>${r.map(x => x.nr).join(', ')}</div>`; }).join('')}`).join('')}</div>`;

  const koSum = () => { const ko = SK.kosten(sk); return `<thead><tr><th>Kategorie</th><th class="num">einmalig</th><th class="num">laufend / Jahr</th><th class="num">Summe 1. Jahr</th></tr></thead><tbody>
    ${[['Technisch', 'T'], ['Organisatorisch', 'O'], ['Personell', 'P']].map(([l, x]) => `<tr><td>${l}</td><td class="num">${U.eur(ko[x][0])}</td><td class="num">${U.eur(ko[x][1])}</td><td class="num">${U.eur(ko[x][0] + ko[x][1])}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Gesamt</td><td class="num">${U.eur(ko.G[0])}</td><td class="num">${U.eur(ko.G[1])}</td><td class="num">${U.eur(ko.G[0] + ko.G[1])}</td></tr></tfoot>`; };

  const TABS = [
    () => `<div class="card"><h2>Grunddaten und Deckblatt</h2><div class="grid g4">
      <label class="f" style="grid-column:span 2"><span>Auftraggeber (Kunde) *</span><select data-p="kundeId">${K.options(sk.kundeId)}</select></label>
      ${F.select('Status', 'status', sk.status, ['in Arbeit', 'beim Kunden zur Abstimmung', 'abgeschlossen'])}
      ${F.input('Version', 'version', sk.version)}
      ${F.input('Objekt (Bezeichnung) *', 'objekt', sk.objekt, { span: 2, ph: 'z. B. Lager- und Verwaltungsgebäude Nord' })}
      ${F.input('Standort / Anschrift', 'standort', sk.standort, { span: 2 })}
      ${F.input('Nutzung des Objekts', 'nutzung', sk.nutzung, { span: 2 })}
      ${F.input('Ansprechpartner Auftraggeber', 'ansprechpartner', sk.ansprechpartner, { span: 2 })}
      ${F.input('Erstellt am', 'datum', sk.datum, { type: 'date' })}
      ${F.input('Nächste Überprüfung', 'naechstePruefung', sk.naechstePruefung, { type: 'date' })}
      ${F.input('Verteiler', 'verteiler', sk.verteiler, { span: 2 })}</div></div>`,
    () => `<div class="card"><h2>1.1 Objektdaten</h2><div class="grid g2">
      ${[['lage', 'Lage und Umgebung', 'Gewerbegebiet, Nachbarschaft, Erreichbarkeit'], ['gebaeude', 'Gebäude / Gelände', 'Bauart, Baujahr, Geschosse, Fläche, Einfriedung'], ['betrieb', 'Nutzung / Betriebszeiten', ''], ['personen', 'Personen im Objekt', 'Mitarbeitende, Besucher, Fremdfirmen je Schicht'],
        ['zugaenge', 'Zugänge / Zufahrten', ''], ['technik', 'Vorhandene Sicherheitstechnik', 'EMA, Video, Zutrittskontrolle, Schließanlage, BMA'], ['personal', 'Vorhandenes Sicherheitspersonal', ''], ['intervention', 'Interventionszeiten', 'Polizei, Feuerwehr, Interventionsdienst in Minuten'],
        ['vorfaelle', 'Vorfälle der letzten 3 Jahre', ''], ['auflagen', 'Auflagen / Vorgaben', 'Versicherer, Behörden, Konzernrichtlinien']].map(([kk, l, ph]) => F.area(l, 'info.' + kk, sk.info[kk], { rows: 2, ph })).join('')}</div></div>
      <div class="card"><h2>1.2 Informationsquellen</h2><div class="grid g4" style="margin-bottom:10px">${F.input('Datum der Objektbegehung', 'info.begehung', sk.info.begehung, { type: 'date' })}</div>${checks('info.quellen', L.quellen, sk.info.quellen)}</div>
      <div class="card"><h2>1.3 Gesprächspartner</h2>${ed('info.gespraeche', [{ k: 'name', l: 'Name' }, { k: 'funktion', l: 'Funktion' }, { k: 'datum', l: 'Datum', t: 'date', w: '150px' }, { k: 'thema', l: 'Thema' }], sk.info.gespraeche.map((o, i) => ({ o, i })))}
        <button class="btn light sm" data-add="gespraech" style="margin-top:8px">+ Gesprächspartner</button></div>
      <div class="card"><h2>1.4 Erste Eindrücke aus der Begehung</h2>${F.area('', 'info.eindruecke', sk.info.eindruecke, { rows: 4 })}</div>`,
    () => `<div class="card"><h2>2.1 Bewertungsmatrix</h2><p class="hint">Risikowert = Eintrittswahrscheinlichkeit (EW) × Schadensausmaß (SA). Gering 1–3 · mittel 4–8 · hoch 9–16. Die Matrix aktualisiert sich automatisch.</p><div id="rm">${risikoMatrix()}</div></div>
      <div class="card"><h2>2.2 Bedrohungen und Bewertung</h2><p class="small"><b>Bausteine:</b></p>${chips(L.bedrohungen, 'bed')}
      ${ed('risiken', [{ k: 'nr', l: 'Nr.', w: '60px' }, { k: 'bedrohung', l: 'Bedrohung / Szenario', area: 1 }, { k: 'schutzgut', l: 'Betroffenes Schutzgut', w: '20%' },
        { k: 'ew', l: 'EW', opts: SK.EW.map((t, i) => [i + 1, t]), w: '140px' }, { k: 'sa', l: 'SA', opts: SK.SA.map((t, i) => [i + 1, t]), w: '160px' },
        { k: '_r', l: 'Risiko', ro: o => `${o.ew * o.sa} · ${SK.STXT[SK.stufe(o.ew * o.sa)]}`, w: '100px' }], sk.risiken.map((o, i) => ({ o, i })))}
      <button class="btn light sm" data-add="risiko" style="margin-top:8px">+ eigene Bedrohung</button></div>
      <div class="card"><h2>2.3 Erkannte Schwachstellen</h2>${F.area('', 'schwachstellen', sk.schwachstellen, { rows: 4 })}</div>`,
    () => `<div class="card"><h2>3.1 Schutzgüter</h2>${checks('schutzgueter', L.schutzgueter, sk.schutzgueter)}</div>
      <div class="card"><h2>3.2 Schutzziele</h2><p class="small"><b>Bausteine:</b></p>${chips(L.ziele.map(z => [z[1]]), 'ziel')}
      ${ed('ziele', [{ k: 'nr', l: 'Nr.', w: '60px' }, { k: 'schutzgut', l: 'Schutzgut', w: '16%' }, { k: 'ziel', l: 'Schutzziel', area: 1 }, { k: 'mess', l: 'Messgröße / Nachweis', area: 1 }, { k: 'bezug', l: 'Bezug Risiko', w: '110px' }], sk.ziele.map((o, i) => ({ o, i })))}
      <button class="btn light sm" data-add="ziel" style="margin-top:8px">+ eigenes Schutzziel</button>
      <p class="small muted">Risiken in diesem Konzept: ${sk.risiken.map(r => `${r.nr} ${U.esc(r.bedrohung)}`).join(' · ') || '–'}</p></div>
      <div class="card"><h2>3.4 Akzeptiertes Restrisiko</h2>${F.area('Welche Risiken nimmt der Auftraggeber nach Umsetzung bewusst in Kauf?', 'restrisiko', sk.restrisiko, { rows: 3 })}</div>`,
    ...['T', 'O'].map(art => () => `<div class="card"><h2>${art === 'T' ? 'Technische' : 'Organisatorische'} Maßnahmen</h2><p class="small"><b>Bausteine:</b></p>${chips(L[art], 'm' + art)}
      ${ed('massnahmen', mCols, mass(art))}<button class="btn light sm" data-add="m${art}" style="margin-top:8px">+ eigene Maßnahme</button>
      <p class="small muted">Priorität: A = bis 3 Monate · B = bis 12 Monate · C = langfristig. Kosten trägst du im Baustein „Kosten“ ein.</p></div>
      ${art === 'O' ? `<div class="card"><h2>Zuständigkeiten</h2>${ed('zustaendigkeiten', [{ k: 'aufgabe', l: 'Aufgabe' }, { k: 'verantwortlich', l: 'Verantwortlich' }, { k: 'vertretung', l: 'Vertretung' }], sk.zustaendigkeiten.map((o, i) => ({ o, i })))}
        <button class="btn light sm" data-add="zust" style="margin-top:8px">+ Zuständigkeit</button></div>` : ''}`),
    () => `<div class="card"><h2>6.1 Personalbedarf</h2>${ed('personal', [{ k: 'posten', l: 'Posten / Tätigkeit' }, { k: 'zeiten', l: 'Einsatzzeiten' }, { k: 'tage', l: 'Tage', w: '70px' }, { k: 'std', l: 'Std./Woche', t: 'number', w: '100px' }, { k: 'anzahl', l: 'Anzahl MA', t: 'number', w: '100px' }, { k: 'quali', l: 'Qualifikation' }], sk.personal.map((o, i) => ({ o, i })))}
      <button class="btn light sm" data-add="personal" style="margin-top:8px">+ Posten</button></div>
      <div class="card"><h2>6.2 Qualifikation und 6.3 Ausstattung</h2><div class="grid g2"><div>${checks('quali', L.quali, sk.quali)}</div><div>${checks('ausstattung', L.ausstattung, sk.ausstattung)}</div></div></div>
      <div class="card"><h2>6.4 Umsetzungsform</h2><div class="chips">${['Eigenpersonal des Auftraggebers', 'Beauftragung eines Bewachungsunternehmens mit Erlaubnis nach § 34a GewO (Leistungsbeschreibung z. B. nach DIN 77200-1)', 'Kombination aus Eigen- und Fremdpersonal'].map(x => `<button class="chip" data-uf="${U.esc(x)}">${U.esc(x)}</button>`).join('')}</div>${F.area('', 'umsetzungsform', sk.umsetzungsform, { rows: 2 })}</div>
      <div class="card"><h2>6.5 Weitere personelle Maßnahmen</h2><p class="small"><b>Bausteine:</b></p>${chips(L.P, 'mP')}${ed('massnahmen', mCols, mass('P'))}<button class="btn light sm" data-add="mP" style="margin-top:8px">+ eigene Maßnahme</button></div>`,
    () => `<div class="card"><h2>Kosten je Maßnahme</h2><p class="hint">Alle Maßnahmen aus den Bausteinen 4–6 erscheinen hier automatisch. Trage einmalige und laufende Kosten ein – Summen und Empfehlungsstufen rechnen sich selbst.</p>
      ${ed('massnahmen', [{ k: 'nr', l: 'Nr.', ro: o => o.nr, w: '60px' }, { k: 'massnahme', l: 'Maßnahme', ro: o => o.massnahme }, { k: 'prio', l: 'Prio', ro: o => o.prio, w: '50px' },
        { k: 'einmalig', l: 'einmalig €', t: 'number', w: '130px' }, { k: 'laufend', l: 'laufend € / Jahr', t: 'number', w: '130px' }, { k: 'grundlage', l: 'Grundlage', opts: ['', 'Schätzung', 'Erfahrungswert', 'Angebot'], w: '150px' }], sk.massnahmen.map((o, i) => ({ o, i })))}</div>
      <div class="card"><h2>Zusammenfassung</h2><table class="t" id="koSum" style="max-width:700px">${koSum()}</table>
        <div class="grid g3" style="margin-top:12px">${F.input('Grundlage der Schätzung', 'kostenBasis', sk.kostenBasis, { ph: 'Erfahrungswerten / Angeboten vom …' })}${F.select('Beträge', 'kostenArt', sk.kostenArt, ['netto', 'brutto'])}</div></div>`,
    () => `<div class="card"><h2>8.1 Empfehlung</h2>${F.area('Gesamteinschätzung: Wie ist die Lage heute, was ist unverzichtbar, welches Restrisiko bleibt?', 'empfehlung', sk.empfehlung, { rows: 6 })}
      <h3 style="margin-top:14px">Umsetzung in Stufen (automatisch aus den Prioritäten)</h3><table class="t" style="max-width:800px"><thead><tr><th>Stufe</th><th>Zeitraum</th><th>Maßnahmen</th><th class="num">Kosten 1. Jahr</th></tr></thead><tbody>
      ${[['A', '1 – Sofort', 'bis 3 Monate'], ['B', '2 – Mittelfristig', 'bis 12 Monate'], ['C', '3 – Langfristig', 'nach Bedarf']].map(([p, s, z]) => { const ms = sk.massnahmen.filter(m => m.prio === p); return `<tr><td><b>${s}</b></td><td>${z}</td><td>${ms.map(m => m.nr).join(', ') || '–'}</td><td class="num">${U.eur(ms.reduce((x, m) => x + U.num(m.einmalig) + U.num(m.laufend), 0))}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="card"><h2>8.2 Evaluierung der Wirksamkeit</h2><p class="small"><b>Bausteine:</b></p>${chips(L.eval.map(e => [e[0]]), 'eval')}
      ${ed('evaluierung', [{ k: 'punkt', l: 'Prüfpunkt / Kennzahl' }, { k: 'methode', l: 'Methode' }, { k: 'intervall', l: 'Intervall', w: '140px' }, { k: 'verantwortlich', l: 'Verantwortlich', w: '180px' }], sk.evaluierung.map((o, i) => ({ o, i })))}
      <button class="btn light sm" data-add="eval" style="margin-top:8px">+ eigener Prüfpunkt</button>
      <div class="grid g4" style="margin-top:12px">${F.input('Nächste reguläre Überprüfung', 'naechstePruefung', sk.naechstePruefung, { type: 'date' })}</div></div>
      <div class="card"><h2>Fertigstellen</h2><p>Wenn alles stimmt: oben auf <b>„PDF erstellen und ablegen“</b> klicken. Das PDF landet im Ordner „schutzkonzepte“, die Daten bleiben weiter bearbeitbar. Für eine neue Fassung einfach die Version erhöhen.</p></div>`,
  ];

  const draw = () => {
    head();
    v.innerHTML = `<div class="steps">${SK.SECT.map((s, n) => `<button data-tab="${n}" class="${n === tab ? 'on' : ''}"><span class="n">${n || '◆'}</span>${n ? s[0].replace('Maßnahmen – ', '') : 'Grunddaten'}</button>`).join('')}</div>
      ${tab ? `<p class="small muted" style="margin:-8px 0 14px"><b>Ziel:</b> ${U.esc(SK.SECT[tab][1])}</p>` : ''}${TABS[tab]()}
      <div class="row"><button class="btn light" data-nav="-1"${tab ? '' : ' disabled'}>← zurück</button><button class="btn right" data-nav="1"${tab < 8 ? '' : ' disabled'}>weiter →</button></div>`;
    F.bind(v, sk, (p, val, el) => { dirty = true;
      if (p === 'kundeId') head();
      if (/^risiken\.\d+\.(ew|sa)$/.test(p)) { U.set(sk, p, Number(val)); const i = +p.split('.')[1], o = sk.risiken[i]; v.querySelector(`[data-ro="_r:${i}"]`).textContent = `${o.ew * o.sa} · ${SK.STXT[SK.stufe(o.ew * o.sa)]}`; v.querySelector('#rm').innerHTML = risikoMatrix(); }
      if (tab === 7 && /einmalig|laufend/.test(p)) v.querySelector('#koSum').innerHTML = koSum(); });
    v.querySelectorAll('[data-chk]').forEach(c => c.onchange = () => { const arr = U.get(sk, c.dataset.chk); const i = arr.indexOf(c.value); if (c.checked && i < 0) arr.push(c.value); if (!c.checked && i >= 0) arr.splice(i, 1); dirty = true; });
    v.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = +b.dataset.tab; draw(); });
    v.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { tab = Math.max(0, Math.min(8, tab + +b.dataset.nav)); draw(); window.scrollTo(0, 0); });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const [p, i] = b.dataset.del.split(':'); U.get(sk, p).splice(+i, 1); dirty = true; redraw(); });
    v.querySelectorAll('[data-uf]').forEach(b => b.onclick = () => { sk.umsetzungsform = b.dataset.uf; dirty = true; redraw(); });
    const addM = (art, x) => sk.massnahmen.push({ nr: SK.nextNr(sk.massnahmen, art), art, bereich: x ? x[0] : '', ist: '', massnahme: x ? x[1] : '', bezug: '', prio: 'B', norm: x ? x[2] : '', einmalig: 0, laufend: 0, grundlage: '' });
    v.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { const [key, i] = b.dataset.chip.split(':');
      if (key === 'bed') { const x = L.bedrohungen[i]; sk.risiken.push({ nr: SK.nextNr(sk.risiken, 'R'), bedrohung: x[0], schutzgut: x[1], ew: 2, sa: 2 }); }
      if (key === 'ziel') { const x = L.ziele[i]; sk.ziele.push({ nr: SK.nextNr(sk.ziele, 'Z'), schutzgut: x[0], ziel: x[1], mess: x[2], bezug: '' }); }
      if (key[0] === 'm' && key.length === 2) addM(key[1], L[key[1]][i]);
      if (key === 'eval') { const x = L.eval[i]; sk.evaluierung.push({ punkt: x[0], methode: x[1], intervall: x[2], verantwortlich: '' }); }
      dirty = true; redraw(); });
    v.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const a = b.dataset.add;
      if (a === 'gespraech') sk.info.gespraeche.push({ name: '', funktion: '', datum: U.today(), thema: '' });
      if (a === 'risiko') sk.risiken.push({ nr: SK.nextNr(sk.risiken, 'R'), bedrohung: '', schutzgut: '', ew: 2, sa: 2 });
      if (a === 'ziel') sk.ziele.push({ nr: SK.nextNr(sk.ziele, 'Z'), schutzgut: '', ziel: '', mess: '', bezug: '' });
      if (a[0] === 'm' && a.length === 2) addM(a[1]);
      if (a === 'zust') sk.zustaendigkeiten.push({ aufgabe: '', verantwortlich: '', vertretung: '' });
      if (a === 'personal') sk.personal.push({ posten: '', zeiten: '', tage: '', std: 0, anzahl: 1, quali: '' });
      if (a === 'eval') sk.evaluierung.push({ punkt: '', methode: '', intervall: '', verantwortlich: '' });
      dirty = true; redraw(); });
    document.getElementById('sBack').onclick = async () => { if (dirty && await AC.confirm('Änderungen speichern?', 'Es gibt ungespeicherte Änderungen.', 'Speichern', '')) await doSave(); AC.go('schutzkonzepte'); };
    document.getElementById('sSave').onclick = () => doSave(true);
    document.getElementById('sPrev').onclick = () => AC.preview(SK.pdf(withKunde()), 'Vorschau Schutzkonzept');
    document.getElementById('sPdf').onclick = async () => {
      if (!sk.kundeId || !sk.objekt) { tab = 0; draw(); return AC.toast('Bitte Kunde und Objekt angeben', true); }
      await doSave(); const doc = SK.pdf(withKunde()); const f = PDF.fileName(sk.id, K.name(K.get(sk.kundeId)), sk.objekt, 'v' + sk.version);
      await FS.write('schutzkonzepte/' + f, doc.output('blob')); sk.pdf = f; await SK.save(sk); AC.toast('Abgelegt: schutzkonzepte/' + f);
      AC.preview(doc, 'Schutzkonzept ' + sk.id);
    };
  };
  const redraw = () => { const sc = window.scrollY; draw(); window.scrollTo(0, sc); };
  const withKunde = () => Object.assign(U.clone(sk), { kunde: K.snapshot(K.get(sk.kundeId) || {}) });
  const doSave = async (msg) => { if (!sk.kundeId) { if (msg) AC.toast('Bitte zuerst einen Kunden wählen', true); tab = 0; draw(); return; }
    sk.kunde = K.snapshot(K.get(sk.kundeId)); await SK.save(sk); dirty = false; head(); if (msg) AC.toast(`Gespeichert: schutzkonzepte/${sk.id}.json`); };
  draw();
};
