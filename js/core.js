/* =====================================================================
   AC Office – Kern (core.js)
   1. Hilfsfunktionen (Formatierung, Datum, Geld)
   2. Datenordner (File System Access API von Edge/Chrome)
   3. Einstellungen (einstellungen.json im Datenordner)
   4. Navigation, Dialoge, Meldungen
   ===================================================================== */
'use strict';
window.AC = window.AC || {};

/* ---------- 1. HILFSFUNKTIONEN ---------- */
const U = AC.U = {
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  num: v => { if (typeof v === 'number') return v; const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; },
  r2: v => Math.round((v + Number.EPSILON) * 100) / 100,
  eur: v => (U.r2(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
  n2: v => (U.r2(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  nf: v => (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 2 }),
  today: () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
  addDays: (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + Number(n || 0)); return d.toISOString().slice(0, 10); },
  days: (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000),
  de: iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '',
  slug: s => String(s || '').normalize('NFC').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').normalize('NFKD')
    .replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'ohne-Name',
  pad: (n, l) => String(n).padStart(l, '0'),
  clone: o => JSON.parse(JSON.stringify(o)),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  /* Wert aus Objekt per Pfad lesen/schreiben, z. B. 'absender.ort' */
  get: (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o),
  set: (o, p, v) => { const k = p.split('.'); let a = o; k.slice(0, -1).forEach(x => { a[x] = a[x] ?? {}; a = a[x]; }); a[k.at(-1)] = v; },
};

/* Formular-Bausteine: erzeugen Eingabefelder, die direkt an ein Datenobjekt gebunden sind */
AC.F = {
  input: (label, path, val, o = {}) => `<label class="f"${o.span ? ` style="grid-column:span ${o.span}"` : ''}><span>${U.esc(label)}</span><input data-p="${path}" type="${o.type || 'text'}" value="${U.esc(val ?? '')}"${o.ph ? ` placeholder="${U.esc(o.ph)}"` : ''}${o.step ? ` step="${o.step}"` : ''}${o.list ? ` list="${o.list}"` : ''}></label>`,
  area: (label, path, val, o = {}) => `<label class="f"${o.span ? ` style="grid-column:span ${o.span}"` : ''}><span>${U.esc(label)}</span><textarea data-p="${path}" rows="${o.rows || 3}"${o.ph ? ` placeholder="${U.esc(o.ph)}"` : ''}>${U.esc(val ?? '')}</textarea></label>`,
  select: (label, path, val, opts, o = {}) => `<label class="f"${o.span ? ` style="grid-column:span ${o.span}"` : ''}><span>${U.esc(label)}</span><select data-p="${path}">${opts.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${U.esc(v)}"${String(v) === String(val ?? '') ? ' selected' : ''}>${U.esc(t)}</option>`; }).join('')}</select></label>`,
  check: (label, path, val) => `<label><input type="checkbox" data-p="${path}"${val ? ' checked' : ''}> ${U.esc(label)}</label>`,
  /* bindet alle Felder mit data-p in "root" an das Objekt "obj"; onChange wird nach jeder Änderung aufgerufen */
  bind(root, obj, onChange) {
    root.querySelectorAll('[data-p]').forEach(el => {
      const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
        U.set(obj, el.dataset.p, v);
        onChange && onChange(el.dataset.p, v, el);
      });
    });
  },
};

/* ---------- 2. DATENORDNER ---------- */
const FS = AC.FS = {
  root: null, demo: false,
  /* kleiner Schlüsselspeicher im Browser, nur um den gewählten Ordner wiederzufinden (keine Cookies) */
  async idb(mode, key, val) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ac-office', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite'); const st = tx.objectStore('kv');
      const r = mode === 'get' ? st.get(key) : mode === 'del' ? st.delete(key) : st.put(val, key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  supported: () => 'showDirectoryPicker' in window,
  async pick() {
    const h = await window.showDirectoryPicker({ id: 'ac-office', mode: 'readwrite' });
    await FS.use(h); await FS.idb('put', 'root', h);
  },
  async restore() {
    try { const h = await FS.idb('get', 'root'); if (!h) return 'none';
      const p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') { await FS.use(h); return 'ok'; }
      FS._pending = h; return 'ask';
    } catch (e) { return 'none'; }
  },
  async reconnect() { const h = FS._pending; if (!h) return false; const p = await h.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') return false; await FS.use(h); return true; },
  async useDemo() { FS.demo = true; await FS.use(await navigator.storage.getDirectory(), 'Testmodus (Browser-Speicher)'); },
  async use(h, name) {
    FS.root = h;
    for (const d of ['kunden', 'angebote', 'rechnungen', 'rechnungen/entwuerfe', 'mahnungen', 'lehrgaenge', 'schulungsunterlagen', 'ausgaben', 'auswertungen', 'schutzkonzepte', 'vorlagen']) await FS.dir(d);
    document.getElementById('folderName').textContent = name || h.name;
  },
  async dir(path, create = true) {
    let d = FS.root; if (!path) return d;
    for (const part of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(part, { create });
    return d;
  },
  split: path => { const i = path.lastIndexOf('/'); return [i < 0 ? '' : path.slice(0, i), path.slice(i + 1)]; },
  async write(path, data) {
    const [dp, fn] = FS.split(path); const d = await FS.dir(dp);
    const fh = await d.getFileHandle(fn, { create: true }); const w = await fh.createWritable();
    await w.write(typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data); await w.close();
  },
  writeJSON: (path, obj) => FS.write(path, JSON.stringify(obj, null, 2)),
  async file(path) { const [dp, fn] = FS.split(path); const d = await FS.dir(dp, false); return (await d.getFileHandle(fn)).getFile(); },
  async readJSON(path) { try { return JSON.parse(await (await FS.file(path)).text()); } catch (e) { return null; } },
  async list(dirPath, ext) {
    const out = []; let d; try { d = await FS.dir(dirPath, false); } catch (e) { return out; }
    for await (const [name, h] of d.entries()) if (h.kind === 'file' && (!ext || name.toLowerCase().endsWith(ext))) out.push(name);
    return out.sort();
  },
  async readAll(dirPath) { const r = []; for (const n of await FS.list(dirPath, '.json')) { const o = await FS.readJSON(dirPath + '/' + n); if (o) { o._file = n; r.push(o); } } return r; },
  async remove(path) { const [dp, fn] = FS.split(path); try { await (await FS.dir(dp, false)).removeEntry(fn); } catch (e) { /* nicht vorhanden */ } },
  async removeDir(path) { const [dp, fn] = FS.split(path); try { await (await FS.dir(dp, false)).removeEntry(fn, { recursive: true }); return true; } catch (e) { return false; } },
  async open(path) { const f = await FS.file(path); AC.openBlob(f); },
};

/* ---------- 3. EINSTELLUNGEN ---------- */
AC.DEFAULTS = {
  version: 1,
  kontakt: { tel: 'tel', betreff: 'AC Security Consulting & Training' },
  outlook: { modus: 'auto' },
  /* persönliche Angaben stehen nur in einstellungen.json im Datenordner (nicht im Programmcode) */
  absender: { name: '', firma: 'AC Security Consulting & Training', titel: 'Inhaber · Dozent & Sicherheitsberater', quali: '',
    strasse: '', plz: '', ort: '', tel: '', mobil: '', mail: '', web: '' },
  steuer: { steuernummer: '', ustid: '', kleinunternehmer: true, ustSatz: 19 },
  bank: { name: '', iban: '', bic: '', paypal: '' },
  nummern: { rechnungPraefix: 'RE', rechnung: 1, rechnungJahr: new Date().getFullYear(), kunde: 1, schutzkonzept: 1, schutzkonzeptJahr: new Date().getFullYear(),
    angebot: 1, angebotJahr: new Date().getFullYear(), lehrgang: 1, lehrgangJahr: new Date().getFullYear(), ausgabe: 1, ausgabeJahr: new Date().getFullYear() },
  angebotGueltig: 30, letzteSicherung: '', sicherungIntervall: 7,
  ohneUnterschrift: true, ohneUnterschriftBescheinigung: true,
  zahlungsziel: 14,
  katalog: [
    { gruppe: 'Lehrgang', bez: 'Lehrgang – Unterrichtseinheit (45 Min.)', text: 'Lehrgangsthema: ', einheit: 'UE', preis: 0 },
    { gruppe: 'Lehrgang', bez: 'Vorbereitung Sachkundeprüfung § 34a GewO', text: 'Lehrgang inkl. Unterlagen', einheit: 'UE', preis: 0 },
    { gruppe: 'Schulung', bez: 'Inhouse-Schulung – Tagessatz', text: 'Thema: ', einheit: 'Tag', preis: 0 },
    { gruppe: 'Schulung', bez: 'Unterweisung nach § 12 ArbSchG', text: 'inkl. Unterweisungsnachweis', einheit: 'Std.', preis: 0 },
    { gruppe: 'Beratung', bez: 'Sicherheitsberatung / Objektbegehung', text: '', einheit: 'Std.', preis: 0 },
    { gruppe: 'Beratung', bez: 'Erstellung Schutzkonzept', text: 'Objekt: ', einheit: 'pauschal', preis: 0 },
    { gruppe: 'Beratung', bez: 'Ergebnisbericht mit Maßnahmenplan', text: '', einheit: 'pauschal', preis: 0 },
    { gruppe: 'Nebenkosten', bez: 'Fahrtkosten', text: 'Hin- und Rückfahrt', einheit: 'km', preis: 0.30 },
    { gruppe: 'Nebenkosten', bez: 'Schulungsunterlagen / Material', text: '', einheit: 'Stk.', preis: 0 },
  ],
  texte: {
    rechnungEinleitung: 'für die erbrachten Leistungen erlaube ich mir, Ihnen Folgendes in Rechnung zu stellen:',
    rechnungSchluss: 'Vielen Dank für Ihren Auftrag und die angenehme Zusammenarbeit.',
    gruss: 'Mit freundlichen Grüßen',
    angebotEinleitung: 'vielen Dank für Ihre Anfrage. Gerne biete ich Ihnen folgende Leistungen an:',
    angebotSchluss: 'Ich freue mich auf Ihre Rückmeldung und die Zusammenarbeit. Für Rückfragen stehe ich Ihnen jederzeit gern zur Verfügung.',
  },
  mahnung: {
    basiszins: 1.52, basiszinsAb: '2026-07-01',
    mahngericht: 'Amtsgericht Hagen – Zentrale Mahnabteilung, 58081 Hagen (für Antragsteller aus den OLG-Bezirken Düsseldorf und Hamm)',
    stufen: [
      { key: 'erinnerung', titel: 'Zahlungserinnerung', frist: 7, gebuehr: 0, zinsen: false, pauschale: false,
        text: 'sicher ist es Ihrer Aufmerksamkeit entgangen: Für die unten genannte Rechnung konnte ich bis heute keinen Zahlungseingang feststellen. Bitte überweisen Sie den offenen Betrag bis zum {frist}. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.' },
      { key: 'mahnung1', titel: '1. Mahnung', frist: 7, gebuehr: 0, zinsen: true, pauschale: true,
        text: 'leider ist die unten genannte Rechnung trotz Zahlungserinnerung noch nicht beglichen. Sie befinden sich seit dem {verzug} in Zahlungsverzug. Ich bitte Sie, den nachstehenden Gesamtbetrag bis spätestens {frist} zu überweisen.' },
      { key: 'mahnung2', titel: 'Letzte Mahnung', frist: 7, gebuehr: 0, zinsen: true, pauschale: true,
        text: 'trotz Erinnerung und Mahnung ist die unten genannte Forderung weiterhin offen. Ich fordere Sie letztmalig auf, den Gesamtbetrag bis spätestens {frist} zu zahlen. Nach Ablauf dieser Frist werde ich ohne weitere Ankündigung das gerichtliche Mahnverfahren einleiten. Die dadurch entstehenden Kosten gehen zu Ihren Lasten.' },
    ],
  },
};
AC.settings = U.clone(AC.DEFAULTS);
AC.loadSettings = async () => {
  const s = await FS.readJSON('einstellungen.json');
  AC.settings = AC.merge(U.clone(AC.DEFAULTS), s || {});
  if (!s) await AC.saveSettings();
};
AC.saveSettings = () => FS.writeJSON('einstellungen.json', AC.settings);
/* nächste fortlaufende Nummer je Jahr, z. B. AC.nextNr('angebot', 'AN', 4) → AN-2026-0001 */
/* ZIP-Archiv ohne Zusatzbibliothek (Methode „stored“, UTF-8-Dateinamen) – für das Steuerpaket */
AC.ZIP = {
  _crc: null,
  crc(buf) { let t = AC.ZIP._crc; if (!t) { t = AC.ZIP._crc = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; },
  /* files: [{ name: 'ordner/datei.pdf', data: Uint8Array }] → Blob */
  build(files) {
    const enc = new TextEncoder(), now = new Date(), parts = [], central = []; let off = 0;
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = AC.ZIP.crc(data), h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([o, v, l]) => l === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2],
        [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, l]) => l === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
      central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
    }
    const cs = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cs, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, l]) => l === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true));
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  },
};

/* Gesetzliche Feiertage NRW – § 2 Abs. 1 Feiertagsgesetz NW (11 Feiertage) */
AC.FT = {
  _c: {},
  ostern(y) { // Gaußsche Osterformel (gregorianisch)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${U.pad(mo, 2)}-${U.pad(da, 2)}`; },
  jahr(y) {
    if (AC.FT._c[y]) return AC.FT._c[y];
    const o = AC.FT.ostern(y), m = {};
    [['01-01', 'Neujahr'], ['05-01', 'Tag der Arbeit'], ['10-03', 'Tag der Deutschen Einheit'], ['11-01', 'Allerheiligen'], ['12-25', '1. Weihnachtstag'], ['12-26', '2. Weihnachtstag']]
      .forEach(([d, n]) => { m[`${y}-${d}`] = n; });
    [[-2, 'Karfreitag'], [1, 'Ostermontag'], [39, 'Christi Himmelfahrt'], [50, 'Pfingstmontag'], [60, 'Fronleichnam']].forEach(([n, name]) => { m[U.addDays(o, n)] = name; });
    return (AC.FT._c[y] = m); },
  name: d => (d ? AC.FT.jahr(+d.slice(0, 4))[d] : '') || '',
};

