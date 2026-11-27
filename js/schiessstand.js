/* =====================================================================
   AC Office – Schießstand (schiessstand.js)
   Schießtermine als verantwortliche Aufsichtsperson oder Veranstalter:
   Teilnehmer mit Berechtigungsprüfung, Fristen, Unterlagen als PDF.
   Daten: schiessstand/SS-2026-001.json   PDFs: schiessstand/SS-2026-001/
   Rechtsgrundlagen: §§ 27, 27a WaffG; §§ 9–11, 22–25 AWaffV (Stand 26.11.2026)
   Teilnehmerdaten sind personenbezogen: Verzeichnis nach § 24 AWaffV 5 Jahre
   aufbewahren, danach löschen.
   ===================================================================== */
'use strict';
const SS = AC.SS = {
  ARTEN: ['Standaufsicht für Betreiber / Verein', 'Verteidigungsschießen (§ 22 AWaffV)', 'Sachkundelehrgang § 7 WaffG (Schießen nach § 9 Abs. 1 Nr. 2 c AWaffV)', 'Schießübung Bewacher (DGUV Vorschrift 23)'],
  BERECHTIGUNG: ['Waffenschein', 'Bescheinigung nach § 55 Abs. 2 WaffG', 'Bescheinigung des Dienstherrn', 'Waffenbesitzkarte', 'Jagdschein', 'Sachkundelehrgang (ohne Erlaubnis)', 'Minderjährig – Einverständnis Sorgeberechtigte', 'sonstige'],
  STATUS: ['geplant', 'durchgeführt', 'abgesagt'],
  v22: t => /§ 22/.test(t.art || ''),
  async loadAll() { return (await FS.readAll('schiessstand')).sort((a, b) => (b.datum || '').localeCompare(a.datum || '')); },
  get: id => FS.readJSON(`schiessstand/${id}.json`),
  async save(t) { if (!t.id) t.id = await AC.nextNr('schiessstand', 'SS', 3, 'schiessstand'); const d = Object.assign({}, t); delete d._file; await FS.writeJSON(`schiessstand/${t.id}.json`, d); },
  blank: () => ({ id: '', datum: U.addDays(U.today(), 21), von: '09:00', bis: '13:00', art: SS.ARTEN[0], staette: '', adresse: '', betreiber: '', kundeId: '', lehrgangId: '',
    aufsicht: AC.settings.absender.name, ausbilder: '', behoerde: '', anzeigeBehoerde: '', anzeigeBetreiber: '', beendigungAngezeigt: '', status: 'geplant',
    notfall: { krankenhaus: '', anfahrt: '', ersthelfer: AC.settings.absender.name, sammelplatz: '' }, teilnehmer: [], vorkommnisse: '', notiz: '' }),
  tn: () => ({ name: '', vorname: '', gebDatum: '', gebOrt: '', anschrift: '', berechtigung: 'Waffenschein', nr: '', ausgestellt: '', behoerde: '', geprueft: false, waffe: '', schuss: '', einverstaendnis: false }),
  /* Hinweise zu einem Termin (Fristen, Berechtigungen) */
  hinweise(t) {
    const h = [], heute = U.today(), d = U.days(heute, t.datum || heute);
    if (SS.v22(t)) {
      if (!t.anzeigeBehoerde && t.status !== 'abgesagt') h.push(`Anzeige an die Behörde fehlt – spätestens ${U.de(U.addDays(t.datum, -14))} (2 Wochen vorher, § 22 Abs. 2 S. 1 AWaffV).${d < 14 ? ' Frist ist schon unterschritten!' : ''}`);
      else if (t.anzeigeBehoerde && U.days(t.anzeigeBehoerde, t.datum) < 14) h.push('Die Anzeige lag weniger als 2 Wochen vor dem Termin (§ 22 Abs. 2 S. 1 AWaffV).');
      if (t.status === 'durchgeführt' && !t.beendigungAngezeigt) h.push(`Beendigung der Behörde anzeigen bis ${U.de(U.addDays(t.datum, 14))} (§ 22 Abs. 2 S. 3 AWaffV).`);
      t.teilnehmer.filter(x => x.name && !/^(Waffenschein|Bescheinigung)/.test(x.berechtigung)).forEach(x => h.push(`${x.vorname} ${x.name}: Für Verteidigungsschießen nur mit Waffenschein oder Bescheinigung (§ 23 Abs. 1 AWaffV).`));
    } else if (/^Standaufsicht/.test(t.art) && !t.anzeigeBetreiber && t.status === 'geplant') h.push('Klären, ob der Betreiber dich 2 Wochen vorher als Aufsichtsperson angezeigt hat bzw. ob du beim Verein registriert bist (§ 10 Abs. 2, 3 AWaffV).');
    const offen = t.teilnehmer.filter(x => x.name && !x.geprueft).length; if (offen) h.push(`${offen} Teilnehmende ohne geprüfte Berechtigung (vor Beginn prüfen, §§ 9, 23 AWaffV).`);
    t.teilnehmer.filter(x => x.name && /^Minderjährig/.test(x.berechtigung) && !x.einverstaendnis).forEach(x => h.push(`${x.vorname} ${x.name}: schriftliches Einverständnis der Sorgeberechtigten fehlt (§ 27 Abs. 3 WaffG).`));
    return h;
  },

  /* ---------- PDFs ---------- */
  kopf(ctx, t) { VL.infoRow(ctx, [['Datum', t ? `${U.de(t.datum)}${t.von ? ', ' + t.von + '–' + t.bis + ' Uhr' : ''}` : ''], ['Schießstätte', t ? [t.staette, t.adresse].filter(Boolean).join(', ') : ''], ['Betreiber', t ? t.betreiber : '']]); },
  protokoll(t) {
    const ctx = PDF.create('form', { landscape: true, title: 'Schießstandprotokoll ' + (t.id || ''), footer: `${t.id} · Schießstandprotokoll · personenbezogen` });
    VL.head(ctx, 'Schießstandprotokoll – Aufsichtsnachweis', `${t.art} · Rechtsgrundlage: § 11 AWaffV (Aufsicht)${SS.v22(t) ? ', §§ 22–24 AWaffV' : ''}`);
    SS.kopf(ctx, t); VL.infoRow(ctx, [['Verantwortliche Aufsicht', t.aufsicht], ['Ausbilder', t.ausbilder || '–'], ['Anzeige Behörde', t.anzeigeBehoerde ? U.de(t.anzeigeBehoerde) : (SS.v22(t) ? 'offen' : 'entfällt')]]);
    const rows = t.teilnehmer.filter(x => x.name).map((x, i) => [String(i + 1), `${x.name}, ${x.vorname}`, `${x.berechtigung}${x.nr ? ' Nr. ' + x.nr : ''}${x.behoerde ? ' (' + x.behoerde + ')' : ''}`, x.geprueft ? '✓' : '', x.waffe || '', x.schuss || '', '']);
    for (let i = rows.length; i < 10; i++) rows.push([String(i + 1), '', '', '', '', '', '']);
    PDF.table(ctx, ['Nr.', 'Name, Vorname', 'Berechtigung (Art, Nr., Behörde)', 'geprüft', 'Waffe / Kaliber', 'Schuss', 'Unterschrift'], rows.map(r => { r[3] = r[3] ? 'ja' : ''; return r; }),
      { minH: 8, size: 9.5, zebra: false, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 3: { cellWidth: 17, halign: 'center' }, 5: { cellWidth: 16, halign: 'center' }, 6: { cellWidth: 45 } } } });
    PDF.box(ctx, 'Besondere Vorkommnisse (Störungen, Verstöße, Untersagungen nach § 11 Abs. 1 S. 2 AWaffV)', t.vorkommnisse || 'keine', { size: 9.5 });
    PDF.sign(ctx, ['Ort, Datum, Unterschrift verantwortliche Aufsichtsperson', 'Kenntnisnahme Betreiber / Veranstalter'], 12);
    return PDF.finish(ctx);
  },
  REGELN: ['Jede Waffe wird stets als geladen betrachtet.', 'Die Mündung zeigt immer in eine sichere Richtung, auf dem Stand nur in Richtung Geschossfang.', 'Der Finger bleibt gestreckt außerhalb des Abzugsbügels, bis das Ziel erfasst ist und geschossen werden soll.',
    'Laden und Entladen nur am Schützenstand und nur auf Anweisung der Aufsicht.', 'Den Anordnungen der verantwortlichen Aufsichtsperson ist sofort Folge zu leisten (§ 11 Abs. 2 AWaffV).', 'Bei „Stopp“ oder „Feuer einstellen“ sofort aufhören, Waffe in Schussrichtung halten, Finger raus. Jeder darf und muss bei Gefahr „Stopp“ rufen.',
    'Gehörschutz und Schutzbrille sind während des Schießbetriebs Pflicht.', 'Kein Alkohol, keine Drogen oder Medikamente, die die Reaktion beeinträchtigen – auch nicht vor dem Schießen.', 'Bei Störungen: Waffe in Schussrichtung halten, Hand heben, Aufsicht rufen. Nicht selbst herumhantieren.',
    'Die Schießbahn wird nur nach Freigabe betreten; vorher sind alle Waffen entladen, Verschluss offen, abgelegt.', 'Kampfmäßiges Schießen ist verboten (§ 27 Abs. 7 WaffG). Es gilt die Standordnung des Betreibers.', 'Waffen und Munition nach dem Schießen vollständig zurückgeben bzw. sicher verwahren; die Aufsicht kontrolliert die Entladung.'],
  belehrung(t) {
    const ctx = PDF.create('form', { title: 'Sicherheitsbelehrung Schießstand', footer: `${t && t.id ? t.id + ' · ' : ''}Sicherheitsbelehrung` });
    VL.head(ctx, 'Sicherheitsbelehrung Schießstand', 'Mit meiner Unterschrift bestätige ich, dass ich die Regeln verstanden habe und befolge.'); SS.kopf(ctx, t);
    PDF.table(ctx, ['Nr.', 'Sicherheitsregel'], SS.REGELN.map((r, i) => [String(i + 1), r]), { size: 9.5, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' } } } });
    PDF.text(ctx, 'Ergänzend gilt die Standordnung des Betreibers. Allgemeine Praxisregeln – vor dem Einsatz mit der Standordnung abgleichen.', { size: 8.5, color: PDF.C.grau });
    const tn = t ? t.teilnehmer.filter(x => x.name) : [], rows = tn.map((x, i) => [String(i + 1), x.name, x.vorname, '']);
    for (let i = rows.length; i < Math.max(12, rows.length); i++) rows.push([String(i + 1), '', '', '']);
    PDF.table(ctx, ['Nr.', 'Name', 'Vorname', 'Unterschrift'], rows, { minH: 8, zebra: false, size: 9.5, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 3: { cellWidth: 70 } } } });
    PDF.sign(ctx, ['Belehrung durchgeführt: Datum, Unterschrift Aufsicht'], 10);
    return PDF.finish(ctx);
  },
  CHECK: {
    'Vorher (Planung)': ['Bestellung / Anzeige als Aufsicht durch Betreiber geklärt (§ 10 Abs. 2 AWaffV)', 'bei Verein: Nachweisdokument dabei (§ 10 Abs. 3)', 'bei § 22: Anzeige an Behörde 2 Wochen vorher', 'bei § 22: Erklärung an Betreiber abgegeben', 'Standordnung des Betreibers liegt vor', 'Teilnehmerliste und Berechtigungen vorab angefordert'],
    'Vor Beginn': ['Stand begangen: Geschossfang, Blenden, Bahnen frei', 'Beleuchtung, Lüftung, Fluchtwege in Ordnung', 'Erste-Hilfe-Material, Telefon, Feuerlöscher geprüft', 'Notfallaushang sichtbar', 'Berechtigungen geprüft (§§ 9, 23 AWaffV)', 'Einverständniserklärungen Minderjährige eingesammelt (§ 27 Abs. 3 WaffG)', 'Sicherheitsbelehrung mit Unterschrift', 'Gehör- und Augenschutz bei allen'],
    'Während': ['Schießen ständig beaufsichtigt (§ 11 Abs. 1 AWaffV)', 'nur zulässige Übungen, kein kampfmäßiges Schießen', 'Kommandos klar und einheitlich', 'bei Gefahr Schießen bzw. Aufenthalt untersagt'],
    'Danach': ['alle Waffen entladen und kontrolliert', 'Waffen und Munition zurückgegeben / quittiert', 'Stand kontrolliert, Munitionsreste gesichert', 'Protokoll ausgefüllt, Vorkommnisse gemeldet', 'bei § 22: Verzeichnis ergänzt, Beendigung angezeigt'],
  },
  checkliste(t) {
    const ctx = PDF.create('form', { title: 'Checkliste Standaufsicht', footer: 'Checkliste Standaufsicht' });
    VL.head(ctx, 'Checkliste Standaufsicht', 'Abhaken und mit dem Protokoll aufbewahren.'); SS.kopf(ctx, t);
    Object.entries(SS.CHECK).forEach(([k, l]) => { PDF.h(ctx, k, { size: 11.5 }); PDF.checks(ctx, l, [], 1); });
    PDF.sign(ctx, ['Datum, Unterschrift Aufsicht'], 10);
    return PDF.finish(ctx);
  },
  ausgabe(t) {
    const ctx = PDF.create('form', { landscape: true, title: 'Waffen- und Munitionsausgabe', footer: `${t && t.id ? t.id + ' · ' : ''}Waffen- und Munitionsausgabe` });
    VL.head(ctx, 'Nachweis Ausgabe und Rücknahme von Waffen und Munition'); SS.kopf(ctx, t);
    const tn = t ? t.teilnehmer.filter(x => x.name) : [], rows = tn.map((x, i) => [String(i + 1), `${x.name}, ${x.vorname}`, x.waffe || '', '', '', '', '', '', '']);
    for (let i = rows.length; i < Math.max(12, rows.length); i++) rows.push([String(i + 1), '', '', '', '', '', '', '', '']);
    PDF.table(ctx, ['Nr.', 'Name', 'Waffe (Art, Hersteller, Kaliber, Nr.)', 'Munition ausgegeben', 'Ausgabe Uhrzeit', 'Unterschrift Empfang', 'Rückgabe Uhrzeit', 'Munition zurück', 'Unterschrift Aufsicht'], rows,
      { minH: 8, zebra: false, size: 9, at: { columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 22 }, 4: { cellWidth: 20 }, 6: { cellWidth: 20 }, 7: { cellWidth: 20 } } } });
    return PDF.finish(ctx);
  },
  vorfall(t) {
    const ctx = PDF.create('form', { title: 'Vorfallmeldung Schießstand', footer: 'Vorfallmeldung Schießstand' });
    VL.head(ctx, 'Vorfallmeldung Schießstand', 'Unverzüglich ausfüllen und dem Betreiber bzw. Veranstalter übergeben.'); SS.kopf(ctx, t);
    VL.infoRow(ctx, [['Uhrzeit', ''], ['Bahn / Ort', ''], ['Aufsicht', t ? t.aufsicht : '']]);
    PDF.h(ctx, 'Art des Vorfalls', { size: 11.5 }); PDF.checks(ctx, ['Unfall / Verletzung', 'Sicherheitsverstoß / Fehlbedienung', 'Waffen- oder Munitionsstörung', 'Sachschaden', 'Schießen oder Aufenthalt untersagt (§ 11 Abs. 1 AWaffV)', 'Sonstiges'], [], 2);
    const lines = (titel, n) => { PDF.text(ctx, titel, { style: 'bold', size: 10.5, after: 0 }); for (let i = 0; i < n; i++) { ctx.y += 7; ctx.doc.setDrawColor(...PDF.C.line); ctx.doc.setLineWidth(0.3); ctx.doc.line(ctx.left, ctx.y, ctx.left + ctx.w, ctx.y); } ctx.y += 5; };
    lines('Beteiligte Personen (Name, Funktion)', 2); lines('Hergang', 5); lines('Getroffene Maßnahmen (Erste Hilfe, Schießbetrieb eingestellt …)', 3);
    PDF.h(ctx, 'Gemeldet an', { size: 11.5 }); PDF.checks(ctx, ['Betreiber / Veranstalter', 'Rettungsdienst (112)', 'Polizei (110)', 'zuständige Waffenbehörde', 'Unfallversicherung (z. B. VBG)', 'Auftraggeber'], [], 3);
    PDF.sign(ctx, ['Datum, Unterschrift Aufsicht', 'Datum, Unterschrift Zeuge'], 12);
    return PDF.finish(ctx);
  },
  einverstaendnis(t) {
    const ctx = PDF.create('form', { title: 'Einverständniserklärung Sorgeberechtigte', footer: 'Einverständnis § 27 Abs. 3 WaffG' });
    VL.head(ctx, 'Einverständniserklärung der Sorgeberechtigten', 'zum Schießen Minderjähriger auf einer Schießstätte (§ 27 Abs. 3 WaffG)'); SS.kopf(ctx, t);
    PDF.table(ctx, null, [['Name, Vorname des Kindes / Jugendlichen', ''], ['Geburtsdatum', ''], ['Name, Anschrift der Sorgeberechtigten', ''], ['Telefon für Notfälle', '']], { zebra: false, minH: 9, at: { columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } } } });
    PDF.text(ctx, 'Ich bin / wir sind damit einverstanden, dass mein / unser Kind unter Obhut der verantwortlichen Aufsichtsperson schießt mit:', { size: 10.5 });
    PDF.checks(ctx, ['Druckluft-, Federdruck- oder CO₂-Waffen (ab 12 Jahren)', 'Kleinkaliber bis 5,6 mm lfB (.22 l.r.), max. 200 J (ab 14 Jahren)', 'Einzellader-Flinte bis Kaliber 12 (ab 14 Jahren)'], [], 1);
    PDF.box(ctx, 'Hinweis', 'Die Aufsichtsperson nimmt diese Erklärung vor Beginn entgegen und bewahrt sie während des Schießens auf. Sie ist der Behörde auf Verlangen zur Prüfung auszuhändigen (§ 27 Abs. 3 S. 2 und 3 WaffG). Ist ein Sorgeberechtigter beim Schießen anwesend, ist keine schriftliche Erklärung nötig.', { size: 9 });
    PDF.sign(ctx, ['Ort, Datum, Unterschrift Sorgeberechtigte/r', 'Unterschrift zweite/r Sorgeberechtigte/r (falls vorhanden)'], 14);
    return PDF.finish(ctx);
  },
  notfall(t) {
    const ctx = PDF.create('form', { title: 'Notfallaushang Schießstand', footer: 'Notfallaushang' }), n = (t && t.notfall) || {};
    VL.head(ctx, 'Notfall auf dem Schießstand'); const { doc } = ctx;
    doc.setFillColor(...PDF.C.rot); doc.rect(ctx.left, ctx.y, ctx.w, 28, 'F'); PDF.font(doc, 30, 'bold', PDF.C.white); doc.text('NOTRUF 112', ctx.left + ctx.w / 2, ctx.y + 13, { align: 'center' });
    PDF.font(doc, 13, 'bold', PDF.C.white); doc.text('Polizei 110 · Schießen sofort einstellen: „STOPP!“', ctx.left + ctx.w / 2, ctx.y + 22, { align: 'center' }); ctx.y += 34;
    PDF.table(ctx, null, [['Standort / Adresse für den Notruf', t ? [t.staette, t.adresse].filter(Boolean).join(', ') : ''], ['Anfahrt / Zufahrt für Rettungsdienst', n.anfahrt || ''], ['Nächstes Krankenhaus', n.krankenhaus || ''],
      ['Verantwortliche Aufsicht', t ? t.aufsicht : ''], ['Ersthelfer', n.ersthelfer || ''], ['Erste-Hilfe-Material / Feuerlöscher', ''], ['Sammelplatz', n.sammelplatz || '']], { size: 12, minH: 12, zebra: false, at: { columnStyles: { 0: { cellWidth: 75, fontStyle: 'bold' } } } });
    PDF.box(ctx, 'Sofortmaßnahmen', '1. „STOPP!“ – Schießen einstellen, Waffen ablegen, Mündung in Richtung Geschossfang.  2. Eigenschutz, Unfallstelle sichern.  3. Notruf 112: Wo? Was? Wie viele Verletzte? Warten auf Rückfragen.  4. Erste Hilfe leisten.  5. Rettungsdienst einweisen.  6. Aufsicht und Betreiber informieren, Vorfallmeldung schreiben.', { size: 11 });
    return PDF.finish(ctx);
  },
  verzeichnis(jahr, list) {
    const ctx = PDF.create('form', { landscape: true, title: 'Verzeichnis § 24 AWaffV ' + jahr, footer: `Verzeichnis § 24 AWaffV ${jahr} · 5 Jahre aufbewahren · vertraulich` });
    VL.head(ctx, `Verzeichnis nach § 24 AWaffV – ${jahr}`, `${AC.settings.absender.firma} · Lehrgänge und Schießübungen in der Verteidigung mit Schusswaffen (§ 22 AWaffV) · Aufbewahrung 5 Jahre ab letzter Eintragung (§ 24 Abs. 4)`);
    const rows = []; list.forEach(t => { const mj = (t.datum || '').slice(5, 7) + '/' + (t.datum || '').slice(0, 4);
      rows.push([t.aufsicht, 'verantwortliche Aufsicht', '', '', '', '', mj, t.id]); if (t.ausbilder) t.ausbilder.split(/[,;]\s*/).filter(Boolean).forEach(a => rows.push([a, 'Ausbilder', '', '', '', '', mj, t.id]));
      t.teilnehmer.filter(x => x.name).forEach(x => rows.push([`${x.name}, ${x.vorname}`, 'Teilnehmer', [U.de(x.gebDatum), x.gebOrt].filter(Boolean).join(', '), x.anschrift || '', `${x.berechtigung}${x.nr ? ' Nr. ' + x.nr : ''}`, [U.de(x.ausgestellt), x.behoerde].filter(Boolean).join(', '), mj, t.id])); });
    PDF.table(ctx, ['Name, Vorname', 'Funktion', 'Geburtsdatum, -ort', 'Wohnort, Anschrift', 'Waffenschein / Bescheinigung Nr.', 'ausgestellt am, Behörde', 'Monat/Jahr', 'Termin'], rows.length ? rows : [['keine Einträge', '', '', '', '', '', '', '']], { size: 8.5 });
    PDF.text(ctx, 'Für Aufsicht und Ausbilder Personalien, Geburtsdaten und Anschrift ergänzen (§ 24 Abs. 2 Nr. 1 AWaffV). Auf Verlangen der Behörde vorzulegen (§ 24 Abs. 3).', { size: 8.5, color: PDF.C.grau });
    return PDF.finish(ctx);
  },
  anzeige(t, ende) {
    const ctx = PDF.create('letter', { title: (ende ? 'Anzeige Beendigung ' : 'Anzeige ') + t.id });
    PDF.letter(ctx, (t.behoerde || 'Zuständige Waffenbehörde\n[Anschrift eintragen]').split(/\n/), [['Datum', U.de(U.today())], ['Termin', t.id]],
      ende ? 'Anzeige der Beendigung nach § 22 Abs. 2 Satz 3 AWaffV' : 'Anzeige nach § 22 Abs. 2 und 3 AWaffV – Schießübung in der Verteidigung mit Schusswaffen');
    PDF.text(ctx, 'Sehr geehrte Damen und Herren,', { after: 2 });
    if (ende) PDF.text(ctx, `hiermit zeige ich die Beendigung der am ${t.anzeigeBehoerde ? U.de(t.anzeigeBehoerde) : '[Datum]'} angezeigten Veranstaltung an. Die Schießübung hat am ${U.de(t.datum)} in der Schießstätte ${t.staette || '[Name]'}${t.adresse ? ', ' + t.adresse : ''} stattgefunden und ist abgeschlossen.`, { after: 4 });
    else {
      PDF.text(ctx, 'hiermit zeige ich gemäß § 22 Abs. 2 AWaffV folgende Veranstaltung an:', { after: 2 });
      PDF.table(ctx, null, [['Veranstalter', `${AC.settings.absender.name}, ${AC.settings.absender.firma}, ${AC.settings.absender.strasse}, ${AC.settings.absender.plz} ${AC.settings.absender.ort}`], ['Art', 'Lehrgang / Schießübung in der Verteidigung mit Schusswaffen'],
        ['Datum, Zeit', `${U.de(t.datum)}${t.von ? ', ' + t.von + '–' + t.bis + ' Uhr' : ''}`], ['Ort (Schießstätte)', [t.staette, t.adresse].filter(Boolean).join(', ')], ['Betreiber', t.betreiber || ''],
        ['Verantwortliche Aufsichtsperson (volljährig)', `${t.aufsicht} – Personalien und Sachkundenachweis anbei`], ['Ausbilder', t.ausbilder || '–']], { zebra: false, size: 10, at: { columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } } } });
      PDF.text(ctx, 'Die Nachweise der Sachkunde der Aufsichtsperson liegen bei (§ 22 Abs. 3 S. 2 i. V. m. § 10 Abs. 2 S. 2 AWaffV). Einen Lehrgangsplan bzw. ein Übungsprogramm lege ich auf Verlangen vor. Teilnehmen werden ausschließlich Personen nach § 23 Abs. 1 AWaffV. Kampfmäßiges Schießen findet nicht statt.', { after: 4 });
    }
    PDF.gruss(ctx, ende ? '' : 'Anlagen: Personalien und Sachkundenachweis der Aufsichtsperson und der Ausbilder');
    return PDF.finish(ctx);
  },
  erklaerung(t) {
    const ctx = PDF.create('letter', { title: 'Erklärung an Betreiber ' + t.id });
    PDF.letter(ctx, (t.betreiber || 'Betreiber der Schießstätte').split(/\n/), [['Datum', U.de(U.today())], ['Termin', t.id]], 'Erklärung nach § 22 Abs. 2 Satz 4 AWaffV');
    PDF.text(ctx, 'Sehr geehrte Damen und Herren,', { after: 2 });
    PDF.text(ctx, `für die Schießübung in der Verteidigung mit Schusswaffen am ${U.de(t.datum)} in Ihrer Schießstätte ${t.staette || ''} erkläre ich, dass die nach § 22 Abs. 2 Satz 1 AWaffV erforderliche Anzeige an die zuständige Behörde${t.behoerde ? ' (' + t.behoerde.split(/\n/)[0] + ')' : ''} am ${t.anzeigeBehoerde ? U.de(t.anzeigeBehoerde) : '[Datum]'} erfolgt ist.`, { after: 4 });
    PDF.gruss(ctx); return PDF.finish(ctx);
  },
  DOCS: [['protokoll', 'Schießstandprotokoll', 'Teilnehmer, Berechtigungen, Vorkommnisse, Unterschrift'], ['belehrung', 'Sicherheitsbelehrung', 'Regeln und Unterschriftenliste'], ['checkliste', 'Checkliste Standaufsicht', 'vorher, vor Beginn, während, danach'],
    ['ausgabe', 'Waffen- und Munitionsausgabe', 'Ausgabe und Rücknahme quittieren'], ['vorfall', 'Vorfallmeldung', 'Unfall, Störung, Verstoß'], ['einverstaendnis', 'Einverständnis Sorgeberechtigte', '§ 27 Abs. 3 WaffG'], ['notfall', 'Notfallaushang', 'Notruf, Standort, Ersthelfer']],
};
SS.DATEI = { protokoll: 'Schiessstandprotokoll', belehrung: 'Sicherheitsbelehrung', checkliste: 'Checkliste-Standaufsicht', ausgabe: 'Waffen-Munitionsausgabe', vorfall: 'Vorfallmeldung', einverstaendnis: 'Einverstaendnis-Sorgeberechtigte', notfall: 'Notfallaushang', anzeige: 'Anzeige-22-AWaffV', ende: 'Anzeige-Beendigung-22-AWaffV', erklaerung: 'Erklaerung-Betreiber-22-AWaffV' };

