/* =====================================================================
   AC Office – Schulungsunterlagen (unterlagen.js)
   Ablage: schulungsunterlagen/<Thema>/<Datei>  (beliebige Dateitypen)
   Verzeichnis der Angaben (Titel, Version, Schlagworte …): schulungsunterlagen/index.json
   Dateien, die du im Explorer direkt in die Themenordner kopierst, erkennt
   die App beim nächsten Öffnen automatisch.
   ===================================================================== */
'use strict';
const UL = AC.UL = {
  BASE: 'schulungsunterlagen',
  MIME: { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain', mp4: 'video/mp4', mp3: 'audio/mpeg' },
  ext: n => (n.split('.').pop() || '').toLowerCase(),
  folder: t => String(t || 'Allgemein').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Allgemein',
  size: b => b > 1048576 ? U.nf(b / 1048576) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB',
  /* Verzeichnis laden und mit dem Ordner abgleichen */
  async load() {
    const idx = (await FS.readJSON(UL.BASE + '/index.json')) || { items: [] }; let changed = false;
    const found = new Map();
    let root; try { root = await FS.dir(UL.BASE); } catch (e) { return []; }
    for await (const [name, h] of root.entries()) {
      if (h.kind === 'file' && name !== 'index.json') found.set(name, { pfad: name, thema: 'Allgemein', h });
      if (h.kind === 'directory') for await (const [n2, h2] of h.entries()) if (h2.kind === 'file') found.set(`${name}/${n2}`, { pfad: `${name}/${n2}`, thema: name, h: h2 });
    }
    const before = idx.items.length; idx.items = idx.items.filter(u => found.has(u.pfad)); if (idx.items.length !== before) changed = true;
    for (const [p, f] of found) if (!idx.items.some(u => u.pfad === p)) {
      const file = await f.h.getFile(); changed = true;
      idx.items.push({ id: U.uid(), pfad: p, titel: p.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), thema: f.thema, version: '', stand: new Date(file.lastModified).toISOString().slice(0, 10), tags: '', notiz: '', groesse: file.size, hinzugefuegt: U.today() });
    }
    if (changed) await FS.writeJSON(UL.BASE + '/index.json', idx);
    return idx.items.sort((a, b) => a.thema.localeCompare(b.thema, 'de') || a.titel.localeCompare(b.titel, 'de'));
  },
  async saveIndex(items) { await FS.writeJSON(UL.BASE + '/index.json', { items }); },
  async add(files, thema) {
    const items = await UL.load(), dir = UL.folder(thema); let n = 0;
    for (const f of files) {
      let name = f.name, i = 1; while (items.some(u => u.pfad === `${dir}/${name}`)) name = f.name.replace(/(\.[^.]+)?$/, ` (${++i})$1`);
      await FS.write(`${UL.BASE}/${dir}/${name}`, f);
      items.push({ id: U.uid(), pfad: `${dir}/${name}`, titel: name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), thema: dir, version: '', stand: U.today(), tags: '', notiz: '', groesse: f.size, hinzugefuegt: U.today() }); n++;
    }
    await UL.saveIndex(items); return n;
  },
  /* Öffnen: PDF, Bilder, Text direkt im Browser – Word/PowerPoint/Excel über die Download-Leiste in der passenden Anwendung */
  async open(u) {
    if (!u) return; try {
      const f = await FS.file(`${UL.BASE}/${u.pfad}`), e = UL.ext(u.pfad), type = UL.MIME[e];
      if (type) { AC.openBlob(new Blob([await f.arrayBuffer()], { type }), u.pfad.split('/').pop()); return; }
      const url = URL.createObjectURL(f), a = document.createElement('a'); a.href = url; a.download = u.pfad.split('/').pop(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      AC.toast(AC.mobil ? 'Datei geladen – unten „Öffnen“ antippen (Word/Excel/PowerPoint-App oder Office-App).' : 'Datei wird geöffnet – bitte in der Download-Leiste des Browsers auf „Datei öffnen“ klicken.');
    } catch (e) { AC.toast('Datei nicht gefunden', true); }
  },
  card: (u, acts) => `<div class="file"><div class="ext ${UL.ext(u.pfad)}">${U.esc(UL.ext(u.pfad).slice(0, 4))}</div><div style="min-width:0">
    <b>${U.esc(u.titel)}</b><div class="meta">${U.esc(u.thema)}${u.version ? ' · Version ' + U.esc(u.version) : ''}${u.stand ? ' · Stand ' + U.de(u.stand) : ''} · ${UL.size(u.groesse || 0)}</div>
    ${u.tags ? `<div class="meta">🏷 ${U.esc(u.tags)}</div>` : ''}${u.notiz ? `<div class="meta">${U.esc(u.notiz)}</div>` : ''}<div class="acts">${acts}</div></div></div>`,
};

