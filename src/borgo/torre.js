/* =====================================================================
   THE BORG - LA TORRE DELLA COMETA: un grattacielo futuristico di 15 piani
   Fuori: vetro blu con le finestre che si accendono la sera, fasce di luce
   agli spigoli, un ascensore panoramico che sale e scende sulla facciata sud,
   la corona luminosa in cima e sul tetto il telescopio con l'antenna.
   Dentro: torre0 = ingresso, torre1..torre15 = i piani. Si sale e si scende
   con l'ASCENSORE (in ogni piano, sulla parete nord a destra, e sul tetto):
   si sceglie il piano dal pannello. I piani senza negozio sono tutti uguali
   e usano un solo gruppo three.js (meno lavoro per il telefono): cambiano
   solo il numero del piano sull'insegna e sul display dell'ascensore.
   Il tetto ("tetto") e' una stanza della piazza stessa: si e' davvero in cima
   alla torre, si vede il borgo e gli amici in piazza vedono chi c'e' lassu'.
   Il telescopio (B3.Telescopio) apre una visuale da trascinare, con lo zoom,
   per guardare il borgo di sotto e il cosmo; dice cosa si sta guardando.
   I NEGOZI: ogni piano 1..15 puo' ospitare un negozio. Si dichiarano in
   src/borgo/torre-negozi.js (B3.TORRE_NEGOZI): con un negozio il piano ha
   insegna, bancone con cassa, scaffali e tavoli da vetrina, e il bancone
   apre il negozio; senza, e' uno "spazio libero".
   Anche gli agenti IA usano l'ascensore (agenti/motore.mjs, STANZE): stessi
   punti (B3.TORRE.ascensore) e stessi piani.
   Usato da piazza.js (B3.costruisciTorreEsterna) e programma-principale.js
   (B3.costruisciPianoTorre, B3.TettoTorre, B3.Ascensore).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;

  // dove sta e quanto e' grande (in piazza). piani = livelli: 0 ingresso, 1..15 piani
  const TORRE = { x: -47.6, z: 26, w: 11, piano: 3.6, piani: 16 };
  TORRE.base = 0.9;                                    // zoccolo
  TORRE.hCorpo = TORRE.base + TORRE.piano * TORRE.piani; // 58,5 m
  TORRE.lt = TORRE.w + 0.9;                            // lato della corona (sporge un po')
  TORRE.h = TORRE.hCorpo + 0.5;                        // altezza del pavimento del tetto
  TORRE.mezzo = TORRE.lt / 2 - 0.62;                   // fin dove si cammina sul tetto (dal centro)
  const NOME = 'Torre della Cometa';
  const nomePiano = n => (n ? n + '° piano' : 'Ingresso');
  B.TORRE = TORRE;
  // i negozi dei piani (src/borgo/torre-negozi.js): null = spazio libero
  const negozio = n => (n > 0 && B.TORRE_NEGOZI && B.TORRE_NEGOZI[n]) || null;
  B.nomePianoTorre = n => NOME + ' · ' + nomePiano(n) + (negozio(n) ? ' · ' + negozio(n).nome : '');
  B.negozioTorre = negozio;
  const elencoNegozi = () => { const l = []; for (let n = 1; n < TORRE.piani; n++) if (negozio(n)) l.push(n + '° · ' + negozio(n).nome); return l; };
  // le sale dentro la torre (uguali a ogni piano)
  const X = 8.5, Z0 = -7.5, Z1 = 7.5;
  const AREA = { x0: -X + 0.7, x1: X - 0.7, z0: Z0 + 0.8, z1: Z1 - 0.6 };
  // l'ascensore: porte sulla parete nord, a destra. "arrivo" = dove esci dalla cabina
  const ASC = { x: 5.4, z: Z0 + 1.5, arrivo: { x: 5.4, z: Z0 + 3.0, yaw: PI } };
  TORRE.ascensore = ASC;

  const vetroBlu = '#2c4a7a', metallo = '#c9d2e3', metalloScuro = '#3a4260', ciano = '#7fe3ff', oro = '#f2c76e';
  const tela = (w, h, fn) => { const [cv, x] = B.tela(w, h); fn(x, w, h); return B.tex(cv); };
  function scritta(testo, w, h, opz) {
    opz = opz || {};
    return tela(512, Math.round(512 * h / w), (x, W, H) => disegnaScritta(x, W, H, testo, opz));
  }
  function disegnaScritta(x, W, H, testo, opz) {
    x.clearRect(0, 0, W, H);
    B.rr(x, 4, 4, W - 8, H - 8, opz.raggio == null ? 22 : opz.raggio); x.fillStyle = opz.fondo || '#141a33'; x.fill(); x.lineWidth = 8; x.strokeStyle = opz.bordo || ciano; x.stroke();
    x.fillStyle = opz.colore || '#e8f6ff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const righe = String(testo).split('\n'), fs = opz.fs || Math.min(70, (H - 30) / righe.length * 0.8);
    x.font = 'bold ' + fs + 'px "Trebuchet MS", system-ui, sans-serif';
    if (opz.alone) { x.shadowColor = opz.alone; x.shadowBlur = 18; }
    righe.forEach((r, i) => x.fillText(r, W / 2, H / 2 + (i - (righe.length - 1) / 2) * fs * 1.2));
    x.shadowBlur = 0;
  }
  // una scritta che si puo' cambiare dopo (il numero del piano sui piani condivisi)
  function scrittaViva(w, h, opz) {
    const [cv, x] = B.tela(512, Math.round(512 * h / w)), t = B.tex(cv);
    return { tex: t, scrivi: testo => { disegnaScritta(x, cv.width, cv.height, testo, opz); t.needsUpdate = true; } };
  }

  /* ---------- texture della facciata: tutta la parete, un piano per riga; la sera si accendono finestre a caso ---------- */
  const RIGHE = TORRE.piani - 1, COLONNE = 4;
  const accesa = (r, c) => ((r * 31 + c * 17 + r * c * 7) % 11) < 5;      // sempre le stesse, ma sparse
  function texFacciata(luci) {
    return tela(256, 64 * RIGHE, (x, w, h) => {
      x.fillStyle = luci ? '#000000' : '#1c2742'; x.fillRect(0, 0, w, h);
      const cw = w / COLONNE, rh = h / RIGHE;
      for (let r = 0; r < RIGHE; r++) for (let c = 0; c < COLONNE; c++) {
        const px = c * cw + 5, pw = cw - 10, py = r * rh + 7, ph = rh - 16;
        if (luci) { if (accesa(r, c)) { x.fillStyle = (r + c) % 3 ? '#ffcf73' : '#a8e4ff'; x.fillRect(px + 3, py + 3, pw - 6, ph - 6); } continue; }
        const gr = x.createLinearGradient(px, py, px + pw, py + ph); gr.addColorStop(0, '#5f8fc8'); gr.addColorStop(0.55, '#2c4a7a'); gr.addColorStop(1, '#3d68a0');
        x.fillStyle = gr; x.fillRect(px, py, pw, ph);
        x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.moveTo(px, py + ph * 0.7); x.lineTo(px + pw * 0.35, py); x.lineTo(px + pw * 0.55, py); x.lineTo(px, py + ph); x.fill();
      }
      if (!luci) { x.fillStyle = '#c9d2e3'; for (let r = 0; r < RIGHE; r++) x.fillRect(0, r * rh + rh - 5, w, 5); }
    });
  }

  /* =================================================================
     FUORI, IN PIAZZA
     ================================================================= */
  B.costruisciTorreEsterna = function (scene, o) {
    const { anim, ostacoli, porte, edifici } = o;
    const gm = M('#ffffff').gradientMap;
    const W = TORRE.w, P = TORRE.piano, HB = TORRE.base, HC = TORRE.hCorpo, LT = TORRE.lt, H = TORRE.h;
    const g = new T.Group(); g.position.set(TORRE.x, 0, TORRE.z); scene.add(g);
    const box = (w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const neon = B.Mluce(ciano, 1.1);

    box(W + 0.9, HB, W + 0.9, metalloScuro, 0, HB / 2, 0, 0.04);                 // zoccolo
    // l'atrio (piano terra): vetrate chiare
    const yL = HB + P;
    box(W - 0.3, P, W - 0.3, B.Mluce('#a8dcf5', 0.45), 0, HB + P / 2, 0, 0.03);
    for (let k = -2; k <= 2; k++) [0, 1, 2, 3].forEach(l => { const a = l * PI / 2, d = W / 2 - 0.1, px = k * W / 5; box(0.22, P, 0.22, metallo, Math.cos(a) * px + Math.sin(a) * d, HB + P / 2, -Math.sin(a) * px + Math.cos(a) * d, 0.01); });
    // il fusto: vetro blu, un piano per riga di finestre (la sera si accendono)
    const fusto = new T.MeshToonMaterial({ map: texFacciata(false), emissiveMap: texFacciata(true), emissive: new T.Color('#9a8a66'), emissiveIntensity: 0.3, gradientMap: gm });
    B.finestreMat.push(fusto);
    box(W, HC - yL, W, fusto, 0, yL + (HC - yL) / 2, 0, 0.04);
    // fasce dei piani e lame verticali
    for (let n = 1; n <= TORRE.piani; n++) box(W + 0.22, 0.16, W + 0.22, n === 1 ? metallo : '#aeb8cc', 0, HB + n * P, 0, 0.008);
    [0, 1, 2, 3].forEach(l => {
      const f = new T.Group(); f.rotation.y = l * PI / 2; g.add(f);
      [-1, 1].forEach(s => f.add(mesh(new T.BoxGeometry(0.16, HC - yL, 0.5), M(metallo), { x: s * W / 6, y: yL + (HC - yL) / 2, z: W / 2 + 0.2, lb: 0.008 })));
    });
    // spigoli di luce
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => box(0.22, HC - HB, 0.22, neon, c[0] * (W / 2 + 0.02), HB + (HC - HB) / 2, c[1] * (W / 2 + 0.02), 0));

    // ingresso sul lato est (verso la piazza): porte scorrevoli di vetro, pensilina, insegna al neon
    {
      const f = new T.Group(); f.rotation.y = PI / 2; g.add(f);
      const z = W / 2 + 0.02;
      f.add(mesh(new T.BoxGeometry(3.0, 3.0, 0.16), M(metallo), { y: HB + 1.5, z, lb: 0.012 }));
      [-1, 1].forEach(s => f.add(mesh(new T.BoxGeometry(1.25, 2.7, 0.08), B.Mluce('#8fd3f0', 0.35), { x: s * 0.65, y: HB + 1.35, z: z + 0.1, lb: 0.008 })));
      f.add(mesh(new T.BoxGeometry(0.05, 2.7, 0.1), neon, { y: HB + 1.35, z: z + 0.15, cast: false }));
      // pensilina e insegna
      f.add(mesh(new T.BoxGeometry(4.6, 0.18, 2.2), M(metalloScuro), { y: HB + 3.15, z: z + 1.0, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(4.62, 0.06, 0.06), neon, { y: HB + 3.05, z: z + 2.1, cast: false }));
      const ins = new T.Mesh(new T.PlaneGeometry(4.2, 0.7), new T.MeshBasicMaterial({ map: scritta('TORRE DELLA COMETA', 4.2, 0.7, { fs: 56, fondo: '#0f1430', bordo: ciano, colore: '#e8f6ff', alone: ciano }) }));
      ins.position.set(0, HB + 3.75, z + 0.05); f.add(ins);
      // gradini e rampa
      f.add(mesh(new T.BoxGeometry(3.4, 0.3, 1.2), M(metallo), { y: 0.75, z: z + 0.5, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(3.8, 0.3, 1.6), M('#aeb8cc'), { y: 0.45, z: z + 0.7, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(4.2, 0.3, 2.0), M(metallo), { y: 0.15, z: z + 0.9, lb: 0.012 }));
      // totem con i piani (a destra) e paletti luminosi
      f.add(mesh(new T.BoxGeometry(1.6, 2.4, 0.3), M(metalloScuro), { x: 3.4, y: 1.2, z: z + 0.6, lb: 0.012 }));
      const negozi = elencoNegozi();
      const tot = new T.Mesh(new T.PlaneGeometry(1.4, 2.1), new T.MeshBasicMaterial({ map: scritta('15 PIANI\n+ TETTO 🔭\n\nASCENSORE\n' + (negozi.length ? negozi.slice(0, 4).join('\n') : 'negozi in arrivo'), 1.4, 2.1, { fs: 30, fondo: '#141a33', bordo: oro }) }));
      tot.position.set(3.4, 1.25, z + 0.76); f.add(tot);
      [-1, 1].forEach(s => { f.add(mesh(new T.CylinderGeometry(0.08, 0.1, 0.9, 10), M(metalloScuro), { x: s * 2.3, y: 0.45, z: z + 2.2, l: 0.008 })); f.add(mesh(new T.CylinderGeometry(0.09, 0.09, 0.12, 10), neon, { x: s * 2.3, y: 0.95, z: z + 2.2, cast: false })); });
    }
    // l'ascensore panoramico sulla facciata sud: la cabina sale e scende davvero
    {
      const zf = W / 2 + 0.75, h0 = yL + 0.3, h1 = HC - 3.0;
      [-1, 1].forEach(s => box(0.14, HC - yL, 0.14, metallo, s * 1.0, yL + (HC - yL) / 2, zf - 0.45, 0.008));
      const cab = new T.Group(); cab.position.set(0, h0, zf); cab.userData.vivo = true; g.add(cab);
      cab.add(mesh(new T.BoxGeometry(1.7, 0.16, 1.4), M(metallo), { y: 0, lb: 0.01 }));
      cab.add(mesh(new T.BoxGeometry(1.7, 0.16, 1.4), M(metallo), { y: 2.3, lb: 0.01 }));
      cab.add(mesh(new T.BoxGeometry(1.6, 2.15, 1.3), B.Mluce('#9fe6ff', 0.55), { y: 1.15, cast: false }));
      cab.add(mesh(new T.BoxGeometry(1.74, 0.07, 1.44), neon, { y: 2.42, cast: false }));
      cab.traverse(c => { c.userData.vivo = true; });
      anim.push(t => {
        // su in 25 s, sosta, giu' in 25 s, sosta
        const ciclo = 60, u = (t % ciclo) / ciclo, k = u < 0.42 ? u / 0.42 : u < 0.5 ? 1 : u < 0.92 ? 1 - (u - 0.5) / 0.42 : 0;
        const e = k * k * (3 - 2 * k); cab.position.y = h0 + (h1 - h0) * e;
      });
    }
    // la corona in cima, con la fascia di luce
    box(LT, 0.5, LT, metalloScuro, 0, HC + 0.25, 0, 0.03);
    box(LT + 0.06, 0.12, LT + 0.06, neon, 0, HC + 0.22, 0, 0);
    // tetto: pavimento, parapetto di vetro con il corrimano
    const tPav = tela(128, 128, (x, w, h) => { x.fillStyle = '#5c6684'; x.fillRect(0, 0, w, h); x.strokeStyle = '#7a86a8'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); } });
    tPav.wrapS = tPav.wrapT = T.RepeatWrapping; tPav.repeat.set(3, 3);
    const pav = new T.Mesh(new T.PlaneGeometry(LT - 0.1, LT - 0.1), new T.MeshToonMaterial({ map: tPav, gradientMap: gm })); pav.rotation.x = -PI / 2; pav.position.y = H + 0.005; pav.receiveShadow = true; g.add(pav);
    const vetroP = new T.MeshToonMaterial({ color: new T.Color('#bfefff'), gradientMap: gm, transparent: true, opacity: 0.35, depthWrite: false });
    [0, 1, 2, 3].forEach(l => {
      const f = new T.Group(); f.rotation.y = l * PI / 2; g.add(f);
      f.add(mesh(new T.BoxGeometry(LT, 1.0, 0.08), vetroP, { y: H + 0.5, z: LT / 2 - 0.12, cast: false, recv: false }));
      f.add(mesh(new T.BoxGeometry(LT, 0.08, 0.16), M(metallo), { y: H + 1.04, z: LT / 2 - 0.12, lb: 0.008 }));
      f.add(mesh(new T.BoxGeometry(LT, 0.06, 0.06), neon, { y: H + 0.04, z: LT / 2 - 0.2, cast: false }));
    });
    // la cabina dell'ascensore sul tetto (angolo sud-ovest), porte verso est
    const bx = -TORRE.mezzo + 1.1, bz = TORRE.mezzo - 1.1;
    {
      box(1.6, 0.12, 1.6, metallo, bx, H + 0.06, bz, 0.01); box(1.7, 0.16, 1.7, metallo, bx, H + 2.5, bz, 0.01);
      box(1.5, 2.3, 1.5, B.Mluce('#9fe6ff', 0.45), bx, H + 1.27, bz, 0.01);
      box(0.06, 2.0, 1.1, metalloScuro, bx + 0.78, H + 1.1, bz, 0.006);
      box(0.04, 2.0, 0.05, neon, bx + 0.82, H + 1.1, bz, 0);
      box(1.72, 0.06, 1.72, neon, bx, H + 2.62, bz, 0);
      const cart = new T.Mesh(new T.PlaneGeometry(1.2, 0.36), new T.MeshBasicMaterial({ map: scritta('ASCENSORE', 1.2, 0.36, { fs: 70, fondo: '#141a33' }) }));
      cart.position.set(bx + 0.86, H + 2.3, bz); cart.rotation.y = PI / 2; g.add(cart);
    }
    // antenna con la luce rossa che lampeggia (angolo nord-ovest)
    const px = -TORRE.mezzo + 0.5, pz = -TORRE.mezzo + 0.5;
    g.add(mesh(new T.CylinderGeometry(0.05, 0.12, 7.0, 8), M(metallo), { x: px, y: H + 3.5, z: pz, l: 0.01 }));
    [1.6, 3.2, 4.8].forEach(y => g.add(mesh(new T.TorusGeometry(0.22 - y * 0.02, 0.025, 6, 16), M(metallo), { x: px, y: H + y, z: pz, cast: false }).rotateX(PI / 2)));
    const rossa = new T.MeshBasicMaterial({ color: 0xff3a3a }), punta = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), rossa); punta.position.set(px, H + 7.1, pz); punta.userData.vivo = true; g.add(punta);
    anim.push(t => { const on = (t % 1.6) < 0.5; rossa.color.setHex(on ? 0xff3a3a : 0x5a1a1a); });
    // lampioni al neon agli angoli del tetto
    [[1, 1], [1, -1]].forEach(c => { const lx = c[0] * (LT / 2 - 0.45), lz = c[1] * (LT / 2 - 0.45); g.add(mesh(new T.CylinderGeometry(0.05, 0.07, 1.8, 8), M(metalloScuro), { x: lx, y: H + 0.9, z: lz, l: 0.008 })); g.add(mesh(new T.CylinderGeometry(0.16, 0.16, 0.12, 12), neon, { x: lx, y: H + 1.85, z: lz, cast: false })); });
    // il telescopio: treppiede e tubo d'ottone (il tubo segue lo sguardo quando lo si usa)
    const tx = 0.9, tz = -0.6;
    const tel = new T.Group(); tel.position.set(tx, H, tz); g.add(tel);
    [0, 1, 2].forEach(i => { const a = i / 3 * PI * 2, gb = mesh(new T.CylinderGeometry(0.035, 0.05, 1.5, 6), M(metalloScuro), { l: 0.008 }); gb.position.set(Math.cos(a) * 0.32, 0.7, Math.sin(a) * 0.32); gb.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); tel.add(gb); });
    const testa = new T.Group(); testa.position.y = 1.45; testa.rotation.order = 'YXZ'; testa.rotation.y = -PI / 2; testa.rotation.x = 0.35; testa.userData.vivo = true; tel.add(testa);
    const tubo = mesh(new T.CylinderGeometry(0.13, 0.17, 1.7, 14), M('#c8923a'), { l: 0.012 }); tubo.rotation.x = PI / 2; tubo.position.z = -0.35; testa.add(tubo);
    testa.add(mesh(new T.CylinderGeometry(0.2, 0.2, 0.14, 14), M('#8a5a25'), { z: -1.2, l: 0.01 }).rotateX(PI / 2));
    testa.add(mesh(new T.CylinderGeometry(0.06, 0.06, 0.3, 8), M('#2c2431'), { z: 0.6, l: 0.008 }).rotateX(PI / 2));
    testa.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.6, 6), M('#8a5a25'), { y: 0.18, z: -0.2, l: 0.006 }).rotateX(PI / 2));
    B.Telescopio.testa = testa;
    // un'aura che invita a usarlo
    const aura = new T.Mesh(new T.RingGeometry(0.7, 0.95, 28), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.4, depthWrite: false })); aura.rotation.x = -PI / 2; aura.position.set(tx, H + 0.02, tz); aura.userData.vivo = true; g.add(aura);
    anim.push(t => { aura.material.opacity = 0.25 + Math.sin(t * 2.5) * 0.15; });

    const lb = W + 0.9;
    ostacoli.push({ t: 'b', x0: TORRE.x - lb / 2, x1: TORRE.x + lb / 2, z0: TORRE.z - lb / 2, z1: TORRE.z + lb / 2 });
    porte.push({ id: 'porta-torre', nome: NOME, testo: 'Entra nella Torre', x: TORRE.x + lb / 2 + 1.0, z: TORRE.z, r: 1.3, verso: 'torre0', arrivo: { x: 0, z: Z1 - 2.0, yaw: PI } });
    // alto: la piazza la rende trasparente anche da lontano quando copre la vista
    edifici.push({ g, x: TORRE.x, z: TORRE.z, w: lb, d: lb, nome: NOME, alto: true });
    return g;
  };

  /* ---------- il tetto: una stanza della piazza ---------- */
  const xT = v => TORRE.x + v, zT = v => TORRE.z + v;
  const bxT = -TORRE.mezzo + 1.1, bzT = TORRE.mezzo - 1.1;   // la cabina dell'ascensore sul tetto
  B.TettoTorre = {
    nome: 'In cima alla Torre',
    alt: () => TORRE.h,
    area: (x, z) => Math.abs(x - TORRE.x) < TORRE.mezzo && Math.abs(z - TORRE.z) < TORRE.mezzo,
    spawn: { x: xT(bxT + 1.3), z: zT(bzT), yaw: PI / 2 },
    ostacoli: [
      { t: 'c', x: xT(0.9), z: zT(-0.6), r: 0.5 },                                                      // telescopio
      { t: 'c', x: xT(-TORRE.mezzo + 0.5), z: zT(-TORRE.mezzo + 0.5), r: 0.25 },                        // antenna
      { t: 'b', x0: xT(bxT - 0.85), x1: xT(bxT + 0.85), z0: zT(bzT - 0.85), z1: zT(bzT + 0.85) }        // cabina dell'ascensore
    ],
    porte: [
      { id: 'ascensore', nome: 'Ascensore', testo: 'Prendi l\'ascensore', x: xT(bxT + 1.25), z: zT(bzT), r: 1.0, fn: () => B.Ascensore.apri() },
      { id: 'telescopio', nome: 'Telescopio', testo: 'Guarda nel telescopio', x: xT(0.9), z: zT(-0.6), r: 1.35, fn: () => B.Telescopio.apri() }
    ]
  };
  TORRE.ascensoreTetto = { x: xT(bxT + 1.25), z: zT(bzT) };

  /* =================================================================
     L'ASCENSORE: un pannello con tutti i piani
     ================================================================= */
  const Asc = B.Ascensore = { el: null };
  function pannello() {
    if (Asc.el) return Asc.el;
    const el = Asc.el = document.createElement('div'); el.id = 'ascensore';
    el.style.cssText = 'position:absolute;inset:0;z-index:85;display:none;align-items:center;justify-content:center;background:rgba(8,10,24,.55);font-family:system-ui,sans-serif';
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    el.addEventListener('click', e => { if (e.target === el) Asc.chiudi(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && el.style.display !== 'none') Asc.chiudi(); });
    (document.getElementById('app') || document.body).appendChild(el);
    return el;
  }
  Asc.apri = function () {
    const app = B.app; if (!app) return;
    const qui = app.stanza().id, el = pannello();
    const voci = [{ id: 'tetto', testo: 'Tetto · telescopio 🔭' }];
    for (let n = TORRE.piani - 1; n >= 0; n--) voci.push({ id: 'torre' + n, testo: (n ? n + '°' + (negozio(n) ? ' piano' : '') : 'Ingresso · piazza') + (negozio(n) ? ' · ' + negozio(n).nome : '') });
    el.innerHTML = '<div style="width:min(90vw,340px);max-height:82vh;display:flex;flex-direction:column;background:#141a33;border:2px solid ' + ciano + ';border-radius:18px;box-shadow:0 0 24px rgba(127,227,255,.35);color:#e8f6ff;padding:14px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><b style="font-size:18px">🛗 Ascensore</b><button data-chiudi aria-label="Chiudi" style="background:none;border:0;color:#e8f6ff;font-size:24px;cursor:pointer">×</button></div>' +
      '<div style="overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px">' + voci.map(v => {
        const io = v.id === qui, largo = v.id === 'tetto' || v.id === 'torre0' || negozio(+v.id.slice(5));
        return '<button data-p="' + v.id + '"' + (largo ? ' data-largo' : '') + (io ? ' disabled' : '') + ' style="text-align:left;padding:11px 14px;border-radius:12px;border:1px solid ' + (io ? oro : '#3a4a7a') + ';background:' + (io ? '#2a3156' : '#1d2547') + ';color:' + (io ? oro : '#e8f6ff') + ';font-size:15px;font-weight:600;cursor:' + (io ? 'default' : 'pointer') + (largo ? ';grid-column:1 / -1' : '') + '">' + v.testo + (io ? ' · qui' : '') + '</button>';
      }).join('') + '</div></div>';
    el.querySelector('[data-chiudi]').addEventListener('click', Asc.chiudi);
    el.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => Asc.vai(b.dataset.p)));
    el.style.display = 'flex';
  };
  Asc.chiudi = function () { if (Asc.el) Asc.el.style.display = 'none'; };
  Asc.vai = function (id) {
    const app = B.app; Asc.chiudi(); if (!app || !app.stanze[id]) return;
    const arrivo = id === 'tetto' ? B.TettoTorre.spawn : ASC.arrivo;
    const G = app.G || window.Gioco;
    G.emetti('transizione', () => { app.entraStanza(id, arrivo); G.emetti('toast', '🛗 Ding! ' + (id === 'tetto' ? 'Tetto della Torre' : nomePiano(+id.slice(5)))); });
  };

  /* =================================================================
     DENTRO: un piano della torre (n = 0 ingresso, 1..15 piani).
     condiviso = true: lo stesso gruppo serve a tutti i piani senza negozio
     (alPiano(n) cambia il numero sull'insegna e sul display).
     ================================================================= */
  B.costruisciPianoTorre = function (scena, n, condiviso) {
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), typeof col === 'string' ? M(col) : col, { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const muroCol = n === 0 ? '#e4e9f2' : '#dfe5ef';
    const neon = B.Mluce(ciano, 0.9);

    const neg = condiviso ? null : negozio(n);
    /* ---------- base sospesa e pavimento lucido ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.6, 1.0, Z1 - Z0 + 0.6), M('#3a4260'), { y: -0.51, z: (Z0 + Z1) / 2, lb: 0.05 }));
    for (let i = 0; i < 10; i++) { const c = mesh(new T.ConeGeometry(1.0 + (i % 3) * 0.5, 2.0 + (i % 4) * 0.6, 7), M('#2c3350'), { x: -X + 1.5 + i * (2 * X - 3) / 9, y: -2.0 - (i % 2) * 0.4, z: Z0 + 2 + (i * 37 % 11), cast: false }); c.rotation.x = PI; scena.add(c); }
    const cri = new T.Mesh(new T.OctahedronGeometry(0.6, 0), new T.MeshBasicMaterial({ color: ciano })); cri.scale.y = 2; cri.position.set(3, -3.4, 2); cri.rotation.x = PI; scena.add(cri);
    const tPav = tela(256, 256, (x, w, h) => {
      x.fillStyle = n === 0 ? '#3a4466' : '#323b5a'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
      x.strokeStyle = 'rgba(127,227,255,.35)'; x.lineWidth = 3; x.strokeRect(1, 1, w - 2, h - 2); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    });
    tPav.wrapS = tPav.wrapT = T.RepeatWrapping; tPav.repeat.set(2 * X / 3, (Z1 - Z0) / 3);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPav, gradientMap: gm })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, (Z0 + Z1) / 2); pav.receiveShadow = true; scena.add(pav);

    /* ---------- pareti (nord, ovest, est): pannelli chiari, grandi vetrate, strisce di luce ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function vetrata(g, x, w) {
      scatola(g, w + 0.24, 2.9, 0.1, metallo, x, 1.95, 0.03, 0.01);
      const v = new T.Mesh(new T.PlaneGeometry(w, 2.7), matVetro()); v.position.set(x, 1.95, 0.1); g.add(v);
      for (let k = 1; k < Math.round(w / 1.2); k++) scatola(g, 0.06, 2.7, 0.05, metallo, x - w / 2 + k * w / Math.round(w / 1.2), 1.95, 0.13, 0);
    }
    function parete(len, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 4, 0.5), M(muroCol), { y: 2, z: -0.25, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.12, 0.08, neon, 0, 0.12, 0.04, 0);                 // striscia di luce a terra
      scatola(g, len, 0.12, 0.08, neon, 0, 3.75, 0.04, 0);                 // e in alto
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
      return g;
    }
    let insegna = null, display = null;
    parete(2 * X + 0.7, 0, Z0, 0, [0, -1], g => {
      vetrata(g, -5.3, 3.6);
      // al centro: l'insegna del negozio, oppure il numero del piano
      if (neg) {
        scatola(g, 5.6, 1.5, 0.16, metalloScuro, 0, 3.0, 0.08, 0.015);
        const ins = new T.Mesh(new T.PlaneGeometry(5.3, 1.25), new T.MeshBasicMaterial({ map: scritta(neg.insegna || neg.nome.toUpperCase(), 5.3, 1.25, { fs: 64, fondo: neg.colore || '#141a33', bordo: neg.accento || ciano, colore: neg.testo || '#e8f6ff' }) })); ins.position.set(0, 3.0, 0.18); g.add(ins);
      } else {
        insegna = scrittaViva(3.0, 0.75, { fs: n ? 64 : 46, fondo: '#141a33', bordo: ciano, alone: ciano });
        insegna.scrivi(n ? n + '° PIANO' : 'TORRE DELLA COMETA');
        const ins = new T.Mesh(new T.PlaneGeometry(3.0, 0.75), new T.MeshBasicMaterial({ map: insegna.tex })); ins.position.set(-0.6, 3.1, 0.14); g.add(ins);
      }
      // l'ascensore: cornice d'acciaio, due porte, display con il piano e il pulsante
      const ax = ASC.x;
      scatola(g, 2.3, 3.0, 0.2, metalloScuro, ax, 1.5, 0.1, 0.015);
      [-1, 1].forEach(s => scatola(g, 0.88, 2.5, 0.08, metallo, ax + s * 0.45, 1.27, 0.24, 0.008));
      scatola(g, 0.04, 2.5, 0.1, neon, ax, 1.27, 0.26, 0);
      display = scrittaViva(0.9, 0.36, { fs: 70, fondo: '#05070f', bordo: '#05070f', colore: '#ff9a3a', raggio: 6, alone: '#ff9a3a' });
      display.scrivi(n ? String(n) : 'T');
      const dsp = new T.Mesh(new T.PlaneGeometry(0.9, 0.36), new T.MeshBasicMaterial({ map: display.tex })); dsp.position.set(ax, 2.75, 0.22); g.add(dsp);
      scatola(g, 0.2, 0.36, 0.06, metalloScuro, ax + 1.35, 1.2, 0.05, 0.006);
      const pul = new T.Mesh(new T.CircleGeometry(0.06, 14), new T.MeshBasicMaterial({ color: 0x7fe3ff })); pul.position.set(ax + 1.35, 1.25, 0.09); g.add(pul);
    });
    parete(Z1 - Z0 + 0.4, -X, (Z0 + Z1) / 2, PI / 2, [-1, 0], g => { vetrata(g, -2.6, 6.0); });
    parete(Z1 - Z0 + 0.4, X, (Z0 + Z1) / 2, -PI / 2, [1, 0], g => { vetrata(g, 2.6, 6.0); });
    // pilastri d'angolo davanti (lato sud aperto verso la camera)
    [-1, 1].forEach(s => { scatola(scena, 0.5, 4, 0.5, metallo, s * (X + 0.05), 2, Z1 - 0.1, 0.03); scatola(scena, 0.08, 3.6, 0.08, neon, s * (X - 0.22), 2, Z1 - 0.1, 0); });
    porte.push({ id: 'ascensore', nome: 'Ascensore', testo: 'Prendi l\'ascensore', x: ASC.x, z: ASC.z, r: 1.3, fn: () => B.Ascensore.apri() });
    ostBox(ASC.x, Z0 + 0.25, 2.4, 0.5);

    /* ---------- il negozio: bancone con cassa, scaffali e tavoli da vetrina ----------
       Dove sta tutto e' fisso (BANCONE, SCAFFALI, TAVOLI): il negozio dichiarato in
       torre-negozi.js ci mette la sua merce con arredo(kit). */
    const BANCONE = { x: -0.6, z: Z0 + 3.4, w: 6.0 };
    const SCAFFALI = [[-X + 0.55, -0.2], [-X + 0.55, 3.0], [X - 0.55, -0.2], [X - 0.55, 3.0]];
    const TAVOLI = [[-2.8, 3.2], [2.8, 3.2]];
    const ringhiera = () => {
      scatola(scena, 2 * X, 0.08, 0.08, metallo, 0, 1.0, Z1 - 0.15, 0.008);
      scatola(scena, 2 * X, 0.9, 0.04, new T.MeshToonMaterial({ color: new T.Color('#bfefff'), gradientMap: gm, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.5, Z1 - 0.15, 0);
    };
    if (neg) {
      const acc = neg.accento || ciano, col = neg.colore || '#141a33';
      const kit = { gruppo: scena, anim, ostacoli, scaffali: [], tavoli: [], bancone: null, T, M, mesh, B, negozio: neg, piano: n };
      // bancone a L con piano colorato, cassa e campanello
      { const g = new T.Group(); g.position.set(BANCONE.x, 0, BANCONE.z); scena.add(g);
        scatola(g, BANCONE.w, 1.0, 0.9, '#e4e9f2', 0, 0.5, 0, 0.02); scatola(g, BANCONE.w + 0.2, 0.1, 1.05, acc, 0, 1.05, 0, 0.015);
        scatola(g, 0.9, 1.0, 1.8, '#e4e9f2', -BANCONE.w / 2 + 0.45, 0.5, -0.9, 0.02); scatola(g, 1.05, 0.1, 2.0, acc, -BANCONE.w / 2 + 0.45, 1.05, -0.9, 0.015);
        scatola(g, BANCONE.w, 0.06, 0.04, neon, 0, 0.12, 0.47, 0);
        scatola(g, 0.7, 0.4, 0.5, '#3a3a48', 1.8, 1.3, -0.05, 0.01); scatola(g, 0.6, 0.2, 0.2, ciano, 1.8, 1.55, -0.25, 0.008);   // cassa
        cil(g, 0.1, 0.16, 0.12, '#c8923a', -1.2, 1.17, 0.15, 12, 0.008);                                                          // campanello
        ostBox(BANCONE.x, BANCONE.z, BANCONE.w + 0.2, 1.1); ostBox(BANCONE.x - BANCONE.w / 2 + 0.45, BANCONE.z - 0.9, 1.05, 2.0);
        kit.bancone = { x: BANCONE.x, y: 1.1, z: BANCONE.z, larg: BANCONE.w, g }; }
      // scaffali lungo le pareti: 3 ripiani ciascuno; kit.scaffali = un posto per ripiano
      SCAFFALI.forEach(q => {
        const lato = q[0] < 0 ? 1 : -1, g = new T.Group(); g.position.set(q[0], 0, q[1]); g.rotation.y = lato * PI / 2; scena.add(g);
        scatola(g, 2.6, 2.8, 0.55, metalloScuro, 0, 1.4, -0.1, 0.02);
        [0.35, 1.15, 1.95].forEach(y => { scatola(g, 2.5, 0.06, 0.55, metallo, 0, y, 0.02, 0.008); kit.scaffali.push({ x: q[0] + lato * 0.15, y: y + 0.03, z: q[1], rot: lato * PI / 2, larg: 2.4, g }); });
        scatola(g, 2.7, 0.12, 0.65, acc, 0, 2.86, -0.05, 0.01);
        ostBox(q[0], q[1], 0.8, 2.7);
      });
      // tavoli da vetrina con la tovaglia nei colori del negozio
      TAVOLI.forEach(q => {
        const g = new T.Group(); g.position.set(q[0], 0, q[1]); scena.add(g);
        scatola(g, 2.0, 0.08, 1.2, metallo, 0, 0.85, 0, 0.012); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => scatola(g, 0.08, 0.82, 0.08, metalloScuro, c[0] * 0.9, 0.41, c[1] * 0.5, 0.006));
        scatola(g, 2.1, 0.02, 1.3, col, 0, 0.9, 0, 0); scatola(g, 2.1, 0.3, 0.02, col, 0, 0.76, 0.66, 0);
        kit.tavoli.push({ x: q[0], y: 0.92, z: q[1], larg: 2.0, prof: 1.2, g });
        ostBox(q[0], q[1], 2.1, 1.3);
      });
      const tap = new T.Mesh(new T.PlaneGeometry(5, 3), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, color: new T.Color(acc), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tap.rotation.x = -PI / 2; tap.position.set(BANCONE.x, 0.012, BANCONE.z + 2.0); scena.add(tap);
      // al bancone: apre il negozio (lo fornisce torre-negozi.js)
      porte.push({ id: 'bancone', nome: neg.nome, testo: neg.azione || 'Guarda la merce', x: BANCONE.x, z: BANCONE.z + 1.6, r: 1.6,
        fn: () => { if (typeof neg.apri === 'function') neg.apri(); else if (window.Gioco) window.Gioco.emetti('toast', neg.nome + ': apre presto!'); } });
      if (typeof neg.arredo === 'function') try { neg.arredo(kit); } catch (e) { console.warn('torre: arredo del negozio', e); }
      ringhiera();
    } else if (n === 0) {
      // reception, totem con i piani, divanetti e piante
      { const g = new T.Group(); g.position.set(-2.6, 0, -2.6); scena.add(g);
        const banco = mesh(new T.CylinderGeometry(1.6, 1.6, 1.05, 24, 1, false, 0, PI), M('#e4e9f2'), { y: 0.52, l: 0.015 }); banco.rotation.y = PI / 2; g.add(banco);
        const top = mesh(new T.CylinderGeometry(1.7, 1.7, 0.08, 24, 1, false, 0, PI), neon, { y: 1.08, cast: false }); top.rotation.y = PI / 2; g.add(top);
        ostCer(-2.6, -2.6, 1.6); }
      const negozi = elencoNegozi();
      const tb = scritta('TORRE DELLA COMETA\n15 piani + tetto 🔭\nprendi l\'ascensore →' + (negozi.length ? '\n' + negozi.slice(0, 5).join('\n') : ''), 3.0, 2.2, { fs: 34, fondo: '#141a33', bordo: oro });
      const bac = new T.Group(); bac.position.set(-X + 0.35, 0, 1.6); bac.rotation.y = PI / 2; scena.add(bac);
      scatola(bac, 3.2, 2.4, 0.1, metalloScuro, 0, 2.0, 0.0, 0.015);
      const p = new T.Mesh(new T.PlaneGeometry(3.0, 2.2), new T.MeshBasicMaterial({ map: tb })); p.position.set(0, 2.0, 0.06); bac.add(p);
      [[-2.6, 3.4], [2.6, 3.4]].forEach(q => { scatola(scena, 1.8, 0.4, 0.6, '#7a86a8', q[0], 0.2, q[1], 0.012); scatola(scena, 1.8, 0.1, 0.62, ciano, q[0], 0.42, q[1], 0.008); ostBox(q[0], q[1], 1.9, 0.7);
        const st = { x: q[0], z: q[1] + 0.05, y: 0.08, yt: 0, yaw: PI }; st.azione = { sedile: st, nome: 'Siediti', testo: 'Siediti' }; sedili.push(st); });
      [[-X + 1.0, -1.2], [-X + 1.0, 4.4], [X - 1.0, 4.4]].forEach(q => { scatola(scena, 0.8, 0.7, 0.8, '#e4e9f2', q[0], 0.35, q[1], 0.015); const c = B.PM.cespuglio(n + q[1] | 0); c.position.set(q[0], 0.6, q[1]); c.scale.setScalar(1.3); scena.add(c); ostCer(q[0], q[1], 0.5); });
      // porta d'uscita (lato sud)
      const g = new T.Group(); g.position.set(0, 0, Z1 + 0.1); scena.add(g);
      [-1, 1].forEach(s => { scatola(g, 0.3, 3.2, 0.3, metallo, s * 1.1, 1.6, 0, 0.015); scatola(g, 0.06, 3.0, 0.06, neon, s * 0.95, 1.6, -0.2, 0); }); scatola(g, 2.5, 0.3, 0.3, metallo, 0, 3.2, 0, 0.015);
      const mt = new T.Mesh(new T.PlaneGeometry(1.8, 1.0), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.6); g.add(mt);
      porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 1.1, r: 1.3, verso: 'piazza', arrivo: { x: TORRE.x + (TORRE.w + 0.9) / 2 + 2.6, z: TORRE.z, yaw: PI / 2 } });
    } else {
      // spazio libero: un ologramma, il gesso luminoso dove andranno bancone, scaffali e tavoli, e un salottino alle vetrate
      const g = new T.Group(); g.position.set(0, 0, 0.8); scena.add(g);
      cil(g, 0.5, 0.6, 0.15, metalloScuro, 0, 0.075, 0, 20, 0.008);
      const ologr = new T.Mesh(new T.PlaneGeometry(1.5, 1.0), new T.MeshBasicMaterial({ map: scritta('Spazio libero\nqui aprirà\nun negozio', 1.5, 1.0, { fs: 56, fondo: 'rgba(20,40,80,.6)', bordo: ciano, alone: ciano }), transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
      ologr.position.set(0, 1.3, 0); ologr.userData.vivo = true; g.add(ologr);
      anim.push(t => { ologr.position.y = 1.3 + Math.sin(t * 1.5) * 0.06; ologr.rotation.y = Math.sin(t * 0.4) * 0.35; });
      ostCer(0, 0.8, 0.6);
      const gesso = new T.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.4 });
      const rett = (cx, cz, w, d) => { const l = (x0, z0, x1, z1) => scena.add(mesh(new T.BoxGeometry(Math.abs(x1 - x0) + 0.06, 0.01, Math.abs(z1 - z0) + 0.06), gesso, { x: (x0 + x1) / 2, y: 0.014, z: (z0 + z1) / 2, cast: false, recv: false })); l(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2); l(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2); l(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2); l(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2); };
      rett(BANCONE.x, BANCONE.z, BANCONE.w, 0.9); SCAFFALI.forEach(q => rett(q[0], q[1], 0.6, 2.6)); TAVOLI.forEach(q => rett(q[0], q[1], 2.0, 1.2));
      // salottino: pouf e piante
      [[X - 1.6, 5.4], [X - 2.9, 5.6], [-X + 1.6, 5.4]].forEach((q, i) => { cil(scena, 0.4, 0.4, 0.42, i % 2 ? '#7a86a8' : '#5c6684', q[0], 0.21, q[1], 16, 0.012); cil(scena, 0.41, 0.41, 0.05, neon, q[0], 0.44, q[1], 16, 0); ostCer(q[0], q[1], 0.45);
        const st = { x: q[0], z: q[1], y: 0.2, yt: 0, yaw: PI }; st.azione = { sedile: st, nome: 'Siediti', testo: 'Siediti' }; sedili.push(st); });
      [[-X + 2.8, 6.0]].forEach(q => { scatola(scena, 0.8, 0.7, 0.8, '#e4e9f2', q[0], 0.35, q[1], 0.015); const c = B.PM.cespuglio(7); c.position.set(q[0], 0.6, q[1]); c.scale.setScalar(1.3); scena.add(c); ostCer(q[0], q[1], 0.5); });
      ringhiera();
    }

    /* ---------- luci a soffitto ---------- */
    const lampa = B.Mluce('#e8f6ff', 0.9);
    [[-X + 0.4, -5.8], [X - 0.4, -5.8], [-X + 0.4, 1.4], [X - 0.4, 1.4], [-2.2, Z0 + 0.4], [2.2, Z0 + 0.4]].forEach(p => {
      const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
      cil(l, 0.03, 0.03, 0.6, metalloScuro, 0, 3.4, 0, 6, 0);
      const fi = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.06, 16), lampa); fi.position.y = 3.08; l.add(fi);
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
    // piani condivisi: si scrive il numero giusto quando entri
    let pianoScritto = n;
    function alPiano(k) { if (k === pianoScritto) return; pianoScritto = k; if (insegna) insegna.scrivi(k ? k + '° PIANO' : 'TORRE DELLA COMETA'); if (display) display.scrivi(k ? String(k) : 'T'); }
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, alPiano, limiti: AREA, nome: B.nomePianoTorre(n), negozio: neg, zoom: 0.62, rect: { x0: -X, x1: X, z0: Z0, z1: Z1 },
      spawn: n === 0 ? { x: 0, z: Z1 - 2.0, yaw: PI } : ASC.arrivo };
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
    const oltre = TORRE.lt / 2 + 0.8;
    cam.position.set(TORRE.x + 0.9 + fx * oltre, TORRE.h + 2.0, TORRE.z - 0.6 + fz * oltre);
    cam.rotation.order = 'YXZ'; cam.rotation.set(Tel.pitch, Tel.yaw, 0);
    cam.updateMatrixWorld();
    if (Tel.testa) { Tel.testa.rotation.y = Tel.yaw; Tel.testa.rotation.x = Tel.pitch; }
    zoomTxt.textContent = (FOV_MAX / Tel.fov).toFixed(Tel.fov > 20 ? 1 : 0) + '×';
    tEt -= dt; if (tEt <= 0) { tEt = 0.2; etichetta.textContent = '👁 ' + cosaGuardo(app); }
    return cam;
  };
})();
