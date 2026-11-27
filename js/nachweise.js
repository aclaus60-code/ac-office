/* =====================================================================
   AC Office – Nachweise & externe Sicherung (nachweise.js)
   1. Eigene Nachweise mit Ablaufdatum (Ersthelfer, Brandschutzhelfer …)
      Daten: nachweise.json   Dateien: nachweise/
   2. Externe Sicherung (z. B. USB-Stick) mit eigener Erinnerung
   Fristen erscheinen unter „Termine“ und auf der Übersicht.
   ===================================================================== */
'use strict';
const NW = AC.NW = {
  VORSCHLAG: ['Erste-Hilfe-Fortbildung (Ersthelfer)', 'Brandschutzhelfer', 'Sachkundeprüfung § 34a GewO', 'Waffensachkunde § 7 WaffG', 'Ausbildereignung (AEVO)',
    'Fachkraft für Schutz und Sicherheit', 'Führungszeugnis', 'Berufshaftpflichtversicherung', 'Dozentenzulassung Bildungsträger',
    'Standaufsicht / verantwortliche Aufsichtsperson (Schießstand)', 'Nachweisdokument Verein (§ 10 Abs. 3 AWaffV)', 'Eignung Kinder- und Jugendarbeit (Schießsport)', 'Waffenschein / Waffenbesitzkarte'],
  VORLAUF: 60,
  async load() { return ((await FS.readJSON('nachweise.json')) || { items: [] }).items; },
  save: items => FS.writeJSON('nachweise.json', { items: items.sort((a, b) => (a.gueltigBis || '9999').localeCompare(b.gueltigBis || '9999')) }),
  status(n) { if (!n.gueltigBis) return { t: 'unbefristet', c: 'bezahlt' }; const d = U.days(U.today(), n.gueltigBis);
    return d < 0 ? { t: `abgelaufen seit ${U.de(n.gueltigBis)}`, c: 'storniert' } : d <= NW.VORLAUF ? { t: `läuft ab in ${d} Tagen`, c: 'offen' } : { t: `gültig bis ${U.de(n.gueltigBis)}`, c: 'bezahlt' }; },
  plusJahre: (iso, j) => { const d = new Date((iso || U.today()) + 'T12:00:00'); d.setFullYear(d.getFullYear() + j); return d.toISOString().slice(0, 10); },
  async dialog(n) {
    const neu = !n; n = n || { id: U.uid(), bez: '', aussteller: '', datum: U.today(), gueltigBis: '', notiz: '', datei: '' };
    const r = await AC.dialog(neu ? 'Neuer Nachweis' : 'Nachweis bearbeiten', `<div class="grid g2">
      <label class="f" style="grid-column:span 2"><span>Bezeichnung *</span><input id="nB" list="nwL" value="${U.esc(n.bez)}"><datalist id="nwL">${NW.VORSCHLAG.map(x => `<option value="${U.esc(x)}">`).join('')}</datalist></label>
      <label class="f" style="grid-column:span 2"><span>Aussteller (z. B. DRK, IHK)</span><input id="nA" value="${U.esc(n.aussteller)}"></label>
      <label class="f"><span>Ausgestellt am</span><input type="date" id="nD" value="${n.datum}"></label>
      <label class="f"><span>Gültig bis (leer = unbefristet)</span><input type="date" id="nG" value="${n.gueltigBis}"></label>
      <div style="grid-column:span 2" class="row small">Gültigkeit ab Ausstellung: ${[1, 2, 3, 5].map(j => `<button class="btn sm light" data-j="${j}" type="button">+${j} Jahr${j > 1 ? 'e' : ''}</button>`).join('')}</div>
      <label class="f" style="grid-column:span 2"><span>Notiz</span><input id="nN" value="${U.esc(n.notiz || '')}"></label>
      <label class="f" style="grid-column:span 2"><span>Datei (Scan/PDF, optional)${n.datei ? ' – vorhanden: ' + U.esc(n.datei) : ''}</span><input type="file" id="nF" accept=".pdf,.jpg,.jpeg,.png"></label></div>
      <p class="small muted">Die Gültigkeit trägst du selbst ein, z. B. laut Bescheinigung oder Vorgabe deines Auftraggebers. Erinnerung ${NW.VORLAUF} Tage vorher unter „Termine“.</p>`,
      [['Abbrechen', null, 'light'], ['Speichern', 'ok']], 'small');
    if (r !== 'ok') return null; const g = id => document.getElementById(id).value;
    if (!g('nB')) { AC.toast('Bitte eine Bezeichnung angeben', true); return null; }
    Object.assign(n, { bez: g('nB'), aussteller: g('nA'), datum: g('nD'), gueltigBis: g('nG'), notiz: g('nN') });
    const fi = document.getElementById('nF').files[0];
    if (fi) { const name = `${U.slug(n.bez)}_${n.datum || U.today()}.${fi.name.split('.').pop().toLowerCase()}`; await FS.write('nachweise/' + name, fi); n.datei = name; }
    return n;
  },
  /* ---------- externe Sicherung ---------- */
  async extern() {
    try {
      const ziel = await window.showDirectoryPicker({ id: 'ac-extern', mode: 'readwrite' });
      if (await FS.root.resolve(ziel)) throw new Error('Der Ordner liegt innerhalb des Datenordners. Bitte den USB-Stick oder einen Ordner außerhalb wählen.');
      AC.toast('Externe Sicherung läuft …'); const st = new Date(), name = `AC-Office-Sicherung_${U.today()}_${U.pad(st.getHours(), 2)}${U.pad(st.getMinutes(), 2)}`;
      const n = await TE.kopieren(FS.root, await ziel.getDirectoryHandle(name, { create: true }));
      AC.settings.externeSicherung = st.toISOString(); AC.settings.externeSicherungZiel = ziel.name; await AC.saveSettings();
      AC.toast(`Externe Sicherung fertig: ${n} Dateien in ${ziel.name}\\${name}`); return true;
    } catch (e) { if (e.name !== 'AbortError') AC.toast('Sicherung nicht möglich: ' + e.message, true); return false; }
  },
};
AC.DEFAULTS.externeSicherung = ''; AC.DEFAULTS.externeSicherungZiel = ''; AC.DEFAULTS.externIntervall = 30;