AC.views.unterlagen = async (v) => {
  let items = await UL.load(); const lgs = await LG.loadAll();
  let fT = '', q = '';
  /* Auf-/Zugeklappt je Thema – bleibt im Browser gemerkt (Standard: zugeklappt) */
  const KEY = 'ac-office-unterlagen-offen'; let offen = new Set();
  try { offen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* ohne Speicher: alles zu */ }
  const merke = () => { try { localStorage.setItem(KEY, JSON.stringify([...offen])); } catch (e) { /* egal */ } };
  AC.head('Schulungsunterlagen', `${items.length} Dateien · Ablage: Ordner „schulungsunterlagen“, je Thema ein Unterordner`, `<button class="btn light" id="uAdd">+ Dateien hinzufügen</button>`);
  const themen = () => [...new Set(['Allgemein', 'Sachkunde § 34a GewO', 'Unterweisungen', 'Werkschutz', ...items.map(u => u.thema)])].sort((a, b) => a.localeCompare(b, 'de'));
  const used = id => lgs.filter(l => l.unterlagen.includes(id)).map(l => l.id);
  v.innerHTML = `<div class="drop" id="uDrop"><b>Dateien hierher ziehen</b> oder oben „+ Dateien hinzufügen“ – PDF, Word, PowerPoint, Excel, Bilder, Videos.<br><span class="small">Du kannst Dateien auch im Explorer direkt in <b>schulungsunterlagen\\&lt;Thema&gt;</b> kopieren – die App erkennt sie automatisch.</span></div>
    <div class="card" style="margin-top:14px"><div class="row"><select id="uT" style="max-width:260px"><option value="">alle Themen</option>${themen().map(t => `<option>${U.esc(t)}</option>`).join('')}</select>
    <input id="uQ" placeholder="Suchen nach Titel, Schlagwort, Notiz …" style="max-width:380px"><span class="right small muted" id="uCnt"></span>
    <button class="btn sm light" id="uOpenAll">Alle aufklappen</button><button class="btn sm light" id="uCloseAll">Alle zuklappen</button></div></div><div class="ul-wrap"><div id="uList"></div><aside class="ul-fav card" id="uFav"></aside></div>
    <input type="file" id="uFile" multiple class="hidden">`;
  const draw = () => {
    const rows = items.filter(u => (!fT || u.thema === fT) && (!q || [u.titel, u.tags, u.notiz, u.pfad].join(' ').toLowerCase().includes(q)));
    v.querySelector('#uCnt').textContent = `${rows.length} von ${items.length}`;
    const ths = [...new Set(rows.map(u => u.thema))];
    const auto = !!(q || fT); // bei Suche oder Themenfilter alle Treffer-Themen aufklappen
    const zahl = n => `${n} Datei${n === 1 ? '' : 'en'}`;
    const typen = list => { const c = {}; list.forEach(u => { const e = UL.ext(u.pfad); c[e] = (c[e] || 0) + 1; }); return Object.entries(c).sort((x, y) => y[1] - x[1]).map(([e, n]) => `<span class="chip-ext ${U.esc(e)}">${n}× ${U.esc(e.toUpperCase())}</span>`).join(''); };
    v.querySelector('#uList').innerHTML = rows.length ? ths.map(t => { const list = rows.filter(u => u.thema === t), op = auto || offen.has(t);
      return `<section class="ul-grp${op ? ' open' : ''}"><button class="ul-head" data-t="${U.esc(t)}" aria-expanded="${op}" title="${op ? 'zuklappen' : 'aufklappen'}"><span class="chev">▸</span><b>${U.esc(t)}</b><span class="cnt">${zahl(list.length)}</span><span class="types">${typen(list)}</span></button>
        <div class="files ul-body">${list.map(u => UL.card(u,
      `<button class="star${u.fav ? ' on' : ''}" data-fav="${u.id}" title="${u.fav ? 'aus Favoriten entfernen' : 'zu Favoriten hinzufügen'}">${u.fav ? '★' : '☆'}</button><button class="btn sm" data-o="${u.id}">Öffnen</button><button class="btn sm light" data-e="${u.id}">Angaben</button><button class="btn sm light" data-d="${u.id}" title="löschen">✕</button>${used(u.id).length ? `<span class="small muted">in ${used(u.id).join(', ')}</span>` : ''}`)).join('')}</div></section>`; }).join('')
      : '<div class="empty">Noch keine Unterlagen. Zieh deine Präsentationen, Handouts und Skripte einfach in das Feld oben.</div>';
    v.querySelectorAll('.ul-head').forEach(h => h.onclick = () => { const t = h.dataset.t, g = h.parentElement, op = !g.classList.contains('open');
      g.classList.toggle('open', op); h.setAttribute('aria-expanded', op); h.title = op ? 'zuklappen' : 'aufklappen'; if (op) offen.add(t); else offen.delete(t); merke(); });
    const favs = items.filter(u => u.fav).sort((x, y) => (x.favPos ?? 1e9) - (y.favPos ?? 1e9) || x.titel.localeCompare(y.titel, 'de'));
    v.querySelector('#uFav').innerHTML = `<h3>★ Favoriten <span class="small muted">(${favs.length})</span></h3>${favs.length ? favs.map((u, i) => `<div class="fav-row">
        <button class="fav-open" data-o="${u.id}" title="${U.esc(u.thema)} · ${U.esc(u.pfad.split('/').pop())}"><span class="fx ${U.esc(UL.ext(u.pfad))}">${U.esc(UL.ext(u.pfad).slice(0, 4))}</span><span class="ft"><b>${U.esc(u.titel)}</b><span>${U.esc(u.thema)}</span></span></button>
        <span class="fav-acts">${i ? `<button class="x" data-up="${u.id}" title="nach oben">▲</button>` : ''}<button class="x" data-fav="${u.id}" title="aus Favoriten entfernen">✕</button></span></div>`).join('')
      : '<p class="small muted">Noch keine Favoriten. Klick bei einer Unterlage auf den Stern ☆ – sie erscheint dann hier und ist mit einem Klick geöffnet.</p>'}`;
    v.querySelectorAll('[data-fav]').forEach(b => b.onclick = async e => { e.stopPropagation(); const u = items.find(x => x.id === b.dataset.fav); u.fav = !u.fav;
      if (u.fav) u.favPos = Math.max(0, ...items.filter(x => x.fav && x !== u).map(x => x.favPos ?? 0)) + 1; else delete u.favPos;
      await UL.saveIndex(items); AC.toast(u.fav ? `★ „${u.titel}“ zu Favoriten hinzugefügt` : 'Aus Favoriten entfernt'); draw(); });
    v.querySelectorAll('[data-up]').forEach(b => b.onclick = async () => { const f = items.filter(u => u.fav).sort((x, y) => (x.favPos ?? 1e9) - (y.favPos ?? 1e9) || x.titel.localeCompare(y.titel, 'de'));
      const i = f.findIndex(u => u.id === b.dataset.up); if (i > 0) { [f[i - 1], f[i]] = [f[i], f[i - 1]]; f.forEach((u, j) => { u.favPos = j; }); await UL.saveIndex(items); draw(); } });
    v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => UL.open(items.find(u => u.id === b.dataset.o)));
    v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => edit(items.find(u => u.id === b.dataset.e)));
    v.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { const u = items.find(x => x.id === b.dataset.d);
      if (!await AC.confirm('Datei löschen?', `<b>${U.esc(u.pfad)}</b> wird aus dem Ordner „schulungsunterlagen“ endgültig gelöscht.`, 'Endgültig löschen')) return;
      await FS.remove(`${UL.BASE}/${u.pfad}`); items = await UL.load(); AC.toast('Gelöscht'); draw(); });
  };
  const edit = async (u) => {
    const r = await AC.dialog('Angaben zur Unterlage', `<div class="grid g2">
      <label class="f" style="grid-column:span 2"><span>Titel</span><input id="eT" value="${U.esc(u.titel)}"></label>
      <label class="f"><span>Version</span><input id="eV" value="${U.esc(u.version)}"></label><label class="f"><span>Stand</span><input type="date" id="eS" value="${U.esc(u.stand)}"></label>
      <label class="f" style="grid-column:span 2"><span>Schlagworte (durch Komma getrennt)</span><input id="eG" value="${U.esc(u.tags)}"></label>
      <label class="f" style="grid-column:span 2"><span>Notiz</span><textarea id="eN" rows="3">${U.esc(u.notiz)}</textarea></label></div><p class="small muted">Datei: schulungsunterlagen/${U.esc(u.pfad)}</p>`,
      [['Abbrechen', null, 'light'], ['Speichern', 'ok']], 'small');
    if (r !== 'ok') return; const g = id => document.getElementById(id).value;
    Object.assign(u, { titel: g('eT'), version: g('eV'), stand: g('eS'), tags: g('eG'), notiz: g('eN') }); await UL.saveIndex(items); draw();
  };
  const upload = async (files) => {
    if (!files.length) return;
    const r = await AC.dialog(`${files.length} Datei(en) ablegen`, `<label class="f"><span>Thema (Unterordner)</span><input id="nT" list="nTl" value="${U.esc(fT || 'Allgemein')}"><datalist id="nTl">${themen().map(t => `<option value="${U.esc(t)}">`).join('')}</datalist></label>
      <p class="small muted">${[...files].map(f => U.esc(f.name)).join('<br>')}</p>`, [['Abbrechen', null, 'light'], ['Ablegen', 'ok']], 'small');
    if (r !== 'ok') return; const n = await UL.add([...files], document.getElementById('nT').value);
    items = await UL.load(); AC.toast(`${n} Datei(en) abgelegt`); AC.go('unterlagen');
  };
  const fi = v.querySelector('#uFile'); document.getElementById('uAdd').onclick = () => fi.click(); fi.onchange = () => upload(fi.files);
  const dz = v.querySelector('#uDrop');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); upload(e.dataTransfer.files); };
  v.querySelector('#uOpenAll').onclick = () => { items.forEach(u => offen.add(u.thema)); merke(); v.querySelectorAll('.ul-grp').forEach(g => { g.classList.add('open'); g.firstElementChild.setAttribute('aria-expanded', true); }); };
  v.querySelector('#uCloseAll').onclick = () => { offen.clear(); merke(); v.querySelectorAll('.ul-grp').forEach(g => { g.classList.remove('open'); g.firstElementChild.setAttribute('aria-expanded', false); }); };
  v.querySelector('#uT').onchange = e => { fT = e.target.value; draw(); };
  v.querySelector('#uQ').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  draw();
};
