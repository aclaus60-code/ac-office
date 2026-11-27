/* =====================================================================
   AC Office – Vorlagen drucken (vorlagen.js)
   Jede Vorlage: kurze Angaben ausfüllen → Vorschau / Drucken / im Ordner
   „vorlagen“ ablegen. Neue Vorlage? Einfach einen Eintrag in VORL ergänzen.
   ===================================================================== */
'use strict';
const VL = AC.VL = {
  head(ctx, titel, unter) { ctx.y = (ctx.W > 250 ? 40 : 42) - (1 - PDF.S) * 6; PDF.font(ctx.doc, 20, 'bold'); ctx.doc.text(PDF.clean(titel), ctx.left, ctx.y); ctx.y += 3 * PDF.S;
    ctx.doc.setDrawColor(...PDF.C.olive); ctx.doc.setLineWidth(0.8); ctx.doc.line(ctx.left, ctx.y, ctx.left + 35, ctx.y); ctx.y += 5 * PDF.S;
    if (unter) PDF.text(ctx, unter, { size: 9.5, color: PDF.C.grau, after: 3 }); },
  infoRow(ctx, pairs) { PDF.table(ctx, null, [pairs.flatMap(([l, v]) => [{ content: l, styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, v || ''])], { zebra: false, size: 9.5, minH: 8 }); },
  lines: (n, cols) => Array.from({ length: n }, (_, i) => cols.map((c, j) => j === 0 && c === '#' ? String(i + 1) : '')),
  /* zeichnet Ankreuzkästchen (Schrift enthält kein ☐) */
  box(doc, x, y, sz = 3.4) { doc.setDrawColor(...PDF.C.olive); doc.setLineWidth(0.3); doc.rect(x, y, sz, sz); },
  dates(start, n, werktage) { const out = []; let d = start; while (out.length < n) { const wd = new Date(d + 'T12:00:00').getDay(); if (!werktage || (wd > 0 && wd < 6)) out.push(d); d = U.addDays(d, 1); } return out; },
};
AC.VORL = [
  { id: 'brief', titel: 'Anschreiben / Brief', ic: '✉', desc: 'Geschäftsbrief nach DIN 5008 mit Anschrift aus der Kundendatei.',
    felder: [['kunde', 'Empfänger (Kunde)', 'kunde'], ['datum', 'Datum', 'date'], ['betreff', 'Betreff', 'text'], ['text', 'Text (Leerzeile = neuer Absatz)', 'area'], ['anlagen', 'Anlagen (optional)', 'text']],
    pdf(o) { const k = K.get(o.kunde), ctx = PDF.create('letter', { title: o.betreff || 'Brief' });
      PDF.letter(ctx, PDF.empf(k), [['Datum', U.de(o.datum)], ...(k ? [['Kundennr.', k.id]] : [])], o.betreff);
      PDF.text(ctx, PDF.anrede(k), { after: 2 }); PDF.text(ctx, o.text || '', { after: 4 }); PDF.gruss(ctx);
      if (o.anlagen) { ctx.y += 4; PDF.text(ctx, 'Anlagen', { style: 'bold', size: 10, after: 0 }); PDF.text(ctx, o.anlagen, { size: 10 }); }
      return PDF.finish(ctx); } },
  { id: 'briefbogen', titel: 'Briefbogen (leer)', ic: '📄', mehrseitig: true, desc: 'Leerer Briefbogen im CD mit Falzmarken und Fußzeile – zum Bedrucken oder Handschreiben.',
    felder: [['seiten', 'Anzahl Seiten', 'number', 1]],
    pdf(o) { const ctx = PDF.create('letter', { title: 'Briefbogen' }); for (let i = 1; i < (o.seiten || 1); i++) ctx.doc.addPage();
      ctx.doc.setPage(1); ctx.doc.setDrawColor(...PDF.C.grau); ctx.doc.setLineWidth(0.2); ctx.doc.line(3, 105, 7, 105); ctx.doc.line(3, 148.5, 8, 148.5); ctx.doc.line(3, 210, 7, 210);
      ctx.noFirstBand = false; return PDF.finish(ctx); } },
  { id: 'teilnehmer', titel: 'Teilnehmerliste', ic: '👥', desc: 'Querformat: Name, Vorname, Geburtsdatum, Kontakt, Lehrgangsbezeichnung.',
    felder: [['lehrgang', 'Lehrgang', 'text'], ['kunde', 'Auftraggeber (optional)', 'kunde'], ['zeitraum', 'Zeitraum', 'text'], ['ort', 'Ort', 'text'], ['zeilen', 'Anzahl Zeilen', 'number', 13]],
    pdf(o) { const ctx = PDF.create('form', { landscape: true, title: 'Teilnehmerliste', footer: 'Teilnehmerliste · enthält personenbezogene Daten – vertraulich behandeln' });
      VL.head(ctx, 'Teilnehmerliste'); VL.infoRow(ctx, [['Lehrgang', o.lehrgang], ['Auftraggeber', o.kunde ? K.name(K.get(o.kunde)) : ''], ['Zeitraum', o.zeitraum], ['Ort', o.ort]]);
      PDF.table(ctx, ['Nr.', 'Name', 'Vorname', 'Geburtsdatum', 'Kontakt (E-Mail / Tel.)', 'Lehrgangsbezeichnung'], Array.from({ length: o.zeilen || 13 }, (_, i) => [String(i + 1), '', '', '', '', o.lehrgang || '']),
        { minH: 9, size: 10, zebra: false, at: { columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 32 }, 4: { cellWidth: 70 } } } });
      return PDF.finish(ctx); } },
  { id: 'anwesenheit', titel: 'Anwesenheitsliste', ic: '✓', desc: 'Querformat mit Unterschriftsspalte je Lehrgangstag.',
    felder: [['lehrgang', 'Lehrgang', 'text'], ['kunde', 'Auftraggeber (optional)', 'kunde'], ['start', 'Erster Tag', 'date'], ['tage', 'Anzahl Tage (1–8)', 'number', 5], ['werktage', 'nur Werktage', 'check', true], ['zeilen', 'Anzahl Zeilen', 'number', 12]],
    pdf(o) { const n = Math.max(1, Math.min(8, o.tage || 5)), ds = VL.dates(o.start || U.today(), n, o.werktage);
      const ctx = PDF.create('form', { landscape: true, title: 'Anwesenheitsliste', footer: 'Anwesenheitsliste' });
      VL.head(ctx, 'Anwesenheitsliste'); VL.infoRow(ctx, [['Lehrgang', o.lehrgang], ['Auftraggeber', o.kunde ? K.name(K.get(o.kunde)) : ''], ['Zeitraum', `${U.de(ds[0])} – ${U.de(ds.at(-1))}`], ['Dozent', AC.settings.absender.name]]);
      const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      PDF.table(ctx, ['Nr.', 'Name', 'Vorname', ...ds.map(d => `${wd[new Date(d + 'T12:00:00').getDay()]} ${U.de(d).slice(0, 6)}`), 'Bemerkung'], Array.from({ length: o.zeilen || 12 }, (_, i) => [String(i + 1), '', '', ...ds.map(() => ''), '']),
        { minH: 8.6, size: 9.5, zebra: false, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 1: { cellWidth: 38 }, 2: { cellWidth: 32 } } } });
      PDF.sign(ctx, ['Datum, Unterschrift Dozent'], 9); return PDF.finish(ctx); } },
  { id: 'unterweisung', titel: 'Unterweisungsnachweis', ic: '🦺', desc: 'Nachweis nach § 12 ArbSchG und § 4 DGUV Vorschrift 1 mit Unterschriftenliste.',
    felder: [['kunde', 'Betrieb (Kunde)', 'kunde'], ['thema', 'Thema der Unterweisung', 'text'], ['datum', 'Datum', 'date'], ['dauer', 'Dauer', 'text', '45 Minuten'], ['ort', 'Ort', 'text'],
      ['inhalte', 'Inhalte (je Zeile ein Punkt)', 'area'], ['zeilen', 'Anzahl Zeilen', 'number', 12]],
    pdf(o) { const ctx = PDF.create('form', { title: 'Unterweisungsnachweis', footer: 'Unterweisungsnachweis' }), a = AC.settings.absender;
      VL.head(ctx, 'Unterweisungsnachweis', 'nach § 12 Arbeitsschutzgesetz und § 4 DGUV Vorschrift 1 „Grundsätze der Prävention“');
      PDF.table(ctx, null, [['Betrieb', o.kunde ? K.name(K.get(o.kunde)) : '', 'Datum', U.de(o.datum)], ['Thema', o.thema || '', 'Dauer', o.dauer || ''], ['Unterweisende Person', `${a.name}, ${a.quali}`, 'Ort', o.ort || '']].map(r => r.map((c, i) => i % 2 ? c : { content: c, styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } })), { zebra: false, at: { columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 18 }, 3: { cellWidth: 32 } } } });
      PDF.h(ctx, 'Inhalte der Unterweisung', { size: 11.5, line: false });
      const inh = (o.inhalte || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (inh.length) PDF.text(ctx, inh.map(x => '•  ' + x).join('\n'), { size: 10 }); else PDF.table(ctx, null, VL.lines(5, ['']), { minH: 7, zebra: false });
      PDF.text(ctx, 'Mit ihrer Unterschrift bestätigen die Teilnehmenden, an der Unterweisung teilgenommen und die Inhalte verstanden zu haben. Fragen wurden beantwortet.', { size: 9.5, style: 'italic', after: 3 });
      PDF.table(ctx, ['Nr.', 'Name', 'Vorname', 'Abteilung', 'Unterschrift'], Array.from({ length: o.zeilen || 12 }, (_, i) => [String(i + 1), '', '', '', '']), { minH: 8.5, zebra: false, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 4: { cellWidth: 50 } } } });
      PDF.sign(ctx, ['Datum, Unterschrift unterweisende Person', 'Datum, Unterschrift Verantwortliche/r des Betriebs']); return PDF.finish(ctx); } },
  { id: 'gespraech', titel: 'Gesprächs- / Telefonnotiz', ic: '☎', desc: 'Formular für Gespräche, Anrufe und Vereinbarungen.',
    felder: [['kunde', 'Kunde (optional)', 'kunde']],
    pdf(o) { const k = K.get(o.kunde), ctx = PDF.create('form', { title: 'Gesprächsnotiz', footer: 'Gesprächsnotiz' });
      VL.head(ctx, 'Gesprächs- / Telefonnotiz');
      PDF.table(ctx, null, [['Datum / Uhrzeit', '', 'Art', ''], ['Gesprächspartner', k ? [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ') : '', 'Firma', k ? K.name(k) : ''], ['Telefon / E-Mail', k ? [k.tel, k.mail].filter(Boolean).join(' / ') : '', 'Anlass', '']]
        .map(r => r.map((c, i) => i % 2 ? c : { content: c, styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } })), { zebra: false, minH: 9, at: { columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 20 } }, didDrawCell: d => {
          if (d.section !== 'body' || d.row.index !== 0 || d.column.index !== 3) return; let x = d.cell.x + 2; const y = d.cell.y + d.cell.height / 2;
          ['Telefon', 'persönlich', 'online'].forEach(t => { VL.box(ctx.doc, x, y - 1.7); PDF.font(ctx.doc, 9.5); ctx.doc.text(t, x + 5, y + 1.2); x += 9 + ctx.doc.getTextWidth(t); }); } } });
      ['Inhalt des Gesprächs', 'Vereinbarungen / nächste Schritte'].forEach((t, j) => { PDF.h(ctx, t, { size: 11.5, line: false }); PDF.table(ctx, null, VL.lines(j ? 6 : 12, ['']), { minH: 7.5, zebra: false }); });
      PDF.table(ctx, null, [[{ content: 'Wiedervorlage am', styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, '', { content: 'Erledigt', styles: { fontStyle: 'bold', fillColor: [228, 228, 214] } }, '']], { zebra: false, minH: 9, at: { didDrawCell: d => { if (d.section === 'body' && d.column.index === 3) VL.box(ctx.doc, d.cell.x + 3, d.cell.y + d.cell.height / 2 - 1.7); } } });
      return PDF.finish(ctx); } },
  { id: 'todo', titel: 'To-do-Liste', ic: '☑', desc: 'Aufgabenliste mit Priorität, Termin und Erledigt-Feld.',
    felder: [['titel', 'Überschrift', 'text', 'To-do-Liste'], ['zeilen', 'Anzahl Zeilen', 'number', 22]],
    pdf(o) { const ctx = PDF.create('form', { title: o.titel || 'To-do-Liste', footer: 'To-do-Liste' });
      VL.head(ctx, o.titel || 'To-do-Liste', `Stand: ${U.de(U.today())}`);
      PDF.table(ctx, ['', 'Aufgabe', 'Prio', 'Termin', 'Erledigt am'], Array.from({ length: o.zeilen || 22 }, () => ['', '', '', '', '']), { minH: 9, zebra: false,
        at: { columnStyles: { 0: { cellWidth: 9 }, 2: { cellWidth: 16 }, 3: { cellWidth: 26 }, 4: { cellWidth: 26 } }, didDrawCell: d => { if (d.section === 'body' && d.column.index === 0) VL.box(ctx.doc, d.cell.x + 2.8, d.cell.y + d.cell.height / 2 - 1.7); } } });
      return PDF.finish(ctx); } },
  { id: 'notiz', titel: 'Notizblatt (kariert)', ic: '▦', mehrseitig: true, desc: '5-mm-Karo mit CD-Kopf – auch als Vorlage für Freenote geeignet.',
    felder: [['titel', 'Überschrift (optional)', 'text'], ['seiten', 'Anzahl Seiten', 'number', 1]],
    pdf(o) { const ctx = PDF.create('form', { title: 'Notizblatt', footer: 'Notizen' }), { doc, W, H } = ctx;
      for (let s = 1; s <= (o.seiten || 1); s++) { if (s > 1) doc.addPage();
        const top = s === 1 ? (o.titel ? 46 : 38) : 16; if (s === 1 && o.titel) { PDF.font(doc, 15, 'bold'); doc.text(PDF.clean(o.titel), 15, 42); }
        doc.setDrawColor(205, 206, 186); doc.setLineWidth(0.12);
        for (let x = 15; x <= W - 15 + 0.01; x += 5) doc.line(x, top, x, H - 16);
        for (let y = top; y <= H - 16 + 0.01; y += 5) doc.line(15, y, W - 15, y); }
      return PDF.finish(ctx); } },
];

