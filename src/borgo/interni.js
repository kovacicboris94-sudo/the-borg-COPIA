/* =====================================================================
   THE BORG 3D - GLI INTERNI DEI NEGOZI E DEGLI EDIFICI DEL BORGO
   Chiesto da Boris il 22/11/2026: "rendi tutto esplorabile e metti piu'
   mestieri: ogni casa e mestiere deve funzionare". Prima la Caffetteria, il
   Forno, il Fioraio, la Banca e i negozi costruiti sui terreni avevano solo
   la facciata (Ada ha provato 9 volte a entrare nella Caffetteria).
   Ogni interno ha la sua stanza, con le stesse misure che usa il servizio
   degli agenti (agenti/interni.mjs): cosi' Ada, Teo e le persone vere si
   vedono dentro allo stesso posto.
   - Il bancone dei negozi lo disegna agenti-ia.js (viene dal servizio, con
     chi ci lavora e il cliente); qui c'e' tutto il resto: forno a legna,
     macchina del caffe', secchi di fiori, sportelli della banca, lettino
     dell'ambulatorio... e la bacheca "Cerchiamo personale" (lavoro.js).
   - Tipi: bar, forno, fiori, dolci, alimentari, bottega, banca, arredi,
     ambulatorio. I negozi sui terreni usano il tipo del loro genere.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh;
  const PI = Math.PI;

  // gli edifici della piazza che hanno un interno (porta = dove si esce in piazza; stesse misure di agenti/interni.mjs)
  const INTERNI = {
    caffetteria: { nome: 'Caffetteria', tipo: 'bar', fuori: { x: 18.3, z: -4.9, yaw: 0 } },
    forno: { nome: 'Forno', tipo: 'forno', fuori: { x: 44, z: -4.9, yaw: 0 } },
    fioraio: { nome: 'Fioraio', tipo: 'fiori', fuori: { x: 46.9, z: 50, yaw: -PI / 2 } },
    arredamenti: { nome: 'Arredamenti', tipo: 'arredi', fuori: { x: -46.9, z: 4, yaw: PI / 2 } },
    banca: { nome: 'Banca del Borgo', tipo: 'banca', w: 14, fuori: { x: 32, z: 43.4, yaw: PI } },
    ambulatorio: { nome: 'Ambulatorio del Borgo', tipo: 'ambulatorio', fuori: { x: 31, z: -4.9, yaw: 0 } }
  };
  B.INTERNI = INTERNI;
  // il genere dei negozi costruiti sui terreni (agenti/terreni.mjs GENERI) -> tipo di interno
  B.tipoInterno = g => ({ bar: 'bar', forno: 'forno', fiori: 'fiori', dolci: 'dolci', alimentari: 'alimentari', bottega: 'bottega' })[g] || 'bottega';

  const STILE = {
    bar: { muro: '#f1e3c8', fascia: '#2f6a78', pav: 'scacchi', insegna: '☕' },
    forno: { muro: '#f0dcc0', fascia: '#a0522d', pav: 'cotto', insegna: '🥖' },
    fiori: { muro: '#eef2e6', fascia: '#4f8a3a', pav: 'pietra', insegna: '💐' },
    dolci: { muro: '#f8e4ec', fascia: '#c05a7a', pav: 'scacchi', insegna: '🧁' },
    alimentari: { muro: '#f2ead8', fascia: '#6a7a2f', pav: 'cotto', insegna: '🧺' },
    bottega: { muro: '#ece0cc', fascia: '#7a4a2a', pav: 'legno', insegna: '🏺' },
    banca: { muro: '#ece8de', fascia: '#2f4a6a', pav: 'marmo', insegna: '🏦' },
    arredi: { muro: '#efe6d8', fascia: '#b0703c', pav: 'legno', insegna: '🛋️' },
    ambulatorio: { muro: '#eef4f6', fascia: '#3f8a9a', pav: 'linoleum', insegna: '⚕️' }
  };

  // l'arredo scelto da chi costruisce un negozio sul suo terreno (agenti/terreni.mjs ARREDI)
  const ARREDO = {
    rustico: { pav: 'cotto' },
    moderno: { muro: '#f6f6f2', pav: 'linoleum' },
    elegante: { muro: '#efe8dc', fascia: '#2a2a2a', pav: 'marmo' }
  };
  function texPavimento(tipo) {
    const [cv, x] = B.tela(256, 256);
    if (tipo === 'scacchi') { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#2a2a30' : '#efe8da'; x.fillRect(i * 32, j * 32, 32, 32); } }
    else if (tipo === 'cotto') { x.fillStyle = '#b8643c'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#8a4a2a'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); } for (let i = 0; i < 300; i++) { x.fillStyle = Math.random() < 0.5 ? '#c47450' : '#a85a34'; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); } }
    else if (tipo === 'pietra') { x.fillStyle = '#b9b4aa'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 40; i++) { x.fillStyle = ['#a8a398', '#c8c3b8', '#b0aa9e'][i % 3]; B.rr(x, (i % 6) * 43 + 2, Math.floor(i / 6) * 40 + 2, 39, 36, 6); x.fill(); } }
    else if (tipo === 'marmo') { x.fillStyle = '#f2efe8'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(150,140,130,0.35)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(Math.random() * 256, 0); x.bezierCurveTo(Math.random() * 256, 90, Math.random() * 256, 170, Math.random() * 256, 256); x.stroke(); } x.strokeStyle = '#d8d2c4'; x.lineWidth = 2; x.strokeRect(0, 0, 128, 128); x.strokeRect(128, 128, 128, 128); }
    else if (tipo === 'linoleum') { x.fillStyle = '#d8e6e2'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 400; i++) { x.fillStyle = Math.random() < 0.5 ? '#cddcd8' : '#e4eeea'; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); } }
    else return B.texParquet();
    return B.tex(cv, true);
  }
  function insegnaTex(testo, fondo, bordo) {
    const [cv, x] = B.tela(512, 128); B.rr(x, 4, 4, 504, 120, 22); x.fillStyle = fondo || '#2a1f33'; x.fill(); x.lineWidth = 8; x.strokeStyle = bordo || '#ffd36a'; x.stroke();
    x.font = 'bold 58px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff4dc'; x.fillText(testo, 256, 66, 480);
    return B.tex(cv);
  }

  /* def = { nome, tipo, w, d, fuori: {x, z, yaw}, verso } -> la stanza (stesso formato delle altre: ostacoli, porte, sedili, toccabili...) */
  function costruisciInterno(scena, def) {
    const W = def.w || 12, D = def.d || 10, X = W / 2, Z0 = -D / 2, Z1 = D / 2, st = Object.assign({}, STILE[def.tipo] || STILE.bottega, ARREDO[def.arredo] || {});
    const AREA = { x0: -X + 0.5, x1: X - 0.5, z0: Z0 + 0.6, z1: Z1 - 0.4 };
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), typeof col === 'string' ? M(col) : col, { x, y, z, l: l === undefined ? 0.015 : l }); g.add(m); return m; };
    const palla = (g, r, col, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 10, 8), M(col)); m.position.set(x, y, z); g.add(m); return m; };
    const siedi = (x, z, yaw, y) => { const s = { x, z, y: y || 0.46, yt: 0, yaw }; s.azione = { sedile: s, nome: 'Siediti', testo: 'Siediti' }; sedili.push(s); };
    const info = (x, y, z, w, h, d, testo, fn) => { const p = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial()); p.position.set(x, y, z); p.visible = false; scena.add(p); toccabili.push(fn ? { obj: p, fn } : { obj: p, tipo: 'azione', testo }); return p; };
    // le comparse (impiegate della banca, la dottoressa): avatar fermi, solo scena
    const comparsa = (id, x, z, yaw, look) => {
      const u = id && ((window.CONFIG || {}).utentiDemo || []).find(q => q.id === id); look = look || (u && u.look); if (!look || !B.creaAvatar) return;
      try { const av = B.unisciAvatar ? B.unisciAvatar(B.creaAvatar(look)) : B.creaAvatar(look); av.root.position.set(x, 0, z); av.root.rotation.y = yaw || 0; scena.add(av.root); } catch (e) { /* solo scena */ }
    };
    const legno = '#a96f44', legnoS = '#6b4326', bianco = '#f4f1ea', acciaio = '#c8ccd2';
    const sedia = (x, z, yaw, col) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; scena.add(g);
      scatola(g, 0.44, 0.05, 0.44, col || legno, 0, 0.46, 0, 0.01); scatola(g, 0.44, 0.5, 0.05, col || legno, 0, 0.72, -0.2, 0.008);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => scatola(g, 0.04, 0.46, 0.04, legnoS, q[0] * 0.19, 0.23, q[1] * 0.19, 0));
      ostacoli.push({ t: 'c', x, z, r: 0.26 }); siedi(x, z, yaw + PI);
    };
    const tavolino = (x, z, col) => { cil(scena, 0.45, 0.45, 0.05, col || '#f4efe6', x, 0.74, z, 18, 0.012); cil(scena, 0.05, 0.05, 0.72, '#3a3a40', x, 0.37, z, 8, 0); cil(scena, 0.25, 0.25, 0.03, '#3a3a40', x, 0.02, z, 12, 0); ostacoli.push({ t: 'c', x, z, r: 0.5 }); };
    const scaffale = (x, z, w, rot, col, roba) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; scena.add(g);
      scatola(g, w, 2.2, 0.45, col || legno, 0, 1.1, 0, 0.015);
      for (let i = 0; i < 4; i++) { scatola(g, w - 0.08, 0.04, 0.42, '#e8d8bc', 0, 0.35 + i * 0.52, 0.02, 0.006); if (roba) roba(g, 0.37 + i * 0.52, i); }
      const c = Math.abs(Math.cos(rot || 0)) > 0.5; ostBox(x, z, c ? w : 0.55, c ? 0.55 : w); return g;
    };

    /* ---------- pavimento e pareti ---------- */
    scena.add(mesh(new T.BoxGeometry(W + 0.4, 0.9, D + 0.4), M('#6f6485'), { y: -0.46, z: 0, lb: 0.05 }));
    const tp = texPavimento(st.pav); tp.repeat.set(W / 4, D / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshToonMaterial({ map: tp, gradientMap: gm, color: new T.Color(st.pav === 'legno' ? '#e0c8a8' : '#ffffff') })); pav.rotation.x = -PI / 2; pav.position.y = 0.002; pav.receiveShadow = true; scena.add(pav);
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h) {
      scatola(g, w + 0.3, h + 0.3, 0.12, bianco, x, y, 0.03);
      const v = new T.Mesh(new T.PlaneGeometry(w, h), matVetro()); v.position.set(x, y, 0.1); g.add(v);
      scatola(g, 0.06, h, 0.05, bianco, x, y, 0.13, 0); scatola(g, w + 0.5, 0.1, 0.3, '#e8dcc8', x, y - h / 2 - 0.18, 0.15, 0.012);
    }
    function parete(len, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 3.4, 0.3), M(st.muro), { y: 1.7, z: -0.15, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.9, 0.06, st.fascia, 0, 0.45, 0.03, 0.01);       // zoccolo colorato
      scatola(g, len, 0.12, 0.08, legnoS, 0, 0.92, 0.05, 0.008);
      if (contenuto) contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
    }
    parete(W + 0.6, 0, Z0, 0, [0, -1], g => {
      const ins = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: insegnaTex(st.insegna + ' ' + def.nome, '#2a1f33', '#ffd36a') })); ins.position.set(0, 3.0, 0.1); g.add(ins);
    });
    parete(D + 0.3, -X, 0, PI / 2, [-1, 0], g => { finestra(g, -1.8, 2.0, 1.3, 1.1); finestra(g, 1.8, 2.0, 1.3, 1.1); });
    parete(D + 0.3, X, 0, -PI / 2, [1, 0], g => { finestra(g, -1.8, 2.0, 1.3, 1.1); finestra(g, 1.8, 2.0, 1.3, 1.1); });
    // la vetrina sul davanti (bassa: non copre la vista), con la porta in mezzo
    [-1, 1].forEach(s => { scatola(scena, X - 1.0, 0.6, 0.2, st.fascia, s * (X + 1.0) / 2, 0.3, Z1 + 0.1, 0.012); ostBox(s * (X + 1.0) / 2, Z1 + 0.1, X - 1.0, 0.3); });
    const usc = new T.Group(); usc.position.set(0, 0, Z1 + 0.15); scena.add(usc);
    [-1, 1].forEach(s => scatola(usc, 0.16, 2.6, 0.2, legnoS, s * 0.85, 1.3, 0, 0.015)); scatola(usc, 1.86, 0.18, 0.2, legnoS, 0, 2.6, 0, 0.015);
    const mt = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, Z1 - 0.6); scena.add(mt);
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 0.7, r: 1.1, verso: def.verso || 'piazza', arrivo: def.fuori });

    /* ---------- l'arredamento, secondo il tipo ---------- */
    const t = def.tipo;
    const banconeDietro = (col) => { scatola(scena, W - 4, 0.95, 0.6, col || legno, 0, 0.475, Z0 + 0.6, 0.015); scatola(scena, W - 3.9, 0.06, 0.66, '#5a5560', 0, 0.98, Z0 + 0.6, 0.01); ostBox(0, Z0 + 0.6, W - 3.8, 0.8); };
    if (t === 'bar' || t === 'dolci') {
      banconeDietro('#5a3a2a');
      // macchina del caffe' (con il vapore) e macinino
      const mc = new T.Group(); mc.position.set(-1.6, 1.0, Z0 + 0.55); scena.add(mc);
      scatola(mc, 0.9, 0.5, 0.45, '#c8ccd2', 0, 0.25, 0, 0.01); scatola(mc, 0.9, 0.08, 0.5, '#2a2a30', 0, 0.54, 0, 0.006);
      [-0.22, 0.22].forEach(dx => cil(mc, 0.05, 0.05, 0.12, '#2a2a30', dx, 0.08, 0.26, 8, 0));
      cil(scena, 0.1, 0.12, 0.35, '#3a2a20', -0.6, 1.18, Z0 + 0.55, 10, 0.006);
      const vap = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })); scena.add(vap);
      anim.push(tt => { const k = (tt * 0.6) % 1; vap.position.set(-1.6, 1.7 + k * 0.6, Z0 + 0.75); vap.material.opacity = 0.4 * (1 - k); vap.scale.setScalar(1 + k); });
      // tazzine e bottiglie sugli scaffali
      scatola(scena, W - 4, 0.04, 0.3, '#e8d8bc', 0, 1.9, Z0 + 0.2, 0.006); scatola(scena, W - 4, 0.04, 0.3, '#e8d8bc', 0, 2.4, Z0 + 0.2, 0.006);
      for (let i = 0; i < 14; i++) cil(scena, 0.05, 0.05, 0.28, ['#3a7a4a', '#7a2a2a', '#c8a040', '#2a4a7a'][i % 4], -3.4 + i * 0.5, 2.56, Z0 + 0.2, 8, 0);
      for (let i = 0; i < 12; i++) cil(scena, 0.05, 0.04, 0.07, bianco, -2.8 + i * 0.5, 1.96, Z0 + 0.2, 8, 0);
      // vetrina dei dolci a destra
      const vx = 2.2, vz = Z0 + 0.6;
      const vt = new T.Mesh(new T.BoxGeometry(1.6, 0.5, 0.5), new T.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.35 })); vt.position.set(vx, 1.25, vz); scena.add(vt);
      for (let i = 0; i < 6; i++) palla(scena, 0.08, ['#e0a040', '#a0522d', '#f4d0e0', '#6a3a2a'][i % 4], vx - 0.6 + i * 0.24, 1.08, vz + (i % 2 ? 0.1 : -0.1));
      // lavagna con il menu
      const [cv, x] = B.tela(256, 320); x.fillStyle = '#26302a'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#f4f1ea'; x.font = 'bold 30px Georgia'; x.textAlign = 'center'; x.fillText(t === 'bar' ? 'MENU' : 'DOLCI', 128, 44);
      x.font = '22px Georgia'; (t === 'bar' ? ['Caffe\'  6', 'Cappuccino  9', 'Cornetto  8', 'Cioccolata  10', 'Torta  18', 'Spremuta  9'] : ['Pasticcino  4', 'Cannolo  9', 'Tiramisu\'  14', 'Gelato  8', 'Torta  40']).forEach((r, i) => x.fillText(r, 128, 96 + i * 36));
      const lav = new T.Mesh(new T.PlaneGeometry(1.0, 1.25), new T.MeshBasicMaterial({ map: B.tex(cv) })); lav.position.set(-X + 0.18, 2.0, -2.4); lav.rotation.y = PI / 2; scena.add(lav);
      // tavolini con le sedie
      [[-3.6, 1.4], [3.6, 1.4], [-3.6, -1.6], [3.6, -1.4]].forEach(p => { tavolino(p[0], p[1]); sedia(p[0] - 0.8, p[1], PI / 2); sedia(p[0] + 0.8, p[1], -PI / 2); });
      info(-1.6, 1.3, Z0 + 0.6, 1.4, 1, 0.8, 'Macchina del caffè: il caffè lo fa chi è al bancone o il barista in turno');
    } else if (t === 'forno') {
      // il forno a legna, a cupola, con la bocca accesa
      const fx = -3.4, fz = Z0 + 1.3;
      scatola(scena, 2.2, 1.0, 2.0, '#b8a48a', fx, 0.5, fz, 0.02);
      const cupola = new T.Mesh(new T.SphereGeometry(1.0, 18, 10, 0, PI * 2, 0, PI / 2), M('#c9805a')); cupola.position.set(fx, 1.0, fz); scena.add(cupola);
      const bocca = new T.Mesh(new T.CircleGeometry(0.34, 16, 0, PI), new T.MeshBasicMaterial({ color: 0xff8a3a })); bocca.position.set(fx, 1.02, fz + 0.99); scena.add(bocca);
      anim.push(tt => { const k = 0.75 + 0.25 * Math.sin(tt * 7) * Math.sin(tt * 3.1); bocca.material.color.setRGB(1, 0.45 + 0.15 * k, 0.15); });
      cil(scena, 0.16, 0.16, 1.6, '#8a6a5a', fx, 2.4, fz - 0.4, 10, 0.01);
      ostBox(fx, fz, 2.4, 2.2);
      for (let i = 0; i < 5; i++) cil(scena, 0.07, 0.07, 0.9, '#7a5a3a', fx + 1.5 + (i % 3) * 0.16, 0.08 + Math.floor(i / 3) * 0.14, fz + 0.6, 8, 0).rotation.z = PI / 2;   // legna
      banconeDietro('#8a5a36');
      // ceste di pane sul bancone di dietro e scaffali pieni
      scaffale(3.6, Z0 + 0.35, 2.4, 0, legno, (g, y, i) => { for (let k = 0; k < 5; k++) { const p = new T.Mesh(new T.SphereGeometry(0.14, 10, 6), M(i % 2 ? '#d89a50' : '#c07a3a')); p.scale.set(1.4, 0.7, 1); p.position.set(-0.9 + k * 0.45, y + 0.08, 0.05); g.add(p); } });
      // sacchi di farina e impastatrice
      [[4.8, 1.8], [4.8, 2.6], [4.2, 2.2]].forEach(p => { const s = cil(scena, 0.3, 0.34, 0.7, '#efe6d0', p[0], 0.35, p[1], 10, 0.01); s.scale.z = 0.7; ostacoli.push({ t: 'c', x: p[0], z: p[1], r: 0.34 }); });
      cil(scena, 0.4, 0.3, 0.9, '#c8ccd2', -4.6, 0.45, 2.2, 14, 0.01); cil(scena, 0.42, 0.42, 0.3, acciaio, -4.6, 1.05, 2.2, 14, 0.01); ostacoli.push({ t: 'c', x: -4.6, z: 2.2, r: 0.5 });
      info(fx, 1.2, fz, 2.2, 2, 2.2, 'Il forno a legna: il fornaio inforna il pane prima dell\'alba (turno da fornaio 5-12)');
    } else if (t === 'fiori') {
      banconeDietro('#6a8a4a');
      // secchi di fiori lungo le pareti
      const fiori = ['#e0405a', '#f4d03f', '#f4a0c0', '#9a6ad0', '#ff8a3a', '#ffffff'];
      for (let i = 0; i < 9; i++) {
        const x = -X + 0.7, z = -3.4 + i * 0.85, c = fiori[i % fiori.length];
        cil(scena, 0.22, 0.18, 0.4, '#8a9aa0', x, 0.2, z, 12, 0.008);
        for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; cil(scena, 0.012, 0.012, 0.5, '#3f7a3a', x + Math.cos(a) * 0.1, 0.6, z + Math.sin(a) * 0.1, 4, 0); palla(scena, 0.07, c, x + Math.cos(a) * 0.12, 0.88, z + Math.sin(a) * 0.12); }
      }
      ostBox(-X + 0.7, 0, 0.6, 8);
      scaffale(X - 0.35, -0.5, 4.0, -PI / 2, '#8a6a4a', (g, y, i) => { for (let k = 0; k < 6; k++) { cil(g, 0.12, 0.09, 0.2, '#c0603a', -1.6 + k * 0.64, y + 0.1, 0.02, 10, 0); palla(g, 0.14, i % 2 ? '#4f8a3a' : '#6aa04a', -1.6 + k * 0.64, y + 0.3, 0.02); } });
      // piante grandi e annaffiatoio
      [[-4.2, 3.2], [4.2, 3.2]].forEach(p => { const m = B.creaMobile ? B.creaMobile('pianta') : null; if (m) { m.position.set(p[0], 0, p[1]); scena.add(m); } ostacoli.push({ t: 'c', x: p[0], z: p[1], r: 0.45 }); });
      cil(scena, 0.16, 0.18, 0.3, '#4a8ab0', 1.2, 1.15, Z0 + 0.6, 12, 0.008);
      info(-X + 0.7, 0.6, 0, 0.8, 1.2, 8, 'I fiori freschi arrivano ogni mattina; i mazzi li compone il fioraio in turno (9-18)');
    } else if (t === 'alimentari') {
      banconeDietro('#7a6a3a');
      // forme di formaggio e prosciutti appesi, cassette di frutta
      for (let i = 0; i < 4; i++) { const f = cil(scena, 0.3, 0.3, 0.2, '#f0d070', -2.5 + i * 0.8, 1.1, Z0 + 0.6, 16, 0.008); void f; }
      for (let i = 0; i < 4; i++) { const p = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), M('#b0503a')); p.scale.set(0.8, 1.6, 0.8); p.position.set(1.0 + i * 0.6, 2.4, Z0 + 0.6); scena.add(p); cil(scena, 0.01, 0.01, 0.4, '#3a3a3a', 1.0 + i * 0.6, 2.95, Z0 + 0.6, 4, 0); }
      scaffale(-X + 0.35, 0, 4.0, PI / 2, legno, (g, y, i) => { for (let k = 0; k < 6; k++) scatola(g, 0.3, 0.36, 0.25, ['#e05a3a', '#f4d03f', '#3f7a3a', '#2a4a7a'][(k + i) % 4], -1.6 + k * 0.64, y + 0.2, 0.02, 0.006); });
      scaffale(X - 0.35, 0, 4.0, -PI / 2, legno, (g, y, i) => { for (let k = 0; k < 7; k++) cil(g, 0.08, 0.08, 0.3, ['#c8a040', '#3a7a4a', '#7a2a2a'][(k + i) % 3], -1.7 + k * 0.56, y + 0.16, 0.02, 8, 0); });
      [[-2.5, 3.0], [-1.6, 3.0], [1.6, 3.0], [2.5, 3.0]].forEach((p, i) => { scatola(scena, 0.7, 0.35, 0.5, '#b08a5a', p[0], 0.18, p[1], 0.008); for (let k = 0; k < 4; k++) palla(scena, 0.09, ['#e0402a', '#f4a030', '#7ac040', '#f4e040'][i], p[0] - 0.2 + (k % 2) * 0.4, 0.42, p[1] - 0.1 + Math.floor(k / 2) * 0.2); ostBox(p[0], p[1], 0.8, 0.6); });
    } else if (t === 'bottega') {
      banconeDietro('#6a4a2a');
      // banco da lavoro dell'artigiano, vasi, candele e lanterne
      scatola(scena, 2.2, 0.85, 0.9, '#8a6a4a', 3.8, 0.43, -2.6, 0.015); ostBox(3.8, -2.6, 2.3, 1.0);
      cil(scena, 0.35, 0.35, 0.12, '#5a5a60', 3.4, 0.92, -2.6, 16, 0.008); palla(scena, 0.16, '#c07a50', 3.4, 1.08, -2.6);   // tornio con l'argilla
      scaffale(-X + 0.35, 0, 4.0, PI / 2, legno, (g, y, i) => { for (let k = 0; k < 5; k++) cil(g, 0.1, 0.16, 0.34, ['#c07a50', '#a0603a', '#d8b080'][(k + i) % 3], -1.5 + k * 0.75, y + 0.18, 0.02, 12, 0.006); });
      for (let i = 0; i < 5; i++) { const l = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), B.Mluce('#ffb45c', 0.8)); l.position.set(-2 + i * 1.0, 2.6, 0.5); scena.add(l); cil(scena, 0.008, 0.008, 0.6, '#3a3a3a', -2 + i * 1.0, 3.0, 0.5, 4, 0); }
    } else if (t === 'banca') {
      // gli sportelli con il vetro e l'impiegata dietro
      scatola(scena, W - 2, 1.1, 0.7, '#5a4a3a', 0, 0.55, -2.2, 0.02); scatola(scena, W - 1.9, 0.06, 0.8, '#d8d2c4', 0, 1.13, -2.2, 0.01);
      const vt = new T.Mesh(new T.BoxGeometry(W - 2, 1.0, 0.04), new T.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.3 })); vt.position.set(0, 1.7, -2.2); scena.add(vt);
      ostBox(0, -2.2, W - 1.8, 0.9);
      [-2.5, 2.5].forEach((sx, i) => {
        const [cv, x] = B.tela(256, 96); x.fillStyle = '#2f4a6a'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('Sportello ' + (i + 1), 128, 62);
        const c = new T.Mesh(new T.PlaneGeometry(1.1, 0.42), new T.MeshBasicMaterial({ map: B.tex(cv) })); c.position.set(sx, 2.45, -2.17); scena.add(c);
        comparsa(i === 0 ? 'u9' : 'u6', sx, -3.1, 0);
        info(sx, 1.3, -1.6, 1.6, 1.8, 0.8, '', () => { if (B.Banca && B.Banca.apri) B.Banca.apri(); });
      });
      // il caveau e il bancomat
      const cv = new T.Group(); cv.position.set(0, 1.6, Z0 + 0.25); scena.add(cv);
      const porta = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.25, 28), M('#9aa0a8')); porta.rotation.x = PI / 2; cv.add(porta);
      for (let i = 0; i < 6; i++) { const r = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 0.06), M('#5a5a60')); r.rotation.z = i * PI / 6; r.position.z = 0.16; cv.add(r); }
      scatola(scena, 0.8, 1.8, 0.5, '#3a4a5a', X - 0.6, 0.9, 1.8, 0.012); scatola(scena, 0.5, 0.35, 0.05, '#4fc3e8', X - 0.6, 1.4, 1.53, 0); ostBox(X - 0.6, 1.8, 0.9, 0.6);
      info(X - 0.6, 1.0, 1.8, 0.9, 2, 0.8, '', () => { if (B.Banca && B.Banca.apri) B.Banca.apri(); });
      // sala d'attesa
      for (let i = 0; i < 4; i++) sedia(-4.6 + i * 0.8, 3.4, PI, '#2f4a6a');
      [[-X + 0.7, 3.6], [X - 0.7, -3.6]].forEach(p => { const m = B.creaMobile ? B.creaMobile('pianta') : null; if (m) { m.position.set(p[0], 0, p[1]); scena.add(m); } ostacoli.push({ t: 'c', x: p[0], z: p[1], r: 0.45 }); });
    } else if (t === 'arredi') {
      // la sala mostra: un salotto e una camera da letto veri, e la cassa
      const mobili = [['divano', -3.2, -2.6, 0], ['poltrona', -1.0, -2.4, 0], ['tavolino', -2.2, -0.9, 0], ['tappeto', -2.2, -1.2, 0], ['lampada', -4.8, -3.6, 0], ['libreria', -X + 0.4, 0.6, PI / 2], ['letto', 3.6, -2.4, 0], ['scrivania', 4.6, 0.6, -PI / 2], ['tv', 0.8, -4.3, 0], ['acquario', -4.4, 2.8, PI / 2], ['vaso', 1.6, 2.8, 0]];
      mobili.forEach(([id, x, z, r]) => { if (!B.creaMobile) return; const m = B.creaMobile(id); m.position.set(x, 0, z); m.rotation.y = r; scena.add(m); const a = (B.ARREDI || []).find(q => q.id === id); if (a && id !== 'tappeto') { const c = Math.abs(Math.cos(r)) > 0.5; ostBox(x, z, (c ? a.w : a.d) * 0.9, (c ? a.d : a.w) * 0.9); } });
      scatola(scena, 2.0, 0.95, 0.7, '#b0703c', 3.4, 0.475, 3.0, 0.015); scatola(scena, 2.1, 0.06, 0.8, '#e9d3a8', 3.4, 0.98, 3.0, 0.01); ostBox(3.4, 3.0, 2.1, 0.8);
      const lab = B.etichetta('🛋️ Cassa: compra i mobili', { sfondo: '#fbf3dc', colore: '#3a2216', altezza: 0.34 }); lab.position.set(3.4, 1.6, 3.0); scena.add(lab);
      info(3.4, 0.8, 3.0, 2.2, 1.6, 1.2, '', () => { if (B.NegozioArredi) B.NegozioArredi.apri(); });
      siedi(-3.2, -2.5, 0, 0.5);
    } else if (t === 'ambulatorio') {
      // accettazione, sala d'attesa, studio della dottoressa con il lettino
      scatola(scena, 3.2, 1.05, 0.7, '#e8eef0', -2.8, 0.53, -0.8, 0.015); scatola(scena, 3.3, 0.06, 0.8, '#3f8a9a', -2.8, 1.08, -0.8, 0.01); ostBox(-2.8, -0.8, 3.3, 0.8);
      const lab = B.etichetta('Accettazione', { sfondo: '#3f8a9a', colore: '#ffffff', altezza: 0.3 }); lab.position.set(-2.8, 1.7, -0.8); scena.add(lab);
      // tramezzo dello studio con la porta
      scatola(scena, 0.12, 2.4, 3.2, '#dfe8ea', 1.6, 1.2, Z0 + 1.6, 0.015); ostBox(1.6, Z0 + 1.6, 0.2, 3.2);
      scatola(scena, 3.0, 0.12 + 0, 0.5, '#f4f8fa', 3.6, 0.75, Z0 + 0.8, 0.01); cil(scena, 0.05, 0.05, 0.7, acciaio, 2.4, 0.37, Z0 + 0.8, 8, 0); cil(scena, 0.05, 0.05, 0.7, acciaio, 4.8, 0.37, Z0 + 0.8, 8, 0);   // lettino
      scatola(scena, 0.6, 0.1, 0.45, '#ffffff', 4.8, 0.86, Z0 + 0.8, 0.006); ostBox(3.6, Z0 + 0.8, 3.1, 0.7);
      scatola(scena, 1.4, 0.75, 0.7, '#e8eef0', 4.6, 0.38, -0.8, 0.012); ostBox(4.6, -0.8, 1.5, 0.8);   // scrivania della dottoressa
      scatola(scena, 0.9, 2.0, 0.4, '#f4f8fa', X - 0.3, 1.0, Z0 + 2.6, 0.012); ostBox(X - 0.3, Z0 + 2.6, 0.5, 1.0);   // armadietto dei farmaci
      const croce = new T.Group(); croce.position.set(X - 0.08, 1.4, Z0 + 2.6); croce.rotation.y = -PI / 2; scena.add(croce);
      scatola(croce, 0.5, 0.15, 0.02, '#2fa04a', 0, 0, 0, 0); scatola(croce, 0.15, 0.5, 0.02, '#2fa04a', 0, 0, 0, 0);
      comparsa(null, 4.6, -1.6, 0, { corpo: 1, pelle: 1, stile: 3, capelli: 5, occhi: 2, giacca: 1, dettagli: 0, abito: 0, pantaloni: 0, stivali: 0, accessorio: 0 });   // la Dottoressa Ferri
      for (let i = 0; i < 5; i++) sedia(-4.8 + i * 0.8, 3.4, PI, '#3f8a9a');
      info(4.2, 1.0, -1.2, 2.2, 2, 1.6, 'La Dottoressa Ferri riceve dal lunedì al sabato, 8-13 e 15-19. Visita 20 Starlight: chi sta male guarisce prima.');
      info(-2.8, 1.0, -0.8, 3.3, 1.6, 1.0, 'Accettazione: se c\'è il segretario in turno la visita dura 15 minuti invece di 45');
    }
    // la bacheca del lavoro: chi cerca personale in questo posto (src/borgo/lavoro.js)
    if (['caffetteria', 'forno', 'fioraio', 'ambulatorio'].includes(def.id)) {
      const bx = X - 0.16, bz = 3.2;
      const g = new T.Group(); g.position.set(bx, 1.6, bz); g.rotation.y = bx < 0 ? PI / 2 : -PI / 2; scena.add(g);
      scatola(g, 1.0, 0.8, 0.05, '#a07a4a', 0, 0, 0, 0.01);
      const [cv, x] = B.tela(256, 200); x.fillStyle = '#f4ead6'; x.fillRect(0, 0, 256, 200); x.fillStyle = '#5a3a22'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('CERCHIAMO', 128, 70); x.fillText('PERSONALE', 128, 112); x.font = '22px sans-serif'; x.fillText('tocca qui', 128, 160);
      const fg = new T.Mesh(new T.PlaneGeometry(0.86, 0.66), new T.MeshBasicMaterial({ map: B.tex(cv) })); fg.position.z = 0.03; g.add(fg);
      info(bx + (bx < 0 ? 0.3 : -0.3), 1.6, bz, 0.6, 1.0, 1.2, '', () => { if (B.Lavoro) B.Lavoro.apri(def.id); });
    }

    /* ---------- luci ---------- */
    const lampa = B.Mluce('#ffd9a0', 0.9);
    [[-X / 2, -D / 4], [X / 2, -D / 4], [-X / 2, D / 4], [X / 2, D / 4]].forEach(p => {
      const bu = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), lampa); bu.position.set(p[0], 3.2, p[1]); scena.add(bu);
      lampade.push({ x: p[0], y: 2.8, z: p[1] });
    });

    /* ---------- pareti che spariscono quando la camera e' dietro di loro ---------- */
    muri.forEach(m => {
      m.g.traverse(c => {
        if (!c.isMesh) return;
        const mm = c.material;
        if (mm.isShaderMaterial || (mm.isMeshBasicMaterial && mm.side === T.BackSide)) { m.lines.push(c); return; }
        const nuovo = mm.clone(), j = vetri.indexOf(mm); if (j >= 0) vetri[j] = nuovo;
        c.material = nuovo; m.mats.push(nuovo);
      });
    });
    function aggiornaMuri(az, dt) {
      const cx = Math.sin(az), cz = Math.cos(az);
      muri.forEach(m => {
        const fuori = m.out[0] * cx + m.out[1] * cz > 0.2, target = fuori ? 0.0 : 1;
        m.q += (target - m.q) * Math.min(1, dt * 9);
        const q = Math.abs(m.q - target) < 0.02 ? target : m.q;
        if (q === m.ap) return; m.ap = q;
        m.mats.forEach(mm => { const tr = q < 0.99; if (mm.transparent !== tr) { mm.transparent = tr; mm.needsUpdate = true; } mm.opacity = q; mm.depthWrite = !tr; });
        m.g.visible = q > 0.02;
        m.lines.forEach(l => { l.visible = q >= 0.99; });
      });
    }
    const COLORI = { giorno: ['#bfe3f2', 0.6], tramonto: ['#ffb878', 0.55], notte: ['#2c3a78', 0.5] };
    function atm(nome) {
      const c = COLORI[nome] || COLORI.giorno;
      vetri.forEach(v => { v.color.set(c[0]); v.emissive.set(nome === 'notte' ? '#3a4a9a' : c[0]); v.emissiveIntensity = c[1]; });
    }
    const area = (x, z) => x > AREA.x0 && x < AREA.x1 && z > AREA.z0 && z < AREA.z1;
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA, w: W, d: D, rect: { x0: -X, x1: X, z0: Z0, z1: Z1 + 0.5 } };
  }

  B.costruisciInterno = costruisciInterno;
})();
