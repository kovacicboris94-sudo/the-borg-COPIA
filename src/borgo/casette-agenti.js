/* =====================================================================
   THE BORG 3D - LE CASETTE DEGLI ABITANTI IA (Ada e Teo), interno.
   Ogni abitante IA ha una casetta sua sul lato sud della piazza (fuori, in
   piazza.js, c'e' l'edificio con la porta). Dentro (8 x 7 m) c'e' quello che
   la "vita vera" (agenti/vita/casa.mjs) usa davvero: cucina con il fornello
   a gas e il frigo, tavolo, letto con il piumone, bagno con water, lavandino
   e doccia, termosifone. Le stesse coordinate stanno in agenti/vita/casa.mjs.
   Le pareti davanti alla camera diventano trasparenti, come in Biblioteca.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh;
  const PI = Math.PI;

  // dove stanno in piazza (centro dell'edificio; la porta guarda a nord, verso la fontana)
  const CASETTE = {
    casa_ada: { chi: 'Ada', x: -22, z: 63, muro: '#e6c9a8', muroSopra: '#f2e2c8', tetto: '#7a3a4a', persiane: '#4f8a3a', tendaB: '#c8553d', piumone: '#e07a9a' },
    casa_teo: { chi: 'Teo', x: 22, z: 63, muro: '#c9d6c0', muroSopra: '#e6eedc', tetto: '#2f4a6a', persiane: '#7a3f6a', tendaB: '#3f6a8a', piumone: '#4f8ab8' }
  };
  B.CASETTE_AGENTI = CASETTE;

  const X = 4, Z0 = -3.5, Z1 = 3.5;
  const AREA = { x0: -X + 0.5, x1: X - 0.5, z0: Z0 + 0.6, z1: Z1 - 0.5 };

  function costruisciCasetta(scena, id) {
    const def = CASETTE[id];
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const siedi = (x, z, yaw, y, dorme) => { const st = { x, z, y: y || 0.08, yt: 0, yaw }; if (dorme) { st.dorme = true; st.r = 1.6; } st.azione = { sedile: st, nome: dorme ? 'Vai a dormire' : 'Siediti', testo: dorme ? 'Vai a dormire' : 'Siediti' }; sedili.push(st); };
    const legno = '#a96f44', legnoS = '#6b4326', bianco = '#f4f1ea', acciaio = '#c8ccd2';

    /* ---------- base e pavimento ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.4, 0.9, Z1 - Z0 + 0.4), M('#6f6485'), { y: -0.46, z: 0, lb: 0.05 }));
    const tPar = B.texParquet(); tPar.repeat.set(2 * X / 4, (Z1 - Z0) / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPar, gradientMap: gm, color: new T.Color('#e0c8a8') })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, 0); pav.receiveShadow = true; scena.add(pav);
    // piastrelle del bagno
    const pb = new T.Mesh(new T.PlaneGeometry(2.4, 2.7), new T.MeshToonMaterial({ color: new T.Color('#cfe3e8'), gradientMap: gm })); pb.rotation.x = -PI / 2; pb.position.set(2.8, 0.004, 2.15); scena.add(pb);

    /* ---------- pareti ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h) {
      scatola(g, w + 0.3, h + 0.3, 0.12, bianco, x, y, 0.03);
      const v = new T.Mesh(new T.PlaneGeometry(w, h), matVetro()); v.position.set(x, y, 0.1); g.add(v);
      scatola(g, 0.06, h, 0.05, bianco, x, y, 0.13, 0); scatola(g, w + 0.5, 0.1, 0.3, '#e8dcc8', x, y - h / 2 - 0.18, 0.15, 0.012);
    }
    function parete(len, col, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 3.2, 0.3), M(col), { y: 1.6, z: -0.15, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.25, 0.08, legnoS, 0, 0.12, 0.04, 0.012);
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
    }
    parete(2 * X + 0.6, def.muro, 0, Z0, 0, [0, -1], g => {
      finestra(g, 2.6, 2.1, 1.1, 1.0);
      // il nome sulla parete: "Casa di Ada"
      const [cv, x] = B.tela(512, 128); B.rr(x, 4, 4, 504, 120, 22); x.fillStyle = '#2a1f33'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ffd36a'; x.stroke();
      x.font = 'bold 66px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff4dc'; x.fillText('Casa di ' + def.chi, 256, 66);
      const ins = new T.Mesh(new T.PlaneGeometry(2.0, 0.5), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0.2, 2.75, 0.1); g.add(ins);
    });
    parete(Z1 - Z0 + 0.3, def.muroSopra, -X, 0, PI / 2, [-1, 0], g => { finestra(g, 0.6, 2.0, 1.1, 1.0); });
    parete(Z1 - Z0 + 0.3, def.muroSopra, X, 0, -PI / 2, [1, 0], g => { finestra(g, 1.6, 2.0, 1.0, 1.0); });

    /* ---------- cucina: piano di lavoro, lavello, fornello a gas, frigo ---------- */
    (function () {
      const g = new T.Group(); g.position.set(-2.1, 0, Z0 + 0.4); scena.add(g);
      scatola(g, 3.0, 0.9, 0.6, '#f0e6d6', 0, 0.45, 0, 0.015);                 // mobili bassi
      scatola(g, 3.1, 0.06, 0.66, '#5a5560', 0, 0.93, 0, 0.012);              // piano
      for (let i = 0; i < 4; i++) scatola(g, 0.7, 0.8, 0.02, '#e6dccb', -1.1 + i * 0.73, 0.45, 0.31, 0.008);
      scatola(g, 0.6, 0.05, 0.45, acciaio, -1.0, 0.965, 0, 0.008);            // lavello
      cil(g, 0.025, 0.025, 0.35, acciaio, -1.0, 1.1, -0.2, 8, 0);
      // fornello a 4 fuochi: si accendono (fiammella blu) quando qualcuno cucina
      scatola(g, 0.62, 0.03, 0.55, '#2a2830', 0.6, 0.96, 0, 0.008);
      const fiamme = [];
      [[-0.15, -0.13], [0.15, -0.13], [-0.15, 0.13], [0.15, 0.13]].forEach(p => {
        cil(g, 0.08, 0.08, 0.02, '#1a1a1e', 0.6 + p[0], 0.98, p[1], 14, 0.006);
        const f = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 6, 16), new T.MeshBasicMaterial({ color: 0x4a8cff })); f.rotation.x = PI / 2; f.position.set(0.6 + p[0], 1.0, p[1]); f.visible = false; g.add(f); fiamme.push(f);
      });
      const pentola = cil(g, 0.11, 0.1, 0.14, '#8a8f98', 0.45, 1.06, -0.13, 14, 0.01); void pentola;
      anim.push(t => { const on = !!(B.vitaCasa && B.vitaCasa[id] && B.vitaCasa[id].fornello); fiamme.forEach((f, i) => { f.visible = on && i === 0; f.scale.setScalar(1 + Math.sin(t * 20) * 0.06); }); });
      scatola(g, 3.0, 0.7, 0.35, '#f0e6d6', 0, 2.25, -0.12, 0.015);           // pensili
      ostBox(-2.1, Z0 + 0.4, 3.2, 0.8);
      // frigo
      const fr = new T.Group(); fr.position.set(-0.15, 0, Z0 + 0.45); scena.add(fr);
      scatola(fr, 0.7, 1.85, 0.66, bianco, 0, 0.925, 0, 0.02); scatola(fr, 0.7, 0.02, 0.02, '#bdb6aa', 0, 1.2, 0.34, 0); scatola(fr, 0.04, 0.5, 0.04, acciaio, 0.28, 1.5, 0.35, 0);
      ostBox(-0.15, Z0 + 0.45, 0.8, 0.8);
      const prF = new T.Mesh(new T.BoxGeometry(4, 2, 1.4), new T.MeshBasicMaterial()); prF.position.set(-1.6, 1, Z0 + 0.7); prF.visible = false; scena.add(prF);
      toccabili.push({ obj: prF, tipo: 'azione', testo: 'La cucina di ' + def.chi + ': fornello a gas e frigo a 4 gradi' });
    })();

    /* ---------- tavolo con due sedie ---------- */
    (function () {
      const x = -2.0, z = -0.6, g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      scatola(g, 1.3, 0.08, 0.85, legno, 0, 0.76, 0, 0.014);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => scatola(g, 0.07, 0.72, 0.07, legnoS, p[0] * 0.56, 0.36, p[1] * 0.34, 0.008));
      cil(g, 0.09, 0.07, 0.12, '#e07a5f', 0, 0.86, 0, 10, 0.008);
      ostBox(x, z, 1.4, 0.95);
      [-1, 1].forEach(s => { const sx = x + s * 1.0, sz = z; scatola(scena, 0.42, 0.06, 0.42, legno, sx, 0.46, sz, 0.01); scatola(scena, 0.06, 0.5, 0.42, legno, sx + s * 0.2, 0.72, sz, 0.008); ostacoli.push({ t: 'c', x: sx, z: sz, r: 0.28 }); siedi(sx, sz, s > 0 ? -PI / 2 : PI / 2); });
    })();

    /* ---------- letto con il piumone ---------- */
    (function () {
      const x = 2.6, z = -2.1, g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      scatola(g, 1.6, 0.35, 2.1, legno, 0, 0.18, 0, 0.015);
      scatola(g, 1.5, 0.2, 2.0, bianco, 0, 0.45, 0, 0.012);
      scatola(g, 1.52, 0.12, 1.4, def.piumone, 0, 0.6, 0.3, 0.012);
      [-0.38, 0.38].forEach(s => scatola(g, 0.6, 0.14, 0.38, '#fffaf0', s, 0.62, -0.75, 0.01));
      scatola(g, 1.6, 0.9, 0.08, legnoS, 0, 0.6, -1.06, 0.012);
      scatola(scena, 0.45, 0.5, 0.4, legnoS, x - 1.1, 0.25, z - 0.75, 0.01);   // comodino
      const lp = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), B.Mluce('#ffd9a0', 0.9)); lp.position.set(x - 1.1, 0.65, z - 0.75); scena.add(lp);
      ostBox(x, z, 1.7, 2.2);
      siedi(x, z + 0.2, PI, 0.62, true);
    })();

    /* ---------- bagno: tramezzo, water, lavandino, doccia ---------- */
    (function () {
      const bx0 = 1.6, bz0 = 0.8;
      scatola(scena, 0.12, 2.3, Z1 - bz0, '#e9eef0', bx0, 1.15, (bz0 + Z1) / 2 + 0.4, 0.015);   // tramezzo (con il passaggio verso la stanza)
      ostBox(bx0, (bz0 + Z1) / 2 + 0.4, 0.2, Z1 - bz0 - 0.8);
      scatola(scena, X - bx0 - 1.0, 2.3, 0.12, '#e9eef0', bx0 + (X - bx0 - 1.0) / 2 + 1.0, 1.15, bz0, 0.015);
      ostBox(bx0 + (X - bx0 - 1.0) / 2 + 1.0, bz0, X - bx0 - 1.0, 0.2);
      // water
      cil(scena, 0.2, 0.16, 0.42, bianco, X - 0.45, 0.21, 2.0, 14, 0.012); scatola(scena, 0.4, 0.4, 0.18, bianco, X - 0.25, 0.6, 2.0, 0.01);
      ostacoli.push({ t: 'c', x: X - 0.4, z: 2.0, r: 0.3 });
      // lavandino con specchio
      scatola(scena, 0.5, 0.12, 0.4, bianco, X - 0.3, 0.85, 1.2, 0.01); cil(scena, 0.05, 0.07, 0.8, bianco, X - 0.3, 0.4, 1.2, 8, 0.008);
      const sp = new T.Mesh(new T.PlaneGeometry(0.5, 0.6), matVetro()); sp.position.set(X - 0.16, 1.55, 1.2); sp.rotation.y = -PI / 2; scena.add(sp);
      // doccia con il vetro
      scatola(scena, 0.9, 0.06, 0.9, '#f4f8fa', 2.15, 0.03, Z1 - 0.55, 0.008);
      const vt = new T.Mesh(new T.BoxGeometry(0.04, 1.9, 0.9), new T.MeshBasicMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.35 })); vt.position.set(2.6, 0.98, Z1 - 0.55); scena.add(vt);
      cil(scena, 0.12, 0.12, 0.03, acciaio, 2.15, 2.0, Z1 - 0.3, 12, 0);
      ostBox(2.15, Z1 - 0.55, 1.0, 1.0);
      const prB = new T.Mesh(new T.BoxGeometry(2.4, 2, 2.6), new T.MeshBasicMaterial()); prB.position.set(2.8, 1, 2.15); prB.visible = false; scena.add(prB);
      toccabili.push({ obj: prB, tipo: 'azione', testo: 'Il bagno: doccia calda con la caldaia a gas' });
    })();

    /* ---------- angolo con poltrona e termosifone ---------- */
    scatola(scena, 0.9, 0.45, 0.85, '#7a5a9a', -3.1, 0.23, 2.3, 0.015); scatola(scena, 0.9, 0.6, 0.18, '#6a4a8a', -3.1, 0.7, 2.75, 0.012);
    ostBox(-3.1, 2.4, 1.0, 1.0); siedi(-3.1, 2.25, PI);
    for (let i = 0; i < 8; i++) scatola(scena, 0.08, 0.6, 0.1, bianco, -X + 0.12, 0.6, -0.9 + i * 0.12, 0.006);   // termosifone sotto la finestra
    const tap = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tap.rotation.x = -PI / 2; tap.position.set(-0.8, 0.012, 1.4); scena.add(tap);

    /* ---------- luci e uscita ---------- */
    const lampa = B.Mluce('#ffd9a0', 0.9);
    [[-1.8, -1.2], [1.2, -1.2], [2.8, 2.2], [-1.6, 2.0]].forEach(p => {
      const bu = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), lampa); bu.position.set(p[0], 3.0, p[1]); scena.add(bu);
      lampade.push({ x: p[0], y: 2.6, z: p[1] });
    });
    const usc = new T.Group(); usc.position.set(0, 0, Z1 + 0.3); scena.add(usc);
    [-1, 1].forEach(s => scatola(usc, 0.16, 2.6, 0.2, legnoS, s * 0.75, 1.3, 0, 0.015)); scatola(usc, 1.66, 0.18, 0.2, legnoS, 0, 2.6, 0, 0.015);
    const mt = new T.Mesh(new T.PlaneGeometry(1.4, 0.8), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, Z1 - 0.6); scena.add(mt);
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 0.9, r: 1.1, verso: 'piazza', arrivo: { x: def.x, z: def.z - 4.4, yaw: 0 } });

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
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA };
  }

  B.costruisciCasetta = costruisciCasetta;
})();
