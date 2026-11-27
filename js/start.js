/* =====================================================================
   AC Office – Start, Übersicht und Ordnerverbindung (start.js)
   ===================================================================== */
'use strict';
AC.views.connect = async (v) => {
  AC.head('Willkommen bei AC Office', 'Büro-App für AC Security Consulting & Training');
  const ok = FS.supported(), st = ok ? await FS.restore() : 'none';
  if (st === 'ok') return AC.boot();
  v.innerHTML = `<div class="welcome card"><img src="${ACA.img.logoWhite}" alt=""><h2 style="margin-top:14px">Datenordner verbinden</h2>
    ${ok && AC.mobil ? `<p><b>Am Handy/Tablet:</b> Wähle den Ordner, den <b>FolderSync</b> mit OneDrive abgleicht – z. B. <b>Interner Speicher › Documents › AC-Office-Daten</b>. Chrome fragt, ob AC Office auf den Ordner zugreifen darf → <b>Zulassen</b>.</p>
      <p class="small muted">Bitte nicht den Ordner „Download“ oder die oberste Ebene des Speichers wählen – die sperrt Android. Nach dem Neustart des Browsers reicht ein Tipp auf „wieder verbinden“.</p>
      <div class="row" style="justify-content:center;margin-top:14px">${st === 'ask' ? '<button class="btn" id="cRe">Ordner wieder verbinden</button>' : ''}<button class="btn ${st === 'ask' ? 'light' : ''}" id="cPick">Ordner wählen …</button></div>` : ok ? `<p>AC Office speichert alles als Dateien in einem Ordner deiner Wahl – zum Beispiel <b>Dokumente\\AC-Security-Office</b>. Darin legt die App die Unterordner <b>kunden</b>, <b>rechnungen</b>, <b>mahnungen</b>, <b>schutzkonzepte</b> und <b>vorlagen</b> an.</p>
      <p class="small muted">Lege dafür am besten einen <b>neuen, eigenen Ordner</b> an (Systemordner wie „Dokumente“ selbst oder der Desktop werden vom Browser aus Sicherheitsgründen nicht freigegeben). Nichts wird ins Internet übertragen. Der Browser fragt, ob die App den Ordner bearbeiten darf – bitte erlauben.</p>
      <div class="row" style="justify-content:center;margin-top:14px">${st === 'ask' ? '<button class="btn" id="cRe">Zuletzt genutzten Ordner wieder verbinden</button>' : ''}<button class="btn ${st === 'ask' ? 'light' : ''}" id="cPick">Ordner wählen …</button></div>
      ${location.protocol === 'file:' ? '<p class="small muted" style="margin-top:18px">Zum Ausprobieren einfach einen leeren Testordner wählen – später kannst du unter Einstellungen jederzeit den richtigen Ordner verbinden.</p>' : '<p class="small" style="margin-top:18px"><a href="#" id="cDemo">Ohne Ordner ausprobieren (Testmodus – Daten bleiben nur in diesem Browser)</a></p>'}`
    : AC.mobil ? `<p><b>Dieser Browser unterstützt den Ordnerzugriff nicht.</b> Bitte AC Office in <b>Google Chrome</b> öffnen (ab Version 132, Chrome im Play Store aktualisieren). Samsung Internet und Firefox können das noch nicht.</p>`
    : `<p><b>Dieser Browser unterstützt den Ordnerzugriff nicht.</b> Bitte öffne die Datei <b>AC-Office.html</b> mit <b>Microsoft Edge</b> oder <b>Google Chrome</b>.</p>`}</div>`;
  const q = id => v.querySelector('#' + id);
  if (q('cPick')) q('cPick').onclick = async () => { try { await FS.pick(); AC.boot(); } catch (e) { if (e.name !== 'AbortError') AC.toast('Dieser Ordner kann nicht verwendet werden (' + e.name + '). Bitte einen eigenen Unterordner anlegen und wählen.', true); } };
  if (q('cRe')) q('cRe').onclick = async () => { if (await FS.reconnect()) AC.boot(); else AC.toast('Zugriff nicht erteilt', true); };
  if (q('cDemo')) q('cDemo').onclick = async e => { e.preventDefault(); await FS.useDemo(); AC.boot(); };
};

AC.boot = async () => { await AC.loadSettings(); await K.load(); AC.go('start'); };