/* Fristen in „Termine“ und auf der Übersicht */
(() => { const orig = TE.alle; TE.alle = async function () {
  const out = await orig.call(this), heute = U.today();
  (await SS.loadAll()).filter(t => t.status !== 'abgesagt').forEach(t => {
    if (SS.v22(t) && !t.anzeigeBehoerde && t.datum >= heute) out.push({ datum: U.addDays(t.datum, -14), titel: `Anzeige § 22 AWaffV an Behörde: ${t.staette || t.id}`, quelle: `${t.id} · Schießtermin ${U.de(t.datum)} · 2 Wochen vorher`, go: ['schiesstermin', t.id] });
    if (SS.v22(t) && t.status === 'durchgeführt' && !t.beendigungAngezeigt) out.push({ datum: U.addDays(t.datum, 14), titel: `Beendigung § 22 AWaffV anzeigen: ${t.staette || t.id}`, quelle: `${t.id} · binnen 2 Wochen`, go: ['schiesstermin', t.id] });
    if (t.status === 'geplant' && t.datum >= heute && U.days(heute, t.datum) <= 14) out.push({ datum: t.datum, zeit: t.von ? `${t.von}–${t.bis} Uhr` : '', titel: `Schießstand: ${t.art.split(' (')[0]} – ${t.staette || ''}`, quelle: `${t.id} · ${t.teilnehmer.length} Teilnehmende`, go: ['schiesstermin', t.id],
      cal: { uid: 'ss-' + t.id, datum: t.datum, von: t.von, ende: t.bis, titel: `Schießstand: ${t.staette || t.art}`, ort: t.adresse || t.staette || '', text: `${t.art}\nAufsicht: ${t.aufsicht}`, erinnerung: 60 } });
  });
  TE._last = out.sort((a, b) => a.datum.localeCompare(b.datum)); return TE._last; }; })();

