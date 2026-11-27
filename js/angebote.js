/* =====================================================================
   AC Office – Angebote (angebote.js)
   Ablage: angebote/AN-2026-0001.json  +  angebote/AN-2026-0001_Kunde.pdf
   Ablauf: Angebot → versendet → angenommen → „In Rechnung übernehmen“
   ===================================================================== */
'use strict';
const AN = AC.AN = {
  STATUS: ['Entwurf', 'versendet', 'angenommen', 'abgelehnt', 'abgerechnet'],
  async loadAll() { return (await FS.readAll('angebote')).sort((a, b) => b.nr.localeCompare(a.nr)); },
  blank() {
    const s = AC.settings;
    return { nr: '', status: 'Entwurf', kundeId: '', datum: U.today(), gueltigBis: U.addDays(U.today(), s.angebotGueltig || 30), termin: '', bezug: '',
      einleitung: s.texte.angebotEinleitung, schluss: s.texte.angebotSchluss, positionen: [], kleinunternehmer: s.steuer.kleinunternehmer, ustSatz: s.steuer.ustSatz, summen: { netto: 0, ust: 0, brutto: 0 } };
  },
  abgelaufen: a => ['Entwurf', 'versendet'].includes(a.status) && a.gueltigBis < U.today(),
  badge(a) { const c = { Entwurf: 'entwurf', versendet: 'offen', angenommen: 'bezahlt', abgelehnt: 'storniert', abgerechnet: 'bezahlt' }[a.status] || '';
    return AN.abgelaufen(a) ? '<span class="badge ueber">abgelaufen</span>' : `<span class="badge ${c}">${U.esc(a.status)}</span>`; },
  pdfName: a => `${a.nr}_${U.slug(K.name(a.kunde || K.get(a.kundeId)))}.pdf`,
  async save(a) { if (!a.nr) a.nr = await AC.nextNr('angebot', 'AN', 4, 'angebote'); R.calc(a); const d = Object.assign({}, a); delete d._file; await FS.writeJSON(`angebote/${a.nr}.json`, d); },
  pdf: a => PDF.fit(() => AN._pdf(a)),
  _pdf(a) {
    const k = a.kunde || K.get(a.kundeId) || {}, ctx = PDF.create('letter', { title: 'Angebot ' + (a.nr || '') });
    const info = [['Angebotsnr.', a.nr || 'ENTWURF'], ['Datum', U.de(a.datum)], ['Kundennr.', k.id || ''], ['Gültig bis', U.de(a.gueltigBis)]];
    if (a.termin) info.push(['Termin', a.termin]);
    PDF.letter(ctx, PDF.empf(k), info, `Angebot ${a.nr || ''}${a.bezug ? ' – ' + a.bezug : ''}`);
    PDF.text(ctx, PDF.anrede(k), { after: 2 }); PDF.text(ctx, a.einleitung, { after: 4 });
    PDF.positions(ctx, a.positionen); PDF.sums(ctx, a, { label: 'Angebotssumme' });
    PDF.text(ctx, `Dieses Angebot ist gültig bis zum ${U.de(a.gueltigBis)}. Zur Beauftragung genügt eine kurze Bestätigung per E-Mail.`, { size: 10.5, after: 3 });
    if (a.schluss) PDF.text(ctx, a.schluss, { after: 4 });
    PDF.gruss(ctx); return PDF.finish(ctx);
  },
};

