/* =====================================================================
   AC Office – UE-Vorgaben und Lehrgangsdauer (lehrdauer.js)
   - Vorgaben für Unterrichtseinheiten (UE à 45 Min.) im Angebot anklicken:
     setzt die Menge der UE-Position.
   - Im Lehrgang: Ende aus Beginn, UE gesamt und UE pro Tag berechnen,
     freie Tage (Wochenende, Feiertage NRW) werden übersprungen.
   Stand der Vorgaben: 11/2026. Vor Verwendung auf Aktualität prüfen.
   ===================================================================== */
'use strict';
const LD = AC.LD = {
  get VORGABEN() {
    const sk = AC.LP && AC.LP.VORSCHLAG ? Object.values(AC.LP.VORSCHLAG).reduce((a, b) => a + b, 0) : 160;
    return [
      { key: 'unterrichtung', name: 'Unterrichtung § 34a GewO', ue: 40, quelle: 'gesetzlich', art: 'Lehrgang', titel: 'Unterrichtung nach § 34a GewO',
        beleg: 'Anlage 2 zu § 7 BewachV: 40 Unterrichtsstunden (SG 1+2: 6, SG 3: 6, SG 4: 6, SG 5: 6, SG 6: 11, SG 7: 5).' },
      { key: 'eh-aus', name: 'Erste-Hilfe-Ausbildung', ue: 9, quelle: 'DGUV', art: 'Lehrgang', titel: 'Erste-Hilfe-Ausbildung',
        beleg: 'DGUV Grundsatz 304-001: mindestens 9 UE à 45 Min. Nur durch ermächtigte Stellen (§ 26 DGUV Vorschrift 1).' },
      { key: 'eh-fort', name: 'Erste-Hilfe-Fortbildung', ue: 9, quelle: 'DGUV', art: 'Lehrgang', titel: 'Erste-Hilfe-Fortbildung',
        beleg: 'DGUV Grundsatz 304-001: mindestens 9 UE, spätestens alle 2 Jahre. Nur durch ermächtigte Stellen.' },
      { key: 'bsh', name: 'Brandschutzhelfer (Theorie)', ue: 2, quelle: 'DGUV', art: 'Unterweisung', titel: 'Ausbildung Brandschutzhelfer',
        beleg: 'DGUV Information 205-023: Theorie mindestens 2 UE, dazu praktische Übung mit Feuerlöschern (Dauer im Angebot ergänzen).' },
      { key: 'sachkunde', name: 'Vorbereitung Sachkundeprüfung', ue: sk, quelle: 'eigene Planung', art: 'Prüfungsvorbereitung § 34a GewO', titel: 'Vorbereitung Sachkundeprüfung § 34a GewO',
        beleg: `Keine gesetzliche Mindestdauer. ${sk} UE = deine Verteilung im Lehrgangsplan (Bereich „Unterricht“).` }
    ];
  },
  vorgabe: key => LD.VORGABEN.find(v => v.key === key),
  chips(aktiv, attr) {
    return `<div class="small" style="margin:2px 0"><b>Vorgabe Unterrichtseinheiten</b> <span class="muted">(anklicken = Menge übernehmen)</span></div>
      <div class="chips">${LD.VORGABEN.map(v => `<button class="chip${aktiv === v.key ? ' on' : ''}" ${attr}="${v.key}" title="${U.esc(v.beleg)}" style="${aktiv === v.key ? 'outline:2px solid currentColor;' : ''}">${U.esc(v.name)} · <b>${v.ue} UE</b> <span class="muted">(${U.esc(v.quelle)})</span></button>`).join('')}</div>
      ${aktiv && LD.vorgabe(aktiv) ? `<p class="small muted" style="margin:2px 0 8px">${U.esc(LD.vorgabe(aktiv).beleg)}</p>` : ''}`;
  },
  isUE: p => /^\s*UE\s*$/i.test(p.einheit || ''),
  summeUE: r => (r.positionen || []).filter(LD.isUE).reduce((s, p) => s + U.num(p.menge), 0),

  /* ---------- Angebot ---------- */
  angebotChips: a => `<div style="margin-bottom:10px">${LD.chips(a.ueVorgabe, 'data-ldv')}</div>`,
  angebotAnwenden(a, key) {
    const v = LD.vorgabe(key); if (!v) return; const ue = (a.positionen || []).filter(LD.isUE);
    const txt = `${v.name}: ${v.ue} UE à 45 Min. – ${v.beleg.split(':')[0]}`;
    if (!ue.length) { const k = AC.settings.katalog.find(x => LD.isUE(x)) || { bez: 'Lehrgang – Unterrichtseinheit (45 Min.)', einheit: 'UE', preis: 0 };
      a.positionen.push({ bez: k.bez, text: txt, menge: v.ue, einheit: 'UE', preis: k.preis }); }
    else { ue[0].menge = v.ue; if (!String(ue[0].text || '').trim() || /UE à 45 Min\./.test(ue[0].text)) ue[0].text = txt;
      if (ue.length > 1) AC.toast('Mehrere UE-Positionen – die Vorgabe wurde in die erste übernommen', true); }
    if (!a.bezug) a.bezug = v.titel; a.ueVorgabe = key;
  },
  terminISO(t) { const m = String(t || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${U.pad(+m[2], 2)}-${U.pad(+m[1], 2)}` : ''; },
  angebotBind(v, a, redraw) {
    v.querySelectorAll('[data-ldv]').forEach(b => b.onclick = () => { LD.angebotAnwenden(a, b.dataset.ldv); redraw(); AC.toast(`${LD.vorgabe(b.dataset.ldv).ue} UE als Menge übernommen`); });
    const lgb = v.querySelector('#aLg'); if (lgb) lgb.onclick = () => {
      const ue = LD.summeUE(a); if (!ue) return AC.toast('Keine Position mit Einheit „UE“ im Angebot', true); const vg = LD.vorgabe(a.ueVorgabe);
      AC.go('lehrgang', null, 0, { titel: a.bezug || (vg && vg.titel) || '', art: vg ? vg.art : 'Lehrgang', kundeId: a.kundeId, ue, ueVorgabe: a.ueVorgabe || '', angebotNr: a.nr,
        von: LD.terminISO(a.termin) || U.today(), endeAuto: true, notiz: `aus Angebot ${a.nr} vom ${U.de(a.datum)}` }); };
  },

  /* ---------- Lehrgang ---------- */
  berechne(lg) {
    const ue = U.num(lg.ue), pt = U.num(lg.uePerTag); if (!lg.von || !(ue > 0) || !(pt > 0)) return null;
    const n = Math.ceil(ue / pt), tage = []; let d = lg.von, guard = 0;
    while (tage.length < n && guard++ < 1000) { if (LG.zaehlt(lg, d)) tage.push(d); d = U.addDays(d, 1); }
    return { bis: tage[tage.length - 1] || lg.von, tage, rest: ue - (n - 1) * pt, startFrei: !LG.zaehlt(lg, lg.von) };
  },
  anwenden(lg) { if (!lg.endeAuto) return null; const r = LD.berechne(lg); if (r) lg.bis = r.bis; return r; },
  info(lg) {
    const r = LD.berechne(lg); if (!r) return 'Für die Berechnung Beginn, UE gesamt und UE pro Tag angeben.';
    const pt = U.num(lg.uePerTag), last = r.rest < pt ? `, letzter Tag ${U.nf(r.rest)} UE` : '';
    return `${U.nf(U.num(lg.ue))} UE ÷ ${U.nf(pt)} UE/Tag = <b>${r.tage.length} Lehrgangstag${r.tage.length === 1 ? '' : 'e'}</b>${last} → Ende <b>${U.de(r.bis)}</b>${lg.nurWerktage ? ' (Wochenenden und Feiertage NRW übersprungen)' : ''}`
      + (r.startFrei ? '<br><span style="color:var(--red,#b00)">Der Beginn fällt auf einen freien Tag – der Lehrgang startet am nächsten Lehrgangstag.</span>' : '')
      + (lg.endeAuto ? '' : '<br><span class="muted">Automatik aus – das Ende wird nicht verändert.</span>');
  },
  lehrgangHtml(lg, F) {
    return `${F.input('UE pro Tag', 'uePerTag', lg.uePerTag ?? 8, { type: 'number' })}
      <div class="f" style="grid-column:span 3">${LD.chips(lg.ueVorgabe, 'data-ldl')}<p class="small" id="gLdInfo" style="margin:4px 0 0">${LD.info(lg)}</p></div>`;
  },
};