/* ================= Ansicht: Liste ================= */
AC.views.schiessstand = async (v) => {
  const all = await SS.loadAll(), jahre = [...new Set(all.filter(SS.v22).map(t => (t.datum || '').slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
  AC.head('Schießstand', 'Standaufsicht und eigene Schießtermine · Ablage: Ordner „schiessstand“', '<button class="btn light" id="sNeu">+ Neuer Schießtermin</button>');
  const warn = all.filter(t => t.status !== 'abgesagt' && SS.hinweise(t).length);
  v.innerHTML = `${warn.length ? `<div class="card">${warn.map(t => `<p class="hint" style="margin:4px 0"><b>${t.id}</b> (${U.de(t.datum)}): ${U.esc(SS.hinweise(t)[0])}</p>`).join('')}</div>` : ''}
    ${all.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Datum</th><th>Art</th><th>Schießstätte</th><th class="num">TN</th><th>Status</th></tr></thead><tbody>
      ${all.map(t => `<tr class="click" data-t="${t.id}"><td><b>${t.id}</b></td><td>${U.de(t.datum)}<div class="small muted">${t.von ? t.von + '–' + t.bis : ''}</div></td><td>${U.esc(t.art)}</td><td>${U.esc(t.staette || '')}<div class="small muted">${U.esc(t.betreiber || '')}</div></td>
        <td class="num">${t.teilnehmer.filter(x => x.name).length}</td><td><span class="badge ${t.status === 'durchgeführt' ? 'bezahlt' : t.status === 'abgesagt' ? 'storniert' : 'offen'}">${U.esc(t.status)}</span></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="card empty">Noch keine Schießtermine. Mit „+ Neuer Schießtermin“ legst du eine Standaufsicht oder eine eigene Schießübung an.</div>'}
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2>Leere Vorlagen</h2><p class="small muted">Zum Ausdrucken ohne Termin, z. B. als Vorrat für den Stand.</p><div class="chips">${SS.DOCS.map(([k, t]) => `<button class="chip" data-leer="${k}">${t}</button>`).join('')}</div></div>
      <div class="card"><h2>Verzeichnis nach § 24 AWaffV</h2><p class="small muted">Aufsicht, Ausbilder und Teilnehmer aller Verteidigungsschießen eines Jahres. 5 Jahre aufbewahren.</p>
        <div class="row"><select id="sJ">${jahre.map(j => `<option>${j}</option>`).join('')}</select><button class="btn light" id="sVz">Verzeichnis als PDF</button></div></div></div>
    <div class="card"><h2>Vorschriften und Wissen</h2><p class="small">§§ 27, 27a WaffG · §§ 9–11, 22–25 AWaffV · Schießstandrichtlinien · DGUV Vorschrift 23 §§ 18–22. Ausführlich im Second Brain auf der Seite „Schießstandaufsicht“. Deine Nachweise (Sachkunde, Standaufsicht, Erste Hilfe) pflegst du unter <a href="#" id="toNw">Nachweise & Sicherung</a>.</p></div>`;
  document.getElementById('sNeu').onclick = () => AC.go('schiesstermin');
  v.querySelectorAll('[data-t]').forEach(r => r.onclick = () => AC.go('schiesstermin', r.dataset.t));
  v.querySelectorAll('[data-leer]').forEach(b => b.onclick = async () => { const k = b.dataset.leer, doc = SS[k](k === 'protokoll' ? Object.assign(SS.blank(), { id: '', datum: '', von: '', aufsicht: '', art: 'Schießtermin' }) : null), name = `${SS.DATEI[k]}_leer.pdf`; await FS.write('schiessstand/vorlagen/' + name, doc.output('blob')); AC.preview(doc, name); });
  v.querySelector('#sVz').onclick = async () => { const j = v.querySelector('#sJ').value, l = all.filter(t => SS.v22(t) && t.status !== 'abgesagt' && (t.datum || '').startsWith(j));
    const doc = SS.verzeichnis(j, l), name = `Verzeichnis-24-AWaffV_${j}.pdf`; await FS.write('schiessstand/' + name, doc.output('blob')); AC.toast('Abgelegt: schiessstand/' + name); AC.preview(doc, name); };
  v.querySelector('#toNw').onclick = e => { e.preventDefault(); AC.go('nachweise'); };
};

/* ================= Ansicht: ein Schießtermin ================= */
AC.views.schiesstermin = async (v, id, startTab = 0) => {
  await K.load(); const lgs = await LG.loadAll();
  const t = id ? await SS.get(id) : SS.blank(); if (!t) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  t.notfall = Object.assign({ krankenhaus: '', anfahrt: '', ersthelfer: '', sammelplatz: '' }, t.notfall || {});
  const F = AC.F; let tab = startTab, dirty = false; const TABS = ['Grunddaten', 'Teilnehmende', 'Unterlagen'];
  const save = async (msg) => { if (!t.datum) { AC.toast('Bitte ein Datum angeben', true); return false; } await SS.save(t); dirty = false; if (msg) AC.toast('Gespeichert: schiessstand/' + t.id + '.json'); return true; };
  const draw = () => {
    AC.head(t.id ? `${t.id} · ${t.staette || 'Schießtermin'}` : 'Neuer Schießtermin', t.id ? `${U.de(t.datum)} · ${t.art}` : 'Grunddaten ausfüllen und speichern',
      `<button class="btn ghost" id="sBack">← Liste</button>${t.id ? '<button class="btn ghost" id="sDel">🗑 Löschen</button>' : ''}<button class="btn light" id="sSave">Speichern</button>`);
    const h = SS.hinweise(t); let body = '';
    if (tab === 0) body = `<div class="card"><h2>Termin</h2><div class="grid g4">
      ${F.select('Art', 'art', t.art, SS.ARTEN, { span: 2 })}${F.select('Status', 'status', t.status, SS.STATUS)}${F.input('Datum', 'datum', t.datum, { type: 'date' })}
      ${F.input('von', 'von', t.von, { type: 'time' })}${F.input('bis', 'bis', t.bis, { type: 'time' })}${F.input('Schießstätte (Name)', 'staette', t.staette, { span: 2 })}
      ${F.input('Adresse der Schießstätte', 'adresse', t.adresse, { span: 2 })}${F.area('Betreiber / Verein (Name und Anschrift, für Schreiben)', 'betreiber', t.betreiber, { span: 2, rows: 3 })}
      <label class="f"><span>Auftraggeber (optional)</span><select data-p="kundeId">${K.options(t.kundeId).replace('– Kunde wählen –', '– ohne –')}</select></label>
      <label class="f"><span>Lehrgang (optional)</span><select data-p="lehrgangId"><option value="">– ohne –</option>${lgs.map(l => `<option value="${l.id}"${l.id === t.lehrgangId ? ' selected' : ''}>${l.id} · ${U.esc(l.titel)}</option>`).join('')}</select></label>
      ${F.input('Verantwortliche Aufsicht', 'aufsicht', t.aufsicht, { span: 2 })}${F.input('Ausbilder (mehrere mit Komma)', 'ausbilder', t.ausbilder, { span: 2 })}</div></div>
      <div class="card"><h2>Anzeigen und Fristen</h2><div class="grid g4">
      ${/^Standaufsicht/.test(t.art) ? F.input('Anzeige durch Betreiber / Registrierung Verein bestätigt am', 'anzeigeBetreiber', t.anzeigeBetreiber, { type: 'date', span: 2 }) : ''}
      ${SS.v22(t) ? `${F.area('Zuständige Behörde (Name und Anschrift)', 'behoerde', t.behoerde, { span: 2, rows: 3, ph: 'z. B. Kreispolizeibehörde …' })}${F.input('Anzeige an Behörde am', 'anzeigeBehoerde', t.anzeigeBehoerde, { type: 'date' })}${F.input('Beendigung angezeigt am', 'beendigungAngezeigt', t.beendigungAngezeigt, { type: 'date' })}` : ''}</div>
      <p class="small muted">${SS.v22(t) ? 'Verteidigungsschießen: Anzeige 2 Wochen vorher mit Personalien von Aufsicht und Ausbildern, Erklärung an den Betreiber, Beendigung binnen 2 Wochen (§ 22 AWaffV). Die Schreiben findest du unter „Unterlagen“.' : 'Standaufsicht: Der Betreiber zeigt dich 2 Wochen vorher der Behörde an; beim Verein eines anerkannten Schießsportverbands genügt die Registrierung mit Nachweisdokument (§ 10 Abs. 2, 3 AWaffV).'}</p></div>
      <div class="card"><h2>Notfall</h2><div class="grid g4">${F.input('Nächstes Krankenhaus', 'notfall.krankenhaus', t.notfall.krankenhaus, { span: 2 })}${F.input('Anfahrt / Zufahrt Rettungsdienst', 'notfall.anfahrt', t.notfall.anfahrt, { span: 2 })}
      ${F.input('Ersthelfer', 'notfall.ersthelfer', t.notfall.ersthelfer, { span: 2 })}${F.input('Sammelplatz', 'notfall.sammelplatz', t.notfall.sammelplatz, { span: 2 })}</div></div>
      <div class="card"><h2>Vorkommnisse und Notizen</h2><div class="grid g2">${F.area('Besondere Vorkommnisse (erscheinen im Protokoll)', 'vorkommnisse', t.vorkommnisse, { rows: 3 })}${F.area('Interne Notiz', 'notiz', t.notiz, { rows: 3 })}</div></div>`;
    if (tab === 1) body = `<div class="card"><h2>Teilnehmende (${t.teilnehmer.length})</h2>
      <p class="small muted">${SS.v22(t) ? 'Verteidigungsschießen: nur mit Waffenschein oder Bescheinigung (§ 23 Abs. 1 AWaffV). Für das Verzeichnis nach § 24 AWaffV Geburtsdatum, -ort, Anschrift und Nummer, Datum und Behörde des Dokuments erfassen.' : 'Vor Beginn die Berechtigung prüfen und „geprüft“ anhaken (§ 9 AWaffV). Bei Minderjährigen das schriftliche Einverständnis einsammeln (§ 27 Abs. 3 WaffG).'}</p>
      <div class="tw"><table class="t"><thead><tr><th>Name</th><th>Vorname</th><th>Berechtigung</th><th>Nr.</th><th>ausgestellt</th><th>Behörde</th><th>Waffe / Kaliber</th><th title="geprüft">✓</th>${SS.v22(t) ? '<th>Geb.-Datum</th><th>Geb.-Ort</th><th>Anschrift</th>' : '<th title="Einverständnis Sorgeberechtigte">Einv.</th>'}<th></th></tr></thead><tbody>
      ${t.teilnehmer.map((x, i) => `<tr><td><input data-p="teilnehmer.${i}.name" value="${U.esc(x.name)}" style="min-width:120px"></td><td><input data-p="teilnehmer.${i}.vorname" value="${U.esc(x.vorname)}" style="min-width:110px"></td>
        <td><select data-p="teilnehmer.${i}.berechtigung" style="min-width:190px">${SS.BERECHTIGUNG.map(b => `<option${b === x.berechtigung ? ' selected' : ''}>${b}</option>`).join('')}</select></td>
        <td><input data-p="teilnehmer.${i}.nr" value="${U.esc(x.nr)}" style="width:90px"></td><td><input type="date" data-p="teilnehmer.${i}.ausgestellt" value="${U.esc(x.ausgestellt)}"></td><td><input data-p="teilnehmer.${i}.behoerde" value="${U.esc(x.behoerde)}"></td>
        <td><input data-p="teilnehmer.${i}.waffe" value="${U.esc(x.waffe)}" style="min-width:150px"></td><td class="att"><input type="checkbox" data-p="teilnehmer.${i}.geprueft"${x.geprueft ? ' checked' : ''}></td>
        ${SS.v22(t) ? `<td><input type="date" data-p="teilnehmer.${i}.gebDatum" value="${U.esc(x.gebDatum)}"></td><td><input data-p="teilnehmer.${i}.gebOrt" value="${U.esc(x.gebOrt)}"></td><td><input data-p="teilnehmer.${i}.anschrift" value="${U.esc(x.anschrift)}"></td>`
          : `<td class="att"><input type="checkbox" data-p="teilnehmer.${i}.einverstaendnis"${x.einverstaendnis ? ' checked' : ''}></td>`}
        <td><button class="x" data-tdel="${i}">✕</button></td></tr>`).join('') || `<tr><td colspan="12" class="muted small">Noch keine Teilnehmenden.</td></tr>`}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn light sm" id="tAdd">+ Teilnehmer</button>${t.lehrgangId ? '<button class="btn light sm" id="tLg">aus dem Lehrgang übernehmen</button>' : ''}</div></div>`;
    if (tab === 2) body = `<div class="card"><h2>Unterlagen zu diesem Termin</h2><p class="small muted">Alles wird im Ordner <b>schiessstand/${t.id || '…'}</b> abgelegt und kann gedruckt werden.</p>
      <div class="grid g3">${SS.DOCS.map(([k, ti, de]) => `<div><button class="btn" data-doc="${k}">${ti}</button><div class="small muted">${de}</div></div>`).join('')}</div></div>
      ${SS.v22(t) ? `<div class="card"><h2>Schreiben nach § 22 AWaffV</h2><div class="grid g3"><div><button class="btn" data-doc="anzeige">Anzeige an Behörde</button><div class="small muted">2 Wochen vorher, mit Personalien von Aufsicht und Ausbildern</div></div>
        <div><button class="btn" data-doc="erklaerung">Erklärung an Betreiber</button><div class="small muted">Anzeige ist erfolgt (§ 22 Abs. 2 S. 4)</div></div><div><button class="btn" data-doc="ende">Anzeige der Beendigung</button><div class="small muted">binnen 2 Wochen nach Ende</div></div></div></div>` : ''}`;
    v.innerHTML = `${h.length ? `<div class="card">${h.map(x => `<p class="hint" style="margin:4px 0">${U.esc(x)}</p>`).join('')}</div>` : ''}<div class="steps">${TABS.map((x, i) => `<button data-tab="${i}" class="${i === tab ? 'on' : ''}"><span class="n">${i + 1}</span>${x}</button>`).join('')}</div>${body}`;
    F.bind(v, t, p => { dirty = true; if (p === 'art' || /berechtigung|geprueft|einverstaendnis|status|anzeige|beendigung/.test(p)) { const sc = scrollY; draw(); scrollTo(0, sc); } });
    const q = s => v.querySelector(s), qa = (s, fn) => v.querySelectorAll(s).forEach(fn);
    document.getElementById('sBack').onclick = async () => { if (dirty && await AC.confirm('Änderungen speichern?', 'Es gibt ungespeicherte Änderungen.', 'Speichern', '')) await save(); AC.go('schiessstand'); };
    document.getElementById('sSave').onclick = async () => { if (await save(true)) draw(); };
    const del = document.getElementById('sDel'); if (del) del.onclick = async () => { if (!await AC.confirm('Schießtermin löschen?', `${t.id} mit allen Teilnehmerdaten wird gelöscht. Abgelegte PDFs bleiben im Ordner. Achtung: Für Verteidigungsschießen gilt eine Aufbewahrungsfrist von 5 Jahren (§ 24 Abs. 4 AWaffV).`, 'Löschen')) return; await FS.remove(`schiessstand/${t.id}.json`); AC.go('schiessstand'); };
    qa('[data-tab]', b => b.onclick = async () => { if (!t.id && !await save()) return; tab = +b.dataset.tab; draw(); });
    if (q('#tAdd')) q('#tAdd').onclick = () => { t.teilnehmer.push(SS.tn()); dirty = true; draw(); };
    qa('[data-tdel]', b => b.onclick = () => { t.teilnehmer.splice(+b.dataset.tdel, 1); dirty = true; draw(); });
    if (q('#tLg')) q('#tLg').onclick = async () => { const lg = await LG.get(t.lehrgangId); if (!lg) return; const da = new Set(t.teilnehmer.map(x => x.name + '|' + x.vorname)); let n = 0;
      lg.teilnehmer.filter(x => x.name && !da.has(x.name + '|' + x.vorname)).forEach(x => { t.teilnehmer.push(Object.assign(SS.tn(), { name: x.name, vorname: x.vorname, gebDatum: x.geburtsdatum || '', berechtigung: /Sachkunde/.test(t.art) ? 'Sachkundelehrgang (ohne Erlaubnis)' : 'Waffenschein' })); n++; });
      dirty = true; AC.toast(`${n} übernommen`); draw(); };
    qa('[data-doc]', b => b.onclick = async () => { if (!await save()) return; const k = b.dataset.doc;
      const doc = k === 'ende' ? SS.anzeige(t, true) : k === 'anzeige' ? SS.anzeige(t, false) : SS[k](t), name = `${SS.DATEI[k]}_${t.id}.pdf`;
      await FS.write(`schiessstand/${t.id}/${name}`, doc.output('blob')); AC.toast(`Abgelegt: schiessstand/${t.id}/${name}`); AC.preview(doc, name); });
  };
  draw();
};

/* Formulare möglichst auf eine Seite bringen (Schrift wird bei Bedarf leicht verkleinert) */
['protokoll', 'belehrung', 'checkliste', 'ausgabe', 'vorfall', 'einverstaendnis', 'notfall'].forEach(k => { const f = SS[k]; SS[k] = t => PDF.fit(() => f(t)); });