/* Fristen und Erinnerung in „Termine“ und auf der Übersicht ergänzen */
(() => { const orig = TE.alle; TE.alle = async function () {
  const out = await orig.call(this), heute = U.today();
  (await NW.load()).filter(n => n.gueltigBis && U.days(heute, n.gueltigBis) <= NW.VORLAUF).forEach(n => out.push({ datum: n.gueltigBis,
    titel: `${U.days(heute, n.gueltigBis) < 0 ? 'Abgelaufen' : 'Läuft ab'}: ${n.bez}`, quelle: `Nachweis${n.aussteller ? ' · ' + n.aussteller : ''} – rechtzeitig erneuern`, go: ['nachweise'],
    cal: { uid: 'nw-' + n.id, datum: n.gueltigBis, titel: `Nachweis läuft ab: ${n.bez}`, text: 'Erneuerung planen', frei: true } }));
  const ex = AC.settings.externeSicherung, iv = U.num(AC.settings.externIntervall) || 30;
  if (!ex || U.days(ex.slice(0, 10), heute) >= iv) out.push({ datum: ex ? U.addDays(ex.slice(0, 10), iv) : heute, titel: 'Externe Sicherung (USB-Stick) durchführen', quelle: ex ? `letzte externe Sicherung ${U.de(ex.slice(0, 10))}` : 'noch keine externe Sicherung', go: ['nachweise'] });
  TE._last = out.sort((a, b) => a.datum.localeCompare(b.datum)); return TE._last; }; })();

