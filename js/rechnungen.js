/* =====================================================================
   AC Office – Rechnungen (rechnungen.js)
   Entwürfe:  rechnungen/entwuerfe/E-....json   (noch ohne Rechnungsnummer)
   Rechnung:  rechnungen/RE-2026-0001.json  +  rechnungen/RE-2026-0001_Kunde.pdf
   Eine erstellte Rechnung wird nicht mehr verändert (Korrektur nur per Storno).
   ===================================================================== */
'use strict';
const R = AC.R = {
  async loadAll() { return (await FS.readAll('rechnungen')).sort((a, b) => b.nr.localeCompare(a.nr)); },
  async loadDrafts() { return FS.readAll('rechnungen/entwuerfe'); },
  async get(nr) { return FS.readJSON(`rechnungen/${nr}.json`); },
  save: r => { const d = Object.assign({}, r); delete d._file; return FS.writeJSON(`rechnungen/${r.nr}.json`, d); },
  calc(r) {
    const netto = U.r2(r.positionen.reduce((s, p) => s + U.r2(U.num(p.menge) * U.num(p.preis)), 0));
    const ust = r.kleinunternehmer ? 0 : U.r2(netto * (r.ustSatz || 0) / 100);
    r.summen = { netto, ust, brutto: U.r2(netto + ust) }; return r.summen;
  },
  gezahlt: r => U.r2((r.zahlungen || []).reduce((s, z) => s + U.num(z.betrag), 0)),
  offen: r => r.typ === 'storno' || r.status === 'storniert' ? 0 : U.r2(r.summen.brutto - R.gezahlt(r)),
  ueberfaellig: r => r.status === 'offen' && R.offen(r) > 0 && r.faellig < U.today(),
  badge(r) {
    if (r.typ === 'storno') return '<span class="badge storniert" style="text-decoration:none">Storno</span>';
    if (r.status === 'entwurf') return '<span class="badge entwurf">Entwurf</span>';
    if (r.status === 'storniert') return '<span class="badge storniert">storniert</span>';
    if (r.status === 'bezahlt') return '<span class="badge bezahlt">bezahlt</span>';
    const m = (r.mahnungen || []).at(-1);
    if (R.ueberfaellig(r)) return `<span class="badge ueber">überfällig${m ? ' · ' + U.esc(m.titel) : ''}</span>`;
    return `<span class="badge offen">offen${R.gezahlt(r) > 0 ? ' (Teilzahlung)' : ''}</span>`;
  },
  blank() {
    const s = AC.settings;
    return { id: 'E-' + U.uid(), status: 'entwurf', typ: 'rechnung', kundeId: '', datum: U.today(), leistungVon: U.today(), leistungBis: '', bezug: '',
      einleitung: s.texte.rechnungEinleitung, schluss: s.texte.rechnungSchluss, positionen: [], zahlungsziel: s.zahlungsziel,
      kleinunternehmer: s.steuer.kleinunternehmer, ustSatz: s.steuer.ustSatz, summen: { netto: 0, ust: 0, brutto: 0 } };
  },
  async nextNumber() {
    const n = AC.settings.nummern, y = new Date().getFullYear();
    if (n.rechnungJahr !== y) { n.rechnungJahr = y; n.rechnung = 1; }
    let nr; do { nr = `${n.rechnungPraefix}-${y}-${U.pad(n.rechnung, 4)}`; n.rechnung++; } while (await FS.readJSON(`rechnungen/${nr}.json`));
    await AC.saveSettings(); return nr;
  },
  pdfName: r => `${r.nr}_${U.slug(r.kunde ? K.name(r.kunde) : 'Kunde')}.pdf`,

  /* ---------- PDF der Rechnung (passt automatisch auf eine Seite) ---------- */
  pdf: r => PDF.fit(() => R._pdf(r)),
  _pdf(r) {
    const s = AC.settings, ctx = PDF.create('letter', { title: (r.typ === 'storno' ? 'Stornorechnung ' : 'Rechnung ') + (r.nr || 'Vorschau') }), { doc } = ctx;
    const k = r.kunde || K.get(r.kundeId) || {};
    const leist = r.leistungBis && r.leistungBis !== r.leistungVon ? `${U.de(r.leistungVon)} – ${U.de(r.leistungBis)}` : U.de(r.leistungVon);
    const info = [['Rechnungsnr.', r.nr || 'ENTWURF'], ['Rechnungsdatum', U.de(r.datum)], ['Kundennr.', k.id || ''], [r.leistungBis ? 'Leistungszeitraum' : 'Leistungsdatum', leist]];
    if (r.typ === 'storno') info.push(['Storno zu', r.stornoZu]);
    if (k.ustid) info.push(['USt-IdNr. Kunde', k.ustid]);
    const titel = r.typ === 'storno' ? `Stornorechnung ${r.nr} zur Rechnung ${r.stornoZu}` : `Rechnung ${r.nr || '(Entwurf)'}${r.bezug ? ' – ' + r.bezug : ''}`;
    PDF.letter(ctx, PDF.empf(k), info, titel);
    if (!r.nr) { doc.setTextColor(230, 230, 222); doc.setFontSize(70); doc.text('ENTWURF', 105, 190, { align: 'center', angle: 30 }); }
    PDF.text(ctx, PDF.anrede(k), { after: 2 });
    PDF.text(ctx, r.typ === 'storno' ? `hiermit storniere ich die Rechnung ${r.stornoZu} vom ${U.de(r.stornoDatum)} vollständig.${r.stornoGrund ? ' Grund: ' + r.stornoGrund : ''}` : r.einleitung, { after: 4 });
    PDF.positions(ctx, r.positionen);
    const S = PDF.S;
    PDF.sums(ctx, r, { label: r.typ === 'storno' ? 'Gutschriftsbetrag' : 'Gesamtbetrag', giro: r.typ === 'storno' ? null : { name: s.absender.name, iban: s.bank.iban, bic: s.bank.bic, amount: r.summen.brutto, ref: r.nr || '' } });
    if (r.typ === 'storno') PDF.text(ctx, 'Ein bereits gezahlter Betrag wird Ihnen erstattet bzw. verrechnet.', { after: 4 });
    else {
      PDF.text(ctx, `Bitte überweisen Sie den Gesamtbetrag ohne Abzug bis zum ${U.de(r.faellig || U.addDays(r.datum, r.zahlungsziel))} auf das unten genannte Konto. Verwendungszweck: ${r.nr || 'Rechnungsnummer'}.` +
        (K.b2b(k) ? '' : '\nHinweis: Sie kommen spätestens 30 Tage nach Fälligkeit und Zugang dieser Rechnung in Verzug, ohne dass es einer Mahnung bedarf (§ 286 Abs. 3 BGB).'), { size: 10.5, after: 3 });
      if (r.schluss) PDF.text(ctx, r.schluss, { after: 4 });
    }
    PDF.gruss(ctx, '', PDF.ou('eine Unterschrift nach § 14 UStG nicht erforderlich ist'));
    return PDF.finish(ctx);
  },

  /* Rechnung festschreiben: Nummer vergeben, JSON + PDF ablegen, Entwurf löschen */
  async finalize(d) {
    const k = K.get(d.kundeId); const r = U.clone(d); delete r._file;
    r.nr = await R.nextNumber(); r.status = 'offen'; r.kunde = K.snapshot(k); r.faellig = U.addDays(r.datum, r.zahlungsziel);
    r.zahlungen = []; r.mahnungen = []; r.erstellt = new Date().toISOString(); R.calc(r);
    r.pdf = R.pdfName(r);
    await FS.write('rechnungen/' + r.pdf, R.pdf(r).output('blob'));
    await R.save(r); await FS.remove('rechnungen/entwuerfe/' + d.id + '.json');
    // Verknüpfungen: Angebot bzw. Lehrgang als abgerechnet markieren
    for (const [key, dir] of [['angebotNr', 'angebote'], ['lehrgangId', 'lehrgaenge']]) if (r[key]) {
      const o = await FS.readJSON(`${dir}/${r[key]}.json`); if (o) { o.rechnungNr = r.nr; if (key === 'angebotNr') o.status = 'abgerechnet'; await FS.writeJSON(`${dir}/${r[key]}.json`, o); } }
    return r;
  },
};

