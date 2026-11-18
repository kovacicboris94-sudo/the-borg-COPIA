/* =====================================================================
   THE BORG - MURA E CAMPAGNA: il borgo non vola piu'.
   Al posto del muretto dell'isola ci sono le mura (torri agli angoli e a meta'
   dei lati, merli, edera) con la Porta del Borgo a sud. Fuori dalle mura c'e'
   la campagna: strade di terra, campi coltivati (grano, lavanda, orti,
   girasoli), vigneti, frutteti, cipressi, boschi, la cascina e il mulino a
   vento, e le colline all'orizzonte.
   Dalla porta si esce a piedi: la piazza ora arriva fino alle siepi di confine
   (LIM). La disposizione e' fissa (numeri casuali con seme), cosi' tutti i
   giocatori vedono la stessa campagna.
   Lo chiama piazza.js (B3.costruisciMuraCampagna); la minimappa la disegna con
   B3.Campagna.mappa.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, CFG = B.CFG, PI = Math.PI;
  const PZ = CFG.plaza;
  // fin dove si puo' camminare (dentro: le siepi di confine)
  const LIM = { x0: -118, x1: 118, z0: -56, z1: 176 };
  // linee centrali delle mura (appena fuori dal selciato) e porta a sud
  const MURA = { s: PZ.z1 + 0.6, n: PZ.z0 - 0.6, e: PZ.x1 + 0.6, o: PZ.x0 - 0.6, sp: 1.4, h: 3.4 };
  const PORTA = { x: 0, mezza: 2.5, torri: 8.8 };   // apertura larga 5 m, torri della porta fino a 8,8 m dal centro

  let seme = 20261118;
  const rnd = (a, b) => { seme = (seme * 16807) % 2147483647; return a + (seme / 2147483647) * (b - a); };

  // per la minimappa
  const MAPPA = { campi: [], strade: [], vigne: [], edifici: [] };

  B.costruisciMuraCampagna = function (o) {
    const { scene, ostacoli, anim, fadeVoci, edifici } = o;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const gm = M('#ffffff').gradientMap;
    const pietra = '#b9a89f', pietraScura = '#8f7f86', pietraChiara = '#cdbfb8', merlo = '#c4b4ad', coppi = '#b0583f', legno = '#5c3822';
    const cortecce = M('#6a4a34');

    /* =================================================================
       LE MURA
       ================================================================= */
    // un tratto di muro (diviso in pezzi da ~9 m: diventano trasparenti solo quelli davanti alla camera)
    function muro(x0, z0, x1, z1) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 9)), a = Math.atan2(x1 - x0, z1 - z0);
      // verso l'esterno del borgo (per l'edera e le pietre sporgenti)
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, cxB = (PZ.x0 + PZ.x1) / 2, czB = (PZ.z0 + PZ.z1) / 2;
      const ox = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : Math.sign(mx - cxB), oz = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? Math.sign(mz - czB) : 0;
      for (let i = 0; i < n; i++) {
        const ax = x0 + (x1 - x0) * i / n, az = z0 + (z1 - z0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n, bz = z0 + (z1 - z0) * (i + 1) / n;
        const l = L / n, cx = (ax + bx) / 2, cz = (az + bz) / 2;
        const g = new T.Group(); g.position.set(cx, 0, cz); g.rotation.y = a; scene.add(g);
        g.add(mesh(new T.BoxGeometry(MURA.sp + 0.3, 0.7, l), M(pietraScura), { y: 0.35, lb: 0.03 }));                 // zoccolo
        g.add(mesh(new T.BoxGeometry(MURA.sp, MURA.h - 0.7, l), M(pietra), { y: 0.7 + (MURA.h - 0.7) / 2, lb: 0.03 }));
        g.add(mesh(new T.BoxGeometry(MURA.sp + 0.25, 0.22, l + 0.02), M(pietraChiara), { y: MURA.h + 0.11, lb: 0.02 }));   // cornice
        // merli
        const nm = Math.max(2, Math.round(l / 1.35));
        for (let k = 0; k < nm; k++) g.add(mesh(new T.BoxGeometry(MURA.sp * 0.8, 0.62, 0.62), M(merlo), { y: MURA.h + 0.22 + 0.31, z: -l / 2 + (k + 0.5) * l / nm, lb: 0.02 }));
        // pietre sporgenti ed edera, sul lato esterno
        const lato = (ox || oz) ? ((Math.cos(a) * ox - Math.sin(a) * oz) >= 0 ? 1 : -1) : 1;
        for (let k = 0; k < 3; k++) g.add(mesh(new T.BoxGeometry(0.12, rnd(0.35, 0.6), rnd(0.6, 1.2)), M(rnd(0, 1) > 0.5 ? '#a8978f' : '#c2b2a8'), { x: lato * (MURA.sp / 2 + 0.04), y: rnd(1.0, MURA.h - 0.4), z: rnd(-l / 2 + 0.8, l / 2 - 0.8), cast: false }));
        if (rnd(0, 1) > 0.45) {
          const ez = rnd(-l / 2 + 1.2, l / 2 - 1.2), eh = rnd(1.4, MURA.h - 0.2);
          for (let k = 0; k < 6; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(0.35, 0.6), 0), M(k % 2 ? '#4f8a3f' : '#5f9c48'), { x: lato * (MURA.sp / 2 + 0.1), y: rnd(0.4, eh), z: ez + rnd(-0.9, 0.9), cast: false, l: 0.015 }); b.scale.x = 0.45; g.add(b); }
        }
        fadeVoci.push({ g, x: cx, z: cz, w: Math.abs(bx - ax) + MURA.sp, d: Math.abs(bz - az) + MURA.sp, tipo: 'edificio' });
        ostBox(cx, cz, Math.abs(bx - ax) + MURA.sp, Math.abs(bz - az) + MURA.sp);
      }
    }
    // torre delle mura: pianta quadrata, merli, feritoie e tetto di coppi
    function torre(x, z, lato, alta, tetto) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.BoxGeometry(lato + 0.5, 0.9, lato + 0.5), M(pietraScura), { y: 0.45, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(lato, alta - 0.9, lato), M(pietra), { y: 0.9 + (alta - 0.9) / 2, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(lato + 0.45, 0.3, lato + 0.45), M(pietraChiara), { y: alta + 0.15, lb: 0.02 }));
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(d => {
        // feritoie
        [alta * 0.45, alta * 0.75].forEach(y => { const f = new T.Mesh(new T.PlaneGeometry(0.22, 0.9), M('#2a1f2c')); f.position.set(d[0] * (lato / 2 + 0.02), y, d[1] * (lato / 2 + 0.02)); f.rotation.y = Math.atan2(d[0], d[1]); f.castShadow = false; g.add(f); });
        if (!tetto) for (let k = 0; k < 3; k++) { const t = -lato / 2 + (k + 0.5) * lato / 3, m = mesh(new T.BoxGeometry(0.7, 0.66, 0.7), M(merlo), { lb: 0.02 }); m.position.set(d[0] * (lato / 2) + (d[1] ? t : 0), alta + 0.3 + 0.33, d[1] * (lato / 2) + (d[0] ? t : 0)); g.add(m); }
      });
      if (tetto) {
        const r = mesh(new T.ConeGeometry(lato * 0.82, lato * 0.75, 4), M(coppi), { y: alta + 0.3 + lato * 0.375, l: 0.03 }); r.rotation.y = PI / 4; g.add(r);
        g.add(mesh(new T.SphereGeometry(0.14, 8, 6), M('#c8923a'), { y: alta + 0.3 + lato * 0.75 + 0.1, l: 0.015 }));
      }
      fadeVoci.push({ g, x, z, w: lato + 0.5, d: lato + 0.5, tipo: 'edificio' });
      ostBox(x, z, lato + 0.5, lato + 0.5);
      return g;
    }

    const { s, n, e, o: w } = MURA;
    // torri agli angoli e a meta' dei lati (a ovest, a meta', c'e' gia' la Torre dell'Orologio: la torre va piu' a sud)
    const TA = 4.4, tA = TA / 2 + 0.25;
    [[w, n], [e, n], [w, s], [e, s]].forEach(p => torre(p[0], p[1], TA, 5.8, true));
    torre(-27, n, 3.6, 4.8, false); torre(27, n, 3.6, 4.8, false);
    torre(-28, s, 3.6, 4.8, false); torre(28, s, 3.6, 4.8, false);
    torre(e, 30, 3.6, 4.8, false); torre(w, 52, 3.6, 4.8, false);
    // tratti di muro tra le torri
    muro(w + tA, n, -27 - 2, n); muro(-27 + 2, n, 27 - 2, n); muro(27 + 2, n, e - tA, n);
    muro(e, n + tA, e, 30 - 2); muro(e, 30 + 2, e, s - tA);
    muro(w, n + tA, w, 52 - 2); muro(w, 52 + 2, w, s - tA);
    muro(w + tA, s, -28 - 2, s); muro(-28 + 2, s, -PORTA.torri, s);
    muro(PORTA.torri, s, 28 - 2, s); muro(28 + 2, s, e - tA, s);

    /* ---------- la Porta del Borgo (a sud) ---------- */
    (function porta() {
      const g = new T.Group(); g.position.set(PORTA.x, 0, s); scene.add(g);
      const LA = 4.4, HA = 6.2, P = PORTA.mezza;
      // muro con l'arco
      const sh = new T.Shape(); sh.moveTo(-LA, 0); sh.lineTo(LA, 0); sh.lineTo(LA, HA); sh.lineTo(-LA, HA); sh.lineTo(-LA, 0);
      const foro = new T.Path(); foro.moveTo(-P, 0); foro.lineTo(-P, 3.0); foro.absarc(0, 3.0, P, PI, 0, true); foro.lineTo(P, 0); foro.lineTo(-P, 0); sh.holes.push(foro);
      const ge = new T.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: false, curveSegments: 14 }); ge.translate(0, 0, -1.1);
      g.add(mesh(ge, M(pietra), { l: 0.03 }));
      // conci dell'arco e chiave di volta, sul lato esterno
      for (let k = 0; k <= 8; k++) {
        const an = PI - k / 8 * PI, cx = Math.cos(an) * (P + 0.3), cy = 3.0 + Math.sin(an) * (P + 0.3);
        const c = mesh(new T.BoxGeometry(0.62, k === 4 ? 0.95 : 0.7, 0.2), M(k === 4 ? '#e2d4c6' : pietraChiara), { x: cx, y: cy, z: 1.15, lb: 0.012 }); c.rotation.z = an - PI / 2; g.add(c);
      }
      g.add(mesh(new T.BoxGeometry(LA * 2 + 0.3, 0.26, 2.5), M(pietraChiara), { y: HA + 0.13, lb: 0.02 }));
      for (let k = 0; k < 6; k++) g.add(mesh(new T.BoxGeometry(0.7, 0.66, 1.4), M(merlo), { x: -LA + (k + 0.5) * LA * 2 / 6, y: HA + 0.26 + 0.33, lb: 0.02 }));
      // stemma del borgo sopra l'arco: scudo con la stella della cometa
      const [cv, x] = B.tela(256, 300);
      x.fillStyle = '#2f2342'; x.beginPath(); x.moveTo(20, 20); x.lineTo(236, 20); x.lineTo(236, 170); x.quadraticCurveTo(236, 260, 128, 290); x.quadraticCurveTo(20, 260, 20, 170); x.closePath(); x.fill();
      x.lineWidth = 14; x.strokeStyle = '#f2c76e'; x.stroke();
      x.fillStyle = '#f2c76e'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 30 : 74, an = -PI / 2 + i * PI / 5; x.lineTo(128 + Math.cos(an) * r, 150 + Math.sin(an) * r); } x.closePath(); x.fill();
      const st = new T.Mesh(new T.PlaneGeometry(1.3, 1.52), new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: gm, transparent: true, alphaTest: 0.5 }));
      st.position.set(0, 4.9, 1.13); st.castShadow = false; g.add(st);
      // battenti di legno aperti verso la campagna
      [-1, 1].forEach(lato => {
        const pv = new T.Group(); pv.position.set(lato * P, 0, 1.0); pv.rotation.y = lato * (PI / 2 - 0.3); g.add(pv);
        const b = mesh(new T.BoxGeometry(P - 0.05, 3.9, 0.2), M('#6b4126'), { x: -lato * (P - 0.05) / 2 * -1, y: 1.95, lb: 0.015 });
        b.position.x = lato * (P - 0.05) / 2 * -1; pv.add(b);
        [0.7, 2.0, 3.3].forEach(y => pv.add(mesh(new T.BoxGeometry(P - 0.1, 0.12, 0.25), M('#2c2431'), { x: b.position.x, y, cast: false })));
      });
      // torri ai lati della porta, con le lanterne
      [-1, 1].forEach(lato => {
        const t = torre(lato * (LA + 2.2), s, 4.4, 7.4, true);
        B.PM.lanterna(t, -lato * 1.2, 3.0, 2.2);
        // stendardo
        const [c2, x2] = B.tela(64, 192); x2.fillStyle = '#2f2342'; x2.fillRect(0, 0, 64, 192); x2.fillStyle = '#f2c76e'; x2.fillRect(0, 0, 64, 14); x2.beginPath(); x2.moveTo(0, 150); x2.lineTo(32, 192); x2.lineTo(64, 150); x2.lineTo(64, 192); x2.lineTo(0, 192); x2.fill();
        x2.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 17, an = -PI / 2 + i * PI / 5; x2.lineTo(32 + Math.cos(an) * r, 80 + Math.sin(an) * r); } x2.closePath(); x2.fill();
        const sb = new T.Mesh(new T.PlaneGeometry(0.9, 2.7), new T.MeshToonMaterial({ map: B.tex(c2), gradientMap: gm, transparent: true, alphaTest: 0.5, side: T.DoubleSide }));
        sb.position.set(lato * 0.6, 4.6, 2.23); sb.castShadow = false; t.add(sb);
      });
      ostBox(-(P + LA) / 2 - 0.0, s, LA - P, 2.2); ostBox((P + LA) / 2, s, LA - P, 2.2);
      fadeVoci.push({ g, x: PORTA.x, z: s, w: LA * 2, d: 2.2, tipo: 'edificio' });
      edifici.push({ g: new T.Group(), x: PORTA.x, z: s + 4, w: 0, d: 0, nome: 'Porta del Borgo', soloNome: true });
    })();

    /* =================================================================
       LA CAMPAGNA
       ================================================================= */
    /* ---------- prato: un grande piano con macchie di colore, che sfuma verso l'orizzonte ---------- */
    (function prato() {
      const R = 360, seg = 72, ge = new T.PlaneGeometry(R * 2, R * 2, seg, seg); ge.rotateX(-PI / 2);
      const p = ge.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), a = new T.Color('#7fb35a'), b = new T.Color('#93c165'), d = new T.Color('#6ea24f'), h = new T.Color('#a9c79a');
      for (let i = 0; i < p.count; i++) {
        const X = p.getX(i), Z = p.getZ(i) + 40, r = Math.hypot(X, Z - 40);
        const nn = Math.sin(X * 0.045) * Math.cos(Z * 0.05) + Math.sin(X * 0.11 + Z * 0.07) * 0.5;
        c.copy(a).lerp(nn > 0 ? b : d, Math.min(1, Math.abs(nn) * 0.7));
        c.lerp(h, Math.min(1, Math.max(0, (r - 170) / 140)));   // foschia lontano
        col.set([c.r, c.g, c.b], i * 3);
      }
      ge.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.Mesh(ge, new T.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gm }));
      m.position.set(0, -0.08, 40); m.receiveShadow = true; m.castShadow = false; scene.add(m);
    })();

    /* ---------- strade di terra (nastri con i bordi piu' scuri) ---------- */
    const terra = new T.Color('#cfab74'), bordoTerra = new T.Color('#b38d5c');
    function strada(punti, larg) {
      const curva = new T.CatmullRomCurve3(punti.map(q => new T.Vector3(q[0], 0, q[1])), false, 'centripetal');
      const nn = Math.max(4, Math.round(curva.getLength() / 1.5)), pos = [], col = [], idx = [], camp = [];
      for (let i = 0; i <= nn; i++) {
        const q = curva.getPointAt(i / nn), t = curva.getTangentAt(i / nn), nx = -t.z, nz = t.x, j1 = Math.sin(i * 1.7) * 0.15, j2 = Math.cos(i * 1.3) * 0.15;
        pos.push(q.x + nx * (larg / 2 + j1), 0, q.z + nz * (larg / 2 + j1), q.x, 0, q.z, q.x - nx * (larg / 2 + j2), 0, q.z - nz * (larg / 2 + j2));
        [bordoTerra, terra, bordoTerra].forEach(cc => col.push(cc.r, cc.g, cc.b));
        if (i < nn) { const k = i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
        if (i % 2 === 0) camp.push([q.x, q.z]);
      }
      const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); ge.setAttribute('color', new T.Float32BufferAttribute(col, 3)); ge.setIndex(idx); ge.computeVertexNormals();
      const m = new T.Mesh(ge, M('#ffffff', { vertexColors: true })); m.position.y = -0.04; m.castShadow = false; m.receiveShadow = true; scene.add(m);
      MAPPA.strade.push({ p: camp, l: larg });
    }
    // strada dalla porta verso sud, incrocio a z=100, anello attorno alle mura, sentieri per il mulino e la cascina
    strada([[0, s + 0.8], [0, 100], [2.5, 130], [-2, 152], [0, LIM.z1 + 4]], 4.2);
    strada([[LIM.x0 - 4, 100], [-40, 100.5], [40, 99.5], [LIM.x1 + 4, 100]], 3.6);
    strada([[-80, 100], [-80, 40], [-80, -28], [-77, -36], [-70, -38], [0, -38.5], [70, -38], [77, -36], [80, -28], [80, 40], [80, 100]], 3.2);
    strada([[-80, 28], [-88, 28.5], [-95, 30]], 2.2);
    strada([[34, 100], [36, 110], [42, 117]], 2.4);
    strada([[-34, 100], [-38, 112], [-46, 124]], 2.2);

    /* ---------- campi coltivati ---------- */
    const texCampi = {};
    function texCampo(tipo) {
      if (texCampi[tipo]) return texCampi[tipo];
      const S = 128, [cv, x] = B.tela(S, S), r = () => Math.random();
      const fondo = { grano: '#d9b65a', lavanda: '#7c6b4f', orto: '#8a6745', arato: '#9b7650', girasoli: '#6f9a45' }[tipo];
      x.fillStyle = fondo; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 8; i++) {
        const y0 = i * 16;
        if (tipo === 'grano') { x.fillStyle = '#c49d45'; x.fillRect(0, y0 + 11, S, 4); for (let k = 0; k < 40; k++) { x.fillStyle = r() > 0.5 ? '#ecd27a' : '#e4c464'; x.fillRect(r() * S, y0 + r() * 10, 2, 3); } }
        if (tipo === 'lavanda') { x.fillStyle = '#9a7fd0'; x.fillRect(0, y0 + 2, S, 10); for (let k = 0; k < 30; k++) { x.fillStyle = r() > 0.5 ? '#b9a2e6' : '#8a6cc4'; x.beginPath(); x.arc(r() * S, y0 + 3 + r() * 8, 2.2, 0, 7); x.fill(); } }
        if (tipo === 'orto') { for (let k = 0; k < 10; k++) { x.fillStyle = r() > 0.4 ? '#5f9c45' : '#7cbf5a'; x.beginPath(); x.arc(k * 13 + 6, y0 + 7, 4.5, 0, 7); x.fill(); } }
        if (tipo === 'arato') { x.fillStyle = '#86633f'; x.fillRect(0, y0 + 9, S, 6); }
        if (tipo === 'girasoli') { for (let k = 0; k < 9; k++) { const cx = k * 14 + 7, cy = y0 + 8; x.fillStyle = '#f2c53a'; x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill(); x.fillStyle = '#6b4a2a'; x.beginPath(); x.arc(cx, cy, 2, 0, 7); x.fill(); } }
      }
      const t = B.tex(cv, true); return (texCampi[tipo] = t);
    }
    const matCampi = {};
    const COL_CAMPI = { grano: '#e3c060', lavanda: '#9b7fc9', orto: '#6fa84e', arato: '#9b7650', girasoli: '#e6c23f' };
    function campo(x0, z0, x1, z1, tipo, verticale) {
      const W = x1 - x0, D = z1 - z0, ge = new T.PlaneGeometry(W, D); ge.rotateX(-PI / 2);
      const uv = ge.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (verticale) uv.setXY(i, v * D / 6, u * W / 6); else uv.setXY(i, u * W / 6, v * D / 6); }
      const mat = matCampi[tipo] || (matCampi[tipo] = new T.MeshToonMaterial({ map: texCampo(tipo), gradientMap: gm }));
      const m = new T.Mesh(ge, mat); m.position.set((x0 + x1) / 2, -0.035, (z0 + z1) / 2); m.castShadow = false; m.receiveShadow = true; scene.add(m);
      // bordo d'erba piu' scura attorno al campo
      [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]].forEach(b => {
        const lw = Math.abs(b[2] - b[0]) || 0.5, ld = Math.abs(b[3] - b[1]) || 0.5, f = mesh(new T.BoxGeometry(lw + 0.5, 0.12, ld + 0.5), M('#5f9447'), { x: (b[0] + b[2]) / 2, y: 0.0, z: (b[1] + b[3]) / 2, cast: false }); scene.add(f);
      });
      MAPPA.campi.push({ x0, z0, x1, z1, c: COL_CAMPI[tipo] });
    }
    // tra le mura e l'incrocio
    campo(-74, 78, -46, 96, 'grano'); campo(-40, 78, -6, 96, 'lavanda', true);
    campo(6, 78, 36, 96, 'orto'); campo(42, 78, 74, 96, 'girasoli', true);
    // a sud dell'incrocio
    campo(-66, 106, -24, 128, 'arato'); campo(-66, 134, -26, 160, 'grano', true);
    campo(10, 140, 38, 166, 'lavanda'); campo(-20, 108, -6, 168, 'orto', true);
    // a nord, oltre l'anello
    campo(-60, -54, -24, -42, 'grano'); campo(24, -54, 62, -42, 'girasoli');

    /* ---------- alberi della campagna (piu' semplici di quelli della piazza: sono tanti) ---------- */
    const geoTr = new T.CylinderGeometry(0.2, 0.32, 1.9, 6); geoTr.translate(0, 0.95, 0);
    const geoCh = new T.IcosahedronGeometry(1.6, 0), geoCh2 = new T.IcosahedronGeometry(1.15, 0);
    const geoCip = new T.ConeGeometry(0.85, 6.0, 7); geoCip.translate(0, 3.6, 0);
    const geoPino = new T.ConeGeometry(1.7, 2.8, 7), geoPino2 = new T.ConeGeometry(1.25, 2.3, 7);
    const VERDI = ['#5f9a48', '#6aa84f', '#548c42', '#79b157'];
    function tondo(x, z, sc) {
      const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc || rnd(0.85, 1.25)); g.rotation.y = rnd(0, PI * 2); scene.add(g);
      g.add(mesh(geoTr, cortecce, { cast: false }));
      const v = VERDI[Math.floor(rnd(0, VERDI.length))];
      g.add(mesh(geoCh, M(v), { y: 2.9, l: 0.04 }));
      g.add(mesh(geoCh2, M(v), { x: rnd(-0.8, 0.8), y: 3.9, z: rnd(-0.6, 0.6), l: 0.035, cast: false }));
      ostCer(x, z, 0.45 * g.scale.x);
    }
    function cipresso(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); const sc = rnd(0.85, 1.15); g.scale.set(sc, sc * rnd(0.95, 1.2), sc); scene.add(g);
      g.add(mesh(geoTr, cortecce, { cast: false }));
      g.add(mesh(geoCip, M(rnd(0, 1) > 0.5 ? '#3d6a3c' : '#467545'), { l: 0.035 }));
      ostCer(x, z, 0.4);
    }
    function pino(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(rnd(0.9, 1.3)); scene.add(g);
      g.add(mesh(geoTr, cortecce, { cast: false }));
      g.add(mesh(geoPino, M('#3f7048'), { y: 2.9, l: 0.035 }));
      g.add(mesh(geoPino2, M('#4a7f52'), { y: 4.4, l: 0.03, cast: false }));
      ostCer(x, z, 0.45);
    }
    const libero = (x, z) => {
      if (x > MURA.o - 3 && x < MURA.e + 3 && z > MURA.n - 3 && z < MURA.s + 3) return false;   // le mura
      for (const st of MAPPA.strade) for (const q of st.p) if (Math.abs(q[0] - x) < st.l / 2 + 2 && Math.abs(q[1] - z) < st.l / 2 + 2) return false;
      for (const c of MAPPA.campi) if (x > c.x0 - 1.5 && x < c.x1 + 1.5 && z > c.z0 - 1.5 && z < c.z1 + 1.5) return false;
      for (const v of MAPPA.vigne) if (x > v.x0 - 1.5 && x < v.x1 + 1.5 && z > v.z0 - 1.5 && z < v.z1 + 1.5) return false;
      for (const ed of MAPPA.edifici) if (x > ed.x0 && x < ed.x1 && z > ed.z0 && z < ed.z1) return false;
      return true;
    };
    // cipressi lungo la strada che scende a sud
    for (let z = 106; z < LIM.z1 - 4; z += 9) { if (libero(-5.5, z)) cipresso(-5.5, z); if (libero(5.5, z + 4)) cipresso(5.5, z + 4); }
    // e lungo il tratto dalla porta all'incrocio
    [76, 84, 92].forEach(z => { cipresso(-3.6, z); cipresso(3.6, z); });

    /* ---------- vigneti e frutteti ---------- */
    function vigneto(x0, z0, x1, z1) {
      MAPPA.vigne.push({ x0, z0, x1, z1 });
      const file = Math.round((x1 - x0) / 2.6), L = z1 - z0;
      for (let i = 0; i <= file; i++) {
        const x = x0 + (x1 - x0) * i / file;
        scene.add(mesh(new T.BoxGeometry(0.55, 1.05, L), M(i % 2 ? '#5d9a43' : '#669f49'), { x, y: 0.62, z: (z0 + z1) / 2, lb: 0.02 }));
        for (let k = 0; k <= Math.round(L / 6); k++) scene.add(mesh(new T.BoxGeometry(0.12, 1.5, 0.12), M('#7a5a3c'), { x, y: 0.75, z: z0 + k * L / Math.round(L / 6), cast: false }));
        // grappoli
        for (let k = 0; k < L / 4; k++) scene.add(mesh(new T.IcosahedronGeometry(0.16, 0), M('#6b3f8a'), { x: x + (k % 2 ? 0.3 : -0.3), y: 0.55, z: z0 + 1 + k * 4 + rnd(0, 2), cast: false }));
        ostBox(x, (z0 + z1) / 2, 0.55, L);
      }
    }
    vigneto(58, -24, 75, 26); vigneto(58, 40, 75, 92);
    vigneto(84, 108, 114, 150);
    function frutteto(x0, z0, nx, nz, passo, frutto) {
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const x = x0 + i * passo, z = z0 + k * passo, g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(0.75); scene.add(g);
        g.add(mesh(geoTr, cortecce, { cast: false })); g.add(mesh(geoCh, M('#6aa84f'), { y: 2.7, l: 0.04 }));
        for (let f = 0; f < 5; f++) { const an = f / 5 * PI * 2; g.add(mesh(new T.IcosahedronGeometry(0.2, 0), M(frutto), { x: Math.cos(an) * 1.3, y: 2.6 + rnd(-0.4, 0.5), z: Math.sin(an) * 1.3, cast: false })); }
        ostCer(x, z, 0.35);
      }
      MAPPA.vigne.push({ x0: x0 - 2, z0: z0 - 2, x1: x0 + (nx - 1) * passo + 2, z1: z0 + (nz - 1) * passo + 2, frutteto: true });
    }
    frutteto(-74, -26, 3, 10, 6.5, '#e0563f');   // meleto a ovest delle mura
    frutteto(-110, 108, 5, 4, 6.5, '#f0a030');   // aranceto a sud-ovest

    /* ---------- staccionate, balle di fieno ---------- */
    function staccionata(x0, z0, x1, z1) {
      const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), nP = Math.max(1, Math.round(L / 2.4));
      for (let i = 0; i <= nP; i++) scene.add(mesh(new T.BoxGeometry(0.16, 1.1, 0.16), M('#7a5a3c'), { x: x0 + (x1 - x0) * i / nP, y: 0.55, z: z0 + (z1 - z0) * i / nP, cast: false, lb: 0.01 }));
      [0.45, 0.85].forEach(y => { const r = mesh(new T.BoxGeometry(0.08, 0.12, L), M('#8a6a48'), { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, cast: false, lb: 0.008 }); r.rotation.y = a; scene.add(r); });
      const g = 0.25; ostacoli.push({ t: 'b', x0: Math.min(x0, x1) - g, x1: Math.max(x0, x1) + g, z0: Math.min(z0, z1) - g, z1: Math.max(z0, z1) + g });
    }
    const geoBalla = new T.CylinderGeometry(0.85, 0.85, 1.3, 12); geoBalla.rotateZ(PI / 2);
    function balla(x, z, rot) { const b = mesh(geoBalla, M('#e2c46a'), { x, y: 0.85, z, l: 0.02 }); b.rotation.y = rot == null ? rnd(0, PI) : rot; scene.add(b); ostCer(x, z, 0.9); }
    // balle nei campi di grano mietuti
    [[-70, 82], [-56, 92], [-50, 81], [-60, 142], [-40, 152], [-30, 140]].forEach(p => balla(p[0], p[1]));

    /* ---------- edifici di campagna ---------- */
    function tettoA(g, w, d, h, y, col) {
      const sh = new T.Shape(); sh.moveTo(-w / 2 - 0.5, 0); sh.lineTo(w / 2 + 0.5, 0); sh.lineTo(0, h); sh.lineTo(-w / 2 - 0.5, 0);
      const ge = new T.ExtrudeGeometry(sh, { depth: d + 0.8, bevelEnabled: false }); ge.translate(0, 0, -(d + 0.8) / 2);
      g.add(mesh(ge, M(col), { y, l: 0.03 }));
    }
    function finestra(g, x, y, z, rotY) {
      const f = new T.Mesh(new T.PlaneGeometry(0.7, 0.9), B.Mluce('#ffc060', 0.9)); f.position.set(x, y, z); f.rotation.y = rotY; g.add(f);
      [-1, 1].forEach(l => { const p = mesh(new T.BoxGeometry(0.4, 1.0, 0.06), M('#5f8a6a'), { lb: 0.008, cast: false }); p.position.set(x + Math.cos(rotY) * l * 0.58, y, z - Math.sin(rotY) * l * 0.58); p.rotation.y = rotY; g.add(p); });
    }
    function casale(x, z, w, d, h, nome) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.BoxGeometry(w + 0.3, 0.8, d + 0.3), M('#b3a29b'), { y: 0.4, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(w, h, d), M('#ecd9b8'), { y: h / 2, lb: 0.03 }));
      tettoA(g, w, d, 2.6, h, coppi);
      g.add(mesh(new T.BoxGeometry(0.8, 1.6, 0.8), M('#c9b2a0'), { x: w * 0.25, y: h + 2.0, z: -d * 0.15, lb: 0.02 }));   // comignolo
      g.add(mesh(new T.BoxGeometry(1.3, 2.2, 0.12), M('#6b4126'), { y: 1.1, z: d / 2 + 0.05, lb: 0.012 }));             // porta
      [-w * 0.32, w * 0.32].forEach(fx => finestra(g, fx, 1.6, d / 2 + 0.03, 0));
      [-w * 0.32, 0, w * 0.32].forEach(fx => finestra(g, fx, h - 1.3, d / 2 + 0.03, 0));
      [-1, 1].forEach(l => finestra(g, l * (w / 2 + 0.03), h - 1.3, 0, l * PI / 2));
      ostBox(x, z, w + 0.4, d + 0.4); MAPPA.edifici.push({ x0: x - w / 2 - 3, x1: x + w / 2 + 3, z0: z - d / 2 - 3, z1: z + d / 2 + 4, c: '#c98a5e' });
      edifici.push({ g, x, z, w: w + 0.4, d: d + 0.4, nome });
      return g;
    }
    function fienile(x, z, w, d, h) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.BoxGeometry(w, h, d), M('#a0563f'), { y: h / 2, lb: 0.03 }));
      tettoA(g, w, d, 2.0, h, '#6f4a35');
      g.add(mesh(new T.BoxGeometry(w * 0.5, h * 0.75, 0.1), M('#3a2a24'), { y: h * 0.375, z: d / 2 + 0.03, cast: false }));
      g.add(mesh(new T.BoxGeometry(w * 0.45, 1.1, 0.6), M('#e2c46a'), { y: 0.55, z: d / 2 - 0.2, lb: 0.01 }));   // fieno sulla porta
      [[-1, 1], [1, 1]].forEach(c => { const tr = mesh(new T.BoxGeometry(0.12, h * 0.75 * 1.2, 0.12), M('#e9dcc6'), { x: 0, y: h * 0.375, z: d / 2 + 0.09, cast: false }); tr.rotation.z = c[0] * 0.55; g.add(tr); });
      ostBox(x, z, w + 0.3, d + 0.3); MAPPA.edifici.push({ x0: x - w / 2 - 2, x1: x + w / 2 + 2, z0: z - d / 2 - 2, z1: z + d / 2 + 3, c: '#a0563f' });
      edifici.push({ g, x, z, w: w + 0.3, d: d + 0.3 });
    }
    function pozzo(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(0.9, 0.95, 0.9, 12), M('#b3a29b'), { y: 0.45, l: 0.02 }));
      g.add(mesh(new T.CylinderGeometry(0.7, 0.7, 0.05, 12), M('#3f7fa0'), { y: 0.86, cast: false }));
      [-1, 1].forEach(l => g.add(mesh(new T.BoxGeometry(0.14, 1.6, 0.14), M(legno), { x: l * 0.75, y: 1.6, lb: 0.01 })));
      const r = mesh(new T.ConeGeometry(1.2, 0.7, 4), M(coppi), { y: 2.6, l: 0.02 }); r.rotation.y = PI / 4; g.add(r);
      ostCer(x, z, 1.0);
    }
    // la Cascina (sud-est) e il casale del contadino (sud-ovest)
    casale(50, 126, 11, 7, 5.4, 'Cascina'); fienile(64, 124, 8, 6, 4.4); pozzo(56, 134);
    staccionata(41, 118, 41, 140); staccionata(41, 140, 72, 140); staccionata(72, 118, 72, 140);
    [[46, 136], [62, 136], [67, 132]].forEach(p => balla(p[0], p[1]));
    casale(-52, 116 + 14, 8, 6, 4.6, 'Casale'); pozzo(-44, 136);
    // mulino a vento (ovest, fuori dall'anello)
    (function mulino(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(2.0, 2.7, 8, 12), M('#efe6d6'), { y: 4, l: 0.03 }));
      g.add(mesh(new T.CylinderGeometry(2.8, 2.9, 0.6, 12), M('#b3a29b'), { y: 0.3, l: 0.02 }));
      g.add(mesh(new T.ConeGeometry(2.45, 2.6, 12), M('#8a5a35'), { y: 9.3, l: 0.03 }));
      g.add(mesh(new T.BoxGeometry(1.1, 1.9, 0.2), M('#6b4126'), { y: 0.95 + 0.6, z: 2.55, lb: 0.012 }));
      finestra(g, 0, 5.2, 2.3, 0);
      const mozzo = new T.Group(); mozzo.position.set(0, 7.0, 2.4); g.add(mozzo);
      mozzo.add(mesh(new T.CylinderGeometry(0.35, 0.35, 0.6, 10), M('#5c3822'), { l: 0.015, cast: false }).rotateX(PI / 2));
      const pale = new T.Group(); pale.position.z = 0.35; mozzo.add(pale);
      for (let i = 0; i < 4; i++) {
        const b = new T.Group(); b.rotation.z = i * PI / 2; pale.add(b);
        b.add(mesh(new T.BoxGeometry(0.18, 5.6, 0.12), M('#6b4126'), { y: 2.8, lb: 0.01 }));
        b.add(mesh(new T.BoxGeometry(1.15, 4.4, 0.05), M('#ece0c8'), { x: 0.68, y: 3.3, lb: 0.01, cast: false }));
      }
      anim.push(t => { pale.rotation.z = -t * 0.7; });
      ostCer(x, z, 3.0); MAPPA.edifici.push({ x0: x - 5, x1: x + 5, z0: z - 5, z1: z + 6, c: '#efe6d6', tondo: 2.7, x, z });
      edifici.push({ g, x, z, w: 5.5, d: 5.5, nome: 'Mulino' });
    })(-98, 30);

    /* ---------- cartello all'incrocio ---------- */
    (function cartello(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.BoxGeometry(0.2, 3.0, 0.2), M(legno), { y: 1.5, lb: 0.012 }));
      [['Borgo', -PI / 2 + PI / 2, 2.55], ['Cascina', 0, 2.05], ['Mulino', PI, 1.55]].forEach((v, i) => {
        const [cv, cx] = B.tela(256, 64); cx.fillStyle = '#e9c98f'; cx.fillRect(0, 0, 256, 64); cx.fillStyle = '#4a2c1c'; cx.font = 'bold 38px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(v[0], 128, 34);
        const p = new T.Group(); p.position.y = v[2]; p.rotation.y = v[1]; g.add(p);
        const mat = new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: gm });
        const tav = mesh(new T.BoxGeometry(1.6, 0.4, 0.06), [M('#c9a46e'), M('#c9a46e'), M('#c9a46e'), M('#c9a46e'), mat, mat], { cast: false });
        tav.position.x = 0.8; p.add(tav);
      });
      // Borgo verso nord, Cascina verso est, Mulino verso ovest
      g.children[1].rotation.y = PI / 2; g.children[2].rotation.y = 0; g.children[3].rotation.y = PI;
      ostCer(x, z, 0.3);
    })(4.5, 103.5);

    /* ---------- boschi e alberi sparsi ---------- */
    // fascia di bosco a nord, oltre i campi
    for (let x = LIM.x0 + 4; x < LIM.x1 - 3; x += rnd(5, 8)) { const z = rnd(-56, -50); if (libero(x, z)) (rnd(0, 1) > 0.5 ? pino : tondo)(x, z); }
    // boschi a est e a ovest, oltre l'anello
    [[86, 116], [-116, -86]].forEach(r => { for (let i = 0; i < 34; i++) { const x = rnd(r[0], r[1]), z = rnd(-48, 96); if (libero(x, z)) (rnd(0, 1) > 0.4 ? tondo : pino)(x, z); } });
    // prato tra le mura e l'anello: qualche albero e cespuglio
    for (let i = 0; i < 26; i++) {
      const lato = i % 4, x = lato === 0 ? rnd(-76, 76) : lato === 1 ? rnd(-76, 76) : lato === 2 ? rnd(-77, -59) : rnd(59, 77), z = lato === 0 ? rnd(-34, -18) : lato === 1 ? rnd(76, 97) : rnd(-30, 96);
      if (libero(x, z)) tondo(x, z);
    }
    // a sud, sparsi tra i campi
    for (let i = 0; i < 30; i++) { const x = rnd(-116, 116), z = rnd(104, 172); if (libero(x, z)) (rnd(0, 1) > 0.7 ? cipresso : tondo)(x, z); }
    // fiori di campo
    const geoFiore = new T.IcosahedronGeometry(0.16, 0);
    for (let i = 0; i < 160; i++) { const x = rnd(LIM.x0, LIM.x1), z = rnd(LIM.z0, LIM.z1); if (libero(x, z)) scene.add(mesh(geoFiore, M(['#f7f3e8', '#f2c53a', '#e66a8a', '#a98ad8'][i % 4]), { x, y: 0.08, z, cast: false, recv: false })); }

    /* ---------- confine: siepi lungo i bordi, con qualche albero ---------- */
    function siepe(x0, z0, x1, z1) {
      const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      const s1 = mesh(new T.BoxGeometry(1.6, 1.7, L), M('#4f8a3f'), { x: (x0 + x1) / 2, y: 0.85, z: (z0 + z1) / 2, lb: 0.03 }); s1.rotation.y = a; scene.add(s1);
      for (let d = 6; d < L - 3; d += rnd(9, 15)) { const x = x0 + (x1 - x0) * d / L, z = z0 + (z1 - z0) * d / L; (rnd(0, 1) > 0.5 ? tondo : pino)(x + (z1 === z0 ? 0 : Math.sign(x) * 1.5), z + (x1 === x0 ? 0 : Math.sign(z - 60) * 1.5)); }
    }
    siepe(LIM.x0 - 1, LIM.z0 - 1, LIM.x1 + 1, LIM.z0 - 1); siepe(LIM.x0 - 1, LIM.z1 + 1, -4, LIM.z1 + 1); siepe(4, LIM.z1 + 1, LIM.x1 + 1, LIM.z1 + 1);
    siepe(LIM.x0 - 1, LIM.z0 - 1, LIM.x0 - 1, 97); siepe(LIM.x0 - 1, 103, LIM.x0 - 1, LIM.z1 + 1);
    siepe(LIM.x1 + 1, LIM.z0 - 1, LIM.x1 + 1, 97); siepe(LIM.x1 + 1, 103, LIM.x1 + 1, LIM.z1 + 1);

    /* ---------- colline all'orizzonte (fuori dal confine, non si raggiungono) ---------- */
    const geoColle = new T.IcosahedronGeometry(1, 2);
    const COLLI = ['#78a85a', '#6c9e57', '#86b068', '#7fa968', '#8fb3a0'];
    for (let i = 0; i < 30; i++) {
      const an = i / 30 * PI * 2 + rnd(-0.08, 0.08), rx = rnd(180, 225), rz = rnd(165, 205);
      const c = new T.Mesh(geoColle, M(COLLI[i % COLLI.length])); c.position.set(Math.cos(an) * rx, -rnd(4, 9), 60 + Math.sin(an) * rz);
      c.scale.set(rnd(36, 60), rnd(18, 36), rnd(28, 44)); c.rotation.y = an; c.castShadow = false; c.receiveShadow = false; scene.add(c);
    }
    // seconda fila, piu' lontana e azzurrina
    for (let i = 0; i < 18; i++) {
      const an = i / 18 * PI * 2 + 0.17, c = new T.Mesh(geoColle, M(i % 2 ? '#9dbcb4' : '#a7c3bd')); c.position.set(Math.cos(an) * 265, -6, 60 + Math.sin(an) * 245);
      c.scale.set(rnd(60, 85), rnd(30, 52), rnd(40, 55)); c.castShadow = false; c.receiveShadow = false; scene.add(c);
    }
  };

  /* ---------- per la piazza: fin dove si cammina, e la minimappa ---------- */
  B.Campagna = {
    LIM, MURA,
    area: (x, z) => x > LIM.x0 && x < LIM.x1 && z > LIM.z0 && z < LIM.z1,
    mappa(c) {
      c.fillStyle = '#7fb35a'; c.fillRect(LIM.x0 - 30, LIM.z0 - 30, LIM.x1 - LIM.x0 + 60, LIM.z1 - LIM.z0 + 60);
      MAPPA.campi.forEach(q => { c.fillStyle = q.c; c.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0); });
      MAPPA.vigne.forEach(q => { c.fillStyle = q.frutteto ? '#5e9a46' : '#4f8a3f'; c.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0); });
      c.strokeStyle = '#d8b67e'; c.lineCap = 'round'; c.lineJoin = 'round';
      MAPPA.strade.forEach(s => { c.lineWidth = s.l; c.beginPath(); s.p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); });
      MAPPA.edifici.forEach(q => { c.fillStyle = q.c; if (q.tondo) { c.beginPath(); c.arc(q.x, q.z, q.tondo, 0, 7); c.fill(); } });
      c.fillStyle = '#9a8a82'; const m = MURA, sp = m.sp; c.fillRect(m.o - sp, m.n - sp, m.e - m.o + sp * 2, m.s - m.n + sp * 2);
    }
  };
})();
