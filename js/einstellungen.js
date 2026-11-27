/* =====================================================================
   AC Office – Einstellungen (einstellungen.js)
   Gespeichert in einstellungen.json im Datenordner
   ===================================================================== */
'use strict';
AC.views.einstellungen = async (v) => {
  const s = U.clone(AC.settings), F = AC.F;
  AC.head('Einstellungen', 'Absender, Steuer, Bank, Nummernkreise, Leistungskatalog, Mahnwesen', `<button class="btn light" id="stSave">Speichern</button>`);
  const draw = () => {
    v.innerHTML = `
    <div class="card"><h2>Absender (erscheint auf allen Belegen)</h2><div class="grid g4">
      ${F.input('Name', 'absender.name', s.absender.name)}${F.input('Firma', 'absender.firma', s.absender.firma, { span: 2 })}${F.input('Web', 'absender.web', s.absender.web)}
      ${F.input('Positionsbezeichnung', 'absender.titel', s.absender.titel, { span: 2 })}${F.input('Qualifikation', 'absender.quali', s.absender.quali, { span: 2 })}
      ${F.input('Straße', 'absender.strasse', s.absender.strasse, { span: 2 })}${F.input('PLZ', 'absender.plz', s.absender.plz)}${F.input('Ort', 'absender.ort', s.absender.ort)}
      ${F.input('Telefon', 'absender.tel', s.absender.tel)}${F.input('Mobil', 'absender.mobil', s.absender.mobil)}${F.input('E-Mail', 'absender.mail', s.absender.mail, { span: 2 })}</div></div>
    <div class="card"><h2>Steuer</h2>
      ${!s.steuer.steuernummer && !s.steuer.ustid ? '<p class="hint">Pflichtangabe auf jeder Rechnung: Steuernummer oder USt-IdNr. (§ 14 Abs. 4 Satz 1 Nr. 2 UStG). Ohne Eintrag lässt die App keine Rechnung erstellen.</p>' : ''}
      <div class="grid g4">${F.input('Steuernummer', 'steuer.steuernummer', s.steuer.steuernummer, { ph: 'z. B. 119/5xxx/xxxx' })}${F.input('USt-IdNr. (falls vorhanden)', 'steuer.ustid', s.steuer.ustid)}
      <label class="f"><span>Kleinunternehmer (§ 19 UStG)</span><select data-p="steuer.kleinunternehmer"><option value="true"${s.steuer.kleinunternehmer ? ' selected' : ''}>ja – keine USt ausweisen</option><option value="false"${!s.steuer.kleinunternehmer ? ' selected' : ''}>nein – USt ausweisen</option></select></label>
      ${F.input('USt-Satz %', 'steuer.ustSatz', s.steuer.ustSatz, { type: 'number' })}
      ${F.input('Zuständiges Finanzamt', 'steuer.finanzamt', s.steuer.finanzamt || '', { ph: 'z. B. Finanzamt Moers' })}${F.input('Steuerberater/in (optional)', 'steuer.berater', s.steuer.berater || '')}
      ${F.input('E-Mail Steuerberater/in', 'steuer.beraterMail', s.steuer.beraterMail || '', { span: 2 })}</div></div>
    <div class="card"><h2>Outlook-Kalender</h2><div id="olStat" class="small" style="margin-bottom:8px">Prüfe Kalenderdienst …</div>
      <div class="grid g4"><label class="f" style="grid-column:span 2"><span>Termine übertragen</span><select data-p="outlook.modus"><option value="auto"${s.outlook.modus !== 'ics' ? ' selected' : ''}>direkt über den Kalenderdienst – sonst Kalenderdatei (.ics)</option><option value="ics"${s.outlook.modus === 'ics' ? ' selected' : ''}>immer als Kalenderdatei (.ics)</option></select></label>
      <div class="f" style="align-self:end"><button class="btn light" id="olTest">Verbindung testen</button></div></div>
      <p class="small muted">Der Kalenderdienst liegt im App-Ordner unter <b>outlook-dienst</b>: einmal „Kalenderdienst starten.cmd“ und „Autostart einrichten.cmd“ doppelklicken. Er braucht das <b>klassische Outlook</b> (Teil von Microsoft 365) mit deinem Konto. Termine landen im Standardkalender und werden wie jeder andere Outlook-Termin auf Handy und Web synchronisiert.</p></div>
    <div class="card"><h2>Kunden direkt kontaktieren</h2><div class="grid g4">
      <label class="f" style="grid-column:span 2"><span>Anrufe starten über</span><select data-p="kontakt.tel"><option value="tel"${s.kontakt.tel === 'tel' ? ' selected' : ''}>Windows-Standard-App für Telefonie (tel:) – z. B. Smartphone-Link</option><option value="callto"${s.kontakt.tel === 'callto' ? ' selected' : ''}>Softphone / Skype (callto:)</option></select></label>
      ${F.input('Betreff für neue E-Mails', 'kontakt.betreff', s.kontakt.betreff, { span: 2 })}</div>
      <p class="small muted">Welche App sich öffnet, legst du in Windows fest: Einstellungen → Apps → Standard-Apps → „Standardwerte nach Linktyp auswählen“ → <b>TEL</b> (z. B. Smartphone-Link) und <b>MAILTO</b> (z. B. Outlook).</p></div>
    <div class="card"><h2>Bankverbindung</h2><div class="grid g4">${F.input('Bank', 'bank.name', s.bank.name)}${F.input('IBAN', 'bank.iban', s.bank.iban)}${F.input('BIC', 'bank.bic', s.bank.bic)}${F.input('PayPal', 'bank.paypal', s.bank.paypal)}</div>
      <p class="small muted">IBAN und BIC werden auch für den GiroCode auf Rechnungen und Mahnungen verwendet.</p></div>
    <div class="card"><h2>Nummernkreise und Zahlungsziel</h2><div class="grid g4">
      ${F.input('Präfix Rechnungen', 'nummern.rechnungPraefix', s.nummern.rechnungPraefix)}${F.input(`Nächste Rechnungsnummer (${s.nummern.rechnungJahr})`, 'nummern.rechnung', s.nummern.rechnung, { type: 'number' })}
      ${F.input('Nächste Kundennummer', 'nummern.kunde', s.nummern.kunde, { type: 'number' })}${F.input('Zahlungsziel Standard (Tage)', 'zahlungsziel', s.zahlungsziel, { type: 'number' })}
      ${F.input('Angebote gültig (Tage)', 'angebotGueltig', s.angebotGueltig, { type: 'number' })}</div>
      <p class="small muted">Rechnungsnummern: ${U.esc(s.nummern.rechnungPraefix)}-${s.nummern.rechnungJahr}-${U.pad(s.nummern.rechnung, 4)} usw., fortlaufend; zum Jahreswechsel beginnt der Zähler automatisch wieder bei 0001. Nummern nur ändern, wenn du bewusst an einen bestehenden Nummernkreis anschließen willst.</p></div>
    <div class="card"><h2>Leistungskatalog (Rechnungsbausteine)</h2>
      <div class="tw"><table class="t"><thead><tr><th>Gruppe</th><th>Bezeichnung</th><th>Beschreibung</th><th>Einheit</th><th>Preis €</th><th></th></tr></thead><tbody>
      ${s.katalog.map((x, i) => `<tr><td style="width:14%"><input data-p="katalog.${i}.gruppe" value="${U.esc(x.gruppe)}"></td><td><input data-p="katalog.${i}.bez" value="${U.esc(x.bez)}"></td><td><input data-p="katalog.${i}.text" value="${U.esc(x.text)}"></td>
        <td style="width:100px"><input data-p="katalog.${i}.einheit" value="${U.esc(x.einheit)}"></td><td style="width:110px"><input type="number" step="0.01" data-p="katalog.${i}.preis" value="${x.preis}"></td><td><button class="x" data-kdel="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn light sm" id="kAdd" style="margin-top:8px">+ Baustein</button></div>
    <div class="card"><h2>Dokumente ohne Unterschrift</h2>
      <p class="small">Wo keine Form vorgeschrieben ist, erhalten die PDFs statt einer Unterschriftslinie den Hinweis „elektronisch erstellt und ohne Unterschrift gültig“ mit Rechtsgrundlage: Rechnungen (§ 14 UStG), Angebote (§§ 125, 145 ff. BGB), Zahlungserinnerungen und Mahnungen (§ 286 Abs. 1 BGB), Schutzkonzepte (Verfasser), Stundennachweise (Dozent) und Teilnahmebescheinigungen.</p>
      <div class="checks">${F.check('Hinweis statt eigener Unterschrift verwenden', 'ohneUnterschrift', s.ohneUnterschrift !== false)}${F.check('auch auf Teilnahmebescheinigungen', 'ohneUnterschriftBescheinigung', s.ohneUnterschriftBescheinigung !== false)}</div>
      <p class="hint small" style="margin-top:8px">Unterschriften bleiben, wo sie Beweis oder Pflicht sind: Anwesenheitslisten, Unterweisungsnachweise, Bestätigung des Auftraggebers, Kenntnisnahme beim Schutzkonzept und alle Schießstand-Unterlagen (u. a. Einverständnis nach § 27 Abs. 3 WaffG). Manche Bildungsträger oder Behörden verlangen trotzdem eine unterschriebene Teilnahmebescheinigung – dann den zweiten Haken entfernen.</p></div>
    <div class="card"><h2>Textbausteine</h2><div class="grid g2">${F.area('Einleitung Rechnung', 'texte.rechnungEinleitung', s.texte.rechnungEinleitung, { rows: 2 })}${F.area('Schlusstext Rechnung', 'texte.rechnungSchluss', s.texte.rechnungSchluss, { rows: 2 })}${F.input('Grußformel', 'texte.gruss', s.texte.gruss)}<span></span>
      ${F.area('Einleitung Angebot', 'texte.angebotEinleitung', s.texte.angebotEinleitung, { rows: 2 })}${F.area('Schlusstext Angebot', 'texte.angebotSchluss', s.texte.angebotSchluss, { rows: 2 })}</div></div>
    <div class="card"><h2>Mahnwesen</h2>
      <p class="hint">Basiszinssatz nach § 247 BGB – wird zum 1. Januar und 1. Juli von der Deutschen Bundesbank neu festgelegt (bundesbank.de → Basiszinssatz).</p>
      <div class="grid g4">${F.input('Basiszinssatz %', 'mahnung.basiszins', s.mahnung.basiszins, { type: 'number', step: '0.01' })}${F.input('gültig seit', 'mahnung.basiszinsAb', s.mahnung.basiszinsAb, { type: 'date' })}${F.input('Zuständiges Mahngericht', 'mahnung.mahngericht', s.mahnung.mahngericht, { span: 2 })}</div>
      ${s.mahnung.stufen.map((m, i) => `<h3 style="margin-top:16px">${i + 1}. Stufe</h3><div class="grid g4">${F.input('Bezeichnung', `mahnung.stufen.${i}.titel`, m.titel)}${F.input('Frist (Tage)', `mahnung.stufen.${i}.frist`, m.frist, { type: 'number' })}
        ${F.input('Mahnkosten € (nur tatsächliche Kosten)', `mahnung.stufen.${i}.gebuehr`, m.gebuehr, { type: 'number', step: '0.01' })}<div class="checks" style="grid-template-columns:1fr;align-self:end">${F.check('Verzugszinsen', `mahnung.stufen.${i}.zinsen`, m.zinsen)}${F.check('40-€-Pauschale (nur B2B)', `mahnung.stufen.${i}.pauschale`, m.pauschale)}</div>
        ${F.area('Text – Platzhalter {frist}, {verzug}, {nr}, {betrag}', `mahnung.stufen.${i}.text`, m.text, { span: 4, rows: 3 })}</div>`).join('')}</div>
    <div class="card"><h2>Datenordner</h2><p>Verbunden: <b>${U.esc(document.getElementById('folderName').textContent)}</b>. Struktur: <code>kunden</code>, <code>rechnungen</code> (+ <code>entwuerfe</code>), <code>mahnungen</code>, <code>schutzkonzepte</code>, <code>vorlagen</code>, <code>einstellungen.json</code>.</p>
      <p class="small muted">Aufbewahrungsfristen beachten: Rechnungen und Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 3 AO).</p>
      <button class="btn light" id="stFolder">Anderen Datenordner wählen …</button></div>
    <div class="card"><h2>Datensicherung</h2>
      <p>${s.letzteSicherung ? `Letzte Sicherung: <b>${new Date(s.letzteSicherung).toLocaleString('de-DE')}</b>${s.sicherungZiel ? ' in „' + U.esc(s.sicherungZiel) + '“' : ''}` : '<b>Noch keine Sicherung erstellt.</b>'}</p>
      <p class="small muted">„Jetzt sichern“ kopiert den kompletten Datenordner in einen Unterordner mit Datum und Uhrzeit. Ideal: ein USB-Stick oder ein Ordner in deiner Cloud – nicht innerhalb des Datenordners.</p>
      <div class="grid g4" style="margin-bottom:10px">${F.input('Erinnerung nach (Tagen)', 'sicherungIntervall', s.sicherungIntervall, { type: 'number' })}</div>
      <div class="row"><button class="btn" id="bkNow">Jetzt sichern</button><button class="btn light" id="bkNew">Sicherungsziel ändern …</button></div></div>`;
    F.bind(v, s, (p, val) => { if (p === 'steuer.kleinunternehmer') s.steuer.kleinunternehmer = val === 'true'; });
    v.querySelectorAll('[data-kdel]').forEach(b => b.onclick = () => { s.katalog.splice(+b.dataset.kdel, 1); draw(); });
    v.querySelector('#kAdd').onclick = () => { s.katalog.push({ gruppe: 'Sonstiges', bez: '', text: '', einheit: 'Stk.', preis: 0 }); draw(); };
    v.querySelector('#olTest').onclick = () => AC.OL.test();
    AC.OL.status().then(st => { const el = v.querySelector('#olStat'); if (el) el.innerHTML = st.aktiv ? `<b style="color:var(--gruen)">● Kalenderdienst aktiv</b> – Termine werden direkt in Outlook angelegt, geändert und gelöscht.${st.s && st.s.outlookKlassisch === false ? ' <span style="color:var(--rot)">Achtung: klassisches Outlook wurde auf diesem PC nicht gefunden.</span>' : ''}` : `<b>○ Kalenderdienst läuft nicht</b> – es werden Kalenderdateien (.ics) erstellt.`; });
    v.querySelector('#bkNow').onclick = async () => { if (await TE.sichern()) { s.letzteSicherung = AC.settings.letzteSicherung; s.sicherungZiel = AC.settings.sicherungZiel; draw(); } };
    v.querySelector('#bkNew').onclick = async () => { if (await TE.sichern(true)) { s.letzteSicherung = AC.settings.letzteSicherung; s.sicherungZiel = AC.settings.sicherungZiel; draw(); } };
    v.querySelector('#stFolder').onclick = async () => { try { await FS.pick(); await AC.boot(); AC.toast('Datenordner gewechselt'); } catch (e) { /* abgebrochen */ } };
  };
  draw();
  document.getElementById('stSave').onclick = async () => {
    ['nummern.rechnung', 'nummern.kunde', 'zahlungsziel', 'steuer.ustSatz', 'mahnung.basiszins', 'angebotGueltig', 'sicherungIntervall'].forEach(p => U.set(s, p, U.num(U.get(s, p))));
    s.mahnung.stufen.forEach(m => { m.frist = U.num(m.frist); m.gebuehr = U.num(m.gebuehr); }); s.katalog.forEach(x => x.preis = U.num(x.preis));
    AC.settings = s; await AC.saveSettings(); AC.toast('Einstellungen gespeichert'); AC.go('einstellungen');
  };
};