/* erzeugt das PDF einer Vorlage – auf eine Seite eingepasst (Briefbogen und Notizblatt haben bewusst die gewählte Seitenzahl) */
VL.build = (t, o) => (t.mehrseitig ? t.pdf(o) : PDF.fit(() => t.pdf(o)));

AC.views.vorlagen = async (v) => {
  await K.load();
  AC.head('Vorlagen drucken', 'Ausfüllen, ansehen, drucken – auf Wunsch im Ordner „vorlagen“ ablegen');
  v.innerHTML = `<div class="grid g3">${AC.VORL.map(t => `<div class="card" style="margin:0;display:flex;flex-direction:column"><h2><span style="font-size:22px">${t.ic}</span>${U.esc(t.titel)}</h2>
    <p class="small muted" style="flex:1">${U.esc(t.desc)}</p><div class="row"><button class="btn" data-v="${t.id}">Ausfüllen und drucken …</button></div></div>`).join('')}</div>
    <div class="card" style="margin-top:18px"><h2>Bereits abgelegt</h2><div id="vlList" class="small muted">Lade …</div></div>`;
  v.querySelectorAll('[data-v]').forEach(b => b.onclick = () => AC.vorlageDialog(AC.VORL.find(t => t.id === b.dataset.v)));
  const files = (await FS.list('vorlagen', '.pdf')).reverse();
  v.querySelector('#vlList').innerHTML = files.length ? files.slice(0, 40).map(f => `<div><a href="#" data-f="${U.esc(f)}">${U.esc(f)}</a></div>`).join('') : 'Noch keine abgelegten Vorlagen.';
  v.querySelectorAll('[data-f]').forEach(a => a.onclick = e => { e.preventDefault(); FS.open('vorlagen/' + a.dataset.f); });
};

