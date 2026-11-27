/* =====================================================================
   AC Office – Lehrgänge (lehrgaenge.js)
   Daten:   lehrgaenge/LG-2026-001.json
   PDFs:    lehrgaenge/LG-2026-001/ (Listen, Teilnahmebescheinigungen)
   Teilnehmerdaten sind personenbezogen: nach Abschluss Kontakt- und
   Geburtsdaten löschen, sobald sie nicht mehr gebraucht werden (Art. 5 DSGVO).
   ===================================================================== */
'use strict';
const LG = AC.LG = {
  ARTEN: ['Lehrgang', 'Prüfungsvorbereitung § 34a GewO', 'Inhouse-Schulung', 'Unterweisung', 'Seminar / Workshop'],
  STATUS: ['geplant', 'läuft', 'abgeschlossen', 'abgesagt'],
  async loadAll() { const l = await FS.readAll('lehrgaenge'); l.forEach(x => LG.migrate(x)); return l.sort((a, b) => (b.von || '').localeCompare(a.von || '')); },
  async get(id) { const x = await FS.readJSON(`lehrgaenge/${id}.json`); if (x) LG.migrate(x); return x; },
  blank: () => ({ id: '', titel: '', art: 'Lehrgang', kundeId: '', ort: '', von: U.today(), bis: U.today(), nurWerktage: true, zusatzTage: [], form: 'Präsenz', adresse: '', raum: '', teams: '', anlagen: [], zeiten: '08:00 – 15:30 Uhr', ue: 8, uePerTag: 8, endeAuto: false, ueVorgabe: '',
    inhalte: '', status: 'geplant', maxTN: '', teilnehmer: [], unterlagen: [], notiz: '', rechnungNr: '' }),
  WD: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  FORM: ['Präsenz', 'Online (Microsoft Teams)', 'Hybrid (Präsenz + Teams)'],
  online: lg => /^Online/.test(lg.form || ''), hybrid: lg => /^Hybrid/.test(lg.form || ''),
  /* Ort für Listen, Bescheinigungen und Rechnungen */
  ortText(lg) { const vor = lg.ort || lg.adresse || ''; return LG.online(lg) ? 'Online (Microsoft Teams)' : LG.hybrid(lg) ? [vor, 'online über Microsoft Teams'].filter(Boolean).join(' und ') : vor; },
  /* Standort für Kalender: „Adresse, PLZ/Ort“ */
  standort: lg => [lg.adresse, lg.ort].map(x => String(x || '').trim()).filter(Boolean).join(', '),
  /* ältere Einträge: „Straße, PLZ Ort“ stand komplett im Feld Adresse → aufteilen */
  migrate(lg) { const m = String(lg.adresse || '').match(/^(.+?),\s*(\d{5}\s+.+)$/); if (m && (!lg.ort || m[2].includes(lg.ort) || lg.ort.includes(m[2]))) { lg.adresse = m[1].trim(); lg.ort = m[2].trim(); return true; } return false; },
  ANLAGEN: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  navi: adr => adr ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}` : '',
  /* Teams-Planungsdialog mit Titel, Zeit und Inhalt vorbelegen (Microsoft Teams Deep Link) */
  teamsNeu(lg) { const z = AC.ICS.zeiten(lg.zeiten) || ['09:00', '10:00'], d = LG.tage(lg)[0] || lg.von, off = (dt) => { const m = -new Date(dt).getTimezoneOffset(); return (m >= 0 ? '+' : '-') + U.pad(Math.floor(Math.abs(m) / 60), 2) + ':' + U.pad(Math.abs(m) % 60, 2); };
    const st = `${d}T${z[0]}:00`, en = `${d}T${z[1]}:00`;
    return `https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent('Lehrgang: ' + lg.titel)}&startTime=${encodeURIComponent(st + off(st))}&endTime=${encodeURIComponent(en + off(en))}&content=${encodeURIComponent(`${lg.art} · ${LG.zeitraum(lg)} · ${lg.zeiten}`)}`; },
  /* alle Kalendertage im Zeitraum (max. 120) */
  alleTage(lg) { const out = []; if (!lg.von) return out; let d = lg.von; const end = lg.bis && lg.bis >= lg.von ? lg.bis : lg.von;
    while (d <= end && out.length < 120) { out.push(d); d = U.addDays(d, 1); } return out; },
  /* Wochentag, Wochenende, Feiertag NRW */
  info(d) { const wd = new Date(d + 'T12:00:00').getDay(), ft = AC.FT.name(d); return { wd, kurz: LG.WD[wd], we: wd === 0 || wd === 6, ft, frei: wd === 0 || wd === 6 || !!ft }; },
  /* zählt der Tag als Lehrgangstag? Freie Tage nur, wenn ausdrücklich ausgewählt */
  zaehlt(lg, d) { return !lg.nurWerktage || !LG.info(d).frei || (lg.zusatzTage || []).includes(d); },
  tage(lg) { return LG.alleTage(lg).filter(d => LG.zaehlt(lg, d)); },
  freiText(d) { const i = LG.info(d); return i.ft ? `Feiertag: ${i.ft}` : (i.wd === 6 ? 'Samstag' : 'Sonntag'); },
  zeitraum: lg => lg.bis && lg.bis !== lg.von ? `${U.de(lg.von)} – ${U.de(lg.bis)}` : U.de(lg.von),
  quote(lg, t) { const tage = LG.tage(lg); if (!tage.length) return null; const n = tage.filter(d => t.anwesend && t.anwesend[d]).length; return { n, von: tage.length }; },
  async save(lg) { if (!lg.id) lg.id = await AC.nextNr('lehrgang', 'LG', 3, 'lehrgaenge'); const d = Object.assign({}, lg); delete d._file; await FS.writeJSON(`lehrgaenge/${lg.id}.json`, d); },
  /* Kontakt- und Geburtsdaten löschen (Datenminimierung) */
  anonym(lg) { lg.teilnehmer.forEach(t => { t.geburtsdatum = ''; t.kontakt = ''; }); lg.datenGeloescht = U.today(); },
  /* Teilnehmer aus Excel/Tabelle einfügen: Name; Vorname; Geburtsdatum; Kontakt; Firma */
  parse(text) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const c = l.split(/\t|;/).map(x => x.trim());
      const g = (c[2] || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      return { name: c[0] || '', vorname: c[1] || '', geburtsdatum: g ? `${g[3]}-${U.pad(g[2], 2)}-${U.pad(g[1], 2)}` : (c[2] || ''), kontakt: c[3] || '', firma: c[4] || '', bescheinigung: true, anwesend: {} };
    }).filter(t => t.name && !/^name$/i.test(t.name));
  },

  /* ---------- PDFs ---------- */
  liste(lg) { return PDF.fit(() => {
    const ctx = PDF.create('form', { landscape: true, title: 'Teilnehmerliste ' + lg.titel, footer: 'Teilnehmerliste · personenbezogene Daten – vertraulich behandeln' });
    VL.head(ctx, 'Teilnehmerliste'); VL.infoRow(ctx, [['Lehrgang', lg.titel], ['Auftraggeber', lg.kundeId ? K.name(K.get(lg.kundeId)) : ''], ['Zeitraum', LG.zeitraum(lg)], ['Ort', LG.ortText(lg)]]);
    const rows = lg.teilnehmer.map((t, i) => [String(i + 1), t.name, t.vorname, U.de(t.geburtsdatum) || t.geburtsdatum || '', t.kontakt, lg.titel]);
    for (let i = rows.length; i < Math.max(rows.length, 10); i++) rows.push([String(i + 1), '', '', '', '', lg.titel]);
    PDF.table(ctx, ['Nr.', 'Name', 'Vorname', 'Geburtsdatum', 'Kontakt (E-Mail / Tel.)', 'Lehrgangsbezeichnung'], rows, { minH: 8, size: 10, zebra: false, at: { columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 30 }, 4: { cellWidth: 70 } } } });
    return PDF.finish(ctx); }); },
  /* Anwesenheitsliste: je Blatt bis zu 10 Lehrgangstage; freie Tage (als Lehrgangstag gewählt) farbig */
  anwesenheit(lg) {
    const alle = LG.tage(lg), blocks = []; for (let i = 0; i < Math.max(alle.length, 1); i += 10) blocks.push(alle.slice(i, i + 10));
    return PDF.fit(() => {
      const ctx = PDF.create('form', { landscape: true, title: 'Anwesenheitsliste ' + lg.titel, footer: 'Anwesenheitsliste' });
      blocks.forEach((ds, bi) => {
        if (bi) { PDF.addPage(ctx); ctx.y = 40; }
        VL.head(ctx, blocks.length > 1 ? `Anwesenheitsliste – Blatt ${bi + 1} von ${blocks.length}` : 'Anwesenheitsliste');
        VL.infoRow(ctx, [['Lehrgang', lg.titel], ['Zeitraum', LG.zeitraum(lg)], ['Zeiten', lg.zeiten], ['Dozent', AC.settings.absender.name]]);
        const rows = lg.teilnehmer.map((t, i) => [String(i + 1), t.name, t.vorname, ...ds.map(() => ''), '']);
        for (let i = rows.length; i < Math.max(rows.length, 8); i++) rows.push([String(i + 1), '', '', ...ds.map(() => ''), '']);
        const inf = ds.map(d => LG.info(d));
        PDF.table(ctx, ['Nr.', 'Name', 'Vorname', ...ds.map((d, j) => `${inf[j].kurz} ${U.de(d).slice(0, 6)}${inf[j].ft ? '\n' + inf[j].ft : ''}`), 'Bemerkung'], rows,
          { minH: 8.6, size: 9.5, zebra: false, at: { columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 1: { cellWidth: 36 }, 2: { cellWidth: 30 } },
            didParseCell: c => { const j = c.column.index - 3; if (j < 0 || j >= ds.length || !inf[j].frei) return;
              if (c.section === 'head') c.cell.styles.fillColor = inf[j].ft ? [155, 74, 62] : [142, 143, 112]; else c.cell.styles.fillColor = inf[j].ft ? [246, 226, 221] : [235, 235, 223]; } } });
        const fr = inf.filter(i => i.frei).length;
        if (fr) PDF.text(ctx, 'Farbig markiert: Wochenende bzw. Feiertag NRW, als Lehrgangstag festgelegt.', { size: 8, color: PDF.C.grau, after: 0 });
        PDF.sign(ctx, ['Datum, Unterschrift Dozent'], 9);
      });
      return PDF.finish(ctx); }); },
  /* Teilnahmebescheinigung – eine Seite je Teilnehmer */
  cert(ctx, lg, t, idx) {
    const { doc, W } = ctx, S = PDF.S, C = PDF.C, a = AC.settings.absender, mid = W / 2;
    // Wappen als Wasserzeichen
    doc.setGState(new doc.GState({ opacity: 0.06 })); const ww = 120, wh = ww * ACA.size.wappen[1] / ACA.size.wappen[0];
    doc.addImage(ACA.img.wappen, 'PNG', mid - ww / 2, 95, ww, wh, 'wappenWM', 'FAST'); doc.setGState(new doc.GState({ opacity: 1 }));
    ctx.y = 52;
    PDF.font(doc, 27, 'bold', C.black); doc.text('TEILNAHMEBESCHEINIGUNG', mid, ctx.y, { align: 'center', charSpace: 0.6 }); ctx.y += 5 * S;
    doc.setDrawColor(...C.olive); doc.setLineWidth(1); doc.line(mid - 25, ctx.y, mid + 25, ctx.y); ctx.y += 13 * S;
    PDF.font(doc, 12, 'normal', C.grau); doc.text('Hiermit wird bestätigt, dass', mid, ctx.y, { align: 'center' }); ctx.y += 11 * S;
    PDF.font(doc, 22, 'bold', C.black); doc.text(PDF.clean(`${t.vorname} ${t.name}`.trim()), mid, ctx.y, { align: 'center' }); ctx.y += 7 * S;
    if (t.geburtsdatum && /^\d{4}-/.test(t.geburtsdatum)) { PDF.font(doc, 11, 'normal', C.grau); doc.text(`geboren am ${U.de(t.geburtsdatum)}`, mid, ctx.y, { align: 'center' }); ctx.y += 6 * S; }
    ctx.y += 4 * S; PDF.font(doc, 12, 'normal', C.grau); doc.text('an folgender Maßnahme teilgenommen hat:', mid, ctx.y, { align: 'center' }); ctx.y += 11 * S;
    PDF.font(doc, 17, 'bold', C.olive); doc.splitTextToSize(PDF.clean(lg.titel || ''), ctx.w - 20).forEach(l => { doc.text(l, mid, ctx.y, { align: 'center' }); ctx.y += 7.5 * S; });
    ctx.y += 5 * S;
    const q = LG.quote(lg, t), rows = [['Art der Maßnahme', lg.art], ['Zeitraum', LG.zeitraum(lg)], ['Ort', LG.ortText(lg)], ['Umfang', lg.ue ? `${U.nf(U.num(lg.ue))} Unterrichtseinheiten à 45 Minuten` : '']];
    if (lg.kundeId) rows.push(['Auftraggeber', K.name(K.get(lg.kundeId))]);
    if (q && Object.keys(t.anwesend || {}).length) rows.push(['Anwesenheit', `${q.n} von ${q.von} Lehrgangstagen`]);
    rows.push(['Dozent', `${a.name}, ${a.quali}`]);
    PDF.table(ctx, null, rows.filter(r => r[1]), { zebra: false, left: ctx.left + 15, right: ctx.right + 15, size: 10.5, at: { columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', fillColor: [228, 228, 214] } } } });
    const inh = (lg.inhalte || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (inh.length) { ctx.y += 2 * S; PDF.font(doc, 11, 'bold'); doc.text('Inhalte', ctx.left + 15, ctx.y); ctx.y += 2 * S;
      const half = Math.ceil(inh.length / 2), cols = inh.length > 6 ? [inh.slice(0, half), inh.slice(half)] : [inh], cw = (ctx.w - 30) / cols.length;
      const y0 = ctx.y; let yMax = y0;
      cols.forEach((col, c) => { ctx.y = y0; col.forEach(x => PDF.text(ctx, '•  ' + x, { x: ctx.left + 15 + c * cw, w: cw - 4, size: 10, after: 0 })); yMax = Math.max(yMax, ctx.y); });
      ctx.y = yMax + 3 * S; }
    // Unterschrift
    const ou = PDF.ou('für Teilnahmebescheinigungen keine Form vorgeschrieben ist', 'bescheinigung');
    const y = Math.max(ctx.y + 22 * S, 238); doc.setDrawColor(...C.black); doc.setLineWidth(0.3);
    doc.line(ctx.left + 15, y, ctx.left + 80, y); if (!ou) doc.line(W - ctx.right - 80, y, W - ctx.right - 15, y);
    PDF.font(doc, 9, 'normal', C.grau); doc.text(`${a.ort}, ${U.de(lg.bis || lg.von)}`, ctx.left + 15, y - 2);
    doc.text('Ort, Datum', ctx.left + 15, y + 4);
    if (ou) { PDF.font(doc, 10, 'bold', C.black); doc.text(PDF.clean(a.name), W - ctx.right - 15, y - 2, { align: 'right' }); PDF.font(doc, 9, 'normal', C.grau); doc.text(PDF.clean(a.titel), W - ctx.right - 15, y + 4, { align: 'right' }); }
    else doc.text([`${a.name}`, a.titel], W - ctx.right - 15, y + 4, { align: 'right' });
    PDF.font(doc, 7.5, 'normal', C.grau); doc.text(`Bescheinigungs-Nr. ${lg.id || 'LG'}-${U.pad(idx + 1, 2)} · Diese Bescheinigung bestätigt die Teilnahme; sie ersetzt keinen amtlichen Prüfungsnachweis.`, ctx.left + 15, y + 15);
    if (ou) doc.text(PDF.clean(PDF.ouText(ou)), ctx.left + 15, y + 19);
    ctx.y = y + (ou ? 22 : 18);
  },
  bescheinigungen(lg, liste) {
    const tn = liste || lg.teilnehmer.filter(t => t.bescheinigung !== false);
    let scale = 1; // Skalierung so wählen, dass die umfangreichste Bescheinigung auf eine Seite passt
    for (const s of [1, 0.92, 0.85, 0.78, 0.7]) { PDF.S = s; const c = PDF.create('report', { title: 'x' }); LG.cert(c, lg, tn[0] || {}, 0); const ok = c.doc.getNumberOfPages() === 1 && c.y < c.H - 16; PDF.S = 1; if (ok) { scale = s; break; } scale = s; }
    PDF.S = scale;
    try { const ctx = PDF.create('report', { title: 'Teilnahmebescheinigungen ' + lg.titel, footer: 'Teilnahmebescheinigung' }); ctx.allFirst = true;
      tn.forEach((t, i) => { if (i) ctx.doc.addPage(); LG.cert(ctx, lg, t, lg.teilnehmer.indexOf(t)); }); return PDF.finish(ctx); } finally { PDF.S = 1; }
  },
  /* Lehrgang endgültig löschen: Datei + Ordner (Listen, Bescheinigungen, Anlagen), auf Wunsch auch aus Outlook */
  async loeschen(lg) {
    await K.load(); const direkt = await AC.OL.nutzen(), inOutlook = lg.outlook && !lg.outlookGeloescht;
    const r = await AC.dialog('Lehrgang löschen?', `<p><b>${U.esc(lg.id)} · ${U.esc(lg.titel)}</b><br><span class="small muted">${LG.zeitraum(lg)} · ${lg.teilnehmer.length} Teilnehmende</span></p>
      <p class="small">Gelöscht werden die Lehrgangsdatei und der Ordner <b>lehrgaenge\\${U.esc(lg.id)}</b> mit Listen, Bescheinigungen und Anlagen. Das lässt sich nicht rückgängig machen.</p>
      ${inOutlook && AC.mobil ? '<p class="hint small">Der Outlook-Termin bleibt bestehen. Damit er mit entfernt wird, den Lehrgang am Laptop löschen – oder hier auf „abgesagt“ setzen und am Laptop abgleichen.</p>' : ''}
      ${inOutlook && !AC.mobil ? `<label class="row small" style="gap:8px"><input type="checkbox" id="lgDelOl" checked> auch aus dem Outlook-Kalender ${direkt ? 'löschen' : 'entfernen (ohne Kalenderdienst: als „ABGESAGT“ markieren)'}</label>` : ''}
      ${lg.rechnungNr ? `<p class="hint small">Die Rechnung ${U.esc(lg.rechnungNr)} bleibt erhalten (Aufbewahrungspflicht, § 147 AO).</p>` : ''}`,
      [['Abbrechen', null, 'light'], ['Endgültig löschen', 'ok', 'red']], 'small');
    if (r !== 'ok') return false;
    const ol = inOutlook && document.getElementById('lgDelOl') && document.getElementById('lgDelOl').checked;
    if (ol) { const e = AC.ICS.lehrgang(lg) || AC.ICS.lgStub(lg); const ok = await AC.ICS.senden(e, true);
      if (!ok && !await AC.confirm('Outlook nicht erreicht', 'Der Termin konnte nicht aus Outlook entfernt werden. Lehrgang trotzdem löschen?', 'Trotzdem löschen')) return false; }
    await FS.remove(`lehrgaenge/${lg.id}.json`); await FS.removeDir(`lehrgaenge/${lg.id}`);
    AC.toast(`Lehrgang ${lg.id} gelöscht`); return true;
  },
  /* Handy: Anwesenheit tageweise abhaken (große Tippflächen) */
  tagesListe(lg, all) {
    const heute = U.today(), ds = LG.tage(lg);
    const tag = LG._tag && all.includes(LG._tag) ? LG._tag : all.includes(heute) ? heute : (ds.find(d => d >= heute) || ds[ds.length - 1] || all[0]);
    LG._tag = tag; const zaehlt = LG.zaehlt(lg, tag), n = lg.teilnehmer.filter(t => t.anwesend && t.anwesend[tag]).length;
    return `<div class="mob-day"><label class="f"><span>Tag abhaken</span><select id="aTag">${all.map(d => { const i = LG.info(d);
      return `<option value="${d}"${d === tag ? ' selected' : ''}>${i.kurz} ${U.de(d)}${i.frei ? ' – ' + (LG.zaehlt(lg, d) ? 'Lehrgangstag (' + LG.freiText(d) + ')' : 'frei (' + LG.freiText(d) + ')') : ''}${d === heute ? ' · heute' : ''}</option>`; }).join('')}</select></label>
      ${zaehlt ? '' : `<p class="hint small" style="margin:8px 0 0">${U.esc(LG.freiText(tag))} – freier Tag. Wer hier abgehakt wird, macht den Tag automatisch zum Lehrgangstag.</p>`}
      <div class="mob-list">${lg.teilnehmer.map((t, i) => `<label class="mob-tn"><input type="checkbox" data-att="${i}|${tag}"${t.anwesend && t.anwesend[tag] ? ' checked' : ''}><span><b>${U.esc(t.name)}</b>, ${U.esc(t.vorname)}${t.firma ? `<br><span class="small muted">${U.esc(t.firma)}</span>` : ''}</span></label>`).join('')}</div>
      <div class="row"><span class="small muted">${n} von ${lg.teilnehmer.length} anwesend</span>${zaehlt ? `<button class="btn light sm right" data-allday="${tag}">✓ alle anwesend</button>` : ''}</div>
      <p class="small muted" style="margin:6px 0 0">${AC.mobil ? 'Häkchen werden automatisch gespeichert.' : 'Speichern nicht vergessen (oben „Speichern“).'}</p></div>`;
  },
  async ablegen(lg, name, doc) { const f = `lehrgaenge/${lg.id}/${name}`; await FS.write(f, doc.output('blob')); AC.toast('Abgelegt: ' + f); return f; },
};

/* ---------- Liste ---------- */
AC.views.lehrgaenge = async (v) => {
  await K.load(); const all = await LG.loadAll();
  AC.head('Lehrgänge', 'Lehrgänge, Schulungen und Unterweisungen · Ablage: Ordner „lehrgaenge“', `<button class="btn ghost" id="lSync" title="geplant/läuft → eintragen bzw. aktualisieren · abgesagt → löschen · abgeschlossen → bleibt">🔄 Mit Outlook abgleichen</button><button class="btn ghost" id="lNeu">+ Neuer Lehrgang</button>`);
  document.getElementById('lNeu').onclick = () => AC.go('lehrgang');
  document.getElementById('lSync').onclick = async () => { if (await AC.ICS.abgleich()) AC.go('lehrgaenge'); };
  AC.OL.chip().then(h => { const b = document.getElementById('lSync'); if (b) b.insertAdjacentHTML('beforebegin', h); });
  const kommend = all.filter(l => l.status === 'geplant' && l.von >= U.today());
  v.innerHTML = `<div class="grid g3" style="margin-bottom:18px">
      <div class="kpi"><b>${kommend.length}</b><span>geplante Termine</span></div>
      <div class="kpi"><b>${all.filter(l => l.status === 'abgeschlossen').reduce((s, l) => s + l.teilnehmer.length, 0)}</b><span>Teilnehmende in abgeschlossenen Lehrgängen</span></div>
      <div class="kpi ${all.some(l => l.status === 'abgeschlossen' && !l.rechnungNr && l.kundeId) ? 'warn' : ''}"><b>${all.filter(l => l.status === 'abgeschlossen' && !l.rechnungNr && l.kundeId).length}</b><span>abgeschlossen, noch nicht abgerechnet</span></div></div>
    ${all.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Zeitraum</th><th>Titel</th><th>Art</th><th>Auftraggeber</th><th>Ort</th><th class="num">TN</th><th>Status</th><th></th></tr></thead><tbody>
    ${all.map(l => `<tr class="click" data-l="${l.id}"><td><b>${l.id}</b></td><td>${LG.zeitraum(l)}</td><td>${U.esc(l.titel)}</td><td>${U.esc(l.art)}</td><td>${U.esc(l.kundeId ? K.name(K.get(l.kundeId)) : '–')}</td><td>${U.esc(LG.ortText(l))}</td>
      <td class="num">${l.teilnehmer.length}${l.maxTN ? ' / ' + l.maxTN : ''}</td><td><span class="badge ${l.status === 'abgeschlossen' ? 'bezahlt' : l.status === 'abgesagt' ? 'storniert' : 'offen'}">${U.esc(l.status)}</span>${l.rechnungNr ? ' · ' + l.rechnungNr : ''}</td><td class="num"><button class="x" data-ldel="${l.id}" title="Lehrgang löschen">🗑</button></td></tr>`).join('')}</tbody></table></div>`
    : '<div class="card empty">Noch keine Lehrgänge. Mit „+ Neuer Lehrgang“ planst du den ersten – Teilnehmer, Anwesenheit, Listen und Bescheinigungen laufen dann hier zusammen.</div>'}`;
  v.querySelectorAll('[data-l]').forEach(t => t.onclick = () => AC.go('lehrgang', t.dataset.l));
  v.querySelectorAll('[data-ldel]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const lg = all.find(l => l.id === b.dataset.ldel); if (lg && await LG.loeschen(lg)) AC.go('lehrgaenge'); });
};

/* ---------- Lehrgang bearbeiten ---------- */
AC.views.lehrgang = async (v, id, startTab = 0, init = null) => {
  await K.load(); const ul = await AC.UL.load();
  const lg = id ? await LG.get(id) : Object.assign(LG.blank(), init || {}); if (!id && init && AC.LD) AC.LD.anwenden(lg); if (!lg) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const direkt = await AC.OL.nutzen();
  const F = AC.F; let tab = startTab, dirty = false;
  const TABS = ['Grunddaten', 'Teilnehmer', 'Anwesenheit', 'Unterlagen', 'Dokumente & Abrechnung'];
  const head = () => AC.head(lg.id ? `${lg.id} · ${lg.titel || 'Lehrgang'}` : 'Neuer Lehrgang', lg.id ? [LG.zeitraum(lg), LG.ortText(lg), lg.teilnehmer.length + ' Teilnehmende'].filter(Boolean).join(' · ') : 'Grunddaten ausfüllen und speichern',
    `<button class="btn ghost" id="gBack">← Liste</button>${lg.id ? '<button class="btn ghost" id="gDel" title="Lehrgang löschen">🗑 Löschen</button>' : ''}${lg.id ? (lg.status === 'abgesagt' ? (AC.ICS.absageOffen(lg, direkt) ? `<button class="btn ghost" id="gCal" title="Terminserie in Outlook ${direkt ? 'löschen' : 'als ABGESAGT markieren'}">📅 ${direkt ? 'Aus Outlook löschen' : 'In Outlook als abgesagt markieren'}</button>` : '') : `<button class="btn ghost" id="gCal" title="Alle Lehrgangstage als Terminserie in Outlook">📅 ${lg.outlook ? 'Outlook aktualisieren' : 'In Outlook'}</button>`) : ''}<button class="btn light" id="gSave">Speichern</button>`);
  const save = async (msg) => { if (!lg.titel) { AC.toast('Bitte einen Titel angeben', true); return false; } await LG.save(lg); dirty = false; head(); bindHead(); if (msg) AC.toast(`Gespeichert: lehrgaenge/${lg.id}.json`); return true; };
  const bindHead = () => { document.getElementById('gBack').onclick = async () => { if (dirty && await AC.confirm('Änderungen speichern?', 'Es gibt ungespeicherte Änderungen.', 'Speichern', '')) await save(); AC.go('lehrgaenge'); };
    document.getElementById('gSave').onclick = () => save(true);
    const gd = document.getElementById('gDel'); if (gd) gd.onclick = async () => { if (await LG.loeschen(lg)) { dirty = false; AC.go('lehrgaenge'); } };
    const gc = document.getElementById('gCal'); if (gc) gc.onclick = async () => { const e = AC.ICS.lehrgang(lg) || AC.ICS.lgStub(lg); const ab = lg.status === 'abgesagt';
      if (!ab && !AC.LG.tage(lg).length) return AC.toast('Keine Lehrgangstage im Zeitraum', true);
      if (!await save()) return; if (await AC.ICS.senden(e, ab)) { AC.ICS.markiere(lg, e, ab, direkt); await save(); } }; };
  const body = () => {
    if (tab === 0) return `<div class="card"><h2>Grunddaten</h2><div class="grid g4">
      ${F.input('Titel des Lehrgangs *', 'titel', lg.titel, { span: 2, ph: 'z. B. Vorbereitung Sachkundeprüfung § 34a GewO' })}${F.select('Art', 'art', lg.art, LG.ARTEN)}${F.select('Status', 'status', lg.status, LG.STATUS)}
      <label class="f" style="grid-column:span 2"><span>Auftraggeber (optional)</span><select data-p="kundeId">${K.options(lg.kundeId).replace('– Kunde wählen –', '– ohne / offener Lehrgang –')}</select></label>
      ${F.select('Durchführung', 'form', lg.form || 'Präsenz', LG.FORM)}${LG.online(lg) ? '<span></span>' : F.input('Raum (optional)', 'raum', lg.raum || '', { ph: 'z. B. Schulungsraum 1' })}
      ${LG.online(lg) ? '' : `${F.input('Adresse', 'adresse', lg.adresse || '', { ph: 'Straße und Hausnummer' })}${F.input('PLZ/Ort', 'ort', lg.ort || '', { ph: 'z. B. 47495 Rheinberg' })}
      <div class="f" style="grid-column:span 2;align-self:end;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm light" id="gAdrK" title="Adresse des Auftraggebers übernehmen">Adresse Auftraggeber</button><button class="btn sm light" id="gAdrE" title="Deine Geschäftsadresse übernehmen">eigene Adresse</button>
        <a class="btn sm" id="gNavi" target="_blank" rel="noopener" href="${U.esc(LG.navi(LG.standort(lg)))}"${LG.standort(lg) ? '' : ' style="display:none"'}>🧭 Navigation</a></div>
      <p class="small muted" style="grid-column:span 4;margin:-4px 0 0">Standort im Kalender: <b id="gStand">${U.esc(LG.standort(lg)) || '–'}</b></p>`}
      ${LG.online(lg) || LG.hybrid(lg) ? `${F.input('Teams-Link (Besprechungslink zum Beitreten)', 'teams', lg.teams || '', { span: 3, ph: 'https://teams.microsoft.com/l/meetup-join/…' })}
      <div class="f" style="align-self:end;display:flex;gap:6px;flex-wrap:wrap"><a class="btn sm light" target="_blank" rel="noopener" href="${U.esc(LG.teamsNeu(lg))}" title="Öffnet in Teams den Dialog „Neue Besprechung“ mit Titel und Zeit">Teams-Besprechung anlegen</a>
        <a class="btn sm" id="gTeams" target="_blank" rel="noopener" href="${U.esc(lg.teams || '')}"${lg.teams ? '' : ' style="display:none"'}>▶ Beitreten</a></div>
      <p class="small muted" style="grid-column:span 4;margin:0">Ablauf: „Teams-Besprechung anlegen“ → in Teams speichern → Besprechungslink kopieren und hier einfügen. Der Link kommt automatisch in den Outlook-Termin.</p>` : ''}
      ${F.input('Beginn', 'von', lg.von, { type: 'date' })}${F.input('Ende', 'bis', lg.bis, { type: 'date' })}${F.input('Unterrichtszeiten', 'zeiten', lg.zeiten)}${F.input('Unterrichtseinheiten (à 45 Min.)', 'ue', lg.ue, { type: 'number' })}
      ${F.input('max. Teilnehmende', 'maxTN', lg.maxTN, { type: 'number' })}<div class="checks" style="grid-template-columns:1fr;align-self:end">${F.check('Wochenenden & Feiertage (NRW) sind frei', 'nurWerktage', lg.nurWerktage)}${AC.LD ? F.check('Ende automatisch aus UE berechnen', 'endeAuto', lg.endeAuto) : ''}</div>
      ${AC.LD ? AC.LD.lehrgangHtml(lg, F) : ''}
      ${F.area('Inhalte (je Zeile ein Punkt – erscheinen auf der Teilnahmebescheinigung)', 'inhalte', lg.inhalte, { span: 4, rows: 6 })}
      ${AC.LI ? `<div style="grid-column:span 4;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:-6px"><button class="btn sm light" id="gLi" title="Rechtliche Inhalte passend zum Titel vorschlagen">⚖ Inhalte aus Titel vorschlagen</button><span class="small muted" id="gLiHint">${AC.LI.hinweis(lg)}</span></div>` : ''}
      ${F.area('Interne Notiz', 'notiz', lg.notiz, { span: 4, rows: 2 })}</div>
      ${(() => { const ds = LG.tage(lg), fr = LG.alleTage(lg).filter(d => !LG.zaehlt(lg, d));
        return `<p class="small muted"><b>${ds.length} Lehrgangstag${ds.length === 1 ? '' : 'e'}:</b> ${ds.map(d => `${LG.info(d).kurz} ${U.de(d).slice(0, 6)}`).join(', ') || '–'}${fr.length ? `<br><b>frei:</b> ${fr.map(d => `${LG.info(d).kurz} ${U.de(d).slice(0, 6)}${LG.info(d).ft ? ' (' + U.esc(LG.info(d).ft) + ')' : ''}`).join(', ')} – im Reiter „Anwesenheit“ einzeln als Lehrgangstag auswählbar` : ''}</p>`; })()}</div>
      <div class="card"><h2>Anlagen <span class="small muted">(optional)</span></h2>
        <p class="small muted">Werden an den Outlook-Termin angehängt – nur wenn hier Dateien liegen. Zulässig: Bilder (JPG, PNG, GIF), PDF, Word, Excel, PowerPoint. Ablage: lehrgaenge\\${U.esc(lg.id || 'LG-…')}\\anlagen</p>
        ${(lg.anlagen || []).length ? `<div class="files" style="margin-bottom:10px">${lg.anlagen.map(a => `<div class="file"><div class="ext ${UL.ext(a.name)}">${U.esc(UL.ext(a.name).slice(0, 4))}</div><div style="min-width:0"><b>${U.esc(a.name)}</b><div class="meta">${UL.size(a.groesse || 0)}</div>
          <div class="acts"><button class="btn sm" data-anlo="${U.esc(a.name)}">Öffnen</button><button class="btn sm light" data-anld="${U.esc(a.name)}" title="entfernen">✕</button></div></div></div>`).join('')}</div>
          ${lg.anlagen.reduce((t, a) => t + (a.groesse || 0), 0) > 10485760 ? '<p class="hint small">Die Anlagen sind zusammen größer als 10 MB – die Kalenderdatei wird entsprechend groß.</p>' : ''}` : ''}
        <button class="btn light" id="gAnl">📎 Anlagen hinzufügen</button><input type="file" id="gAnlF" multiple class="hidden" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"></div>`;
    if (tab === 1) return `<div class="card"><h2>Teilnehmende (${lg.teilnehmer.length}${lg.maxTN ? ' von max. ' + lg.maxTN : ''})</h2>
      <div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Name</th><th>Vorname</th><th>Geburtsdatum</th><th>Kontakt (E-Mail / Tel.)</th><th>Firma</th><th title="Teilnahmebescheinigung ausstellen">Bescheinigung</th><th></th></tr></thead><tbody>
      ${lg.teilnehmer.map((t, i) => `<tr><td>${i + 1}</td><td><input data-p="teilnehmer.${i}.name" value="${U.esc(t.name)}"></td><td><input data-p="teilnehmer.${i}.vorname" value="${U.esc(t.vorname)}"></td>
        <td style="width:160px"><input type="date" data-p="teilnehmer.${i}.geburtsdatum" value="${U.esc(t.geburtsdatum)}"></td><td><input data-p="teilnehmer.${i}.kontakt" value="${U.esc(t.kontakt)}"></td>
        <td><input data-p="teilnehmer.${i}.firma" value="${U.esc(t.firma)}"></td><td class="att"><input type="checkbox" data-p="teilnehmer.${i}.bescheinigung"${t.bescheinigung !== false ? ' checked' : ''}></td><td><button class="x" data-tdel="${i}">✕</button></td></tr>`).join('')
        || '<tr><td colspan="8" class="muted small">Noch keine Teilnehmenden.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn light sm" id="tAdd">+ Teilnehmer</button><button class="btn light sm" id="tPaste">Aus Excel / Liste einfügen …</button>
      ${lg.status === 'abgeschlossen' ? `<button class="btn light sm right" id="tAnon">Kontakt- und Geburtsdaten löschen (DSGVO)</button>` : ''}</div>
      ${lg.datenGeloescht ? `<p class="small muted">Kontakt- und Geburtsdaten gelöscht am ${U.de(lg.datenGeloescht)}.</p>` : ''}</div>`;
    if (tab === 2) { const all = LG.alleTage(lg), ds = LG.tage(lg), mob = AC.schmal();
      if (!all.length || !lg.teilnehmer.length) return '<div class="card"><h2>Anwesenheit</h2><p class="muted">Bitte zuerst Zeitraum und Teilnehmende erfassen.</p></div>';
      const col = d => { const i = LG.info(d), on = LG.zaehlt(lg, d); return { i, on, cls: `att${i.ft ? ' ft' : i.we ? ' we' : ''}${i.frei ? (on ? ' on' : ' off') : ''}` }; };
      const nWe = all.filter(d => LG.info(d).we && !LG.info(d).ft).length, nFt = all.filter(d => LG.info(d).ft).length, nZus = all.filter(d => LG.info(d).frei && LG.zaehlt(lg, d)).length;
      return `<div class="card"><h2>Anwesenheit</h2>
      <p class="small">${ds.length} Lehrgangstag${ds.length === 1 ? '' : 'e'} mit Anwesenheitspflicht${nWe || nFt ? ` · ${nWe ? nWe + ' Wochenendtag' + (nWe === 1 ? '' : 'e') : ''}${nWe && nFt ? ' und ' : ''}${nFt ? nFt + ' Feiertag' + (nFt === 1 ? '' : 'e') + ' (NRW)' : ''} im Zeitraum` : ''}${nZus ? ` · davon ${nZus} freie${nZus === 1 ? 'r Tag' : ' Tage'} als Lehrgangstag ausgewählt` : ''}.</p>
      <div class="legend small"><span><i class="sw"></i>Lehrgangstag</span><span><i class="sw we"></i>Wochenende – frei</span><span><i class="sw ft"></i>Feiertag NRW – frei</span><span><i class="sw on"></i>freier Tag, als Lehrgangstag ausgewählt</span></div>
      ${lg.nurWerktage ? '' : '<p class="hint small">Im Reiter „Grunddaten“ ist „Wochenenden & Feiertage sind frei“ ausgeschaltet – alle Tage zählen als Lehrgangstage.</p>'}
      ${mob ? LG.tagesListe(lg, all) : ''}${mob ? '<details class="mob-all"><summary>Gesamtübersicht – alle Tage</summary>' : ''}<div class="tw"><table class="t attt"><thead><tr><th>Teilnehmer</th>${all.map(d => { const c = col(d);
        return `<th class="${c.cls}" title="${c.i.frei ? U.esc(LG.freiText(d)) : ''}"><span class="wd">${c.i.kurz}</span> ${U.de(d).slice(0, 6)}${c.i.frei ? `<div class="tag">${U.esc(c.i.ft || (c.i.wd === 6 ? 'Samstag' : 'Sonntag'))}</div>` : ''}
          ${c.on ? `<button class="x" data-allday="${d}" title="alle anwesend">✓ alle</button>` : ''}${c.i.frei && lg.nurWerktage ? `<button class="x tg" data-tag="${d}" title="${c.on ? 'Tag wieder als frei behandeln' : 'Tag als Lehrgangstag auswählen'}">${c.on ? '✕ frei' : '+ Lehrgangstag'}</button>` : ''}</th>`; }).join('')}<th class="num">Quote</th></tr></thead><tbody>
      ${lg.teilnehmer.map((t, i) => { const q = LG.quote(lg, t); return `<tr><td><b>${U.esc(t.name)}</b>, ${U.esc(t.vorname)}</td>${all.map(d => { const c = col(d);
        return `<td class="${c.cls}"><input type="checkbox" data-att="${i}|${d}"${t.anwesend && t.anwesend[d] ? ' checked' : ''}${c.on ? '' : ` title="frei – beim Anhaken wird der Tag als Lehrgangstag übernommen"`}></td>`; }).join('')}
        <td class="num" data-q="${i}">${q ? `${q.n}/${q.von} · ${Math.round(q.n / q.von * 100)} %` : ''}</td></tr>`; }).join('')}</tbody></table></div>${mob ? '</details>' : ''}
      <p class="small muted" style="margin-top:8px">Feiertage nach § 2 Abs. 1 Feiertagsgesetz NW. Freie Tage zählen nicht zur Anwesenheitsquote und erscheinen nicht auf der Anwesenheitsliste, außer du wählst sie als Lehrgangstag aus (z. B. Wochenendkurs in der Erwachsenenbildung).</p></div>`; }
    if (tab === 3) { const linked = ul.filter(u => lg.unterlagen.includes(u.id)), themen = [...new Set(ul.map(u => u.thema))];
      return `<div class="card"><h2>Unterlagen zu diesem Lehrgang</h2>${linked.length ? `<div class="files">${linked.map(u => AC.UL.card(u, `<button class="btn sm light" data-uopen="${u.id}">Öffnen</button><button class="btn sm light" data-urm="${u.id}">entfernen</button>`)).join('')}</div>` : '<p class="muted">Noch keine Unterlagen zugeordnet.</p>'}</div>
      <div class="card"><h2>Aus der Bibliothek hinzufügen</h2>${ul.length ? themen.map(th => `<div class="small"><b>${U.esc(th)}</b></div><div class="chips">${ul.filter(u => u.thema === th && !lg.unterlagen.includes(u.id)).map(u => `<button class="chip" data-uadd="${u.id}">${U.esc(u.titel)}</button>`).join('') || '<span class="small muted">alle zugeordnet</span>'}</div>`).join('')
        : '<p class="muted">Die Bibliothek ist noch leer. Unterlagen legst du im Bereich <a href="#" id="toUL">Schulungsunterlagen</a> ab.</p>'}</div>`; }
    return `<div class="card"><h2>Listen und Bescheinigungen</h2><p class="small muted">Alles wird im Ordner <b>lehrgaenge/${lg.id || '…'}</b> abgelegt und kann direkt gedruckt werden.</p>
      <div class="grid g3">
        <div><button class="btn" data-doc="liste">Teilnehmerliste (ausgefüllt)</button></div>
        <div><button class="btn" data-doc="anw">Anwesenheitsliste zum Unterschreiben</button></div>
        <div><button class="btn" data-doc="cert">Teilnahmebescheinigungen (${lg.teilnehmer.filter(t => t.bescheinigung !== false).length})</button></div></div>
      ${lg.teilnehmer.length ? `<h3 style="margin-top:16px">Einzelne Bescheinigung</h3><div class="chips">${lg.teilnehmer.map((t, i) => `<button class="chip" data-one="${i}">${U.esc(t.vorname)} ${U.esc(t.name)}</button>`).join('')}</div>` : ''}</div>
      <div class="card"><h2>Abrechnung</h2>${lg.rechnungNr ? `<p>Abgerechnet mit Rechnung <a href="#" id="reLink">${lg.rechnungNr}</a>.</p>` : lg.kundeId ? `<p class="small muted">Erstellt einen Rechnungsentwurf an ${U.esc(K.name(K.get(lg.kundeId)))} mit ${U.nf(U.num(lg.ue))} Unterrichtseinheiten aus deinem Leistungskatalog. Preise und Positionen kannst du im Entwurf anpassen.</p>
        <button class="btn" id="reNew">Rechnung aus Lehrgang erstellen</button>` : '<p class="muted">Kein Auftraggeber hinterlegt – bei offenen Lehrgängen rechnest du je Teilnehmer über „Rechnungen“ ab.</p>'}</div>`;
  };
  const draw = () => {
    head(); bindHead();
    v.innerHTML = `<div class="steps">${TABS.map((t, i) => `<button data-tab="${i}" class="${i === tab ? 'on' : ''}"><span class="n">${i + 1}</span>${t}</button>`).join('')}</div>${body()}`;
    F.bind(v, lg, p => { dirty = true; if (/^(von|bis|nurWerktage|form|endeAuto)$/.test(p)) { if (AC.LD && p !== 'bis') AC.LD.anwenden(lg); const sc = scrollY; draw(); scrollTo(0, sc); }
      else if ((p === 'adresse' || p === 'ort') && q('#gNavi')) { const st = LG.standort(lg); q('#gNavi').href = LG.navi(st); q('#gNavi').style.display = st ? '' : 'none'; q('#gStand').textContent = st || '–'; }
      else if (p === 'teams' && q('#gTeams')) { q('#gTeams').href = lg.teams; q('#gTeams').style.display = lg.teams ? '' : 'none'; }
      else if ((p === 'ue' || p === 'uePerTag') && AC.LD) { if (AC.LD.anwenden(lg) && q('[data-p="bis"]')) q('[data-p="bis"]').value = lg.bis; if (q('#gLdInfo')) q('#gLdInfo').innerHTML = AC.LD.info(lg); }
      else if ((p === 'titel' || p === 'art') && q('#gLiHint')) q('#gLiHint').innerHTML = AC.LI.hinweis(lg); });
    const q = s => v.querySelector(s), qa = (s, fn) => v.querySelectorAll(s).forEach(fn);
    if (q('#gLi')) q('#gLi').onclick = async () => { if (await AC.LI.dialog(lg)) { dirty = true; const sc = scrollY; draw(); scrollTo(0, sc); AC.toast('Inhalte übernommen – bitte prüfen und speichern'); } };
    qa('[data-ldl]', b => b.onclick = () => { const vg = AC.LD.vorgabe(b.dataset.ldl); if (!vg) return; lg.ue = vg.ue; lg.ueVorgabe = vg.key; if (!lg.titel) lg.titel = vg.titel; AC.LD.anwenden(lg); dirty = true; const sc = scrollY; draw(); scrollTo(0, sc); AC.toast(`${vg.ue} UE übernommen`); });
    const setAdr = (str, ort) => { lg.adresse = str; lg.ort = ort; dirty = true; const sc = scrollY; draw(); scrollTo(0, sc); };
    if (q('#gAdrK')) q('#gAdrK').onclick = () => { const k = K.get(lg.kundeId); if (!k) return AC.toast('Zuerst einen Auftraggeber wählen', true); setAdr(k.strasse, K.ort(k)); };
    if (q('#gAdrE')) q('#gAdrE').onclick = () => { const a = AC.settings.absender; setAdr(a.strasse, `${a.plz} ${a.ort}`); };
    /* Anlagen für den Kalendereintrag */
    if (q('#gAnl')) { const fi = q('#gAnlF'); q('#gAnl').onclick = async () => { if (!lg.id && !await save()) return; fi.click(); };
      fi.onchange = async () => { const ok = [], nein = []; lg.anlagen = lg.anlagen || [];
        for (const f of fi.files) { if (!LG.ANLAGEN.includes(UL.ext(f.name))) { nein.push(f.name); continue; }
          const name = f.name.replace(/[\\/:*?"<>|]+/g, '-'); await FS.write(`lehrgaenge/${lg.id}/anlagen/${name}`, f);
          lg.anlagen = lg.anlagen.filter(a => a.name !== name).concat({ name, groesse: f.size }); ok.push(name); }
        if (nein.length) AC.toast('Nicht zulässig (nur Bilder, PDF, Word, Excel, PowerPoint): ' + nein.join(', '), true);
        if (ok.length) { await save(); AC.toast(`${ok.length} Anlage(n) gespeichert`); } const sc = scrollY; draw(); scrollTo(0, sc); }; }
    qa('[data-anlo]', b => b.onclick = () => FS.open(`lehrgaenge/${lg.id}/anlagen/${b.dataset.anlo}`).catch(() => AC.toast('Datei nicht gefunden', true)));
    qa('[data-anld]', b => b.onclick = async () => { const n = b.dataset.anld; if (!await AC.confirm('Anlage entfernen?', `<b>${U.esc(n)}</b> wird aus dem Lehrgangsordner gelöscht.`, 'Entfernen')) return;
      try { await FS.remove(`lehrgaenge/${lg.id}/anlagen/${n}`); } catch (e) { } lg.anlagen = (lg.anlagen || []).filter(a => a.name !== n); await save(); const sc = scrollY; draw(); scrollTo(0, sc); });
    qa('[data-tab]', b => b.onclick = async () => { if (!lg.id && +b.dataset.tab > 0) { if (!await save()) return; } tab = +b.dataset.tab; draw(); });
    if (q('#tAdd')) q('#tAdd').onclick = () => { lg.teilnehmer.push({ name: '', vorname: '', geburtsdatum: '', kontakt: '', firma: '', bescheinigung: true, anwesend: {} }); dirty = true; draw(); };
    qa('[data-tdel]', b => b.onclick = () => { lg.teilnehmer.splice(+b.dataset.tdel, 1); dirty = true; draw(); });
    if (q('#tPaste')) q('#tPaste').onclick = async () => {
      const r = await AC.dialog('Teilnehmer einfügen', `<p class="small">Zeilen aus Excel kopieren und hier einfügen. Spalten: <b>Name · Vorname · Geburtsdatum · Kontakt · Firma</b> (Tabulator oder Semikolon getrennt; Geburtsdatum als TT.MM.JJJJ).</p><textarea id="pTxt" rows="10" style="font-family:monospace"></textarea>`, [['Abbrechen', null, 'light'], ['Übernehmen', 'ok']]);
      if (r !== 'ok') return; const neu = LG.parse(document.getElementById('pTxt').value); lg.teilnehmer.push(...neu); dirty = true; AC.toast(`${neu.length} Teilnehmende übernommen`); draw(); };
    if (q('#tAnon')) q('#tAnon').onclick = async () => { if (!await AC.confirm('Daten löschen?', 'Geburtsdaten und Kontaktdaten aller Teilnehmenden dieses Lehrgangs werden endgültig gelöscht. Namen und Anwesenheit bleiben als Nachweis erhalten.', 'Löschen')) return; LG.anonym(lg); await save(true); draw(); };
    qa('[data-att]', c => c.onchange = () => { const [i, d] = c.dataset.att.split('|'); const t = lg.teilnehmer[+i]; t.anwesend = t.anwesend || {}; if (c.checked) t.anwesend[d] = true; else delete t.anwesend[d]; dirty = true;
      qa(`[data-att="${c.dataset.att}"]`, o => { o.checked = c.checked; });
      if (AC.mobil) { clearTimeout(LG._as); LG._as = setTimeout(() => { if (dirty) save(false); }, 1200); }
      if (c.checked && !LG.zaehlt(lg, d)) { lg.zusatzTage = [...(lg.zusatzTage || []), d]; AC.toast(`${LG.freiText(d)}, ${U.de(d)} als Lehrgangstag übernommen`); const sx = q('.tw') && q('.tw').scrollLeft, sc = scrollY; draw(); scrollTo(0, sc); if (q('.tw')) q('.tw').scrollLeft = sx; return; }
      const qq = LG.quote(lg, t); q(`[data-q="${i}"]`).textContent = `${qq.n}/${qq.von} · ${Math.round(qq.n / qq.von * 100)} %`; });
    if (q('#aTag')) q('#aTag').onchange = e => { LG._tag = e.target.value; const sc = scrollY; draw(); scrollTo(0, sc); };
    qa('[data-tag]', b => b.onclick = () => { const d = b.dataset.tag, z = lg.zusatzTage || []; lg.zusatzTage = z.includes(d) ? z.filter(x => x !== d) : [...z, d]; dirty = true;
      const sx = q('.tw').scrollLeft, sc = scrollY; draw(); scrollTo(0, sc); if (q('.tw')) q('.tw').scrollLeft = sx; });
    qa('[data-allday]', b => b.onclick = () => { lg.teilnehmer.forEach(t => { t.anwesend = t.anwesend || {}; t.anwesend[b.dataset.allday] = true; }); dirty = true; if (AC.mobil) { clearTimeout(LG._as); LG._as = setTimeout(() => { if (dirty) save(false); }, 1200); } const sx = q('.tw').scrollLeft, sc = scrollY; draw(); scrollTo(0, sc); if (q('.tw')) q('.tw').scrollLeft = sx; });
    qa('[data-uadd]', b => b.onclick = () => { lg.unterlagen.push(b.dataset.uadd); dirty = true; draw(); });
    qa('[data-urm]', b => b.onclick = () => { lg.unterlagen = lg.unterlagen.filter(x => x !== b.dataset.urm); dirty = true; draw(); });
    qa('[data-uopen]', b => b.onclick = () => AC.UL.open(ul.find(u => u.id === b.dataset.uopen)));
    if (q('#toUL')) q('#toUL').onclick = e => { e.preventDefault(); AC.go('unterlagen'); };
    if (q('#reLink')) q('#reLink').onclick = e => { e.preventDefault(); AC.go('rechnung', lg.rechnungNr); };
    if (q('#reNew')) q('#reNew').onclick = async () => { await save();
      const kat = AC.settings.katalog.find(x => x.einheit === 'UE') || { bez: 'Lehrgang – Unterrichtseinheit (45 Min.)', einheit: 'UE', preis: 0 };
      AC.go('rechnungEdit', null, { kundeId: lg.kundeId, bezug: lg.titel, leistungVon: lg.von, leistungBis: lg.bis !== lg.von ? lg.bis : '', lehrgangId: lg.id,
        positionen: [{ bez: lg.titel, text: [lg.art, LG.zeitraum(lg), LG.ortText(lg), lg.teilnehmer.length ? lg.teilnehmer.length + ' Teilnehmende' : ''].filter(Boolean).join(' · '), menge: U.num(lg.ue) || 1, einheit: kat.einheit, preis: kat.preis }] }); };
    qa('[data-doc]', b => b.onclick = async () => { if (dirty) await save(); const k = b.dataset.doc;
      if (k === 'cert' && !lg.teilnehmer.some(t => t.bescheinigung !== false)) return AC.toast('Keine Teilnehmenden mit Haken bei „Bescheinigung“', true);
      const doc = k === 'liste' ? LG.liste(lg) : k === 'anw' ? LG.anwesenheit(lg) : LG.bescheinigungen(lg);
      const name = { liste: 'Teilnehmerliste', anw: 'Anwesenheitsliste', cert: 'Teilnahmebescheinigungen' }[k] + `_${lg.id}.pdf`;
      await LG.ablegen(lg, name, doc); AC.preview(doc, name); });
    qa('[data-one]', b => b.onclick = async () => { if (dirty) await save(); const t = lg.teilnehmer[+b.dataset.one]; const doc = LG.bescheinigungen(lg, [t]);
      const name = `Teilnahmebescheinigung_${U.slug(t.name + ' ' + t.vorname)}_${lg.id}.pdf`; await LG.ablegen(lg, name, doc); AC.preview(doc, name); });
  };
  draw();
};
