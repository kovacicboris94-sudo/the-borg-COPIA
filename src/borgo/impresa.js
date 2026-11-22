/* =====================================================================
   EDILBORGO, L'IMPRESA EDILE DEL BORGO (22/11/2026, Boris: "persone che
   lavorano al cantiere, anche le demo e gli utenti possono cercare lavoro
   al cantiere, quindi metti una societa' edile")
   - La sede in piazza: il container dell'ufficio con l'insegna, la bacheca
     "Cerchiamo operai" (si fa un turno da muratore) e chi lavora oggi.
   - Gli operai dei cantieri sono gli abitanti demo assunti la mattina dal
     servizio (agenti/impresa.mjs): qui camminano fino al cantiere, mettono
     il caschetto giallo e lavorano col martello; la sera tornano a passeggiare.
   ===================================================================== */
(function () {
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, G = window.Gioco, PI = Math.PI;
  const S = { sede: false, caschi: new Map(), dove: null };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SL = () => (B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight');
  const dati = () => (B.AgentiIA && B.AgentiIA.dati && B.AgentiIA.dati.impresa) || null;
  const lotti = () => (B.Terreni && B.Terreni.stato && B.Terreni.stato.dati) || [];

  /* ---------- la sede in piazza ---------- */
  function insegna() {
    const [cv, x] = B.tela(512, 160);
    x.fillStyle = '#1e1e1e'; x.fillRect(0, 0, 512, 160);
    for (let i = -4; i < 30; i++) { x.fillStyle = '#f2c21c'; x.beginPath(); x.moveTo(i * 36, 0); x.lineTo(i * 36 + 18, 0); x.lineTo(i * 36 - 2, 22); x.lineTo(i * 36 - 20, 22); x.fill(); x.beginPath(); x.moveTo(i * 36, 138); x.lineTo(i * 36 + 18, 138); x.lineTo(i * 36 - 2, 160); x.lineTo(i * 36 - 20, 160); x.fill(); }
    x.fillStyle = '#f2c21c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 64px sans-serif'; x.fillText('🏗️ EDILBORGO', 256, 68, 490);
    x.fillStyle = '#ffffff'; x.font = 'bold 26px sans-serif'; x.fillText('Impresa edile del Borgo', 256, 116, 490);
    return B.tex(cv);
  }
  function cartelloLavoro() {
    const [cv, x] = B.tela(256, 200);
    x.fillStyle = '#fff7d6'; x.fillRect(0, 0, 256, 200); x.strokeStyle = '#f2c21c'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 190);
    x.fillStyle = '#2a2a2a'; x.textAlign = 'center'; x.font = 'bold 30px sans-serif'; x.fillText('CERCHIAMO', 128, 52); x.fillText('OPERAI', 128, 88);
    x.font = 'bold 20px sans-serif'; x.fillStyle = '#7a4a10'; x.fillText('lun-sab 8-17', 128, 124); x.fillText('caschetto fornito 👷', 128, 156); x.font = '16px sans-serif'; x.fillText('tocca per candidarti', 128, 184);
    return B.tex(cv);
  }
  // un posto libero in piazza per il container (7 x 5 m): il primo dei candidati dove non c'e' niente
  function postoLibero(a) {
    // sempre lo stesso posto per tutti (accanto alle mura a est, sopra il Laghetto); gli altri solo se quello fosse occupato
    const C = [[44, 20], [40, 30], [-40, 30], [-44, 20]];
    for (const [x, z] of C) {
      let ok = true;
      for (let dx = -3.5; dx <= 3.5 && ok; dx += 1) for (let dz = -2.5; dz <= 3.5 && ok; dz += 1) if (!a.libero(a.stanze.piazza, x + dx, z + dz, 0.45)) ok = false;
      if (ok) return { x, z };
    }
    return null;
  }
  function sede(a) {
    if (S.sede || !a || !a.piazza || !a.stanze || !a.stanze.piazza) return; S.sede = true;
    const p = postoLibero(a); if (!p) return;
    const g = new T.Group(); g.position.set(p.x, 0, p.z); a.gP.add(g); S.dove = p;
    const box = (w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), M(col), { x, y, z, lb: lb === undefined ? 0.012 : lb }); g.add(m); return m; };
    // il container dell'ufficio, con le nervature
    box(5.2, 2.5, 2.4, '#e9e4d8', 0, 1.35, 0.6, 0.02);
    box(5.4, 0.12, 2.6, '#f2c21c', 0, 2.66, 0.6, 0.01);
    box(5.3, 0.12, 2.5, '#4a4a4a', 0, 0.06, 0.6, 0.01);
    for (let i = -2.4; i <= 2.41; i += 0.4) box(0.05, 2.4, 0.05, '#cfc8b8', i, 1.35, -0.62, 0.004);
    box(0.9, 1.95, 0.06, '#3a5a7a', -1.4, 1.1, -0.63, 0.008);                       // la porta
    const fin = new T.Mesh(new T.PlaneGeometry(1.5, 0.9), new T.MeshBasicMaterial({ color: '#bfe3f0' })); fin.position.set(0.9, 1.6, -0.64); fin.rotation.y = PI; g.add(fin);
    box(1.6, 0.06, 0.06, '#4a4a4a', 0.9, 1.15, -0.64, 0.004);
    // l'insegna sul tetto
    [-1.9, 1.9].forEach(dx => box(0.08, 0.8, 0.08, '#4a4a4a', dx, 3.0, 0.2, 0.004));
    const ins = new T.Mesh(new T.PlaneGeometry(4.4, 1.38), new T.MeshBasicMaterial({ map: insegna() })); ins.position.set(0, 3.55, 0.15); ins.rotation.y = PI; g.add(ins);
    box(4.5, 1.45, 0.06, '#1e1e1e', 0, 3.55, 0.2, 0.006);
    // la bacheca "Cerchiamo operai"
    const bx = 3.6, bz = -0.6;
    [-0.5, 0.5].forEach(dx => box(0.08, 1.7, 0.08, '#4a4a4a', bx + dx, 0.85, bz, 0.004));
    const tab = new T.Mesh(new T.PlaneGeometry(1.2, 0.95), new T.MeshBasicMaterial({ map: cartelloLavoro() })); tab.position.set(bx, 1.4, bz - 0.04); tab.rotation.y = PI; g.add(tab);
    box(1.28, 1.02, 0.05, '#f2c21c', bx, 1.4, bz, 0.004);
    // la rastrelliera dei caschetti, i coni, la sabbia, la carriola
    box(0.9, 0.08, 0.3, '#6b4326', -3.2, 1.3, -0.5, 0.004);
    [-3.5, -3.2, -2.9].forEach(x => { const c = mesh(new T.SphereGeometry(0.15, 10, 6, 0, PI * 2, 0, PI / 2), M('#ffd21c'), { x, y: 1.34, z: -0.5, l: 0.004 }); g.add(c); });
    [[-3.6, -2.2], [-2.2, -2.4], [2.4, -2.4]].forEach(q => { g.add(mesh(new T.ConeGeometry(0.18, 0.55, 10), M('#ff6a1c'), { x: q[0], y: 0.28, z: q[1], l: 0.006 })); g.add(mesh(new T.CylinderGeometry(0.13, 0.15, 0.08, 10), M('#ffffff'), { x: q[0], y: 0.3, z: q[1] })); });
    g.add(mesh(new T.ConeGeometry(0.9, 0.7, 10), M('#e0c48a'), { x: 3.4, y: 0.35, z: 2.4, l: 0.008 }));
    box(0.6, 0.3, 0.9, '#3f7a3a', 2.2, 0.45, 2.6, 0.006); box(0.05, 0.05, 1.2, '#5a5a5a', 2.2, 0.4, 3.3, 0.004);
    g.updateMatrixWorld(true);
    a.piazza.ostacoli.push({ t: 'b', x0: p.x - 2.7, x1: p.x + 2.7, z0: p.z - 0.65, z1: p.z + 1.85 });
    a.piazza.ostacoli.push({ t: 'c', x: p.x + bx, z: p.z + bz, r: 0.6 }, { t: 'c', x: p.x + 3.4, z: p.z + 2.4, r: 0.9 });
    const tocco = new T.Mesh(new T.BoxGeometry(6.5, 3.5, 3.5), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.set(0.5, 1.7, 0.4); g.add(tocco); g.updateMatrixWorld(true);
    const apri = () => B.Lavoro && B.Lavoro.apri('impresa');
    a.piazza.toccabili.push({ obj: tocco, fn: apri });
    a.piazza.porte.push({ id: 'porta-edilborgo', nome: 'Edilborgo', x: p.x - 1.4, z: p.z - 1.4, r: 1.2, testo: '🏗️ Edilborgo: cerca lavoro al cantiere', fn: apri });
    a.piazza.porte.push({ id: 'porta-edilborgo-bacheca', nome: 'Edilborgo', x: p.x + bx, z: p.z + bz - 1.0, r: 1.0, testo: '👷 Cerchiamo operai', fn: apri });
  }

  // in cima alla scheda del lavoro di Edilborgo: chi e' l'impresa e chi lavora oggi nei cantieri
  function intestazione() {
    const d = dati(), aperti = lotti().filter(l => l.progetto && !l.progetto.finito);
    let h = `<div style="background:#1e1e1e;border:2px solid #f2c21c;border-radius:12px;padding:8px 10px;margin:4px 0 10px">
      <div style="font-size:18px;font-weight:800;color:#f2c21c">🏗️ ${esc(d ? d.titolo : 'Edilborgo · Impresa edile del Borgo')}</div>
      <div style="font-size:12px;opacity:.9;color:#fff">Titolare: ${esc(d ? d.titolare : 'Rocco Malta')}. Costruisce case, ville e negozi sui terreni del borgo. Ogni mattina alle 8 assume gli operai tra gli abitanti che cercano lavoro e li manda nei cantieri; paga ${d ? d.pagaOra : 30} ${SL()} l'ora. Più operai ci sono, prima finisce il cantiere.</div>`;
    if (!aperti.length) h += `<div style="font-size:13px;margin-top:6px;color:#fff">Adesso nel borgo non ci sono cantieri aperti.</div>`;
    aperti.forEach(l => {
      const p = l.progetto, sq = p.squadra || [], k = Math.round(p.fatte / p.ore * 100);
      h += `<div style="font-size:13px;margin-top:6px;color:#fff"><b>${esc(p.nome)}</b> · ${k}%${p.ritmo != null ? ' · ritmo ' + Math.round(p.ritmo * 100) + '%' : ''}<br><span style="opacity:.85">${sq.length ? sq.map(o => (o.tipo === 'agente' ? '🤖 ' : o.tipo === 'giocatore' ? '🧑 ' : '👷 ') + esc(o.nome) + (o.ruolo ? ' (' + esc(o.ruolo) + ')' : '')).join(', ') : 'nessuno al lavoro adesso (si lavora lun-sab dalle 8 alle 17)'}</span></div>`;
    });
    if (d && d.paghe && d.paghe.length) h += `<div style="font-size:12px;margin-top:6px;opacity:.8;color:#fff">Guadagnato lavorando per Edilborgo: ${d.paghe.slice(0, 5).map(q => esc(q[0]) + ' ' + q[1] + ' ' + SL()).join(' · ')}</div>`;
    return h + '</div>';
  }

  /* ---------- gli abitanti demo al lavoro nel cantiere ---------- */
  function casco() {
    const g = new T.Group(); g.name = 'casco-edilborgo';
    const c = mesh(new T.SphereGeometry(0.27, 14, 8, 0, PI * 2, 0, PI / 2), M('#ffd21c'), { l: 0.008 }); g.add(c);
    const vis = mesh(new T.CylinderGeometry(0.32, 0.32, 0.03, 14, 1, false, -PI / 2, PI), M('#f2c21c'), {}); vis.position.y = 0.01; vis.rotation.y = PI; g.add(vis);
    const martello = new T.Group(); martello.name = 'martello';
    martello.add(mesh(new T.BoxGeometry(0.05, 0.42, 0.05), M('#8a5a35'), { y: -0.2 }));
    martello.add(mesh(new T.BoxGeometry(0.2, 0.08, 0.08), M('#666'), { y: -0.42 }));
    return { g, martello };
  }
  // i posti di lavoro intorno all'edificio (fuori dalle macchine e dall'impalcatura)
  function posti(l) {
    const e = l.geo.edificio, x0 = e.x - e.w / 2, x1 = e.x + e.w / 2, zF = e.z - e.d / 2;
    return [[x0 - 0.95, zF - 1.15], [e.x + 1.3, zF - 1.25], [x0 - 0.95, e.z + 0.6], [x1 + 0.95, e.z - 0.4], [e.x - 0.6, zF - 1.25]].map(q => ({ x: q[0], z: q[1], yaw: Math.atan2(e.x - q[0], e.z - q[1]) }));
  }
  function squadre() {
    const a = B.app; if (!a || !a.npc) return;
    sede(a);
    const vuoi = new Map();
    lotti().forEach(l => { const p = l.progetto; if (!p || p.finito || !p.squadra) return; const P = posti(l); p.squadra.filter(o => o.tipo === 'demo').forEach((o, i) => vuoi.set(o.demo, Object.assign({ ruolo: o.ruolo }, P[i % P.length]))); });
    // chi ha finito torna a passeggiare (via il caschetto)
    S.caschi.forEach((v, id) => { if (vuoi.has(id)) return; const n = a.npc.find(q => q.id === id); if (n) { n.av.root.remove(v.g); n.av.root.remove(v.martello); n.att = 0; } S.caschi.delete(id); });
    const t = performance.now() / 1000;
    vuoi.forEach((sp, id) => {
      const n = a.npc.find(q => q.id === id); if (!n) return;
      let v = S.caschi.get(id);
      if (!v) { v = casco(); v.g.position.y = 2.02; v.martello.position.set(0.34, 1.32, 0.12); n.av.root.add(v.g); n.av.root.add(v.martello); v.da = t; S.caschi.set(id, v); }
      const d = Math.hypot(n.x - sp.x, n.z - sp.z);
      if (d > 0.35 && (t - v.da > 7 || d > 25)) { n.x = sp.x; n.z = sp.z; d0(n); }   // dal cancello si entra (o si arriva da lontano)
      if (Math.hypot(n.x - sp.x, n.z - sp.z) > 0.35) { n.tx = sp.x; n.tz = sp.z; if (n.att > 0.2) n.att = 0; }
      else { n.x = sp.x; n.z = sp.z; d0(n); n.att = 2; n.yaw = sp.yaw; v.lavora = true; }
    });
  }
  const d0 = n => { n.vx = n.vz = 0; };
  // il martello batte (ogni fotogramma, solo per chi e' al suo posto)
  function anima(t) { S.caschi.forEach(v => { if (v.lavora) v.martello.rotation.x = -0.6 + Math.sin(t * 7 + (v.da || 0)) * 0.8; }); }
  let agg = false;
  function frame() {
    const a = B.app; if (!a || !a.piazza) return;
    if (!agg && a.piazza.anim) { agg = true; a.piazza.anim.push(t => anima(t)); }
    squadre();
  }
  setInterval(frame, 1000);
  B.Impresa = { intestazione, stato: S, squadre };
})();
