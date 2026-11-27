/* =====================================================================
   AC Office – Termine, Wiedervorlagen und Datensicherung (termine.js)
   Eigene Wiedervorlagen: wiedervorlagen.json im Datenordner
   Automatische Termine kommen aus Rechnungen, Angeboten, Lehrgängen,
   Schutzkonzepten, Basiszinssatz und Datensicherung.
   ===================================================================== */
'use strict';
/* ---------- Outlook / Kalender: iCalendar-Dateien (.ics, RFC 5545) ----------
   Jeder Termin hat eine feste Kennung (UID). Eine neue Datei mit derselben UID und höherer
   SEQUENCE aktualisiert den vorhandenen Eintrag. Hinweis: Outlook verarbeitet beim Öffnen einer
   Datei keine Absagen (METHOD:CANCEL) – abgesagte Termine werden deshalb als „ABGESAGT“ markiert. */
AC.ICS = {
  TZ: ['BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:MESZ', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:MEZ', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'],
  MIME: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', pdf: 'application/pdf', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  esc: s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'),
  pesc: s => String(s || '').replace(/["\r\n]/g, ''), // Parameterwerte (z. B. Dateiname)
  fold(line) { if (line.length < 70 && !/[^\x00-\x7f]/.test(line)) return line; const out = []; let cur = '', len = 0;
    for (const ch of line) { const b = ch.charCodeAt(0) < 128 ? 1 : new TextEncoder().encode(ch).length; if (len + b > 74) { out.push(cur); cur = ' '; len = 1; } cur += ch; len += b; } out.push(cur); return out.join('\r\n'); },
  d: iso => iso.replace(/-/g, ''),
  t: hm => hm.replace(':', '').padStart(4, '0') + '00',
  stamp: () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
  seq: () => Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60000), // steigt mit jeder Ausgabe
  zeiten(txt) { const m = String(txt || '').match(/(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/); return m ? [`${U.pad(m[1], 2)}:${m[2]}`, `${U.pad(m[3], 2)}:${m[4]}`] : null; },
  /* Navigations-Link für einen Standort: öffnet auf dem Handy Google Maps mit Route */
  navLinks: adr => adr ? [{ text: '📍 Navigation starten (Google Maps)', url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}&travelmode=driving` }] : [],
  plus1h: hm => `${U.pad(Math.min(23, +hm.slice(0, 2) + 1), 2)}:${hm.slice(3, 5)}`,
  b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  /* e: { uid, datum, bis?, von?, ende?, titel, text?, ort?, frei?, erinnerung?, rrule?, exdates?, teams?, knapp?, abgesagt?, anlagen?: [{ pfad, name }] } */
  event(e) {
    const I = AC.ICS, L = ['BEGIN:VEVENT', `UID:${e.uid}@ac-office.ac-security`, `DTSTAMP:${I.stamp()}`, `LAST-MODIFIED:${I.stamp()}`, `SEQUENCE:${I.seq()}`];
    if (e.von) L.push(`DTSTART;TZID=Europe/Berlin:${I.d(e.datum)}T${I.t(e.von)}`, `DTEND;TZID=Europe/Berlin:${I.d(e.datum)}T${I.t(e.ende && e.ende > e.von ? e.ende : I.plus1h(e.von))}`);
    else L.push(`DTSTART;VALUE=DATE:${I.d(e.datum)}`, `DTEND;VALUE=DATE:${I.d(U.addDays(e.bis && e.bis > e.datum ? e.bis : e.datum, 1))}`);
    if (e.rrule) L.push(`RRULE:${e.rrule}`);
    (e.exdates || []).forEach(x => L.push(e.von ? `EXDATE;TZID=Europe/Berlin:${I.d(x)}T${I.t(e.von)}` : `EXDATE;VALUE=DATE:${I.d(x)}`));
    const wort = typeof e.abgesagt === 'string' ? e.abgesagt : 'abgesagt';
    L.push(`SUMMARY:${I.esc(e.abgesagt ? wort.toUpperCase() + ' – ' + e.titel : e.titel)}`);
    const links = e.abgesagt ? [] : (e.links || []);
    const basis = e.abgesagt ? `Dieser Termin wurde ${wort} und kann gelöscht werden (bei Serien: „Serie löschen“).\n\n${e.text || ''}` : (e.text || '');
    const text = [links.map(l => `${l.text}:\n${l.url}`).join('\n\n'), basis].filter(Boolean).join('\n\n');
    if (text) L.push(`DESCRIPTION:${I.esc(text)}`);
    if (links.length) { const h = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      L.push(`X-ALT-DESC;FMTTYPE=text/html:${I.esc(`<html><body>${links.map(l => `<p><a href="${h(l.url)}">${h(l.text)}</a></p>`).join('')}<p>${h(basis).replace(/\n/g, '<br>')}</p></body></html>`)}`); }
    if (e.ort) L.push(`LOCATION:${I.esc(e.ort)}`);
    if (e.teams && !e.abgesagt) L.push(`X-MICROSOFT-SKYPETEAMSMEETINGURL:${e.teams}`);
    if (e.abgesagt) L.push('STATUS:CANCELLED', 'TRANSP:TRANSPARENT', 'X-MICROSOFT-CDO-BUSYSTATUS:FREE');
    else if (!e.knapp) { L.push('CATEGORIES:AC Security', `TRANSP:${e.frei ? 'TRANSPARENT' : 'OPAQUE'}`, `X-MICROSOFT-CDO-BUSYSTATUS:${e.frei ? 'FREE' : 'BUSY'}`);
      if (e.erinnerung) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${I.esc(e.titel)}`, `TRIGGER:-PT${e.erinnerung}M`, 'END:VALARM'); }
    if (!e.abgesagt) (e._att || []).forEach(a => L.push(`ATTACH;FMTTYPE=${a.type};ENCODING=BASE64;VALUE=BINARY;X-FILENAME="${I.pesc(a.name)}":${a.b64}`));
    L.push('END:VEVENT'); return L;
  },
  /* Anlagen aus dem Datenordner einlesen (nur wenn vorhanden) */
  async anhaengen(e) { e._att = []; for (const a of e.anlagen || []) { try { const f = await FS.file(a.pfad); e._att.push({ name: a.name, type: AC.ICS.MIME[UL.ext(a.name)] || 'application/octet-stream', b64: AC.ICS.b64(new Uint8Array(await f.arrayBuffer())) }); } catch (x) { AC.toast(`Anlage nicht gefunden: ${a.name}`, true); } } return e; },
  build(events) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AC Security Consulting & Training//AC Office//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...AC.ICS.TZ];
    events.forEach(e => L.push(...AC.ICS.event(e))); L.push('END:VCALENDAR');
    return L.map(l => AC.ICS.fold(l)).join('\r\n') + '\r\n'; },
  /* Datei ausgeben: Edge lädt sie herunter, „Öffnen“ übergibt sie an Outlook */
  download(name, text, abgesagt) {
    const b = new Blob([text], { type: 'text/calendar;charset=utf-8' }), url = URL.createObjectURL(b), a = document.createElement('a');
    a.href = url; a.download = name.replace(/[\\/:*?"<>|]+/g, '-') + '.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    AC.toast(abgesagt ? 'Absage erstellt – öffnen: Outlook markiert den Termin als „ABGESAGT“. Löschen dann in Outlook (bei Serien „Serie löschen“).' : 'Kalenderdatei erstellt – in der Download-Leiste „Öffnen“ klicken, Outlook übernimmt den Termin.'); },
  async senden(e, abgesagt) {
    if (AC.mobil) { AC.ICS.nurLaptop(); return false; }
    if (await AC.OL.nutzen()) { const r = await AC.OL.auftrag([AC.OL.aktion(e, !!abgesagt)], e.titel);
      AC.toast((r.ok ? (abgesagt ? '✓ In Outlook gelöscht: ' : '✓ In Outlook eingetragen: ') : 'Outlook: ') + (r.ok ? e.titel : AC.OL.meldung(r)), !r.ok); return r.ok; }
    const x = Object.assign({}, e, { abgesagt: abgesagt || false }); if (!abgesagt && x.anlagen && x.anlagen.length) await AC.ICS.anhaengen(x);
    AC.ICS.download((abgesagt ? 'Absage_' : 'Termin_') + e.titel.slice(0, 50), AC.ICS.build([x]), abgesagt); return true; },
  /* Lehrgang als Terminserie – Inhalt bewusst knapp: Bezeichnung, Zeitraum mit Uhrzeit, Standort, Teams-Link, Beschreibung, Anlagen */
  lehrgang(lg) {
    const LG = AC.LG, z = AC.ICS.zeiten(lg.zeiten), tage = LG.tage(lg); if (!tage.length) return null;
    const first = tage[0], last = tage[tage.length - 1], frei = LG.alleTage(lg).filter(d => d > first && d < last && !LG.zaehlt(lg, d));
    const k = lg.kundeId && AC.K.get(lg.kundeId), on = LG.online(lg), hy = LG.hybrid(lg), stand = LG.standort(lg), nav = on ? '' : LG.navi(stand), teams = (on || hy) && lg.teams ? lg.teams : '';
    return { uid: 'lehrgang-' + lg.id, datum: first, letzter: last, von: z && z[0], ende: z && z[1], titel: lg.titel, knapp: true, teams,
      ort: on ? 'Microsoft Teams-Besprechung' : stand,
      rrule: tage.length > 1 ? `FREQ=DAILY;UNTIL=${AC.ICS.d(last)}${z ? 'T235959Z' : ''}` : '', exdates: tage.length > 1 ? frei : [],
      anlagen: (lg.anlagen || []).map(a => ({ pfad: `lehrgaenge/${lg.id}/anlagen/${a.name}`, name: a.name, groesse: a.groesse })),
      links: [...(teams ? [{ text: 'Microsoft Teams – Besprechung beitreten', url: teams }] : []), ...(on ? [] : AC.ICS.navLinks(stand))],
      text: [!on && stand ? 'Standort: ' + stand + (lg.raum ? ' · ' + (/^raum/i.test(lg.raum) ? lg.raum : 'Raum ' + lg.raum) : '') : '', `${lg.id} · ${lg.art} · ${lg.form || 'Präsenz'}`, `${tage.length} Lehrgangstage · ${lg.teilnehmer.length} Teilnehmende`, lg.zeiten,
        k ? 'Auftraggeber: ' + AC.K.name(k) : ''].filter(Boolean).join('\n') };
  },
  lgStub: lg => ({ uid: 'lehrgang-' + lg.id, datum: lg.von || U.today(), titel: lg.titel, knapp: true }),
  _hash: e => JSON.stringify(e),
  /* abgesagter Lehrgang noch zu bearbeiten? direkt verbunden: bis er wirklich gelöscht ist · Kalenderdatei: bis er markiert ist */
  absageOffen: (lg, direkt) => lg.status === 'abgesagt' && lg.outlook && !lg.outlookGeloescht && (direkt || !lg.outlookAbgesagt || !lg.outlookAbsage2),
  markiere(lg, e, abgesagt, direkt) { lg.outlook = true; lg.outlookAm = new Date().toISOString(); if (abgesagt) { lg.outlookAbgesagt = true; lg.outlookAbsage2 = true; if (direkt) lg.outlookGeloescht = true; delete lg.outlookHash; } else { lg.outlookAbgesagt = false; lg.outlookGeloescht = false; lg.outlookHash = AC.ICS._hash(e); } },
  /* Alle Lehrgänge nach Status mit Outlook abgleichen:
     geplant / läuft → eintragen bzw. aktualisieren (nur wenn neu oder geändert) · abgesagt → als ABGESAGT markieren · abgeschlossen → unverändert (Nachweis) */
  nurLaptop() { AC.toast('Outlook-Abgleich läuft über den Laptop – dort „🔄 Mit Outlook abgleichen“ antippen. Änderungen vom Handy sind nach dem Sync automatisch dabei.'); },
  async abgleich() {
    if (AC.mobil) { AC.ICS.nurLaptop(); return false; }
    await AC.K.load(); const direkt = await AC.OL.nutzen(), all = await AC.LG.loadAll(), neu = [], upd = [], del = [], ok = [], fertig = [];
    for (const lg of all) {
      if (lg.status === 'geplant' || lg.status === 'läuft') { const e = AC.ICS.lehrgang(lg); if (!e) continue;
        if (lg.outlook && !lg.outlookAbgesagt && lg.outlookHash === AC.ICS._hash(e)) ok.push(lg); else (lg.outlook && !lg.outlookAbgesagt ? upd : neu).push({ lg, e }); }
      else if (lg.status === 'abgesagt') { if (AC.ICS.absageOffen(lg, direkt)) del.push({ lg, e: AC.ICS.lehrgang(lg) || AC.ICS.lgStub(lg) }); }
      else if (lg.status === 'abgeschlossen') fertig.push(lg);
    }
    const li = l => l.length ? `<ul class="small" style="margin:4px 0 10px">${l.map(x => `<li>${U.esc(x.lg.id)} · ${U.esc(x.lg.titel)} · ${AC.LG.zeitraum(x.lg)}${(x.e.anlagen || []).length ? ` · 📎 ${x.e.anlagen.length}` : ''}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:2px 0 10px">–</p>';
    const n = neu.length + upd.length + del.length;
    const r = await AC.dialog('Lehrgänge mit Outlook abgleichen', `
      <p><b>Neu eintragen (${neu.length})</b></p>${li(neu)}
      <p><b>Aktualisieren – geändert seit dem letzten Abgleich (${upd.length})</b></p>${li(upd)}
      <p><b>Abgesagt – ${direkt ? 'wird aus Outlook gelöscht' : 'wird in Outlook als „ABGESAGT“ markiert'} (${del.length})</b></p>${li(del)}
      <p class="small muted">Unverändert: ${ok.length} · Abgeschlossen (bleibt als Nachweis im Kalender): ${fertig.length}</p>
      ${direkt ? '<p class="small">● <b>Outlook direkt verbunden</b> – der Kalenderdienst trägt alles in einem Durchgang ein, ändert und löscht.</p>' : ''}
      ${del.length && !direkt ? '<p class="hint small">Outlook löscht Termine nicht über eine geöffnete Datei. Abgesagte Lehrgänge werden deshalb mit „ABGESAGT“ im Titel und als „frei“ überschrieben – löschen kannst du sie dann in Outlook mit „Serie löschen“.</p>' : ''}
      ${n && !direkt ? `<p class="small">Die App erstellt <b>${n} Kalenderdatei${n === 1 ? '' : 'en'}</b> – je Lehrgang eine. Edge fragt beim ersten Mal, ob mehrere Downloads erlaubt sind → „Zulassen“.</p>` : '<p>Alles ist auf dem aktuellen Stand. 👍</p>'}`,
      n ? [['Abbrechen', null, 'light'], [direkt ? `${n} Änderung${n === 1 ? '' : 'en'} in Outlook übernehmen` : `${n} Datei${n === 1 ? '' : 'en'} erstellen`, 'ok']] : [['Schließen', null]], 'small');
    if (r !== 'ok') return false;
    if (direkt) {
      const jobs = [...neu, ...upd].map(x => ({ ...x, ab: false })).concat(del.map(x => ({ ...x, ab: true })));
      const res = await AC.OL.auftrag(jobs.map(j => AC.OL.aktion(j.e, j.ab)), 'Abgleich');
      const byUid = {}; (res.ergebnisse || []).forEach(x => { byUid[x.uid] = x; });
      let okN = 0; for (const j of jobs) { const x = byUid[j.e.uid]; if (x && x.ok) { AC.ICS.markiere(j.lg, j.e, j.ab, true); await AC.LG.save(j.lg); okN++; } }
      await AC.dialog('Abgleich mit Outlook', `<p>${res.ok ? '✓' : '⚠'} <b>${okN} von ${jobs.length}</b> Änderungen übernommen.</p>
        <ul class="small">${(res.ergebnisse || []).map(x => `<li>${x.ok ? '✓' : '✗'} ${U.esc(x.uid || x.art)}: ${U.esc(x.meldung)}</li>`).join('')}</ul>`, [['OK', 'ok']], 'small');
      return true;
    }
    const jobs = [...neu.map(x => ({ ...x, ab: false })), ...upd.map(x => ({ ...x, ab: false })), ...del.map(x => ({ ...x, ab: true }))];
    for (let i = 0; i < jobs.length; i++) { const j = jobs[i]; AC.ICS.markiere(j.lg, j.e, j.ab); await AC.LG.save(j.lg);
      const x = Object.assign({}, j.e, { abgesagt: j.ab }); if (!j.ab && (x.anlagen || []).length) await AC.ICS.anhaengen(x);
      AC.ICS.download(`${j.ab ? 'Absage' : 'Lehrgang'}_${j.lg.id}_${j.lg.titel.slice(0, 40)}`, AC.ICS.build([x]), j.ab); if (i < jobs.length - 1) await new Promise(res => setTimeout(res, 700)); }
    AC.toast(`Abgleich: ${neu.length} neu, ${upd.length} aktualisiert, ${del.length} als abgesagt markiert`);
    return true;
  },
  /* eigener Termin / eigene Wiedervorlage */
  eigen(w) { const k = w.kundeId && AC.K.get(w.kundeId);
    return { uid: 'wv-' + w.id, datum: w.datum, von: w.von || '', ende: w.bis || '', titel: (w.art === 'Termin' ? '' : 'Wiedervorlage: ') + w.titel, ort: w.ort || '', erinnerung: w.von ? 15 : 0, frei: !w.von, links: AC.ICS.navLinks(w.ort || ''),
      text: [w.notiz, k ? 'Kunde: ' + AC.K.name(k) + (k.tel ? ' · Tel. ' + k.tel : '') + (k.mail ? ' · ' + k.mail : '') : ''].filter(Boolean).join('\n') }; },
};

const TE = AC.TE = {
  async eigene() { return ((await FS.readJSON('wiedervorlagen.json')) || { items: [] }).items; },
  async speichern(items) { await FS.writeJSON('wiedervorlagen.json', { items }); },
  /* alle Termine: eigene + automatisch erkannte */
  async alle() {
    const heute = U.today(), out = [];
    (await TE.eigene()).filter(w => !w.erledigt).forEach(w => out.push({ datum: w.datum, zeit: w.von ? `${w.von}${w.bis ? '–' + w.bis : ''} Uhr` : '', titel: w.titel, notiz: w.notiz,
      quelle: (w.art || 'Wiedervorlage') + (w.ort ? ' · ' + w.ort : '') + (w.kundeId ? ' · ' + K.name(K.get(w.kundeId)) : ''), id: w.id, eigen: true, cal: AC.ICS.eigen(w), outlook: w.outlook }));
    (await R.loadAll()).filter(r => r.typ !== 'storno' && r.status === 'offen' && R.offen(r) > 0 && U.days(heute, r.faellig) <= 7)
      .forEach(r => out.push({ datum: r.faellig, titel: `${R.ueberfaellig(r) ? 'Überfällig' : 'Fällig'}: Rechnung ${r.nr} (${U.eur(R.offen(r))})`, quelle: K.name(r.kunde), go: ['rechnung', r.nr], cal: { uid: 're-' + r.nr, datum: r.faellig, titel: `Fälligkeit Rechnung ${r.nr} – ${K.name(r.kunde)}`, text: `offen: ${U.eur(R.offen(r))}`, frei: true } }));
    (await AN.loadAll()).filter(a => a.status === 'versendet' && U.days(heute, a.gueltigBis) <= 7)
      .forEach(a => out.push({ datum: a.gueltigBis, titel: `Angebot ${a.nr} nachfassen – gültig bis ${U.de(a.gueltigBis)}`, quelle: K.name(a.kunde || K.get(a.kundeId)), go: ['angebot', a.nr], cal: { uid: 'an-' + a.nr, datum: a.gueltigBis, titel: `Angebot ${a.nr} nachfassen – ${K.name(a.kunde || K.get(a.kundeId))}`, frei: true } }));
    (await LG.loadAll()).forEach(l => {
      if (l.status === 'geplant' && l.von >= heute && U.days(heute, l.von) <= 30) out.push({ datum: l.von, titel: `Lehrgang beginnt: ${l.titel}`, quelle: `${l.id} · ${l.teilnehmer.length} Teilnehmende`, go: ['lehrgang', l.id] , cal: AC.ICS.lehrgang(l), lgId: l.id, outlook: l.outlook && !l.outlookAbgesagt});
      if (l.status === 'abgeschlossen' && l.kundeId && !l.rechnungNr) out.push({ datum: l.bis || l.von, titel: `Lehrgang abrechnen: ${l.titel}`, quelle: l.id, go: ['lehrgang', l.id, 4] });
      if (l.status === 'abgeschlossen' && !l.datenGeloescht && l.teilnehmer.some(t => t.kontakt || t.geburtsdatum) && U.days(l.bis || l.von, heute) > 90)
        out.push({ datum: U.addDays(l.bis || l.von, 90), titel: `Teilnehmerdaten löschen prüfen: ${l.titel}`, quelle: `${l.id} · Datenminimierung (Art. 5 DSGVO)`, go: ['lehrgang', l.id, 1] });
    });
    (await SK.loadAll()).filter(s => s.naechstePruefung && U.days(heute, s.naechstePruefung) <= 60)
      .forEach(s => out.push({ datum: s.naechstePruefung, titel: `Schutzkonzept überprüfen: ${s.objekt}`, quelle: `${s.id} · ${K.name(s.kunde)}`, go: ['schutzkonzept', s.id], cal: { uid: 'sk-' + s.id, datum: s.naechstePruefung, titel: `Schutzkonzept überprüfen: ${s.objekt}`, text: K.name(s.kunde), frei: true } }));
    const m = AC.settings.mahnung, y = new Date().getFullYear(), next = [`${y}-01-01`, `${y}-07-01`, `${y + 1}-01-01`].find(x => x > m.basiszinsAb);
    if (next && next <= U.addDays(heute, 14)) out.push({ datum: next, titel: 'Basiszinssatz aktualisieren (Deutsche Bundesbank)', quelle: 'Einstellungen → Mahnwesen', go: ['einstellungen'] });
    const ls = AC.settings.letzteSicherung, iv = AC.settings.sicherungIntervall || 7;
    if (!ls || U.days(ls.slice(0, 10), heute) >= iv) out.push({ datum: ls ? U.addDays(ls.slice(0, 10), iv) : heute, titel: 'Datensicherung durchführen', quelle: ls ? `letzte Sicherung ${U.de(ls.slice(0, 10))}` : 'noch keine Sicherung', sicherung: true });
    TE._last = out.sort((a, b) => a.datum.localeCompare(b.datum)); return TE._last;
  },
  zeile(t) {
    const d = U.days(U.today(), t.datum), farbe = d < 0 ? 'var(--rot)' : d === 0 ? 'var(--gelb)' : 'var(--black)', i = (TE._last || []).indexOf(t);
    return `<div class="due"><div class="d" style="color:${farbe}">${d === 0 ? 'heute' : U.de(t.datum)}${t.zeit ? `<div class="small" style="color:var(--grau)">${U.esc(t.zeit)}</div>` : ''}</div><div style="flex:1;min-width:0"><b>${U.esc(t.titel)}</b>${t.notiz ? `<div class="small">${U.esc(t.notiz)}</div>` : ''}<div class="src">${U.esc(t.quelle || '')}</div></div>
      ${t.cal && i >= 0 ? `<button class="btn sm light" data-cal="${i}" title="${t.outlook ? 'In Outlook aktualisieren' : 'In Outlook-Kalender eintragen'}">📅 ${t.outlook ? 'aktualisieren' : 'Outlook'}</button>` : ''}${t.go ? `<button class="btn sm light" data-go2='${U.esc(JSON.stringify(t.go))}'>öffnen</button>` : ''}${t.sicherung ? '<button class="btn sm" data-backup="1">Jetzt sichern</button>' : ''}${t.eigen ? `<button class="btn sm light" data-wedit="${t.id}">bearbeiten</button><button class="btn sm light" data-done="${t.id}">erledigt</button>` : ''}</div>`;
  },
  /* Dialog: neue / bestehende Wiedervorlage oder eigener Termin */
  async dialog(w) {
    const neu = !w, heute = U.today(); w = w || { id: U.uid(), art: 'Wiedervorlage', datum: U.addDays(heute, 7), von: '', bis: '', ort: '', titel: '', notiz: '', kundeId: '', erledigt: false, angelegt: heute };
    const r = await AC.dialog(neu ? 'Neuer Eintrag' : 'Eintrag bearbeiten', `<div class="grid g2">
      <label class="f"><span>Art</span><select id="wA">${['Wiedervorlage', 'Termin'].map(a => `<option${a === (w.art || 'Wiedervorlage') ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      <label class="f"><span>Datum</span><input type="date" id="wD" value="${w.datum}"></label>
      <label class="f"><span>Uhrzeit von (optional)</span><input type="time" id="wV" value="${w.von || ''}"></label><label class="f"><span>bis</span><input type="time" id="wB" value="${w.bis || ''}"></label>
      <label class="f"><span>Ort (optional)</span><input id="wO" value="${U.esc(w.ort || '')}"></label>
      <label class="f"><span>Kunde (optional)</span><select id="wK">${K.options(w.kundeId).replace('– Kunde wählen –', '– ohne –')}</select></label>
      <label class="f" style="grid-column:span 2"><span>Was ist zu tun? / Betreff</span><input id="wT" value="${U.esc(w.titel)}" placeholder="z. B. Angebot telefonisch nachfassen"></label>
      <label class="f" style="grid-column:span 2"><span>Notiz</span><textarea id="wN" rows="3">${U.esc(w.notiz || '')}</textarea></label>
      <label class="row small" style="grid-column:span 2;gap:8px"><input type="checkbox" id="wC"${w.outlook ? ' checked' : ''}> ${w.outlook ? 'Änderung auch in Outlook übernehmen' : 'gleich in den Outlook-Kalender eintragen'}</label></div>
      <p class="small muted">Ohne Uhrzeit wird es in Outlook ein ganztägiger Eintrag (als „frei“), mit Uhrzeit ein Termin mit Erinnerung 15 Minuten vorher.</p>`, [['Abbrechen', null, 'light'], ['Speichern', 'ok']], 'small');
    if (r !== 'ok') return false; const g = id => document.getElementById(id).value; if (!g('wT')) { AC.toast('Bitte angeben, was zu tun ist', true); return false; }
    Object.assign(w, { art: g('wA'), datum: g('wD') || heute, von: g('wV'), bis: g('wB'), ort: g('wO'), kundeId: g('wK'), titel: g('wT'), notiz: g('wN') });
    const cal = document.getElementById('wC').checked, it = await TE.eigene();
    if (cal) w.outlook = true;
    const ix = it.findIndex(x => x.id === w.id); if (ix >= 0) it[ix] = w; else it.push(w); await TE.speichern(it);
    if (cal) { await K.load(); AC.ICS.senden(AC.ICS.eigen(w)); } else AC.toast('Gespeichert');
    return true;
  },
  bind(v, reload) {
    v.querySelectorAll('[data-go2]').forEach(b => b.onclick = () => AC.go(...JSON.parse(b.dataset.go2)));
    v.querySelectorAll('[data-backup]').forEach(b => b.onclick = async () => { if (await TE.sichern()) reload(); });
    v.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => { const it = await TE.eigene(); const w = it.find(x => x.id === b.dataset.done); w.erledigt = true; w.erledigtAm = U.today(); await TE.speichern(it);
      const direkt = await AC.OL.nutzen();
      if (w.outlook && await AC.confirm(direkt ? 'Auch aus Outlook löschen?' : 'Auch in Outlook als erledigt markieren?', direkt ? `„${U.esc(w.titel)}“ steht in deinem Outlook-Kalender. Soll der Eintrag dort gelöscht werden?` : `„${U.esc(w.titel)}“ steht in deinem Outlook-Kalender. Soll eine Datei erstellt werden, die den Eintrag dort als „ERLEDIGT“ und frei markiert?`, direkt ? 'Aus Outlook löschen' : 'In Outlook markieren')) await AC.ICS.senden(AC.ICS.eigen(w), 'erledigt');
      else AC.toast('Erledigt'); reload(); });
    v.querySelectorAll('[data-wedit]').forEach(b => b.onclick = async () => { const w = (await TE.eigene()).find(x => x.id === b.dataset.wedit); if (w && await TE.dialog(w)) reload(); });
    v.querySelectorAll('[data-cal]').forEach(b => b.onclick = async () => { const t = TE._last[+b.dataset.cal]; if (!t || !t.cal) return; AC.ICS.senden(t.cal);
      if (t.lgId) { const lg = await AC.LG.get(t.lgId); if (lg) { AC.ICS.markiere(lg, t.cal, false); await AC.LG.save(lg); } }
      if (t.eigen) { const it = await TE.eigene(), w = it.find(x => x.id === t.id); if (w && !w.outlook) { w.outlook = true; await TE.speichern(it); t.outlook = true; b.innerHTML = '📅 aktualisieren'; } } });
  },

  /* ---------- Datensicherung ---------- */
  async ziel(neu) {
    let h = neu ? null : await FS.idb('get', 'backup');
    if (h && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') h = null;
    if (!h) { h = await window.showDirectoryPicker({ id: 'ac-backup', mode: 'readwrite' }); await FS.idb('put', 'backup', h); }
    return h;
  },
  async kopieren(src, dst) { let n = 0; for await (const [name, h] of src.entries()) {
    if (h.kind === 'file') { const f = await h.getFile(), fh = await dst.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(f); await w.close(); n++; }
    else n += await TE.kopieren(h, await dst.getDirectoryHandle(name, { create: true })); } return n; },
  async sichernNach(ziel) {
    if (await FS.root.resolve(ziel)) throw new Error('Der Sicherungsordner liegt innerhalb des Datenordners. Bitte einen Ordner außerhalb wählen, z. B. auf einem USB-Stick.');
    const st = new Date(), name = `AC-Office-Sicherung_${U.today()}_${U.pad(st.getHours(), 2)}${U.pad(st.getMinutes(), 2)}`;
    const n = await TE.kopieren(FS.root, await ziel.getDirectoryHandle(name, { create: true }));
    AC.settings.letzteSicherung = st.toISOString(); AC.settings.sicherungZiel = ziel.name; await AC.saveSettings();
    return { n, name };
  },
  async sichern(neu) {
    try { const z = await TE.ziel(neu); AC.toast('Sicherung läuft …'); const r = await TE.sichernNach(z); AC.toast(`Sicherung fertig: ${r.n} Dateien in ${z.name}\\${r.name}`); return true; }
    catch (e) { if (e.name !== 'AbortError') AC.toast('Sicherung nicht möglich: ' + e.message, true); return false; }
  },
};

AC.views.termine = async (v) => {
  await K.load(); const alle = await TE.alle(), heute = U.today();
  AC.head('Termine & Wiedervorlagen', 'Fälligkeiten aus allen Bereichen plus deine eigenen Wiedervorlagen', `<button class="btn ghost" id="wSync" title="Lehrgänge nach Status mit Outlook abgleichen">🔄 Lehrgänge ↔ Outlook</button><button class="btn light" id="wNeu">+ Termin / Wiedervorlage</button>`);
  const grp = [['Überfällig', t => t.datum < heute], ['Heute', t => t.datum === heute], ['Nächste 7 Tage', t => t.datum > heute && U.days(heute, t.datum) <= 7], ['Später', t => U.days(heute, t.datum) > 7]];
  const eigeneErl = (await TE.eigene()).filter(w => w.erledigt).slice(-10).reverse();
  v.innerHTML = grp.map(([t, f]) => { const l = alle.filter(f); return l.length ? `<div class="card"><h2>${t} (${l.length})</h2>${l.map(TE.zeile).join('')}</div>` : ''; }).join('') || '<div class="card empty">Keine anstehenden Termine. 👍</div>'
    + (eigeneErl.length ? `<div class="card"><h2>Zuletzt erledigt</h2>${eigeneErl.map(w => `<div class="due"><div class="d">${U.de(w.erledigtAm)}</div><div style="flex:1"><s>${U.esc(w.titel)}</s></div><button class="x" data-wdel="${w.id}">✕</button></div>`).join('')}</div>` : '');
  TE.bind(v, () => AC.go('termine'));
  v.querySelectorAll('[data-wdel]').forEach(b => b.onclick = async () => { const it = (await TE.eigene()).filter(x => x.id !== b.dataset.wdel); await TE.speichern(it); AC.go('termine'); });
  document.getElementById('wNeu').onclick = async () => { if (await TE.dialog()) AC.go('termine'); };
  document.getElementById('wSync').onclick = async () => { if (await AC.ICS.abgleich()) AC.go('termine'); };
  AC.OL.chip().then(h => { const b = document.getElementById('wSync'); if (b) b.insertAdjacentHTML('beforebegin', h); });
};