AC.vorlageDialog = (t) => {
  const o = {}; t.felder.forEach(([k, , typ, def]) => { o[k] = def ?? (typ === 'date' ? U.today() : ''); });
  const d = document.getElementById('dlg'); d.className = 'small'; d.style.width = 'min(640px,94vw)';
  d.innerHTML = `<div class="dh"><h2>${U.esc(t.titel)}</h2></div><div class="db"><div class="grid g2">${t.felder.map(([k, l, typ]) => {
    if (typ === 'kunde') return `<label class="f" style="grid-column:span 2"><span>${U.esc(l)}</span><select data-k="${k}">${K.options('', true).replace('– Kunde wählen –', '– ohne –')}</select></label>`;
    if (typ === 'area') return `<label class="f" style="grid-column:span 2"><span>${U.esc(l)}</span><textarea data-k="${k}" rows="6"></textarea></label>`;
    if (typ === 'check') return `<label class="row small" style="align-self:end"><input type="checkbox" data-k="${k}"${o[k] ? ' checked' : ''}> ${U.esc(l)}</label>`;
    return `<label class="f"${typ === 'text' ? ' style="grid-column:span 2"' : ''}><span>${U.esc(l)}</span><input data-k="${k}" type="${typ}" value="${U.esc(o[k])}"></label>`; }).join('')}</div></div>
    <div class="df"><button class="btn light" data-a="x">Abbrechen</button><button class="btn light" data-a="prev">Vorschau</button><button class="btn light" data-a="print">Drucken</button><button class="btn" data-a="save">Ablegen und drucken</button></div>`;
  d.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value; }));
  d.querySelector('select[data-k]')?.dispatchEvent(new Event('input'));
  d.showModal();
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a; d.style.width = ''; if (a === 'x') return d.close();
    const doc = VL.build(t, o); d.close();
    if (a === 'prev') { await AC.preview(doc, t.titel, async () => save(doc)); return; }
    if (a === 'save') await save(doc);
    AC.print(doc);
  });
  const save = async (doc) => { const f = PDF.fileName(t.titel, o.kunde ? K.name(K.get(o.kunde)) : '', o.lehrgang || o.thema || o.betreff || '', U.today());
    await FS.write('vorlagen/' + f, doc.output('blob')); AC.toast('Abgelegt: vorlagen/' + f); if (AC.current === 'vorlagen') AC.go('vorlagen'); };
};
