/* =====================================================================
   AC Office – direkte Outlook-Anbindung (outlook.js)
   Die App schreibt Aufträge in den Datenordner (outlook/auftrag_*.json).
   Der Kalenderdienst (Ordner "outlook-dienst", PowerShell + klassisches Outlook)
   führt sie aus und legt das Ergebnis ab (outlook/ergebnis_*.json).
   Läuft der Dienst nicht, nutzt die App wie bisher Kalenderdateien (.ics).
   ===================================================================== */
'use strict';
const OL = AC.OL = {
  modus: () => (AC.settings.outlook && AC.settings.outlook.modus) || 'auto',   // 'auto' | 'ics'
  /* Status des Dienstes: Lebenszeichen alle 5 Sekunden in outlook/status.json */
  async status() {
    const s = await FS.readJSON('outlook/status.json').catch(() => null);
    const alter = s && s.zeit ? (Date.now() - Date.parse(s.zeit)) / 1000 : Infinity;
    return { aktiv: alter < 20, s, alter };
  },
  async nutzen() { if (AC.mobil) return false; return OL.modus() !== 'ics' && (await OL.status()).aktiv; },
  /* Auftrag schreiben und auf das Ergebnis warten */
  async auftrag(aktionen, titel) {
    const id = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '-' + U.uid().slice(0, 4);
    await FS.writeJSON(`outlook/auftrag_${id}.json`, { id, erstellt: new Date().toISOString(), aktionen });
    AC.toast(`${titel || 'Outlook'}: Auftrag an den Kalenderdienst übergeben …`);
    for (let i = 0; i < 120; i++) {   // max. 2 Minuten (Outlook startet ggf. erst)
      await new Promise(r => setTimeout(r, 1000));
      const e = await FS.readJSON(`outlook/ergebnis_${id}.json`).catch(() => null);
      if (e) { FS.remove(`outlook/ergebnis_${id}.json`).catch(() => { }); return e; }
    }
    FS.remove(`outlook/auftrag_${id}.json`).catch(() => { });   // nicht später unerwartet ausführen
    return { id, ok: false, ergebnisse: [{ art: 'warten', ok: false, meldung: 'Keine Antwort vom Kalenderdienst. Läuft er noch? (Ordner outlook-dienst → „Kalenderdienst starten“)' }] };
  },
  /* Kalender-Eintrag (wie für .ics) → Auftrag für den Dienst */
  aktion(e, loeschen) {
    if (loeschen) return { art: 'loeschen', uid: e.uid };
    const ende = e.letzter || (e.bis && e.bis > e.datum ? e.bis : e.datum);
    return { art: 'speichern', uid: e.uid, titel: e.titel, ort: e.ort || '', text: e.text || '', ganztags: !e.von, beginn: e.datum, ende,
      von: e.von || '', bis: e.von ? (e.ende && e.ende > e.von ? e.ende : AC.ICS.plus1h(e.von)) : '', ausnahmen: e.exdates || [], beschaeftigt: !e.frei,
      anlagen: (e.anlagen || []).map(a => a.pfad), links: e.links || [] };
  },
  meldung(r) { const f = (r.ergebnisse || []).filter(x => !x.ok);
    return f.length ? f.map(x => x.meldung).join(' · ') : (r.ergebnisse || []).map(x => x.meldung).join(' · '); },
  /* Statusanzeige (für Kopfzeilen) */
  async chip() { if (AC.mobil) return '<span class="ol-chip" title="Der Outlook-Abgleich läuft über den Laptop">📱 Outlook: über Laptop</span>';
    if (OL.modus() === 'ics') return '<span class="ol-chip">Outlook: Kalenderdateien</span>';
    const st = await OL.status(); return st.aktiv ? '<span class="ol-chip on" title="Termine werden direkt in Outlook angelegt, geändert und gelöscht">● Outlook direkt verbunden</span>'
      : '<span class="ol-chip" title="Kalenderdienst läuft nicht – es werden Kalenderdateien (.ics) erstellt">○ Outlook: Kalenderdateien</span>'; },
  async test() {
    const st = await OL.status();
    if (!st.aktiv) return AC.dialog('Outlook-Verbindung', `<p>Der <b>Kalenderdienst läuft nicht</b>${st.s ? ` (letztes Lebenszeichen vor ${Math.round(st.alter / 60)} Min.)` : ''}.</p>
      <p class="small">Im App-Ordner <b>AC-Office\\outlook-dienst</b> doppelt auf <b>„Kalenderdienst starten.cmd“</b> klicken – und für den Dauerbetrieb einmal auf <b>„Autostart einrichten.cmd“</b>. Danach hier erneut testen.</p>`, [['OK', 'ok']], 'small');
    const r = await OL.auftrag([{ art: 'test' }], 'Verbindungstest');
    return AC.dialog('Outlook-Verbindung', r.ok ? `<p>✓ <b>Verbindung steht.</b></p><p class="small">${U.esc(OL.meldung(r))}${r.outlook ? ` · ${r.outlook.anzahl} Einträge im Kalender` : ''}</p>`
      : `<p class="hint">${U.esc(OL.meldung(r))}</p><p class="small muted">Protokoll: Datenordner\\outlook\\dienst.log</p>`, [['OK', 'ok']], 'small');
  },
};
