/* =====================================================================
   AC Office – PDF-Erstellung im Corporate Design (pdf.js)
   Briefe nach DIN 5008 (Form B), Berichte, Tabellen, GiroCode
   Maße in Millimeter, A4 = 210 × 297
   ===================================================================== */
'use strict';
const PDF = AC.PDF = {
  C: { black: [28, 29, 28], olive: [91, 92, 66], olive2: [142, 143, 112], khaki: [173, 174, 142], grau: [89, 89, 89], input: [244, 244, 236], line: [201, 202, 176], white: [255, 255, 255], rot: [176, 58, 46] },
  clean: s => String(s ?? '').replace(/[  ]/g, ' ').replace(/\t/g, '    '),

  /* neues Dokument. kind: 'letter' (Geschäftsbrief) | 'report' (Bericht) | 'form' (Formular/Liste) */
  create(kind = 'letter', o = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: o.landscape ? 'landscape' : 'portrait', compress: true });
    doc.addFileToVFS('Carlito-Regular.ttf', ACA.fonts.Regular); doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
    doc.addFileToVFS('Carlito-Bold.ttf', ACA.fonts.Bold); doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
    doc.addFileToVFS('Carlito-Italic.ttf', ACA.fonts.Italic); doc.addFont('Carlito-Italic.ttf', 'Carlito', 'italic');
    doc.setFont('Carlito', 'normal'); doc.setLineHeightFactor(1.25);
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const ctx = { doc, kind, W, H, left: kind === 'letter' ? 25 : 18, right: kind === 'letter' ? 20 : 18, top: 20, y: 40,
      bottom: H - (kind === 'letter' ? 27 : 16), title: o.title || '', footer: o.footer || '' };
    ctx.w = W - ctx.left - ctx.right;
    doc.setProperties({ title: o.title || 'AC Security', author: AC.settings.absender.name, creator: 'AC Office', subject: o.title || '' });
    return ctx;
  },
  /* Skalierung: 1 = Normalgröße. PDF.fit() verkleinert Schrift und Abstände schrittweise, bis alles auf eine Seite passt */
  S: 1,
  font(doc, size = 11, style = 'normal', color = PDF.C.black) { doc.setFont('Carlito', style); doc.setFontSize(size * PDF.S); doc.setTextColor(...color); },
  /* baut ein Dokument so oft mit kleinerer Skalierung, bis es auf eine Seite passt.
     Reicht auch die kleinste Stufe nicht, wird die Variante gewählt, deren letzte Seite gut gefüllt ist (keine Seite mit nur einem Satz). */
  fit(build, scales = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]) {
    const res = [];
    for (const s of scales) {
      PDF.S = s; let doc; try { doc = build(); } finally { PDF.S = 1; }
      doc._acS = s; const pages = doc.getNumberOfPages(); if (pages === 1) return doc;
      res.push({ doc, s, pages, lastY: doc._acLastY || 0 });
    }
    const minP = Math.min(...res.map(r => r.pages)), cand = res.filter(r => r.pages === minP);
    return (cand.find(r => r.lastY >= 75) || cand.sort((a, b) => b.lastY - a.lastY)[0]).doc;
  },

  /* Verlauf Oliv hell → Oliv als Streifen */
  grad(doc, x, y, w, h) { const n = Math.max(20, Math.round(h * 3)); for (let i = 0; i < n; i++) { const t = i / (n - 1); const c = PDF.C.olive2.map((v, k) => Math.round(v + (PDF.C.olive[k] - v) * t)); doc.setFillColor(...c); doc.rect(x, y + h * i / n, w, h / n + 0.08, 'F'); } },
  bandFirst(ctx) {
    const { doc, W } = ctx, a = AC.settings.absender, h = 32;
    PDF.grad(doc, 0, 0, W, h);
    const x = ctx.kind === 'letter' ? 25 : 18;
    PDF.font(doc, 20, 'bold', PDF.C.white); doc.text(PDF.clean(a.name), x, 12);
    PDF.font(doc, 13, 'bold', PDF.C.white); doc.text(PDF.clean(a.firma), x, 19.5);
    PDF.font(doc, 9.5, 'normal', [226, 226, 212]); doc.text(PDF.clean([a.titel, a.quali].filter(Boolean).join('  ·  ')), x, 25.5);
    const [lw, lh] = ACA.size.logoBand, hh = 26, ww = hh * lw / lh;
    doc.addImage(ACA.img.logoBand, 'PNG', W - 15 - ww, 3, ww, hh, 'logoBand', 'FAST');
  },
  bandNext(ctx) {
    const { doc, W } = ctx, a = AC.settings.absender, h = 11;
    PDF.grad(doc, 0, 0, W, h);
    PDF.font(doc, 11, 'bold', PDF.C.white); doc.text(PDF.clean(a.name), ctx.left, 7.3);
    PDF.font(doc, 9.5, 'normal', PDF.C.white); doc.text(PDF.clean(a.firma), W - 27, 7.1, { align: 'right' });
    doc.addImage(ACA.img.wappen, 'PNG', W - 23, 1.4, 7.8, 8.2, 'wappen', 'FAST');
  },
  /* Fußzeile: Briefe mit Geschäftsangaben, sonst Copyright + Seitenzahl */
  footer(ctx, i, n) {
    const { doc, W, H } = ctx, a = AC.settings.absender, b = AC.settings.bank, s = AC.settings.steuer;
    if (ctx.kind === 'letter') {
      doc.setDrawColor(...PDF.C.khaki); doc.setLineWidth(0.3); doc.line(ctx.left, H - 22, W - ctx.right, H - 22);
      const cols = [
        [a.firma, a.name, a.strasse, `${a.plz} ${a.ort}`],
        ['Telefon ' + a.tel, a.mobil ? 'Mobil ' + a.mobil : '', a.mail, a.web],
        [b.name, 'IBAN ' + b.iban, 'BIC ' + b.bic, b.paypal ? 'PayPal ' + b.paypal : ''],
        [s.steuernummer ? 'Steuernummer ' + s.steuernummer : 'Steuernummer: [in Einstellungen eintragen]', s.ustid ? 'USt-IdNr. ' + s.ustid : '', s.kleinunternehmer ? 'Kleinunternehmer § 19 UStG' : '', ''],
      ];
      const cw = ctx.w / 4; PDF.font(doc, 7.2, 'normal', PDF.C.grau);
      cols.forEach((c, k) => doc.text(c.filter(Boolean).map(PDF.clean), ctx.left + k * cw, H - 18.5, { lineHeightFactor: 1.3 }));
      if (n > 1) { PDF.font(doc, 8, 'normal', PDF.C.grau); doc.text(`Seite ${i} von ${n}`, W - ctx.right, H - 24, { align: 'right' }); }
    } else {
      doc.setDrawColor(...PDF.C.khaki); doc.setLineWidth(0.3); doc.line(ctx.left, H - 12, W - ctx.right, H - 12);
      PDF.font(doc, 7.5, 'normal', PDF.C.grau);
      doc.text(`© ${new Date().getFullYear()} ${PDF.clean(a.firma)} · ${PDF.clean(a.name)}`, ctx.left, H - 8);
      if (ctx.footer) doc.text(PDF.clean(ctx.footer), W / 2, H - 8, { align: 'center' });
      doc.text(`Seite ${i} von ${n}`, W - ctx.right, H - 8, { align: 'right' });
    }
  },
  /* am Ende: Kopfbänder und Fußzeilen auf alle Seiten */
  finish(ctx) {
    const { doc } = ctx, n = doc.getNumberOfPages(), s = PDF.S; doc._acLastY = ctx.y; PDF.S = 1;
    for (let i = 1; i <= n; i++) { doc.setPage(i); ((i === 1 && !ctx.noFirstBand) || ctx.allFirst) ? PDF.bandFirst(ctx) : PDF.bandNext(ctx); PDF.footer(ctx, ctx.allFirst ? 1 : i, ctx.allFirst ? 1 : n); }
    PDF.S = s; return doc;
  },
  addPage(ctx) { ctx.doc.addPage(); ctx.y = 21; },
  ensure(ctx, h) { if (ctx.y + h > ctx.bottom) PDF.addPage(ctx); },

  /* Fließtext mit automatischem Seitenumbruch. Absätze durch Leerzeile getrennt */
  text(ctx, str, o = {}) {
    const { doc } = ctx, size = o.size || 11, lh = size * PDF.S * 0.3528 * 1.3, x = o.x ?? ctx.left, w = o.w ?? ctx.w;
    PDF.font(doc, size, o.style || 'normal', o.color || PDF.C.black);
    const paras = PDF.clean(str).split(/\n/);
    paras.forEach(p => {
      const lines = p.trim() === '' ? [''] : doc.splitTextToSize(p, w);
      lines.forEach(l => { PDF.ensure(ctx, lh); PDF.font(doc, size, o.style || 'normal', o.color || PDF.C.black); doc.text(l, x, ctx.y + lh * 0.75, o.align ? { align: o.align } : undefined); ctx.y += lh; });
    });
    ctx.y += (o.after ?? 2) * PDF.S;
  },
  /* Überschrift mit Olivlinie */
  h(ctx, str, o = {}) {
    const S = PDF.S; PDF.ensure(ctx, 14 * S); ctx.y += (o.before ?? 3) * S;
    PDF.font(ctx.doc, o.size || 13, 'bold', PDF.C.black); ctx.doc.text(PDF.clean(str), ctx.left, ctx.y + 4 * S);
    ctx.y += 6 * S;
    if (o.line !== false) { ctx.doc.setDrawColor(...PDF.C.olive); ctx.doc.setLineWidth(0.5); ctx.doc.line(ctx.left, ctx.y, ctx.left + ctx.w, ctx.y); ctx.y += 3 * S; }
  },
  /* Tabelle im CD (jspdf-autotable) */
  table(ctx, head, body, o = {}) {
    const { doc } = ctx;
    doc.autoTable(Object.assign({
      head: head ? [head.map(PDF.cell)] : undefined, body: body.map(r => r.map(PDF.cell)), startY: ctx.y,
      margin: { left: o.left ?? ctx.left, right: o.right ?? ctx.right, top: 21, bottom: ctx.H - ctx.bottom + 2 },
      theme: 'grid', tableWidth: o.width || 'auto',
      styles: { font: 'Carlito', fontSize: (o.size || 9.5) * PDF.S, cellPadding: (o.pad ?? 1.8) * PDF.S, textColor: PDF.C.black, lineColor: PDF.C.line, lineWidth: 0.2, valign: 'top', overflow: 'linebreak', minCellHeight: (o.minH || 0) * PDF.S },
      headStyles: { fillColor: PDF.C.olive, textColor: 255, fontStyle: 'bold', fontSize: ((o.size || 9.5) - 0.5) * PDF.S, valign: 'middle' },
      alternateRowStyles: o.zebra === false ? {} : { fillColor: [250, 250, 246] },
      showHead: 'everyPage', rowPageBreak: 'avoid',
    }, o.at || {}));
    ctx.y = doc.lastAutoTable.finalY + (o.after ?? 4) * PDF.S;
  },
  cell: c => (c && typeof c === 'object' && !Array.isArray(c)) ? Object.assign({}, c, { content: PDF.clean(c.content) }) : PDF.clean(c),
  /* Kasten mit Khaki-Rand (Hinweise) */
  box(ctx, title, str, o = {}) {
    const { doc } = ctx, S = PDF.S, size = o.size || 9.5, lh = size * S * 0.3528 * 1.3;
    PDF.font(doc, size, 'normal'); const lines = doc.splitTextToSize(PDF.clean(str), ctx.w - 8);
    const h = 6 * S + (title ? lh + 1 : 0) + lines.length * lh;
    PDF.ensure(ctx, h + 2);
    doc.setFillColor(...PDF.C.input); doc.setDrawColor(...PDF.C.khaki); doc.setLineWidth(0.3); doc.rect(ctx.left, ctx.y, ctx.w, h, 'FD');
    doc.setFillColor(...PDF.C.khaki); doc.rect(ctx.left, ctx.y, 1.6, h, 'F');
    let y = ctx.y + 3 * S + lh * 0.75;
    if (title) { PDF.font(doc, size, 'bold'); doc.text(PDF.clean(title), ctx.left + 5, y); y += lh + 1; }
    PDF.font(doc, size, 'normal', PDF.C.black); doc.text(lines, ctx.left + 5, y);
    ctx.y += h + (o.after ?? 4) * S;
  },
  /* Ankreuzliste in Spalten */
  checks(ctx, items, checked = [], cols = 2) {
    const { doc } = ctx, S = PDF.S, cw = ctx.w / cols, lh = 5.4 * S; const rows = Math.ceil(items.length / cols);
    PDF.ensure(ctx, rows * lh + 2);
    items.forEach((it, i) => {
      const c = Math.floor(i / rows), r = i % rows, x = ctx.left + c * cw, y = ctx.y + r * lh;
      const b = 3.4 * S; doc.setDrawColor(...PDF.C.olive); doc.setLineWidth(0.3); doc.rect(x, y + 0.6 * S, b, b);
      if (checked.includes(it)) { doc.setLineWidth(0.6); doc.line(x + 0.2 * b, y + 0.6 * S + 0.53 * b, x + 0.44 * b, y + 0.6 * S + 0.82 * b); doc.line(x + 0.44 * b, y + 0.6 * S + 0.82 * b, x + 0.85 * b, y + 0.6 * S + 0.18 * b); }
      PDF.font(doc, 10, 'normal'); doc.text(doc.splitTextToSize(PDF.clean(it), cw - 7)[0], x + b + 1.8, y + 3.5 * S);
    });
    ctx.y += rows * lh + 3 * S;
  },
  /* „Ohne Unterschrift gültig“ – nur wo keine Form vorgeschrieben ist; abschaltbar unter Einstellungen.
     grund: Nebensatz mit Rechtsgrundlage, z. B. 'eine Unterschrift nach § 14 UStG nicht erforderlich ist' */
  ou(grund, art) { const s = AC.settings; if (s.ohneUnterschrift === false || (art === 'bescheinigung' && s.ohneUnterschriftBescheinigung === false)) return null;
    return { grund, name: s.absender.name, ort: s.absender.ort, datum: U.de(U.today()) }; },
  ouText: o => `Dieses Dokument wurde elektronisch erstellt und ist ohne Unterschrift gültig, da ${o.grund}.`,
  /* Unterschriftslinien; ou = { i: Index des eigenen Feldes, …PDF.ou() } ersetzt dieses Feld durch Name + Hinweis */
  sign(ctx, labels, space = 14, ou) {
    const { doc } = ctx, n = labels.length, gap = 12, w = (ctx.w - gap * (n - 1)) / n;
    space *= PDF.S; PDF.ensure(ctx, space + 8); ctx.y += space;
    labels.forEach((l, i) => { const x = ctx.left + i * (w + gap);
      if (ou && i === ou.i) { PDF.font(doc, 9.5, 'bold', PDF.C.black); doc.text(PDF.clean(`${ou.name}${ou.ort ? ' · ' + ou.ort : ''}, ${ou.datum}`), x, ctx.y - 1);
        PDF.font(doc, 7.5, 'normal', PDF.C.grau); doc.text(doc.splitTextToSize(PDF.clean(`Elektronisch erstellt – ohne Unterschrift gültig, da ${ou.grund}.`), w), x, ctx.y + 3.5); return; }
      doc.setDrawColor(...PDF.C.black); doc.setLineWidth(0.3); doc.line(x, ctx.y, x + w, ctx.y); PDF.font(doc, 8, 'normal', PDF.C.grau); doc.text(PDF.clean(l), x, ctx.y + 4); });
    ctx.y += 9 * PDF.S;
  },

  /* ---------- Geschäftsbrief nach DIN 5008, Form B ---------- */
  letter(ctx, empf, info, betreff) {
    const { doc } = ctx, a = AC.settings.absender, S = PDF.S; PDF.S = 1;
    // Falz- und Lochmarken
    doc.setDrawColor(...PDF.C.grau); doc.setLineWidth(0.2); doc.line(3, 105, 7, 105); doc.line(3, 148.5, 8, 148.5); doc.line(3, 210, 7, 210);
    // Rücksendeangabe
    PDF.font(doc, 7, 'normal', PDF.C.grau);
    const rs = PDF.clean(`${a.firma} · ${a.name} · ${a.strasse} · ${a.plz} ${a.ort}`);
    doc.text(rs, 25, 49.5); doc.setLineWidth(0.15); doc.line(25, 50.3, 25 + Math.min(doc.getTextWidth(rs), 85), 50.3);
    // Anschrift
    PDF.font(doc, 11, 'normal'); doc.text((empf || []).filter(x => x != null && x !== '').map(PDF.clean).slice(0, 7), 25, 57, { lineHeightFactor: 1.25 });
    // Informationsblock rechts
    let y = 52;
    (info || []).forEach(([k, v]) => { PDF.font(doc, 8.5, 'normal', PDF.C.grau); doc.text(PDF.clean(k), 125, y); PDF.font(doc, 9.5, 'bold'); doc.text(PDF.clean(v), 158, y); y += 4.6; });
    PDF.S = S; ctx.y = 100 - (1 - S) * 8;
    if (betreff) { PDF.font(doc, 12.5, 'bold'); doc.text(doc.splitTextToSize(PDF.clean(betreff), ctx.w), ctx.left, ctx.y); ctx.y += (6 + (doc.splitTextToSize(PDF.clean(betreff), ctx.w).length - 1) * 5.5) * S; }
    ctx.y += 3 * S;
  },
  anrede(k) {
    if (!k) return 'Sehr geehrte Damen und Herren,';
    if (k.typ === 'firma' && !k.nachname) return 'Sehr geehrte Damen und Herren,';
    if (k.anrede === 'Herr') return `Sehr geehrter Herr ${k.nachname},`;
    if (k.anrede === 'Frau') return `Sehr geehrte Frau ${k.nachname},`;
    return k.nachname ? `Guten Tag ${[k.vorname, k.nachname].filter(Boolean).join(' ')},` : 'Sehr geehrte Damen und Herren,';
  },
  gruss(ctx, extra, ou) {
    const a = AC.settings.absender;
    PDF.ensure(ctx, (ou ? 20 : 24) * PDF.S); PDF.text(ctx, AC.settings.texte.gruss, { after: ou ? 3 : 12 });
    PDF.text(ctx, a.name, { style: 'bold', after: 0 }); PDF.text(ctx, a.titel, { size: 9.5, color: PDF.C.grau, after: 2 });
    if (ou) PDF.text(ctx, PDF.ouText(ou), { size: 8.5, color: PDF.C.grau, after: 2 });
    if (extra) PDF.text(ctx, extra, { size: 9, color: PDF.C.grau });
  },

  /* ---------- GiroCode (EPC-QR) für Überweisungen ---------- */
  giro(doc, x, y, size, d) {
    if (!d.iban || !(d.amount > 0)) return false;
    const epc = ['BCD', '002', '1', 'SCT', (d.bic || '').replace(/\s/g, ''), String(d.name || '').slice(0, 70), d.iban.replace(/\s/g, ''),
      'EUR' + d.amount.toFixed(2), '', '', String(d.ref || '').slice(0, 140)].join('\n');
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const qr = qrcode(0, 'M'); qr.addData(epc, 'Byte'); qr.make();
    const n = qr.getModuleCount(), m = size / (n + 2);
    doc.setFillColor(255, 255, 255); doc.rect(x, y, size, size, 'F'); doc.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(x + (c + 1) * m, y + (r + 1) * m, m + 0.01, m + 0.01, 'F');
    return true;
  },

  /* GiroCode mit Beschriftung darunter; gibt die Unterkante zurück */
  qrBlock(ctx, x, y, d) {
    const size = 22 * PDF.S, doc = ctx.doc; if (!PDF.giro(doc, x, y, size, d)) return y;
    PDF.font(doc, 6.8, 'normal', PDF.C.grau); doc.text(['GiroCode – mit der', 'Banking-App scannen'], x + size / 2, y + size + 2.2 * PDF.S, { align: 'center', lineHeightFactor: 1.2 });
    return y + size + 6 * PDF.S;
  },
  /* Zahlungshinweis: GiroCode links, Text rechts daneben */
  payBlock(ctx, text, d) {
    const S = PDF.S, q = 22 * S; PDF.ensure(ctx, q + 8 * S); const y0 = ctx.y;
    const qb = PDF.qrBlock(ctx, ctx.left, y0, d), has = qb > y0;
    PDF.text(ctx, text, { x: has ? ctx.left + q + 6 : ctx.left, w: has ? ctx.w - q - 6 : ctx.w, size: 10.5, after: 2 });
    ctx.y = Math.max(ctx.y, qb) + 2 * S;
  },
  /* Positionstabelle (Rechnung, Angebot): Bezeichnung fett, Beschreibung grau */
  positions(ctx, positionen) {
    const { doc } = ctx;
    const body = positionen.map((p, i) => [String(i + 1), { content: p.bez + (p.text ? '\n' + p.text : ''), styles: {} }, U.nf(U.num(p.menge)), p.einheit || '', U.eur(U.num(p.preis)), U.eur(U.num(p.menge) * U.num(p.preis))]);
    PDF.table(ctx, ['Pos.', 'Leistung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'], body, {
      at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 18 }, 4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 26, halign: 'right' } },
        didParseCell: d => { if (d.section === 'head' && (d.column.index >= 4 || d.column.index === 2)) d.cell.styles.halign = 'right'; },
        willDrawCell: d => { if (d.section === 'body' && d.column.index === 1) { d.cell._l = d.cell.text; d.cell.text = []; } },
        didDrawCell: d => {
          if (d.section !== 'body' || d.column.index !== 1 || !d.cell._l) return;
          const p = positionen[d.row.index], fs = d.cell.styles.fontSize, lh = fs * 0.3528 * 1.25, w = d.cell.width - d.cell.padding('horizontal');
          PDF.font(doc, fs, 'normal'); const nb = doc.splitTextToSize(PDF.clean(p.bez), w).length;
          d.cell._l.forEach((l, i) => { PDF.font(doc, i < nb ? fs : fs - 0.5, i < nb ? 'bold' : 'normal', i < nb ? PDF.C.black : PDF.C.grau);
            doc.text(l, d.cell.x + d.cell.padding('left'), d.cell.y + d.cell.padding('top') + i * lh + lh * 0.78); }); } },
    });
  },
  /* Summenblock rechts, optional GiroCode links daneben. b = Beleg mit summen, kleinunternehmer, ustSatz */
  sums(ctx, b, o = {}) {
    const { doc } = ctx, S = PDF.S, sm = b.summen, rows = [];
    if (!b.kleinunternehmer) { rows.push(['Nettobetrag', U.eur(sm.netto)]); rows.push([`zzgl. ${U.nf(b.ustSatz)} % Umsatzsteuer`, U.eur(sm.ust)]); }
    rows.push([o.label || 'Gesamtbetrag', U.eur(sm.brutto)]);
    PDF.ensure(ctx, o.giro ? 30 * S : rows.length * 6 * S + 10); const y0 = ctx.y, tx = ctx.left + ctx.w - 75;
    const qb = o.giro ? PDF.qrBlock(ctx, ctx.left, y0, o.giro) : y0;
    rows.forEach((row, i) => { const last = i === rows.length - 1;
      if (last) { doc.setDrawColor(...PDF.C.olive); doc.setLineWidth(0.6); doc.line(tx, ctx.y, ctx.left + ctx.w, ctx.y); ctx.y += 1; }
      PDF.font(doc, last ? 12 : 10.5, last ? 'bold' : 'normal'); doc.text(row[0], tx, ctx.y + 4.5 * S); doc.text(row[1], ctx.left + ctx.w, ctx.y + 4.5 * S, { align: 'right' }); ctx.y += (last ? 7 : 5.5) * S; });
    if (b.kleinunternehmer) { ctx.y += 1; PDF.text(ctx, 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', { x: tx, w: 75, size: 8.5, color: PDF.C.grau, after: 0 }); }
    ctx.y = Math.max(ctx.y, qb) + 3 * S;
  },
  /* Empfängerzeilen aus Kundendaten */
  empf(k) {
    if (!k) return [];
    const person = [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ');
    const l = [];
    if (k.typ === 'firma') { l.push(k.firma); if (k.zusatz) l.push(k.zusatz); if (person) l.push(person); }
    else { if (person) l.push(person); if (k.zusatz) l.push(k.zusatz); }
    l.push(k.strasse, [k.plz, k.ort].filter(Boolean).join(' '));
    if (k.land && !/^deutschland$/i.test(k.land)) l.push(k.land.toUpperCase());
    return l.filter(Boolean);
  },
  fileName: (...parts) => parts.filter(Boolean).map(U.slug).join('_') + '.pdf',
};
