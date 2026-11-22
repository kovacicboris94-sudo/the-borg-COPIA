/* =====================================================================
   THE BORG 3D - TERRENI DEL BORGO
   Lotti recintati in piazza che si comprano in Starlight; sopra si costruisce
   una casa o un negozio (chiesto da Boris il 21/11/2026). Le regole, i prezzi
   e i tempi stanno nel servizio degli agenti (agenti/terreni.mjs): cosi'
   valgono uguali per le persone vere e per Ada, Teo e gli altri abitanti IA.
   Qui si disegna (cartello, recinto, cantiere che cresce, edificio finito) e
   c'e' la scheda del lotto: compra, scegli cosa costruire, guarda il cantiere.
   - La casa finita di una persona vera e' l'ingresso in piazza della sua casa
     del gioco; quella di un abitante IA diventa la sua casa.
   - Il negozio finito ha un bancone davanti (lo disegna agenti-ia.js come gli
     altri banconi): ci lavora solo il proprietario e tiene l'80%.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, G = window.Gioco, PI = Math.PI;
  const S = { lotti: new Map(), dati: [], listino: null, app: null, pannello: null, mossoDa: {} };
  const COLORI = [
    { muro: '#e6c9a8', muroSopra: '#f2e2c8', tetto: '#7a3a4a', persiane: '#4f8a3a', tendaB: '#c8553d' },
    { muro: '#c9d6c0', muroSopra: '#e6eedc', tetto: '#2f4a6a', persiane: '#7a3f6a', tendaB: '#3f6a8a' },
    { muro: '#d8b4a0', muroSopra: '#f0dcc4', tetto: '#5a3a86', persiane: '#2f6a78', tendaB: '#e0675c' },
    { muro: '#bfc9d8', muroSopra: '#e3e8f0', tetto: '#2f5a4a', persiane: '#4a3a6a', tendaB: '#3f7a6a' },
    { muro: '#e8d6b6', muroSopra: '#f1e3c8', tetto: '#8a4a2a', persiane: '#2f4aa3', tendaB: '#d9a03a' },
    { muro: '#d9c2e0', muroSopra: '#efe2f4', tetto: '#3a2f6a', persiane: '#6a8a3a', tendaB: '#b0507a' }
  ];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nomeMoneta = () => (B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight');
  const fmt = n => Number(n).toLocaleString('it-IT');
  const quando = ms => new Date(ms).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const mioNick = () => (B.AgentiIA && B.AgentiIA.mioNick ? B.AgentiIA.mioNick() : '');
  const sonoIo = c => !!(c && c.vero && mioNick() && c.nome.toLowerCase() === mioNick().toLowerCase());
  const mioLotto = () => S.dati.find(l => sonoIo(l.chi));

  /* ---------- disegno ---------- */
  function cartello(testo, sotto, col) {
    const [cv, x] = B.tela(512, 256);
    B.rr(x, 6, 6, 500, 244, 18); x.fillStyle = col || '#f4e6c4'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#5c3822'; x.stroke();
    x.fillStyle = '#3a2216'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 54px Georgia, serif'; x.fillText(testo, 256, 86, 470);
    x.font = 'bold 38px sans-serif'; x.fillStyle = '#6a3f27'; (sotto || '').split('\n').slice(0, 2).forEach((r, i) => x.fillText(r, 256, 160 + i * 46, 470));
    return B.tex(cv);
  }
  // terra battuta con sassolini (o prato, quando l'edificio e' finito)
  const terre = {};
  function texTerra(prato) {
    const k = prato ? 'p' : 't'; if (terre[k]) return terre[k];
    const [cv, x] = B.tela(256, 256); x.fillStyle = prato ? '#6f8a4a' : '#7a6248'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = Math.random(); x.fillStyle = prato ? (v < 0.5 ? '#5f7a3e' : '#86a05a') : (v < 0.5 ? '#6a543d' : v < 0.85 ? '#8c7356' : '#a8977e'); x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3); }
    const t = B.tex(cv, true); t.repeat.set(2, 2.5); terre[k] = t; return t;
  }
  function chiave(l) { const p = l.progetto; return [l.chi ? l.chi.id : '', p ? p.tipo + p.nome + p.fase + (p.finito ? 'F' : Math.floor(p.fatte / p.ore * 20)) : ''].join('|'); }

  function costruisciLotto(l) {
    const app = S.app, g = new T.Group(), geo = l.geo, r = geo.rect, p = l.progetto, ost = [];
    const legno = '#8a5a35', legnoS = '#5c3822';
    const box = (w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), M(col), { x, y, z, lb: lb === undefined ? 0.012 : lb }); g.add(m); return m; };
    // terra battuta del lotto
    const terra = new T.Mesh(new T.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new T.MeshToonMaterial({ map: texTerra(p && p.finito), gradientMap: M('#fff').gradientMap, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    terra.rotation.x = -PI / 2; terra.position.set(l.x, 0.015, l.z); terra.receiveShadow = true; g.add(terra);
    // recinto basso di legno, aperto davanti (verso nord) per entrare
    const pali = [];
    for (let x = r.x0; x <= r.x1 + 0.01; x += 2) { pali.push([x, r.z0]); pali.push([x, r.z1]); }
    for (let z = r.z0 + 2; z < r.z1 - 0.01; z += 2) { pali.push([r.x0, z]); pali.push([r.x1, z]); }
    pali.forEach(q => { if (Math.abs(q[0] - l.x) < 1.6 && Math.abs(q[1] - r.z0) < 0.01) return; box(0.12, 0.7, 0.12, legnoS, q[0], 0.35, q[1]); });
    const sb = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); const b = box(L, 0.07, 0.05, legno, (x0 + x1) / 2, 0.5, (z0 + z1) / 2); b.rotation.y = -Math.atan2(z1 - z0, x1 - x0); };
    sb(r.x0, r.z1, r.x1, r.z1); sb(r.x0, r.z0, r.x0, r.z1); sb(r.x1, r.z0, r.x1, r.z1); sb(r.x0, r.z0, l.x - 1.6, r.z0); sb(l.x + 1.6, r.z0, r.x1, r.z0);
    // cartello all'ingresso del lotto (si tocca per aprire la scheda)
    const cx = geo.cartello.x, cz = geo.cartello.z - 0.2;
    box(0.1, 1.6, 0.1, legnoS, cx - 0.55, 0.8, cz); box(0.1, 1.6, 0.1, legnoS, cx + 0.55, 0.8, cz);
    let titolo, sotto, col;
    if (!l.chi) { titolo = 'In vendita'; sotto = fmt(l.prezzo) + ' ' + nomeMoneta() + '\ntocca per comprare'; col = '#fff3c4'; }
    else if (!p) { titolo = 'Terreno di ' + l.chi.nome; sotto = 'ancora vuoto'; }
    else if (!p.finito) { titolo = 'Cantiere'; sotto = p.nome + '\n' + Math.round(p.fatte / p.ore * 100) + '% · ' + p.fase; col = '#ffe0a8'; }
    else { titolo = p.nome; sotto = (p.tipo === 'casa' ? 'casa di ' : 'negozio di ') + l.chi.nome; }
    const tav = new T.Mesh(new T.PlaneGeometry(1.6, 0.8), new T.MeshBasicMaterial({ map: cartello(titolo, sotto, col) }));
    tav.position.set(cx, 1.4, cz - 0.07); tav.rotation.y = PI; g.add(tav);
    box(1.7, 0.9, 0.06, legnoS, cx, 1.4, cz);
    const tocco = new T.Mesh(new T.BoxGeometry(2, 2.2, 1.2), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.set(cx, 1.1, cz); g.add(tocco);
    ost.push({ t: 'c', x: cx, z: cz, r: 0.6 });

    const e = geo.edificio;
    let edificio = null;
    if (p && !p.finito) {
      // il cantiere: platea di cemento, muri che salgono, impalcature, poi il tetto
      const k = p.fatte / p.ore, muri = Math.max(0, Math.min(1, (k - 0.15) / 0.4)), tetto = Math.max(0, Math.min(1, (k - 0.55) / 0.25));
      box(e.w + 0.4, 0.3, e.d + 0.4, '#a9a39a', e.x, 0.15, e.z, 0.02);
      if (muri > 0) {
        const h = 0.2 + muri * 4.5, mt = COLORI[p.colore % COLORI.length].muro;
        const fw = (e.w - 1.3) / 2;   // la facciata ha il vano della porta
        [-1, 1].forEach(sg => box(fw, h, 0.25, k > 0.8 ? mt : '#b0614a', e.x + sg * (0.65 + fw / 2), 0.3 + h / 2, e.z - e.d / 2 + 0.12, 0.02));
        if (h > 2.3) box(1.3, h - 2.3, 0.25, k > 0.8 ? mt : '#b0614a', e.x, 0.3 + 2.3 + (h - 2.3) / 2, e.z - e.d / 2 + 0.12, 0.02);
        box(e.w, h, 0.25, k > 0.8 ? mt : '#b0614a', e.x, 0.3 + h / 2, e.z + e.d / 2 - 0.12, 0.02);
        box(0.25, h, e.d, k > 0.8 ? mt : '#b0614a', e.x - e.w / 2 + 0.12, 0.3 + h / 2, e.z, 0.02);
        box(0.25, h, e.d, k > 0.8 ? mt : '#b0614a', e.x + e.w / 2 - 0.12, 0.3 + h / 2, e.z, 0.02);
        // impalcature
        const H = 0.3 + h + 0.6;
        [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1]].forEach(q => box(0.07, H, 0.07, '#9aa0a8', e.x + q[0] * (e.w / 2 + 0.5), H / 2, e.z + q[1] * (e.d / 2 + 0.5), 0.006));
        for (let y = 1.2; y < H; y += 1.5) { box(e.w + 1, 0.06, 0.3, '#c8a060', e.x, y, e.z - e.d / 2 - 0.5, 0.006); box(e.w + 1, 0.06, 0.3, '#c8a060', e.x, y, e.z + e.d / 2 + 0.5, 0.006); }
      }
      if (tetto > 0) {
        const cono = mesh(new T.ConeGeometry(Math.hypot(e.w, e.d) / 2 + 0.3, 1.6 * tetto, 4, 1, true), M(COLORI[p.colore % COLORI.length].tetto), { x: e.x, y: 4.95 + 0.8 * tetto, z: e.z, l: 0.02 });
        cono.rotation.y = PI / 4; cono.scale.set(e.w / Math.hypot(e.w, e.d) * 1.4, 1, e.d / Math.hypot(e.w, e.d) * 1.4); g.add(cono);
      }
      // betoniera e mattoni
      const bet = mesh(new T.CylinderGeometry(0.35, 0.5, 0.8, 12), M('#e07a2a'), { x: r.x0 + 1, y: 0.8, z: r.z0 + 2.2, l: 0.01 }); bet.rotation.z = 0.6; g.add(bet);
      box(0.8, 0.4, 0.8, '#b0563a', r.x1 - 1, 0.2, r.z0 + 1.5);
      ost.push({ t: 'b', x0: e.x - e.w / 2 - 0.6, x1: e.x + e.w / 2 + 0.6, z0: e.z - e.d / 2 - 0.6, z1: e.z + e.d / 2 + 0.6 });
    } else if (p && p.finito && B.edificioPiazza) {
      const c = COLORI[p.colore % COLORI.length];
      edificio = B.edificioPiazza({ x: e.x, z: e.z, rot: PI, w: e.w, d: e.d, nome: p.nome, muro: c.muro, muroSopra: c.muroSopra, tetto: c.tetto, persiane: c.persiane, tendaA: '#f6e8cc', tendaB: c.tendaB, porta: 0, tendaLarg: 3.4 });
    }
    app.gP.add(g);
    ost.forEach(o => app.piazza.ostacoli.push(o));
    // la porta dell'edificio finito
    let porta = null;
    if (p && p.finito) {
      porta = { id: 'porta-' + l.id, nome: p.nome, x: geo.porta.x, z: geo.porta.z, r: 1.35, testo: p.tipo === 'casa' ? (sonoIo(l.chi) ? 'Entra in casa tua' : 'Bussa a ' + p.nome) : 'Guarda ' + p.nome, fn: () => portaLotto(l.id) };
      app.piazza.porte.push(porta);
    }
    return { g, tocco, ost: ost.concat(edificio ? edificio.ost : []), edificio, porta };
  }
  function smonta(v) {
    const app = S.app;
    if (v.g.parent) v.g.parent.remove(v.g);
    if (v.edificio && v.edificio.g.parent) v.edificio.g.parent.remove(v.edificio.g);
    v.ost.forEach(o => { const i = app.piazza.ostacoli.indexOf(o); if (i >= 0) app.piazza.ostacoli.splice(i, 1); });
    if (v.porta) { const i = app.piazza.porte.indexOf(v.porta); if (i >= 0) app.piazza.porte.splice(i, 1); }
  }

  /* ---------- porte: la casa del lotto e le casette lasciate vuote ---------- */
  function uscitaDi(stanza) { const st = S.app.stanze[stanza]; return st && (st.porte || []).find(q => q.id === 'porta-uscita'); }
  function portaLotto(id) {
    const l = S.dati.find(q => q.id === id); if (!l || !l.progetto) return;
    const p = l.progetto, app = S.app, geo = l.geo;
    if (p.tipo === 'negozio') { const b = (B.AgentiIA && B.AgentiIA.apriBancone); if (b) b(id); return; }
    if (sonoIo(l.chi)) {
      // la mia casa: si entra nella casa del gioco e uscendo si torna qui
      const u = uscitaDi('casa'); if (u) { if (!u.arrivoBorgo) u.arrivoBorgo = u.arrivo; u.arrivo = { x: geo.ritorno.x, z: geo.ritorno.z, yaw: PI }; S.casaDaLotto = true; }
      G.emetti('transizione', () => app.entraStanza('casa', app.stanze.casa.spawn));
      return;
    }
    if (!l.chi.vero && app.stanze['casa_' + l.chi.id]) { G.emetti('transizione', () => app.entraStanza('casa_' + l.chi.id, { x: 0, z: 2.4, yaw: PI })); return; }
    G.emetti('toast', p.nome + ': è una casa privata');
  }
  // un abitante IA che si e' trasferito: la sua casetta del borgo resta vuota e l'uscita della sua stanza porta alla casa nuova
  function aggiornaTraslochi() {
    const app = S.app, mossi = {};
    S.dati.forEach(l => { if (l.chi && !l.chi.vero && l.progetto && l.progetto.finito && l.progetto.tipo === 'casa') mossi['casa_' + l.chi.id] = l; });
    (app.piazza.porte || []).forEach(p => {
      if (!p.verso || p.verso.indexOf('casa_') !== 0 || p.id.indexOf('porta-lotto') === 0) return;
      const l = mossi[p.verso];
      if (l && !p.fnBorgo) { p.fnBorgo = true; p.testo0 = p.testo; p.testo = 'Casetta del borgo (vuota)'; p.fn = () => G.emetti('toast', 'Casetta vuota: ' + l.chi.nome + ' ora abita nella casa nuova sul ' + l.id.replace('lotto', 'lotto ')); }
      if (!l && p.fnBorgo) { p.fnBorgo = false; p.testo = p.testo0; delete p.fn; }
    });
    Object.keys(app.stanze).filter(k => k.indexOf('casa_') === 0).forEach(k => {
      const u = uscitaDi(k); if (!u) return; if (!u.arrivoBorgo) u.arrivoBorgo = u.arrivo;
      const l = mossi[k]; u.arrivo = l ? { x: l.geo.ritorno.x, z: l.geo.ritorno.z, yaw: PI } : u.arrivoBorgo;
    });
  }

  /* ---------- dati dal servizio ---------- */
  function applica(lista, listino, app) {
    S.app = app; S.dati = lista || []; if (listino) S.listino = listino;
    if (!S.agganciato && G.su) { S.agganciato = true; G.su('stanza', e => { if (e && e.id === 'casa' && !S.casaDaLotto) { const u = uscitaDi('casa'); if (u && u.arrivoBorgo) u.arrivo = u.arrivoBorgo; } S.casaDaLotto = false; }); }
    const visti = new Set();
    S.dati.forEach(l => {
      visti.add(l.id);
      const k = chiave(l), v = S.lotti.get(l.id);
      if (v && v.k === k) return;
      if (v) smonta(v);
      const n = costruisciLotto(l); n.k = k; S.lotti.set(l.id, n);
    });
    S.lotti.forEach((v, id) => { if (!visti.has(id)) { smonta(v); S.lotti.delete(id); } });
    aggiornaTraslochi();
    if (S.pannello) disegna();
  }
  const toccabili = () => [...S.lotti.entries()].map(([id, v]) => ({ obj: v.tocco, fn: () => apri(id) }));

  /* ---------- la scheda del lotto ---------- */
  function chiudi() { if (S.pannello) { S.pannello.remove(); S.pannello = null; } }
  function apri(id) {
    chiudi(); if (B.AgentiIA && B.AgentiIA.scheda) { B.AgentiIA.scheda.remove(); B.AgentiIA.scheda = null; }
    const el = document.createElement('div'); el.id = 'terreno-scheda'; el.dataset.id = id;
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,430px);max-height:66vh;overflow:auto;z-index:60;background:#2a1f36;color:#ffe9c4;border:2px solid #f2c76e;border-radius:16px;padding:14px 16px;font-family:sans-serif;font-size:14px;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.45)';
    el.innerHTML = '<button aria-label="Chiudi" class="tr-x" style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ffe9c4;font-size:22px;cursor:pointer">×</button><div class="tr-corpo"></div><div class="tr-nota" style="font-size:13px;margin-top:8px;min-height:1em"></div>';
    el.querySelector('.tr-x').addEventListener('click', chiudi);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    ['keydown', 'keyup', 'keypress'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
    (document.getElementById('app') || document.body).appendChild(el);
    S.pannello = el; S.scelta = null; disegna();
  }
  const btn = (cls, txt, pieno, extra) => `<button class="${cls}" ${extra || ''} style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:${pieno ? '0' : '2px solid #f2c76e'};background:${pieno ? '#f2c76e' : 'none'};color:${pieno ? '#2a1a2e' : '#ffe9c4'};font-weight:700;font-size:14px;cursor:pointer">${txt}</button>`;
  const nota = t => { const x = S.pannello && S.pannello.querySelector('.tr-nota'); if (x) x.textContent = t; };
  const SL = () => nomeMoneta();
  function disegna() {
    const el = S.pannello; if (!el) return;
    const l = S.dati.find(q => q.id === el.dataset.id); if (!l) return chiudi();
    const corpo = el.querySelector('.tr-corpo');
    if (corpo.querySelector('input:focus, select:focus')) return;   // mentre scrivi il nome del negozio non si ridisegna
    const p = l.progetto, L = S.listino, mio = sonoIo(l.chi), haGia = mioLotto();
    let h = `<div style="font-size:19px;font-weight:700">🏗️ ${esc(l.nome)}</div><div style="opacity:.8;font-size:12px;margin-bottom:8px">${l.w} × ${l.d} m · ${l.w * l.d} m²</div>`;
    if (!l.chi) {
      h += `<div>Un terreno recintato del borgo. Comprandolo diventa tuo: poi ci fai costruire <b>una casa</b> o <b>un negozio</b> dall'impresa del borgo.</div>
        <div style="margin-top:6px">Prezzo: <b>${fmt(l.prezzo)} ${SL()}</b> · ne hai ${fmt(B.Eco ? B.Eco.coins : 0)}</div>`;
      if (L) h += `<div style="opacity:.8;font-size:12px;margin-top:4px">Poi: casa ${fmt(L.progetti.casa.costo)} ${SL()} (${L.progetti.casa.ore} ore di cantiere) · negozio ${fmt(L.progetti.negozio.costo)} ${SL()} (${L.progetti.negozio.ore} ore). Il cantiere lavora dal lunedì al sabato, dalle 8 alle 17.</div>`;
      h += haGia ? `<div style="margin-top:8px;opacity:.85">Hai già un terreno (${esc(haGia.nome)}): se ne può avere uno solo.</div>` : btn('tr-compra', `Compra per ${fmt(l.prezzo)} ${SL()}`, true);
    } else if (!p) {
      h += `<div>Di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}. Ancora vuoto.</div>`;
      if (mio && L) {
        const c = L.progetti.casa, n = L.progetti.negozio;
        h += `<div style="margin-top:8px;font-weight:700">Cosa ci costruisci?</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="tr-tipo" data-t="casa" style="flex:1;padding:10px;border-radius:10px;border:2px solid #f2c76e;background:${S.scelta === 'casa' ? '#f2c76e' : 'none'};color:${S.scelta === 'casa' ? '#2a1a2e' : '#ffe9c4'};font-weight:700;cursor:pointer">🏠 Casa<br><span style="font-weight:400;font-size:12px">${fmt(c.costo)} ${SL()}</span></button>
            <button class="tr-tipo" data-t="negozio" style="flex:1;padding:10px;border-radius:10px;border:2px solid #f2c76e;background:${S.scelta === 'negozio' ? '#f2c76e' : 'none'};color:${S.scelta === 'negozio' ? '#2a1a2e' : '#ffe9c4'};font-weight:700;cursor:pointer">🏪 Negozio<br><span style="font-weight:400;font-size:12px">${fmt(n.costo)} ${SL()}</span></button>
          </div>`;
        if (S.scelta) {
          const q = L.progetti[S.scelta];
          h += `<div style="margin-top:8px;font-size:13px">${esc(q.descr)}. Materiali ${fmt(q.materiali)} ${SL()} + ${q.operai} operai per ${q.ore} ore (${fmt(q.costo - q.materiali)} ${SL()}). Si paga tutto subito. Il cantiere lavora dal lunedì al sabato dalle 8 alle 17: ci vogliono circa ${Math.ceil(q.ore / 9)} giorni di lavoro.</div>`;
          h += S.scelta === 'casa' ? `<div style="margin-top:6px;font-size:13px;opacity:.9">Finita, è l'ingresso in piazza della tua casa, con il tuo nome sopra.</div>`
            : `<div style="margin-top:8px">Cosa vende? <select class="tr-genere" style="padding:6px;border-radius:8px;font-size:15px">${Object.entries(L.generi).map(([k, g]) => `<option value="${k}">${g.icona} ${esc(g.nome)}</option>`).join('')}</select></div>
               <input class="tr-nome" maxlength="28" placeholder="Nome del negozio (es. Dolci di ${esc(mioNick())})" style="width:100%;box-sizing:border-box;margin-top:6px;padding:8px 10px;border-radius:10px;border:0;font-size:16px">
               <div style="margin-top:6px;font-size:13px;opacity:.9">Finito, ha un bancone davanti: ci lavori solo tu, convinci i clienti del borgo e tieni l'80% di ogni vendita.</div>`;
          h += btn('tr-costruisci', `Fai costruire per ${fmt(q.costo)} ${SL()}`, true);
        }
      }
    } else if (!p.finito) {
      const k = Math.round(p.fatte / p.ore * 100);
      h += `<div>Di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}: si costruisce <b>${esc(p.nome)}</b> (${p.tipo}).</div>
        <div style="margin-top:8px;background:#1f1729;border-radius:10px;height:14px;overflow:hidden"><div style="width:${k}%;height:100%;background:#f2c76e"></div></div>
        <div style="margin-top:4px;font-size:13px">${k}% · ${esc(p.fase)} · ${Math.round(p.fatte)} ore su ${p.ore}</div>
        <div style="margin-top:4px;font-size:13px;opacity:.9">Pronto circa ${esc(quando(p.fine))}. Il cantiere lavora dal lunedì al sabato, dalle 8 alle 17.</div>`;
    } else {
      h += `<div><b>${esc(p.nome)}</b>: ${p.tipo === 'casa' ? 'la casa' : 'il negozio'} di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}.</div>`;
      if (p.tipo === 'casa' && mio) h += btn('tr-entra', '🏠 Entra in casa', true);
      if (p.tipo === 'negozio') h += btn('tr-bancone', p.icona + ' Vai al bancone', true);
    }
    if (corpo.dataset.h === h) return;   // niente di nuovo: non si ridisegna (cosi' un tocco su un pulsante non si perde)
    corpo.dataset.h = h; corpo.innerHTML = h;
    const on = (sel, f) => { const b = corpo.querySelector(sel); if (b) b.addEventListener('click', f); };
    on('.tr-compra', () => compra(l));
    corpo.querySelectorAll('.tr-tipo').forEach(b => b.addEventListener('click', () => { S.scelta = b.dataset.t; disegna(); }));
    on('.tr-costruisci', () => costruisci(l));
    on('.tr-entra', () => { chiudi(); portaLotto(l.id); });
    on('.tr-bancone', () => { chiudi(); const b = B.AgentiIA && B.AgentiIA.apriBancone; if (b) b(l.id); });
  }

  // si paga subito dal portafoglio del gioco; se il borgo dice di no, i soldi tornano indietro
  async function paga(n, via) {
    const E = B.Eco; if (!E) return { ok: false, motivo: 'Portafoglio non disponibile.' };
    const soldi = E.coins;
    if (!E.spendi(n)) return { ok: false, motivo: `Servono ${fmt(n)} ${SL()}: ne hai ${fmt(soldi)}.` };
    let r;
    try { r = await B.AgentiIA.chiama('/terreno', Object.assign({ soldi }, via)); } catch (e) { r = { ok: false, motivo: 'Il borgo non risponde, riprova tra poco.' }; }
    if (!r.ok || r.spesa !== n) { E.stato.coins += n; E.salva(); E.avvisa(); if (r.ok) { E.spendi(r.spesa); } }
    return r;
  }
  async function compra(l) {
    if (!mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    nota('Firmo il contratto...');
    const r = await paga(l.prezzo, { azione: 'compra', lotto: l.id });
    if (!r.ok) return nota(r.motivo || 'Non si può, riprova.');
    G.emetti('toast', '🎉 Hai comprato ' + l.nome + '!'); nota(''); if (B.AgentiIA.aggiorna) B.AgentiIA.aggiorna();
  }
  async function costruisci(l) {
    const L = S.listino; if (!L || !S.scelta) return;
    const c = S.pannello.querySelector('.tr-corpo'), q = L.progetti[S.scelta];
    const d = { azione: 'costruisci', tipo: S.scelta };
    if (S.scelta === 'negozio') { d.genere = c.querySelector('.tr-genere').value; d.nome = c.querySelector('.tr-nome').value.trim(); }
    nota('Chiamo l\'impresa...');
    const r = await paga(q.costo, d);
    if (!r.ok) return nota(r.motivo || 'Non si può, riprova.');
    G.emetti('toast', '🏗️ Cantiere aperto: ' + r.nome); S.scelta = null; nota(''); if (B.AgentiIA.aggiorna) B.AgentiIA.aggiorna();
  }

  B.Terreni = { applica, toccabili, apri, chiudi, stato: S };
})();