AC.views.start = async (v) => {
  await K.load(); const re = await R.loadAll(), dr = await R.loadDrafts(), an = await AN.loadAll(), lg = await LG.loadAll(), termine = await TE.alle();
  const offen = re.filter(r => r.typ !== 'storno' && r.status === 'offen' && R.offen(r) > 0), ueber = offen.filter(R.ueberfaellig);
  const y = String(new Date().getFullYear()), zufluss = re.reduce((s, r) => s + (r.zahlungen || []).filter(z => z.datum.startsWith(y)).reduce((x, z) => x + U.num(z.betrag), 0), 0);
  const anOffen = an.filter(a => a.status === 'versendet' && !AN.abgelaufen(a)), lgKommend = lg.filter(l => l.status === 'geplant' && l.von >= U.today());
  const warn = [];
  if (!AC.settings.steuer.steuernummer && !AC.settings.steuer.ustid) warn.push('Steuernummer fehlt – bitte unter Einstellungen → Steuer eintragen (Pflichtangabe auf Rechnungen).');
  if (AC.settings.katalog.every(k => !k.preis || k.preis === 0.3)) warn.push('Im Leistungskatalog sind noch keine Preise hinterlegt (Einstellungen → Leistungskatalog).');
  if (FS.demo) warn.push('Testmodus: Die Daten liegen nur im Browser. Für den echten Einsatz bitte einen Datenordner wählen (Einstellungen → Datenordner).');
  const ls = AC.settings.letzteSicherung;
  AC.head(`Hallo${AC.settings.absender.name ? ' ' + AC.settings.absender.name.split(' ')[0] : ''}!`, `Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`,
    `<button class="btn ghost" data-q="kunde">+ Kunde</button><button class="btn ghost" data-q="angebot">+ Angebot</button><button class="btn ghost" data-q="rechnungEdit">+ Rechnung</button><button class="btn ghost" data-q="lehrgang">+ Lehrgang</button><button class="btn light" data-q="schutzkonzept">+ Schutzkonzept</button>`);
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => AC.go(b.dataset.q));
  v.innerHTML = `${warn.length ? `<div class="card">${warn.map(w => `<p class="hint" style="margin:4px 0">${U.esc(w)}</p>`).join('')}</div>` : ''}
    <div class="grid g4" style="margin-bottom:18px">
      <div class="kpi"><b>${U.eur(zufluss)}</b><span>Einnahmen ${y} (Zahlungseingänge)</span></div>
      <div class="kpi ${ueber.length ? 'warn' : ''}"><b>${U.eur(offen.reduce((s, r) => s + R.offen(r), 0))}</b><span>${offen.length} offene Rechnungen${ueber.length ? ` · ${ueber.length} überfällig` : ''}${dr.length ? ` · ${dr.length} Entwürfe` : ''}</span></div>
      <div class="kpi"><b>${anOffen.length}</b><span>offene Angebote · ${U.eur(anOffen.reduce((s, a) => s + a.summen.brutto, 0))}</span></div>
      <div class="kpi"><b>${lgKommend.length}</b><span>geplante Lehrgänge · ${K.list.filter(k => !k.archiviert).length} aktive Kunden</span></div></div>
    <div class="grid g2">
      <div class="card"><h2>Anstehend</h2>${termine.length ? termine.slice(0, 8).map(TE.zeile).join('') + (termine.length > 8 ? `<p class="small"><a href="#" id="allT">alle ${termine.length} Termine anzeigen</a></p>` : '') : '<div class="empty">Nichts Dringendes. 👍</div>'}</div>
      <div><div class="card"><h2>Nächste Lehrgänge</h2>${lgKommend.length ? `<table class="t"><tbody>${lgKommend.slice(0, 5).map(l => `<tr class="click" data-l="${l.id}"><td>${LG.zeitraum(l)}</td><td><b>${U.esc(l.titel)}</b><div class="small muted">${U.esc(l.ort)} · ${l.teilnehmer.length} TN</div></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine geplanten Lehrgänge.</p>'}</div>
      <div class="card"><h2>Datensicherung</h2><p class="small">${ls ? `Letzte Sicherung: <b>${new Date(ls).toLocaleString('de-DE')}</b>${AC.settings.sicherungZiel ? ' in „' + U.esc(AC.settings.sicherungZiel) + '“' : ''}` : '<b style="color:var(--rot)">Noch keine Sicherung erstellt.</b>'}</p>
        <button class="btn" id="bkp">Jetzt sichern</button> <span class="small muted">kopiert den kompletten Datenordner, z. B. auf einen USB-Stick</span></div></div></div>`;
  TE.bind(v, () => AC.go('start'));
  v.querySelectorAll('[data-l]').forEach(t => t.onclick = () => AC.go('lehrgang', t.dataset.l));
  const at = v.querySelector('#allT'); if (at) at.onclick = e => { e.preventDefault(); AC.go('termine'); };
  v.querySelector('#bkp').onclick = async () => { if (await TE.sichern()) AC.go('start'); };
};

/* ---------- Programmstart ---------- */
document.getElementById('sideLogo').src = ACA.img.logoBand;
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => AC.go(b.dataset.go));
window.addEventListener('beforeunload', () => {});
AC.go('connect');
