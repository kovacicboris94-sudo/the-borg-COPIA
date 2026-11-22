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
   - Il negozio finito ha l'interno (src/borgo/interni.js) con il bancone dentro
     (lo disegna agenti-ia.js come gli altri): ci lavora solo il proprietario e
     tiene l'80%.
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
  // la villa: colori piu' chiari ed eleganti
  const VILLA = [
    { muro: '#f4efe6', muroSopra: '#fbf8f2', tetto: '#b5523b', persiane: '#3f6a4a', tendaB: '#2f5a7a' },
    { muro: '#f0e2c8', muroSopra: '#faf1de', tetto: '#8a3a2a', persiane: '#2f4a6a', tendaB: '#7a2f3a' },
    { muro: '#e6ece8', muroSopra: '#f6f9f7', tetto: '#4a5a6a', persiane: '#6a4a2f', tendaB: '#3f6a5a' }
  ];
  const LOTTO_D = r => r.z1 - r.z0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nomeMoneta = () => (B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight');
  const fmt = n => Number(n).toLocaleString('it-IT');
  const quando = ms => new Date(ms).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const mioNick = () => (B.AgentiIA && B.AgentiIA.mioNick ? B.AgentiIA.mioNick() : '');
  const sonoIo = c => !!(c && c.vero && mioNick() && c.nome.toLowerCase() === mioNick().toLowerCase());
  const mioLotto = () => S.dati.find(l => sonoIo(l.chi));
  const abitazione = t => t === 'casa' || t === 'villa';
  const NOME_TIPO = { casa: 'casa', villa: 'villa', negozio: 'negozio' };

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
  function chiave(l) { const p = l.progetto; return [l.chi ? l.chi.id : '', l.asta ? 'A' + l.prezzo : '', p ? p.tipo + p.nome + p.fase + p.colore + (p.insegna || '') + (p.squadra ? 's' + Math.min(1, p.squadra.length) : '') + (p.finito ? 'F' : Math.floor(p.fatte / p.ore * 20)) : '', B.Sponsor && p && p.finito && p.tipo === 'negozio' ? B.Sponsor.firma(l.id) : ''].join('|'); }

  // il cantiere a fasi, come uno vero (Boris: "si veda che si sta costruendo una vera e propria costruzione"):
  // scavo con la ruspa, getto delle fondamenta con la betoniera, muri di mattoni che salgono fila per fila,
  // la gru che porta su travi e tegole, l'imbianchino che dipinge, l'insegna coperta dal telo.
  // Restituisce la funzione che anima le macchine (gira solo quando il cantiere e' aperto).
  const texCache = {};
  function texMattoni() {
    if (texCache.m) return texCache.m;
    const [cv, x] = B.tela(128, 128); x.fillStyle = '#c9c2b4'; x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { const v = Math.random(); x.fillStyle = v < 0.33 ? '#b0563a' : v < 0.66 ? '#a44c32' : '#bb6244'; x.fillRect(c * 40 + (r % 2) * 20 + 2, r * 16 + 2, 36, 12); }
    return (texCache.m = B.tex(cv, true));
  }
  function texTelo(testo) {
    const [cv, x] = B.tela(512, 128); x.fillStyle = '#f6f2ea'; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#d8d0c0'; x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 90, 0); x.lineTo(i * 90 + 30, 128); x.stroke(); }
    x.fillStyle = '#5a4a3a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 44px sans-serif'; x.fillText(testo, 256, 64, 490);
    return B.tex(cv);
  }
  function figura(col) {
    // un operaio di Edilborgo (quando non ci sono gli abitanti veri: il gruista nella cabina, o senza dati dal borgo)
    const o = new T.Group();
    o.add(mesh(new T.CylinderGeometry(0.22, 0.26, 0.75, 10), M(col), { y: 0.75, l: 0.01 }));
    [-0.1, 0.1].forEach(dx => o.add(mesh(new T.BoxGeometry(0.12, 0.4, 0.14), M('#34405a'), { x: dx, y: 0.2, l: 0.006 })));
    o.add(mesh(new T.SphereGeometry(0.19, 12, 10), M('#f1c79a'), { y: 1.3, l: 0.008 }));
    o.add(mesh(new T.SphereGeometry(0.22, 12, 8, 0, PI * 2, 0, PI / 2), M('#ffd21c'), { y: 1.36, l: 0.008 }));
    const braccio = new T.Group(); braccio.position.set(0.28, 1.0, 0); braccio.add(mesh(new T.BoxGeometry(0.09, 0.45, 0.09), M(col), { y: -0.2, l: 0.006 }));
    braccio.add(mesh(new T.BoxGeometry(0.06, 0.06, 0.32), M('#777'), { y: -0.42, z: 0.12, l: 0.004 })); o.add(braccio);
    o.braccio = braccio; return o;
  }
  function cantiere3D(g, l, p, box, ost) {
    const geo = l.geo, r = geo.rect, e = geo.edificio, k = p.fatte / p.ore, anim = [];
    const pal = p.tipo === 'villa' ? VILLA : COLORI, c = pal[(p.colore || 0) % pal.length];
    const fase = k < 0.06 ? 'scavo' : k < 0.15 ? 'fondamenta' : k < 0.55 ? 'muri' : k < 0.8 ? 'tetto' : 'finiture';
    const x0 = e.x - e.w / 2, x1 = e.x + e.w / 2, zF = e.z - e.d / 2, zB = e.z + e.d / 2;
    // --- lo scavo: la buca e il mucchio di terra
    if (fase === 'scavo') {
      const q = k / 0.06;
      const buca = new T.Mesh(new T.PlaneGeometry(e.w * (0.5 + 0.5 * q), e.d * (0.5 + 0.5 * q)), new T.MeshToonMaterial({ color: new T.Color('#4a3626'), gradientMap: M('#fff').gradientMap, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      buca.rotation.x = -PI / 2; buca.position.set(e.x, 0.02, e.z); g.add(buca);
      const mucchio = mesh(new T.ConeGeometry(0.8 + q * 1.1, 0.5 + q * 0.9, 9), M('#7a5a3c'), { x: x1 + 0.9, y: (0.5 + q * 0.9) / 2, z: zB - 0.6, l: 0.01 }); g.add(mucchio);
    } else {
      // --- le fondamenta: la cassaforma di legno e il getto di cemento
      const qf = fase === 'fondamenta' ? (k - 0.06) / 0.09 : 1;
      box(e.w + 0.4, 0.06 + 0.26 * qf, e.d + 0.4, qf < 1 ? '#9a958c' : '#a9a39a', e.x, (0.06 + 0.26 * qf) / 2, e.z, 0.02);
      if (fase === 'fondamenta') { [[e.w + 0.6, 0.06, 0, -1], [e.w + 0.6, 0.06, 0, 1], [0.06, e.d + 0.6, -1, 0], [0.06, e.d + 0.6, 1, 0]].forEach(([w, d, sx, sz]) => box(w, 0.4, d, '#c89a5a', e.x + sx * (e.w / 2 + 0.3), 0.2, e.z + sz * (e.d / 2 + 0.3), 0.006)); }
    }
    // --- i muri: file di mattoni (e alla fine l'intonaco colorato che sale con l'imbianchino)
    const muri = Math.max(0, Math.min(1, (k - 0.15) / 0.4)), H = 4.5;
    if (muri > 0) {
      const file = Math.max(1, Math.round(muri * 18)), h = file * H / 18, fw = (e.w - 1.3) / 2;
      const pittura = fase === 'finiture' ? Math.min(1, (k - 0.8) / 0.17) : 0;
      const muro = (w, hh, d, x, y, z) => {
        const tm = texMattoni().clone(); tm.needsUpdate = true; tm.repeat.set(Math.max(w, d) / 1.2, hh / 1.2);
        const m = mesh(new T.BoxGeometry(w, hh, d), new T.MeshToonMaterial({ map: tm, gradientMap: M('#fff').gradientMap }), { x, y, z, lb: 0.02 }); g.add(m);
        if (pittura > 0) { const hp = hh * pittura; const v = mesh(new T.BoxGeometry(w + 0.04, hp, d + 0.04), M(c.muro), { x, y: y - hh / 2 + hp / 2, z, lb: 0.02 }); g.add(v); }
      };
      [-1, 1].forEach(sg => muro(fw, h, 0.25, e.x + sg * (0.65 + fw / 2), 0.32 + h / 2, zF + 0.12));
      if (h > 2.3) muro(1.3, h - 2.3, 0.25, e.x, 0.32 + 2.3 + (h - 2.3) / 2, zF + 0.12);
      muro(e.w, h, 0.25, e.x, 0.32 + h / 2, zB - 0.12);
      muro(0.25, h, e.d - 0.5, x0 + 0.12, 0.32 + h / 2, e.z);
      muro(0.25, h, e.d - 0.5, x1 - 0.12, 0.32 + h / 2, e.z);
      // le finestre: vani scuri, poi i vetri nelle finiture
      if (h > 1.6) [-1, 1].forEach(sg => { const f = new T.Mesh(new T.PlaneGeometry(1.0, 0.9), new T.MeshBasicMaterial({ color: fase === 'finiture' ? '#bfe3f0' : '#2a2420' })); f.position.set(e.x + sg * (0.65 + fw / 2), 1.6, zF - 0.02); f.rotation.y = PI; g.add(f); });
      // le impalcature
      const HS = 0.32 + h + 0.7;
      [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1]].forEach(q => box(0.07, HS, 0.07, '#9aa0a8', e.x + q[0] * (e.w / 2 + 0.5), HS / 2, e.z + q[1] * (e.d / 2 + 0.5), 0.006));
      for (let y = 1.2; y < HS; y += 1.5) { box(e.w + 1, 0.06, 0.3, '#c8a060', e.x, y, zF - 0.5, 0.006); box(e.w + 1, 0.06, 0.3, '#c8a060', e.x, y, zB + 0.5, 0.006); }
      // l'insegna, coperta da un telo fino all'apertura
      if (fase === 'finiture' && h > 3.4) { const t = new T.Mesh(new T.PlaneGeometry(2.6, 0.62), new T.MeshBasicMaterial({ map: texTelo(p.tipo === 'negozio' ? 'Prossima apertura' : 'Presto: ' + p.nome) })); t.position.set(e.x, 3.25, zF - 0.62); t.rotation.y = PI; g.add(t); }
    }
    // --- il tetto: prima le travi di legno, poi le tegole
    const tetto = Math.max(0, Math.min(1, (k - 0.55) / 0.25));
    if (tetto > 0) {
      const yT = 0.32 + H;
      const travi = Math.max(1, Math.round(Math.min(1, tetto * 2) * 7));
      const tegole = Math.max(0, (tetto - 0.5) * 2);
      if (tegole < 0.6) for (let i = 0; i < travi; i++) { const z = zF + 0.3 + i * (e.d - 0.6) / 6; box(e.w + 0.4, 0.14, 0.14, '#8a5a35', e.x, yT + 0.75, z, 0.006); }
      if (tegole < 0.6) { box(0.16, 1.5, 0.16, '#8a5a35', e.x, yT + 0.75, zF + 0.3, 0.006); box(0.16, 1.5, 0.16, '#8a5a35', e.x, yT + 0.75, zB - 0.3, 0.006); }
      if (tegole > 0) {
        const cono = mesh(new T.ConeGeometry(Math.hypot(e.w, e.d) / 2 + 0.3, 1.6, 4, 1, true), M(c.tetto), { x: e.x, y: yT + 0.8, z: e.z, l: 0.02 });
        cono.rotation.y = PI / 4; cono.scale.set(e.w / Math.hypot(e.w, e.d) * 1.4, tegole, e.d / Math.hypot(e.w, e.d) * 1.4); cono.position.y = yT + 0.8 * tegole; g.add(cono);
      }
    }
    // --- le macchine
    // la ruspa: scava nello scavo, poi resta parcheggiata in un angolo
    const ruspa = new T.Group(), sc = fase === 'scavo';
    ruspa.position.set(sc ? x0 - 0.2 : r.x0 + 1.3, 0, sc ? zF - 1.4 : r.z1 - 1.6); ruspa.rotation.y = sc ? PI * 0.25 : PI * 0.5; g.add(ruspa);
    ruspa.add(mesh(new T.BoxGeometry(1.5, 0.35, 0.9), M('#3a3a3a'), { y: 0.2, lb: 0.008 }));
    const torretta = new T.Group(); torretta.position.y = 0.38; ruspa.add(torretta);
    torretta.add(mesh(new T.BoxGeometry(1.2, 0.5, 0.85), M('#f2b81c'), { y: 0.25, lb: 0.008 }));
    torretta.add(mesh(new T.BoxGeometry(0.55, 0.6, 0.7), M('#f2b81c'), { x: -0.25, y: 0.8, lb: 0.008 }));
    const vetro = new T.Mesh(new T.PlaneGeometry(0.5, 0.4), new T.MeshBasicMaterial({ color: '#9fd3e8' })); vetro.position.set(0.03, 0.85, 0); vetro.rotation.y = PI / 2; torretta.add(vetro);
    const brA = new T.Group(); brA.position.set(0.5, 0.45, 0); torretta.add(brA);
    brA.add(mesh(new T.BoxGeometry(1.3, 0.16, 0.16), M('#e0a818'), { x: 0.6, lb: 0.006 }));
    const brB = new T.Group(); brB.position.x = 1.25; brA.add(brB);
    brB.add(mesh(new T.BoxGeometry(0.14, 0.9, 0.14), M('#e0a818'), { y: -0.4, lb: 0.006 }));
    brB.add(mesh(new T.BoxGeometry(0.4, 0.25, 0.4), M('#555'), { y: -0.9, lb: 0.006 }));
    brA.rotation.z = 0.5;
    ost.push({ t: 'c', x: ruspa.position.x, z: ruspa.position.z, r: 0.9 });
    if (sc) anim.push(t => { torretta.rotation.y = Math.sin(t * 0.6) * 0.5; brA.rotation.z = 0.35 + Math.sin(t * 1.2) * 0.3; brB.rotation.z = -0.4 + Math.sin(t * 1.2 + 1) * 0.35; });
    // la betoniera che gira
    const bet = new T.Group(); bet.position.set(r.x1 - 1.0, 0, r.z0 + 2.2); g.add(bet);
    bet.add(mesh(new T.BoxGeometry(0.9, 0.35, 0.6), M('#5a5a5a'), { y: 0.25, lb: 0.006 }));
    const tamburo = mesh(new T.CylinderGeometry(0.3, 0.45, 0.8, 12), M('#e07a2a'), { y: 0.85, l: 0.01 }); tamburo.rotation.z = 0.7; bet.add(tamburo);
    anim.push((t, dt) => { tamburo.rotation.y += dt * 2.2; });
    ost.push({ t: 'c', x: bet.position.x, z: bet.position.z, r: 0.6 });
    // il bancale di mattoni: si svuota man mano che i muri salgono
    const pile = Math.max(0, Math.round((1 - muri) * 4)); box(0.9, 0.12, 0.9, '#8a6a4a', r.x1 - 1.0, 0.06, r.z0 + 4.0, 0.006);
    for (let i = 0; i < pile; i++) { const m = mesh(new T.BoxGeometry(0.8, 0.2, 0.8), new T.MeshToonMaterial({ map: texMattoni(), gradientMap: M('#fff').gradientMap }), { x: r.x1 - 1.0, y: 0.22 + i * 0.2, z: r.z0 + 4.0, lb: 0.006 }); g.add(m); }
    // la gru: arriva con i muri, porta su travi e tegole, se ne va alle finiture
    if (muri > 0.2 && fase !== 'finiture') {
      const gx = x1 + 1.1, gz = zB + 1.0, HG = 9.5;
      for (let i = 0; i < 4; i++) { const a = (i + 0.5) * PI / 2; box(0.06, HG, 0.06, '#e8c21c', gx + Math.cos(a) * 0.25, HG / 2, gz + Math.sin(a) * 0.25, 0.004); }
      for (let y = 0.8; y < HG; y += 1.2) box(0.5, 0.05, 0.5, '#e8c21c', gx, y, gz, 0.004);
      const braccio = new T.Group(); braccio.position.set(gx, HG, gz); g.add(braccio);
      braccio.add(mesh(new T.BoxGeometry(9, 0.3, 0.3), M('#f2cc22'), { x: 2.5, lb: 0.006 }));
      braccio.add(mesh(new T.BoxGeometry(1.0, 0.7, 0.6), M('#d0d0d0'), { x: -1.6, y: -0.2, lb: 0.006 }));   // il contrappeso
      const cabina = mesh(new T.BoxGeometry(0.6, 0.6, 0.6), M('#f2cc22'), { x: 0.2, y: -0.5, lb: 0.006 }); braccio.add(cabina);
      const gruista = figura('#e8781e'); gruista.scale.setScalar(0.35); gruista.position.set(0.2, -0.75, 0); braccio.add(gruista);
      const carrello = new T.Group(); carrello.position.x = 4; braccio.add(carrello);
      const cavo = mesh(new T.BoxGeometry(0.03, 1, 0.03), M('#333'), { y: -0.5, l: 0 }); carrello.add(cavo);
      const carico = new T.Group(); carrello.add(carico);
      carico.add(fase === 'tetto' ? mesh(new T.BoxGeometry(2.2, 0.14, 0.14), M('#8a5a35'), { lb: 0.006 }) : mesh(new T.BoxGeometry(0.7, 0.4, 0.7), new T.MeshToonMaterial({ map: texMattoni(), gradientMap: M('#fff').gradientMap }), { lb: 0.006 }));
      ost.push({ t: 'c', x: gx, z: gz, r: 0.45 });
      // gira tra il bancale dei mattoni e il centro dell'edificio, cala il carico e torna
      const dir = (x, z) => Math.atan2(-(z - gz), x - gx);
      const aBanc = dir(r.x1 - 1.0, r.z0 + 4.0), aCasa = dir(e.x, e.z), dBanc = Math.hypot(r.x1 - 1.0 - gx, r.z0 + 4.0 - gz), dCasa = Math.hypot(e.x - gx, e.z - gz);
      anim.push(t => {
        const c = (t % 24) / 24, s = x => x * x * (3 - 2 * x);
        let a, d, cala;
        if (c < 0.2) { a = aBanc; d = dBanc; cala = 1 - Math.abs(c - 0.1) / 0.1; }
        else if (c < 0.5) { const q = s((c - 0.2) / 0.3); a = aBanc + (aCasa - aBanc) * q; d = dBanc + (dCasa - dBanc) * q; cala = 0; }
        else if (c < 0.7) { a = aCasa; d = dCasa; cala = (1 - Math.abs(c - 0.6) / 0.1) * 0.6; }
        else { const q = s((c - 0.7) / 0.3); a = aCasa + (aBanc - aCasa) * q; d = dCasa + (dBanc - dCasa) * q; cala = 0; }
        braccio.rotation.y = a; carrello.position.x = Math.max(0.6, Math.min(6.8, d));
        const L = 2 + cala * (HG - 3); cavo.scale.y = L; cavo.position.y = -L / 2; carico.position.y = -L - 0.2;
        carico.visible = !(c > 0.62 && c < 0.7);
      });
    }
    // l'imbianchino sulla scala, alle finiture
    if (fase === 'finiture') {
      const sx = e.x - 1.6, sz = zF - 0.95;
      [-0.22, 0.22].forEach(dx => box(0.06, 2.6, 0.06, '#c8c8c8', sx + dx, 1.3, sz, 0.004));
      for (let y = 0.3; y < 2.6; y += 0.4) box(0.5, 0.04, 0.05, '#c8c8c8', sx, y, sz, 0.004);
      const im = figura('#f4f4f4'); im.position.set(sx, 1.2, sz - 0.25); im.rotation.y = 0; g.add(im);
      anim.push(t => { im.braccio.rotation.x = -1.2 + Math.sin(t * 5) * 0.5; });
    }
    ost.push({ t: 'b', x0: x0 - 0.6, x1: x1 + 0.6, z0: zF - 0.6, z1: zB + 0.6 });
    return { anim, fase };
  }

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
    if (!l.chi) { titolo = l.asta ? 'All\'asta' : 'In vendita'; sotto = fmt(l.prezzo) + ' ' + nomeMoneta() + (l.asta && p ? '\ncon ' + p.nome : '\ntocca per comprare'); col = l.asta ? '#ffd0c0' : '#fff3c4'; }
    else if (!p) { titolo = 'Terreno di ' + l.chi.nome; sotto = 'ancora vuoto'; }
    else if (!p.finito) { const fine = fineStimata(p.ore - p.fatte, Date.now()); titolo = 'Cantiere: ' + p.nome; sotto = Math.round(p.fatte / p.ore * 100) + '% · ' + (FASI[p.fase] || p.fase) + '\npronto ' + new Date(fine).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); col = '#ffe0a8'; }
    else { titolo = p.nome; sotto = NOME_TIPO[p.tipo] + ' di ' + l.chi.nome; }
    const tav = new T.Mesh(new T.PlaneGeometry(1.6, 0.8), new T.MeshBasicMaterial({ map: cartello(titolo, sotto, col) }));
    tav.position.set(cx, 1.4, cz - 0.07); tav.rotation.y = PI; g.add(tav);
    box(1.7, 0.9, 0.06, legnoS, cx, 1.4, cz);
    const tocco = new T.Mesh(new T.BoxGeometry(2, 2.2, 1.2), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.set(cx, 1.1, cz); g.add(tocco);
    ost.push({ t: 'c', x: cx, z: cz, r: 0.6 });

    const e = geo.edificio;
    let edificio = null, anim = null;
    if (p && !p.finito) {
      const cz = cantiere3D(g, l, p, box, ost);
      // senza la squadra dal borgo (servizio vecchio o non raggiungibile) lavorano tre operai di Edilborgo disegnati qui;
      // con la squadra, gli operai sono gli abitanti veri (vedi squadre() piu' sotto)
      const operai = [];
      if (!p.squadra) [[e.x - e.w / 2 - 0.9, e.z - e.d / 2 - 1.1], [e.x + 1.2, e.z - e.d / 2 - 1.3], [e.x + e.w / 2 + 0.9, e.z + 0.5]].forEach((q, i) => {
        const o = figura(i === 1 ? '#3a6ea8' : '#e8781e'); o.position.set(q[0], 0, q[1]); o.lookAt(e.x, 0, e.z); g.add(o); operai.push({ o, braccio: o.braccio, k: i * 1.7 });
        ost.push({ t: 'c', x: q[0], z: q[1], r: 0.35 });
      });
      // le macchine e gli operai lavorano solo quando il cantiere e' aperto (lun-sab 8-17, ora di Roma)
      let ultimo = -1, aperto = false;
      anim = (t, dt) => {
        if (t - ultimo > 20 || ultimo < 0) { ultimo = t; aperto = cantiereAperto(Date.now()) && (!p.squadra || p.squadra.length > 0); operai.forEach(w => { w.o.visible = aperto; }); }
        if (!aperto) return;
        cz.anim.forEach(f => f(t, dt));
        operai.forEach(w => { w.braccio.rotation.x = -0.4 + Math.sin(t * 6 + w.k) * 0.7; w.o.position.y = Math.abs(Math.sin(t * 3 + w.k)) * 0.03; });
      };
    } else if (p && p.finito && B.edificioPiazza) {
      const c = p.tipo === 'villa' ? VILLA[p.colore % VILLA.length] : COLORI[p.colore % COLORI.length];
      // la vetrina aziendale approvata (src/borgo/sponsor.js): insegna col logo e tenda nei colori dell'azienda, bandiera alla porta
      const sp = p.tipo === 'negozio' && B.Sponsor ? B.Sponsor.facciata(l.id) : null;
      edificio = B.edificioPiazza(Object.assign({ x: e.x, z: e.z, rot: PI, w: e.w, d: e.d, nome: p.nome, muro: c.muro, muroSopra: c.muroSopra, tetto: c.tetto, persiane: c.persiane, tendaA: '#f6e8cc', tendaB: c.tendaB, porta: 0, insegnaStile: p.insegna, tendaLarg: p.tipo === 'villa' ? 4.2 : 3.4 }, sp || {}));
      if (sp) { anim = B.Sponsor.bandiera(g, l.id, geo.porta.x + 2.3, geo.porta.z + 0.2); ost.push({ t: 'c', x: geo.porta.x + 2.3, z: geo.porta.z + 0.2, r: 0.2 }); }
      if (p.tipo === 'villa') {
        // la villa: piscinetta in giardino, siepi lungo il recinto, colonnine e lampioncini al vialetto
        const px = l.x - 2.1, pz = r.z0 + 2.2;
        box(2.6, 0.25, 2.0, '#e8e2d4', px, 0.12, pz, 0.012);
        const acqua = new T.Mesh(new T.PlaneGeometry(2.2, 1.6), new T.MeshToonMaterial({ color: new T.Color('#4fc3e8'), gradientMap: M('#fff').gradientMap, emissive: new T.Color('#2a8ab0'), emissiveIntensity: 0.35 }));
        acqua.rotation.x = -PI / 2; acqua.position.set(px, 0.26, pz); g.add(acqua);
        ost.push({ t: 'b', x0: px - 1.3, x1: px + 1.3, z0: pz - 1.0, z1: pz + 1.0 });
        [r.x0 + 0.35, r.x1 - 0.35].forEach(x => box(0.5, 0.8, LOTTO_D(r) - 1.2, '#4f7a3a', x, 0.4, (r.z0 + r.z1) / 2 + 0.4, 0.012));
        [-1, 1].forEach(sg => { box(0.14, 1.1, 0.14, '#3a3a3a', l.x + sg * 1.0, 0.55, r.z0 + 0.3, 0.008); const lu = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), B.Mluce ? B.Mluce('#ffd98a', 0.9) : M('#ffd98a')); lu.position.set(l.x + sg * 1.0, 1.2, r.z0 + 0.3); g.add(lu); });
      }
    }
    app.gP.add(g);
    ost.forEach(o => app.piazza.ostacoli.push(o));
    if (anim && app.piazza.anim) app.piazza.anim.push(anim);
    // la porta dell'edificio finito
    let porta = null;
    if (p && p.finito) {
      porta = { id: 'porta-' + l.id, nome: p.nome, x: geo.porta.x, z: geo.porta.z, r: 1.35, testo: !l.chi ? 'All\'asta: ' + p.nome : abitazione(p.tipo) ? (sonoIo(l.chi) ? 'Entra in casa tua' : 'Bussa a ' + p.nome) : 'Entra: ' + p.nome, fn: () => portaLotto(l.id) };
      app.piazza.porte.push(porta);
    }
    return { g, tocco, ost: ost.concat(edificio ? edificio.ost : []), edificio, porta, anim };
  }
  function smonta(v) {
    const app = S.app;
    if (v.g.parent) v.g.parent.remove(v.g);
    if (v.edificio && v.edificio.g.parent) v.edificio.g.parent.remove(v.edificio.g);
    v.ost.forEach(o => { const i = app.piazza.ostacoli.indexOf(o); if (i >= 0) app.piazza.ostacoli.splice(i, 1); });
    if (v.porta) { const i = app.piazza.porte.indexOf(v.porta); if (i >= 0) app.piazza.porte.splice(i, 1); }
    if (v.anim && app.piazza.anim) { const i = app.piazza.anim.indexOf(v.anim); if (i >= 0) app.piazza.anim.splice(i, 1); }
  }

  /* ---------- porte: la casa del lotto e le casette lasciate vuote ---------- */
  // si entra nella casa del gioco e uscendo si torna da dove si e' entrati (il lotto in piazza o il piano della Torre)
  function entraCasaDa(verso, arrivo) {
    const app = S.app, u = uscitaDi('casa');
    if (u) { if (!u.arrivoBorgo) { u.arrivoBorgo = u.arrivo; u.versoBorgo = u.verso; } u.verso = verso; u.arrivo = arrivo; S.casaDaLotto = true; }
    G.emetti('transizione', () => app.entraStanza('casa', app.stanze.casa.spawn));
  }
  function uscitaDi(stanza) { const st = S.app.stanze[stanza]; return st && (st.porte || []).find(q => q.id === 'porta-uscita'); }
  function portaLotto(id) {
    const l = S.dati.find(q => q.id === id); if (!l || !l.progetto) return;
    const p = l.progetto, app = S.app, geo = l.geo;
    if (!l.chi) return apri(id);
    // il negozio ha l'interno (src/borgo/interni.js): si entra e il bancone e' dentro
    if (p.tipo === 'negozio') {
      const sid = 'bottega_' + id, def = { nome: p.nome, tipo: B.tipoInterno ? B.tipoInterno(p.genere) : 'bottega', arredo: p.arredo, fuori: { x: geo.ritorno.x, z: geo.ritorno.z, yaw: PI } };
      let st = app.stanze[sid];
      if (!st && app.aggiungiInterno) { st = app.aggiungiInterno(sid, B.Sponsor ? B.Sponsor.defInterno(sid, def) : def); if (st && B.Sponsor) B.Sponsor.creato(sid); }
      if (st) { G.emetti('transizione', () => app.entraStanza(sid, { x: 0, z: 3.6, yaw: PI })); return; }
      const b = (B.AgentiIA && B.AgentiIA.apriBancone); if (b) b(id); return;
    }
    if (sonoIo(l.chi)) {
      // la mia casa: si entra nella casa del gioco e uscendo si torna qui
      entraCasaDa('piazza', { x: geo.ritorno.x, z: geo.ritorno.z, yaw: PI });
      return;
    }
    if (!l.chi.vero && app.stanze['casa_' + l.chi.id]) { G.emetti('transizione', () => app.entraStanza('casa_' + l.chi.id, { x: 0, z: 2.4, yaw: PI })); return; }
    G.emetti('toast', p.nome + ': è una casa privata');
  }
  // un abitante IA che si e' trasferito: la sua casetta del borgo resta vuota e l'uscita della sua stanza porta alla casa nuova
  function aggiornaTraslochi() {
    const app = S.app, mossi = {};
    S.dati.forEach(l => { if (l.chi && !l.chi.vero && l.progetto && l.progetto.finito && abitazione(l.progetto.tipo)) mossi['casa_' + l.chi.id] = { lotto: l, nome: l.chi.nome, dove: 'nella ' + l.progetto.tipo + ' nuova sul ' + l.id.replace('lotto', 'lotto '), verso: 'piazza', arrivo: { x: l.geo.ritorno.x, z: l.geo.ritorno.z, yaw: PI } }; });
    ((S.extra && S.extra.appartamenti) || []).forEach(a => { if (a.chi && !a.chi.vero) mossi['casa_' + a.chi.id] = { nome: a.chi.nome, dove: 'nell\'appartamento al ' + a.piano + '° piano della Torre', verso: a.id, arrivo: { x: -6.4, z: 1.5, yaw: PI / 2 } }; });
    (app.piazza.porte || []).forEach(p => {
      if (!p.verso || p.verso.indexOf('casa_') !== 0 || p.id.indexOf('porta-lotto') === 0) return;
      const l = mossi[p.verso];
      if (l) { if (!p.fnBorgo) { p.fnBorgo = true; p.testo0 = p.testo; p.testo = 'Casetta del borgo (vuota)'; } p.fn = () => G.emetti('toast', 'Casetta vuota: ' + l.nome + ' ora abita ' + l.dove); }
      if (!l && p.fnBorgo) { p.fnBorgo = false; p.testo = p.testo0; delete p.fn; }
    });
    Object.keys(app.stanze).filter(k => k.indexOf('casa_') === 0).forEach(k => {
      const u = uscitaDi(k); if (!u) return; if (!u.arrivoBorgo) { u.arrivoBorgo = u.arrivo; u.versoBorgo = u.verso; }
      const l = mossi[k]; u.arrivo = l ? l.arrivo : u.arrivoBorgo; u.verso = l ? l.verso : u.versoBorgo;
    });
  }

  /* ---------- dati dal servizio ---------- */
  function applica(lista, listino, app, extra) {
    S.app = app; S.dati = lista || []; if (listino) S.listino = listino; if (extra) S.extra = extra;
    if (!S.agganciato && G.su) { S.agganciato = true; G.su('stanza', e => { if (e && e.id === 'casa' && !S.casaDaLotto) { const u = uscitaDi('casa'); if (u && u.arrivoBorgo) { u.arrivo = u.arrivoBorgo; u.verso = u.versoBorgo; } } S.casaDaLotto = false; }); }
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
    if (extra && B.Banca) B.Banca.applica(extra, app);
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
      const casaMia = B.Banca && B.Banca.mioAppartamento && B.Banca.mioAppartamento();
      h += l.asta ? `<div>All'asta: la banca l'ha pignorato${l.asta.era ? ' a ' + esc(l.asta.era) : ''} e lo rivende al 70% del valore${p ? ', con sopra <b>' + esc(p.nome) + '</b>' + (p.finito ? '' : ' (cantiere fermo al ' + Math.round(p.fatte / p.ore * 100) + '%)') : ''}.</div>`
        : `<div>Un terreno recintato del borgo. Comprandolo diventa tuo: poi ci fai costruire <b>una casa</b>, <b>una villa</b> o <b>un negozio</b> dall'impresa del borgo.</div>`;
      h += `<div style="margin-top:6px">Prezzo: <b>${fmt(l.prezzo)} ${SL()}</b> · ne hai ${fmt(B.Eco ? B.Eco.coins : 0)}</div>`;
      if (L && !p) h += `<div style="opacity:.8;font-size:12px;margin-top:4px">Poi: casa ${fmt(L.progetti.casa.costo)} ${SL()} (${L.progetti.casa.ore} ore di cantiere) · villa ${fmt(L.progetti.villa.costo)} ${SL()} (${L.progetti.villa.ore} ore) · negozio ${fmt(L.progetti.negozio.costo)} ${SL()} (${L.progetti.negozio.ore} ore). Il cantiere lavora dal lunedì al sabato, dalle 8 alle 17.</div>`;
      if (haGia || casaMia) h += `<div style="margin-top:8px;opacity:.85">Hai già ${haGia ? 'un terreno (' + esc(haGia.nome) + ')' : 'un appartamento nella Torre'}: si può avere una sola proprietà.</div>`;
      else { h += btn('tr-compra', `Compra in contanti: ${fmt(l.prezzo)} ${SL()}`, true); if (B.Banca) h += btn('tr-mutuo', '🏦 Compra con il mutuo (anticipo 20%)', false); }
    } else if (!p) {
      h += `<div>Di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}. Ancora vuoto.</div>`;
      if (mio && L) h += progettista(l, L);
    } else if (!p.finito) {
      const k = Math.round(p.fatte / p.ore * 100), aperto = cantiereAperto(Date.now());
      h += `<div>Di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}: si costruisce <b>${esc(p.nome)}</b> (${NOME_TIPO[p.tipo]}${p.genere && L ? ', ' + esc(L.generi[p.genere].nome) : ''}).</div>
        ${anteprima(p, p.nome)}
        <div style="margin-top:8px;background:#1f1729;border-radius:10px;height:14px;overflow:hidden"><div style="width:${k}%;height:100%;background:#f2c76e"></div></div>
        <div style="margin-top:4px;font-size:13px">${k}% · ${esc(FASI[p.fase] || p.fase)} · ${Math.round(p.fatte)} ore fatte su ${p.ore}</div>
        <div style="margin-top:6px;font-size:15px">⏳ Pronto <b>${esc(quando(p.fine))}</b><br><span style="font-size:13px;opacity:.9">${esc(traQuanto(p.fine))} · mancano ${Math.max(0, Math.ceil(p.ore - p.fatte))} ore di lavoro</span></div>
        <div style="margin-top:4px;font-size:13px;opacity:.9">${aperto ? '👷 Gli operai stanno lavorando adesso.' : '🌙 Adesso il cantiere è chiuso: si lavora dal lunedì al sabato, dalle 8 alle 17.'} Un muratore in turno lo fa finire prima.</div>`;
      if (p.listino) h += listinoHtml(p, false);
    } else {
      h += `<div><b>${esc(p.nome)}</b>: ${({ casa: 'la casa', villa: 'la villa', negozio: 'il negozio' })[p.tipo]} di <b>${esc(l.chi.nome)}</b>${l.chi.vero ? '' : ' 🤖'}.</div>`;
      if (abitazione(p.tipo) && mio) h += btn('tr-entra', '🏠 Entra in casa', true);
      if (p.tipo === 'negozio') {
        h += anteprima(p, p.nome);
        if (p.listino) h += listinoHtml(p, mio);
        if (mio && p.listino) h += btn('tr-listino', '💾 Salva i nuovi prezzi', false);
        h += btn('tr-bancone', p.icona + (mio ? ' Entra e lavora al bancone' : ' Entra nel negozio'), true);
        const V = B.Sponsor && B.Sponsor.vetrine()[l.id];
        if (mio && B.Sponsor) h += btn('tr-vetrina', '🏢 Vetrina aziendale: il tuo marchio e il tuo sito', false);
        else if (V && V.profilo) h += btn('tr-scopri', '🏢 Scopri ' + esc(V.profilo.azienda), false);
      }
    }
    if (corpo.dataset.h === h) return;   // niente di nuovo: non si ridisegna (cosi' un tocco su un pulsante non si perde)
    corpo.dataset.h = h; corpo.innerHTML = h;
    const on = (sel, f) => { const b = corpo.querySelector(sel); if (b) b.addEventListener('click', f); };
    on('.tr-compra', () => compra(l));
    corpo.querySelectorAll('.tr-tipo').forEach(b => b.addEventListener('click', () => { S.scelta = b.dataset.t; disegna(); }));
    on('.tr-costruisci', () => costruisci(l));
    on('.tr-listino', () => salvaListino(l));
    agganciProgettista(corpo, l);
    on('.tr-mutuo', () => { const b = S.bozza; chiudi(); B.Banca.apri({ bene: l.id, tipo: b && b.tipo || 'casa', bozza: b && b.tipo ? datiBozza(b) : null }); });
    on('.tr-entra', () => { chiudi(); portaLotto(l.id); });
    on('.tr-vetrina', () => { chiudi(); B.Sponsor.editor(l.id); });
    on('.tr-scopri', () => { chiudi(); B.Sponsor.scheda(l.id); });
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
    const L = S.listino, b = S.bozza; if (!L || !b || !b.tipo) return;
    const q = L.progetti[b.tipo];
    nota('Chiamo l\'impresa...');
    const r = await paga(q.costo, Object.assign({ azione: 'costruisci' }, datiBozza(b)));
    if (!r.ok) return nota(r.motivo || 'Non si può, riprova.');
    G.emetti('toast', '🏗️ Cantiere aperto: ' + r.nome + ' · pronto ' + quando(r.fine)); S.bozza = null; nota(''); if (B.AgentiIA.aggiorna) B.AgentiIA.aggiorna();
  }
  async function salvaListino(l) {
    const prezzi = {}; S.pannello.querySelectorAll('.tr-prezzo').forEach(i => { prezzi[i.dataset.n] = +i.value; });
    nota('Cambio i cartellini...');
    let r; try { r = await B.AgentiIA.chiama('/terreno', { azione: 'listino', prezzi }); } catch (e) { r = { ok: false, motivo: 'Il borgo non risponde.' }; }
    nota(r.ok ? 'Prezzi aggiornati: i clienti vedono il nuovo listino.' : r.motivo || 'Non si può.'); if (r.ok && B.AgentiIA.aggiorna) B.AgentiIA.aggiorna();
  }

  /* ---------- il progettista: cosa costruisci e come lo vuoi, passo per passo ---------- */
  const FASI = { fondamenta: 'scavo e getto delle fondamenta', muri: 'si alzano i muri', tetto: 'si mette il tetto', finiture: 'finiture: intonaco, vetrine, insegna' };
  const INS_CSS = {
    legno: 'background:#6a3f27;border:3px solid #3a2216;color:#f6d27a;font-family:Georgia,serif',
    neon: 'background:#1a1230;border:3px solid #ff4fd8;color:#7ff3ff;text-shadow:0 0 6px #4fe3ff;font-family:Trebuchet MS,sans-serif',
    lavagna: 'background:#2f4a3a;border:3px solid #8a5a35;color:#f4f1e6;font-family:Comic Sans MS,cursive',
    pastello: 'background:#fbefe0;border:3px solid #e8a0b4;color:#c0507a;font-family:Georgia,serif',
    nera: 'background:#141414;border:3px solid #c8a25a;color:#e8c878;font-family:Didot,Georgia,serif'
  };
  const tavolozza = tipo => tipo === 'villa' ? VILLA : COLORI;
  // la vetrina disegnata: tetto, insegna, tenda, vetrine e porta, con i colori scelti
  function anteprima(b, nome) {
    const c = tavolozza(b.tipo)[(b.colore || 0) % tavolozza(b.tipo).length], W = b.tipo === 'villa' ? 250 : 210;
    const fin = `<div style="width:34px;height:30px;background:#fff3b0;border:3px solid ${c.persiane};border-radius:3px"></div>`;
    return `<div style="margin:10px auto 4px;width:${W}px">
      <div style="height:0;border-left:${W / 2 + 10}px solid transparent;border-right:${W / 2 + 10}px solid transparent;border-bottom:34px solid ${c.tetto};margin-left:-10px"></div>
      <div style="background:${c.muroSopra};height:46px;display:flex;align-items:center;justify-content:center;border-left:3px solid #6b4326;border-right:3px solid #6b4326"><span style="${INS_CSS[b.insegna] || INS_CSS.legno};padding:3px 10px;border-radius:7px;font-weight:700;font-size:15px;max-width:${W - 30}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(nome || 'Il tuo nome')}</span></div>
      <div style="height:16px;background:repeating-linear-gradient(90deg,#f6e8cc 0 13px,${c.tendaB} 13px 26px);border-radius:0 0 8px 8px"></div>
      <div style="background:${c.muro};height:62px;display:flex;align-items:flex-end;justify-content:space-around;padding:0 8px 0;border-left:3px solid #6b4326;border-right:3px solid #6b4326">${fin}<div style="width:30px;height:46px;background:#6b3f27;border-radius:14px 14px 0 0"></div>${fin}</div>
      <div style="height:8px;background:#b9b4aa;border-radius:2px"></div></div>`;
  }
  function listinoHtml(p, modificabile) {
    const L = S.listino, base = L && p.genere ? Object.fromEntries(L.generi[p.genere].prodotti) : {};
    return `<div style="margin-top:8px;font-weight:700">Listino</div>` + p.listino.map(q => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid #3a2f48"><span>${esc(q[0])}</span>` +
      (modificabile ? `<span><input class="tr-prezzo" data-n="${esc(q[0])}" type="number" min="1" value="${q[1]}" style="width:70px;padding:4px 6px;border-radius:8px;border:0;font-size:15px;color:#111;background:#fff"> <span style="font-size:11px;opacity:.7">normale ${base[q[0]] || '?'}</span></span>` : `<b>${q[1]} ${SL()}</b>`) + '</div>').join('');
  }
  // quando finisce: le ore di lavoro che restano, contate solo nei giorni e nelle ore in cui il cantiere lavora (ora di Roma)
  const FMT_ROMA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const GG = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function cantiereAperto(ms) {
    const o = Object.fromEntries(FMT_ROMA.formatToParts(new Date(ms)).map(x => [x.type, x.value])), h = +o.hour + (+o.minute) / 60;
    const R = (S.listino && S.listino.orari) || { giorni: [1, 2, 3, 4, 5, 6], ore: [8, 17] };
    return R.giorni.includes(GG[o.weekday]) && h >= R.ore[0] && h < R.ore[1];
  }
  function fineStimata(ore, da) { let t = da, resta = ore * 3600000; for (let i = 0; i < 24 * 4 * 90 && resta > 0; i++) { if (cantiereAperto(t)) resta -= 900000; t += 900000; } return t; }
  function traQuanto(ms) { const d = ms - Date.now(); if (d <= 0) return 'a momenti'; const g = Math.floor(d / 864e5), o = Math.floor(d % 864e5 / 3600e3); return 'tra ' + (g ? g + (g === 1 ? ' giorno' : ' giorni') + (o ? ' e ' : '') : '') + (o || !g ? o + (o === 1 ? ' ora' : ' ore') : ''); }
  const datiBozza = b => ({ tipo: b.tipo, genere: b.genere, nome: (b.nome || '').trim(), colore: b.colore, insegna: b.insegna, arredo: b.arredo, prezzi: b.prezzi });
  function nuovaBozza(l) { return { lotto: l.id, passo: 0, tipo: null, genere: 'bar', nome: '', colore: 0, insegna: 'legno', arredo: 'rustico', prezzi: {} }; }
  function passiDi(b) { return b.tipo === 'negozio' ? ['tipo', 'attivita', 'facciata', 'arredo', 'prezzi', 'riepilogo'] : ['tipo', 'facciata', 'riepilogo']; }
  const sceltaBtn = (cls, val, html, on, extra) => `<button class="${cls}" data-v="${esc(val)}" style="flex:1;min-width:70px;padding:8px 6px;border-radius:10px;border:2px solid #f2c76e;background:${on ? '#f2c76e' : 'none'};color:${on ? '#2a1a2e' : '#ffe9c4'};font-weight:700;font-size:13px;cursor:pointer;${extra || ''}">${html}</button>`;
  function progettista(l, L) {
    if (!S.bozza || S.bozza.lotto !== l.id) S.bozza = nuovaBozza(l);
    const b = S.bozza, passi = passiDi(b), passo = passi[Math.min(b.passo, passi.length - 1)];
    const nomeDef = b.tipo === 'negozio' ? (L.generi[b.genere].nome + ' di ' + mioNick()) : b.tipo ? (L.progetti[b.tipo].nome + ' di ' + mioNick()) : '';
    let h = `<div style="margin-top:8px;font-size:12px;opacity:.8">Passo ${b.passo + 1}${b.tipo ? ' di ' + passi.length : ''}</div>`;
    if (passo === 'tipo') {
      h += `<div style="font-weight:700;font-size:16px">Cosa ci costruisci?</div><div style="display:flex;gap:6px;margin-top:6px">` +
        [['casa', '🏠 Casa'], ['villa', '🏡 Villa'], ['negozio', '🏪 Negozio']].map(([k, t]) => sceltaBtn('tr-p-tipo', k, t + `<br><span style="font-weight:400;font-size:11px">${fmt(L.progetti[k].costo)} ${SL()}<br>${L.progetti[k].ore} ore di lavoro</span>`, b.tipo === k)).join('') + '</div>';
      if (b.tipo) { const q = L.progetti[b.tipo]; h += `<div style="margin-top:8px;font-size:13px">${esc(q.descr)}. ${b.tipo === 'negozio' ? 'Ci lavori solo tu, al bancone dentro: convinci i clienti del borgo e tieni l\'80% di ogni vendita.' : 'Finita, è l\'ingresso in piazza della tua casa, con il tuo nome sopra.'}</div>`; }
    } else if (passo === 'attivita') {
      h += `<div style="font-weight:700;font-size:16px">Che attività apri?</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">` +
        Object.entries(L.generi).map(([k, g]) => sceltaBtn('tr-p-genere', k, `<span style="font-size:22px">${g.icona}</span><br>${esc(g.nome)}`, b.genere === k, 'flex:1 1 30%')).join('') + '</div>' +
        `<div style="margin-top:8px;font-size:13px">Venderai: ${L.generi[b.genere].prodotti.map(q => esc(q[0]) + ' (' + q[1] + ')').join(', ')}. I prezzi li decidi tu più avanti.</div>`;
    } else if (passo === 'facciata') {
      h += `<div style="font-weight:700;font-size:16px">Nome e facciata</div>
        <input class="tr-p-nome" maxlength="28" value="${esc(b.nome)}" placeholder="${esc(nomeDef)}" style="width:100%;box-sizing:border-box;margin-top:6px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;color:#111;background:#fff">
        <div style="margin-top:8px;font-size:13px">Colori</div><div style="display:flex;gap:6px;margin-top:4px">` +
        tavolozza(b.tipo).map((c, i) => `<button class="tr-p-colore" data-v="${i}" aria-label="Colori ${i + 1}" style="flex:1;height:38px;border-radius:9px;cursor:pointer;border:3px solid ${b.colore === i ? '#fff' : 'transparent'};background:linear-gradient(180deg,${c.tetto} 0 33%,${c.muro} 33% 70%,${c.tendaB} 70%)"></button>`).join('') + '</div>' +
        `<div style="margin-top:8px;font-size:13px">Insegna</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">` +
        Object.entries(L.insegne || {}).map(([k, n]) => `<button class="tr-p-insegna" data-v="${k}" style="flex:1 1 30%;padding:6px 4px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;${INS_CSS[k]};outline:${b.insegna === k ? '3px solid #fff' : 'none'}">${esc(n)}</button>`).join('') + '</div>' +
        anteprima(b, b.nome || nomeDef);
    } else if (passo === 'arredo') {
      const D = { rustico: 'pavimento in cotto, banco e scaffali di legno: caldo e di paese', moderno: 'pareti bianche e piastrelle chiare: pulito e luminoso', elegante: 'pavimento di marmo e dettagli scuri: raffinato' };
      h += `<div style="font-weight:700;font-size:16px">Com'è dentro?</div>` + Object.entries(L.arredi || {}).map(([k, n]) => `<button class="tr-p-arredo" data-v="${k}" style="display:block;width:100%;text-align:left;margin-top:6px;padding:10px;border-radius:10px;border:2px solid #f2c76e;background:${b.arredo === k ? '#f2c76e' : 'none'};color:${b.arredo === k ? '#2a1a2e' : '#ffe9c4'};cursor:pointer"><b>${esc(n)}</b><br><span style="font-size:12px">${D[k] || ''}</span></button>`).join('') +
        `<div style="margin-top:8px;font-size:13px;opacity:.9">Dentro c'è il bancone con la cassa, gli scaffali con la tua merce e l'insegna con il nome. Entri dalla porta del negozio.</div>`;
    } else if (passo === 'prezzi') {
      const g = L.generi[b.genere];
      h += `<div style="font-weight:700;font-size:16px">I tuoi prezzi</div><div style="font-size:12px;opacity:.85;margin-top:2px">Tra ${Math.round((L.prezzoMin || 0.5) * 100)}% e ${Math.round((L.prezzoMax || 3) * 100)}% del prezzo normale del borgo. Più alto guadagni di più per vendita, ma i clienti si convincono meno. Lo puoi cambiare quando vuoi.</div>` +
        g.prodotti.map(q => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #3a2f48"><span>${esc(q[0])}</span><span><input class="tr-p-prezzo" data-n="${esc(q[0])}" type="number" min="1" value="${b.prezzi[q[0]] || q[1]}" style="width:70px;padding:4px 6px;border-radius:8px;border:0;font-size:15px;color:#111;background:#fff"> <span style="font-size:11px;opacity:.7">normale ${q[1]}</span></span></div>`).join('');
    } else {
      const q = L.progetti[b.tipo], fine = fineStimata(q.ore, Date.now()), giorni = Math.ceil(q.ore / ((L.orari ? L.orari.ore[1] - L.orari.ore[0] : 9)));
      h += `<div style="font-weight:700;font-size:16px">Riepilogo</div>` + anteprima(b, b.nome || nomeDef) +
        `<div style="font-size:13px;line-height:1.6">${b.tipo === 'negozio' ? `${L.generi[b.genere].icona} <b>${esc(L.generi[b.genere].nome)}</b> · arredo ${esc((L.arredi[b.arredo] || '').split(' (')[0].toLowerCase())}<br>` : ''}
          🧱 Materiali: <b>${fmt(q.materiali)} ${SL()}</b><br>👷 ${q.operai} operai per ${q.ore} ore: <b>${fmt(q.costo - q.materiali)} ${SL()}</b><br>💰 Totale: <b>${fmt(q.costo)} ${SL()}</b> (ne hai ${fmt(B.Eco ? B.Eco.coins : 0)})<br>
          📅 Il cantiere lavora dal lunedì al sabato, dalle 8 alle 17: circa ${giorni} giorni di lavoro.<br>⏳ Se apri oggi è pronto <b>${esc(quando(fine))}</b> (${esc(traQuanto(fine))}).</div>` +
        btn('tr-costruisci', `🏗️ Apri il cantiere: ${fmt(q.costo)} ${SL()}`, true) + (B.Banca ? btn('tr-mutuo', '🏦 Apri il cantiere con il mutuo', false) : '');
    }
    h += `<div style="display:flex;gap:6px;margin-top:10px">${b.passo > 0 ? sceltaBtn('tr-p-indietro', '', '← Indietro', false) : ''}${passo !== 'riepilogo' && b.tipo ? sceltaBtn('tr-p-avanti', '', 'Avanti →', true) : ''}</div>`;
    return h;
  }
  function agganciProgettista(c, l) {
    const b = S.bozza; if (!b) return;
    const on = (sel, ev, f) => c.querySelectorAll(sel).forEach(x => x.addEventListener(ev, () => f(x)));
    const leggi = () => { const n = c.querySelector('.tr-p-nome'); if (n) b.nome = n.value; c.querySelectorAll('.tr-p-prezzo').forEach(i => { b.prezzi[i.dataset.n] = Math.max(1, Math.round(+i.value || 0)); }); };
    on('.tr-p-tipo', 'click', x => { b.tipo = x.dataset.v; b.colore = 0; disegna(); });
    on('.tr-p-genere', 'click', x => { b.genere = x.dataset.v; b.prezzi = {}; disegna(); });
    on('.tr-p-colore', 'click', x => { leggi(); b.colore = +x.dataset.v; disegna(); });
    on('.tr-p-insegna', 'click', x => { leggi(); b.insegna = x.dataset.v; disegna(); });
    on('.tr-p-arredo', 'click', x => { b.arredo = x.dataset.v; disegna(); });
    on('.tr-p-nome', 'input', x => { b.nome = x.value; const sp = c.querySelector('.tr-corpo span[style*="text-overflow"]') || [...c.querySelectorAll('span')].find(q => q.style.textOverflow === 'ellipsis'); if (sp) sp.textContent = x.value || 'Il tuo nome'; });
    on('.tr-p-prezzo', 'change', () => leggi());
    on('.tr-p-avanti', 'click', () => { leggi(); b.passo = Math.min(passiDi(b).length - 1, b.passo + 1); disegna(); });
    on('.tr-p-indietro', 'click', () => { leggi(); b.passo = Math.max(0, b.passo - 1); disegna(); });
  }

  B.Terreni = { applica, toccabili, apri, chiudi, stato: S, entraCasaDa };
})();
