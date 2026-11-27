/* =====================================================================
   AC Office – Ausgaben und Einnahmen-Überschuss-Übersicht (ausgaben.js)
   Ausgaben:   ausgaben/2026/A-2026-0001.json   Belege: ausgaben/2026/belege/
   Auswertung: auswertungen/EUER-Uebersicht_2026.pdf, Einnahmen_2026.csv, Ausgaben_2026.csv
   Grundsatz: Zufluss-/Abflussprinzip (§ 11 EStG) – maßgeblich ist das Zahlungsdatum.
   Hilfsübersicht – ersetzt nicht die Anlage EÜR und keine Steuerberatung.
   ===================================================================== */
'use strict';
const AU = AC.AU = {
  KAT: ['Fahrtkosten (Kilometerpauschale)', 'Fahrtkosten (Tickets, Parken)', 'Büromaterial', 'Fachliteratur', 'Software / Abos', 'Telefon / Internet', 'Fortbildung',
    'Werbung / Website', 'Versicherungen / Beiträge', 'Arbeitsmittel / Geräte', 'Schulungsmaterial', 'Porto / Versand', 'Bewirtung', 'Sonstiges'],
  KM: 0.30, // € je gefahrenem km (Dienstreise mit Privat-Pkw)
  ZA: ['Überweisung', 'Karte', 'bar', 'PayPal', 'Lastschrift'],
  async loadYear(y) { return (await FS.readAll(`ausgaben/${y}`)).sort((a, b) => (b.bezahlt || b.datum).localeCompare(a.bezahlt || a.datum)); },
  async years() { const ys = new Set([String(new Date().getFullYear())]); try { for await (const [n, h] of (await FS.dir('ausgaben')).entries()) if (h.kind === 'directory' && /^\d{4}$/.test(n)) ys.add(n); } catch (e) { /* leer */ }
    (await R.loadAll()).forEach(r => (r.zahlungen || []).forEach(z => ys.add(z.datum.slice(0, 4)))); return [...ys].sort().reverse(); },
  blank: () => ({ nr: '', datum: U.today(), bezahlt: U.today(), lieferant: '', beschreibung: '', kategorie: 'Büromaterial', betrag: 0, ustSatz: 19, km: 0, zahlungsart: 'Karte', beleg: '', notiz: '' }),
  async save(a) { if (!a.nr) a.nr = await AC.nextNr('ausgabe', 'A', 4); const y = (a.bezahlt || a.datum).slice(0, 4);
    if (a._jahr && a._jahr !== y) await FS.remove(`ausgaben/${a._jahr}/${a.nr}.json`);
    const d = Object.assign({}, a); delete d._file; delete d._jahr; await FS.writeJSON(`ausgaben/${y}/${a.nr}.json`, d); },
  /* Einnahmen = Zahlungseingänge auf Rechnungen im Jahr */
  async einnahmen(y) { const out = []; (await R.loadAll()).forEach(r => (r.zahlungen || []).forEach(z => { if (z.datum.startsWith(y)) out.push({ datum: z.datum, betrag: U.num(z.betrag), nr: r.nr, kunde: K.name(r.kunde) }); }));
    return out.sort((a, b) => a.datum.localeCompare(b.datum)); },
  async daten(y) {
    const ein = await AU.einnahmen(y), aus = await AU.loadYear(y);
    const mon = Array.from({ length: 12 }, (_, m) => { const p = `${y}-${U.pad(m + 1, 2)}`; const e = ein.filter(x => x.datum.startsWith(p)).reduce((s, x) => s + x.betrag, 0), a = aus.filter(x => (x.bezahlt || x.datum).startsWith(p)).reduce((s, x) => s + U.num(x.betrag), 0); return { m, e, a }; });
    const kat = {}; aus.forEach(x => { kat[x.kategorie] = (kat[x.kategorie] || 0) + U.num(x.betrag); });
    const sumE = U.r2(ein.reduce((s, x) => s + x.betrag, 0)), sumA = U.r2(aus.reduce((s, x) => s + U.num(x.betrag), 0));
    const vor = U.r2((await AU.einnahmen(String(+y - 1))).reduce((s, x) => s + x.betrag, 0));
    return { ein, aus, mon, kat, sumE, sumA, vor, ueberschuss: U.r2(sumE - sumA) };
  },
  csv(rows) { return '﻿' + rows.map(r => r.map(c => { const s = typeof c === 'number' ? U.n2(c).replace(/\./g, '') : String(c ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n'); },
  /* ---------- Unterlagen für Steuerberater / Finanzamt (ZIP) ---------- */
  async paket(y) {
    const d = await AU.daten(y), s = AC.settings, a = s.absender, st = s.steuer, all = await R.loadAll(), enc = new TextEncoder();
    const root = `Steuerunterlagen_${y}_${U.slug(a.name)}/`, files = [], fehlt = [];
    const add = (name, data) => files.push({ name: root + name, data: typeof data === 'string' ? enc.encode(data) : data });
    const bin = async p => new Uint8Array(await (await FS.file(p)).arrayBuffer());
    const kn = r => r.kunde ? K.name(r.kunde) : '';
    // Rechnungen des Jahres (Rechnungsdatum im Jahr oder Zahlung im Jahr)
    const reJ = all.filter(r => (r.datum || '').startsWith(y) || (r.zahlungen || []).some(z => (z.datum || '').startsWith(y))).sort((x, z) => x.nr.localeCompare(z.nr));
    let nRe = 0; for (const r of reJ) { if (!r.pdf) continue; try { add('Rechnungen/' + r.pdf, await bin('rechnungen/' + r.pdf)); nRe++; } catch (e) { fehlt.push(`Rechnung ${r.nr}: PDF nicht im Ordner „rechnungen“ gefunden`); } }
    // Belege der Ausgaben
    let nBel = 0; for (const x of d.aus) {
      if (!x.beleg) { if (!U.num(x.km)) fehlt.push(`Ausgabe ${x.nr} (${x.lieferant || x.beschreibung}, ${U.eur(U.num(x.betrag))}): kein Beleg hinterlegt`); continue; }
      try { add('Belege/' + x.beleg, await bin(`ausgaben/${y}/belege/${x.beleg}`)); nBel++; } catch (e) { fehlt.push(`Ausgabe ${x.nr}: Beleg-Datei ${x.beleg} nicht gefunden`); } }
    // Listen (CSV, mit Excel zu öffnen)
    add(`02_Einnahmen_${y}.csv`, AU.csv([['Zahlungseingang', 'Rechnung', 'Kunde', 'Betrag (EUR)'], ...d.ein.map(e => [U.de(e.datum), e.nr, e.kunde, e.betrag]), ['', '', 'Summe', d.sumE]]));
    const reBuch = all.filter(r => (r.datum || '').startsWith(y)).sort((x, z) => x.nr.localeCompare(z.nr));
    add(`03_Rechnungsausgangsbuch_${y}.csv`, AU.csv([['Rechnungsnr.', 'Datum', 'Art', 'Kunde', 'Netto', 'USt', 'Brutto', 'bezahlt', 'bezahlt am', 'offen', 'PDF'],
      ...reBuch.map(r => { const zs = (r.zahlungen || []); return [r.nr, U.de(r.datum), r.typ === 'storno' ? 'Storno' : 'Rechnung', kn(r), r.summen.netto, r.summen.ust, r.summen.brutto,
        U.r2(zs.reduce((x, z) => x + U.num(z.betrag), 0)), zs.map(z => U.de(z.datum)).join(', '), r.typ === 'storno' ? 0 : R.offen(r), r.pdf || '']; })]));
    add(`04_Ausgaben_${y}.csv`, AU.csv([['Nr.', 'Belegdatum', 'bezahlt am', 'Lieferant', 'Beschreibung', 'Kategorie', 'Betrag (EUR)', 'USt-Satz', 'Zahlungsart', 'km', 'Beleg-Datei'],
      ...d.aus.map(x => [x.nr, U.de(x.datum), U.de(x.bezahlt), x.lieferant, x.beschreibung, x.kategorie, U.num(x.betrag), x.ustSatz, x.zahlungsart, U.num(x.km) || '', x.beleg ? 'Belege/' + x.beleg : 'fehlt']), ['', '', '', '', '', 'Summe', d.sumA]]));
    const fahrten = d.aus.filter(x => U.num(x.km));
    if (fahrten.length) add(`05_Fahrten_${y}.csv`, AU.csv([['Datum', 'Anlass / Strecke', 'km', 'Satz je km', 'Betrag (EUR)'], ...fahrten.map(x => [U.de(x.bezahlt || x.datum), [x.lieferant, x.beschreibung].filter(Boolean).join(' – '), U.num(x.km), AU.KM, U.num(x.betrag)]),
      ['', 'Summe', U.r2(fahrten.reduce((t, x) => t + U.num(x.km), 0)), '', U.r2(fahrten.reduce((t, x) => t + U.num(x.betrag), 0))]]));
    const offen = all.filter(r => r.typ !== 'storno' && r.status === 'offen' && (r.datum || '') <= `${y}-12-31` && R.offen(r) > 0);
    // PDFs
    const info = { nRe, nBel, nFahrt: fahrten.length, fehlt, offen, ohneBeleg: d.aus.filter(x => !x.beleg && !U.num(x.km)).length };
    add(`00_Deckblatt_${y}.pdf`, new Uint8Array(AU.deckblatt(y, d, info).output('arraybuffer')));
    add(`01_EUER-Uebersicht_${y}.pdf`, new Uint8Array(AU.pdf(y, d).output('arraybuffer')));
    add('LIESMICH.txt', [`Unterlagen für die Steuererklärung ${y}`, `${a.name} · ${a.firma}`, `${a.strasse}, ${a.plz} ${a.ort}`, st.steuernummer ? `Steuernummer: ${st.steuernummer}` : '', '',
      'Inhalt:', '00_Deckblatt          Stammdaten, Summen, Hinweise und fehlende Unterlagen', '01_EUER-Uebersicht    Einnahmen und Ausgaben nach Monat und Kategorie',
      '02_Einnahmen          Zahlungseingänge (Zuflussprinzip, § 11 EStG)', '03_Rechnungsausgangsbuch  alle Rechnungen mit Rechnungsdatum im Jahr', '04_Ausgaben           alle Betriebsausgaben mit Verweis auf den Beleg',
      fahrten.length ? '05_Fahrten            Dienstfahrten mit privatem Pkw' : '', 'Rechnungen\\           Ausgangsrechnungen als PDF', 'Belege\\               Eingangsbelege (PDF/Foto)', '',
      'CSV-Dateien: Trennzeichen Semikolon, Dezimalkomma, UTF-8 – lassen sich direkt mit Excel öffnen.', `Erstellt mit AC Office am ${U.de(U.today())}.`].filter(x => x !== '').join('\r\n') + '\r\n');
    const blob = AC.ZIP.build(files), fn = `auswertungen/Steuerunterlagen_${y}.zip`;
    await FS.write(fn, blob);
    const url = URL.createObjectURL(blob), l = document.createElement('a'); l.href = url; l.download = `Steuerunterlagen_${y}_${U.slug(a.name)}.zip`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { n: files.length, fn, fehlt, info, groesse: blob.size };
  },
  deckblatt(y, d, info) { return PDF.fit(() => {
    const s = AC.settings, a = s.absender, st = s.steuer, ctx = PDF.create('report', { title: `Steuerunterlagen ${y}`, footer: `Unterlagen für die Steuererklärung ${y}` });
    VL.head(ctx, `Unterlagen für die Steuererklärung ${y}`, `Gewinnermittlung durch Einnahmenüberschussrechnung (§ 4 Abs. 3 EStG) · Wirtschaftsjahr 01.01.–31.12.${y}`);
    const B = { fontStyle: 'bold', fillColor: [228, 228, 214] };
    PDF.h(ctx, 'Steuerpflichtiger', { size: 11.5, line: false });
    PDF.table(ctx, null, [['Name', `${a.name}`], ['Unternehmen / Tätigkeit', `${a.firma} – ${a.titel}`], ['Anschrift', `${a.strasse}, ${a.plz} ${a.ort}`], ['Steuernummer', st.steuernummer || '— bitte in den Einstellungen eintragen —'],
      ['Finanzamt', st.finanzamt || '—'], ['Umsatzsteuer', st.kleinunternehmer ? 'Kleinunternehmer nach § 19 UStG – keine Umsatzsteuer ausgewiesen, kein Vorsteuerabzug' : 'Regelbesteuerung'],
      ...(st.berater ? [['Steuerberatung', st.berater + (st.beraterMail ? ' · ' + st.beraterMail : '')]] : [])].map(r => [{ content: r[0], styles: B }, r[1]]), { size: 9.5, at: { columnStyles: { 0: { cellWidth: 50 } } } });
    PDF.h(ctx, 'Ergebnis', { size: 11.5, line: false });
    const R2 = { halign: 'right' };
    PDF.table(ctx, null, [[{ content: 'Betriebseinnahmen (Zahlungseingänge)', styles: B }, { content: U.eur(d.sumE), styles: R2 }], [{ content: 'Betriebsausgaben (erfasst)', styles: B }, { content: U.eur(d.sumA), styles: R2 }],
      [{ content: 'Überschuss (vorläufig)', styles: B }, { content: U.eur(d.ueberschuss), styles: Object.assign({ fontStyle: 'bold' }, R2) }]], { size: 10, at: { columnStyles: { 0: { cellWidth: 110 } } } });
    PDF.h(ctx, 'Inhalt des Pakets', { size: 11.5, line: false });
    PDF.table(ctx, ['Datei / Ordner', 'Inhalt'], [['01_EUER-Uebersicht.pdf', 'Monatsübersicht, Ausgaben nach Kategorie' + (st.kleinunternehmer ? ', Kleinunternehmergrenze' : '')],
      ['02_Einnahmen.csv', `${d.ein.length} Zahlungseingänge`], ['03_Rechnungsausgangsbuch.csv', 'alle Rechnungen mit Rechnungsdatum im Jahr'], ['04_Ausgaben.csv', `${d.aus.length} Ausgaben`],
      ...(info.nFahrt ? [['05_Fahrten.csv', `${info.nFahrt} Dienstfahrten (${U.n2(AU.KM)} €/km)`]] : []), ['Rechnungen\\', `${info.nRe} Rechnungen als PDF`], ['Belege\\', `${info.nBel} Eingangsbelege`]], { size: 9.5, at: { columnStyles: { 0: { cellWidth: 62 } } } });
    if (info.fehlt.length || info.offen.length) {
      PDF.h(ctx, 'Bitte prüfen', { size: 11.5, line: false });
      const l = info.fehlt.slice(0, 12).map(x => ['fehlt', x]); if (info.fehlt.length > 12) l.push(['', `… und ${info.fehlt.length - 12} weitere`]);
      info.offen.slice(0, 8).forEach(r => l.push(['offen', `Rechnung ${r.nr} vom ${U.de(r.datum)} (${K.name(r.kunde)}): ${U.eur(R.offen(r))} am Jahresende noch nicht bezahlt – keine Einnahme ${y}`]));
      PDF.table(ctx, null, l, { size: 9, at: { columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', textColor: PDF.C.rot } } } });
    }
    PDF.box(ctx, 'Hinweise', `Die Anlage EÜR ist nach § 60 Abs. 4 EStDV nach amtlich vorgeschriebenem Datensatz elektronisch zu übermitteln (ELSTER). Diese Unterlagen sind eine Zusammenstellung der in AC Office erfassten Daten und ersetzen keine steuerliche Beratung. Nicht enthalten und ggf. zu ergänzen: Abschreibungen (AfA) und geringwertige Wirtschaftsgüter (§ 6 Abs. 2 EStG), häusliches Arbeitszimmer bzw. Tagespauschale, private Kfz-Nutzung, Fortbildungskosten aus privaten Mitteln, Sachentnahmen. Originalbelege bitte aufbewahren (§ 147 AO).`);
    PDF.text(ctx, `Erstellt am ${U.de(U.today())} mit AC Office.`, { size: 8.5, color: PDF.C.grau });
    return PDF.finish(ctx); }); },
  pdf(y, d) { return PDF.fit(() => {
    const ctx = PDF.create('report', { title: 'Einnahmen-Überschuss-Übersicht ' + y, footer: 'Einnahmen-Überschuss-Übersicht ' + y });
    VL.head(ctx, `Einnahmen-Überschuss-Übersicht ${y}`, `Stand: ${U.de(U.today())} · Zufluss-/Abflussprinzip (§ 11 EStG) · ${AC.settings.steuer.kleinunternehmer ? 'Kleinunternehmer (§ 19 UStG) – Beträge ohne Umsatzsteuer' : 'Beträge brutto'}`);
    const MN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const B = { fontStyle: 'bold', fillColor: [228, 228, 214] };
    PDF.h(ctx, 'Monatsübersicht', { size: 11.5, line: false });
    PDF.table(ctx, ['Monat', 'Einnahmen', 'Ausgaben', 'Überschuss'], [...d.mon.map(x => [MN[x.m], U.eur(x.e), U.eur(x.a), U.eur(x.e - x.a)]),
      [{ content: 'Summe', styles: B }, { content: U.eur(d.sumE), styles: B }, { content: U.eur(d.sumA), styles: B }, { content: U.eur(d.ueberschuss), styles: B }]],
      { size: 9.5, at: { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }, didParseCell: c => { if (c.section === 'head' && c.column.index) c.cell.styles.halign = 'right'; } } });
    PDF.h(ctx, 'Ausgaben nach Kategorie', { size: 11.5, line: false });
    const ks = Object.entries(d.kat).sort((a, b) => b[1] - a[1]);
    PDF.table(ctx, ['Kategorie', 'Betrag', 'Anteil'], ks.length ? ks.map(([k, b]) => [k, U.eur(b), d.sumA ? U.nf(b / d.sumA * 100) + ' %' : '']) : [[{ content: 'Keine Ausgaben erfasst.', colSpan: 3 }]],
      { size: 9.5, at: { columnStyles: { 1: { halign: 'right', cellWidth: 35 }, 2: { halign: 'right', cellWidth: 25 } }, didParseCell: c => { if (c.section === 'head' && c.column.index) c.cell.styles.halign = 'right'; } } });
    if (AC.settings.steuer.kleinunternehmer) PDF.box(ctx, 'Kleinunternehmergrenze (§ 19 Abs. 1 UStG)', `Vorjahr ${+y - 1}: ${U.eur(d.vor)} von 25.000 € · laufendes Jahr ${y}: ${U.eur(d.sumE)} von 100.000 €. Die Werte beruhen auf den erfassten Zahlungseingängen.`, { size: 9 });
    PDF.box(ctx, 'Hinweis', 'Diese Übersicht ist eine Hilfe für die Steuererklärung und ersetzt weder die Anlage EÜR noch eine steuerliche Beratung. Abschreibungen (AfA), Privatanteile und Sonderfälle sind nicht berücksichtigt.', { size: 9 });
    return PDF.finish(ctx); }); },
};

AC.views.ausgaben = async (v, jahr) => {
  await K.load(); const years = await AU.years(); const y = jahr || years[0]; const d = await AU.daten(y), KU = AC.settings.steuer.kleinunternehmer;
  AC.head('Ausgaben & Einnahmen-Übersicht', `Jahr ${y} · Ablage: Ordner „ausgaben“ und „auswertungen“`, `<button class="btn ghost" id="aP" title="ZIP mit Übersicht, Listen, Rechnungen und Belegen">📦 Steuerunterlagen</button><button class="btn ghost" id="aE">Auswertung als PDF</button><button class="btn ghost" id="aC">CSV-Export</button><button class="btn light" id="aN">+ Ausgabe</button>`);
  const bar = (val, max, lbl) => { const p = Math.min(100, val / max * 100); return `<div class="small"><b>${lbl}</b>: ${U.eur(val)} von ${U.eur(max)} (${U.nf(p)} %)</div><div class="prog ${p >= 90 ? 'crit' : p >= 75 ? 'warn' : ''}"><div style="width:${p}%"></div></div>`; };
  const maxM = Math.max(1, ...d.mon.map(x => Math.max(x.e, x.a)));
  v.innerHTML = `<div class="card"><div class="row"><span class="small"><b>Jahr</b></span>${years.map(j => `<button class="btn sm ${j === y ? '' : 'light'}" data-y="${j}">${j}</button>`).join('')}</div></div>
    <div class="grid g3" style="margin-bottom:18px"><div class="kpi"><b>${U.eur(d.sumE)}</b><span>Einnahmen (Zahlungseingänge)</span></div><div class="kpi"><b>${U.eur(d.sumA)}</b><span>Ausgaben</span></div>
      <div class="kpi ${d.ueberschuss < 0 ? 'warn' : ''}"><b>${U.eur(d.ueberschuss)}</b><span>Überschuss</span></div></div>
    <div class="grid g2"><div class="card"><h2>Monatsverlauf</h2><table class="t"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th class="num">Saldo</th></tr></thead><tbody>
      ${d.mon.map(x => `<tr><td>${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][x.m]}</td>
      <td><div class="prog" style="max-width:140px"><div style="width:${x.e / maxM * 100}%"></div></div><span class="small">${x.e ? U.eur(x.e) : ''}</span></td>
      <td><div class="prog crit" style="max-width:140px"><div style="width:${x.a / maxM * 100}%"></div></div><span class="small">${x.a ? U.eur(x.a) : ''}</span></td><td class="num">${U.eur(x.e - x.a)}</td></tr>`).join('')}</tbody></table></div>
    <div><div class="card"><h2>Ausgaben nach Kategorie</h2>${Object.keys(d.kat).length ? `<table class="t"><tbody>${Object.entries(d.kat).sort((a, b) => b[1] - a[1]).map(([k, b]) => `<tr><td>${U.esc(k)}</td><td class="num">${U.eur(b)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch keine Ausgaben.</p>'}</div>
    ${KU ? `<div class="card"><h2>Kleinunternehmergrenze</h2><p class="small muted">§ 19 Abs. 1 UStG: höchstens 25.000 € im Vorjahr und 100.000 € im laufenden Jahr. Grundlage: erfasste Zahlungseingänge.</p>
      ${bar(d.vor, 25000, 'Vorjahr ' + (+y - 1))}<div style="height:10px"></div>${bar(d.sumE, 100000, 'Laufendes Jahr ' + y)}${d.sumE > 20000 ? '<p class="hint" style="margin-top:10px">Liegt der Umsatz dieses Jahres über 25.000 €, giltst du im Folgejahr nicht mehr als Kleinunternehmer – rechtzeitig mit Steuerberatung oder Finanzamt klären.</p>' : ''}</div>` : ''}</div></div>
    <div class="card"><h2>Ausgaben ${y} (${d.aus.length})</h2>${d.aus.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>bezahlt</th><th>Lieferant</th><th>Beschreibung</th><th>Kategorie</th><th class="num">Betrag</th><th>Beleg</th></tr></thead><tbody>
      ${d.aus.map(a => `<tr class="click" data-a="${a.nr}"><td>${a.nr}</td><td>${U.de(a.bezahlt || a.datum)}</td><td>${U.esc(a.lieferant)}</td><td>${U.esc(a.beschreibung)}</td><td>${U.esc(a.kategorie)}</td><td class="num">${U.eur(U.num(a.betrag))}</td><td>${a.beleg ? '📎' : '<span class="badge ueber">fehlt</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Noch keine Ausgaben für dieses Jahr.</div>'}</div>
    <div class="card"><h2>Zahlungseingänge ${y} (${d.ein.length})</h2>${d.ein.length ? `<table class="t"><thead><tr><th>Datum</th><th>Rechnung</th><th>Kunde</th><th class="num">Betrag</th></tr></thead><tbody>${d.ein.map(e => `<tr class="click" data-r="${e.nr}"><td>${U.de(e.datum)}</td><td>${e.nr}</td><td>${U.esc(e.kunde)}</td><td class="num">${U.eur(e.betrag)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Zahlungseingänge erfasst du bei der jeweiligen Rechnung.</p>'}</div>`;
  v.querySelectorAll('[data-y]').forEach(b => b.onclick = () => AC.go('ausgaben', b.dataset.y));
  v.querySelectorAll('[data-a]').forEach(t => t.onclick = () => AC.ausgabeDialog(d.aus.find(a => a.nr === t.dataset.a), y));
  v.querySelectorAll('[data-r]').forEach(t => t.onclick = () => AC.go('rechnung', t.dataset.r));
  document.getElementById('aN').onclick = () => AC.ausgabeDialog(null, y);
  document.getElementById('aP').onclick = async () => {
    const st = AC.settings.steuer, ohne = d.aus.filter(x => !x.beleg && !U.num(x.km)).length;
    const r0 = await AC.dialog(`Steuerunterlagen ${y}`, `<p>Die App packt alles für deinen Steuerberater bzw. für die Anlage EÜR in <b>eine ZIP-Datei</b>:</p>
      <ul class="small"><li>Deckblatt mit Stammdaten, Ergebnis, Inhaltsverzeichnis und offenen Punkten (PDF)</li><li>Einnahmen-Überschuss-Übersicht (PDF)</li>
      <li>Einnahmen, Rechnungsausgangsbuch, Ausgaben${d.aus.some(x => U.num(x.km)) ? ', Fahrten' : ''} (CSV für Excel)</li><li>alle Rechnungen ${y} als PDF und alle Belege der Ausgaben</li></ul>
      ${!st.steuernummer ? '<p class="hint small">Steuernummer fehlt – bitte unter Einstellungen → Steuer eintragen, sonst bleibt das Feld auf dem Deckblatt leer.</p>' : ''}
      ${ohne ? `<p class="hint small">${ohne} Ausgabe(n) ohne Beleg – sie werden auf dem Deckblatt als „fehlt“ aufgeführt.</p>` : ''}
      <p class="small muted">Ablage: auswertungen/Steuerunterlagen_${y}.zip – zusätzlich landet die ZIP-Datei in deinen Downloads.</p>`, [['Abbrechen', null, 'light'], ['ZIP erstellen', 'ok']], 'small');
    if (r0 !== 'ok') return;
    AC.toast('Steuerunterlagen werden zusammengestellt …');
    try {
      const r = await AU.paket(y);
      const mail = st.beraterMail ? `mailto:${st.beraterMail}?subject=${encodeURIComponent(`Steuerunterlagen ${y} – ${AC.settings.absender.name}`)}&body=${encodeURIComponent(`Hallo${st.berater ? ' ' + st.berater : ''},

anbei meine Unterlagen für die Steuererklärung ${y} (ZIP-Datei: Übersicht, Listen, Rechnungen und Belege).

Viele Grüße
${AC.settings.absender.name}`)}` : '';
      await AC.dialog('Steuerunterlagen erstellt', `<p><b>${r.n} Dateien</b> (${UL.size(r.groesse)}) in <b>${U.esc(r.fn)}</b> und in deinen Downloads.</p>
        ${r.fehlt.length ? `<p class="hint small">Bitte prüfen (${r.fehlt.length}):<br>${r.fehlt.slice(0, 8).map(U.esc).join('<br>')}${r.fehlt.length > 8 ? '<br>…' : ''}</p>` : '<p class="small">Alle Belege und Rechnungen sind enthalten. 👍</p>'}
        ${mail ? `<p><a class="btn" href="${U.esc(mail)}">✉ E-Mail an ${U.esc(st.berater || st.beraterMail)} vorbereiten</a></p><p class="small muted">Die ZIP-Datei bitte aus den Downloads an die E-Mail anhängen – ein Mail-Link kann keine Anhänge mitgeben.</p>` : '<p class="small muted">Tipp: Unter Einstellungen → Steuer die E-Mail deines Steuerberaters eintragen, dann bereitet die App die E-Mail gleich mit vor.</p>'}`, [['Schließen', 'ok']], 'small');
    } catch (e) { AC.toast('Fehler beim Erstellen: ' + e.message, true); }
  };
  document.getElementById('aE').onclick = async () => { const doc = AU.pdf(y, d); const f = `auswertungen/EUER-Uebersicht_${y}.pdf`; await FS.write(f, doc.output('blob')); AC.toast('Abgelegt: ' + f); AC.preview(doc, 'Übersicht ' + y); };
  document.getElementById('aC').onclick = async () => {
    await FS.write(`auswertungen/Einnahmen_${y}.csv`, AU.csv([['Datum', 'Rechnung', 'Kunde', 'Betrag'], ...d.ein.map(e => [U.de(e.datum), e.nr, e.kunde, e.betrag])]));
    await FS.write(`auswertungen/Ausgaben_${y}.csv`, AU.csv([['Nr.', 'Belegdatum', 'bezahlt am', 'Lieferant', 'Beschreibung', 'Kategorie', 'Betrag', 'USt-Satz', 'Zahlungsart', 'Beleg'], ...d.aus.map(a => [a.nr, U.de(a.datum), U.de(a.bezahlt), a.lieferant, a.beschreibung, a.kategorie, U.num(a.betrag), a.ustSatz + ' %', a.zahlungsart, a.beleg])]));
    AC.toast(`Abgelegt: auswertungen/Einnahmen_${y}.csv und Ausgaben_${y}.csv (öffnen mit Excel)`);
  };
};

/* Dialog: Ausgabe erfassen / bearbeiten */
AC.ausgabeDialog = async (alt, jahr) => {
  const a = alt ? U.clone(alt) : AU.blank(); if (alt) a._jahr = (alt.bezahlt || alt.datum).slice(0, 4);
  const d = document.getElementById('dlg'); d.className = ''; d.style.width = 'min(760px,96vw)';
  const isKm = () => a.kategorie.startsWith('Fahrtkosten (Kilometer');
  d.innerHTML = `<div class="dh"><h2>${alt ? 'Ausgabe ' + a.nr : 'Neue Ausgabe'}</h2></div><div class="db"><div class="grid g4">
    <label class="f"><span>Belegdatum</span><input type="date" id="xD" value="${a.datum}"></label><label class="f"><span>bezahlt am</span><input type="date" id="xB" value="${a.bezahlt}"></label>
    <label class="f" style="grid-column:span 2"><span>Kategorie</span><select id="xK">${AU.KAT.map(k => `<option${k === a.kategorie ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f" style="grid-column:span 2"><span>Lieferant / Empfänger</span><input id="xL" value="${U.esc(a.lieferant)}"></label>
    <label class="f" style="grid-column:span 2"><span>Beschreibung</span><input id="xS" value="${U.esc(a.beschreibung)}"></label>
    <label class="f" id="xKmW"><span>gefahrene km</span><input type="number" step="1" id="xKm" value="${a.km || 0}"></label>
    <label class="f"><span>Betrag € (brutto)</span><input type="number" step="0.01" id="xA" value="${a.betrag}"></label>
    <label class="f"><span>USt-Satz</span><select id="xU">${[0, 7, 19].map(x => `<option value="${x}"${+a.ustSatz === x ? ' selected' : ''}>${x} %</option>`).join('')}</select></label>
    <label class="f"><span>Zahlungsart</span><select id="xZ">${AU.ZA.map(x => `<option${x === a.zahlungsart ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="f" style="grid-column:span 4"><span>Beleg (PDF oder Foto) ${a.beleg ? '– vorhanden: ' + U.esc(a.beleg) : ''}</span><input type="file" id="xF" accept=".pdf,image/*"></label>
    ${AC.mobil ? `<div style="grid-column:span 4" class="row"><button type="button" class="btn light" id="xCam">📷 Beleg fotografieren</button><input type="file" id="xC" accept="image/*" capture="environment" class="hidden"><span class="small muted" id="xCamI"></span></div>` : ''}
    <label class="f" style="grid-column:span 4"><span>Notiz</span><input id="xN" value="${U.esc(a.notiz)}"></label></div>
    <p class="small muted" id="xHint"></p></div>
    <div class="df">${alt ? '<button class="btn red" data-x="del">Löschen</button>' : ''}${a.beleg ? '<button class="btn light" data-x="beleg">Beleg öffnen</button>' : ''}<button class="btn light" data-x="close">Abbrechen</button><button class="btn" data-x="save">Speichern</button></div>`;
  const q = id => d.querySelector('#' + id);
  const upd = () => { a.kategorie = q('xK').value; q('xKmW').style.display = isKm() ? '' : 'none';
    if (isKm()) { a.km = U.num(q('xKm').value); q('xA').value = U.r2(a.km * AU.KM); q('xHint').textContent = `Kilometerpauschale: ${U.nf(a.km)} km × ${U.n2(AU.KM)} € (Dienstreise mit dem Privat-Pkw). Ziel und Anlass bitte in der Beschreibung festhalten.`; }
    else q('xHint').textContent = AC.settings.steuer.kleinunternehmer ? 'Als Kleinunternehmer ist der Bruttobetrag die Betriebsausgabe (kein Vorsteuerabzug).' : ''; };
  q('xK').onchange = upd; q('xKm').oninput = upd; upd();
  if (q('xCam')) { q('xCam').onclick = () => q('xC').click(); q('xC').onchange = () => { const f = q('xC').files[0]; q('xCamI').textContent = f ? '✓ Foto aufgenommen' : ''; }; }
  d.showModal();
  d.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const x = b.dataset.x; if (x === 'close') { d.style.width = ''; return d.close(); }
    if (x === 'beleg') return FS.open(`ausgaben/${a._jahr}/belege/${a.beleg}`).catch(() => AC.toast('Beleg nicht gefunden', true));
    if (x === 'del') { d.close(); if (!await AC.confirm('Ausgabe löschen?', `Ausgabe ${a.nr} und der zugehörige Beleg werden gelöscht.`, 'Löschen')) return;
      await FS.remove(`ausgaben/${a._jahr}/${a.nr}.json`); if (a.beleg) await FS.remove(`ausgaben/${a._jahr}/belege/${a.beleg}`); AC.toast('Gelöscht'); return AC.go('ausgaben', jahr); }
    Object.assign(a, { datum: q('xD').value, bezahlt: q('xB').value || q('xD').value, lieferant: q('xL').value, beschreibung: q('xS').value, betrag: U.num(q('xA').value), ustSatz: +q('xU').value, zahlungsart: q('xZ').value, notiz: q('xN').value });
    if (!(a.betrag > 0) || !a.beschreibung) return AC.toast('Bitte Beschreibung und Betrag angeben', true);
    await AU.save(a); const y = a.bezahlt.slice(0, 4), f = await AC.bildKlein(q('xF').files[0] || (q('xC') && q('xC').files[0]));
    if (f) { const name = `${a.nr}_${U.slug(f.name.replace(/\.[^.]+$/, ''))}.${UL.ext(f.name)}`; if (a.beleg && a._jahr) await FS.remove(`ausgaben/${a._jahr}/belege/${a.beleg}`);
      await FS.write(`ausgaben/${y}/belege/${name}`, f); a.beleg = name; delete a._jahr; await AU.save(a); }
    else if (a.beleg && a._jahr && a._jahr !== y) { const fb = await FS.file(`ausgaben/${a._jahr}/belege/${a.beleg}`); await FS.write(`ausgaben/${y}/belege/${a.beleg}`, fb); await FS.remove(`ausgaben/${a._jahr}/belege/${a.beleg}`); }
    d.style.width = ''; d.close(); AC.toast(`Gespeichert: ausgaben/${y}/${a.nr}.json`); AC.go('ausgaben', y);
  });
};