/* ---------- Liste ---------- */
AC.views.angebote = async (v) => {
  await K.load(); const all = await AN.loadAll();
  AC.head('Angebote', 'Ablage: Ordner „angebote“ (Daten + PDF)', `<button class="btn ghost" id="aNeu">+ Neues Angebot</button>`);
  document.getElementById('aNeu').onclick = () => AC.go('angebot');
  const offen = all.filter(a => ['Entwurf', 'versendet'].includes(a.status) && !AN.abgelaufen(a));
  v.innerHTML = `<div class="grid g3" style="margin-bottom:18px">
      <div class="kpi"><b>${offen.length}</b><span>offene Angebote · ${U.eur(offen.reduce((s, a) => s + a.summen.brutto, 0))}</span></div>
      <div class="kpi"><b>${all.filter(a => a.status === 'angenommen').length}</b><span>angenommen, noch nicht abgerechnet</span></div>
      <div class="kpi"><b>${all.length ? Math.round(all.filter(a => ['angenommen', 'abgerechnet'].includes(a.status)).length / all.length * 100) : 0} %</b><span>Annahmequote</span></div></div>
    ${all.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Datum</th><th>Kunde</th><th>Bezug</th><th class="num">Summe</th><th>gültig bis</th><th>Status</th></tr></thead><tbody>
    ${all.map(a => `<tr class="click" data-a="${a.nr}"><td><b>${a.nr}</b></td><td>${U.de(a.datum)}</td><td>${U.esc(K.name(a.kunde || K.get(a.kundeId)))}</td><td>${U.esc(a.bezug)}</td><td class="num">${U.eur(a.summen.brutto)}</td><td>${U.de(a.gueltigBis)}</td><td>${AN.badge(a)}${a.rechnungNr ? ' → ' + a.rechnungNr : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="card empty">Noch keine Angebote. Mit „+ Neues Angebot“ legst du das erste an – Positionen kommen aus deinem Leistungskatalog.</div>'}`;
  v.querySelectorAll('[data-a]').forEach(t => t.onclick = () => AC.go('angebot', t.dataset.a));
};

/* ---------- Bearbeiten ---------- */
AC.views.angebot = async (v, nr, preset) => {
  await K.load();
  const a = nr ? await FS.readJSON(`angebote/${nr}.json`) : Object.assign(AN.blank(), preset || {}); if (!a) { v.innerHTML = '<div class="empty">Nicht gefunden.</div>'; return; }
  const F = AC.F;
  const head = () => AC.head(a.nr ? `Angebot ${a.nr}` : 'Neues Angebot', a.kundeId ? K.name(K.get(a.kundeId)) : 'Kunde wählen und Positionen zusammenstellen',
    `<button class="btn ghost" id="aBack">← Liste</button><button class="btn ghost" id="aSave">Speichern</button><button class="btn ghost" id="aPrev">Vorschau</button><button class="btn light" id="aPdf">PDF erstellen und ablegen</button>`);
  const draw = () => {
    head();
    v.innerHTML = `
    <div class="card"><h2>① Kunde und Kopfdaten</h2><div class="grid g4">
      <label class="f" style="grid-column:span 2"><span>Kunde *</span><select data-p="kundeId">${K.options(a.kundeId)}</select></label>
      ${F.input('Angebotsdatum', 'datum', a.datum, { type: 'date' })}${F.input('Gültig bis', 'gueltigBis', a.gueltigBis, { type: 'date' })}
      ${F.input('Bezug (z. B. Inhouse-Schulung Werkschutz)', 'bezug', a.bezug, { span: 2 })}${F.input('Geplanter Termin (optional)', 'termin', a.termin)}
      ${F.select('Status', 'status', a.status, AN.STATUS)}</div></div>
    <div class="card"><h2>② Einleitung</h2>${F.area('', 'einleitung', a.einleitung, { rows: 2 })}</div>
    <div class="card"><h2>③ Positionen</h2>${AC.LD ? AC.LD.angebotChips(a) : ''}${AC.PosEd.html(a)}</div>
    <div class="card"><h2>④ Schlusstext</h2>${F.area('', 'schluss', a.schluss, { rows: 2 })}</div>
    ${a.nr ? `<div class="card"><h2>Weiter zur Rechnung</h2><p class="small muted">Übernimmt Kunde, Bezug und alle Positionen in einen neuen Rechnungsentwurf. Nach dem Erstellen der Rechnung steht das Angebot automatisch auf „abgerechnet“.</p>
      <div class="row"><button class="btn" id="aRe"${a.rechnungNr ? ' disabled' : ''}>In Rechnung übernehmen</button>${a.rechnungNr ? `<span>abgerechnet mit <a href="#" id="aReLink">${a.rechnungNr}</a></span>` : ''}
      ${AC.LD ? '<button class="btn light" id="aLg" title="Neuen Lehrgang mit Kunde, Titel und UE aus diesem Angebot anlegen">🎓 Lehrgang aus Angebot anlegen</button>' : ''}${a.pdf ? `<button class="btn light" id="aOpen">Abgelegtes PDF öffnen</button>` : ''}</div></div>` : ''}`;
    F.bind(v, a, p => { if (p === 'kundeId') draw(); else AC.PosEd.totals(v, a); });
    AC.PosEd.bind(v, a, draw); AC.PosEd.totals(v, a); if (AC.LD) AC.LD.angebotBind(v, a, draw);
    const q = id => document.getElementById(id);
    q('aBack').onclick = () => AC.go('angebote');
    q('aSave').onclick = async () => { if (!a.kundeId) return AC.toast('Bitte einen Kunden wählen', true); await AN.save(a); AC.toast(`Gespeichert: angebote/${a.nr}.json`); AC.go('angebot', a.nr); };
    q('aPrev').onclick = () => { R.calc(a); AC.preview(AN.pdf(Object.assign(U.clone(a), { kunde: K.get(a.kundeId) })), 'Vorschau Angebot'); };
    q('aPdf').onclick = async () => {
      if (!a.kundeId || !a.positionen.length) return AC.toast('Bitte Kunde und mindestens eine Position angeben', true);
      a.kunde = K.snapshot(K.get(a.kundeId)); await AN.save(a); if (a.status === 'Entwurf') a.status = 'versendet';
      const doc = AN.pdf(a); a.pdf = AN.pdfName(a); await FS.write('angebote/' + a.pdf, doc.output('blob')); await AN.save(a);
      AC.toast('Abgelegt: angebote/' + a.pdf); await AC.preview(doc, 'Angebot ' + a.nr); AC.go('angebot', a.nr);
    };
    if (q('aRe')) q('aRe').onclick = async () => { a.status = 'angenommen'; await AN.save(a);
      AC.go('rechnungEdit', null, { kundeId: a.kundeId, bezug: a.bezug || 'Angebot ' + a.nr, positionen: U.clone(a.positionen), angebotNr: a.nr, einleitung: `gemäß meinem Angebot ${a.nr} vom ${U.de(a.datum)} erlaube ich mir, Ihnen Folgendes in Rechnung zu stellen:` }); };
    if (q('aReLink')) q('aReLink').onclick = e => { e.preventDefault(); AC.go('rechnung', a.rechnungNr); };
    if (q('aOpen')) q('aOpen').onclick = () => FS.open('angebote/' + a.pdf).catch(() => AC.toast('PDF nicht gefunden', true));
  };
  draw();
};