AC.nextNr = async (key, prefix, len, dir) => {
  const n = AC.settings.nummern, y = new Date().getFullYear();
  if (n[key + 'Jahr'] !== y) { n[key + 'Jahr'] = y; n[key] = 1; }
  let nr; do { nr = `${prefix}-${y}-${U.pad(n[key] || 1, len)}`; n[key] = (n[key] || 1) + 1; } while (dir && await FS.readJSON(`${dir}/${nr}.json`));
  await AC.saveSettings(); return nr;
};
AC.merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') AC.merge(a[k], b[k]); else a[k] = b[k]; } return a; };

/* ---------- 4. NAVIGATION, DIALOGE, MELDUNGEN ---------- */
AC.views = {};
AC.go = async (name, ...args) => {
  if (!FS.root && name !== 'connect') name = 'connect';
  AC.current = name; document.body.classList.remove('nav-open');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name.split(':')[0]));
  document.getElementById('topActions').innerHTML = '';
  const v = document.getElementById('view'); v.innerHTML = '<div class="empty">Lade …</div>';
  try { await AC.views[name](v, ...args); } catch (e) { console.error(e); v.innerHTML = `<div class="card"><h2>Fehler</h2><p>${U.esc(e.message)}</p></div>`; }
  window.scrollTo(0, 0);
};
AC.head = (title, sub = '', actions = '') => {
  document.getElementById('title').textContent = title;
  document.getElementById('subtitle').textContent = sub;
  document.getElementById('topActions').innerHTML = actions;
};
AC.toast = (msg, err) => { const d = document.createElement('div'); d.textContent = msg; if (err) d.className = 'err'; document.getElementById('toast').appendChild(d); setTimeout(() => d.remove(), err ? 7000 : 3800); };
AC.dialog = (title, body, buttons = [], cls = '') => new Promise(res => {
  const d = document.getElementById('dlg'); d.className = cls;
  d.innerHTML = `<div class="dh"><h2>${U.esc(title)}</h2></div><div class="db">${body}</div><div class="df"></div>`;
  const f = d.querySelector('.df');
  buttons.forEach(([label, val, style]) => { const b = document.createElement('button'); b.className = 'btn ' + (style || ''); b.textContent = label; b.onclick = () => { d.close(); res(val); }; f.appendChild(b); });
  d.onclose = () => res(d.returnValue || null); d.showModal();
});
AC.confirm = (title, text, ok = 'Ja', cls = 'red') => AC.dialog(title, `<p>${text}</p>`, [['Abbrechen', false, 'light'], [ok, true, cls]], 'small');
/* Handy/Tablet erkennen: Verhalten (mobil) und Layout (schmal) */
AC.mobil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);
AC.schmal = () => matchMedia('(max-width: 760px)').matches;
AC.herunterladen = (blob, name) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name || 'Datei'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 120000); };
/* Teilen-Menü von Android (WhatsApp, E-Mail, Drive, Drucken …) – false, wenn nicht möglich */
AC.teilen = async (blob, name, titel) => {
  try { const f = new File([blob], name || 'Datei.pdf', { type: blob.type || 'application/pdf' });
    if (!navigator.canShare || !navigator.canShare({ files: [f] })) return false;
    await navigator.share({ files: [f], title: titel || f.name }); return true;
  } catch (e) { return e.name === 'AbortError'; }
};
/* Datei anzeigen: am PC neuer Tab, am Handy Bilder im Tab, alles andere über „Herunterladen → Öffnen“ */
AC.openBlob = (blob, name) => {
  if (AC.mobil && !/^image\//.test(blob.type || '')) { AC.herunterladen(blob, name || blob.name || 'Datei.pdf'); AC.toast('Datei geladen – unten „Öffnen“ antippen.'); return; }
  const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 120000); };
