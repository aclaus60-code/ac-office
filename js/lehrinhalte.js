/* =====================================================================
   AC Office – Lehrgangsinhalte aus dem Titel vorschlagen (lehrinhalte.js)
   Erkennt am Titel (und an der Art) des Lehrgangs, welche rechtlichen
   Vorgaben vermittelt werden müssen, und schlägt passende Inhalte vor.
   Der Vorschlag ist frei bearbeitbar und wird erst nach Bestätigung in
   das Feld „Inhalte“ übernommen (ersetzen oder anhängen).
   Grundlage: Second Brain (Wiki), DIHK-Rahmenplan Stand 09/2019,
   Gesetzestexte Stand 11/2026. Vor Verwendung auf Aktualität prüfen.
   ===================================================================== */
'use strict';
const LI = AC.LI = {
  SG: [
    'Sachgebiet 1: Recht der öffentlichen Sicherheit und Ordnung – Grundgesetz, Gewaltmonopol, Gewerberecht (§§ 11b, 14, 29, 34a GewO), BewachV',
    'Sachgebiet 2: Datenschutzrecht – DSGVO (Art. 4–6, 9, 12–22, 32–34), BDSG (§§ 4, 24), §§ 201–202a StGB',
    'Sachgebiet 3: Bürgerliches Gesetzbuch – Notwehr, Notstand, Selbsthilfe (§§ 227–230, 904 BGB), Besitz und Eigentum (§§ 854–860, 903 BGB), § 823 BGB',
    'Sachgebiet 4: Straf- und Strafverfahrensrecht, Umgang mit Waffen – §§ 32–35 StGB, wichtige Straftatbestände, § 127 StPO, WaffG',
    'Sachgebiet 5: Unfallverhütungsvorschrift Wach- und Sicherungsdienste (DGUV Vorschrift 23), Unterweisung und Erste Hilfe (DGUV Vorschrift 1)',
    'Sachgebiet 6: Umgang mit Menschen – Kommunikation, Konflikte, Deeskalation, Verhalten in Gefahrensituationen, interkulturelle Kompetenz',
    'Sachgebiet 7: Grundzüge der Sicherheitstechnik – mechanische und elektronische Sicherungstechnik, Gefahrenmeldeanlagen, Brandschutz'
  ],
  get VORLAGEN() { return [
    { key: 'sachkunde', name: 'Sachkundeprüfung § 34a GewO', re: /34a|sachkunde|bewachungsgewerbe/i,
      inhalte: [...LI.SG, 'Prüfungsvorbereitung: schriftliche Probeprüfung und Simulation der mündlichen Prüfung'],
      recht: '§ 34a GewO; Sachgebiete nach § 7 i. V. m. § 9 Abs. 2 BewachV; DIHK-Rahmenplan Sachkundeprüfung (Stand 09/2019).' },
    { key: 'unterrichtung', name: 'Unterrichtung § 34a GewO (40 UE)', re: /unterrichtung/i, inhalte: [...LI.SG],
      recht: '§ 34a Abs. 1a GewO; Sachgebiete nach § 7 BewachV; DIHK-Rahmenplan als Stoffsammlung für die Unterrichtung (rund 40 Unterrichtsstunden).' },
    { key: 'befugnisse', name: 'Rechtsgrundlagen / Jedermannsrechte', re: /jedermann|befugnis|rechtsgrundlag|notwehr|festnahme|eingriffsrecht/i,
      inhalte: ['Gewaltmonopol des Staates und Stellung privater Sicherheitsdienste (§ 34a Abs. 5 GewO)', 'Notwehr und Nothilfe (§ 32 StGB, § 227 BGB)', 'Notstand (§§ 34, 35 StGB, §§ 228, 904 BGB)',
        'Selbsthilfe (§§ 229, 230 BGB)', 'Besitzwehr und Besitzkehr (§§ 859, 860 BGB)', 'Vorläufige Festnahme durch jedermann (§ 127 Abs. 1 StPO)', 'Hausrecht und Hausfriedensbruch (§§ 903, 1004 BGB, § 123 StGB)', 'Verhältnismäßigkeit, Übergabe an die Polizei und Dokumentation'],
      recht: '§ 34a Abs. 5 GewO: Sicherheitskräfte haben nur Jedermannsrechte sowie vertraglich oder gesetzlich übertragene Rechte.' },
    { key: 'hausrecht', name: 'Hausrecht, Einlass- und Veranstaltungsdienst', re: /hausrecht|einlass|veranstaltung|türsteher|tuersteher|doorman|diskothek|ordnungsdienst|crowd|event/i,
      inhalte: ['Übertragenes Hausrecht (§§ 903, 1004 BGB) und seine Grenzen (§ 34a Abs. 5 GewO)', 'Hausverbot, Aufforderung zum Verlassen, Hausfriedensbruch (§ 123 StGB)', 'Einlasskontrolle auf Grundlage von Hausrecht und Einwilligung',
        'Benachteiligungsverbot beim Einlass (§§ 1, 19, 21 AGG)', 'Jugendschutz bei Veranstaltungen (§§ 4, 5, 9, 10 JuSchG)', 'Notwehr und vorläufige Festnahme (§ 32 StGB, § 227 BGB, § 127 Abs. 1 StPO)',
        'Besucherzahl, Rettungswege, Räumung und Ordnungsdienst (SBauVO NRW)', 'Personenströme, Panik und Crowd Management', 'Deeskalation und Eigensicherung'],
      recht: '§ 34a Abs. 5 GewO; Hausrecht §§ 903, 1004 BGB; Veranstaltungen: Sonderbauverordnung NRW (SBauVO) und Sicherheitskonzept des Betreibers.' },
    { key: 'deeskalation', name: 'Kommunikation und Deeskalation', re: /deeskal|konflikt|umgang mit menschen|kommunikation|eigensicherung|gewalt|aggression/i,
      inhalte: ['Kommunikation: Vier-Seiten-Modell, Gesprächsführung, Fragetechniken, aktives Zuhören', 'Wahrnehmung, Körpersprache und Distanzzonen', 'Entstehung von Stress, Aggression und Konflikten, Eskalationsstufen',
        'Deeskalationstechniken und ihre Grenzen', 'Eigensicherung und Verhalten in Gefahrensituationen', 'Interkulturelle Kompetenz und Umgang mit besonderen Personengruppen',
        'Rechtlicher Rahmen: Notwehr (§ 32 StGB, § 227 BGB) und Verhältnismäßigkeit', 'Nachsorge nach Gewaltereignissen (DGUV Information 207-025)'],
      recht: 'Sachgebiet „Umgang mit Menschen“ (§ 7 BewachV, DIHK-Rahmenplan); DGUV Information 207-025.' },
    { key: 'datenschutz', name: 'Datenschutz', re: /datenschutz|dsgvo|video/i,
      inhalte: ['Grundbegriffe (Art. 4 DSGVO) und Grundsätze der Verarbeitung (Art. 5 DSGVO)', 'Rechtmäßigkeit (Art. 6 DSGVO), besondere Kategorien von Daten (Art. 9 DSGVO)', 'Beschäftigtendaten (Art. 88 DSGVO, § 26 BDSG)',
        'Videoüberwachung öffentlich zugänglicher Räume (§ 4 BDSG)', 'Betroffenenrechte (Art. 12–22 DSGVO)', 'Datensicherheit (Art. 32 DSGVO) und Datenpannen (Art. 33, 34 DSGVO)',
        'Verschwiegenheit und Strafvorschriften (§§ 201, 201a, 202a StGB, § 42 BDSG)', 'Haftung und Bußgelder (Art. 82, 83 DSGVO)'],
      recht: 'Art. 39 Abs. 1 Buchst. b DSGVO (Sensibilisierung und Schulung der Beschäftigten); DSGVO, BDSG.' },
    { key: 'unterweisung', name: 'Unterweisung Arbeitsschutz (DGUV Vorschrift 23)', re: /unterweisung|arbeitsschutz|dguv|unfallverh/i,
      inhalte: ['Grundpflichten von Unternehmer und Versicherten (§§ 2, 15, 16 DGUV Vorschrift 1)', 'Gefährdungen im Objekt laut Gefährdungsbeurteilung (§ 5 ArbSchG)', 'DGUV Vorschrift 23: Eignung, Dienstanweisung, Rauschmittelverbot, Objekteinweisung',
        'Ausrüstung und persönliche Schutzausrüstung', 'Verhalten bei Notfällen, Erste Hilfe und Brand (§ 10 ArbSchG)', 'Meldewege, Unfallmeldung und Verbandbuch'],
      recht: '§ 12 ArbSchG und § 4 DGUV Vorschrift 1: Unterweisung vor Aufnahme der Tätigkeit und mindestens einmal jährlich, dokumentiert.' },
    { key: 'ersthilfe', name: 'Erste Hilfe im Betrieb', re: /erste hilfe|ersthelfer|sanität|sanitaet/i,
      inhalte: ['Organisation der Ersten Hilfe im Betrieb (§§ 24–26 DGUV Vorschrift 1)', 'Pflicht zur Hilfeleistung (§ 323c StGB)', 'Versicherungsschutz der Helfenden (§ 2 Abs. 1 Nr. 13 SGB VII)',
        'Eigenschutz, Notruf und Rettungskette', 'Dokumentation von Erste-Hilfe-Leistungen (Verbandbuch, § 24 DGUV Vorschrift 1)'],
      recht: '§ 26 DGUV Vorschrift 1: Aus- und Fortbildung von Ersthelfern nur durch ermächtigte Stellen – eigene Ermächtigung vorher prüfen.' },
    { key: 'brandschutz', name: 'Brandschutz / Brandschutzhelfer', re: /brandschutz|evakuier|räumung|raeumung|feuerlösch|feuerloesch/i,
      inhalte: ['Rechtliche Grundlagen: § 10 ArbSchG, ASR A2.2, DGUV Vorschrift 1', 'Brandentstehung, Brandklassen und Löschmittel', 'Handhabung von Feuerlöschern (praktische Übung)', 'Brandschutzordnung Teile A, B und C',
        'Flucht- und Rettungswege, Kennzeichnung (ASR A1.3, ASR A2.3)', 'Räumung und Evakuierung, Sammelstelle', 'Verhalten im Brandfall und Alarmierung'],
      recht: '§ 10 Abs. 2 ArbSchG (Benennung von Brandschutzhelfern); ASR A2.2 (in der Regel 5 % der Beschäftigten).' },
    { key: 'waffensachkunde', name: 'Waffensachkunde § 7 WaffG', re: /waffensachkunde|sachkunde.{0,20}waff|§ ?7 waffg/i,
      inhalte: ['Waffenrecht: WaffG und AWaffV (§ 1 Abs. 1 Nr. 1 AWaffV)', 'Beschussrecht (Beschussgesetz)', 'Notwehr und Notstand (§§ 32, 34, 35 StGB, §§ 227, 228, 904 BGB)',
        'Waffentechnik: Funktions- und Wirkungsweise, Reichweite (§ 1 Abs. 1 Nr. 2 AWaffV)', 'Sichere Handhabung und Schießfertigkeit (§ 1 Abs. 1 Nr. 3 AWaffV)', 'Aufbewahrung von Waffen und Munition (§ 36 WaffG, § 13 AWaffV)',
        'Erwerb, Besitz, Führen und Transport, Erlaubnisse (§ 10 WaffG)'],
      recht: '§ 7 WaffG; §§ 1–3 AWaffV (Umfang der Sachkunde, Prüfung, anderweitiger Nachweis).' },
    { key: 'standaufsicht', name: 'Schießstandaufsicht', re: /schießstand|schiessstand|standaufsicht|schießleit|schiessleit|aufsichtsperson/i,
      inhalte: ['Rechtsgrundlagen der Schießstätte (§ 27 WaffG, §§ 9–11 AWaffV)', 'Bestellung und Aufgaben der verantwortlichen Aufsichtsperson (§§ 10, 11 AWaffV)', 'Zulässiges Schießen (§ 9 AWaffV), Verbot des kampfmäßigen Schießens (§ 27 Abs. 7 WaffG)',
        'Schießen durch Kinder und Jugendliche (§ 27 Abs. 3 WaffG, § 10 Abs. 5 AWaffV)', 'Schießstandordnung, Sicherheitsregeln und Waffenhandling', 'Verhalten bei Störungen, Unfällen und Notfällen', 'Aufzeichnungen und Protokoll'],
      recht: '§ 27 WaffG, §§ 9–11 AWaffV; Bestellung durch den Betreiber und Anzeige nach § 10 AWaffV; DSB-Richtlinie Standaufsicht (2025).' },
    { key: 'verteidigung', name: 'Verteidigungsschießen §§ 22–25 AWaffV', re: /verteidigungsschie|verteidigung mit schuss|schießtraining|schiesstraining|22 awaffv/i,
      inhalte: ['Rechtsgrundlagen: §§ 22–25 AWaffV, Verbot des kampfmäßigen Schießens (§ 27 Abs. 7 WaffG)', 'Teilnahmeberechtigung (§ 23 AWaffV)', 'Unzulässige Übungen und Übungseinbauten (§ 22 Abs. 1 AWaffV)',
        'Notwehr und Verhältnismäßigkeit des Schusswaffeneinsatzes (§ 32 StGB)', 'Sichere Handhabung, Laden, Entladen und Störungsbeseitigung', 'Verzeichnis der Teilnehmenden (§ 24 AWaffV)'],
      recht: 'Anzeige bei der Kreispolizeibehörde nach § 22 Abs. 2 AWaffV vor Beginn; Teilnehmerverzeichnis nach § 24 AWaffV.' },
    { key: 'oepnv', name: 'Sicherheitsdienst im ÖPNV', re: /öpnv|oepnv|nahverkehr|zugbegleit|\bbahn/i,
      inhalte: ['Rollen und Befugnisse im Fahrzeug, Hausrecht und Fahrtausschluss', 'Erschleichen von Leistungen (§ 265a StGB)', 'Vorläufige Festnahme (§ 127 Abs. 1 StPO), Besitzwehr und Besitzkehr (§§ 859, 860 BGB)',
        'Tarifkunde (VRR, NRW-Tarif, DB) und Schwerbehindertenausweis', 'Bahntechnische Unterweisung: Gefahren im Gleisbereich und an der Oberleitung', 'Notfälle und Meldeverfahren', 'Kommunikation und Deeskalation im Fahrgastkontakt'],
      recht: '§ 34a Abs. 5 GewO (Jedermannsrechte); Beförderungsbedingungen und Hausrecht des Verkehrsunternehmens.' },
    { key: 'waffenrecht', name: 'Waffenrecht für Sicherheitspersonal', re: /waffenrecht|reizstoff|abwehrspray|messer/i,
      inhalte: ['Waffenbegriff (§ 1 WaffG, Anlage 1) und verbotene Gegenstände (Anlage 2 WaffG)', 'Führen von Waffen, kleiner Waffenschein (§ 10 Abs. 4 WaffG)', 'Waffen- und Messerverbote (§§ 42, 42a WaffG)',
        'Reizstoffsprühgeräte und Tierabwehrsprays', 'Waffen im Bewachungsgewerbe (§ 28 WaffG)', 'Umgang mit aufgefundenen Waffen'],
      recht: 'WaffG mit Anlagen 1 und 2; § 28 WaffG für Bewachungsunternehmen.' },
    { key: 'laden', name: 'Ladendetektiv / Einzelhandel', re: /laden|kaufhaus|detektiv|warensicherung|einzelhandel/i,
      inhalte: ['Diebstahl und Unterschlagung (§§ 242, 246 StGB), geringwertige Sachen (§ 248a StGB)', 'Räuberischer Diebstahl (§ 252 StGB)', 'Vorläufige Festnahme (§ 127 Abs. 1 StPO) und Selbsthilfe (§ 229 BGB)',
        'Besitzkehr (§ 859 Abs. 2 BGB)', 'Hausrecht und Hausverbot', 'Durchsuchung nur mit Einwilligung, Videoüberwachung (§ 4 BDSG)', 'Strafantrag und Strafanzeige (§§ 77, 77b StGB, § 158 StPO)'],
      recht: '§ 34a Abs. 5 GewO; § 127 Abs. 1 StPO; Strafantragsfrist drei Monate (§ 77b StGB).' },
    { key: 'intervention', name: 'Interventions- und Revierdienst', re: /intervention|alarm|leitstelle|\bnsl\b|revier|streife/i,
      inhalte: ['Rechtsstellung und Befugnisse (§ 34a Abs. 5 GewO, Jedermannsrechte)', 'Gefahrenmeldeanlagen (EMA, BMA, ÜMA) und Ablauf der Intervention', 'Eigensicherung bei der Alarmverfolgung',
        'Schlüsselverwaltung, Dienstanweisung und Objekteinweisung (DGUV Vorschrift 23)', 'Alleinarbeit und Notrufmöglichkeiten (DGUV Information 212-139)', 'Zusammenarbeit mit Polizei und Feuerwehr, Dokumentation'],
      recht: '§ 34a Abs. 5 GewO; DGUV Vorschrift 23; DGUV Information 212-139 (Alleinarbeit).' }
  ]; },
  /* passende Vorlagen zu Titel und Art finden */
  finde(lg) {
    const t = `${lg.titel || ''} ${lg.art === 'Prüfungsvorbereitung § 34a GewO' ? '34a' : ''}`;
    let m = LI.VORLAGEN.filter(v => v.re.test(t)).map(v => v.key);
    if (m.includes('unterrichtung')) m = m.filter(k => k !== 'sachkunde');
    if (m.includes('waffensachkunde')) m = m.filter(k => k !== 'sachkunde' && k !== 'waffenrecht');
    if (m.includes('verteidigung')) m = m.filter(k => k !== 'standaufsicht');
    return m;
  },
  hinweis(lg) { const m = LI.finde(lg).map(k => LI.VORLAGEN.find(v => v.key === k).name);
    return m.length ? `⚖ Aus dem Titel erkannt: <b>${m.map(U.esc).join(', ')}</b>` : '⚖ Kein Thema erkannt – Vorlage im Vorschlag auch von Hand wählbar'; },
  zeilen(keys) { const out = []; LI.VORLAGEN.filter(v => keys.includes(v.key)).forEach(v => v.inhalte.forEach(z => { if (!out.includes(z)) out.push(z); })); return out; },
  /* Dialog: Vorschlag prüfen, bearbeiten und übernehmen */
  async dialog(lg) {
    const treffer = LI.finde(lg), alt = (lg.inhalte || '').trim();
    const box = v => `<label style="display:block;margin:2px 0"><input type="checkbox" data-li="${v.key}"${treffer.includes(v.key) ? ' checked' : ''}> ${U.esc(v.name)}</label>`;
    const andere = LI.VORLAGEN.filter(v => !treffer.includes(v.key));
    const html = `<p class="small">${treffer.length ? 'Passend zum Titel <b>„' + U.esc(lg.titel || '') + '“</b> vorgeschlagen:' : 'Zum Titel wurde kein Thema erkannt. Wähle eine oder mehrere Vorlagen:'}</p>
      ${treffer.length ? `<div>${LI.VORLAGEN.filter(v => treffer.includes(v.key)).map(box).join('')}</div>` : ''}
      <details${treffer.length ? '' : ' open'} style="margin:6px 0"><summary class="small">weitere Vorlagen</summary><div style="columns:2">${andere.map(box).join('')}</div></details>
      <p class="small" style="margin:8px 0 2px"><b>Inhalte</b> (je Zeile ein Punkt – hier frei änderbar):</p>
      <textarea id="liTxt" rows="11" style="width:100%"></textarea>
      <p class="small muted" id="liRecht" style="margin-top:6px"></p>
      <p class="small muted">Stand der Vorschriften: 11/2026. Vor dem Lehrgang Aktualität prüfen. Du kannst die Inhalte nach der Übernahme im Feld „Inhalte“ weiter bearbeiten.</p>`;
    const btns = [['Abbrechen', null, 'light']]; if (alt) btns.push(['Anhängen', 'add', 'light']); btns.push([alt ? 'Ersetzen' : 'Übernehmen', 'set']);
    setTimeout(() => { const txt = document.getElementById('liTxt'), re = document.getElementById('liRecht'); if (!txt) return;
      const neu = () => { const k = [...document.querySelectorAll('[data-li]')].filter(c => c.checked).map(c => c.dataset.li);
        txt.value = LI.zeilen(k).join('\n');
        re.innerHTML = LI.VORLAGEN.filter(v => k.includes(v.key)).map(v => `<b>${U.esc(v.name)}:</b> ${U.esc(v.recht)}`).join('<br>') || ''; };
      document.querySelectorAll('[data-li]').forEach(c => c.onchange = neu); neu(); }, 0);
    const r = await AC.dialog('Lehrgangsinhalte vorschlagen', html, btns);
    if (!r) return false; const txt = document.getElementById('liTxt'); const z = (txt ? txt.value : '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!z.length) { AC.toast('Keine Inhalte ausgewählt', true); return false; }
    if (r === 'add') { const vorh = alt.split('\n').map(s => s.trim()); lg.inhalte = [alt, ...z.filter(x => !vorh.includes(x))].join('\n'); } else lg.inhalte = z.join('\n');
    return true;
  }
};