/* ---------- Ansicht: Rechnungsliste ---------- */
AC.views.rechnungen = async (v) => {
  await K.load();
  const all = await R.loadAll(), drafts = await R.loadDrafts();
  const jahre = [...new Set(all.map(r => r.datum.slice(0, 4)))].sort().reverse();
  AC.head('Rechnungen', 'Ablage: Ordner „rechnungen“ (PDF + Daten) · Entwürfe in „rechnungen/entwuerfe“', `<button class="btn ghost" id="rNeu">+ Neue Rechnung</button>`);
  document.getElementById('rNeu').onclick = () => AC.go('rechnungEdit');
  let fj = '', fs = '';
  v.innerHTML = `${drafts.length ? `<div class="card"><h2>Entwürfe</h2><div class="tw"><table class="t"><thead><tr><th>Entwurf</th><th>Kunde</th><th>Bezug</th><th class="num">Betrag</th><th></th></tr></thead><tbody>
    ${drafts.map(d => `<tr class="click" data-d="${d.id}"><td>${U.de(d.datum)}</td><td>${U.esc(K.name(K.get(d.kundeId)))}</td><td>${U.esc(d.bezug)}</td><td class="num">${U.eur(R.calc(d).brutto)}</td><td><span class="badge entwurf">Entwurf</span></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card"><div class="row"><select id="fJahr" style="max-width:160px"><option value="">alle Jahre</option>${jahre.map(j => `<option>${j}</option>`).join('')}</select>
    <select id="fStat" style="max-width:200px"><option value="">alle Status</option><option value="offen">offen</option><option value="ueber">überfällig</option><option value="bezahlt">bezahlt</option><option value="storniert">storniert / Storno</option></select>
    <span class="right small muted" id="rSum"></span></div></div><div id="rList"></div>`;
  v.querySelectorAll('[data-d]').forEach(t => t.onclick = () => AC.go('rechnungEdit', t.dataset.d));
  const draw = () => {
    const rows = all.filter(r => (!fj || r.datum.startsWith(fj)) && (!fs || (fs === 'ueber' ? R.ueberfaellig(r) : fs === 'storniert' ? (r.status === 'storniert' || r.typ === 'storno') : r.status === fs && r.typ !== 'storno')));
    v.querySelector('#rSum').textContent = `${rows.length} Rechnungen · Summe ${U.eur(rows.reduce((s, r) => s + (r.typ === 'storno' ? 0 : r.summen.brutto), 0))} · offen ${U.eur(rows.reduce((s, r) => s + R.offen(r), 0))}`;
    v.querySelector('#rList').innerHTML = rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Datum</th><th>Kunde</th><th>Bezug</th><th class="num">Betrag</th><th class="num">offen</th><th>fällig</th><th>Status</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="click" data-r="${r.nr}"><td><b>${r.nr}</b></td><td>${U.de(r.datum)}</td><td>${U.esc(K.name(r.kunde))}</td><td>${U.esc(r.bezug || (r.typ === 'storno' ? 'Storno zu ' + r.stornoZu : ''))}</td>
      <td class="num">${U.eur(r.summen.brutto)}</td><td class="num">${R.offen(r) ? U.eur(R.offen(r)) : '–'}</td><td>${r.typ === 'storno' ? '' : U.de(r.faellig)}</td><td>${R.badge(r)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Keine Rechnungen gefunden.</div>';
    v.querySelectorAll('[data-r]').forEach(t => t.onclick = () => AC.go('rechnung', t.dataset.r));
  };
  v.querySelector('#fJahr').onchange = e => { fj = e.target.value; draw(); };
  v.querySelector('#fStat').onchange = e => { fs = e.target.value; draw(); };
  draw();
};

/* ---------- Baustein-Editor für Positionen (Rechnungen und Angebote) ---------- */
AC.PosEd = {
  html(r) {
    const kat = AC.settings.katalog, groups = [...new Set(kat.map(x => x.gruppe))];
    return `<p class="hint">Bausteine aus deinem Leistungskatalog anklicken (Preise pflegst du unter Einstellungen) oder eine freie Position anlegen.</p>
      ${groups.map(g => `<div class="small"><b>${U.esc(g)}</b></div><div class="chips">${kat.map((x, i) => x.gruppe === g ? `<button class="chip" data-kat="${i}">${U.esc(x.bez)}${x.preis ? ' · ' + U.eur(x.preis) : ''}</button>` : '').join('')}</div>`).join('')}
      <div class="tw"><table class="t"><thead><tr><th>Pos.</th><th>Leistung</th><th>Menge</th><th>Einheit</th><th>Einzelpreis €</th><th class="num">Gesamt</th><th></th></tr></thead><tbody>
      ${r.positionen.map((p, i) => `<tr><td>${i + 1}</td>
        <td><input data-p="positionen.${i}.bez" value="${U.esc(p.bez)}" placeholder="Bezeichnung"><textarea data-p="positionen.${i}.text" rows="1" placeholder="Beschreibung (optional)" style="margin-top:4px">${U.esc(p.text)}</textarea></td>
        <td style="width:90px"><input data-p="positionen.${i}.menge" type="number" step="0.25" value="${p.menge}"></td>
        <td style="width:100px"><input data-p="positionen.${i}.einheit" value="${U.esc(p.einheit)}"></td>
        <td style="width:120px"><input data-p="positionen.${i}.preis" type="number" step="0.01" value="${p.preis}"></td>
        <td class="num" data-sum="${i}" style="width:110px"></td>
        <td style="width:70px;white-space:nowrap"><button class="x" data-up="${i}" title="nach oben">↑</button><button class="x" data-del="${i}" title="entfernen">✕</button></td></tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn light sm" id="eFree">+ freie Position</button><div class="tot" id="eTot"></div></div>`;
  },
  totals(v, r) {
    R.calc(r); const t = v.querySelector('#eTot'); if (!t) return;
    t.innerHTML = `${r.kleinunternehmer ? '' : `<div><span>Nettobetrag</span><b>${U.eur(r.summen.netto)}</b></div><div><span>zzgl. ${U.nf(r.ustSatz)} % USt</span><b>${U.eur(r.summen.ust)}</b></div>`}
      <div class="sum"><span>Gesamtbetrag</span><span>${U.eur(r.summen.brutto)}</span></div>${r.kleinunternehmer ? '<div class="small muted">Kleinunternehmer – keine USt (§ 19 UStG)</div>' : ''}`;
    v.querySelectorAll('[data-sum]').forEach(el => { const p = r.positionen[el.dataset.sum]; if (p) el.textContent = U.eur(U.num(p.menge) * U.num(p.preis)); });
  },
  bind(v, r, redraw) {
    const kat = AC.settings.katalog;
    v.querySelectorAll('[data-kat]').forEach(b => b.onclick = () => { const x = kat[b.dataset.kat]; r.positionen.push({ bez: x.bez, text: x.text || '', menge: 1, einheit: x.einheit, preis: x.preis }); redraw(); });
    v.querySelector('#eFree').onclick = () => { r.positionen.push({ bez: '', text: '', menge: 1, einheit: 'Stk.', preis: 0 }); redraw(); };
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { r.positionen.splice(+b.dataset.del, 1); redraw(); });
    v.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [r.positionen[i - 1], r.positionen[i]] = [r.positionen[i], r.positionen[i - 1]]; redraw(); } });
  },
};