/* PDF-Vorschau mit Speichern / Drucken. doc = jsPDF-Dokument */
AC.preview = async (doc, title, saveCb) => {
  if (AC.mobil) return AC.previewMobil(doc, title, saveCb);
  const url = URL.createObjectURL(doc.output('blob'));
  const btns = [['Schließen', 'close', 'light'], ['Drucken', 'print', 'light']];
  if (saveCb) btns.push(['Im Datenordner speichern', 'save']);
  const r = await AC.dialog(title, `<iframe src="${url}#view=FitH"></iframe>`, btns);
  if (r === 'print') AC.print(doc);
  if (r === 'save' && saveCb) await saveCb();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return r;
};
AC.print = doc => { if (AC.mobil) { AC.openBlob(doc.output('blob'), 'Druck.pdf'); AC.toast('Zum Drucken die PDF öffnen und im Menü ⋮ „Drucken“ wählen.'); return; } doc.autoPrint(); AC.openBlob(doc.output('blob')); };
/* Handy: Android zeigt PDFs nicht im Fenster – deshalb Öffnen / Teilen / Speichern */
AC.pdfName = title => String(title || 'Dokument').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80) + '.pdf';
AC.previewMobil = async (doc, title, saveCb) => {
  const blob = doc.output('blob'), name = AC.pdfName(title), kannTeilen = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: 'application/pdf' })] }));
  const btns = [['Schließen', 'close', 'light'], ['Öffnen', 'open', 'light']];
  if (kannTeilen) btns.push(['Teilen', 'share', 'light']);
  if (saveCb) btns.push(['Im Datenordner speichern', 'save']);
  const r = await AC.dialog(title, `<div class="mob-pdf"><div class="big">📄</div><p><b>${U.esc(name)}</b><br><span class="small muted">${doc.getNumberOfPages()} Seite${doc.getNumberOfPages() === 1 ? '' : 'n'} · ${Math.round(blob.size / 1024)} KB</span></p>
    <p class="small muted">„Öffnen“ zeigt die PDF im PDF-Betrachter (dort auch Drucken). „Teilen“ schickt sie z. B. per E-Mail oder WhatsApp.</p></div>`, btns, 'small');
  if (r === 'open') AC.openBlob(blob, name);
  if (r === 'share' && !await AC.teilen(blob, name, title)) AC.openBlob(blob, name);
  if (r === 'save' && saveCb) await saveCb();
  return r;
};

/* Handyfotos (oft 4–10 MB) für Belege verkleinern: max. 2400 px, JPEG – bleibt gut lesbar, synchronisiert schneller */
AC.bildKlein = async (file, max = 2400, qual = 0.85) => {
  if (!file || !/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type) || file.size < 1.5e6 || !window.createImageBitmap) return file;
  try { const bmp = await createImageBitmap(file), f = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', qual)); if (!b || b.size >= file.size) return file;
    return new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
};
/* breite Tabellen am Handy seitlich wischbar machen */
AC._wrap = root => { if (!AC.schmal()) return; (root || document).querySelectorAll('table.t').forEach(t => { const p = t.parentElement; if (!p || p.classList.contains('tw') || p.classList.contains('tw-a')) return; const w = document.createElement('div'); w.className = 'tw-a'; p.insertBefore(w, t); w.appendChild(t); }); };
new MutationObserver(() => AC._wrap()).observe(document.body, { childList: true, subtree: true });
/* Menü-Schublade */
document.getElementById('burger').onclick = () => document.body.classList.toggle('nav-open');
document.getElementById('navbg').onclick = () => document.body.classList.remove('nav-open');
/* als App installierbar + offline startfähig (nur über https) */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
