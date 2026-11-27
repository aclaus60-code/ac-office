/* =====================================================================
   AC Office – Kunden (kunden.js)
   Jeder Kunde = eine Datei im Ordner "kunden", z. B. kunden/K-0001_Muster-GmbH.json
   ===================================================================== */
'use strict';
const K = AC.K = {
  list: [],
  async load() { K.list = (await FS.readAll('kunden')).sort((a, b) => K.name(a).localeCompare(K.name(b), 'de')); },
  get: id => K.list.find(k => k.id === id),
  name: k => !k ? '–' : (k.typ === 'firma' ? (k.firma || '(ohne Firmenname)') : [k.nachname, k.vorname].filter(Boolean).join(', ') || '(ohne Namen)'),
  ort: k => [k.plz, k.ort].filter(Boolean).join(' '),
  b2b: k => k && k.typ === 'firma',
  fileOf: k => `${k.id}_${U.slug(K.name(k))}.json`,
  blank() {
    return { id: '', typ: 'firma', firma: '', zusatz: '', anrede: '', vorname: '', nachname: '', strasse: '', plz: '', ort: '', land: 'Deutschland',
      tel: '', mobil: '', mail: '', ustid: '', zahlungsziel: AC.settings.zahlungsziel, notiz: '', archiviert: false, angelegt: '', geaendert: '' };
  },
  async save(k) {
    if (!k.id) { const n = AC.settings.nummern.kunde; k.id = 'K-' + U.pad(n, 4); AC.settings.nummern.kunde = n + 1; await AC.saveSettings(); k.angelegt = new Date().toISOString(); }
    k.geaendert = new Date().toISOString();
    const file = K.fileOf(k), old = k._file; const data = Object.assign({}, k); delete data._file;
    await FS.writeJSON('kunden/' + file, data);
    if (old && old !== file) await FS.remove('kunden/' + old);
    k._file = file; await K.load(); return k;
  },
  /* Auswahlliste für andere Bereiche */
  options: (sel, withEmpty = true) => (withEmpty ? '<option value="">– Kunde wählen –</option>' : '') +
    K.list.filter(k => !k.archiviert || k.id === sel).map(k => `<option value="${k.id}"${k.id === sel ? ' selected' : ''}>${U.esc(K.name(k))} (${k.id})</option>`).join(''),
  /* ---------- Direkt kontaktieren ---------- */
  /* Rufnummer für Links: Leerzeichen/Klammern raus, 0… → +49… */
  nummer(n) { let x = String(n || '').replace(/\(0\)/g, '').replace(/[^\d+]/g, ''); if (!x) return ''; if (x.startsWith('00')) x = '+' + x.slice(2); else if (x.startsWith('0')) x = '+49' + x.slice(1); return x; },
  telHref: n => `${(AC.settings.kontakt && AC.settings.kontakt.tel) || 'tel'}:${K.nummer(n)}`,
  mailHref: (k, betreff) => `mailto:${encodeURIComponent(k.mail).replace(/%40/g, '@')}?subject=${encodeURIComponent(betreff || (AC.settings.kontakt && AC.settings.kontakt.betreff) || '')}`,
  kontakt(k) {
    const b = [], ap = [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ');
    if (k.mail) b.push(`<a class="btn sm" href="${U.esc(K.mailHref(k))}" title="E-Mail an ${U.esc(k.mail)} – öffnet dein Standard-Mailprogramm">✉ E-Mail</a>`);
    if (k.tel) b.push(`<a class="btn sm" href="${U.esc(K.telHref(k.tel))}" title="${U.esc(k.tel)} anrufen – über die Standard-App für Telefonie (z. B. Smartphone-Link)">📞 Telefon</a>`);
    if (k.mobil) b.push(`<a class="btn sm" href="${U.esc(K.telHref(k.mobil))}" title="${U.esc(k.mobil)} anrufen">📱 Mobil</a>`,
      `<a class="btn sm light" href="sms:${U.esc(K.nummer(k.mobil))}" title="SMS über Smartphone-Link">💬 SMS</a>`,
      `<a class="btn sm light" href="https://wa.me/${K.nummer(k.mobil).replace('+', '')}" target="_blank" rel="noopener" title="Chat in WhatsApp öffnen">WhatsApp</a>`);
    if (k.strasse && k.ort) b.push(`<a class="btn sm light" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([k.strasse, k.plz, k.ort].join(' '))}" target="_blank" rel="noopener" title="Route planen">🧭 Route</a>`);
    return b.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${b.join('')}${ap && k.typ === 'firma' ? `<span class="small muted">Ansprechpartner: ${U.esc(ap)}</span>` : ''}</div>`
      : '<p class="small muted" style="margin:0">Trag unten Telefon, Mobil oder E-Mail ein – dann kannst du den Kunden hier direkt anrufen oder anschreiben.</p>';
  },
  /* Kopie der Anschrift für Belege (bleibt unverändert, auch wenn der Kunde später geändert wird) */
  snapshot: k => { const s = Object.assign({}, k); delete s._file; delete s.notiz; return s; },
};

/* ---------- Ansicht: Kundenliste ---------- */
AC.views.kunden = async (v) => {
  await K.load();
  AC.head('Kunden', `${K.list.filter(k => !k.archiviert).length} aktive Kunden · Ablage: Ordner „kunden“`, `<button class="btn ghost" id="kNeu">+ Neuer Kunde</button>`);
  document.getElementById('kNeu').onclick = () => AC.go('kunde');
  let showArch = false, q = '';
  const draw = () => {
    const rows = K.list.filter(k => (showArch || !k.archiviert) && (!q || JSON.stringify(k).toLowerCase().includes(q)));
    v.querySelector('#kList').innerHTML = rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Name / Firma</th><th>Art</th><th>Ansprechpartner</th><th>Ort</th><th>Telefon</th><th>E-Mail</th></tr></thead><tbody>
      ${rows.map(k => `<tr class="click" data-id="${k.id}"><td>${k.id}</td><td><b>${U.esc(K.name(k))}</b>${k.archiviert ? ' <span class="badge">archiviert</span>' : ''}</td><td>${k.typ === 'firma' ? 'Firma' : 'Privat'}</td>
      <td>${U.esc(k.typ === 'firma' ? [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ') : '')}</td><td>${U.esc(K.ort(k))}</td><td>${[k.tel, k.mobil].filter(Boolean).map(n => `<a class="lnk" href="${U.esc(K.telHref(n))}" title="anrufen">📞 ${U.esc(n)}</a>`).join('<br>')}</td><td>${k.mail ? `<a class="lnk" href="${U.esc(K.mailHref(k))}" title="E-Mail schreiben">✉ ${U.esc(k.mail)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Noch keine Kunden. Lege mit „+ Neuer Kunde“ den ersten an.</div>';
    v.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => AC.go('kunde', tr.dataset.id));
    v.querySelectorAll('a.lnk').forEach(l => l.onclick = e => e.stopPropagation());
  };
  v.innerHTML = `<div class="card"><div class="row"><input id="kSuche" placeholder="Suchen nach Name, Ort, E-Mail …" style="max-width:420px">
    <label class="row small" style="gap:6px"><input type="checkbox" id="kArch"> archivierte anzeigen</label></div></div><div id="kList"></div>`;
  v.querySelector('#kSuche').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  v.querySelector('#kArch').onchange = e => { showArch = e.target.checked; draw(); };
  draw();
};

/* ---------- Ansicht: Kunde anlegen / bearbeiten ---------- */
AC.views.kunde = async (v, id) => {
  await K.load();
  const k = id ? U.clone(K.get(id)) : K.blank(); if (id) k._file = K.get(id)._file;
  const F = AC.F;
  AC.head(id ? K.name(k) : 'Neuer Kunde', id ? `${k.id} · Datei: kunden/${k._file}` : 'Die Kundennummer wird beim Speichern vergeben',
    `<button class="btn ghost" id="kBack">← Zur Liste</button><button class="btn light" id="kSave">Speichern</button>`);
  const draw = () => {
    v.innerHTML = `
    <div class="card"><h2>Kontakt aufnehmen</h2><div id="kKontakt">${K.kontakt(k)}</div></div>
    <div class="card"><h2>Stammdaten</h2>
      <div class="grid g4">
        ${F.select('Kundenart', 'typ', k.typ, [['firma', 'Firma / Behörde / Bildungsträger (B2B)'], ['privat', 'Privatperson (Verbraucher)']], { span: 2 })}
        ${F.input('Kundennummer', '_id', k.id || 'wird vergeben')}
        ${F.input('Zahlungsziel (Tage)', 'zahlungsziel', k.zahlungsziel, { type: 'number' })}
        ${k.typ === 'firma' ? F.input('Firma / Organisation *', 'firma', k.firma, { span: 2 }) + F.input('Zusatz (Abteilung, z. Hd.)', 'zusatz', k.zusatz, { span: 2 }) : ''}
        ${F.select('Anrede', 'anrede', k.anrede, [['', '–'], 'Herr', 'Frau', ['Divers', 'ohne Anrede']])}
        ${F.input('Vorname', 'vorname', k.vorname)}
        ${F.input(k.typ === 'firma' ? 'Nachname Ansprechpartner' : 'Nachname *', 'nachname', k.nachname, { span: 2 })}
        ${F.input('Straße und Hausnummer *', 'strasse', k.strasse, { span: 2 })}
        ${F.input('PLZ *', 'plz', k.plz)}
        ${F.input('Ort *', 'ort', k.ort)}
        ${F.input('Land', 'land', k.land)}
        ${F.input('Telefon', 'tel', k.tel)}
        ${F.input('Mobil', 'mobil', k.mobil || '')}
        ${F.input('E-Mail', 'mail', k.mail, { type: 'email', span: 2 })}
        ${k.typ === 'firma' ? F.input('USt-IdNr. des Kunden (optional)', 'ustid', k.ustid, { span: 2 }) : ''}
        ${F.area('Notizen (intern, erscheinen auf keinem Beleg)', 'notiz', k.notiz, { span: 4, rows: 3 })}
      </div>
      <p class="small muted" style="margin-top:10px">Bei Privatpersonen nimmt die App auf Rechnungen automatisch den Verzugshinweis nach § 286 Abs. 3 BGB auf und berechnet in Mahnungen keine 40-€-Pauschale (§ 288 Abs. 5 BGB gilt nur gegenüber Unternehmern).</p>
    </div>
    ${id ? `<div class="card"><h2>Belege zu diesem Kunden</h2><div id="kDocs" class="small muted">Lade …</div></div>
    <div class="card"><div class="row"><button class="btn light" id="kArchiv">${k.archiviert ? 'Wieder aktivieren' : 'Archivieren'}</button>
      <button class="btn red" id="kDel">Kundendatei löschen</button><span class="small muted">Archivieren blendet den Kunden aus, die Datei bleibt erhalten.</span></div></div>` : ''}`;
    v.querySelector('[data-p="_id"]').disabled = true;
    F.bind(v, k, p => { if (p === 'typ') draw(); else if (/^(tel|mobil|mail|strasse|plz|ort|anrede|vorname|nachname)$/.test(p)) v.querySelector('#kKontakt').innerHTML = K.kontakt(k); });
    if (id) {
      v.querySelector('#kArchiv').onclick = async () => { k.archiviert = !k.archiviert; await K.save(k); AC.toast(k.archiviert ? 'Kunde archiviert' : 'Kunde wieder aktiv'); AC.go('kunde', k.id); };
      v.querySelector('#kDel').onclick = async () => {
        if (!await AC.confirm('Kunde löschen?', `Die Datei <b>kunden/${U.esc(k._file)}</b> wird endgültig gelöscht. Rechnungen und Schutzkonzepte bleiben erhalten (sie enthalten eine eigene Kopie der Anschrift).`, 'Endgültig löschen')) return;
        await FS.remove('kunden/' + k._file); AC.toast('Kunde gelöscht'); AC.go('kunden');
      };
      (async () => {
        const re = (await AC.R.loadAll()).filter(r => r.kundeId === k.id), sk = (await AC.SK.loadAll()).filter(s => s.kundeId === k.id),
          an = (await AC.AN.loadAll()).filter(a => a.kundeId === k.id), lg = (await AC.LG.loadAll()).filter(l => l.kundeId === k.id);
        v.querySelector('#kDocs').innerHTML = (re.length || sk.length || an.length || lg.length) ? `<div class="tw"><table class="t"><thead><tr><th>Beleg</th><th>Datum</th><th>Betreff</th><th class="num">Betrag</th><th>Status</th></tr></thead><tbody>
          ${re.map(r => `<tr class="click" data-r="${r.nr}"><td>Rechnung ${r.nr}</td><td>${U.de(r.datum)}</td><td>${U.esc(r.bezug || '')}</td><td class="num">${U.eur(r.summen.brutto)}</td><td>${AC.R.badge(r)}</td></tr>`).join('')}
          ${an.map(a => `<tr class="click" data-an="${a.nr}"><td>Angebot ${a.nr}</td><td>${U.de(a.datum)}</td><td>${U.esc(a.bezug || '')}</td><td class="num">${U.eur(a.summen.brutto)}</td><td>${AC.AN.badge(a)}</td></tr>`).join('')}
          ${lg.map(l => `<tr class="click" data-lg="${l.id}"><td>Lehrgang ${l.id}</td><td>${U.de(l.von)}</td><td>${U.esc(l.titel)}</td><td></td><td><span class="badge">${U.esc(l.status)}</span></td></tr>`).join('')}
          ${sk.map(s => `<tr class="click" data-s="${s.id}"><td>Schutzkonzept ${s.id}</td><td>${U.de(s.datum)}</td><td>${U.esc(s.objekt || '')}</td><td></td><td><span class="badge">${U.esc(s.status)}</span></td></tr>`).join('')}</tbody></table></div>` : 'Noch keine Belege.';
        v.querySelectorAll('[data-r]').forEach(t => t.onclick = () => AC.go('rechnung', t.dataset.r));
        v.querySelectorAll('[data-s]').forEach(t => t.onclick = () => AC.go('schutzkonzept', t.dataset.s));
        v.querySelectorAll('[data-an]').forEach(t => t.onclick = () => AC.go('angebot', t.dataset.an));
        v.querySelectorAll('[data-lg]').forEach(t => t.onclick = () => AC.go('lehrgang', t.dataset.lg));
      })();
    }
  };
  draw();
  document.getElementById('kBack').onclick = () => AC.go('kunden');
  document.getElementById('kSave').onclick = async () => {
    const miss = [];
    if (k.typ === 'firma' && !k.firma) miss.push('Firma'); if (k.typ === 'privat' && !k.nachname) miss.push('Nachname');
    if (!k.strasse) miss.push('Straße'); if (!k.plz) miss.push('PLZ'); if (!k.ort) miss.push('Ort');
    if (miss.length) return AC.toast('Bitte ergänzen: ' + miss.join(', '), true);
    await K.save(k); AC.toast(`Gespeichert: kunden/${k._file}`); AC.go('kunde', k.id);
  };
};
