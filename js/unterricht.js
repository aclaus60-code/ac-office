/* =====================================================================
   AC Office – Unterricht (unterricht.js)
   1. Probeprüfungen aus der Fragenbank (Sachkunde § 34a GewO)
      Daten:  pruefungen/PP-2026-001.json   PDFs: pruefungen/PP-2026-001/
   2. Lehrgangspläne nach Sachgebieten (gespeichert im Lehrgang, Feld „plan“)
   3. Feedbackbögen mit Auswertung   Daten: feedback/LG-2026-001.json
   Fragen: js/fragenbank-daten.js (eigene Übungsfragen, keine IHK-Originalfragen)
   ===================================================================== */
'use strict';
const PP = AC.PP = {
  DB: () => AC.FB_DATEN || { sachgebiete: {}, fragen: [], muendlich: [] },
  SG: () => Object.keys(PP.DB().sachgebiete).map(Number).sort((a, b) => a - b),
  sgName: n => (PP.DB().sachgebiete[n] || (n === 8 ? 'Wiederholung und Prüfungsvorbereitung' : '')),
  frage: id => PP.DB().fragen.find(f => f.id === id),
  /* eigene Gewichtung je Sachgebiet (40 Fragen) – nicht die Verteilung der IHK */
  VERTEILUNG: { 1: 7, 2: 4, 3: 6, 4: 9, 5: 4, 6: 6, 7: 4 },
  async loadAll() { return (await FS.readAll('pruefungen')).sort((a, b) => (b.id || '').localeCompare(a.id || '')); },
  get: id => FS.readJSON(`pruefungen/${id}.json`),
  async save(p) { if (!p.id) p.id = await AC.nextNr('pruefung', 'PP', 3, 'pruefungen'); const d = Object.assign({}, p); delete d._file; await FS.writeJSON(`pruefungen/${p.id}.json`, d); },
  mischen(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; },
  /* Fragen ziehen: je Sachgebiet zufällig, Antworten zufällig gemischt (p = Reihenfolge der Originalantworten) */
  ziehen(anzahl) {
    const out = [];
    PP.SG().forEach(sg => { const pool = PP.DB().fragen.filter(f => f.sg === sg); PP.mischen(pool).slice(0, Math.min(pool.length, U.num(anzahl[sg]))).forEach(f => out.push({ id: f.id, p: PP.mischen([0, 1, 2, 3]) })); });
    return out;
  },
  /* richtige Antwort in der gedruckten Reihenfolge (0–3) */
  loesung: q => { const f = PP.frage(q.id); return f ? q.p.indexOf(f.richtig) : -1; },
  key: t => `${t.name}|${t.vorname}`,
  /* Auswertung eines Teilnehmers: je Sachgebiet richtig/gesamt */
  score(p, t) {
    const sg = {}; let r = 0, n = 0, beantwortet = 0;
    p.fragen.forEach(q => { const f = PP.frage(q.id); if (!f) return; sg[f.sg] = sg[f.sg] || { r: 0, n: 0 }; sg[f.sg].n++; n++;
      const a = (t.antworten || {})[q.id]; if (a !== undefined && a !== null && a !== '') beantwortet++;
      if (a !== undefined && a !== null && a !== '' && +a === PP.loesung(q)) { sg[f.sg].r++; r++; } });
    return { sg, r, n, beantwortet, pct: n ? Math.round(r / n * 100) : 0, ok: n ? r / n * 100 >= U.num(p.grenze || 50) : false };
  },
  /* Gruppe: Durchschnitt je Sachgebiet über alle erfassten Teilnehmenden */
  gruppe(p) {
    const tn = p.teilnehmer.filter(t => Object.keys(t.antworten || {}).length), sg = {};
    tn.forEach(t => { const s = PP.score(p, t); Object.entries(s.sg).forEach(([k, v]) => { sg[k] = sg[k] || { r: 0, n: 0 }; sg[k].r += v.r; sg[k].n += v.n; }); });
    return { n: tn.length, sg };
  },
  pct: v => v && v.n ? Math.round(v.r / v.n * 100) : null,

  /* ---------- PDFs ---------- */
  /* eine Frage mit Ankreuzkästchen; mitLoesung = richtige Antwort fett und angekreuzt */
  frageBlock(ctx, nr, q, mitLoesung) {
    const { doc } = ctx, S = PDF.S, f = PP.frage(q.id); if (!f) return;
    const lh = 10.5 * S * 0.3528 * 1.3, w = ctx.w, rL = PP.loesung(q);
    PDF.font(doc, 10.5, 'bold'); const ql = doc.splitTextToSize(PDF.clean(`${nr}.  ${f.frage}`), w);
    PDF.font(doc, 10.5, 'normal'); const ol = q.p.map((oi, k) => doc.splitTextToSize(PDF.clean(`${'abcd'[k]})  ${f.antworten[oi]}`), w - 9));
    const h = (ql.length + ol.reduce((s, l) => s + l.length, 0)) * lh + 4 * S;
    PDF.ensure(ctx, h); let y = ctx.y + 1.5 * S;
    PDF.font(doc, 10.5, 'bold'); ql.forEach(l => { doc.text(l, ctx.left, y + lh * 0.75); y += lh; });
    ol.forEach((lines, k) => { const b = 3.4 * S, bx = ctx.left + 2, by = y + lh * 0.75 - b + 0.4; VL.box(doc, bx, by, b);
      if (mitLoesung && k === rL) { doc.setDrawColor(...PDF.C.black); doc.setLineWidth(0.6); doc.line(bx + 0.2 * b, by + 0.55 * b, bx + 0.44 * b, by + 0.85 * b); doc.line(bx + 0.44 * b, by + 0.85 * b, bx + 0.9 * b, by + 0.15 * b); }
      PDF.font(doc, 10.5, mitLoesung && k === rL ? 'bold' : 'normal'); lines.forEach(l => { doc.text(l, ctx.left + 9, y + lh * 0.75); y += lh; }); });
    ctx.y = y + 2.5 * S;
  },
  gruppiert(p) { const g = {}; p.fragen.forEach(q => { const f = PP.frage(q.id); if (f) (g[f.sg] = g[f.sg] || []).push(q); }); return g; },
  bogen(p, lg, mitLoesung) {
    const ctx = PDF.create('form', { title: (mitLoesung ? 'Lösungsbogen ' : 'Probeprüfung ') + p.id, footer: `${p.id} · ${mitLoesung ? 'Lösung (Dozent)' : 'Probeprüfung'}` });
    VL.head(ctx, mitLoesung ? 'Probeprüfung – Lösungsbogen' : 'Probeprüfung Sachkunde § 34a GewO', `${p.titel || ''}${p.titel ? ' · ' : ''}${p.fragen.length} Fragen · Übungsmaterial nach dem DIHK-Rahmenplan, keine Originalprüfungsfragen`);
    if (mitLoesung) VL.infoRow(ctx, [['Prüfung', p.id], ['Datum', U.de(p.datum)], ['Lehrgang', lg ? lg.titel : '–'], ['Bestanden ab', `${U.num(p.grenze || 50)} %`]]);
    else { const L = c => ({ content: c, styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } });
      PDF.table(ctx, null, [[L('Name, Vorname'), '', L('Datum'), U.de(p.datum)], [L('Lehrgang'), lg ? lg.titel : '', L('Zeit'), `${U.num(p.dauer) || 60} Min.`]],
        { zebra: false, size: 9.5, minH: 9, at: { columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 92 }, 2: { cellWidth: 18 } } } }); }
    if (!mitLoesung) PDF.box(ctx, 'Hinweise', 'Zu jeder Frage gibt es vier Antworten, genau eine ist richtig. Kreuzen Sie die richtige Antwort deutlich an. Hilfsmittel sind nicht erlaubt. Viel Erfolg!', { size: 9.5 });
    let nr = 0; const g = PP.gruppiert(p);
    Object.keys(g).map(Number).sort((a, b) => a - b).forEach(sg => { PDF.h(ctx, `Sachgebiet ${sg}: ${PP.sgName(sg)}`, { size: 11.5 }); g[sg].forEach(q => PP.frageBlock(ctx, ++nr, q, mitLoesung)); });
    if (mitLoesung) {
      PDF.h(ctx, 'Lösungsübersicht mit Begründung', { size: 11.5 }); nr = 0;
      const rows = []; Object.keys(g).map(Number).sort((a, b) => a - b).forEach(sg => g[sg].forEach(q => { const f = PP.frage(q.id); rows.push([String(++nr), 'abcd'[PP.loesung(q)] + ')', f.begruendung || '–', f.beleg || '–', f.id]); }));
      PDF.table(ctx, ['Nr.', 'Lösung', 'Begründung', 'Beleg', 'Frage-ID'], rows, { size: 8.5, at: { columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 42 }, 4: { cellWidth: 16 } } } });
    }
    return PDF.finish(ctx);
  },
  auswertung(p, lg) {
    const ctx = PDF.create('form', { landscape: true, title: 'Auswertung ' + p.id, footer: `${p.id} · Auswertung Probeprüfung · personenbezogen – vertraulich behandeln` });
    const sgs = Object.keys(PP.gruppiert(p)).map(Number).sort((a, b) => a - b);
    VL.head(ctx, 'Auswertung Probeprüfung', `${p.titel || p.id} · ${U.de(p.datum)}${lg ? ' · ' + lg.titel : ''} · bestanden ab ${U.num(p.grenze || 50)} % (Übungsgrenze)`);
    const tn = p.teilnehmer.filter(t => Object.keys(t.antworten || {}).length);
    PDF.table(ctx, ['Teilnehmer', ...sgs.map(s => 'SG ' + s), 'Punkte', 'Ergebnis', ''], tn.map(t => { const s = PP.score(p, t);
      return [`${t.name}, ${t.vorname}`, ...sgs.map(k => s.sg[k] ? `${s.sg[k].r}/${s.sg[k].n}` : '–'), `${s.r}/${s.n}`, `${s.pct} %`, s.ok ? 'bestanden' : 'nicht bestanden']; }), { size: 9.5 });
    const gr = PP.gruppe(p);
    PDF.h(ctx, 'Gruppe: Ergebnis je Sachgebiet', { size: 11.5 });
    PDF.table(ctx, ['Sachgebiet', 'richtig', 'Quote', 'Empfehlung'], sgs.map(k => { const q = PP.pct(gr.sg[k]);
      return [`${k} ${PP.sgName(k)}`, gr.sg[k] ? `${gr.sg[k].r} von ${gr.sg[k].n}` : '–', q === null ? '–' : q + ' %', q === null ? '' : q < U.num(p.grenze || 50) ? 'gezielt wiederholen' : q < 70 ? 'festigen' : 'sicher']; }), { size: 9.5 });
    PDF.text(ctx, 'SG = Sachgebiet nach § 7 BewachV und DIHK-Rahmenplan. Die Bestehensgrenze ist eine Übungsannahme, nicht die Regel der IHK.', { size: 8.5, color: PDF.C.grau });
    return PDF.finish(ctx);
  },
  async ablegen(p, name, doc) { await FS.write(`pruefungen/${p.id}/${name}`, doc.output('blob')); },
};

