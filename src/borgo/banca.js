/* =====================================================================
   THE BORG 3D - BANCA DEL BORGO (mutui, prestiti, appartamenti nella Torre)
   Chiesto da Boris il 22/11/2026: "metti una banca dove puoi chiedere
   prestiti", "diversi tipi di casa... appartamenti nella torre oppure ville",
   "dev'essere come nella realta'". Le regole stanno nel servizio degli agenti
   (agenti/banca.mjs): valgono uguali per le persone vere e per Ada e Teo.
   Qui c'e' l'edificio in piazza (a sud del laghetto), lo sportello con il
   conto, il mutuo, il prestito e gli appartamenti, il pagamento automatico
   delle rate (quando giochi e hai gli Starlight) e i conti di Ada e Teo per
   chi vuole vedere come se la cavano.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, G = window.Gioco, PI = Math.PI;
  const S = { d: null, app: null, el: null, scheda: 'conto', conto: null, costruita: false, mutuo: { bene: null, tipo: 'casa', genere: 'bar', nome: '', anticipo: 0, durata: 240 }, prestito: { importo: 1000, durata: 24 }, ultimo: 0 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SL = () => (B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight');
  const fmt = n => Number(Math.round(n * 100) / 100).toLocaleString('it-IT');
  const quando = ms => new Date(ms).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const A = () => B.AgentiIA || {};
  const mioNick = () => (A().mioNick ? A().mioNick() : '');
  const rata = (P, tan, n) => { const i = tan / 12; return n <= 0 ? P : i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; };
  const R = () => (S.d && S.d.banca && S.d.banca.regole) || { anticipoMin: 0.2, tanMutuo: 0.04, durateMutuo: [60, 120, 240], tanPrestito: 0.09, prestitoMin: 200, prestitoMax: 5000, duratePrestito: [12, 24, 36], tanMora: 0.08, rateSollecito: 3, ratePignoramento: 10, astaQuota: 0.7 };
  const NOMI = { mutuo: 'Mutuo', prestito: 'Prestito', debito: 'Debito dopo il pignoramento' };

  /* ---------- l'edificio in piazza ---------- */
  function costruisci(app) {
    const E = S.d && S.d.banca && S.d.banca.edificio; if (!E || S.costruita || !B.edificioPiazza || !app.piazza) return;
    S.costruita = true;
    B.edificioPiazza({ x: E.x, z: E.z, rot: PI, w: E.w, d: E.d, nome: E.nome, muro: '#e9e2d0', muroSopra: '#f6f1e4', tetto: '#2f4a6a', persiane: '#2f5a4a', tendaA: '#f6e8cc', tendaB: '#2f5a7a', porta: 0, tendaLarg: 3.6 });
    // colonne e scalino di pietra davanti, come una banca vera
    const T = B.T, M = B.M, mesh = B.mesh, g = new T.Group(); app.gP.add(g);
    const fz = E.z - E.d / 2;
    g.add(mesh(new T.BoxGeometry(E.w - 0.6, 0.18, 1.0), M('#d8d2c4'), { x: E.x, y: 0.09, z: fz - 0.5, lb: 0.012 }));
    [-1, 1].forEach(sg => [1.6, 3.1].forEach(dx => g.add(mesh(new T.CylinderGeometry(0.2, 0.24, 2.5, 14), M('#f4efe2'), { x: E.x + sg * dx, y: 1.35, z: fz - 0.35, l: 0.012 }))));
    app.piazza.porte.push({ id: 'porta-banca', nome: E.nome, x: E.porta.x, z: E.porta.z, r: 1.4, testo: '🏦 Entra in banca', fn: () => apri() });
  }

  /* ---------- dati ---------- */
  function applica(d, app) {
    S.d = d; S.app = app; costruisci(app);
    if (S.el) disegna();
    const ora = Date.now();
    if (mioNick() && ora - S.ultimo > 60000) { S.ultimo = ora; controllaConto(); }
  }
  // quando giochi: scade la rata del giorno (se e' il momento) e il gioco la paga da solo se hai gli Starlight
  async function controllaConto() {
    let r; try { r = await A().chiama('/banca', { azione: 'banca' }); } catch (e) { return; }
    if (!r || !r.ok) return;
    S.conto = r.conto; S.immobile = r.immobile;
    if (r.accredito > 0) entra(r.accredito);
    (r.fatti || []).forEach(f => G.emetti('toast', '🏦 ' + f));
    const dovuto = (r.conto.prestiti || []).reduce((a, L) => a + L.scaduto, 0), E = B.Eco;
    if (dovuto > 0.01 && E && E.coins >= 1) {
      const n = Math.min(Math.floor(E.coins), Math.ceil(dovuto));
      const p = await paga(n, { azione: 'paga', importo: n });
      if (p.ok) { G.emetti('toast', `🏦 Rata pagata: ${fmt(p.spesa)} ${SL()}`); await aggiornaConto(); }
    } else if (dovuto > 0.01) G.emetti('toast', `🏦 Hai ${fmt(dovuto)} ${SL()} di rate da pagare`);
    if (S.el) disegna();
  }
  async function aggiornaConto() { try { const r = await A().chiama('/banca', { azione: 'banca' }); if (r && r.ok) { S.conto = r.conto; S.immobile = r.immobile; if (r.accredito > 0) entra(r.accredito); } } catch (e) { /* pazienza */ } if (S.el) disegna(); }
  function entra(n) { const E = B.Eco; if (!E) return; E.stato.coins += Math.round(n); E.salva(); E.avvisa(); }
  // si paga prima dal portafoglio del gioco; se la banca dice di no, i soldi tornano indietro (o torna la differenza)
  async function paga(n, via) {
    const E = B.Eco; if (!E) return { ok: false, motivo: 'Portafoglio non disponibile.' };
    const soldi = E.coins;
    if (n > 0 && !E.spendi(n)) return { ok: false, motivo: `Servono ${fmt(n)} ${SL()}: ne hai ${fmt(soldi)}.` };
    let r;
    try { r = await A().chiama('/banca', Object.assign({ soldi }, via)); } catch (e) { r = { ok: false, motivo: 'La banca non risponde, riprova tra poco.' }; }
    const usati = r.ok ? Math.round(r.spesa || 0) : 0;
    if (usati !== n) { E.stato.coins += n - usati; E.salva(); E.avvisa(); }
    if (r.ok && r.conto) S.conto = r.conto;
    return r;
  }

  /* ---------- lo sportello ---------- */
  function chiudi() { if (S.el) { S.el.remove(); S.el = null; } }
  function apri(o) {
    chiudi(); if (B.Terreni && B.Terreni.chiudi) B.Terreni.chiudi();
    if (o && o.bene) { S.scheda = 'mutuo'; S.mutuo.bene = o.bene; if (o.tipo) S.mutuo.tipo = o.tipo; S.mutuo.anticipo = 0; }
    else if (o && o.scheda) S.scheda = o.scheda;
    const el = document.createElement('div'); el.id = 'banca-scheda';
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(94vw,460px);max-height:76vh;overflow:auto;z-index:61;background:#18233a;color:#eef3ff;border:2px solid #d9b45a;border-radius:16px;padding:12px 14px;font-family:sans-serif;font-size:14px;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    el.innerHTML = '<button aria-label="Chiudi" class="bk-x" style="position:absolute;right:8px;top:4px;background:none;border:0;color:#eef3ff;font-size:24px;cursor:pointer">×</button><div style="font-size:19px;font-weight:700">🏦 Banca del Borgo</div><div class="bk-tab" style="display:flex;flex-wrap:wrap;gap:5px;margin:8px 0"></div><div class="bk-corpo"></div><div class="bk-nota" style="font-size:13px;margin-top:8px;min-height:1em;color:#ffd98a"></div>';
    el.querySelector('.bk-x').addEventListener('click', chiudi);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    ['keydown', 'keyup', 'keypress'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
    (document.getElementById('app') || document.body).appendChild(el);
    S.el = el; disegna();
    if (mioNick()) aggiornaConto();
  }
  const nota = t => { const x = S.el && S.el.querySelector('.bk-nota'); if (x) x.textContent = t; };
  const btn = (cls, txt, pieno, extra) => `<button class="${cls}" ${extra || ''} style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:${pieno ? '0' : '2px solid #d9b45a'};background:${pieno ? '#d9b45a' : 'none'};color:${pieno ? '#1a1a2e' : '#eef3ff'};font-weight:700;font-size:14px;cursor:pointer">${txt}</button>`;
  const scelta = (cls, val, txt, on) => `<button class="${cls}" data-v="${esc(val)}" style="flex:1;min-width:60px;padding:8px 6px;border-radius:10px;border:2px solid #d9b45a;background:${on ? '#d9b45a' : 'none'};color:${on ? '#1a1a2e' : '#eef3ff'};font-weight:700;font-size:13px;cursor:pointer">${txt}</button>`;
  const riga = (a, b) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0"><span style="opacity:.8">${a}</span><b>${b}</b></div>`;
  const box = h => `<div style="background:#0f1828;border-radius:10px;padding:8px 10px;margin-top:8px">${h}</div>`;

  function vistaPrestito(L) {
    if (L.tipo === 'debito') return box(`<b>${NOMI.debito}</b>` + riga('Da restituire', fmt(L.scaduto) + ' ' + SL()));
    return box(`<b>${NOMI[L.tipo]}</b>${L.bene ? ' · ' + esc(nomeBene(L.bene)) : ''}` +
      riga('Debito che resta', fmt(L.residuo) + ' ' + SL()) + riga('Rata', fmt(L.rata) + ' ' + SL() + ' al giorno') +
      riga('Rate pagate', L.pagate + ' su ' + L.n) + riga('Tasso', (L.tan * 100).toFixed(1).replace('.0', '') + '% all\'anno') +
      (L.decaduto ? riga('Stato', '⚠️ chiuso dalla banca: devi tutto') : riga('Prossima rata', esc(quando(L.prossima)))) +
      (L.scaduto > 0.01 ? `<div style="color:#ff9a8a;margin-top:4px">⚠️ Non pagate: ${L.insolute} rate · ${fmt(L.scaduto)} ${SL()}</div>` : ''));
  }
  function nomeBene(id) {
    if (/^torre/.test(id)) return id.slice(5) + '° piano della Torre';
    const l = (S.d && S.d.terreni || []).find(q => q.id === id); return l ? l.nome : id;
  }

  function disegna() {
    const el = S.el; if (!el) return;
    const corpo = el.querySelector('.bk-corpo');
    if (corpo.querySelector('input:focus, select:focus')) return;
    const tabs = [['conto', 'Conto'], ['mutuo', 'Mutuo'], ['prestito', 'Prestito'], ['case', 'Torre'], ['abitanti', 'Abitanti']];
    const th = tabs.map(t => scelta('bk-t', t[0], t[1], S.scheda === t[0])).join('');
    const tb = el.querySelector('.bk-tab'); if (tb.dataset.h !== th) { tb.dataset.h = th; tb.innerHTML = th; tb.querySelectorAll('.bk-t').forEach(b => b.addEventListener('click', () => { S.scheda = b.dataset.v; nota(''); disegna(); })); }
    const h = ({ conto: schedaConto, mutuo: schedaMutuo, prestito: schedaPrestito, case: schedaCase, abitanti: schedaAbitanti }[S.scheda] || schedaConto)();
    if (corpo.dataset.h === h) return;
    corpo.dataset.h = h; corpo.innerHTML = h;
    agganci(corpo);
  }

  function schedaConto() {
    const r = R(), c = S.conto, E = B.Eco;
    let h = `<div>Hai <b>${fmt(E ? E.coins : 0)} ${SL()}</b>.${S.immobile ? ' La tua proprietà: <b>' + esc(S.immobile.nome) + '</b>.' : ''}</div>`;
    if (!mioNick()) return h + '<div style="margin-top:8px">Prima scegli il tuo nome nel gioco.</div>';
    if (!c) return h + '<div style="margin-top:8px;opacity:.8">Carico il conto...</div>';
    if (c.segnalato) h += `<div style="margin-top:6px;color:#ff9a8a">⚠️ Sei segnalato come cattivo pagatore: niente nuovi prestiti finché non restituisci tutto.</div>`;
    if (!c.prestiti.length) h += `<div style="margin-top:8px">Non hai debiti con la banca.</div>`;
    c.prestiti.forEach(L => { h += vistaPrestito(L); });
    const dovuto = c.prestiti.reduce((a, L) => a + L.scaduto, 0);
    if (dovuto > 0.01) h += btn('bk-paga', `Paga le rate arretrate (${fmt(dovuto)} ${SL()})`, true);
    if (c.prestiti.some(L => L.residuo > 0)) h += `<div style="margin-top:10px">Restituisci in anticipo (senza penali, la rata scende):</div><input class="bk-rimb" type="number" min="1" step="100" placeholder="quanti ${SL()}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;color:#111;background:#fff">` + btn('bk-rimborsa', 'Restituisci', false);
    if (c.storia && c.storia.length) h += `<div style="margin-top:10px;font-weight:700">Lettere della banca</div>` + c.storia.slice().reverse().map(q => `<div style="font-size:12px;opacity:.85;margin-top:4px">${esc(quando(q.t))}: ${esc(q.s)}</div>`).join('');
    h += `<div style="font-size:12px;opacity:.75;margin-top:10px">Come funziona: ogni giorno nel borgo vale un mese, quindi le rate sono una al giorno; per te scade una rata in ogni giorno in cui giochi e il gioco la paga da solo se hai gli ${SL()}. Sulle rate non pagate corrono gli interessi di mora (${r.tanMora * 100}%). Dopo ${r.rateSollecito} rate non pagate arriva una lettera; dopo ${r.ratePignoramento} la banca pignora la casa e la vende all'asta al ${Math.round(r.astaQuota * 100)}% del valore.</div>`;
    return h;
  }

  function beniInVendita() {
    const L = [], lotti = (S.d && S.d.terreni) || [], io = mioNick().toLowerCase();
    lotti.forEach(l => {
      const mio = l.chi && l.chi.vero && l.chi.nome.toLowerCase() === io;
      if (!l.chi) L.push({ id: l.id, nome: l.nome + (l.asta ? ' (all\'asta' + (l.progetto ? ', con ' + l.progetto.nome : '') + ')' : ''), prezzo: l.prezzo, lotto: true, conCasa: !!(l.asta && l.progetto) });
      else if (mio && !l.progetto) L.push({ id: l.id, nome: l.nome + ' (tuo: solo la costruzione)', prezzo: 0, lotto: true, mio: true });
    });
    ((S.d && S.d.appartamenti) || []).filter(a => !a.chi).forEach(a => L.push({ id: a.id, nome: `Appartamento ${a.piano}° piano · ${a.m2} m²` + (a.asta ? ' (all\'asta)' : ''), prezzo: a.prezzo, app: true }));
    return L;
  }
  function schedaMutuo() {
    const r = R(), m = S.mutuo, L = (S.d && S.d.listinoTerreni) || null, beni = beniInVendita();
    if (!beni.length) return '<div>Non c\'è niente in vendita in questo momento.</div>';
    if (!beni.some(b => b.id === m.bene)) m.bene = beni[0].id;
    const b = beni.find(q => q.id === m.bene), serveTipo = b.lotto && !b.conCasa;
    const costo = serveTipo && L ? L.progetti[m.tipo].costo : 0, valore = b.prezzo + costo, minimo = Math.ceil(valore * r.anticipoMin);
    const anticipo = Math.min(valore, Math.max(minimo, m.anticipo || 0)), P = valore - anticipo, ra = rata(P, r.tanMutuo, m.durata);
    let h = `<div>La banca ti presta fino all'<b>${Math.round((1 - r.anticipoMin) * 100)}%</b>: il resto lo metti tu (l'anticipo). Tasso fisso <b>${r.tanMutuo * 100}%</b> all'anno, una rata al giorno (ogni giorno nel borgo vale un mese).</div>
      <div style="margin-top:8px">Cosa compri? <select class="bk-bene" style="width:100%;margin-top:4px;padding:8px;border-radius:8px;font-size:15px;color:#111;background:#fff">${beni.map(q => `<option value="${q.id}"${q.id === m.bene ? ' selected' : ''}>${esc(q.nome)}${q.prezzo ? ' · ' + fmt(q.prezzo) + ' ' + SL() : ''}</option>`).join('')}</select></div>`;
    if (serveTipo && L) {
      h += `<div style="margin-top:8px">Cosa ci fai costruire?</div><div style="display:flex;gap:6px;margin-top:4px">` + ['casa', 'villa', 'negozio'].map(k => scelta('bk-tipo', k, ({ casa: '🏠 Casa', villa: '🏡 Villa', negozio: '🏪 Negozio' })[k] + `<br><span style="font-weight:400;font-size:11px">${fmt(L.progetti[k].costo)}</span>`, m.tipo === k)).join('') + '</div>';
      if (m.tipo === 'negozio') h += `<div style="margin-top:6px">Cosa vende? <select class="bk-genere" style="padding:6px;border-radius:8px;font-size:15px">${Object.entries(L.generi).map(([k, g]) => `<option value="${k}"${k === m.genere ? ' selected' : ''}>${g.icona} ${esc(g.nome)}</option>`).join('')}</select></div>`;
      h += `<input class="bk-nome" maxlength="28" value="${esc(m.nome)}" placeholder="Nome (es. ${m.tipo === 'negozio' ? 'Dolci di ' : 'Villa di '}${esc(mioNick())})" style="width:100%;box-sizing:border-box;margin-top:6px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;color:#111;background:#fff">`;
    }
    h += `<div style="margin-top:8px">Anticipo (almeno ${fmt(minimo)}):</div><input class="bk-anticipo" type="number" min="${minimo}" max="${valore}" step="100" value="${anticipo}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;color:#111;background:#fff">
      <div style="margin-top:8px">Quante rate?</div><div style="display:flex;gap:6px;margin-top:4px">${r.durateMutuo.map(n => scelta('bk-durata', n, n + ' rate<br><span style="font-weight:400;font-size:11px">' + Math.round(n / 12) + ' "anni"</span>', m.durata === n)).join('')}</div>`;
    h += box(riga('Valore', fmt(valore) + ' ' + SL()) + riga('Anticipo (lo paghi ora)', fmt(anticipo) + ' ' + SL()) + riga('Prestito della banca', fmt(P) + ' ' + SL()) +
      riga('Rata', fmt(ra) + ' ' + SL() + ' al giorno') + riga('Restituisci in tutto', fmt(ra * m.durata) + ' ' + SL()) + riga('Di cui interessi', fmt(ra * m.durata - P) + ' ' + SL()));
    h += `<div style="font-size:12px;opacity:.75;margin-top:6px">Hai ${fmt(B.Eco ? B.Eco.coins : 0)} ${SL()}. Se non paghi ${r.ratePignoramento} rate la banca si prende ${b.app ? 'l\'appartamento' : 'il terreno con quello che c\'è sopra'} e lo vende all'asta.</div>`;
    h += btn('bk-firma', `Firma il mutuo e paga ${fmt(anticipo)} ${SL()}`, true);
    return h;
  }
  function schedaPrestito() {
    const r = R(), p = S.prestito, imp = Math.max(r.prestitoMin, Math.min(r.prestitoMax, p.importo || 0)), ra = rata(imp, r.tanPrestito, p.durata);
    return `<div>Un prestito personale, senza ipoteca: da ${fmt(r.prestitoMin)} a ${fmt(r.prestitoMax)} ${SL()}, tasso <b>${r.tanPrestito * 100}%</b> all'anno. I soldi arrivano subito. Uno alla volta.</div>
      <input class="bk-imp" type="number" min="${r.prestitoMin}" max="${r.prestitoMax}" step="100" value="${imp}" style="width:100%;box-sizing:border-box;margin-top:8px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;color:#111;background:#fff">
      <div style="display:flex;gap:6px;margin-top:8px">${r.duratePrestito.map(n => scelta('bk-pdur', n, n + ' rate', p.durata === n)).join('')}</div>` +
      box(riga('Ricevi ora', fmt(imp) + ' ' + SL()) + riga('Rata', fmt(ra) + ' ' + SL() + ' al giorno') + riga('Restituisci in tutto', fmt(ra * p.durata) + ' ' + SL()) + riga('Di cui interessi', fmt(ra * p.durata - imp) + ' ' + SL())) +
      `<div style="font-size:12px;opacity:.75;margin-top:6px">Se non paghi ${r.ratePignoramento} rate devi restituire tutto subito e sei segnalato come cattivo pagatore.</div>` + btn('bk-chiedi', `Chiedi ${fmt(imp)} ${SL()}`, true);
  }
  function schedaCase() {
    const ap = (S.d && S.d.appartamenti) || [];
    let h = `<div>Appartamenti nella Torre della Cometa: uno per piano. Più in alto c'è più luce e vista, e costano di più. Si entra con l'ascensore.</div>`;
    h += ap.slice().reverse().map(a => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #2a3858"><div style="flex:1"><b>${a.piano}° piano</b> · ${a.m2} m²<br><span style="font-size:12px;opacity:.85">${a.chi ? 'di ' + esc(a.chi.nome) + (a.chi.vero ? '' : ' 🤖') : (a.asta ? 'all\'asta · ' : '') + fmt(a.prezzo) + ' ' + SL()}</span></div>` +
      (a.chi ? '' : `<button class="bk-compra-app" data-p="${a.piano}" style="padding:6px 10px;border-radius:8px;border:0;background:#d9b45a;color:#1a1a2e;font-weight:700;cursor:pointer">Compra</button><button class="bk-mutuo-app" data-id="${a.id}" style="padding:6px 10px;border-radius:8px;border:2px solid #d9b45a;background:none;color:#eef3ff;font-weight:700;cursor:pointer">Mutuo</button>`) + '</div>').join('');
    return h;
  }
  function schedaAbitanti() {
    const ab = (S.d && S.d.banca && S.d.banca.abitanti) || [], ag = (S.d && S.d.agenti) || [];
    let h = '<div>Come vanno i conti degli abitanti del borgo (sono IA, decidono da soli).</div>';
    ag.forEach(a => {
      const c = ab.find(q => q.id === a.id), ter = ((S.d && S.d.terreni) || []).find(l => l.chi && l.chi.id === a.id), app = ((S.d && S.d.appartamenti) || []).find(q => q.chi && q.chi.id === a.id);
      h += box(`<b>${esc(a.nome)} 🤖</b>` + riga('Starlight', fmt(a.starlight || 0)) + riga('Casa', ter ? esc(ter.progetto ? ter.progetto.nome : ter.nome) : app ? app.piano + '° piano della Torre' : 'casetta del borgo') +
        (c && c.prestiti.length ? c.prestiti.map(L => L.tipo === 'debito' ? riga('Debito', fmt(L.scaduto)) : riga(NOMI[L.tipo], `${fmt(L.residuo)} · rata ${fmt(L.rata)} · ${L.pagate}/${L.n}` + (L.insolute ? ` · ⚠️ ${L.insolute} non pagate` : ''))).join('') : riga('Debiti', 'nessuno')) +
        (c && c.segnalato ? '<div style="color:#ff9a8a">⚠️ segnalato come cattivo pagatore</div>' : '') +
        (c && c.storia.length ? `<div style="font-size:12px;opacity:.85;margin-top:4px">Ultima lettera: ${esc(c.storia[c.storia.length - 1].s)}</div>` : ''));
    });
    return h;
  }

  function agganci(c) {
    const on = (sel, ev, f) => c.querySelectorAll(sel).forEach(b => b.addEventListener(ev, () => f(b)));
    on('.bk-paga', 'click', async () => { const c2 = S.conto; const n = Math.ceil(c2.prestiti.reduce((a, L) => a + L.scaduto, 0)); nota('Pago...'); const r = await paga(Math.min(n, Math.floor(B.Eco.coins)), { azione: 'paga', importo: n }); nota(r.ok ? `Pagati ${fmt(r.spesa)} ${SL()}.` : r.motivo); await aggiornaConto(); });
    on('.bk-rimborsa', 'click', async () => { const n = Math.round(+c.querySelector('.bk-rimb').value || 0); if (!(n > 0)) return nota('Quanto vuoi restituire?'); nota('Pago...'); const r = await paga(n, { azione: 'rimborsa', importo: n }); nota(r.ok ? `Restituiti ${fmt(r.spesa)} ${SL()}: devi ancora ${fmt(r.debito)}.` : r.motivo); await aggiornaConto(); });
    on('.bk-bene', 'change', b => { S.mutuo.bene = b.value; S.mutuo.anticipo = 0; b.blur(); disegna(); });
    on('.bk-tipo', 'click', b => { S.mutuo.tipo = b.dataset.v; S.mutuo.anticipo = 0; disegna(); });
    on('.bk-genere', 'change', b => { S.mutuo.genere = b.value; b.blur(); disegna(); });
    on('.bk-nome', 'input', b => { S.mutuo.nome = b.value; });
    on('.bk-anticipo', 'change', b => { S.mutuo.anticipo = Math.round(+b.value || 0); b.blur(); disegna(); });
    on('.bk-durata', 'click', b => { S.mutuo.durata = +b.dataset.v; disegna(); });
    on('.bk-firma', 'click', firma);
    on('.bk-imp', 'change', b => { S.prestito.importo = Math.round(+b.value || 0); b.blur(); disegna(); });
    on('.bk-pdur', 'click', b => { S.prestito.durata = +b.dataset.v; disegna(); });
    on('.bk-chiedi', 'click', chiediPrestito);
    on('.bk-compra-app', 'click', b => compraApp(+b.dataset.p));
    on('.bk-mutuo-app', 'click', b => { S.mutuo.bene = b.dataset.id; S.mutuo.anticipo = 0; S.scheda = 'mutuo'; disegna(); });
  }
  async function firma() {
    if (!mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    const c = S.el.querySelector('.bk-corpo'), a = c.querySelector('.bk-anticipo'), nm = c.querySelector('.bk-nome');
    if (a) S.mutuo.anticipo = Math.round(+a.value || 0); if (nm) S.mutuo.nome = nm.value.trim();
    disegna();
    const m = S.mutuo, n = Math.round(+S.el.querySelector('.bk-anticipo').value || 0);
    nota('Il direttore legge le carte...');
    const r = await paga(n, { azione: 'mutuo', bene: m.bene, tipo: m.tipo, genere: m.genere, nome: m.nome, anticipo: n, durata: m.durata });
    if (!r.ok) return nota(r.motivo || 'Non si può, riprova.');
    G.emetti('toast', `🏦 Mutuo firmato! Rata ${fmt(r.rata)} ${SL()} al giorno`);
    nota(`Fatto: ${r.nomeBene} è tuo. Rata ${fmt(r.rata)} ${SL()} al giorno per ${r.durata} giorni.`);
    S.mutuo.nome = ''; S.scheda = 'conto'; if (A().aggiorna) A().aggiorna(); await aggiornaConto();
  }
  async function chiediPrestito() {
    if (!mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    const i = S.el.querySelector('.bk-imp'); if (i) S.prestito.importo = Math.round(+i.value || 0);
    nota('Il direttore controlla...');
    let r; try { r = await A().chiama('/banca', { azione: 'prestito', importo: S.prestito.importo, durata: S.prestito.durata }); } catch (e) { r = { ok: false, motivo: 'La banca non risponde.' }; }
    if (!r.ok) return nota(r.motivo || 'Non si può.');
    entra(r.accredito); G.emetti('toast', `🏦 Prestito: +${fmt(r.accredito)} ${SL()}`);
    S.scheda = 'conto'; await aggiornaConto();
  }
  async function compraApp(piano) {
    if (!mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    const a = ((S.d && S.d.appartamenti) || []).find(q => q.piano === piano); if (!a) return;
    nota('Firmo il rogito...');
    const r = await paga(a.prezzo, { azione: 'appartamento', piano });
    if (!r.ok) return nota(r.motivo || 'Non si può.');
    G.emetti('toast', `🎉 Hai comprato l'appartamento al ${piano}° piano!`); if (A().aggiorna) A().aggiorna(); await aggiornaConto();
  }

  /* ---------- il mio appartamento: ci si arriva con l'ascensore della Torre ---------- */
  function mioAppartamento() { const io = mioNick().toLowerCase(); return ((S.d && S.d.appartamenti) || []).find(a => a.chi && a.chi.vero && a.chi.nome.toLowerCase() === io) || null; }
  function vociAscensore() { const a = mioAppartamento(); return a ? [{ id: 'mia-casa', testo: '🏠 Casa tua · ' + a.piano + '° piano', largo: true }] : []; }
  function entraAppartamento() { const a = mioAppartamento(); if (a && B.Terreni && B.Terreni.entraCasaDa) B.Terreni.entraCasaDa(a.id, { x: 5.4, z: -4.5, yaw: PI }); }

  B.Banca = { applica, apri, chiudi, stato: S, vociAscensore, entraAppartamento, mioAppartamento };
})();