AC.views.nachweise = async (v) => {
  let items = await NW.load(); const s = AC.settings;
  const draw = () => {
    AC.head('Nachweise & Sicherung', 'Eigene Qualifikationen mit Ablaufdatum · externe Sicherung · Ablage: Ordner „nachweise“', '<button class="btn light" id="nNeu">+ Nachweis</button>');
    const ex = s.externeSicherung, iv = U.num(s.externIntervall) || 30, faellig = !ex || U.days(ex.slice(0, 10), U.today()) >= iv;
    v.innerHTML = `<div class="card"><h2>Meine Nachweise</h2>${items.length ? `<div class="tw"><table class="t"><thead><tr><th>Bezeichnung</th><th>Aussteller</th><th>ausgestellt</th><th>Status</th><th>Datei</th><th></th></tr></thead><tbody>
      ${items.map(n => { const st = NW.status(n); return `<tr class="click" data-n="${n.id}"><td><b>${U.esc(n.bez)}</b>${n.notiz ? `<div class="small muted">${U.esc(n.notiz)}</div>` : ''}</td><td>${U.esc(n.aussteller || '')}</td><td>${U.de(n.datum)}</td>
        <td><span class="badge ${st.c}">${U.esc(st.t)}</span></td><td>${n.datei ? `<button class="btn sm light" data-open="${U.esc(n.datei)}">Öffnen</button>` : ''}</td><td><button class="x" data-del="${n.id}">✕</button></td></tr>`; }).join('')}</tbody></table></div>`
      : `<p class="muted">Noch keine Nachweise. Typisch sind: ${NW.VORSCHLAG.slice(0, 5).map(U.esc).join(', ')} …</p>`}
      <p class="small muted">${NW.VORLAUF} Tage vor Ablauf erscheint eine Erinnerung unter „Termine“ und auf der Übersicht. Viele Auftraggeber wollen gültige Nachweise sehen, bevor sie dich einsetzen.</p></div>
      <div class="card"><h2>Externe Sicherung (USB-Stick)</h2>
      <p>${ex ? `Letzte externe Sicherung: <b>${new Date(ex).toLocaleString('de-DE')}</b>${s.externeSicherungZiel ? ' auf „' + U.esc(s.externeSicherungZiel) + '“' : ''}` : '<b style="color:var(--rot)">Noch keine externe Sicherung.</b>'}${faellig ? ' · <b style="color:var(--rot)">fällig</b>' : ''}</p>
      <p class="small muted">Die normale Sicherung liegt in deinem OneDrive, genau wie die Daten. Eine zweite Kopie auf einem USB-Stick schützt, falls OneDrive ausfällt oder dort etwas gelöscht wird. Den Stick danach getrennt aufbewahren.</p>
      <div class="grid g4" style="margin-bottom:10px"><label class="f"><span>Erinnerung nach (Tagen)</span><input type="number" id="nIv" value="${iv}"></label></div>
      <button class="btn" id="nEx">Jetzt auf USB-Stick sichern …</button></div>`;
    document.getElementById('nNeu').onclick = async () => { const n = await NW.dialog(); if (n) { items.push(n); await NW.save(items); AC.toast('Gespeichert'); draw(); } };
    v.querySelectorAll('[data-n]').forEach(t => t.onclick = async () => { const n = items.find(x => x.id === t.dataset.n); if (await NW.dialog(n)) { await NW.save(items); draw(); } });
    v.querySelectorAll('[data-open]').forEach(b => b.onclick = ev => { ev.stopPropagation(); FS.open('nachweise/' + b.dataset.open).catch(() => AC.toast('Datei nicht gefunden', true)); });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const n = items.find(x => x.id === b.dataset.del);
      if (!await AC.confirm('Nachweis löschen?', `„${U.esc(n.bez)}“ wird aus der Liste entfernt. Eine abgelegte Datei bleibt im Ordner „nachweise“.`, 'Löschen')) return; items = items.filter(x => x !== n); await NW.save(items); draw(); });
    v.querySelector('#nIv').onchange = async e => { s.externIntervall = Math.max(1, U.num(e.target.value) || 30); await AC.saveSettings(); AC.toast('Gespeichert'); };
    v.querySelector('#nEx').onclick = async () => { if (await NW.extern()) draw(); };
  };
  draw();
};

/* „+1 Jahr“-Knöpfe im Dialog: Gültig bis = Ausstellungsdatum + Jahre */
document.addEventListener('click', e => { const b = e.target.closest('#dlg [data-j]'); if (!b) return; e.preventDefault();
  const d = document.getElementById('nD'), g = document.getElementById('nG'); if (d && g) g.value = NW.plusJahre(d.value, +b.dataset.j); });
