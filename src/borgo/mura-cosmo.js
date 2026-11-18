/* =====================================================================
   THE BORG - LE MURA E IL COSMO
   Il borgo e' un'isola murata che galleggia nel cosmo.
   Mura: torri con il tetto di coppi agli angoli, torri merlate a meta' dei
   lati, merli, edera e la Porta del Borgo a sud (chiusa: fuori c'e' il vuoto).
   Sotto l'isola: rocce sospese con i cristalli che brillano.
   Intorno: la volta del cosmo (nebulose e stelle disegnate), stelle che
   brillano, pianeti che ruotano (uno con gli anelli, una luna), la cometa con
   la coda, asteroidi che girano attorno all'isola e stelle cadenti.
   Lo chiama piazza.js (B3.costruisciMuraCosmo); la minimappa disegna le mura
   con B3.Mura.mappa. Si cammina solo dentro le mura.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, CFG = B.CFG, PI = Math.PI;
  const PZ = CFG.plaza;
  // linee centrali delle mura (appena fuori dal selciato) e porta a sud
  const MURA = { s: PZ.z1 + 0.6, n: PZ.z0 - 0.6, e: PZ.x1 + 0.6, o: PZ.x0 - 0.6, sp: 1.4, h: 3.4 };
  const PORTA = { x: 0, mezza: 2.5, torri: 8.8 };   // apertura larga 5 m, torri della porta fino a 8,8 m dal centro
  const CX = (PZ.x0 + PZ.x1) / 2, CZ = (PZ.z0 + PZ.z1) / 2;   // centro dell'isola

  // numeri casuali con seme: tutti vedono lo stesso cielo
  let seme = 20261118;
  const rnd = (a, b) => { seme = (seme * 16807) % 2147483647; return a + (seme / 2147483647) * (b - a); };

  B.costruisciMuraCosmo = function (o) {
    const { scene, ostacoli, anim, fadeVoci, edifici } = o;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const gm = M('#ffffff').gradientMap;
    const pietra = '#b9a89f', pietraScura = '#8f7f86', pietraChiara = '#cdbfb8', merlo = '#c4b4ad', coppi = '#b0583f';

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
      // battenti di legno chiusi: fuori dalle mura c'e' il cosmo
      [-1, 1].forEach(lato => {
        const pv = new T.Group(); pv.position.set(lato * P, 0, 0.2); pv.rotation.y = 0; g.add(pv);
        const b = mesh(new T.BoxGeometry(P - 0.05, 3.9, 0.2), M('#6b4126'), { x: -lato * (P - 0.05) / 2 * -1, y: 1.95, lb: 0.015 });
        b.position.x = lato * (P - 0.05) / 2 * -1; pv.add(b);
        [0.7, 2.0, 3.3].forEach(y => pv.add(mesh(new T.BoxGeometry(P - 0.1, 0.12, 0.25), M('#2c2431'), { x: b.position.x, y, cast: false })));
      });
      // lunetta di legno sopra i battenti: l'arco e' chiuso del tutto
      const lu = mesh(new T.CircleGeometry(P, 16, 0, PI), M('#5a361f'), { y: 3.0, z: 0.25, cast: false }); g.add(lu);
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
      edifici.push({ g: new T.Group(), x: PORTA.x, z: s - 3, w: 0, d: 0, nome: 'Porta del Borgo', soloNome: true });
    })();


    /* =================================================================
       SOTTO L'ISOLA: rocce sospese e cristalli
       ================================================================= */
    // la lastra dell'isola, larga abbastanza da reggere le mura
    scene.add(mesh(new T.BoxGeometry(PZ.w + 4.8, 2.2, PZ.d + 4.8), M('#8a7a82'), { x: CX, y: -1.12, z: CZ, lb: 0.05, cast: false }));
    const roccia = ['#6f6270', '#5f5463', '#7a6c78'];
    // la radice: un grande cono di roccia rovesciato sotto il centro
    { const r = mesh(new T.ConeGeometry(40, 34, 9), M('#5f5463'), { x: CX, y: -2.2 - 17, z: CZ, cast: false, l: 0.06 }); r.rotation.x = PI; r.scale.set(1.35, 1, 1.05); scene.add(r); }
    for (let i = 0; i < 34; i++) {
      const x = rnd(PZ.x0 + 3, PZ.x1 - 3), z = rnd(PZ.z0 + 3, PZ.z1 - 3), rr = rnd(3, 8), h = rnd(6, 18);
      const c = mesh(new T.ConeGeometry(rr, h, 7), M(roccia[i % 3]), { x, y: -2.2 - h / 2 + rnd(0, 1.5), z, cast: false, l: 0.04 }); c.rotation.x = PI; c.rotation.y = rnd(0, PI); scene.add(c);
    }
    // cristalli che brillano sotto l'isola (non si accendono e spengono con la sera: sono magici)
    const geoCri = new T.OctahedronGeometry(1, 0);
    const CRI = ['#7fe3ff', '#c39bff', '#ff9bd8'];
    for (let i = 0; i < 26; i++) {
      const c = new T.Mesh(geoCri, new T.MeshBasicMaterial({ color: CRI[i % 3] })), s = rnd(0.8, 2.2);
      c.scale.set(s * 0.6, s * 1.6, s * 0.6); c.position.set(rnd(PZ.x0 + 6, PZ.x1 - 6), rnd(-24, -5), rnd(PZ.z0 + 6, PZ.z1 - 6)); c.rotation.set(rnd(-0.4, 0.4) + PI, rnd(0, PI), rnd(-0.4, 0.4)); scene.add(c);
    }

    /* =================================================================
       IL COSMO
       ================================================================= */
    /* ---------- la volta: nebulose e stelle disegnate su una grande sfera ---------- */
    (function volta() {
      const W = 2048, H = 1024, [cv, x] = B.tela(W, H);
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#120c2e'); g.addColorStop(0.45, '#1c1240'); g.addColorStop(0.75, '#140d33'); g.addColorStop(1, '#07051a');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // nebulose: macchie morbide colorate
      const neb = [['rgba(170,90,220,', 0.45], ['rgba(80,170,230,', 0.35], ['rgba(240,110,170,', 0.32], ['rgba(110,90,240,', 0.4], ['rgba(60,200,190,', 0.26]];
      for (let i = 0; i < 40; i++) {
        const n = neb[i % neb.length], px = rnd(0, W), py = rnd(H * 0.3, H * 0.95), r = rnd(80, 300), rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, n[0] + n[1] + ')'); rg.addColorStop(1, n[0] + '0)');
        x.fillStyle = rg; x.beginPath(); x.ellipse(px, py, r * rnd(1.2, 2.2), r, rnd(-0.4, 0.4), 0, 7); x.fill();
        if (px < r * 2.2) { x.beginPath(); x.ellipse(px + W, py, r * 2, r, 0, 0, 7); x.fill(); }   // si chiude bene sul giro
      }
      // stelle piccole
      for (let i = 0; i < 2600; i++) { const a = rnd(0.25, 1); x.fillStyle = 'rgba(255,' + Math.round(rnd(225, 255)) + ',' + Math.round(rnd(215, 255)) + ',' + a + ')'; const s = rnd(0, 1) > 0.97 ? 2.4 : rnd(0.8, 1.6); x.fillRect(rnd(0, W), rnd(0, H), s, s); }
      // qualche stella grande con la croce di luce
      for (let i = 0; i < 40; i++) {
        const px = rnd(0, W), py = rnd(H * 0.35, H), r = rnd(8, 18), rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(0.25, 'rgba(255,240,220,.6)'); rg.addColorStop(1, 'rgba(255,240,220,0)');
        x.fillStyle = rg; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,250,235,.55)'; x.fillRect(px - r * 1.6, py - 0.7, r * 3.2, 1.4); x.fillRect(px - 0.7, py - r * 1.6, 1.4, r * 3.2);
      }
      const t = B.tex(cv); t.encoding = T.sRGBEncoding;
      const sfera = new T.Mesh(new T.SphereGeometry(165, 48, 32), new T.MeshBasicMaterial({ map: t, side: T.BackSide, depthWrite: false, fog: false }));
      sfera.position.set(CX, -10, CZ); sfera.renderOrder = -10; sfera.userData.vivo = true; sfera.castShadow = sfera.receiveShadow = false;
      scene.add(sfera);
    })();

    /* ---------- stelle vicine che brillano (due gruppi che si accendono a turno) ---------- */
    const brillii = [];
    [0, 1].forEach(k => {
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let x, y, z; do { const an = rnd(0, PI * 2), r = rnd(75, 150); x = CX + Math.cos(an) * r; z = CZ + Math.sin(an) * r; y = rnd(-110, 20); } while (Math.abs(x - CX) < 62 && Math.abs(z - CZ) < 50 && y > -40);
        pos.set([x, y, z], i * 3);
      }
      const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(pos, 3));
      const mt = new T.PointsMaterial({ color: k ? 0xfff0c8 : 0xd8e6ff, size: k ? 3.2 : 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
      const p = new T.Points(ge, mt); p.userData.vivo = true; scene.add(p); brillii.push(mt);
    });
    anim.push(t => { brillii[0].opacity = 0.55 + Math.sin(t * 1.7) * 0.35; brillii[1].opacity = 0.55 + Math.sin(t * 1.3 + 2) * 0.35; });

    /* ---------- pianeti ---------- */
    function texStrisce(cols, n) {
      const [cv, x] = B.tela(64, 256);
      for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; const y = i * 256 / n; x.fillRect(0, y, 64, 256 / n + 1); }
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + rnd(0.03, 0.12) + ')'; x.fillRect(0, rnd(0, 256), 64, rnd(1, 4)); }
      return B.tex(cv);
    }
    const pianeti = [];
    function pianeta(x, y, z, r, mat, vel) { const p = new T.Mesh(new T.SphereGeometry(r, 32, 24), mat); p.position.set(x, y, z); p.castShadow = p.receiveShadow = false; p.userData.vivo = true; scene.add(p); pianeti.push([p, vel]); return p; }
    const toon = map => new T.MeshToonMaterial({ map, gradientMap: gm });
    // il gigante a strisce, a nord-ovest
    const giga = pianeta(CX - 80, -14, CZ - 120, 24, toon(texStrisce(['#e7b67a', '#d58e5c', '#f2d3a0', '#c97a52', '#e9c08c'], 14)), 0.05);
    giga.rotation.z = 0.25;
    // quello con gli anelli, a est
    const anello = pianeta(CX + 112, -12, CZ - 40, 13, toon(texStrisce(['#9ec7e8', '#b9d8ef', '#88b2dc', '#cfe4f5'], 9)), 0.08);
    {
      const [cv, x] = B.tela(256, 4);
      const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(240,220,190,0)'); g.addColorStop(0.15, 'rgba(240,220,190,.75)'); g.addColorStop(0.45, 'rgba(210,180,150,.45)'); g.addColorStop(0.55, 'rgba(240,220,190,.85)'); g.addColorStop(1, 'rgba(240,220,190,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 4);
      const ge = new T.RingGeometry(16, 28, 64, 1), uv = ge.attributes.uv, p = ge.attributes.position;
      for (let i = 0; i < uv.count; i++) { const rr = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (rr - 16) / 12, 0.5); }
      const ri = new T.Mesh(ge, new T.MeshBasicMaterial({ map: B.tex(cv), transparent: true, side: T.DoubleSide, depthWrite: false }));
      ri.rotation.x = -PI / 2 + 0.45; ri.rotation.y = 0.3; ri.userData.vivo = true; anello.add(ri);
    }
    // la luna piena di crateri, a sud-ovest
    {
      const [cv, x] = B.tela(256, 128); x.fillStyle = '#d9d4e6'; x.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 45; i++) { const px = rnd(0, 256), py = rnd(0, 128), r = rnd(3, 12); x.fillStyle = 'rgba(120,110,150,.35)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(px - r * 0.25, py - r * 0.25, r * 0.6, 0, 7); x.fill(); }
      pianeta(CX - 108, -20, CZ + 70, 8, toon(B.tex(cv)), 0.03);
    }
    // un piccolo pianeta rosa, lontano a sud-est
    pianeta(CX + 95, -40, CZ + 105, 10, toon(texStrisce(['#f2a5c8', '#e58ab4', '#f7c4da'], 8)), 0.06);
    anim.push((t, dt) => pianeti.forEach(q => { q[0].rotation.y = t * q[1]; }));

    /* ---------- la cometa: testa luminosa e lunga coda, attraversa il cielo sotto l'isola ---------- */
    (function cometa() {
      const g = new T.Group(); g.userData.vivo = true; scene.add(g);
      const testa = new T.Mesh(new T.SphereGeometry(2.2, 16, 12), new T.MeshBasicMaterial({ color: 0xfff6d0 })); g.add(testa);
      const [cv, x] = B.tela(64, 64), rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(255,240,190,1)'); rg.addColorStop(0.4, 'rgba(255,210,140,.45)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
      const alone = new T.Sprite(new T.SpriteMaterial({ map: B.tex(cv), blending: T.AdditiveBlending, depthWrite: false })); alone.scale.set(16, 16, 1); g.add(alone);
      // coda: cono con sfumatura (piu' chiaro vicino alla testa)
      const [c2, x2] = B.tela(4, 128), lg = x2.createLinearGradient(0, 0, 0, 128);
      lg.addColorStop(0, 'rgba(160,200,255,0)'); lg.addColorStop(0.6, 'rgba(200,220,255,.35)'); lg.addColorStop(1, 'rgba(255,245,210,.9)'); x2.fillStyle = lg; x2.fillRect(0, 0, 4, 128);
      const coda = new T.Mesh(new T.ConeGeometry(4.5, 60, 20, 1, true), new T.MeshBasicMaterial({ map: B.tex(c2), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      coda.rotation.z = -PI / 2; coda.position.x = -30; g.add(coda);   // la coda resta dietro alla testa (asse -x del gruppo)
      const v = new T.Vector3(), d = new T.Vector3();
      anim.push(t => {
        // giro lento su un'ellisse inclinata attorno all'isola (un giro ogni 3 minuti)
        const a = t * 0.035, pos = an => v.set(CX + Math.cos(an) * 128, -40 + Math.sin(an * 2) * 18, CZ + Math.sin(an) * 115);
        pos(a); g.position.copy(v); pos(a + 0.01); d.copy(v).sub(g.position).normalize();
        g.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), d);
      });
    })();

    /* ---------- asteroidi che girano attorno all'isola ---------- */
    const asteroidi = [];
    for (let i = 0; i < 22; i++) {
      const ge = new T.DodecahedronGeometry(rnd(1.2, 3.4), 0), p = ge.attributes.position;
      for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * rnd(0.8, 1.2), p.getY(k) * rnd(0.7, 1.1), p.getZ(k) * rnd(0.8, 1.2));
      ge.computeVertexNormals();
      const a = mesh(ge, M(roccia[i % 3]), { l: 0.05, cast: false }); a.userData.vivo = true; scene.add(a);
      asteroidi.push({ m: a, r: rnd(78, 100), an: rnd(0, PI * 2), v: rnd(0.01, 0.03) * (i % 2 ? 1 : -1), y: rnd(-28, -6), f: rnd(0, 6), rot: rnd(0.2, 0.6) });
    }
    anim.push(t => asteroidi.forEach(q => {
      const an = q.an + t * q.v; q.m.position.set(CX + Math.cos(an) * q.r, q.y + Math.sin(t * 0.5 + q.f) * 1.2, CZ + Math.sin(an) * q.r * 0.9);
      q.m.rotation.set(t * q.rot * 0.7, t * q.rot, 0);
    }));

    /* ---------- stelle cadenti: una ogni tanto, veloce ---------- */
    (function cadenti() {
      const [cv, x] = B.tela(128, 4), lg = x.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(255,250,220,1)'); x.fillStyle = lg; x.fillRect(0, 0, 128, 4);
      const s = new T.Mesh(new T.PlaneGeometry(18, 0.45), new T.MeshBasicMaterial({ map: B.tex(cv), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      s.userData.vivo = true; s.visible = false; scene.add(s);
      let fine = 0, da = new T.Vector3(), dir = new T.Vector3();
      anim.push((t) => {
        if (t > fine + 5) {   // ne parte una nuova
          fine = t + 1.1; const an = Math.random() * PI * 2, r = 105 + Math.random() * 30;
          da.set(CX + Math.cos(an) * r, -15 - Math.random() * 40, CZ + Math.sin(an) * r);
          dir.set(-Math.sin(an) + (Math.random() - 0.5), -0.35, Math.cos(an) + (Math.random() - 0.5)).normalize();
          s.rotation.set(0, -Math.atan2(dir.z, dir.x), Math.asin(dir.y));
        }
        const k = 1.1 - (fine - t);
        s.visible = k >= 0 && k <= 1.1;
        if (s.visible) { s.position.copy(da).addScaledVector(dir, k * 60); s.material.opacity = Math.sin(Math.min(1, k / 1.1) * PI); }
      });
    })();
  };

  /* ---------- per la minimappa: le mura attorno alla piazza ---------- */
  B.Mura = {
    MURA,
    mappa(c) {
      const m = MURA, sp = m.sp;
      c.fillStyle = '#9a8a82'; c.fillRect(m.o - sp, m.n - sp, m.e - m.o + sp * 2, m.s - m.n + sp * 2);
    }
  };
})();
