/* =====================================================================
   THE BORG - LA TORRE DELLA COMETA (al posto della Torre dell'Orologio)
   Fuori: torre di pietra di quattro piani, con l'orologio sotto la terrazza,
   merli, bandiera e il telescopio in cima.
   Dentro: un piano per stanza (torre0 = ingresso, torre1..torre3 = piani per
   ora vuoti, dove apriranno nuovi negozi). Si sale con la scala a chiocciola
   (angolo nord-est) e si scende dalla scala nell'angolo nord-ovest.
   Il tetto ("tetto") e' una stanza della piazza stessa: si e' davvero in cima
   alla torre, si vede il borgo e gli amici in piazza vedono chi c'e' lassu'.
   Il telescopio (B3.Telescopio) apre una visuale da trascinare, con lo zoom,
   per guardare il borgo di sotto e il cosmo; dice cosa si sta guardando.
   Usato da piazza.js (B3.costruisciTorreEsterna) e programma-principale.js
   (B3.costruisciPianoTorre, B3.TettoTorre).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;

  // dove sta e quanto e' grande (in piazza)
  const TORRE = { x: -49.9, z: 26, w: 7, piano: 3.8, piani: 4 };
  TORRE.hCorpo = TORRE.piano * TORRE.piani;          // 15,2 m di muro
  TORRE.lt = TORRE.w + 0.9;                           // lato della terrazza (sporge sui beccatelli)
  TORRE.h = TORRE.hCorpo + 1.25;                      // altezza del pavimento della terrazza
  TORRE.mezzo = TORRE.lt / 2 - 0.62;                  // fin dove si cammina sulla terrazza (dal centro)
  const NOMI = ['Ingresso', 'Primo piano', 'Secondo piano', 'Terzo piano'];
  const NOME = 'Torre della Cometa';
  B.TORRE = TORRE;

  const pietra = '#d9c7b0', pietraScura = '#8f7f86', pietraChiara = '#e8dccb', legno = '#5c3822', coppi = '#b0583f';
  const tela = (w, h, fn) => { const [cv, x] = B.tela(w, h); fn(x, w, h); return B.tex(cv); };
  function scritta(testo, w, h, opz) {
    opz = opz || {};
    return tela(512, Math.round(512 * h / w), (x, W, H) => {
      B.rr(x, 4, 4, W - 8, H - 8, 22); x.fillStyle = opz.fondo || '#2a1a2e'; x.fill(); x.lineWidth = 8; x.strokeStyle = opz.bordo || '#f2c76e'; x.stroke();
      x.fillStyle = opz.colore || '#fbf3dc'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const righe = String(testo).split('\n'), fs = opz.fs || Math.min(70, (H - 30) / righe.length * 0.8);
      x.font = 'bold ' + fs + 'px Georgia, serif';
      righe.forEach((r, i) => x.fillText(r, W / 2, H / 2 + (i - (righe.length - 1) / 2) * fs * 1.2));
    });
  }

  /* =================================================================
     FUORI, IN PIAZZA
     ================================================================= */
  B.costruisciTorreEsterna = function (scene, o) {
    const { anim, lancette, ostacoli, porte, edifici } = o;
    const gm = M('#ffffff').gradientMap;
    const W = TORRE.w, P = TORRE.piano, HC = TORRE.hCorpo, LT = TORRE.lt;
    const g = new T.Group(); g.position.set(TORRE.x, 0, TORRE.z); scene.add(g);
    const box = (w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };

    box(W + 0.9, 0.9, W + 0.9, pietraScura, 0, 0.45, 0, 0.04);                 // zoccolo
    box(W, HC - 0.9, W, pietra, 0, 0.9 + (HC - 0.9) / 2, 0, 0.04);               // corpo
    // cantonali: pietre d'angolo alternate
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => {
      for (let y = 1.1, k = 0; y < HC - 0.4; y += 0.7, k++) {
        const lx = k % 2 ? 0.95 : 0.6, lz = k % 2 ? 0.6 : 0.95;
        box(lx, 0.6, lz, '#c9b59e', c[0] * (W / 2 - lx / 2 + 0.06), y + 0.3, c[1] * (W / 2 - lz / 2 + 0.06), 0.012);
      }
    });
    // marcapiani
    for (let i = 1; i < TORRE.piani; i++) box(W + 0.24, 0.24, W + 0.24, pietraChiara, 0, i * P, 0, 0.015);
    // finestre ad arco su ogni lato, ai piani di sopra (accese la sera)
    const vetro = B.Mluce('#ffc860', 0.9);
    function finestraArco(lato, piano, larga) {
      const f = new T.Group(); f.rotation.y = lato * PI / 2; g.add(f);
      const y = piano * P + 1.7, w = larga ? 1.3 : 0.9, h = 1.4, z = W / 2 + 0.02;
      f.add(mesh(new T.BoxGeometry(w + 0.32, h + 0.2, 0.12), M(pietraChiara), { y, z, lb: 0.012 }));
      f.add(mesh(new T.CylinderGeometry((w + 0.32) / 2, (w + 0.32) / 2, 0.12, 16, 1, false, -PI / 2, PI), M(pietraChiara), { y: y + h / 2 + 0.1, z, l: 0.012 }).rotateX(PI / 2));
      const v = new T.Mesh(new T.PlaneGeometry(w, h), vetro); v.position.set(0, y, z + 0.07); f.add(v);
      const a = new T.Mesh(new T.CircleGeometry(w / 2, 16, 0, PI), vetro); a.position.set(0, y + h / 2, z + 0.07); f.add(a);
      f.add(mesh(new T.BoxGeometry(0.06, h, 0.04), M(legno), { y, z: z + 0.1, cast: false }));
      f.add(mesh(new T.BoxGeometry(w + 0.5, 0.12, 0.3), M(pietraChiara), { y: y - h / 2 - 0.12, z: z + 0.1, lb: 0.01 }));
    }
    for (let p = 1; p < TORRE.piani; p++) [0, 1, 2, 3].forEach(l => finestraArco(l, p, p === TORRE.piani - 1));
    [0, 2, 3].forEach(l => finestraArco(l, 0, false));
    // portone sul lato est (verso la piazza), con insegna e lanterne
    {
      const f = new T.Group(); f.rotation.y = PI / 2; g.add(f);
      const z = W / 2 + 0.02;
      f.add(mesh(new T.BoxGeometry(2.4, 2.9, 0.2), M(pietraChiara), { y: 1.45 + 0.9, z, lb: 0.015 }));
      f.add(mesh(new T.CylinderGeometry(1.2, 1.2, 0.2, 18, 1, false, -PI / 2, PI), M(pietraChiara), { y: 2.9 + 0.9, z, l: 0.012 }).rotateX(PI / 2));
      f.add(mesh(new T.BoxGeometry(1.7, 2.6, 0.14), M('#6b4126'), { y: 1.3 + 0.9, z: z + 0.1, lb: 0.012 }));
      f.add(mesh(new T.CircleGeometry(0.85, 16, 0, PI), M('#6b4126'), { y: 2.6 + 0.9, z: z + 0.17, cast: false }));
      [0.9, 1.9, 2.9].forEach(y => f.add(mesh(new T.BoxGeometry(1.7, 0.08, 0.05), M('#2c2431'), { y: y + 0.2, z: z + 0.19, cast: false })));
      f.add(mesh(new T.SphereGeometry(0.07, 8, 6), M('#c8923a'), { x: 0.55, y: 2.1, z: z + 0.22, cast: false }));
      // gradini
      f.add(mesh(new T.BoxGeometry(2.8, 0.3, 1.2), M(pietraScura), { y: 0.75, z: z + 0.5, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(3.2, 0.3, 1.6), M(pietraScura), { y: 0.45, z: z + 0.7, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(3.6, 0.3, 2.0), M(pietraScura), { y: 0.15, z: z + 0.9, lb: 0.012 }));
      const ins = new T.Mesh(new T.PlaneGeometry(3.0, 0.75), new T.MeshBasicMaterial({ map: scritta('TORRE DELLA COMETA', 3.0, 0.75, { fs: 52 }) })); ins.position.set(0, 4.55, z + 0.06); f.add(ins);
      [-1, 1].forEach(s => B.PM.lanterna(f, s * 1.55, 2.6, z));
    }
    // fascia in cima con i beccatelli e l'orologio
    const yb = HC, hb = 1.25;
    box(LT, hb, LT, pietraChiara, 0, yb + hb / 2, 0, 0.03);
    [0, 1, 2, 3].forEach(l => {
      const f = new T.Group(); f.rotation.y = l * PI / 2; g.add(f);
      for (let k = 0; k < 7; k++) f.add(mesh(new T.BoxGeometry(0.4, 0.6, 0.45), M('#c9b59e'), { x: -W / 2 + 0.5 + k * (W - 1) / 6, y: yb - 0.3, z: W / 2 + 0.22, lb: 0.012 }));
      // orologio: quadrante e lancette (le muove piazza.js con l'ora vera)
      const yq = yb - 1.2;
      f.add(mesh(new T.CylinderGeometry(0.78, 0.78, 0.1, 28), M('#c8923a'), { y: yq, z: W / 2 + 0.03, l: 0.012 }).rotateX(PI / 2));
      const quad = new T.Mesh(new T.CircleGeometry(0.68, 32), new T.MeshBasicMaterial({ map: B.texOrologio() })); quad.position.set(0, yq, W / 2 + 0.09); f.add(quad);
      const mk = (lun, sp) => { const p = new T.Group(); p.position.set(0, yq, W / 2 + 0.11); const b = new T.Mesh(new T.BoxGeometry(sp, lun, 0.02), new T.MeshBasicMaterial({ color: 0x2a1a2e })); b.position.y = lun / 2 - 0.05; p.add(b); f.add(p); return p; };
      lancette.push({ o: mk(0.36, 0.06), m: mk(0.54, 0.04) });
    });
    // terrazza: pavimento, parapetto e merli
    const H = TORRE.h;
    const tPav = B.texSelciato(); tPav.repeat.set(2, 2);
    const pav = new T.Mesh(new T.PlaneGeometry(LT - 0.1, LT - 0.1), new T.MeshToonMaterial({ map: tPav, gradientMap: gm, color: new T.Color('#d8c8b8') })); pav.rotation.x = -PI / 2; pav.position.y = H + 0.005; pav.receiveShadow = true; g.add(pav);
    [0, 1, 2, 3].forEach(l => {
      const f = new T.Group(); f.rotation.y = l * PI / 2; g.add(f);
      f.add(mesh(new T.BoxGeometry(LT, 0.75, 0.4), M(pietra), { y: H + 0.375, z: LT / 2 - 0.2, lb: 0.02 }));
      for (let k = 0; k < 5; k++) f.add(mesh(new T.BoxGeometry(0.75, 0.6, 0.45), M('#cdbfb8'), { x: -LT / 2 + 0.55 + k * (LT - 1.1) / 4, y: H + 0.75 + 0.3, z: LT / 2 - 0.2, lb: 0.015 }));
    });
    // botola con la scala (angolo sud-ovest), ringhiera su due lati
    const bx = -TORRE.mezzo + 1.1, bz = TORRE.mezzo - 1.1;
    { const bo = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), M('#241a2e')); bo.rotation.x = -PI / 2; bo.position.set(bx, H + 0.012, bz); g.add(bo);
      for (let k = 0; k < 4; k++) box(1.3, 0.08, 0.28, '#7a5a3c', bx, H - 0.15 - k * 0.38, bz - 0.55 + k * 0.32, 0.006);
      box(1.6, 0.06, 0.06, '#5c3822', bx, H + 0.95, bz - 0.8, 0.008);
      [[-0.8, -0.8], [0.8, -0.8]].forEach(c => box(0.08, 0.95, 0.08, '#5c3822', bx + c[0], H + 0.48, bz + c[1], 0.008)); }
    // pennone con lo stendardo del borgo (angolo nord-ovest)
    const px = -TORRE.mezzo + 0.5, pz = -TORRE.mezzo + 0.5;
    g.add(mesh(new T.CylinderGeometry(0.06, 0.08, 4.2, 8), M('#5c3822'), { x: px, y: H + 2.1, z: pz, l: 0.01 }));
    g.add(mesh(new T.SphereGeometry(0.13, 8, 6), M('#c8923a'), { x: px, y: H + 4.25, z: pz, l: 0.01 }));
    const band = new T.Mesh(new T.PlaneGeometry(1.8, 1.1, 8, 1), new T.MeshToonMaterial({ map: tela(128, 80, (x, w, h) => { x.fillStyle = '#2f2342'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c76e'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8); x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = -PI / 2 + i * PI / 5; x.lineTo(64 + Math.cos(a) * r, 40 + Math.sin(a) * r); } x.closePath(); x.fill(); }), gradientMap: gm, side: T.DoubleSide }));
    band.position.set(px + 0.95, H + 3.55, pz); band.userData.vivo = true; g.add(band);
    const bp = band.geometry.attributes.position, bx0 = Float32Array.from(bp.array);
    anim.push(t => { for (let i = 0; i < bp.count; i++) { const x = bx0[i * 3]; bp.setZ(i, Math.sin(t * 3 + x * 2.2) * 0.12 * (x + 0.9)); } bp.needsUpdate = true; });
    // lanterne agli angoli della terrazza
    const lu = B.Mluce('#ffd28a', 1.0);
    [[1, 1], [1, -1], [-1, 1]].forEach(c => { const lx = c[0] * (LT / 2 - 0.2), lz = c[1] * (LT / 2 - 0.2); g.add(mesh(new T.CylinderGeometry(0.04, 0.04, 0.6, 6), M('#2c2431'), { x: lx, y: H + 1.5, z: lz, cast: false })); const lb = new T.Mesh(new T.BoxGeometry(0.24, 0.32, 0.24), lu); lb.position.set(lx, H + 1.95, lz); g.add(lb); g.add(mesh(new T.ConeGeometry(0.2, 0.18, 4), M('#2c2431'), { x: lx, y: H + 2.2, z: lz, cast: false }).rotateY(PI / 4)); });
    // il telescopio: treppiede e tubo d'ottone (il tubo segue lo sguardo quando lo si usa)
    const tx = 0.9, tz = -0.6;
    const tel = new T.Group(); tel.position.set(tx, H, tz); g.add(tel);
    [0, 1, 2].forEach(i => { const a = i / 3 * PI * 2, gb = mesh(new T.CylinderGeometry(0.035, 0.05, 1.5, 6), M('#5c3822'), { l: 0.008 }); gb.position.set(Math.cos(a) * 0.32, 0.7, Math.sin(a) * 0.32); gb.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); tel.add(gb); });
    const testa = new T.Group(); testa.position.y = 1.45; testa.rotation.order = 'YXZ'; testa.rotation.y = -PI / 2; testa.rotation.x = 0.35; testa.userData.vivo = true; tel.add(testa);
    const tubo = mesh(new T.CylinderGeometry(0.13, 0.17, 1.7, 14), M('#c8923a'), { l: 0.012 }); tubo.rotation.x = PI / 2; tubo.position.z = -0.35; testa.add(tubo);
    testa.add(mesh(new T.CylinderGeometry(0.2, 0.2, 0.14, 14), M('#8a5a25'), { z: -1.2, l: 0.01 }).rotateX(PI / 2));
    testa.add(mesh(new T.CylinderGeometry(0.06, 0.06, 0.3, 8), M('#2c2431'), { z: 0.6, l: 0.008 }).rotateX(PI / 2));
    testa.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.6, 6), M('#8a5a25'), { y: 0.18, z: -0.2, l: 0.006 }).rotateX(PI / 2));
    B.Telescopio.testa = testa;
    // un'aura che invita a usarlo
    const aura = new T.Mesh(new T.RingGeometry(0.7, 0.95, 28), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.4, depthWrite: false })); aura.rotation.x = -PI / 2; aura.position.set(tx, H + 0.02, tz); aura.userData.vivo = true; g.add(aura);
    anim.push(t => { aura.material.opacity = 0.25 + Math.sin(t * 2.5) * 0.15; });
    // edera
    for (let i = 0; i < 16; i++) { const b = mesh(new T.IcosahedronGeometry(0.28 + (i % 3) * 0.06, 0), M(['#4f8a3a', '#5fa045', '#3f7a35'][i % 3]), { l: 0, cast: false }); b.position.set(-W / 2 - 0.05, 0.6 + i * 0.42, 1.2 + Math.sin(i) * 0.9); b.scale.x = 0.5; g.add(b); }

    const lb = W + 0.9;
    ostacoli.push({ t: 'b', x0: TORRE.x - lb / 2, x1: TORRE.x + lb / 2, z0: TORRE.z - lb / 2, z1: TORRE.z + lb / 2 });
    porte.push({ id: 'porta-torre', nome: NOME, testo: 'Entra nella Torre', x: TORRE.x + lb / 2 + 1.0, z: TORRE.z, r: 1.3, verso: 'torre0', arrivo: { x: 0, z: 3.6, yaw: PI } });
    edifici.push({ g, x: TORRE.x, z: TORRE.z, w: lb, d: lb, nome: NOME });
    return g;
  };

  /* ---------- il tetto: una stanza della piazza ---------- */
  const xT = v => TORRE.x + v, zT = v => TORRE.z + v;
  B.TettoTorre = {
    nome: 'In cima alla Torre',
    alt: () => TORRE.h,
    area: (x, z) => Math.abs(x - TORRE.x) < TORRE.mezzo && Math.abs(z - TORRE.z) < TORRE.mezzo,
    spawn: { x: xT(-TORRE.mezzo + 1.1 + 1.3), z: zT(TORRE.mezzo - 1.1), yaw: PI / 2 },
    ostacoli: [
      { t: 'c', x: xT(0.9), z: zT(-0.6), r: 0.5 },                                                      // telescopio
      { t: 'c', x: xT(-TORRE.mezzo + 0.5), z: zT(-TORRE.mezzo + 0.5), r: 0.25 },                        // pennone
      { t: 'b', x0: xT(-TORRE.mezzo + 1.1 - 0.85), x1: xT(-TORRE.mezzo + 1.1 + 0.85), z0: zT(TORRE.mezzo - 1.1 - 0.85), z1: zT(TORRE.mezzo - 1.1 - 0.72) }   // ringhiera della botola (si scende da est)
    ],
    porte: [
      { id: 'botola', nome: 'Scendi nella Torre', testo: 'Scendi', x: xT(-TORRE.mezzo + 1.1), z: zT(TORRE.mezzo - 1.1), r: 0.95, verso: 'torre3', arrivo: { x: 0.8, z: -0.6, yaw: PI * 0.75 } },
      { id: 'telescopio', nome: 'Telescopio', testo: 'Guarda nel telescopio', x: xT(0.9), z: zT(-0.6), r: 1.35, fn: () => B.Telescopio.apri() }
    ]
  };

  /* =================================================================
     DENTRO: un piano della torre (n = 0 ingresso, 1..3 piani vuoti)
     ================================================================= */
  const X = 5.6, Z0 = -5.6, Z1 = 5.6;
  const AREA = { x0: -X + 0.7, x1: X - 0.7, z0: Z0 + 0.8, z1: Z1 - 0.6 };
  const SALI = { x: 3.4, z: -3.4 }, SCENDI = { x: -3.4, z: -3.4 };   // scala a chiocciola (su) e scala che scende
  B.costruisciPianoTorre = function (scena, n) {
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const muroCol = ['#cdbba6', '#c9b7a4', '#c4b3a2', '#bfae9f'][n];

    /* ---------- base sospesa e pavimento ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.6, 1.0, Z1 - Z0 + 0.6), M('#7a6c78'), { y: -0.51, z: (Z0 + Z1) / 2, lb: 0.05 }));
    for (let i = 0; i < 7; i++) { const c = mesh(new T.ConeGeometry(0.9 + (i % 3) * 0.4, 1.8 + (i % 4) * 0.5, 7), M('#5f5463'), { x: -4.5 + i * 1.5, y: -1.9 - (i % 2) * 0.4, z: -3 + (i * 37 % 7), cast: false }); c.rotation.x = PI; scena.add(c); }
    const cri = new T.Mesh(new T.OctahedronGeometry(0.5, 0), new T.MeshBasicMaterial({ color: '#7fe3ff' })); cri.scale.y = 2; cri.position.set(2, -3, 2); cri.rotation.x = PI; scena.add(cri);
    const tPar = B.texParquet(); tPar.repeat.set(2 * X / 4, (Z1 - Z0) / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPar, gradientMap: gm, color: new T.Color(n === 0 ? '#c9b8a8' : '#d8c0a0') })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, (Z0 + Z1) / 2); pav.receiveShadow = true; scena.add(pav);

    /* ---------- pareti (nord, ovest, est), con finestre ad arco ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h) {
      scatola(g, w + 0.36, h + 0.2, 0.12, pietraChiara, x, y, 0.03);
      const sem = mesh(new T.CylinderGeometry(w / 2 + 0.18, w / 2 + 0.18, 0.12, 16, 1, false, -PI / 2, PI), M(pietraChiara), { x, y: y + h / 2 + 0.1, z: 0.03, l: 0.01 }); sem.rotation.x = PI / 2; g.add(sem);
      const mv = matVetro(), v = new T.Mesh(new T.PlaneGeometry(w, h), mv); v.position.set(x, y, 0.1); g.add(v);
      const a = new T.Mesh(new T.CircleGeometry(w / 2, 16, 0, PI), mv); a.position.set(x, y + h / 2, 0.1); g.add(a);
      scatola(g, 0.07, h + w / 2, 0.05, legno, x, y + w / 4, 0.13, 0);
      scatola(g, w + 0.6, 0.12, 0.36, pietraChiara, x, y - h / 2 - 0.16, 0.16, 0.012);
    }
    function parete(len, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 4, 0.5), M(muroCol), { y: 2, z: -0.25, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.35, 0.1, '#8f7f86', 0, 0.17, 0.05, 0.012);
      scatola(g, len, 0.22, 0.4, '#6b4326', 0, 3.85, 0.15, 0.012);          // trave in alto
      for (let k = -2; k <= 2; k++) scatola(g, 0.3, 3.5, 0.14, '#7a5a3c', k * len / 5, 1.95, 0.08, 0.01);   // travi verticali
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
      return g;
    }
    parete(2 * X + 0.7, 0, Z0, 0, [0, -1], g => {
      finestra(g, 0, 2.2, 1.2, 1.4);
      // stendardo con il nome del piano
      const ins = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), new T.MeshBasicMaterial({ map: scritta(n ? n + '° PIANO' : 'TORRE DELLA COMETA', 2.4, 0.6, { fs: n ? 60 : 44 }) })); ins.position.set(0, 3.45, 0.14); g.add(ins);
    });
    parete(Z1 - Z0 + 0.4, -X, (Z0 + Z1) / 2, PI / 2, [-1, 0], g => { finestra(g, -1.2, 2.2, 1.0, 1.3); finestra(g, 2.2, 2.2, 1.0, 1.3); });
    parete(Z1 - Z0 + 0.4, X, (Z0 + Z1) / 2, -PI / 2, [1, 0], g => { finestra(g, 1.2, 2.2, 1.0, 1.3); finestra(g, -2.2, 2.2, 1.0, 1.3); });
    // pilastri d'angolo davanti (lato sud aperto verso la camera)
    [-1, 1].forEach(s => { scatola(scena, 0.6, 4, 0.6, muroCol, s * (X + 0.05), 2, Z1 - 0.1, 0.03); });

    /* ---------- scala a chiocciola che sale (nord-est) ---------- */
    {
      const g = new T.Group(); g.position.set(SALI.x, 0, SALI.z); scena.add(g);
      cil(g, 0.18, 0.18, 4.0, '#7a5a3c', 0, 2.0, 0, 10);
      for (let k = 0; k < 11; k++) {
        const a = -k * 0.55 + PI * 0.75, st = scatola(g, 1.15, 0.12, 0.5, k % 2 ? '#a07650' : '#946a46', Math.cos(a) * 0.62, 0.2 + k * 0.34, Math.sin(a) * 0.62, 0.008);
        st.rotation.y = -a;
      }
      // ringhiera esterna
      for (let k = 0; k < 11; k += 2) { const a = -k * 0.55 + PI * 0.75; cil(g, 0.025, 0.025, 0.9, '#2c2431', Math.cos(a) * 1.18, 0.65 + k * 0.34, Math.sin(a) * 1.18, 5, 0); }
      ostCer(SALI.x, SALI.z, 1.25);
      const ultima = n === TORRE.piani - 1;
      const cart = new T.Mesh(new T.PlaneGeometry(1.5, 0.45), new T.MeshBasicMaterial({ map: scritta(ultima ? 'TETTO ↑' : 'SALI ↑', 1.5, 0.45, { fs: 70, fondo: '#2f2342' }) }));
      cart.position.set(-1.0, 2.3, 1.2); cart.rotation.y = -PI / 4; g.add(cart);
      porte.push({ id: 'sali', nome: ultima ? 'Sali sul tetto' : 'Sali al ' + NOMI[n + 1].toLowerCase(), testo: ultima ? 'Sali sul tetto' : 'Sali al ' + NOMI[n + 1].toLowerCase(), x: SALI.x - 1.35, z: SALI.z + 1.35, r: 1.0,
        verso: ultima ? 'tetto' : 'torre' + (n + 1), arrivo: ultima ? B.TettoTorre.spawn : { x: SCENDI.x + 1.9, z: SCENDI.z + 1.7, yaw: PI * 0.75 } });
    }
    /* ---------- scala che scende (nord-ovest), con ringhiera ---------- */
    if (n > 0) {
      const g = new T.Group(); g.position.set(SCENDI.x, 0, SCENDI.z); scena.add(g);
      const buco = new T.Mesh(new T.PlaneGeometry(2.0, 2.0), M('#241a2e')); buco.rotation.x = -PI / 2; buco.position.y = 0.006; g.add(buco);
      for (let k = 0; k < 4; k++) scatola(g, 1.6, 0.1, 0.36, '#7a5a3c', 0, -0.18 - k * 0.3, -0.7 + k * 0.42, 0.006);
      scatola(g, 2.1, 0.06, 0.06, '#5c3822', 0, 0.95, -1.0, 0.008); scatola(g, 0.06, 0.06, 2.1, '#5c3822', -1.0, 0.95, 0, 0.008);
      [[-1, -1], [1, -1], [-1, 1]].forEach(c => scatola(g, 0.08, 0.95, 0.08, '#5c3822', c[0], 0.48, c[1], 0.008));
      ostBox(SCENDI.x, SCENDI.z - 1.0, 2.2, 0.2); ostBox(SCENDI.x - 1.0, SCENDI.z, 0.2, 2.2);
      porte.push({ id: 'scendi', nome: 'Scendi al ' + (n === 1 ? 'piano terra' : NOMI[n - 1].toLowerCase()), testo: 'Scendi', x: SCENDI.x + 0.3, z: SCENDI.z + 0.3, r: 1.0,
        verso: 'torre' + (n - 1), arrivo: { x: SALI.x - 2.5, z: SALI.z + 2.5, yaw: PI * 0.75 } });
    }

    /* ---------- arredo: ingresso o spazio libero per un negozio ---------- */
    if (n === 0) {
      // bacheca con i piani della torre
      const tb = scritta('TORRE DELLA COMETA\n1° piano · presto un negozio\n2° piano · presto un negozio\n3° piano · presto un negozio\nTetto · il telescopio', 2.6, 1.9, { fs: 34, fondo: '#3a2a1e', bordo: '#c8923a' });
      const bac = new T.Group(); bac.position.set(-X + 0.35, 0, 1.2); bac.rotation.y = PI / 2; scena.add(bac);
      scatola(bac, 2.8, 2.1, 0.1, '#6b4326', 0, 2.0, 0.0, 0.015);
      const p = new T.Mesh(new T.PlaneGeometry(2.6, 1.9), new T.MeshBasicMaterial({ map: tb })); p.position.set(0, 2.0, 0.06); bac.add(p);
      // panche
      [[-2.2, 2.6], [2.2, 2.6]].forEach(q => { scatola(scena, 1.8, 0.12, 0.5, '#a96f44', q[0], 0.5, q[1], 0.012); [-0.7, 0.7].forEach(dx => scatola(scena, 0.12, 0.45, 0.4, '#6b4326', q[0] + dx, 0.22, q[1], 0.01)); ostBox(q[0], q[1], 1.9, 0.6);
        const st = { x: q[0], z: q[1] + 0.05, y: 0.08, yt: 0, yaw: PI }; st.azione = { sedile: st, nome: 'Siediti', testo: 'Siediti' }; sedili.push(st); });
      const tap = new T.Mesh(new T.PlaneGeometry(3.2, 4.6), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tap.rotation.x = -PI / 2; tap.position.set(0, 0.012, 2.2); scena.add(tap);
      // portone d'uscita (lato sud)
      const g = new T.Group(); g.position.set(0, 0, Z1 + 0.1); scena.add(g);
      [-1, 1].forEach(s => scatola(g, 0.3, 3.2, 0.3, pietraChiara, s * 1.1, 1.6, 0, 0.015)); scatola(g, 2.5, 0.3, 0.3, pietraChiara, 0, 3.2, 0, 0.015);
      const mt = new T.Mesh(new T.PlaneGeometry(1.8, 1.0), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.6); g.add(mt);
      porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 1.1, r: 1.3, verso: 'piazza', arrivo: { x: TORRE.x + (TORRE.w + 0.9) / 2 + 2.6, z: TORRE.z, yaw: PI / 2 } });
    } else {
      // cavalletto: qui aprira' un negozio
      const g = new T.Group(); g.position.set(0, 0, 1.0); scena.add(g);
      [-0.45, 0.45].forEach(s => { const gm2 = scatola(g, 0.07, 1.9, 0.07, '#6b4326', s, 0.95, 0.12, 0.008); gm2.rotation.x = -0.12; });
      const gb = scatola(g, 0.07, 1.8, 0.07, '#6b4326', 0, 0.9, -0.3, 0.008); gb.rotation.x = 0.3;
      const cv = new T.Mesh(new T.PlaneGeometry(1.4, 1.0), new T.MeshBasicMaterial({ map: scritta('Spazio libero\nqui aprirà\nun negozio', 1.4, 1.0, { fs: 58, fondo: '#fbf3dc', colore: '#3a2a1e', bordo: '#a96f44' }) }));
      cv.position.set(0, 1.4, 0.2); cv.rotation.x = -0.12; g.add(cv);
      ostCer(0, 1.0, 0.55);
      // segno di gesso sul pavimento: dove andra' il bancone
      const lin = (x0, z0, x1, z1) => { const l = mesh(new T.BoxGeometry(Math.abs(x1 - x0) + 0.06, 0.01, Math.abs(z1 - z0) + 0.06), new T.MeshBasicMaterial({ color: 0xf2ecdf, transparent: true, opacity: 0.55 }), { x: (x0 + x1) / 2, y: 0.014, z: (z0 + z1) / 2, cast: false, recv: false }); scena.add(l); };
      lin(-2.6, -2.2, 2.0, -2.2); lin(-2.6, -1.2, 2.0, -1.2); lin(-2.6, -2.2, -2.6, -1.2); lin(2.0, -2.2, 2.0, -1.2);
      // casse e botti negli angoli, lasciate dai muratori
      [[X - 1.1, 2.6], [X - 1.1, 3.6], [X - 2.1, 3.4]].forEach((q, i) => { scatola(scena, 0.8, 0.8, 0.8, i % 2 ? '#a07650' : '#946a46', q[0], 0.4 + (i === 1 ? 0 : 0), q[1], 0.015); ostBox(q[0], q[1], 0.9, 0.9); });
      [[-X + 1.0, 3.2], [-X + 1.0, 2.2]].forEach(q => { cil(scena, 0.42, 0.42, 1.0, '#8a5a35', q[0], 0.5, q[1], 12, 0.015); cil(scena, 0.44, 0.44, 0.08, '#2c2431', q[0], 0.25, q[1], 12, 0); cil(scena, 0.44, 0.44, 0.08, '#2c2431', q[0], 0.75, q[1], 12, 0); ostCer(q[0], q[1], 0.5); });
      // ringhiera sul lato sud aperto
      scatola(scena, 2 * X, 0.08, 0.08, '#5c3822', 0, 1.0, Z1 - 0.15, 0.008);
      for (let k = -5; k <= 5; k++) scatola(scena, 0.07, 1.0, 0.07, '#5c3822', k * X / 5.5, 0.5, Z1 - 0.15, 0.006);
    }

    /* ---------- luci a muro ---------- */
    const lampa = B.Mluce('#ffd9a0', 0.9);
    [[-X + 0.4, -1.5], [X - 0.4, -1.5], [-X + 0.4, 2.8], [X - 0.4, 2.8]].forEach(p => {
      const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
      cil(l, 0.08, 0.12, 0.3, '#2c2431', 0, 2.6, 0, 8, 0.008);
      const fi = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), lampa); fi.position.y = 2.85; l.add(fi);
      lampade.push({ x: p[0] * 0.85, y: 2.6, z: p[1] });
    });

    /* ---------- pareti che spariscono quando la camera e' dietro di loro (come in biblioteca) ---------- */
    muri.forEach(m => {
      m.g.traverse(c => {
        if (!c.isMesh) return;
        const mm = c.material;
        if (mm.isShaderMaterial || (mm.isMeshBasicMaterial && mm.side === T.BackSide)) { m.lines.push(c); return; }
        const nuovo = mm.clone(), i = B.finestreMat.indexOf(mm); if (i >= 0) B.finestreMat[i] = nuovo;
        const j = vetri.indexOf(mm); if (j >= 0) vetri[j] = nuovo;
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
    function atm(nome) { const c = COLORI[nome] || COLORI.giorno; vetri.forEach(v => { v.color.set(c[0]); v.emissive.set(nome === 'notte' ? '#3a4a9a' : c[0]); v.emissiveIntensity = c[1]; }); }
    const area = (x, z) => x > AREA.x0 && x < AREA.x1 && z > AREA.z0 && z < AREA.z1;
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA, nome: NOME + ' · ' + (n ? NOMI[n] : 'Ingresso'), spawn: n === 0 ? { x: 0, z: 3.6, yaw: PI } : { x: SCENDI.x + 1.9, z: SCENDI.z + 1.7, yaw: PI * 0.75 } };
  };

  /* =================================================================
     IL TELESCOPIO
     Una visuale in prospettiva dal tetto della torre: si trascina per
     guardare intorno (anche giu' nel borgo e su nel cosmo), si ingrandisce
     con i tasti, la rotellina o con due dita. Dice cosa c'e' al centro.
     ================================================================= */
  const Tel = B.Telescopio = { attivo: false, cam: null, yaw: -PI / 2, pitch: -0.35, fov: 50, testa: null };
  const FOV_MAX = 55, FOV_MIN = 3.5;
  let el = null, etichetta = null, zoomTxt = null, tEt = 0;
  const ray = new T.Raycaster(), centro = new T.Vector2(0, 0), dir = new T.Vector3();
  function ui() {
    if (el) return el;
    el = document.createElement('div'); el.id = 'telescopio';
    el.style.cssText = 'position:absolute;inset:0;z-index:80;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;font:600 14px system-ui,sans-serif;color:#fbf3dc;display:none';
    el.innerHTML =
      '<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 46%, rgba(0,0,0,0) 0, rgba(0,0,0,0) min(42vw,38vh), rgba(20,12,30,.55) calc(min(42vw,38vh) + 2px), rgba(10,6,18,.96) calc(min(42vw,38vh) + 14px))"></div>' +
      '<div style="position:absolute;left:50%;top:46%;width:calc(2 * min(42vw,38vh));height:calc(2 * min(42vw,38vh));transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 0 6px #c8923a, 0 0 0 9px #6b4126;pointer-events:none"></div>' +
      '<div style="position:absolute;left:50%;top:46%;width:44px;height:2px;margin:-1px 0 0 -22px;background:rgba(255,240,200,.6);pointer-events:none"></div>' +
      '<div style="position:absolute;left:50%;top:46%;width:2px;height:44px;margin:-22px 0 0 -1px;background:rgba(255,240,200,.6);pointer-events:none"></div>' +
      '<div style="position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 14px);text-align:center;pointer-events:none;opacity:.85">🔭 Trascina per guardare intorno · giù il borgo, su le stelle</div>' +
      '<div data-et style="position:absolute;left:50%;top:calc(46% + min(42vw,38vh) + 18px);transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(47,35,66,.9);white-space:nowrap;pointer-events:none"></div>' +
      '<div style="position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;justify-content:center;align-items:center;gap:10px">' +
      '<button type="button" data-z="-1" style="width:48px;height:48px;border-radius:50%;background:#2f2342;color:#fbf3dc;font-size:26px;font-weight:800">−</button>' +
      '<span data-zt style="min-width:64px;text-align:center;font-size:16px">1×</span>' +
      '<button type="button" data-z="1" style="width:48px;height:48px;border-radius:50%;background:#2f2342;color:#fbf3dc;font-size:26px;font-weight:800">+</button>' +
      '<button type="button" data-chiudi style="margin-left:14px;padding:12px 20px;border-radius:16px;background:#f2c76e;color:#241a33;font-weight:800">Chiudi</button></div>';
    (document.getElementById('app') || document.body).appendChild(el);
    etichetta = el.querySelector('[data-et]'); zoomTxt = el.querySelector('[data-zt]');
    el.querySelector('[data-chiudi]').addEventListener('click', e => { e.stopPropagation(); Tel.chiudi(); });
    el.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); zoom(+b.dataset.z > 0 ? 0.6 : 1 / 0.6); }));
    // trascinare e pizzicare
    const dita = new Map(); let dist0 = 0, fov0 = 0;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dita.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; if (dita.size === 2) { const [a, b] = [...dita.values()]; dist0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fov0 = Tel.fov; } });
    el.addEventListener('pointermove', e => {
      const p = dita.get(e.pointerId); if (!p) return;
      if (dita.size === 2) { dita.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...dita.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (dist0 > 10) { Tel.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, fov0 * dist0 / d)); } return; }
      const k = Tel.fov / FOV_MAX * 0.0065, dx = e.clientX - p[0], dy = e.clientY - p[1];
      Tel.yaw += dx * k; Tel.pitch = Math.max(-1.35, Math.min(1.4, Tel.pitch + dy * k));
      dita.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const fine = e => { dita.delete(e.pointerId); if (!dita.size) el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', fine); el.addEventListener('pointercancel', fine);
    el.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!Tel.attivo) return;
      const k = Tel.fov / FOV_MAX * 0.12;
      if (e.key === 'Escape') Tel.chiudi(); else if (e.key === 'ArrowLeft') Tel.yaw += k; else if (e.key === 'ArrowRight') Tel.yaw -= k;
      else if (e.key === 'ArrowUp') Tel.pitch = Math.min(1.4, Tel.pitch + k); else if (e.key === 'ArrowDown') Tel.pitch = Math.max(-1.35, Tel.pitch - k);
      else if (e.key === '+' || e.key === '=') zoom(0.75); else if (e.key === '-') zoom(1 / 0.75); else return;
      e.preventDefault();
    });
    return el;
  }
  function zoom(f) { Tel.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, Tel.fov * f)); }
  Tel.apri = function () {
    const app = B.app; if (!app || app.stanza().id !== 'tetto') return;
    ui().style.display = '';
    if (!Tel.cam) Tel.cam = new T.PerspectiveCamera(Tel.fov, 1, 0.1, 700);
    Tel.attivo = true; tEt = 0;
    if (!Tel.ascolta && window.Gioco) { Tel.ascolta = true; window.Gioco.su('stanza', () => Tel.chiudi()); }
    if (window.Gioco) window.Gioco.emetti('telescopio', true);
  };
  Tel.chiudi = function () {
    if (!Tel.attivo) return;
    Tel.attivo = false; if (el) el.style.display = 'none';
    if (Tel.testa) { Tel.testa.rotation.y = -PI / 2; Tel.testa.rotation.x = 0.35; }
    if (window.Gioco) window.Gioco.emetti('telescopio', false);
  };
  // cosa c'e' al centro del telescopio
  function cosaGuardo(app) {
    ray.setFromCamera(centro, Tel.cam); ray.far = 700;
    const og = (B.Cosmo && B.Cosmo.oggetti) || [];
    const hit = ray.intersectObjects(og.map(q => q.obj), true)[0];
    let nomeCosmo = null, dCosmo = Infinity;
    if (hit) { let o = hit.object; while (o && !o.userData.nome) o = o.parent; if (o) { nomeCosmo = o.userData.nome; dCosmo = hit.distance; } }
    const r = ray.ray; dir.copy(r.direction);
    if (dir.y < -0.02) {
      const t = -r.origin.y / dir.y, x = r.origin.x + dir.x * t, z = r.origin.z + dir.z * t, PZ = B.CFG.plaza;
      if (t < dCosmo && x > PZ.x0 - 2 && x < PZ.x1 + 2 && z > PZ.z0 - 2 && z < PZ.z1 + 2) {
        const luoghi = (app.stanze.piazza.edifici || []).filter(e => e.nome && e.nome !== NOME).map(e => ({ nome: e.nome, x: e.x, z: e.z }))
          .concat([{ nome: 'Fontana', x: 0, z: 30 }, { nome: 'Belvedere', x: 0, z: B.BEL ? (B.BEL.z0 + B.BEL.z1) / 2 : 54 }]);
        let best = null, bd = 9;
        luoghi.forEach(q => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q.nome; } });
        return best || 'Piazza del Borgo';
      }
      if (!nomeCosmo) return 'Le rocce e i cristalli sotto il borgo';
    }
    return nomeCosmo || (dir.y > 0.25 ? 'Il cielo stellato' : 'Il cosmo');
  }
  // chiamato da programma-principale a ogni fotogramma quando il telescopio e' aperto: restituisce la camera da usare
  Tel.aggiorna = function (dt, renderer) {
    const cam = Tel.cam, app = B.app;
    const w = renderer.domElement.clientWidth || window.innerWidth, h = renderer.domElement.clientHeight || window.innerHeight;
    cam.aspect = w / h; cam.fov = Tel.fov; cam.updateProjectionMatrix();
    const fx = -Math.sin(Tel.yaw), fz = -Math.cos(Tel.yaw);
    // l'occhio sta oltre il parapetto, nella direzione in cui si guarda: cosi' si vede anche giu'
    cam.position.set(TORRE.x + 0.9 + fx * 4.6, TORRE.h + 2.0, TORRE.z - 0.6 + fz * 4.6);
    cam.rotation.order = 'YXZ'; cam.rotation.set(Tel.pitch, Tel.yaw, 0);
    cam.updateMatrixWorld();
    if (Tel.testa) { Tel.testa.rotation.y = Tel.yaw; Tel.testa.rotation.x = Tel.pitch; }
    zoomTxt.textContent = (FOV_MAX / Tel.fov).toFixed(Tel.fov > 20 ? 1 : 0) + '×';
    tEt -= dt; if (tEt <= 0) { tEt = 0.2; etichetta.textContent = '👁 ' + cosaGuardo(app); }
    return cam;
  };
})();
