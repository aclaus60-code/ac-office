/* =====================================================================
   AC Office – Mahnwesen (mahnwesen.js)
   Zahlungserinnerung → 1. Mahnung → Letzte Mahnung → Datenblatt Mahnbescheid
   Ablage: mahnungen/RE-2026-0001_Zahlungserinnerung_2026-11-24.pdf
   Rechtsgrundlagen: §§ 286, 288 BGB (Verzug, Verzugszinsen, 40-€-Pauschale)
   ===================================================================== */
'use strict';
const M = AC.M = {
  zinssatz: (k) => AC.settings.mahnung.basiszins + (K.b2b(k) ? 9 : 5),
  /* Vorschlag für den Verzugsbeginn:
     § 286 Abs. 3 BGB: spätestens 30 Tage nach Fälligkeit und Zugang der Rechnung
     § 286 Abs. 1 BGB: mit Zugang einer Mahnung nach Fälligkeit (hier: Mahndatum + 3 Tage Postlaufzeit) */
  verzugVorschlag(r) {
    const c = [U.addDays(r.faellig, 31)];
    const first = (r.mahnungen || []).find(m => m.datum > r.faellig); if (first) c.push(U.addDays(first.datum, 4));
    return c.sort()[0];
  },
  naechsteStufe(r) { const st = AC.settings.mahnung.stufen; const n = (r.mahnungen || []).length; return Math.min(n, st.length - 1); },
  /* Forderungsaufstellung zu einem Mahndatum */
  rechnen(r, o) {
    const k = r.kunde, offen = R.offen(r), out = { zeilen: [], gesamt: 0, zinsen: 0, tage: 0, satz: M.zinssatz(k) };
    out.zeilen.push([`Rechnung ${r.nr} vom ${U.de(r.datum)} (fällig am ${U.de(r.faellig)})`, r.summen.brutto]);
    const gez = R.gezahlt(r); if (gez > 0) out.zeilen.push(['abzüglich bereits geleisteter Zahlungen', -gez]);
    if (o.zinsen && o.verzugSeit && o.verzugSeit < o.datum) {
      out.tage = U.days(o.verzugSeit, o.datum); out.zinsen = U.r2(offen * out.satz / 100 * out.tage / 365);
      out.zeilen.push([`Verzugszinsen ${U.nf(out.satz)} % p. a. (${K.b2b(k) ? '9' : '5'} Prozentpunkte über dem Basiszinssatz von ${U.nf(AC.settings.mahnung.basiszins)} %, § 288 Abs. ${K.b2b(k) ? '2' : '1'} BGB) vom ${U.de(o.verzugSeit)} bis ${U.de(o.datum)} (${out.tage} Tage)`, out.zinsen]);
    }
    const pausch = K.b2b(k) && (o.pauschale || (r.mahnungen || []).some(m => m.pauschale)) && o.verzugSeit && o.verzugSeit <= o.datum;
    if (pausch) out.zeilen.push(['Verzugspauschale nach § 288 Abs. 5 BGB', 40]);
    const geb = U.r2((r.mahnungen || []).reduce((s, m) => s + (m.gebuehr || 0), 0) + U.num(o.gebuehr));
    if (geb > 0) out.zeilen.push(['Mahnkosten (Porto und Material)', geb]);
    out.pauschale = !!pausch; out.gesamt = U.r2(out.zeilen.reduce((s, z) => s + z[1], 0));
    return out;
  },
  /* PDF der Mahnung – passt automatisch auf eine Seite */
  pdf: (r, o, calc) => PDF.fit(() => M._pdf(r, o, calc)),
  _pdf(r, o, calc) {
    const s = AC.settings, st = o.stufe, k = r.kunde;
    const ctx = PDF.create('letter', { title: `${st.titel} ${r.nr}` }), { doc } = ctx;
    PDF.letter(ctx, PDF.empf(k), [['Datum', U.de(o.datum)], ['Kundennr.', k.id || ''], ['Rechnungsnr.', r.nr], ['Rechnungsdatum', U.de(r.datum)]],
      `${st.titel} – Rechnung ${r.nr} vom ${U.de(r.datum)}`);
    PDF.text(ctx, PDF.anrede(k), { after: 2 });
    const txt = o.text.replace(/\{frist\}/g, U.de(o.frist)).replace(/\{verzug\}/g, U.de(o.verzugSeit)).replace(/\{nr\}/g, r.nr).replace(/\{betrag\}/g, U.eur(calc.gesamt));
    PDF.text(ctx, txt, { after: 4 });
    PDF.table(ctx, ['Forderung', 'Betrag'], [...calc.zeilen.map(z => [z[0], U.eur(z[1])]), [{ content: 'Zu zahlender Gesamtbetrag', styles: { fontStyle: 'bold' } }, { content: U.eur(calc.gesamt), styles: { fontStyle: 'bold' } }]],
      { at: { columnStyles: { 1: { cellWidth: 32, halign: 'right' } }, didParseCell: d => { if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'right'; if (d.section === 'body' && d.row.index === calc.zeilen.length) d.cell.styles.fillColor = PDF.C.input; } } });
    PDF.payBlock(ctx, `Bitte überweisen Sie den Gesamtbetrag von ${U.eur(calc.gesamt)} bis spätestens ${U.de(o.frist)} auf das unten genannte Konto. Verwendungszweck: ${r.nr}.`,
      { name: s.absender.name, iban: s.bank.iban, bic: s.bank.bic, amount: calc.gesamt, ref: r.nr });
    PDF.gruss(ctx);
    return PDF.finish(ctx);
  },
  /* Datenblatt zur Übertragung in den Online-Mahnantrag (eine Seite) */
  datenblatt: r => PDF.fit(() => M._datenblatt(r)),
  _datenblatt(r) {
    const s = AC.settings, a = s.absender, k = r.kunde, last = (r.mahnungen || []).at(-1) || {};
    const calc = M.rechnen(r, { datum: U.today(), zinsen: false, verzugSeit: last.verzugSeit, pauschale: false, gebuehr: 0 });
    const ctx = PDF.create('report', { title: 'Datenblatt Mahnbescheid ' + r.nr, footer: 'Datenblatt Mahnbescheid' });
    ctx.y = 38; PDF.h(ctx, `Datenblatt für den Antrag auf Erlass eines Mahnbescheids`, { size: 15 });
    PDF.text(ctx, `Zusammenstellung der Angaben zur Rechnung ${r.nr} für das Portal www.online-mahnantrag.de. Stand: ${U.de(U.today())}.`, { size: 10, color: PDF.C.grau, after: 4 });
    const t = (title, rows) => { PDF.h(ctx, title, { size: 11.5 }); PDF.table(ctx, null, rows, { at: { columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: PDF.C.input } } }, zebra: false }); };
    t('1. Zuständiges Mahngericht', [['Gericht', s.mahnung.mahngericht || ''], ['Hinweis', 'Zuständig ist das Mahngericht am Sitz des Antragstellers (§ 689 Abs. 2 ZPO).']]);
    t('2. Antragsteller', [['Name / Firma', `${a.name}, ${a.firma}`], ['Anschrift', `${a.strasse}, ${a.plz} ${a.ort}`], ['Bankverbindung', `${s.bank.name}, IBAN ${s.bank.iban}`]]);
    t('3. Antragsgegner', [['Name / Firma', K.name(k)], ['Ansprechpartner', [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ')], ['Anschrift', `${k.strasse}, ${k.plz} ${k.ort}`], ['Rechtsform / Art', K.b2b(k) ? 'Unternehmen (Rechtsform prüfen)' : 'Privatperson (Verbraucher)']]);
    t('4. Hauptforderung', [['Anspruchsbezeichnung', 'Dienstleistungsvertrag'], ['Rechnung', `${r.nr} vom ${U.de(r.datum)}`], ['Offener Betrag', U.eur(R.offen(r))], ['Fällig seit', U.de(r.faellig)]]);
    t('5. Zinsen und Nebenforderungen', [['Laufende Zinsen', `${K.b2b(k) ? 9 : 5} Prozentpunkte über dem jeweiligen Basiszinssatz ab ${U.de(last.verzugSeit || M.verzugVorschlag(r))}`],
      ['Verzugspauschale', K.b2b(k) && (r.mahnungen || []).some(m => m.pauschale) ? '40,00 € (§ 288 Abs. 5 BGB)' : '–'],
      ['Mahnkosten', U.eur((r.mahnungen || []).reduce((x, m) => x + (m.gebuehr || 0), 0))],
      ['Bisherige Mahnungen', (r.mahnungen || []).map(m => `${m.titel} vom ${U.de(m.datum)}`).join('; ') || '–']]);
    PDF.box(ctx, 'Hinweis', 'Der Anspruch muss fällig und unbedingt sein. Für ein streitiges Verfahren ist das Gericht am allgemeinen Gerichtsstand des Antragsgegners anzugeben. Diese Zusammenstellung ersetzt keine Rechtsberatung.');
    return PDF.finish(ctx);
  },
};

/* ---------- Ansicht: Mahnwesen ---------- */
AC.views.mahnwesen = async (v, focusNr) => {
  await K.load();
  const all = (await R.loadAll()).filter(r => r.typ !== 'storno' && r.status === 'offen' && R.offen(r) > 0).sort((a, b) => a.faellig.localeCompare(b.faellig));
  const ueber = all.filter(R.ueberfaellig);
  AC.head('Mahnwesen', `Offene Posten · Basiszinssatz ${U.nf(AC.settings.mahnung.basiszins)} % (seit ${U.de(AC.settings.mahnung.basiszinsAb)})`);
  const alt = U.days(AC.settings.mahnung.basiszinsAb, U.today()) > 183;
  v.innerHTML = `
    <div class="grid g3" style="margin-bottom:18px">
      <div class="kpi"><b>${all.length}</b><span>offene Rechnungen · ${U.eur(all.reduce((s, r) => s + R.offen(r), 0))}</span></div>
      <div class="kpi ${ueber.length ? 'warn' : ''}"><b>${ueber.length}</b><span>überfällig · ${U.eur(ueber.reduce((s, r) => s + R.offen(r), 0))}</span></div>
      <div class="kpi"><b>${U.nf(AC.settings.mahnung.basiszins)} %</b><span>Basiszinssatz (§ 247 BGB)</span></div>
    </div>
    ${alt ? '<div class="card"><p class="hint" style="margin:0">Der Basiszinssatz ändert sich zum 1. Januar und 1. Juli. Bitte den aktuellen Wert der Deutschen Bundesbank unter Einstellungen → Mahnwesen eintragen.</p></div>' : ''}
    <div class="card"><h2>Offene Posten</h2>${all.length ? `<div class="tw"><table class="t"><thead><tr><th>Rechnung</th><th>Kunde</th><th>fällig</th><th class="num">Tage über</th><th class="num">offen</th><th>Letzte Stufe</th><th></th></tr></thead><tbody>
      ${all.map(r => { const d = U.days(r.faellig, U.today()), m = (r.mahnungen || []).at(-1); return `<tr><td><a href="#" data-r="${r.nr}">${r.nr}</a></td><td>${U.esc(K.name(r.kunde))}</td><td>${U.de(r.faellig)}</td>
        <td class="num">${d > 0 ? `<b style="color:var(--rot)">${d}</b>` : '–'}</td><td class="num">${U.eur(R.offen(r))}</td><td>${m ? U.esc(m.titel) + ' · ' + U.de(m.datum) : '–'}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-m="${r.nr}">${U.esc(AC.settings.mahnung.stufen[M.naechsteStufe(r)].titel)} …</button>
        ${(r.mahnungen || []).length >= AC.settings.mahnung.stufen.length ? `<button class="btn sm light" data-mb="${r.nr}">Datenblatt Mahnbescheid</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty">Keine offenen Rechnungen. 👍</div>'}</div>
    <div class="card"><h2>So läuft das Mahnverfahren</h2><ol class="small" style="margin:0;padding-left:18px">
      <li><b>Zahlungserinnerung</b> nach Ablauf des Zahlungsziels – freundlich, ohne Kosten. Ab Zugang beginnt der Verzug (§ 286 Abs. 1 BGB), spätestens aber 30 Tage nach Fälligkeit und Zugang der Rechnung (§ 286 Abs. 3 BGB).</li>
      <li><b>1. Mahnung</b> mit Verzugszinsen: Verbraucher 5, Unternehmen 9 Prozentpunkte über dem Basiszinssatz (§ 288 Abs. 1 und 2 BGB), bei Unternehmen zusätzlich 40 € Pauschale (§ 288 Abs. 5 BGB).</li>
      <li><b>Letzte Mahnung</b> mit Ankündigung des gerichtlichen Mahnverfahrens.</li>
      <li><b>Datenblatt Mahnbescheid</b>: alle Angaben für www.online-mahnantrag.de (Mahngericht: ${U.esc(AC.settings.mahnung.mahngericht || '')}).</li></ol>
      <p class="small muted" style="margin-bottom:0">Mahnkosten: nur tatsächliche Kosten (z. B. Porto) ansetzen. Die Kosten der ersten, verzugsbegründenden Mahnung sind nicht erstattungsfähig.</p></div>`;
  v.querySelectorAll('[data-r]').forEach(a => a.onclick = e => { e.preventDefault(); AC.go('rechnung', a.dataset.r); });
  v.querySelectorAll('[data-m]').forEach(b => b.onclick = () => AC.mahnDialog(all.find(r => r.nr === b.dataset.m)));
  v.querySelectorAll('[data-mb]').forEach(b => b.onclick = async () => { const r = all.find(x => x.nr === b.dataset.mb); const doc = M.datenblatt(r);
    await AC.preview(doc, 'Datenblatt Mahnbescheid', async () => { const f = `${r.nr}_Datenblatt-Mahnbescheid_${U.today()}.pdf`; await FS.write('mahnungen/' + f, doc.output('blob')); AC.toast('Abgelegt: mahnungen/' + f); }); });
  if (focusNr) { const r = all.find(x => x.nr === focusNr); if (r) AC.mahnDialog(r); }
};

/* Dialog: Mahnung zusammenstellen */
AC.mahnDialog = async (r) => {
  const st = AC.settings.mahnung.stufen, idx = M.naechsteStufe(r), b2b = K.b2b(r.kunde);
  const o = { stufeIdx: idx, datum: U.today(), verzugSeit: (r.mahnungen || []).at(-1)?.verzugSeit || M.verzugVorschlag(r) };
  const setStufe = i => { const s = st[i]; o.stufeIdx = i; o.stufe = s; o.text = s.text; o.frist = U.addDays(o.datum, s.frist); o.gebuehr = s.gebuehr; o.zinsen = s.zinsen; o.pauschale = s.pauschale && b2b; };
  setStufe(idx);
  const d = document.getElementById('dlg'); d.className = '';
  const body = () => {
    const c = M.rechnen(r, o);
    return `<div class="grid g4">
      <label class="f"><span>Stufe</span><select id="mStufe">${st.map((s, i) => `<option value="${i}"${i === o.stufeIdx ? ' selected' : ''}>${U.esc(s.titel)}</option>`).join('')}</select></label>
      <label class="f"><span>Datum</span><input type="date" id="mDat" value="${o.datum}"></label>
      <label class="f"><span>Neue Zahlungsfrist</span><input type="date" id="mFrist" value="${o.frist}"></label>
      <label class="f"><span>Verzug seit</span><input type="date" id="mVerz" value="${o.verzugSeit}"></label></div>
      <p class="small muted">Vorschlag Verzugsbeginn: ${U.de(M.verzugVorschlag(r))} (frühester Zeitpunkt aus § 286 Abs. 3 BGB oder Zugang der ersten Mahnung). Kunde: ${b2b ? 'Unternehmen – Zinssatz Basiszins + 9 Prozentpunkte' : 'Verbraucher – Zinssatz Basiszins + 5 Prozentpunkte, keine Pauschale'}.</p>
      <div class="row" style="margin:8px 0 12px"><label class="row small"><input type="checkbox" id="mZins"${o.zinsen ? ' checked' : ''}> Verzugszinsen berechnen</label>
      ${b2b ? `<label class="row small"><input type="checkbox" id="mPau"${o.pauschale ? ' checked' : ''}> 40-€-Pauschale (§ 288 Abs. 5 BGB)</label>` : ''}
      <label class="row small">Mahnkosten € <input type="number" step="0.01" id="mGeb" value="${o.gebuehr}" style="width:90px"></label></div>
      <label class="f"><span>Text (Platzhalter: {frist}, {verzug}, {nr}, {betrag})</span><textarea id="mText" rows="4">${U.esc(o.text)}</textarea></label>
      <table class="t" style="margin-top:12px"><tbody>${c.zeilen.map(z => `<tr><td>${U.esc(z[0])}</td><td class="num">${U.eur(z[1])}</td></tr>`).join('')}</tbody><tfoot><tr><td>Gesamtforderung</td><td class="num">${U.eur(c.gesamt)}</td></tr></tfoot></table>`;
  };
  const render = () => {
    d.querySelector('.db').innerHTML = body();
    const q = id => d.querySelector('#' + id);
    q('mStufe').onchange = e => { setStufe(+e.target.value); render(); };
    q('mDat').onchange = e => { o.datum = e.target.value; o.frist = U.addDays(o.datum, o.stufe.frist); render(); };
    q('mFrist').onchange = e => { o.frist = e.target.value; };
    q('mVerz').onchange = e => { o.verzugSeit = e.target.value; render(); };
    q('mZins').onchange = e => { o.zinsen = e.target.checked; render(); };
    if (q('mPau')) q('mPau').onchange = e => { o.pauschale = e.target.checked; render(); };
    q('mGeb').onchange = e => { o.gebuehr = U.num(e.target.value); render(); };
    q('mText').oninput = e => { o.text = e.target.value; };
  };
  d.innerHTML = `<div class="dh"><h2>Mahnung – ${U.esc(r.nr)} · ${U.esc(K.name(r.kunde))}</h2></div><div class="db"></div>
    <div class="df"><button class="btn light" data-a="close">Abbrechen</button><button class="btn light" data-a="prev">Vorschau</button><button class="btn" data-a="save">Erstellen und ablegen</button></div>`;
  render(); d.showModal();
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a; if (a === 'close') return d.close();
    const calc = M.rechnen(r, o), doc = M.pdf(r, o, calc);
    if (a === 'prev') { d.close(); await AC.preview(doc, 'Vorschau ' + o.stufe.titel); return AC.mahnDialog(r); }
    const file = `${r.nr}_${U.slug(o.stufe.titel)}_${o.datum}.pdf`;
    await FS.write('mahnungen/' + file, doc.output('blob'));
    r.mahnungen = r.mahnungen || [];
    r.mahnungen.push({ stufe: o.stufe.key, titel: o.stufe.titel, datum: o.datum, frist: o.frist, verzugSeit: o.verzugSeit, zinsen: calc.zinsen, pauschale: calc.pauschale, gebuehr: U.num(o.gebuehr), gesamt: calc.gesamt, datei: file });
    const clean = Object.assign({}, r); delete clean._file; await R.save(clean);
    d.close(); AC.toast(`${o.stufe.titel} abgelegt: mahnungen/${file}`);
    await AC.preview(doc, o.stufe.titel + ' erstellt'); AC.go('mahnwesen');
  });
};