/* ---------- 2. Lehrgangsplan ---------- */
const LP = AC.LP = {
  /* Vorschlag für 160 UE (eigene Planung nach dem DIHK-Rahmenplan, frei änderbar); 8 = Wiederholung/Probeprüfung */
  VORSCHLAG: { 1: 26, 2: 12, 3: 20, 4: 36, 5: 12, 6: 32, 7: 14, 8: 8 },
  THEMEN: {
    1: ['Föderalismus, Rechtssystem, öffentliches und privates Recht', 'Grundrechte (Art. 1, 2, 3, 5, 10, 12, 13, 14, 19, 104 GG)', 'Gewaltmonopol, Abgrenzung zu Polizei und Ordnungsbehörden, Public-Private-Partnership', 'Befugnisse: Jedermannsrechte und übertragene Rechte', 'Gewerberecht: §§ 11b, 14, 29, 34a GewO', 'BewachV: Unterrichtung, Sachkunde, Dienstanweisung, Ausweis, Dienstkleidung', 'Geschäftsgeheimnisse (GeschGehG), Ordnungswidrigkeiten (§ 144 GewO)'],
    2: ['DSGVO und BDSG, Begriffe (Art. 4 DSGVO)', 'Grundsätze (Art. 5), Rechtmäßigkeit (Art. 6 DSGVO, § 24 BDSG)', 'Besondere Daten (Art. 9), TOM (Art. 32), Datenpannen (Art. 33, 34)', 'Betroffenenrechte (Art. 12–22), Videoüberwachung (§ 4 BDSG)', '§§ 201, 201a, 202, 202a StGB, Haftung und Bußgeld'],
    3: ['Notwehr (§ 227), Notstand (§§ 228, 904 BGB)', 'Selbsthilfe (§§ 229, 230), Besitzwehr und Besitzkehr (§§ 859, 860)', 'Besitz und Eigentum (§§ 854 ff., 903), Besitzdiener (§ 855)', 'Unerlaubte Handlung (§§ 823, 828), Tierhalter (§ 833), Schikaneverbot (§ 226)', 'Sache und Tier (§§ 90, 90a), Fundrecht (§§ 965 ff. BGB)'],
    4: ['Aufbau StGB, Deliktsaufbau, Versuch, Täterschaft und Teilnahme', 'Antrags-, Offizial- und Privatklagedelikte', 'Notwehr und Notstand (§§ 32–35 StGB)', 'Straftaten gegen die Person (§§ 185, 223 ff., 239, 240, 323c)', 'Eigentums- und Vermögensdelikte (§§ 242–266, 303 StGB)', 'Weitere Delikte (§§ 123, 132, 132a, 153, 154, 164, 267, 306) und §§ 29, 30 BtMG', 'StPO: § 127, Polizei und Staatsanwaltschaft, Zeuge, Beschuldigtenrechte, Ordnungswidrigkeiten', 'Waffenrecht: § 28 WaffG, Erlaubnisse, kleiner Waffenschein, §§ 42, 42a, Reizstoffsprays'],
    5: ['DGUV Vorschrift 23: Geltung, Eignung, Dienstanweisung, Rauschmittelverbot', 'Objektprüfung, Objekteinweisung, Ausrüstung', 'Hunde, Schusswaffen, Geldtransporte', 'DGUV Vorschrift 1: Unterweisung, Erste Hilfe (§§ 24–26)'],
    6: ['Motivation, Selbstwert, Wahrnehmung, Vorurteile', 'Kommunikation: Sender und Empfänger, Gesprächsführung, Fragearten, aktives Zuhören', 'Körpersprache, Distanzzonen, interkulturelle Unterschiede', 'Stress, Frustration, Aggression, Konflikte, Deeskalation und ihre Grenzen', 'Eigensicherung, Kontaktaufnahme, Einsatzbewältigung', 'Betrunkene, psychisch Auffällige, schutzbedürftige Geflüchtete', 'Gruppen und Massen, Panik, Großveranstaltungen, Personenströme', 'Personalführung: Mitarbeitergespräch'],
    7: ['Mechanik: Einfriedungen, Vereinzelung, Schlösser und Schließanlagen, Sicherheitsglas', 'Elektronik: Zutrittskontrolle, Video, Gefahrenmeldeanlagen (EMA, ÜMA, BMA)', 'Wächterkontrolle, NSL und Intervention, Totmannschaltung, EDV-Sicherheit', 'Betriebs- und Bündelfunk, analog und digital', 'Brandschutz: Brandklassen, Löschmittel, Einsatz von Feuerlöschern'],
    8: ['Wiederholung, schriftliche Probeprüfung, Simulation der mündlichen Prüfung'],
  },
  /* Verteilung auf eine andere Gesamtzahl hochrechnen (Rest auf die größten Anteile) */
  skalieren(total) {
    const v = LP.VORSCHLAG, sum = Object.values(v).reduce((a, b) => a + b, 0), out = {}; let rest = total;
    const roh = Object.entries(v).map(([k, x]) => [k, x * total / sum]);
    roh.forEach(([k, x]) => { out[k] = Math.floor(x); rest -= out[k]; });
    roh.sort((a, b) => (b[1] % 1) - (a[1] % 1)).forEach(([k]) => { if (rest > 0) { out[k]++; rest--; } });
    return out;
  },
  /* Tage füllen: Sachgebiete der Reihe nach, Themen anteilig */
  erzeugen(lg, verteilung) {
    const tage = LG.tage(lg), total = Object.values(verteilung).reduce((a, b) => a + U.num(b), 0);
    if (!tage.length || !total) return null;
    const base = Math.floor(total / tage.length), extra = total - base * tage.length, cap = tage.map((_, i) => base + (i < extra ? 1 : 0));
    const queue = Object.keys(verteilung).map(Number).sort((a, b) => a - b).filter(k => U.num(verteilung[k]) > 0).map(k => ({ sg: k, rest: U.num(verteilung[k]), gesamt: U.num(verteilung[k]), done: 0 }));
    const out = tage.map((d, i) => { let c = cap[i]; const bl = [];
      while (c > 0 && queue.length) { const q = queue[0], n = Math.min(c, q.rest), th = LP.THEMEN[q.sg] || [''];
        const a = Math.floor(q.done / q.gesamt * th.length), b = Math.max(a + 1, Math.ceil((q.done + n) / q.gesamt * th.length));
        bl.push({ sg: q.sg, ue: n, themen: th.slice(a, b) }); q.rest -= n; q.done += n; c -= n; if (!q.rest) queue.shift(); }
      return { datum: d, ue: bl.reduce((s, x) => s + x.ue, 0), bloecke: bl.map(x => ({ sg: x.sg, ue: x.ue })), inhalt: bl.map(x => `SG ${x.sg} (${x.ue} UE): ${x.themen.join('; ')}`).join('\n') }; });
    return { erstellt: U.today(), verteilung, tage: out };
  },
  pdf(lg) {
    const p = lg.plan, ctx = PDF.create('form', { title: 'Lehrgangsplan ' + lg.titel, footer: `${lg.id} · Lehrgangsplan` });
    VL.head(ctx, 'Lehrgangsplan', `${lg.titel} · ${LG.zeitraum(lg)}${lg.zeiten ? ' · ' + lg.zeiten : ''}`);
    VL.infoRow(ctx, [['Ort', LG.ortText(lg) || '–'], ['Lehrgangstage', String(p.tage.length)], ['Unterrichtseinheiten', `${p.tage.reduce((s, t) => s + U.num(t.ue), 0)} à 45 Min.`]]);
    PDF.table(ctx, ['Tag', 'Datum', 'UE', 'Inhalte'], p.tage.map((t, i) => [String(i + 1), `${LG.info(t.datum).kurz} ${U.de(t.datum)}`, String(t.ue), t.inhalt || '']),
      { size: 9, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 1: { cellWidth: 26 }, 2: { cellWidth: 11, halign: 'center' } } } });
    const sum = {}; p.tage.forEach(t => (t.bloecke || []).forEach(b => { sum[b.sg] = (sum[b.sg] || 0) + U.num(b.ue); }));
    const tot = Object.values(sum).reduce((a, b) => a + b, 0);
    PDF.h(ctx, 'Verteilung auf die Sachgebiete', { size: 11.5 });
    PDF.table(ctx, ['Sachgebiet', 'UE', 'Anteil'], Object.keys(sum).map(Number).sort((a, b) => a - b).map(k => [`${k < 8 ? k + ' ' : ''}${PP.sgName(k)}`, String(sum[k]), tot ? Math.round(sum[k] / tot * 100) + ' %' : '']), { size: 9.5, at: { columnStyles: { 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' } } } });
    PDF.text(ctx, 'Sachgebiete nach § 7 BewachV; Inhalte nach dem DIHK-Rahmenplan. Die Stundenverteilung ist eine eigene Planung.', { size: 8.5, color: PDF.C.grau });
    return PDF.finish(ctx);
  },
};

/* ---------- 3. Feedback ---------- */
const FBK = AC.FBK = {
  FRAGEN: ['Die Inhalte waren verständlich aufbereitet.', 'Der Dozent hat die Inhalte fachlich kompetent vermittelt.', 'Der Praxisbezug war ausreichend.', 'Fragen wurden verständlich beantwortet.',
    'Die Unterlagen sind hilfreich.', 'Zeitplan und Tempo waren angemessen.', 'Ich fühle mich gut auf die Prüfung bzw. meine Tätigkeit vorbereitet.', 'Ich würde den Lehrgang weiterempfehlen.', 'Mein Gesamteindruck ist positiv.'],
  SKALA: ['trifft voll zu', 'trifft zu', 'teils, teils', 'trifft eher nicht zu', 'trifft nicht zu'],
  async get(lgId) { return (await FS.readJSON(`feedback/${lgId}.json`)) || { lehrgangId: lgId, boegen: [] }; },
  save: f => FS.writeJSON(`feedback/${f.lehrgangId}.json`, f),
  stat(f) { return FBK.FRAGEN.map((_, i) => { const w = f.boegen.map(b => b.werte[i]).filter(x => x >= 1 && x <= 5), n = w.length;
    return { n, mw: n ? w.reduce((a, b) => a + b, 0) / n : null, vert: [1, 2, 3, 4, 5].map(k => w.filter(x => x === k).length) }; }); },
  gesamt(f) { const s = FBK.stat(f).filter(x => x.mw !== null); return s.length ? s.reduce((a, b) => a + b.mw, 0) / s.length : null; },
  bogenPdf(lg, kopien) {
    const ctx = PDF.create('form', { title: 'Feedbackbogen ' + lg.titel, footer: 'Feedbackbogen · anonym' }); ctx.allFirst = true;
    for (let k = 0; k < Math.max(1, kopien); k++) {
      if (k) { ctx.doc.addPage(); }
      VL.head(ctx, 'Ihre Meinung zum Lehrgang', 'Der Bogen ist anonym. Ihre Rückmeldung hilft, den Unterricht zu verbessern. Vielen Dank!');
      VL.infoRow(ctx, [['Lehrgang', lg.titel], ['Zeitraum', LG.zeitraum(lg)], ['Dozent', AC.settings.absender.name]]);
      const body = FBK.FRAGEN.map(q => [q, '', '', '', '', '']);
      PDF.table(ctx, ['Aussage', ...FBK.SKALA], body, { size: 9.5, minH: 9, zebra: false,
        at: { columnStyles: { 1: { cellWidth: 19 }, 2: { cellWidth: 19 }, 3: { cellWidth: 19 }, 4: { cellWidth: 19 }, 5: { cellWidth: 19 } },
          didParseCell: d => { if (d.section === 'head' && d.column.index > 0) { d.cell.styles.halign = 'center'; d.cell.styles.fontSize = 8 * PDF.S; } },
          didDrawCell: d => { if (d.section === 'body' && d.column.index > 0) VL.box(ctx.doc, d.cell.x + d.cell.width / 2 - 2, d.cell.y + d.cell.height / 2 - 2, 4); } } });
      ['Was hat Ihnen besonders gut gefallen?', 'Was können wir besser machen?'].forEach(t => { PDF.text(ctx, t, { style: 'bold', size: 10.5, after: 1 });
        for (let i = 0; i < 3; i++) { ctx.y += 7; ctx.doc.setDrawColor(...PDF.C.line); ctx.doc.setLineWidth(0.3); ctx.doc.line(ctx.left, ctx.y, ctx.left + ctx.w, ctx.y); } ctx.y += 5; });
    }
    return PDF.finish(ctx);
  },
  auswertungPdf(lg, f) {
    const ctx = PDF.create('form', { title: 'Feedback-Auswertung ' + lg.titel, footer: `${lg.id} · Auswertung Feedback` }), st = FBK.stat(f), g = FBK.gesamt(f);
    VL.head(ctx, 'Auswertung Feedback', `${lg.titel} · ${LG.zeitraum(lg)} · ${f.boegen.length} Bögen`);
    VL.infoRow(ctx, [['Gesamtmittelwert', g === null ? '–' : U.n2(g)], ['Skala', '1 = trifft voll zu · 5 = trifft nicht zu']]);
    PDF.table(ctx, ['Aussage', 'n', 'Mittelwert', '1', '2', '3', '4', '5'], FBK.FRAGEN.map((q, i) => [q, String(st[i].n), st[i].mw === null ? '–' : U.n2(st[i].mw), ...st[i].vert.map(String)]),
      { size: 9.5, at: { columnStyles: { 1: { cellWidth: 10, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' }, 3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 10, halign: 'center' }, 5: { cellWidth: 10, halign: 'center' }, 6: { cellWidth: 10, halign: 'center' }, 7: { cellWidth: 10, halign: 'center' } } } });
    const gut = f.boegen.map(b => b.gut).filter(Boolean), bes = f.boegen.map(b => b.besser).filter(Boolean);
    if (gut.length) { PDF.h(ctx, 'Besonders gut', { size: 11.5 }); gut.forEach(t => PDF.text(ctx, '– ' + t, { size: 10, after: 1 })); }
    if (bes.length) { PDF.h(ctx, 'Verbesserungsvorschläge', { size: 11.5 }); bes.forEach(t => PDF.text(ctx, '– ' + t, { size: 10, after: 1 })); }
    return PDF.finish(ctx);
  },
};

/* ================= Ansicht: Unterricht (Übersicht mit Reitern) ================= */
AC.views.unterricht = async (v, startTab = 0) => {
  await K.load(); const lgs = await LG.loadAll(), pps = await PP.loadAll(); let tab = startTab;
  const TABS = ['Probeprüfungen', 'Lehrgangspläne', 'Feedback'];
  const fbs = {}; for (const l of lgs) { const f = await FS.readJSON(`feedback/${l.id}.json`); if (f) fbs[l.id] = f; }
  const draw = () => {
    AC.head('Unterricht', 'Probeprüfungen, Lehrgangspläne und Feedback · Ablage: Ordner „pruefungen“, „feedback“ und im Lehrgang',
      tab === 0 ? '<button class="btn ghost" id="uNeu">+ Neue Probeprüfung</button>' : '');
    const lgName = id => { const l = lgs.find(x => x.id === id); return l ? `${l.id} · ${l.titel}` : '–'; };
    let body = '';
    if (tab === 0) body = `<div class="card"><h2>Fragenbank</h2><p class="small">${PP.DB().fragen.length} Fragen in ${PP.SG().length} Sachgebieten (Stand ${U.de(PP.DB().stand || '')}): ${PP.SG().map(s => `SG ${s}: ${PP.DB().fragen.filter(f => f.sg === s).length}`).join(' · ')}.
        Eigene Übungsfragen nach dem DIHK-Rahmenplan, keine Originalfragen der IHK.</p></div>
      ${pps.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Datum</th><th>Titel</th><th>Lehrgang</th><th class="num">Fragen</th><th class="num">ausgewertet</th><th class="num">Ø Ergebnis</th></tr></thead><tbody>
        ${pps.map(p => { const tn = p.teilnehmer.filter(t => Object.keys(t.antworten || {}).length), avg = tn.length ? Math.round(tn.reduce((s, t) => s + PP.score(p, t).pct, 0) / tn.length) : null;
          return `<tr class="click" data-pp="${p.id}"><td><b>${p.id}</b></td><td>${U.de(p.datum)}</td><td>${U.esc(p.titel || '')}</td><td>${U.esc(p.lehrgangId ? lgName(p.lehrgangId) : '–')}</td><td class="num">${p.fragen.length}</td><td class="num">${tn.length} / ${p.teilnehmer.length}</td><td class="num">${avg === null ? '–' : avg + ' %'}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<div class="card empty">Noch keine Probeprüfung. Mit „+ Neue Probeprüfung“ stellst du eine aus der Fragenbank zusammen.</div>'}`;
    if (tab === 1) body = lgs.length ? `<div class="card"><h2>Lehrgangspläne</h2><p class="small muted">Verteilt die Unterrichtseinheiten eines Lehrgangs auf seine Lehrgangstage und die Sachgebiete. Grundlage sind Zeitraum und Unterrichtseinheiten aus den Grunddaten des Lehrgangs.</p>
      <div class="tw"><table class="t"><thead><tr><th>Lehrgang</th><th>Zeitraum</th><th class="num">Tage</th><th class="num">UE</th><th>Plan</th></tr></thead><tbody>
      ${lgs.map(l => `<tr class="click" data-plan="${l.id}"><td><b>${l.id}</b> · ${U.esc(l.titel)}</td><td>${LG.zeitraum(l)}</td><td class="num">${LG.tage(l).length}</td><td class="num">${U.nf(U.num(l.ue))}</td><td>${l.plan ? `<span class="badge bezahlt">erstellt ${U.de(l.plan.erstellt)}</span>` : '<span class="badge entwurf">noch keiner</span>'}</td></tr>`).join('')}</tbody></table></div></div>`
      : '<div class="card empty">Noch keine Lehrgänge. Lege zuerst unter „Lehrgänge“ einen an.</div>';
    if (tab === 2) body = lgs.length ? `<div class="card"><h2>Feedback je Lehrgang</h2><p class="small muted">Feedbackbogen drucken, ausgefüllte Bögen erfassen, Auswertung als PDF. Skala 1 = trifft voll zu bis 5 = trifft nicht zu.</p>
      <div class="tw"><table class="t"><thead><tr><th>Lehrgang</th><th>Zeitraum</th><th>Status</th><th class="num">Bögen</th><th class="num">Ø Gesamt</th></tr></thead><tbody>
      ${lgs.map(l => { const f = fbs[l.id], g = f ? FBK.gesamt(f) : null; return `<tr class="click" data-fb="${l.id}"><td><b>${l.id}</b> · ${U.esc(l.titel)}</td><td>${LG.zeitraum(l)}</td><td>${U.esc(l.status)}</td><td class="num">${f ? f.boegen.length : 0}</td><td class="num">${g === null ? '–' : U.n2(g)}</td></tr>`; }).join('')}</tbody></table></div></div>`
      : '<div class="card empty">Noch keine Lehrgänge.</div>';
    v.innerHTML = `<div class="steps">${TABS.map((t, i) => `<button data-tab="${i}" class="${i === tab ? 'on' : ''}"><span class="n">${i + 1}</span>${t}</button>`).join('')}</div>${body}`;
    v.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = +b.dataset.tab; draw(); });
    v.querySelectorAll('[data-pp]').forEach(t => t.onclick = () => AC.go('pruefung', t.dataset.pp));
    v.querySelectorAll('[data-plan]').forEach(t => t.onclick = () => AC.go('lgplan', t.dataset.plan));
    v.querySelectorAll('[data-fb]').forEach(t => t.onclick = () => AC.go('feedback', t.dataset.fb));
    const n = document.getElementById('uNeu'); if (n) n.onclick = () => PP.neu(lgs);
  };
  draw();
};

/* Dialog: neue Probeprüfung */
PP.neu = async (lgs) => {
  const sgs = PP.SG(), max = s => PP.DB().fragen.filter(f => f.sg === s).length;
  const r = await AC.dialog('Neue Probeprüfung', `<div class="grid g2">
    <label class="f" style="grid-column:span 2"><span>Titel</span><input id="ppT" value="Probeprüfung Sachkunde § 34a GewO"></label>
    <label class="f"><span>Datum</span><input type="date" id="ppD" value="${U.today()}"></label>
    <label class="f"><span>Lehrgang (optional – übernimmt die Teilnehmenden)</span><select id="ppL"><option value="">– ohne –</option>${lgs.filter(l => l.status !== 'abgesagt').map(l => `<option value="${l.id}">${l.id} · ${U.esc(l.titel)}</option>`).join('')}</select></label>
    <label class="f"><span>Bearbeitungszeit (Min.)</span><input type="number" id="ppZ" value="60"></label>
    <label class="f"><span>Bestanden ab (%)</span><input type="number" id="ppG" value="50"></label></div>
    <h3 style="margin:14px 0 6px">Fragen je Sachgebiet</h3><div class="grid g4">${sgs.map(s => `<label class="f"><span>SG ${s} (max. ${max(s)})</span><input type="number" min="0" max="${max(s)}" data-sg="${s}" value="${Math.min(max(s), PP.VERTEILUNG[s] || 4)}"></label>`).join('')}</div>
    <p class="small muted">Die Verteilung ist ein eigener Vorschlag, nicht die Gewichtung der IHK. Fragen und Antwortreihenfolge werden zufällig gemischt.</p>`, [['Abbrechen', null, 'light'], ['Erstellen', 'ok']]);
  if (r !== 'ok') return;
  const g = id => document.getElementById(id).value, anzahl = {};
  document.querySelectorAll('#dlg [data-sg]').forEach(i => { anzahl[i.dataset.sg] = Math.max(0, Math.min(max(+i.dataset.sg), U.num(i.value))); });
  const fragen = PP.ziehen(anzahl); if (!fragen.length) return AC.toast('Bitte mindestens eine Frage auswählen', true);
  const p = { id: '', titel: g('ppT'), datum: g('ppD') || U.today(), lehrgangId: g('ppL'), dauer: U.num(g('ppZ')) || 60, grenze: U.num(g('ppG')) || 50, fragen, teilnehmer: [], erstellt: U.today() };
  if (p.lehrgangId) { const lg = await LG.get(p.lehrgangId); if (lg) p.teilnehmer = lg.teilnehmer.filter(t => t.name).map(t => ({ name: t.name, vorname: t.vorname, antworten: {} })); }
  await PP.save(p); AC.toast(`${p.id} mit ${fragen.length} Fragen erstellt`); AC.go('pruefung', p.id);
};

/* ================= Ansicht: eine Probeprüfung ================= */
AC.views.pruefung = async (v, id) => {
  const p = await PP.get(id); if (!p) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const lg = p.lehrgangId ? await LG.get(p.lehrgangId) : null;
  const draw = () => {
    AC.head(`${p.id} · ${p.titel || 'Probeprüfung'}`, `${U.de(p.datum)} · ${p.fragen.length} Fragen${lg ? ' · ' + lg.titel : ''} · bestanden ab ${U.num(p.grenze || 50)} %`,
      `<button class="btn ghost" id="pBack">← Liste</button><button class="btn ghost" id="pDel">🗑 Löschen</button><button class="btn ghost" data-pdf="bogen">Prüfungsbogen</button><button class="btn ghost" data-pdf="loesung">Lösungsbogen</button><button class="btn light" data-pdf="ausw">Auswertung</button>`);
    const g = PP.gruppiert(p), gr = PP.gruppe(p), grenze = U.num(p.grenze || 50);
    v.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Zusammensetzung</h2><table class="t"><tbody>${Object.keys(g).map(Number).sort((a, b) => a - b).map(s => `<tr><td>SG ${s}</td><td>${U.esc(PP.sgName(s))}</td><td class="num">${g[s].length}</td></tr>`).join('')}</tbody></table>
        ${p.teilnehmer.some(t => Object.keys(t.antworten || {}).length) ? '' : '<p class="small" style="margin-top:8px"><a href="#" id="pMix">Fragen neu ziehen</a> (nur solange noch keine Ergebnisse erfasst sind)</p>'}</div>
      <div class="card"><h2>Gruppe je Sachgebiet</h2>${gr.n ? `<table class="t"><tbody>${Object.keys(g).map(Number).sort((a, b) => a - b).map(s => { const q = PP.pct(gr.sg[s]);
        return `<tr><td>SG ${s} · ${U.esc(PP.sgName(s))}</td><td class="num"><b style="color:${q < grenze ? 'var(--rot)' : 'inherit'}">${q === null ? '–' : q + ' %'}</b></td><td class="small">${q === null ? '' : q < grenze ? 'gezielt wiederholen' : q < 70 ? 'festigen' : 'sicher'}</td></tr>`; }).join('')}</tbody></table>
        <p class="small muted">aus ${gr.n} ausgewerteten Bögen</p>` : '<p class="muted">Noch keine Ergebnisse erfasst.</p>'}</div></div>
      <div class="card"><h2>Teilnehmende und Ergebnisse</h2>
      <div class="tw"><table class="t"><thead><tr><th>Name</th><th>Vorname</th><th class="num">beantwortet</th><th class="num">richtig</th><th class="num">Ergebnis</th><th></th><th></th></tr></thead><tbody>
      ${p.teilnehmer.map((t, i) => { const s = PP.score(p, t), has = Object.keys(t.antworten || {}).length;
        return `<tr><td><input data-tn="${i}|name" value="${U.esc(t.name)}"></td><td><input data-tn="${i}|vorname" value="${U.esc(t.vorname)}"></td><td class="num">${s.beantwortet} / ${s.n}</td><td class="num">${has ? s.r : '–'}</td>
          <td class="num">${has ? `<span class="badge ${s.ok ? 'bezahlt' : 'storniert'}">${s.pct} % · ${s.ok ? 'bestanden' : 'nicht bestanden'}</span>` : '–'}</td>
          <td><button class="btn sm" data-erf="${i}">Antworten erfassen</button></td><td><button class="x" data-tdel="${i}" title="entfernen">✕</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted small">Noch keine Teilnehmenden.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn light sm" id="tAdd">+ Teilnehmer</button>${lg ? '<button class="btn light sm" id="tLg">Teilnehmende aus dem Lehrgang übernehmen</button>' : ''}</div>
      <p class="small muted">Die Ergebnisse sind personenbezogen. Nach dem Lehrgang die Probeprüfung löschen, sobald sie nicht mehr gebraucht wird (Art. 5 DSGVO).</p></div>`;
    const q = s => v.querySelector(s), qa = (s, fn) => v.querySelectorAll(s).forEach(fn);
    document.getElementById('pBack').onclick = () => AC.go('unterricht', 0);
    document.getElementById('pDel').onclick = async () => { if (!await AC.confirm('Probeprüfung löschen?', `${p.id} mit allen erfassten Ergebnissen wird gelöscht. Abgelegte PDFs im Ordner pruefungen/${p.id} bleiben erhalten.`, 'Löschen')) return; await FS.remove(`pruefungen/${p.id}.json`); AC.toast('Gelöscht'); AC.go('unterricht', 0); };
    document.querySelectorAll('[data-pdf]').forEach(b => b.onclick = async () => { const k = b.dataset.pdf;
      if (k === 'ausw' && !PP.gruppe(p).n) return AC.toast('Noch keine Ergebnisse erfasst', true);
      const doc = k === 'bogen' ? PP.bogen(p, lg, false) : k === 'loesung' ? PP.bogen(p, lg, true) : PP.auswertung(p, lg);
      const name = { bogen: 'Pruefungsbogen', loesung: 'Loesungsbogen', ausw: 'Auswertung' }[k] + `_${p.id}.pdf`; await PP.ablegen(p, name, doc); AC.preview(doc, name); });
    if (q('#pMix')) q('#pMix').onclick = async e => { e.preventDefault(); const anz = {}; p.fragen.forEach(x => { const f = PP.frage(x.id); if (f) anz[f.sg] = (anz[f.sg] || 0) + 1; }); p.fragen = PP.ziehen(anz); await PP.save(p); AC.toast('Neu gezogen'); draw(); };
    qa('[data-tn]', i => i.onchange = async () => { const [k, f] = i.dataset.tn.split('|'); p.teilnehmer[+k][f] = i.value.trim(); await PP.save(p); });
    qa('[data-tdel]', b => b.onclick = async () => { const t = p.teilnehmer[+b.dataset.tdel]; if (!await AC.confirm('Entfernen?', `${U.esc(t.vorname)} ${U.esc(t.name)} und die erfassten Antworten werden entfernt.`, 'Entfernen')) return; p.teilnehmer.splice(+b.dataset.tdel, 1); await PP.save(p); draw(); });
    q('#tAdd').onclick = async () => { p.teilnehmer.push({ name: '', vorname: '', antworten: {} }); await PP.save(p); draw(); };
    if (q('#tLg')) q('#tLg').onclick = async () => { const da = new Set(p.teilnehmer.map(PP.key)); let n = 0;
      lg.teilnehmer.filter(t => t.name).forEach(t => { if (!da.has(PP.key(t))) { p.teilnehmer.push({ name: t.name, vorname: t.vorname, antworten: {} }); n++; } }); await PP.save(p); AC.toast(`${n} übernommen`); draw(); };
    qa('[data-erf]', b => b.onclick = () => PP.erfassen(p, +b.dataset.erf, draw));
  };
  draw();
};

/* Dialog: Antworten eines Teilnehmers erfassen (Reihenfolge wie auf dem Prüfungsbogen) */
PP.erfassen = async (p, i, done) => {
  const t = p.teilnehmer[i], g = PP.gruppiert(p), list = []; Object.keys(g).map(Number).sort((a, b) => a - b).forEach(s => g[s].forEach(q => list.push(q)));
  const a = t.antworten || {};
  const r = await AC.dialog(`Antworten: ${t.vorname} ${t.name}`.trim(), `<p class="small muted">Angekreuzte Antwort je Frage wählen (wie auf dem Prüfungsbogen). „–“ = nicht beantwortet.</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px">${list.map((q, k) => `<div class="row" style="gap:6px;flex-wrap:nowrap"><b style="width:28px;text-align:right">${k + 1}</b>
      ${['–', 'a', 'b', 'c', 'd'].map((l, j) => `<label style="display:flex;gap:2px;align-items:center;font-weight:400"><input type="radio" name="pa_${k}" value="${j - 1}"${(j === 0 && (a[q.id] === undefined || a[q.id] === '')) || (j > 0 && +a[q.id] === j - 1 && a[q.id] !== '' && a[q.id] !== undefined) ? ' checked' : ''}>${l}</label>`).join('')}</div>`).join('')}</div>`,
    [['Abbrechen', null, 'light'], ['Speichern', 'ok']]);
  if (r !== 'ok') return;
  const neu = {}; list.forEach((q, k) => { const el = document.querySelector(`#dlg input[name="pa_${k}"]:checked`); if (el && el.value !== '-1') neu[q.id] = +el.value; });
  t.antworten = neu; await PP.save(p); const s = PP.score(p, t); AC.toast(`${t.vorname} ${t.name}: ${s.r} von ${s.n} richtig (${s.pct} %)`); done();
};

/* ================= Ansicht: Lehrgangsplan ================= */
AC.views.lgplan = async (v, id) => {
  const lg = await LG.get(id); if (!lg) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const tage = LG.tage(lg), total = U.num(lg.ue) || tage.length * 8;
  let vert = lg.plan ? Object.assign({}, lg.plan.verteilung) : LP.skalieren(total);
  const draw = () => {
    const sum = Object.values(vert).reduce((a, b) => a + U.num(b), 0);
    AC.head(`Lehrgangsplan · ${lg.titel}`, `${lg.id} · ${LG.zeitraum(lg)} · ${tage.length} Lehrgangstage · ${U.nf(total)} UE laut Grunddaten`,
      `<button class="btn ghost" id="lpBack">← Unterricht</button><button class="btn ghost" id="lpLg">Lehrgang öffnen</button>${lg.plan ? '<button class="btn ghost" id="lpSave">Speichern</button><button class="btn light" id="lpPdf">Plan als PDF</button>' : ''}`);
    v.innerHTML = `<div class="card"><h2>Verteilung der Unterrichtseinheiten</h2>
      <p class="small muted">Vorschlag für die Sachkunde-Vorbereitung, hochgerechnet auf ${U.nf(total)} UE. Eigene Planung nach dem DIHK-Rahmenplan – frei änderbar. Die Unterrichtseinheiten des Lehrgangs änderst du in dessen Grunddaten.</p>
      <div class="grid g4">${Object.keys(LP.VORSCHLAG).map(Number).map(k => `<label class="f"><span>${k < 8 ? 'SG ' + k + ' · ' : ''}${U.esc(PP.sgName(k))}</span><input type="number" min="0" data-v="${k}" value="${U.num(vert[k])}"></label>`).join('')}</div>
      <p class="small" style="margin-top:8px">Summe: <b style="color:${sum !== total ? 'var(--rot)' : 'inherit'}">${sum} UE</b>${sum !== total ? ` (Grunddaten: ${U.nf(total)} UE)` : ''} · ${tage.length ? `ca. ${U.nf(sum / tage.length)} UE je Lehrgangstag` : 'keine Lehrgangstage im Zeitraum'}</p>
      <div class="row"><button class="btn" id="lpGen">${lg.plan ? 'Plan neu erzeugen' : 'Plan erzeugen'}</button><button class="btn light" id="lpStd">Vorschlag wiederherstellen</button></div></div>
      ${lg.plan ? `<div class="card"><h2>Tagesplan</h2><p class="small muted">Inhalte je Tag frei bearbeitbar. Änderungen mit „Speichern“ übernehmen.</p>
        <div class="tw"><table class="t"><thead><tr><th>Tag</th><th>Datum</th><th class="num">UE</th><th style="width:70%">Inhalte</th></tr></thead><tbody>
        ${lg.plan.tage.map((t, i) => `<tr><td>${i + 1}</td><td>${LG.info(t.datum).kurz} ${U.de(t.datum)}</td><td class="num"><input type="number" style="width:60px" data-pue="${i}" value="${t.ue}"></td><td><textarea rows="3" data-pin="${i}" style="width:100%">${U.esc(t.inhalt)}</textarea></td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    const q = s => v.querySelector(s);
    document.getElementById('lpBack').onclick = () => AC.go('unterricht', 1);
    document.getElementById('lpLg').onclick = () => AC.go('lehrgang', lg.id);
    v.querySelectorAll('[data-v]').forEach(i => i.oninput = () => { vert[i.dataset.v] = U.num(i.value); });
    v.querySelectorAll('[data-v]').forEach(i => i.onchange = () => draw());
    v.querySelectorAll('[data-pin]').forEach(i => i.oninput = () => { lg.plan.tage[+i.dataset.pin].inhalt = i.value; });
    v.querySelectorAll('[data-pue]').forEach(i => i.oninput = () => { lg.plan.tage[+i.dataset.pue].ue = U.num(i.value); });
    q('#lpStd').onclick = () => { vert = LP.skalieren(total); draw(); };
    q('#lpGen').onclick = async () => { if (!tage.length) return AC.toast('Im Zeitraum des Lehrgangs gibt es keine Lehrgangstage', true);
      if (lg.plan && !await AC.confirm('Plan neu erzeugen?', 'Der bestehende Tagesplan mit deinen Änderungen wird überschrieben.', 'Neu erzeugen', '')) return;
      lg.plan = LP.erzeugen(lg, vert); await LG.save(lg); AC.toast('Plan erzeugt und im Lehrgang gespeichert'); draw(); };
    const s = document.getElementById('lpSave'); if (s) s.onclick = async () => { await LG.save(lg); AC.toast('Gespeichert'); };
    const pd = document.getElementById('lpPdf'); if (pd) pd.onclick = async () => { await LG.save(lg); const doc = LP.pdf(lg), name = `Lehrgangsplan_${lg.id}.pdf`; await LG.ablegen(lg, name, doc); AC.preview(doc, name); };
  };
  draw();
};

/* ================= Ansicht: Feedback zu einem Lehrgang ================= */
AC.views.feedback = async (v, id) => {
  const lg = await LG.get(id); if (!lg) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const f = await FBK.get(id);
  const draw = () => {
    const st = FBK.stat(f), g = FBK.gesamt(f);
    AC.head(`Feedback · ${lg.titel}`, `${lg.id} · ${LG.zeitraum(lg)} · ${f.boegen.length} Bögen erfasst`,
      `<button class="btn ghost" id="fBack">← Unterricht</button><button class="btn ghost" id="fBogen">Feedbackbogen drucken</button><button class="btn ghost" id="fAdd">+ Bogen erfassen</button>${f.boegen.length ? '<button class="btn light" id="fPdf">Auswertung als PDF</button>' : ''}`);
    v.innerHTML = `<div class="grid g3" style="margin-bottom:18px"><div class="kpi"><b>${f.boegen.length}</b><span>erfasste Bögen${lg.teilnehmer.length ? ' von ' + lg.teilnehmer.length + ' Teilnehmenden' : ''}</span></div>
      <div class="kpi"><b>${g === null ? '–' : U.n2(g)}</b><span>Gesamtmittelwert (1 = trifft voll zu)</span></div><div class="kpi"><b>${st[7].mw === null ? '–' : U.n2(st[7].mw)}</b><span>Weiterempfehlung</span></div></div>
      <div class="card"><h2>Auswertung</h2><table class="t"><thead><tr><th>Aussage</th><th class="num">n</th><th class="num">Mittelwert</th>${[1, 2, 3, 4, 5].map(k => `<th class="num" title="${FBK.SKALA[k - 1]}">${k}</th>`).join('')}</tr></thead><tbody>
      ${FBK.FRAGEN.map((q, i) => `<tr><td>${U.esc(q)}</td><td class="num">${st[i].n}</td><td class="num"><b>${st[i].mw === null ? '–' : U.n2(st[i].mw)}</b></td>${st[i].vert.map(n => `<td class="num">${n || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="card"><h2>Erfasste Bögen</h2>${f.boegen.length ? `<table class="t"><thead><tr><th>Nr.</th><th>Werte</th><th>gut</th><th>besser</th><th></th></tr></thead><tbody>${f.boegen.map((b, i) => `<tr><td>${i + 1}</td><td>${b.werte.map(x => x || '–').join(' ')}</td><td class="small">${U.esc(b.gut || '')}</td><td class="small">${U.esc(b.besser || '')}</td><td><button class="x" data-bdel="${i}">✕</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch keine Bögen erfasst.</p>'}</div>`;
    document.getElementById('fBack').onclick = () => AC.go('unterricht', 2);
    document.getElementById('fBogen').onclick = async () => { const r = await AC.dialog('Feedbackbogen drucken', `<label class="f"><span>Anzahl Bögen</span><input type="number" id="fbN" value="${Math.max(1, lg.teilnehmer.length || 1)}"></label>`, [['Abbrechen', null, 'light'], ['Erstellen', 'ok']], 'small');
      if (r !== 'ok') return; const doc = FBK.bogenPdf(lg, Math.min(60, U.num(document.getElementById('fbN').value) || 1)), name = `Feedbackbogen_${lg.id}.pdf`; await LG.ablegen(lg, name, doc); AC.preview(doc, name); };
    document.getElementById('fAdd').onclick = async () => {
      const r = await AC.dialog('Feedbackbogen erfassen', `<table class="t"><tbody>${FBK.FRAGEN.map((q, i) => `<tr><td>${U.esc(q)}</td><td style="white-space:nowrap">${['–', 1, 2, 3, 4, 5].map((x, j) => `<label style="display:inline-flex;gap:2px;margin-right:6px;font-weight:400"><input type="radio" name="fw_${i}" value="${j}"${j === 0 ? ' checked' : ''}>${x}</label>`).join('')}</td></tr>`).join('')}</tbody></table>
        <label class="f" style="margin-top:8px"><span>Was war besonders gut?</span><textarea id="fbG" rows="2"></textarea></label><label class="f"><span>Was kann besser werden?</span><textarea id="fbB" rows="2"></textarea></label>`,
        [['Abbrechen', null, 'light'], ['Speichern und nächster', 'next', 'light'], ['Speichern', 'ok']]);
      if (r !== 'ok' && r !== 'next') return;
      const werte = FBK.FRAGEN.map((_, i) => { const el = document.querySelector(`#dlg input[name="fw_${i}"]:checked`); return el && +el.value > 0 ? +el.value : null; });
      f.boegen.push({ werte, gut: document.getElementById('fbG').value.trim(), besser: document.getElementById('fbB').value.trim(), erfasst: U.today() }); await FBK.save(f); AC.toast(`Bogen ${f.boegen.length} gespeichert`); draw();
      if (r === 'next') document.getElementById('fAdd').click(); };
    const pdf = document.getElementById('fPdf'); if (pdf) pdf.onclick = async () => { const doc = FBK.auswertungPdf(lg, f), name = `Feedback-Auswertung_${lg.id}.pdf`; await LG.ablegen(lg, name, doc); AC.preview(doc, name); };
    v.querySelectorAll('[data-bdel]').forEach(b => b.onclick = async () => { if (!await AC.confirm('Bogen löschen?', `Bogen ${+b.dataset.bdel + 1} wird gelöscht.`, 'Löschen')) return; f.boegen.splice(+b.dataset.bdel, 1); await FBK.save(f); draw(); });
  };
  draw();
};