/* ---------- Ansicht: Rechnung zusammenstellen (Entwurf) ---------- */
AC.views.rechnungEdit = async (v, draftId, preset) => {
  await K.load();
  let r = draftId ? await FS.readJSON(`rechnungen/entwuerfe/${draftId}.json`) : null;
  if (!r) { r = R.blank(); if (preset) Object.assign(r, preset); }
  const F = AC.F;
  AC.head(r.kundeId ? 'Rechnung an ' + K.name(K.get(r.kundeId)) : 'Neue Rechnung', 'Baustein für Baustein zusammenstellen – die Nummer wird erst beim Erstellen vergeben',
    `<button class="btn ghost" id="eBack">← Zurück</button><button class="btn ghost" id="eDraft">Entwurf speichern</button><button class="btn ghost" id="ePrev">Vorschau</button><button class="btn light" id="eFinal">Rechnung erstellen</button>`);
  const totals = () => AC.PosEd.totals(v, r);
  const draw = () => {
    v.innerHTML = `
    <div class="card"><h2>① Kunde und Kopfdaten</h2>
      <div class="grid g4">
        <label class="f" style="grid-column:span 2"><span>Kunde *</span><select data-p="kundeId">${K.options(r.kundeId)}</select></label>
        ${F.input('Rechnungsdatum', 'datum', r.datum, { type: 'date' })}
        ${F.input('Zahlungsziel (Tage)', 'zahlungsziel', r.zahlungsziel, { type: 'number' })}
        ${F.input('Leistungsdatum / Beginn *', 'leistungVon', r.leistungVon, { type: 'date' })}
        ${F.input('Leistungsende (bei Zeitraum)', 'leistungBis', r.leistungBis, { type: 'date' })}
        ${F.input('Bezug (z. B. Lehrgang, Auftrag vom …)', 'bezug', r.bezug, { span: 2 })}
      </div>
      <p class="small muted">Kein passender Kunde? <a href="#" id="eNewK">Neuen Kunden anlegen</a> (der Entwurf wird vorher gespeichert).</p></div>
    <div class="card"><h2>② Einleitung</h2>${F.area('', 'einleitung', r.einleitung, { rows: 2 })}</div>
    <div class="card"><h2>③ Positionen</h2>
      ${AC.PosEd.html(r)}</div>
    <div class="card"><h2>④ Schlusstext</h2>${F.area('', 'schluss', r.schluss, { rows: 2 })}
      <p class="small muted">Zahlungshinweis mit Fälligkeitsdatum, GiroCode${AC.settings.steuer.kleinunternehmer ? ', Hinweis nach § 19 UStG' : ''} und – bei Privatkunden – der Verzugshinweis nach § 286 Abs. 3 BGB werden automatisch ergänzt.</p></div>`;
    F.bind(v, r, (p) => { if (p === 'kundeId') { const k = K.get(r.kundeId); if (k) r.zahlungsziel = k.zahlungsziel || AC.settings.zahlungsziel; draw(); } else totals(); });
    AC.PosEd.bind(v, r, draw);
    v.querySelector('#eNewK').onclick = async e => { e.preventDefault(); await saveDraft(true); AC.go('kunde'); };
    totals();
  };
  const saveDraft = async (quiet) => { R.calc(r); await FS.writeJSON(`rechnungen/entwuerfe/${r.id}.json`, r); if (!quiet) AC.toast('Entwurf gespeichert'); };
  const check = () => {
    const m = []; if (!r.kundeId) m.push('Kunde'); if (!r.leistungVon) m.push('Leistungsdatum (§ 14 Abs. 4 Nr. 6 UStG)');
    if (!r.positionen.length) m.push('mindestens eine Position'); if (r.positionen.some(p => !p.bez)) m.push('Bezeichnung aller Positionen');
    if (!AC.settings.steuer.steuernummer && !AC.settings.steuer.ustid) m.push('deine Steuernummer (Einstellungen)');
    return m;
  };
  draw();
  document.getElementById('eBack').onclick = () => AC.go('rechnungen');
  document.getElementById('eDraft').onclick = () => saveDraft();
  document.getElementById('ePrev').onclick = () => { R.calc(r); const d = U.clone(r); d.kunde = K.get(r.kundeId); d.faellig = U.addDays(d.datum, d.zahlungsziel); AC.preview(R.pdf(d), 'Vorschau (Entwurf)'); };
  document.getElementById('eFinal').onclick = async () => {
    const m = check(); if (m.length) return AC.toast('Bitte ergänzen: ' + m.join(', '), true);
    if (!await AC.confirm('Rechnung erstellen?', `Die Rechnung bekommt jetzt die nächste fortlaufende Nummer und wird als PDF im Ordner „rechnungen“ abgelegt. Danach ist sie nicht mehr änderbar (Korrektur nur über Storno).<br><br>Gesamtbetrag: <b>${U.eur(R.calc(r).brutto)}</b>`, 'Rechnung erstellen', '')) return;
    const fin = await R.finalize(r); AC.toast(`Rechnung ${fin.nr} erstellt und abgelegt`); AC.go('rechnung', fin.nr);
  };
};

