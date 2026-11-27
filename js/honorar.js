/* =====================================================================
   AC Office – Honorar-Einsätze (honorar.js)
   Einsätze als Honorardozent je Auftraggeber (Bildungsträger) erfassen,
   Stundennachweis als PDF, Rechnungsentwurf mit einem Klick.
   Daten: honorar/einsaetze.json   PDFs: honorar/
   ===================================================================== */
'use strict';
const HO = AC.HO = {
  async load() { return ((await FS.readJSON('honorar/einsaetze.json')) || { items: [] }).items; },
  save: items => FS.writeJSON('honorar/einsaetze.json', { items: items.sort((a, b) => (a.datum || '').localeCompare(b.datum || '')) }),
  satz() { const k = AC.settings.katalog.find(x => /Unterrichtseinheit/.test(x.bez)) || AC.settings.katalog.find(x => x.einheit === 'UE'); return k ? U.num(k.preis) : 0; },
  kmSatz() { const k = AC.settings.katalog.find(x => x.einheit === 'km'); return k ? U.num(k.preis) : 0.3; },
  monat: d => (d || '').slice(0, 7),
  monatText: m => m ? new Date(m + '-01T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : 'alle Monate',
  betrag: e => U.num(e.ue) * U.num(e.satz),
  async dialog(e, lgs) {
    const neu = !e; e = e || { id: U.uid(), kundeId: HO._k || '', datum: U.today(), von: '08:00', bis: '15:30', thema: '', lehrgangId: '', ue: 8, satz: HO.satz(), km: 0, notiz: '', rechnungNr: '' };
    const r = await AC.dialog(neu ? 'Neuer Einsatz' : 'Einsatz bearbeiten', `<div class="grid g2">
      <label class="f" style="grid-column:span 2"><span>Auftraggeber (Bildungsträger) *</span><select id="hK">${K.options(e.kundeId)}</select></label>
      <label class="f"><span>Datum</span><input type="date" id="hD" value="${e.datum}"></label>
      <label class="f"><span>Lehrgang in AC Office (optional)</span><select id="hL"><option value="">– ohne –</option>${lgs.map(l => `<option value="${l.id}"${l.id === e.lehrgangId ? ' selected' : ''}>${l.id} · ${U.esc(l.titel)}</option>`).join('')}</select></label>
      <label class="f"><span>Uhrzeit von</span><input type="time" id="hV" value="${e.von}"></label><label class="f"><span>bis</span><input type="time" id="hB" value="${e.bis}"></label>
      <label class="f" style="grid-column:span 2"><span>Thema / Maßnahme *</span><input id="hT" value="${U.esc(e.thema)}" placeholder="z. B. Sachkunde § 34a – Sachgebiet 4 Strafrecht"></label>
      <label class="f"><span>Unterrichtseinheiten (à 45 Min.)</span><input type="number" step="0.5" id="hU" value="${e.ue}"></label>
      <label class="f"><span>Honorar je UE (€)</span><input type="number" step="0.5" id="hS" value="${e.satz}"></label>
      <label class="f"><span>Gefahrene km (hin und zurück, optional)</span><input type="number" id="hKm" value="${e.km || 0}"></label>
      <label class="f"><span>Notiz</span><input id="hN" value="${U.esc(e.notiz || '')}"></label></div>
      ${e.rechnungNr ? `<p class="hint small">Bereits abgerechnet mit Rechnung ${U.esc(e.rechnungNr)}.</p>` : ''}`, [['Abbrechen', null, 'light'], ['Speichern', 'ok']], 'small');
    if (r !== 'ok') return null; const g = id => document.getElementById(id).value;
    if (!g('hK') || !g('hT')) { AC.toast('Bitte Auftraggeber und Thema angeben', true); return null; }
    Object.assign(e, { kundeId: g('hK'), datum: g('hD') || U.today(), lehrgangId: g('hL'), von: g('hV'), bis: g('hB'), thema: g('hT'), ue: U.num(g('hU')), satz: U.num(g('hS')), km: U.num(g('hKm')), notiz: g('hN') });
    HO._k = e.kundeId; return e;
  },
  /* Stundennachweis für Auftraggeber und Monat */
  nachweis(kunde, monat, list) {
    const ctx = PDF.create('form', { title: 'Stundennachweis ' + K.name(kunde), footer: 'Stundennachweis Honorartätigkeit' });
    VL.head(ctx, 'Stundennachweis Honorartätigkeit', `${AC.settings.absender.name} · ${AC.settings.absender.firma}`);
    VL.infoRow(ctx, [['Auftraggeber', K.name(kunde)], ['Zeitraum', HO.monatText(monat)], ['Dozent', AC.settings.absender.name]]);
    PDF.table(ctx, ['Datum', 'Zeit', 'Thema / Maßnahme', 'UE', 'km'], list.map(e => [U.de(e.datum), e.von ? `${e.von}–${e.bis} Uhr` : '', e.thema + (e.notiz ? '\n' + e.notiz : ''), U.nf(U.num(e.ue)), e.km ? U.nf(U.num(e.km)) : '']),
      { size: 9.5, at: { columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 3: { cellWidth: 14, halign: 'right' }, 4: { cellWidth: 14, halign: 'right' } } } });
    const ue = list.reduce((s, e) => s + U.num(e.ue), 0), km = list.reduce((s, e) => s + U.num(e.km), 0);
    PDF.table(ctx, null, [[{ content: 'Summe Unterrichtseinheiten (à 45 Min.)', styles: { fontStyle: 'bold' } }, { content: U.nf(ue), styles: { halign: 'right', fontStyle: 'bold' } }], ...(km ? [['Summe gefahrene km', { content: U.nf(km), styles: { halign: 'right' } }]] : [])],
      { zebra: false, at: { columnStyles: { 1: { cellWidth: 28 } } } });
    PDF.text(ctx, 'Die oben aufgeführten Unterrichtseinheiten wurden erbracht.', { size: 10 });
    const ou = PDF.ou('für den Leistungsnachweis keine Form vorgeschrieben ist');
    PDF.sign(ctx, ['Ort, Datum, Unterschrift Dozent', 'Bestätigung Auftraggeber (Stempel, Unterschrift)'], 16, ou && Object.assign({ i: 0 }, ou));
    return PDF.finish(ctx);
  },
  /* Rechnungsentwurf: je Einsatz eine Position, Fahrtkosten zusammengefasst */
  rechnung(kundeId, list) {
    const km = list.reduce((s, e) => s + U.num(e.km), 0), von = list[0].datum, bis = list[list.length - 1].datum, m = HO.monat(von);
    const pos = list.map(e => ({ bez: e.thema, text: `Unterricht am ${U.de(e.datum)}${e.von ? `, ${e.von}–${e.bis} Uhr` : ''}`, menge: U.num(e.ue), einheit: 'UE', preis: U.num(e.satz) }));
    if (km) pos.push({ bez: 'Fahrtkosten', text: `${list.filter(e => U.num(e.km)).length} Fahrten, insgesamt ${U.nf(km)} km`, menge: km, einheit: 'km', preis: HO.kmSatz() });
    AC.go('rechnungEdit', null, { kundeId, bezug: `Honorartätigkeit ${HO.monat(bis) === m ? HO.monatText(m) : U.de(von) + ' – ' + U.de(bis)} (Stundennachweis anbei)`, leistungVon: von, leistungBis: bis !== von ? bis : '', positionen: pos, einsatzIds: list.map(e => e.id) });
  },
  /* Einsätze aus einem Lehrgang übernehmen: je Lehrgangstag ein Einsatz */
  async ausLehrgang(lgs, items) {
    const r = await AC.dialog('Einsätze aus Lehrgang übernehmen', `<label class="f"><span>Lehrgang</span><select id="hxL">${lgs.map(l => `<option value="${l.id}">${l.id} · ${U.esc(l.titel)}</option>`).join('')}</select></label>
      <label class="f"><span>Auftraggeber</span><select id="hxK">${K.options('')}</select></label>
      <label class="f"><span>Honorar je UE (€)</span><input type="number" step="0.5" id="hxS" value="${HO.satz()}"></label>
      <p class="small muted">Je Lehrgangstag wird ein Einsatz angelegt. Die UE je Tag kommen aus dem Lehrgangsplan, sonst gleichmäßig aus den UE des Lehrgangs. Tage, die schon erfasst sind, werden übersprungen.</p>`, [['Abbrechen', null, 'light'], ['Übernehmen', 'ok']], 'small');
    if (r !== 'ok') return 0; const lg = lgs.find(l => l.id === document.getElementById('hxL').value), kid = document.getElementById('hxK').value || lg.kundeId, satz = U.num(document.getElementById('hxS').value);
    if (!kid) { AC.toast('Bitte einen Auftraggeber wählen', true); return 0; }
    const tage = LG.tage(lg), z = (lg.zeiten || '').match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/), proTag = tage.length ? U.num(lg.ue) / tage.length : 0; let n = 0;
    tage.forEach(d => { if (items.some(e => e.lehrgangId === lg.id && e.datum === d)) return; const p = lg.plan && lg.plan.tage.find(t => t.datum === d);
      items.push({ id: U.uid(), kundeId: kid, datum: d, von: z ? z[1].padStart(5, '0') : '', bis: z ? z[2].padStart(5, '0') : '', thema: lg.titel, lehrgangId: lg.id, ue: p ? U.num(p.ue) : Math.round(proTag * 2) / 2, satz, km: 0, notiz: '', rechnungNr: '' }); n++; });
    await HO.save(items); return n;
  },
};