/* ---------- Ansicht: erstellte Rechnung ---------- */
AC.views.rechnung = async (v, nr) => {
  const r = await R.get(nr); if (!r) { v.innerHTML = '<div class="empty">Rechnung nicht gefunden.</div>'; return; }
  await K.load();
  const isSt = r.typ === 'storno';
  AC.head(`${isSt ? 'Stornorechnung' : 'Rechnung'} ${r.nr}`, `${K.name(r.kunde)} · ${U.de(r.datum)} · Datei: rechnungen/${r.pdf}`,
    `<button class="btn ghost" id="vBack">← Zur Liste</button><button class="btn ghost" id="vOpen">PDF öffnen</button><button class="btn ghost" id="vPrint">Drucken</button><button class="btn light" id="vDup">Als Vorlage kopieren</button>`);
  v.innerHTML = `
    <div class="grid g4" style="margin-bottom:18px">
      <div class="kpi"><b>${U.eur(r.summen.brutto)}</b><span>Rechnungsbetrag</span></div>
      <div class="kpi"><b>${U.eur(R.gezahlt(r))}</b><span>bezahlt</span></div>
      <div class="kpi ${R.ueberfaellig(r) ? 'warn' : ''}"><b>${U.eur(R.offen(r))}</b><span>offen ${isSt ? '' : '· fällig ' + U.de(r.faellig)}</span></div>
      <div class="kpi"><b style="font-size:18px;padding:6px 0">${R.badge(r)}</b><span>Status</span></div>
    </div>
    ${!isSt && r.status !== 'storniert' ? `<div class="card"><h2>Zahlungseingang</h2>
      <div class="row"><input type="date" id="zDat" value="${U.today()}" style="max-width:170px"><input type="number" step="0.01" id="zBet" value="${R.offen(r)}" style="max-width:150px"><button class="btn" id="zAdd">Zahlung erfassen</button>
      ${R.offen(r) > 0 ? '<button class="btn light" id="zMahn">Zum Mahnwesen</button>' : ''}</div>
      ${(r.zahlungen || []).length ? `<table class="t" style="margin-top:12px;max-width:500px"><thead><tr><th>Datum</th><th class="num">Betrag</th><th></th></tr></thead><tbody>${r.zahlungen.map((z, i) => `<tr><td>${U.de(z.datum)}</td><td class="num">${U.eur(z.betrag)}</td><td><button class="x" data-zdel="${i}">✕</button></td></tr>`).join('')}</tbody></table>` : ''}
    </div>` : ''}
    ${(r.mahnungen || []).length ? `<div class="card"><h2>Mahnungen</h2><table class="t"><thead><tr><th>Stufe</th><th>Datum</th><th>Frist</th><th class="num">Forderung</th><th>Datei</th></tr></thead><tbody>
      ${r.mahnungen.map(m => `<tr><td>${U.esc(m.titel)}</td><td>${U.de(m.datum)}</td><td>${U.de(m.frist)}</td><td class="num">${U.eur(m.gesamt)}</td><td><a href="#" data-open="${U.esc(m.datei)}">${U.esc(m.datei)}</a></td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="card"><h2>Positionen</h2><table class="t"><thead><tr><th>Pos.</th><th>Leistung</th><th class="num">Menge</th><th>Einheit</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>
      ${r.positionen.map((p, i) => `<tr><td>${i + 1}</td><td><b>${U.esc(p.bez)}</b><div class="small muted">${U.esc(p.text)}</div></td><td class="num">${U.nf(U.num(p.menge))}</td><td>${U.esc(p.einheit)}</td><td class="num">${U.eur(U.num(p.preis))}</td><td class="num">${U.eur(U.num(p.menge) * U.num(p.preis))}</td></tr>`).join('')}</tbody></table></div>
    ${!isSt && r.status !== 'storniert' ? `<div class="card"><h2>Korrektur</h2><p class="small muted">Eine erstellte Rechnung darf nicht verändert werden. Bei Fehlern erstellst du eine Stornorechnung (eigene Nummer) und danach eine neue, richtige Rechnung.</p><button class="btn red" id="vStorno">Stornorechnung erstellen</button></div>` : ''}`;
  const reload = () => AC.go('rechnung', nr);
  document.getElementById('vBack').onclick = () => AC.go('rechnungen');
  document.getElementById('vOpen').onclick = () => FS.open('rechnungen/' + r.pdf).catch(() => AC.toast('PDF nicht gefunden', true));
  document.getElementById('vPrint').onclick = () => AC.print(R.pdf(r));
  document.getElementById('vDup').onclick = () => AC.go('rechnungEdit', null, { kundeId: r.kunde.id, bezug: r.bezug, positionen: U.clone(r.positionen), einleitung: r.einleitung, schluss: r.schluss });
  v.querySelectorAll('[data-open]').forEach(a => a.onclick = e => { e.preventDefault(); FS.open('mahnungen/' + a.dataset.open).catch(() => AC.toast('Datei nicht gefunden', true)); });
  const zAdd = v.querySelector('#zAdd');
  if (zAdd) zAdd.onclick = async () => {
    const b = U.num(v.querySelector('#zBet').value); if (!(b > 0)) return AC.toast('Bitte einen Betrag eingeben', true);
    r.zahlungen = r.zahlungen || []; r.zahlungen.push({ datum: v.querySelector('#zDat').value || U.today(), betrag: b });
    if (R.offen(r) <= 0) { r.status = 'bezahlt'; r.bezahltAm = r.zahlungen.at(-1).datum; }
    await R.save(r); AC.toast(r.status === 'bezahlt' ? 'Rechnung als bezahlt markiert' : 'Teilzahlung erfasst'); reload();
  };
  v.querySelectorAll('[data-zdel]').forEach(b => b.onclick = async () => { r.zahlungen.splice(+b.dataset.zdel, 1); r.status = R.offen(r) > 0 ? 'offen' : 'bezahlt'; await R.save(r); reload(); });
  const zM = v.querySelector('#zMahn'); if (zM) zM.onclick = () => AC.go('mahnwesen', r.nr);
  const st = v.querySelector('#vStorno');
  if (st) st.onclick = async () => {
    const grund = await AC.dialog('Stornorechnung erstellen', `<p>Zur Rechnung <b>${r.nr}</b> wird eine Stornorechnung mit eigener Nummer über <b>${U.eur(-r.summen.brutto)}</b> erstellt. Die Rechnung gilt danach als storniert.</p><label class="f"><span>Grund (erscheint auf dem Beleg, optional)</span><input id="stG"></label>`,
      [['Abbrechen', null, 'light'], ['Stornieren', 'ok', 'red']], 'small');
    if (grund !== 'ok') return;
    const g = document.getElementById('stG') ? document.getElementById('stG').value : '';
    const s = { typ: 'storno', status: 'bezahlt', kundeId: r.kundeId, kunde: r.kunde, datum: U.today(), leistungVon: r.leistungVon, leistungBis: r.leistungBis, bezug: '', stornoZu: r.nr, stornoDatum: r.datum, stornoGrund: g,
      positionen: r.positionen.map(p => Object.assign({}, p, { menge: -U.num(p.menge) })), kleinunternehmer: r.kleinunternehmer, ustSatz: r.ustSatz, zahlungen: [], mahnungen: [], erstellt: new Date().toISOString() };
    s.nr = await R.nextNumber(); R.calc(s); s.pdf = R.pdfName(s);
    await FS.write('rechnungen/' + s.pdf, R.pdf(s).output('blob')); await R.save(s);
    r.status = 'storniert'; r.storniertDurch = s.nr; await R.save(r);
    AC.toast(`Stornorechnung ${s.nr} erstellt`); AC.go('rechnung', s.nr);
  };
};