/* Rechnung festschreiben → Einsätze als abgerechnet markieren */
(() => { const orig = R.finalize; R.finalize = async function (d) { const r = await orig.call(this, d);
  if (r && Array.isArray(r.einsatzIds) && r.einsatzIds.length) { const items = await HO.load(); items.forEach(e => { if (r.einsatzIds.includes(e.id)) e.rechnungNr = r.nr; }); await HO.save(items); }
  return r; }; })();

AC.views.honorar = async (v, filter) => {
  await K.load(); const lgs = await LG.loadAll(); let items = await HO.load();
  const f = Object.assign({ kundeId: '', monat: HO.monat(U.today()), offen: false }, filter || {});
  const draw = () => {
    AC.head('Honorar-Einsätze', 'Einsätze als Honorardozent · Stundennachweis · Rechnung · Ablage: Ordner „honorar“',
      '<button class="btn ghost" id="hLg">Aus Lehrgang übernehmen</button><button class="btn light" id="hNeu">+ Einsatz</button>');
    const list = items.filter(e => (!f.kundeId || e.kundeId === f.kundeId) && (!f.monat || HO.monat(e.datum) === f.monat) && (!f.offen || !e.rechnungNr));
    const offen = list.filter(e => !e.rechnungNr), sum = l => l.reduce((s, e) => s + HO.betrag(e), 0);
    const monate = [...new Set(items.map(e => HO.monat(e.datum)).concat(HO.monat(U.today())))].sort().reverse();
    v.innerHTML = `<div class="card"><div class="grid g4">
        <label class="f" style="grid-column:span 2"><span>Auftraggeber</span><select id="fK">${K.options(f.kundeId).replace('– Kunde wählen –', '– alle –')}</select></label>
        <label class="f"><span>Monat</span><select id="fM"><option value="">alle</option>${monate.map(m => `<option value="${m}"${m === f.monat ? ' selected' : ''}>${HO.monatText(m)}</option>`).join('')}</select></label>
        <div class="checks" style="align-self:end;grid-template-columns:1fr"><label><input type="checkbox" id="fO"${f.offen ? ' checked' : ''}> nur nicht abgerechnete</label></div></div></div>
      <div class="grid g4" style="margin-bottom:18px"><div class="kpi"><b>${list.length}</b><span>Einsätze</span></div><div class="kpi"><b>${U.nf(list.reduce((s, e) => s + U.num(e.ue), 0))}</b><span>Unterrichtseinheiten</span></div>
        <div class="kpi"><b>${U.eur(sum(list))}</b><span>Honorar (ohne Fahrtkosten)</span></div><div class="kpi ${offen.length ? 'warn' : ''}"><b>${U.eur(sum(offen))}</b><span>${offen.length} noch nicht abgerechnet</span></div></div>
      ${list.length ? `<div class="tw"><table class="t"><thead><tr><th>Datum</th><th>Auftraggeber</th><th>Thema</th><th class="num">UE</th><th class="num">Satz</th><th class="num">Betrag</th><th class="num">km</th><th>Rechnung</th><th></th></tr></thead><tbody>
        ${list.map(e => `<tr class="click" data-e="${e.id}"><td>${U.de(e.datum)}<div class="small muted">${e.von ? e.von + '–' + e.bis : ''}</div></td><td>${U.esc(K.name(K.get(e.kundeId)))}</td><td>${U.esc(e.thema)}${e.lehrgangId ? `<div class="small muted">${e.lehrgangId}</div>` : ''}</td>
          <td class="num">${U.nf(U.num(e.ue))}</td><td class="num">${U.eur(U.num(e.satz))}</td><td class="num">${U.eur(HO.betrag(e))}</td><td class="num">${e.km ? U.nf(e.km) : ''}</td>
          <td>${e.rechnungNr ? `<span class="badge bezahlt">${U.esc(e.rechnungNr)}</span>` : '<span class="badge offen">offen</span>'}</td><td><button class="x" data-del="${e.id}" title="löschen">✕</button></td></tr>`).join('')}</tbody></table></div>
        <div class="card" style="margin-top:14px"><h2>Abrechnen</h2>${f.kundeId ? `<p class="small">${offen.length} nicht abgerechnete Einsätze für ${U.esc(K.name(K.get(f.kundeId)))} im gewählten Zeitraum.</p>
          <div class="row"><button class="btn light" id="hNw">Stundennachweis (PDF)</button><button class="btn" id="hRe"${offen.length ? '' : ' disabled'}>Rechnung aus ${offen.length} Einsätzen erstellen</button></div>
          <p class="small muted">Die Rechnung wird als Entwurf geöffnet. Erst beim Erstellen der Rechnung werden die Einsätze als abgerechnet markiert.</p>` : '<p class="muted">Zum Abrechnen oben einen Auftraggeber wählen.</p>'}</div>`
        : '<div class="card empty">Keine Einsätze für diese Auswahl. Mit „+ Einsatz“ erfasst du einen Unterrichtstag.</div>'}`;
    const q = s => v.querySelector(s);
    q('#fK').onchange = () => { f.kundeId = q('#fK').value; draw(); }; q('#fM').onchange = () => { f.monat = q('#fM').value; draw(); }; q('#fO').onchange = () => { f.offen = q('#fO').checked; draw(); };
    document.getElementById('hNeu').onclick = async () => { const e = await HO.dialog(null, lgs); if (e) { items.push(e); await HO.save(items); AC.toast('Einsatz gespeichert'); f.monat = HO.monat(e.datum); draw(); } };
    document.getElementById('hLg').onclick = async () => { if (!lgs.length) return AC.toast('Noch keine Lehrgänge vorhanden', true); const n = await HO.ausLehrgang(lgs, items); if (n) { AC.toast(`${n} Einsätze übernommen`); f.monat = ''; draw(); } };
    v.querySelectorAll('[data-e]').forEach(t => t.onclick = async () => { const e = items.find(x => x.id === t.dataset.e); if (await HO.dialog(e, lgs)) { await HO.save(items); draw(); } });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const e = items.find(x => x.id === b.dataset.del);
      if (!await AC.confirm('Einsatz löschen?', `${U.de(e.datum)} · ${U.esc(e.thema)}${e.rechnungNr ? '<br>Achtung: bereits mit ' + U.esc(e.rechnungNr) + ' abgerechnet.' : ''}`, 'Löschen')) return; items = items.filter(x => x !== e); await HO.save(items); draw(); });
    if (q('#hNw')) q('#hNw').onclick = async () => { const l = list.filter(e => e.kundeId === f.kundeId); if (!l.length) return AC.toast('Keine Einsätze', true);
      const doc = HO.nachweis(K.get(f.kundeId), f.monat, l), name = `Stundennachweis_${U.slug(K.name(K.get(f.kundeId)))}_${f.monat || 'alle'}.pdf`; await FS.write('honorar/' + name, doc.output('blob')); AC.toast('Abgelegt: honorar/' + name); AC.preview(doc, name); };
    if (q('#hRe')) q('#hRe').onclick = () => HO.rechnung(f.kundeId, offen);
  };
  draw();
};
