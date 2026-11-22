/* =====================================================================
   LE VETRINE AZIENDALI - negozi sponsor (22/11/2026, Boris: "immaginati di
   essere il proprietario di un negozio che vuole sponsorizzare il suo sito
   sul gioco: cosa vorresti poter fare? sbizzarrisciti")
   Il proprietario di un negozio finito lo trasforma nella vetrina della sua
   azienda vera:
   - marchio: nome, slogan, due colori, logo disegnato (icona, iniziali,
     forma, carattere) o caricato (immagine ridotta a 128 x 128);
   - in piazza: insegna col logo nei colori dell'azienda, tenda a righe con
     i suoi colori, bandiera col logo; cartellone che fa girare gli sponsor;
   - dentro: 8 posti da arredare (espositori, scaffali, totem, schermo con lo
     slogan, divanetto, manichino...), poster del marchio, banco informazioni;
   - la scheda per i visitatori: chi siamo, orari, prodotti in vetrina con il
     link alla pagina, codice sconto da copiare, "Visita il sito" (con avviso
     che si esce dal gioco), "Segnala";
   - le statistiche: visite, clic sul sito, codici copiati, giorno per giorno.
   MODERAZIONE (scelta di Boris): testi, link e logo si vedono solo dopo
   l'approvazione di un moderatore, dal pannello 🛡️ Moderazione nel gioco.
   Il servizio e' agenti/sponsor.mjs.
   ===================================================================== */
(function () {
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, G = window.Gioco, PI = Math.PI;
  const S = { stanze: {}, arredi: {}, loghi: {}, visti: new Set(), editor: null, ed: null, mod: null, modBtn: null, scheda: null, cart: null, sonoMod: null };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = () => B.AgentiIA || {};
  const vetrine = () => (A().dati && A().dati.vetrine) || {};
  const cataloghi = () => (A().dati && A().dati.cataloghiVetrine) || { icone: ['⭐'], forme: ['cerchio'], font: ['moderno'], mobili: {}, posti: 8, prodottiMax: 6 };
  const mioNick = () => (A().mioNick ? A().mioNick() : '');
  const chiama = (corpo) => (A().chiama ? A().chiama('/sponsor', corpo) : Promise.resolve({ ok: false, motivo: 'Il borgo non risponde.' }));
  const FONT = { moderno: 'bold {s}px "Helvetica Neue", Arial, sans-serif', classico: 'bold {s}px Georgia, "Times New Roman", serif', corsivo: 'italic bold {s}px "Brush Script MT", "Segoe Script", cursive', tondo: 'bold {s}px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif' };
  const font = (f, s) => (FONT[f] || FONT.moderno).replace('{s}', s);

  /* ---------- il logo ---------- */
  // disegna il logo (o l'immagine approvata, se c'e') su un canvas; se l'immagine arriva dopo, ridisegna e chiama fatto()
  function forma(x, tipo, cx, cy, r) {
    x.beginPath();
    if (tipo === 'quadrato') B.rr(x, cx - r, cy - r, 2 * r, 2 * r, r * 0.22);
    else if (tipo === 'scudo') { x.moveTo(cx - r, cy - r); x.lineTo(cx + r, cy - r); x.lineTo(cx + r, cy + r * 0.1); x.quadraticCurveTo(cx + r, cy + r * 0.8, cx, cy + r * 1.1); x.quadraticCurveTo(cx - r, cy + r * 0.8, cx - r, cy + r * 0.1); x.closePath(); }
    else if (tipo === 'esagono') { for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
    else x.arc(cx, cy, r, 0, PI * 2);
  }
  function disegnaLogo(x, cx, cy, r, profilo, colori, img) {
    const lg = (profilo && profilo.logo) || {}, c1 = (colori || [])[0] || '#1f3a8a', c2 = (colori || [])[1] || '#f2c21c';
    if (img) { x.save(); forma(x, lg.forma || 'cerchio', cx, cy, r); x.clip(); x.fillStyle = '#fff'; x.fill(); x.drawImage(img, cx - r, cy - r, 2 * r, 2 * r); x.restore(); return; }
    forma(x, lg.forma, cx, cy, r); x.fillStyle = c1; x.fill(); x.lineWidth = r * 0.09; x.strokeStyle = c2; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (lg.iniziali) {
      x.font = Math.round(r * 0.62) + 'px sans-serif'; x.fillText(lg.icona || '⭐', cx, cy - r * 0.3);
      x.fillStyle = c2; x.font = font(lg.font, Math.round(r * (lg.iniziali.length > 2 ? 0.44 : 0.56))); x.fillText(lg.iniziali, cx, cy + r * 0.42, r * 1.7);
    } else { x.font = Math.round(r * 1.0) + 'px sans-serif'; x.fillText(lg.icona || '⭐', cx, cy + r * 0.05); }
  }
  // l'immagine approvata di una vetrina (scaricata una volta sola, da /logo)
  function immagine(lotto, v, fatto) {
    if (!v) return null;
    const k = lotto + ':' + v; let q = S.loghi[k];
    if (!q) { q = S.loghi[k] = { img: new Image(), ok: false, attese: [] }; q.img.crossOrigin = 'anonymous'; q.img.onload = () => { q.ok = true; q.attese.splice(0).forEach(f => f()); }; q.img.src = (A().url || '') + '/logo?lotto=' + encodeURIComponent(lotto) + '&v=' + encodeURIComponent(v); }
    if (q.ok) return q.img;
    if (fatto) q.attese.push(fatto);
    return null;
  }
  function canvasLogo(lotto, V, size, sfondo) {
    const [cv, x] = B.tela(size, size); const t = B.tex(cv);
    const disegna = () => { x.clearRect(0, 0, size, size); if (sfondo) { x.fillStyle = sfondo; x.fillRect(0, 0, size, size); } const im = V.profilo && V.profilo.logo && V.profilo.logo.tipo === 'immagine' ? immagine(lotto, V.logoV, () => { disegna(); t.needsUpdate = true; }) : null; disegnaLogo(x, size / 2, size / 2, size * 0.42, V.profilo, V.colori, im); t.needsUpdate = true; };
    disegna(); return t;
  }
  // l'insegna della vetrina: il logo a sinistra e il nome dell'azienda nei suoi colori
  function insegnaTex(lotto, V) {
    const W = 1024, H = 246, [cv, x] = B.tela(W, H), t = B.tex(cv);
    const c1 = V.colori[0], c2 = V.colori[1], p = V.profilo || {};
    const disegna = () => {
      x.clearRect(0, 0, W, H); B.rr(x, 4, 4, W - 8, H - 8, 30); x.fillStyle = c1; x.fill(); x.lineWidth = 10; x.strokeStyle = c2; x.stroke();
      const im = p.logo && p.logo.tipo === 'immagine' ? immagine(lotto, V.logoV, () => { disegna(); t.needsUpdate = true; }) : null;
      disegnaLogo(x, 124, H / 2, 92, p, [c2, c1], im);
      x.fillStyle = c2; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.font = font(p.logo && p.logo.font, 96); x.fillText(p.azienda || '', 240, p.slogan ? 96 : H / 2 + 4, W - 270);
      if (p.slogan) { x.font = 'bold 40px sans-serif'; x.globalAlpha = 0.9; x.fillText(p.slogan, 244, 182, W - 280); x.globalAlpha = 1; }
      t.needsUpdate = true;
    };
    disegna(); return t;
  }
  // la chiave che fa ridisegnare l'edificio quando la vetrina cambia
  const firma = lotto => { const V = vetrine()[lotto]; return V ? [V.colori.join(), V.profilo ? V.profilo.azienda + '|' + V.profilo.slogan + '|' + JSON.stringify(V.profilo.logo) + V.logoV : ''].join('#') : ''; };
  // per terreni.js: le opzioni dell'edificio in piazza (insegna e tenda nei colori dell'azienda)
  function facciata(lotto) {
    const V = vetrine()[lotto]; if (!V || !V.profilo) return null;
    return { insegnaTex: insegnaTex(lotto, V), tendaA: V.colori[1], tendaB: V.colori[0] };
  }
  // la bandiera col logo accanto alla porta
  function bandiera(g, lotto, x, z) {
    const V = vetrine()[lotto]; if (!V || !V.profilo) return null;
    g.add(mesh(new T.CylinderGeometry(0.05, 0.06, 3.4, 8), M('#c8ccd2'), { x, y: 1.7, z, l: 0.006 }));
    const tela = new T.Mesh(new T.PlaneGeometry(1.1, 1.1, 8, 1), new T.MeshBasicMaterial({ map: canvasLogo(lotto, V, 256, V.colori[0]), side: T.DoubleSide }));
    tela.position.set(x + 0.58, 2.8, z); g.add(tela);
    const pos = tela.geometry.attributes.position, base = Float32Array.from(pos.array);
    return t => { for (let i = 0; i < pos.count; i++) { const px = base[i * 3]; pos.array[i * 3 + 2] = Math.sin(t * 3 + px * 3) * 0.08 * (px + 0.55); } pos.needsUpdate = true; };
  }

  /* ---------- l'interno: tipo vetrina e i mobili negli 8 posti ---------- */
  const lottoDiStanza = sid => String(sid || '').replace(/^bottega_/, '');
  // per chi crea l'interno (terreni.js, agenti-ia.js): una vetrina ha il suo tipo e i suoi colori
  function defInterno(sid, def) {
    const V = vetrine()[lottoDiStanza(sid)]; if (!V) return def;
    return Object.assign({}, def, { tipo: 'vetrina', fascia: V.colori[0], nome: V.profilo ? V.profilo.azienda : def.nome, senzaInsegna: !!V.profilo });
  }
  const versione = d => d.fascia + (d.senzaInsegna ? '|marchio' : '');
  const POSTI = [[-4.6, -2.4], [4.6, -2.4], [-4.6, 0.2], [4.6, 0.2], [-4.6, 2.7], [4.6, 2.7], [-2.2, 1.6], [2.2, 1.6]];
  function mobile(tipo, lotto, V, ost, tocchi, anim, sedili) {
    const g = new T.Group(), c1 = V.colori[0], c2 = V.colori[1], p = V.profilo || {};
    const box = (w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.012 : lb }); g.add(m); return m; };
    const logoMat = () => new T.MeshBasicMaterial({ map: canvasLogo(lotto, V, 256, '#ffffff') });
    const prodotti = (p.prodotti || []).length ? p.prodotti : [{ icona: '🎁', nome: '' }];
    const scatolina = (x, y, z, i) => { box(0.32, 0.36, 0.26, i % 2 ? c1 : c2, x, y + 0.18, z, 0.006); const [cv, cx] = B.tela(64, 64); cx.font = '44px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(prodotti[i % prodotti.length].icona || '🎁', 32, 36); const f = new T.Mesh(new T.PlaneGeometry(0.24, 0.24), new T.MeshBasicMaterial({ map: B.tex(cv), transparent: true })); f.position.set(x, y + 0.2, z + 0.135); g.add(f); };
    if (tipo === 'espositore') { box(1.2, 0.9, 0.7, '#f4f4f2', 0, 0.45, 0); box(1.24, 0.06, 0.74, c1, 0, 0.92, 0); [-0.38, 0, 0.38].forEach((x, i) => scatolina(x, 0.95, 0, i)); ost.push(0.75); }
    else if (tipo === 'scaffale') { box(1.4, 2.1, 0.45, c1, 0, 1.05, -0.05); for (let i = 0; i < 4; i++) { box(1.32, 0.04, 0.42, '#f4f4f2', 0, 0.3 + i * 0.5, 0); [-0.42, 0, 0.42].forEach((x, k) => scatolina(x, 0.32 + i * 0.5, 0, i + k)); } ost.push(0.8); }
    else if (tipo === 'tavolino') { const t = mesh(new T.CylinderGeometry(0.42, 0.42, 0.05, 16), M('#f4f4f2'), { y: 0.74, l: 0.01 }); g.add(t); g.add(mesh(new T.CylinderGeometry(0.05, 0.05, 0.72, 8), M('#3a3a40'), { y: 0.37 })); [-0.75, 0.75].forEach(x => { box(0.42, 0.06, 0.42, c1, x, 0.46, 0); box(0.42, 0.5, 0.06, c1, x + (x > 0 ? 0.19 : -0.19), 0.72, 0).rotation.y = PI / 2; sedili.push([x, 0, x > 0 ? -PI / 2 : PI / 2]); }); ost.push(0.5); }
    else if (tipo === 'divano') { box(1.8, 0.42, 0.8, c1, 0, 0.21, 0); box(1.8, 0.6, 0.2, c1, 0, 0.6, -0.32); [-0.92, 0.92].forEach(x => box(0.16, 0.55, 0.8, c1, x, 0.32, 0)); [-0.45, 0.45].forEach(x => box(0.5, 0.12, 0.55, c2, x, 0.48, 0.05, 0.006)); sedili.push([-0.45, 0.1, 0], [0.45, 0.1, 0]); ost.push(0.9); }
    else if (tipo === 'pianta') { const m = B.creaMobile ? B.creaMobile('pianta') : null; if (m) g.add(m); else { g.add(mesh(new T.CylinderGeometry(0.3, 0.24, 0.5, 12), M('#c0603a'), { y: 0.25, l: 0.008 })); g.add(mesh(new T.SphereGeometry(0.55, 10, 8), M('#3f7a3a'), { y: 1.0, l: 0.01 })); } ost.push(0.4); }
    else if (tipo === 'totem') { box(0.7, 2.0, 0.22, c1, 0, 1.0, 0); const f = new T.Mesh(new T.PlaneGeometry(0.6, 0.6), logoMat()); f.position.set(0, 1.45, 0.115); g.add(f); const f2 = f.clone(); f2.position.z = -0.115; f2.rotation.y = PI; g.add(f2); ost.push(0.45); }
    else if (tipo === 'tv') {
      box(0.08, 1.2, 0.08, '#3a3a40', 0, 0.6, 0); box(0.6, 0.04, 0.4, '#3a3a40', 0, 0.02, 0); box(1.6, 0.95, 0.08, '#1a1a1e', 0, 1.55, 0);
      const [cv, x] = B.tela(512, 288), t = B.tex(cv), sch = new T.Mesh(new T.PlaneGeometry(1.48, 0.84), new T.MeshBasicMaterial({ map: t })); sch.position.set(0, 1.55, 0.045); g.add(sch);
      const righe = [p.slogan, ...(p.prodotti || []).map(q => q.icona + ' ' + q.nome + (q.prezzo ? ' · ' + q.prezzo : '')), p.codice && p.codice.testo ? 'Codice ' + p.codice.testo + (p.codice.sconto ? ': ' + p.codice.sconto : '') : ''].filter(Boolean);
      let ultima = -1;
      anim.push(tt => { const i = Math.floor(tt / 4) % Math.max(1, righe.length); if (i === ultima) return; ultima = i; x.fillStyle = c1; x.fillRect(0, 0, 512, 288); x.fillStyle = c2; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(p.logo && p.logo.font, 50); x.fillText(p.azienda || '', 256, 70, 480); x.fillStyle = '#ffffff'; x.font = 'bold 34px sans-serif'; x.fillText(righe[i] || '', 256, 180, 490); t.needsUpdate = true; });
      ost.push(0.5);
    }
    else if (tipo === 'poster') { [-0.45, 0.45].forEach(x => box(0.05, 1.9, 0.05, '#3a3a40', x, 0.95, -0.05)); box(1.0, 1.3, 0.04, '#ffffff', 0, 1.25, 0); const f = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), logoMat()); f.position.set(0, 1.4, 0.025); g.add(f); ost.push(0.5); }
    else if (tipo === 'lampada') { g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 1.7, 8), M('#3a3a40'), { y: 0.85 })); g.add(mesh(new T.CylinderGeometry(0.25, 0.25, 0.03, 14), M('#3a3a40'), { y: 0.02 })); const l = new T.Mesh(new T.SphereGeometry(0.22, 14, 10), B.Mluce ? B.Mluce(c2, 0.9) : M(c2)); l.position.y = 1.8; g.add(l); ost.push(0.3); }
    else if (tipo === 'tappeto') { const t = new T.Mesh(new T.PlaneGeometry(1.8, 1.8), new T.MeshBasicMaterial({ map: canvasLogo(lotto, V, 256, c1) })); t.rotation.x = -PI / 2; t.position.y = 0.012; g.add(t); }
    else if (tipo === 'manichino') { g.add(mesh(new T.CylinderGeometry(0.2, 0.22, 0.04, 12), M('#3a3a40'), { y: 0.02 })); g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 8), M('#3a3a40'), { y: 0.45 })); g.add(mesh(new T.CylinderGeometry(0.24, 0.2, 0.7, 12), M(c1), { y: 1.2, l: 0.008 })); const f = new T.Mesh(new T.PlaneGeometry(0.22, 0.22), logoMat()); f.position.set(0, 1.3, 0.23); g.add(f); g.add(mesh(new T.SphereGeometry(0.15, 12, 10), M('#e8e4dc'), { y: 1.72, l: 0.006 })); ost.push(0.35); }
    else if (tipo === 'bancone') { box(1.6, 1.0, 0.6, c1, 0, 0.5, 0); box(1.66, 0.06, 0.66, c2, 0, 1.03, 0); const f = new T.Mesh(new T.PlaneGeometry(0.6, 0.6), logoMat()); f.position.set(0, 0.55, 0.31); g.add(f); tocchi.push(1); ost.push(0.85); }
    return g;
  }
  // mette (o rifa') i mobili nella stanza della vetrina; restituisce true se ha fatto qualcosa
  function arreda(sid) {
    const a = B.app, st = a && a.stanze[sid], lotto = lottoDiStanza(sid), V = vetrine()[lotto];
    if (!st || !V) return false;
    const k = JSON.stringify([V.mobili, V.colori, firma(lotto)]);
    const q = S.arredi[sid];
    if (q && q.k === k && q.g.parent === st.gruppo) return false;
    if (q) { st.gruppo.remove(q.g); q.ost.forEach(o => { const i = st.ostacoli.indexOf(o); if (i >= 0) st.ostacoli.splice(i, 1); }); q.tocchi.forEach(o => { const i = st.toccabili.indexOf(o); if (i >= 0) st.toccabili.splice(i, 1); }); q.sedili.forEach(o => { const i = st.sedili.indexOf(o); if (i >= 0) st.sedili.splice(i, 1); }); if (st.m && st.m.anim) q.anim.forEach(f => { const i = st.m.anim.indexOf(f); if (i >= 0) st.m.anim.splice(i, 1); }); }
    const g = new T.Group(), ost = [], tocchi = [], anim = [], sedili = [];
    (V.mobili || []).forEach((tipo, i) => {
      if (!tipo || !POSTI[i]) return;
      const [x, z] = POSTI[i], r = [], tc = [], se = [];
      const m = mobile(tipo, lotto, V, r, tc, anim, se); m.position.set(x, 0, z);
      m.rotation.y = i < 6 ? (x < 0 ? PI / 2 : -PI / 2) : PI;   // quelli lungo le pareti guardano il centro, gli altri la porta
      g.add(m);
      if (r.length) ost.push({ t: 'c', x, z, r: r[0] });
      if (tc.length) { const tk = new T.Mesh(new T.BoxGeometry(1.8, 1.4, 1.0), new T.MeshBasicMaterial()); tk.visible = false; tk.position.set(x, 0.7, z); g.add(tk); tocchi.push({ obj: tk, fn: () => scheda(lotto) }); }
      se.forEach(([dx, dz, yaw]) => { const c = Math.cos(m.rotation.y), s = Math.sin(m.rotation.y), sx = x + dx * c + dz * s, sz = z - dx * s + dz * c; const sd = { x: sx, z: sz, y: 0.46, yt: 0, yaw: m.rotation.y + PI + yaw }; sd.azione = { sedile: sd, nome: 'Siediti', testo: 'Siediti' }; sedili.push(sd); });
    });
    // il poster grande del marchio sopra il bancone e il punto informazioni all'ingresso
    if (V.profilo) {
      const ins = new T.Mesh(new T.PlaneGeometry(4.2, 1.0), new T.MeshBasicMaterial({ map: insegnaTex(lotto, V) })); ins.position.set(0, 2.95, -4.84); g.add(ins);
      const lt = canvasLogo(lotto, V, 256, '#ffffff');
      [-3.9, 3.9].forEach(x => { const f = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshBasicMaterial({ map: lt })); f.position.set(x, 2.4, -4.84); g.add(f); });
      const tk = new T.Mesh(new T.BoxGeometry(2.4, 2.2, 0.6), new T.MeshBasicMaterial()); tk.visible = false; tk.position.set(0, 1.4, -4.6); g.add(tk); tocchi.push({ obj: tk, fn: () => scheda(lotto) });
    }
    st.gruppo.add(g); g.updateMatrixWorld(true);
    ost.forEach(o => st.ostacoli.push(o)); tocchi.forEach(o => st.toccabili.push(o)); sedili.forEach(o => st.sedili.push(o));
    if (st.m && st.m.anim) anim.forEach(f => st.m.anim.push(f)); else S.anim = (S.anim || []).concat(anim);
    S.arredi[sid] = { k, g, ost, tocchi, sedili, anim };
    return true;
  }
  // ogni 2 secondi: gli interni delle vetrine del tipo giusto e arredati; le visite contate
  function controllaInterni() {
    const a = B.app; if (!a || !a.stanze) return;
    Object.keys(vetrine()).forEach(lotto => {
      const sid = 'bottega_' + lotto, st = a.stanze[sid]; if (!st) return;
      const voluto = versione(defInterno(sid, { tipo: 'x' }));
      if (S.stanze[sid] !== voluto && a.rimuoviInterno && a.rimuoviInterno(sid)) { delete S.arredi[sid]; return; }
      S.stanze[sid] = voluto; arreda(sid);
    });
  }
  // chi crea l'interno lo segna qui (cosi' si sa con che colori e' stato fatto)
  function creato(sid) { S.stanze[sid] = versione(defInterno(sid, { tipo: 'x' })); arreda(sid); }
  G.su && G.su('stanza', e => {
    const id = e && e.id; if (!id || id.indexOf('bottega_') !== 0) return;
    const lotto = lottoDiStanza(id), V = vetrine()[lotto];
    if (V && V.profilo && !S.visti.has(lotto)) { S.visti.add(lotto); chiama({ azione: 'visita', lotto }).catch(() => { }); }
  });

  /* ---------- il cartellone in piazza: gli sponsor approvati, a giro ---------- */
  function cartellone(a) {
    if (S.cart || !a || !a.piazza || !a.stanze || !a.stanze.piazza) return;
    const C = [[-12, 44], [12, 44], [-16, 30], [16, 30]];
    let p = null; for (const [x, z] of C) { let ok = true; for (let dx = -1.6; dx <= 1.6 && ok; dx += 0.8) for (let dz = -0.6; dz <= 0.6 && ok; dz += 0.6) if (!a.libero(a.stanze.piazza, x + dx, z + dz, 0.4)) ok = false; if (ok) { p = { x, z }; break; } }
    if (!p) { S.cart = { g: null }; return; }
    const g = new T.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.x < 0 ? 0.35 : -0.35; a.gP.add(g);
    [-1.3, 1.3].forEach(dx => g.add(mesh(new T.BoxGeometry(0.14, 3.0, 0.14), M('#4a4a52'), { x: dx, y: 1.5, l: 0.006 })));
    g.add(mesh(new T.BoxGeometry(3.3, 1.9, 0.16), M('#2a2a30'), { y: 2.6, lb: 0.01 }));
    const [cv, x] = B.tela(800, 440), t = B.tex(cv);
    const fronte = new T.Mesh(new T.PlaneGeometry(3.1, 1.7), new T.MeshBasicMaterial({ map: t })); fronte.position.set(0, 2.6, 0.085); g.add(fronte);
    const retro = fronte.clone(); retro.position.z = -0.085; retro.rotation.y = PI; g.add(retro);
    [-0.9, 0.9].forEach(dx => { const l = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), B.Mluce ? B.Mluce('#fff2c4', 0.8) : M('#fff2c4')); l.position.set(dx, 3.65, 0.3); g.add(l); });
    const tocco = new T.Mesh(new T.BoxGeometry(3.4, 3.6, 0.8), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.y = 1.8; g.add(tocco);
    g.updateMatrixWorld(true);
    a.piazza.ostacoli.push({ t: 'b', x0: p.x - 1.5, x1: p.x + 1.5, z0: p.z - 0.4, z1: p.z + 0.4 });
    S.cart = { g, x, t, ora: null, i: 0 };
    a.piazza.toccabili.push({ obj: tocco, fn: () => { if (S.cart.ora) scheda(S.cart.ora); else G.emetti('toast', '🏢 Il tuo marchio qui: apri un negozio su un terreno e trasformalo nella vetrina della tua azienda'); } });
    disegnaCartellone();
  }
  function disegnaCartellone() {
    const c = S.cart; if (!c || !c.g) return;
    const V0 = vetrine(), elenco = Object.keys(V0).filter(l => V0[l].cartellone && V0[l].profilo);
    const x = c.x, W = 800, H = 440;
    if (!elenco.length) {
      c.ora = null; x.fillStyle = '#1f2a44'; x.fillRect(0, 0, W, H); x.strokeStyle = '#f2c21c'; x.lineWidth = 14; x.strokeRect(7, 7, W - 14, H - 14);
      x.fillStyle = '#f2c21c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 74px sans-serif'; x.fillText('IL TUO MARCHIO QUI', W / 2, 150, W - 60);
      x.fillStyle = '#ffffff'; x.font = 'bold 38px sans-serif'; x.fillText('Apri un negozio sul tuo terreno', W / 2, 260, W - 60); x.fillText('e diventa sponsor del borgo', W / 2, 314, W - 60);
      c.t.needsUpdate = true; return;
    }
    const lotto = elenco[c.i % elenco.length], V = V0[lotto], p = V.profilo; c.ora = lotto;
    const fai = () => {
      x.fillStyle = V.colori[0]; x.fillRect(0, 0, W, H); x.strokeStyle = V.colori[1]; x.lineWidth = 14; x.strokeRect(7, 7, W - 14, H - 14);
      const im = p.logo && p.logo.tipo === 'immagine' ? immagine(lotto, V.logoV, () => { fai(); }) : null;
      disegnaLogo(x, 190, 200, 130, p, [V.colori[1], V.colori[0]], im);
      x.fillStyle = V.colori[1]; x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = font(p.logo && p.logo.font, 72); x.fillText(p.azienda, 350, 150, 420);
      x.fillStyle = '#ffffff'; x.font = 'bold 34px sans-serif'; x.fillText(p.slogan || '', 352, 230, 420);
      if (p.codice && p.codice.testo) { x.fillStyle = V.colori[1]; x.font = 'bold 30px sans-serif'; x.fillText('Codice ' + p.codice.testo, 352, 290, 420); }
      x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '26px sans-serif'; x.textAlign = 'center'; x.fillText((p.dominio || '') + ' · tocca per scoprire', W / 2, 395, W - 60);
      c.t.needsUpdate = true;
    };
    fai();
  }

  /* ---------- la scheda per i visitatori ---------- */
  const pannello = (id, html, larg) => {
    chiudiTutto();
    const el = document.createElement('div'); el.id = id;
    el.style.cssText = `position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(94vw,${larg || 460}px);max-height:78vh;overflow:auto;z-index:62;background:#1d1f2b;color:#f2f2f6;border:2px solid #f2c21c;border-radius:16px;padding:12px 14px;font-family:sans-serif;font-size:14px;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.5)`;
    el.innerHTML = '<button aria-label="Chiudi" class="sp-x" style="position:absolute;right:8px;top:4px;background:none;border:0;color:#fff;font-size:24px;cursor:pointer">×</button>' + html;
    el.querySelector('.sp-x').addEventListener('click', () => el.remove());
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    ['keydown', 'keyup', 'keypress'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
    (document.getElementById('app') || document.body).appendChild(el); return el;
  };
  function chiudiTutto() { ['sp-scheda', 'sp-editor', 'sp-mod', 'sp-esci'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); if (B.Terreni && B.Terreni.chiudi) B.Terreni.chiudi(); }
  const btn = (cls, txt, pieno, extra) => `<button class="${cls}" ${extra || ''} style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:${pieno ? '0' : '2px solid #f2c21c'};background:${pieno ? '#f2c21c' : 'none'};color:${pieno ? '#1d1f2b' : '#fff'};font-weight:700;font-size:14px;cursor:pointer">${txt}</button>`;
  function logoImgHtml(lotto, V, px) {
    const [cv, x] = B.tela(160, 160); const im = V.profilo && V.profilo.logo && V.profilo.logo.tipo === 'immagine' ? immagine(lotto, V.logoV) : null;
    disegnaLogo(x, 80, 80, 70, V.profilo, V.colori, im); return `<img alt="" src="${cv.toDataURL()}" style="width:${px}px;height:${px}px">`;
  }
  function scheda(lotto) {
    const V = vetrine()[lotto]; if (!V || !V.profilo) return;
    const p = V.profilo;
    let h = `<div style="display:flex;gap:12px;align-items:center;background:${esc(V.colori[0])};color:${esc(V.colori[1])};border-radius:12px;padding:10px;margin-right:22px">${logoImgHtml(lotto, V, 64)}<div><div style="font-size:21px;font-weight:800">${esc(p.azienda)}</div><div style="font-size:13px;opacity:.95">${esc(p.slogan)}</div></div></div>`;
    if (p.descrizione) h += `<div style="margin-top:8px">${esc(p.descrizione)}</div>`;
    if (p.orari) h += `<div style="margin-top:6px;font-size:13px;opacity:.85">🕘 ${esc(p.orari)}</div>`;
    if ((p.prodotti || []).length) h += `<div style="margin-top:10px;font-weight:700">In vetrina</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:4px">` + p.prodotti.map((q, i) => `<div style="background:#2a2d3d;border-radius:10px;padding:8px"><div style="font-size:24px">${esc(q.icona)}</div><b>${esc(q.nome)}</b>${q.prezzo ? ` <span style="color:#f2c21c">${esc(q.prezzo)}</span>` : ''}<div style="font-size:12px;opacity:.85">${esc(q.descr)}</div>${q.link ? `<button class="sp-vai" data-i="${i}" style="margin-top:4px;padding:4px 8px;border-radius:8px;border:1px solid #f2c21c;background:none;color:#f2c21c;cursor:pointer;font-size:12px">Vedi sul sito ↗</button>` : ''}</div>`).join('') + '</div>';
    if (p.codice && p.codice.testo) h += `<div style="margin-top:10px;background:#2a2d3d;border:2px dashed #f2c21c;border-radius:10px;padding:8px;display:flex;align-items:center;gap:8px;justify-content:space-between"><div><div style="font-size:12px;opacity:.85">Codice sconto per il sito${p.codice.sconto ? ': ' + esc(p.codice.sconto) : ''}</div><div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#f2c21c">${esc(p.codice.testo)}</div></div><button class="sp-copia" style="padding:8px 10px;border-radius:8px;border:0;background:#f2c21c;color:#1d1f2b;font-weight:700;cursor:pointer">Copia</button></div>`;
    if (p.sito) h += btn('sp-sito', `🌐 Visita il sito (${esc(p.dominio)})`, true);
    h += `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;opacity:.75"><span>Vetrina approvata dai moderatori di The Borg</span><button class="sp-segnala" style="background:none;border:0;color:#ff9a8a;cursor:pointer;font-size:12px">🚩 Segnala</button></div>`;
    const el = pannello('sp-scheda', h); S.scheda = el;
    const vai = url => esci(url, p.dominio, lotto);
    const s1 = el.querySelector('.sp-sito'); if (s1) s1.addEventListener('click', () => vai(p.sito));
    el.querySelectorAll('.sp-vai').forEach(b => b.addEventListener('click', () => vai(p.prodotti[+b.dataset.i].link)));
    const cp = el.querySelector('.sp-copia'); if (cp) cp.addEventListener('click', () => { copia(p.codice.testo); cp.textContent = 'Copiato!'; chiama({ azione: 'codice', lotto }).catch(() => { }); });
    el.querySelector('.sp-segnala').addEventListener('click', () => {
      const r = el.querySelector('.sp-segnala').parentNode; r.innerHTML = `<input class="sp-mot" maxlength="140" placeholder="Cosa non va?" style="flex:1;padding:6px;border-radius:8px;border:0;color:#111;background:#fff"><button class="sp-manda" style="margin-left:6px;padding:6px 10px;border-radius:8px;border:0;background:#ff9a8a;font-weight:700;cursor:pointer">Manda</button>`;
      r.querySelector('.sp-manda').addEventListener('click', async () => { const q = await chiama({ azione: 'segnala', lotto, motivo: r.querySelector('.sp-mot').value }); r.innerHTML = q.ok ? 'Grazie: i moderatori la controllano.' : esc(q.motivo || 'Non riuscito.'); });
    });
  }
  // copia negli appunti (senza errori se il browser non lo permette)
  function copia(t) {
    const vecchio = () => { try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.parentNode.removeChild(a); } catch (e) { /* niente appunti */ } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(vecchio); else vecchio(); } catch (e) { vecchio(); }
  }
  // prima di uscire dal gioco verso un sito esterno: sempre un avviso, con il nome del sito
  function esci(url, dom, lotto) {
    const ok = /^https:\/\//.test(url || ''); if (!ok) return;
    const el = document.createElement('div'); el.id = 'sp-esci';
    el.style.cssText = 'position:absolute;inset:0;z-index:70;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:sans-serif';
    el.innerHTML = `<div style="width:min(88vw,360px);background:#fff;color:#1d1f2b;border-radius:16px;padding:16px;text-align:center"><div style="font-size:34px">🌐</div><div style="font-weight:800;font-size:17px;margin-top:4px">Stai per uscire da The Borg</div><div style="margin-top:6px;font-size:14px">Si apre <b>${esc(dom)}</b>, un sito che non è di The Borg. Non dare mai password o dati personali a chi non conosci.</div><button class="ok" style="margin-top:12px;width:100%;padding:10px;border-radius:10px;border:0;background:#1f6feb;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Apri ${esc(dom)}</button><button class="no" style="margin-top:6px;width:100%;padding:8px;border-radius:10px;border:0;background:#eee;font-size:14px;cursor:pointer">Resta nel gioco</button></div>`;
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    el.querySelector('.no').addEventListener('click', () => el.remove());
    el.querySelector('.ok').addEventListener('click', () => { el.remove(); chiama({ azione: 'clic', lotto }).catch(() => { }); window.open(url, '_blank', 'noopener,noreferrer'); });
    (document.getElementById('app') || document.body).appendChild(el);
  }

  /* ---------- l'editor del proprietario ---------- */
  const TAB = [['marchio', '🎨 Marchio'], ['sito', '🌐 Sito e sconto'], ['vetrina', '🛍️ Prodotti'], ['arredo', '🛋️ Arredo'], ['stato', '📊 Stato']];
  async function editor(lotto) {
    const el = pannello('sp-editor', '<div class="sp-corpo">Un attimo...</div>', 500); S.editor = el;
    const r = await chiama({ azione: 'mia' });
    if (!r.ok) { el.querySelector('.sp-corpo').innerHTML = esc(r.motivo || 'Non si può.'); return; }
    const base = (r.bozza && r.bozza.profilo) || (r.approvato && r.approvato.profilo) || {};
    S.ed = { lotto: r.lotto, r, tab: 'marchio', p: JSON.parse(JSON.stringify(Object.assign({ azienda: '', slogan: '', descrizione: '', orari: '', sito: '', codice: { testo: '', sconto: '' }, logo: { tipo: 'disegnato', icona: '⭐', iniziali: '', forma: 'cerchio', font: 'moderno' }, prodotti: [] }, base))),
      img: (r.bozza && r.bozza.logoImg) || (r.approvato && r.approvato.logoImg) || '', imgEl: null, scelte: JSON.parse(JSON.stringify(r.scelte)), nota: '' };
    if (S.ed.img) { const im = new Image(); im.onload = () => { S.ed.imgEl = im; disegnaEditor(); }; im.src = S.ed.img; }
    disegnaEditor();
  }
  const campo = (cls, val, ph, max, extra) => `<input class="${cls}" maxlength="${max}" value="${esc(val)}" placeholder="${esc(ph)}" ${extra || ''} style="width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;border-radius:9px;border:0;font-size:15px;color:#111;background:#fff">`;
  const etich = t => `<div style="margin-top:8px;font-size:12px;opacity:.85">${t}</div>`;
  function anteprimaHtml() {
    const e = S.ed, [cv, x] = B.tela(640, 154), c1 = e.scelte.colori[0], c2 = e.scelte.colori[1];
    B.rr(x, 3, 3, 634, 148, 20); x.fillStyle = c1; x.fill(); x.lineWidth = 6; x.strokeStyle = c2; x.stroke();
    disegnaLogo(x, 78, 77, 58, e.p, [c2, c1], e.p.logo.tipo === 'immagine' ? e.imgEl : null);
    x.fillStyle = c2; x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = font(e.p.logo.font, 58); x.fillText(e.p.azienda || 'La tua azienda', 150, e.p.slogan ? 60 : 80, 470);
    if (e.p.slogan) { x.font = 'bold 26px sans-serif'; x.fillText(e.p.slogan, 152, 114, 470); }
    return `<img alt="Anteprima dell'insegna" src="${cv.toDataURL()}" style="width:100%;margin-top:8px;border-radius:10px">`;
  }
  function disegnaEditor() {
    const el = S.editor, e = S.ed; if (!el || !e || !el.isConnected) return;
    const C = cataloghi(), p = e.p, r = e.r;
    let h = `<div style="font-size:19px;font-weight:800">🏢 La vetrina della tua azienda</div><div style="font-size:12px;opacity:.85">Il tuo negozio diventa la vetrina della tua azienda vera: insegna, logo, sito, prodotti e codice sconto. Testi, link e logo si vedono in piazza dopo il controllo di un moderatore di The Borg.</div>`;
    h += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">` + TAB.map(([k, n]) => `<button class="sp-tab" data-t="${k}" style="flex:1 1 auto;padding:6px 8px;border-radius:8px;border:1px solid #f2c21c;background:${e.tab === k ? '#f2c21c' : 'none'};color:${e.tab === k ? '#1d1f2b' : '#fff'};font-size:12px;font-weight:700;cursor:pointer">${n}</button>`).join('') + '</div>';
    if (e.tab === 'marchio') {
      h += etich('Nome dell\'azienda') + campo('sp-azienda', p.azienda, 'Es. Caffè Mara', 32) + etich('Slogan') + campo('sp-slogan', p.slogan, 'Es. Il caffè del borgo, dal 1987', 60);
      h += etich('I tuoi colori') + `<div style="display:flex;gap:8px;margin-top:4px"><label style="flex:1">Principale <input type="color" class="sp-c1" value="${esc(e.scelte.colori[0])}" style="width:100%;height:34px;border:0"></label><label style="flex:1">Secondario <input type="color" class="sp-c2" value="${esc(e.scelte.colori[1])}" style="width:100%;height:34px;border:0"></label></div>`;
      h += etich('Logo') + `<div style="display:flex;gap:6px;margin-top:4px">${['disegnato', 'immagine'].map(t => `<button class="sp-ltipo" data-v="${t}" style="flex:1;padding:7px;border-radius:8px;border:1px solid #f2c21c;background:${p.logo.tipo === t ? '#f2c21c' : 'none'};color:${p.logo.tipo === t ? '#1d1f2b' : '#fff'};font-weight:700;cursor:pointer">${t === 'disegnato' ? '✏️ Disegnalo qui' : '🖼️ Carica il tuo'}</button>`).join('')}</div>`;
      if (p.logo.tipo === 'disegnato') {
        h += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">` + C.icone.map(i => `<button class="sp-icona" data-v="${esc(i)}" style="width:36px;height:36px;font-size:20px;border-radius:8px;border:2px solid ${p.logo.icona === i ? '#f2c21c' : 'transparent'};background:#2a2d3d;cursor:pointer">${esc(i)}</button>`).join('') + '</div>';
        h += `<div style="display:flex;gap:6px;margin-top:6px"><div style="flex:1">${etich('Iniziali (max 3)')}${campo('sp-iniziali', p.logo.iniziali, 'Es. CM', 3)}</div><div style="flex:1">${etich('Forma')}<select class="sp-forma" style="width:100%;margin-top:4px;padding:8px;border-radius:9px">${C.forme.map(f => `<option ${p.logo.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div style="flex:1">${etich('Carattere')}<select class="sp-font" style="width:100%;margin-top:4px;padding:8px;border-radius:9px">${C.font.map(f => `<option ${p.logo.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>`;
      } else h += `<div style="margin-top:6px;font-size:12px;opacity:.85">PNG o JPG quadrato: il gioco lo riduce a 128 × 128. Si vede dopo il controllo di un moderatore.</div><input type="file" accept="image/png,image/jpeg,image/webp" class="sp-file" style="margin-top:6px;color:#fff">${e.img ? '<div style="font-size:12px;margin-top:4px">✓ Logo caricato</div>' : ''}<div style="display:flex;gap:6px;margin-top:6px"><div style="flex:1">${etich('Forma')}<select class="sp-forma" style="width:100%;margin-top:4px;padding:8px;border-radius:9px">${C.forme.map(f => `<option ${p.logo.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div style="flex:1">${etich('Carattere del nome')}<select class="sp-font" style="width:100%;margin-top:4px;padding:8px;border-radius:9px">${C.font.map(f => `<option ${p.logo.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>`;
      h += etich('Così sarà la tua insegna in piazza') + anteprimaHtml();
    } else if (e.tab === 'sito') {
      h += etich('Il sito della tua azienda (https://...)') + campo('sp-sito', p.sito, 'https://www.tuaazienda.it', 120, 'inputmode="url"');
      h += etich('Chi siamo (max 300 caratteri)') + `<textarea class="sp-descr" maxlength="300" rows="3" style="width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;border-radius:9px;border:0;font-size:14px;color:#111;background:#fff">${esc(p.descrizione)}</textarea>`;
      h += etich('Orari del negozio vero o del servizio clienti') + campo('sp-orari', p.orari, 'Es. Lun-sab 9-19', 60);
      h += etich('Codice sconto per chi arriva dal gioco') + `<div style="display:flex;gap:6px"><div style="flex:1">${campo('sp-cod', p.codice.testo, 'BORGO10', 20)}</div><div style="flex:2">${campo('sp-sconto', p.codice.sconto, 'Es. 10% sul primo ordine', 40)}</div></div>`;
      h += `<div style="margin-top:8px;font-size:12px;opacity:.8">Chi tocca "Visita il sito" vede prima un avviso che sta uscendo dal gioco. I clic e i codici copiati li vedi in 📊 Stato.</div>`;
    } else if (e.tab === 'vetrina') {
      h += `<div style="font-size:12px;opacity:.85">Fino a ${C.prodottiMax} prodotti. Il link di un prodotto deve essere sul tuo sito.</div>`;
      p.prodotti.forEach((q, i) => {
        h += `<div style="background:#2a2d3d;border-radius:10px;padding:8px;margin-top:6px"><div style="display:flex;gap:6px;align-items:center"><select class="sp-pi" data-i="${i}" style="font-size:20px;padding:2px;border-radius:8px">${C.icone.map(c => `<option ${q.icona === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><div style="flex:2">${campo('sp-pn', q.nome, 'Nome', 30, `data-i="${i}"`)}</div><div style="flex:1">${campo('sp-pp', q.prezzo, 'Prezzo', 16, `data-i="${i}"`)}</div><button class="sp-pdel" data-i="${i}" aria-label="Togli" style="background:none;border:0;color:#ff9a8a;font-size:20px;cursor:pointer">🗑</button></div>${campo('sp-pd', q.descr, 'Descrizione breve', 90, `data-i="${i}"`)}${campo('sp-pl', q.link, 'Link alla pagina del prodotto (facoltativo)', 120, `data-i="${i}"`)}</div>`;
      });
      if (p.prodotti.length < C.prodottiMax) h += btn('sp-padd', '＋ Aggiungi un prodotto', false);
    } else if (e.tab === 'arredo') {
      h += `<div style="font-size:12px;opacity:.85">Dentro il negozio ci sono 8 posti: scegli cosa metterci. L'arredo vale subito (testi e logo dopo il controllo).</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px">`;
      const nomi = ['Parete sinistra, in fondo', 'Parete destra, in fondo', 'Parete sinistra, al centro', 'Parete destra, al centro', 'Parete sinistra, all\'ingresso', 'Parete destra, all\'ingresso', 'Centro, a sinistra', 'Centro, a destra'];
      for (let i = 0; i < C.posti; i++) h += `<label style="font-size:12px">${nomi[i] || 'Posto ' + (i + 1)}<select class="sp-mob" data-i="${i}" style="width:100%;margin-top:2px;padding:7px;border-radius:8px"><option value="">(vuoto)</option>${Object.entries(C.mobili).map(([k, n]) => `<option value="${k}" ${e.scelte.mobili[i] === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
      h += `</div><label style="display:block;margin-top:8px"><input type="checkbox" class="sp-cart" ${e.scelte.cartellone ? 'checked' : ''}> Mostra il mio marchio sul cartellone in piazza (a giro con gli altri sponsor)</label>` + btn('sp-salvaarr', '💾 Salva l\'arredo', false);
    } else {
      const st = r.stat || {}, g = st.giorni || {}, giorni = Object.keys(g).sort().slice(-7);
      h += `<div style="background:#2a2d3d;border-radius:10px;padding:8px">${r.approvato ? '✅ In vista dal ' + new Date(r.approvato.quando).toLocaleDateString('it-IT') : r.tolta ? '⛔ Tolta da un moderatore' + (r.tolta.motivo ? ': ' + esc(r.tolta.motivo) : '') : '⏳ Non ancora in vista'}<br>${r.bozza ? (r.bozza.stato === 'attesa' ? '🕵️ Una modifica aspetta il controllo dei moderatori.' : '❌ L\'ultima modifica non è stata approvata: ' + esc(r.bozza.motivo)) : 'Nessuna modifica in attesa.'}</div>`;
      h += `<div style="display:flex;gap:6px;margin-top:8px;text-align:center">${[['👀', 'visite', st.visite], ['🌐', 'clic sul sito', st.clic], ['🏷️', 'codici copiati', st.codici]].map(q => `<div style="flex:1;background:#2a2d3d;border-radius:10px;padding:8px"><div style="font-size:20px">${q[0]} ${q[2] || 0}</div><div style="font-size:11px;opacity:.8">${q[1]}</div></div>`).join('')}</div>`;
      if (giorni.length) { const mx = Math.max(1, ...giorni.map(d => g[d].visite)); h += etich('Visite degli ultimi giorni') + `<div style="display:flex;gap:4px;align-items:flex-end;height:70px;margin-top:4px">` + giorni.map(d => `<div style="flex:1;text-align:center;font-size:10px"><div style="background:#f2c21c;height:${Math.round(g[d].visite / mx * 52)}px;border-radius:4px 4px 0 0"></div>${d.slice(8)}/${d.slice(5, 7)}</div>`).join('') + '</div>'; }
      if (r.bozza && r.bozza.stato === 'attesa') h += btn('sp-ritira', 'Ritira la modifica in attesa', false);
    }
    if (e.tab !== 'arredo' && e.tab !== 'stato') h += btn('sp-invia', '📨 Invia al controllo dei moderatori', true);
    h += `<div class="sp-nota" style="font-size:13px;margin-top:8px;color:#ffd98a;min-height:1em">${esc(e.nota)}</div>`;
    el.innerHTML = '<button aria-label="Chiudi" class="sp-x" style="position:absolute;right:8px;top:4px;background:none;border:0;color:#fff;font-size:24px;cursor:pointer">×</button>' + h;
    el.querySelector('.sp-x').addEventListener('click', () => el.remove());
    agganciaEditor(el);
  }
  function leggiEditor(el) {
    const e = S.ed, p = e.p, v = c => { const x = el.querySelector(c); return x ? x.value : null; };
    if (v('.sp-azienda') != null) p.azienda = v('.sp-azienda'); if (v('.sp-slogan') != null) p.slogan = v('.sp-slogan');
    if (v('.sp-c1')) e.scelte.colori = [v('.sp-c1'), v('.sp-c2')];
    if (v('.sp-iniziali') != null) p.logo.iniziali = v('.sp-iniziali').toUpperCase(); if (v('.sp-forma')) p.logo.forma = v('.sp-forma'); if (v('.sp-font')) p.logo.font = v('.sp-font');
    if (v('.sp-sito') != null) p.sito = v('.sp-sito').trim(); if (v('.sp-descr') != null) p.descrizione = v('.sp-descr'); if (v('.sp-orari') != null) p.orari = v('.sp-orari');
    if (v('.sp-cod') != null) p.codice = { testo: v('.sp-cod').toUpperCase(), sconto: v('.sp-sconto') };
    el.querySelectorAll('.sp-pn').forEach(x => { const q = p.prodotti[+x.dataset.i]; q.nome = x.value; });
    el.querySelectorAll('.sp-pp').forEach(x => { p.prodotti[+x.dataset.i].prezzo = x.value; });
    el.querySelectorAll('.sp-pd').forEach(x => { p.prodotti[+x.dataset.i].descr = x.value; });
    el.querySelectorAll('.sp-pl').forEach(x => { p.prodotti[+x.dataset.i].link = x.value.trim(); });
    el.querySelectorAll('.sp-pi').forEach(x => { p.prodotti[+x.dataset.i].icona = x.value; });
    el.querySelectorAll('.sp-mob').forEach(x => { e.scelte.mobili[+x.dataset.i] = x.value || null; });
    const c = el.querySelector('.sp-cart'); if (c) e.scelte.cartellone = c.checked;
  }
  // il filtro della chat controlla i testi prima di mandarli (parolacce, insulti, numeri di telefono, email...)
  function testiOk(p) {
    const F = window.FiltroChat; if (!F) return '';
    const testi = [p.azienda, p.slogan, p.descrizione, p.orari, p.codice.sconto, ...p.prodotti.map(q => q.nome + ' ' + q.descr + ' ' + q.prezzo)].filter(Boolean);
    for (const t of testi) { const r = F.controlla(t); if (!r.ok || r.testo !== t && /\*/.test(r.testo)) return `"${t.slice(0, 40)}": ${r.livello === 'privato' ? 'niente email, telefoni o link nei testi (il link va solo nel campo del sito)' : 'questo testo non si può usare'}.`; }
    return '';
  }
  function agganciaEditor(el) {
    const e = S.ed, on = (sel, ev, f) => el.querySelectorAll(sel).forEach(x => x.addEventListener(ev, () => f(x)));
    const ridisegna = () => { leggiEditor(el); disegnaEditor(); };
    on('.sp-tab', 'click', x => { leggiEditor(el); e.tab = x.dataset.t; e.nota = ''; disegnaEditor(); });
    on('.sp-ltipo', 'click', x => { leggiEditor(el); e.p.logo.tipo = x.dataset.v; disegnaEditor(); });
    on('.sp-icona', 'click', x => { leggiEditor(el); e.p.logo.icona = x.dataset.v; disegnaEditor(); });
    on('.sp-c1, .sp-c2, .sp-forma, .sp-font', 'change', ridisegna);
    on('.sp-azienda, .sp-slogan, .sp-iniziali', 'change', ridisegna);
    on('.sp-padd', 'click', () => { leggiEditor(el); e.p.prodotti.push({ icona: '🎁', nome: '', descr: '', prezzo: '', link: '' }); disegnaEditor(); });
    on('.sp-pdel', 'click', x => { leggiEditor(el); e.p.prodotti.splice(+x.dataset.i, 1); disegnaEditor(); });
    on('.sp-file', 'change', x => {
      const f = x.files && x.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => {
        // ridotto a 128 x 128 (ritagliato al centro): pochi KB, si manda al servizio cosi'
        const [cv, c] = B.tela(128, 128), s = Math.min(im.width, im.height); c.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128);
        let d = cv.toDataURL('image/png'); if (d.length > 38000) d = cv.toDataURL('image/jpeg', 0.85);
        e.img = d; const i2 = new Image(); i2.onload = () => { e.imgEl = i2; leggiEditor(el); disegnaEditor(); }; i2.src = d;
      }; im.src = rd.result; }; rd.readAsDataURL(f);
    });
    on('.sp-salvaarr', 'click', async () => { leggiEditor(el); e.nota = '...'; const r = await chiama({ azione: 'scelte', colori: e.scelte.colori, mobili: e.scelte.mobili, cartellone: e.scelte.cartellone }); e.nota = r.ok ? '✓ Arredo salvato: entra nel negozio per vederlo.' : (r.motivo || 'Non riuscito.'); if (r.ok) { e.r = Object.assign(e.r, r); if (A().aggiorna) A().aggiorna(); } disegnaEditor(); });
    on('.sp-ritira', 'click', async () => { const r = await chiama({ azione: 'ritira' }); if (r.ok) e.r = Object.assign(e.r, r); disegnaEditor(); });
    on('.sp-invia', 'click', async () => {
      leggiEditor(el);
      if (!e.p.azienda.trim()) { e.nota = 'Scrivi il nome della tua azienda.'; return disegnaEditor(); }
      const no = testiOk(e.p); if (no) { e.nota = no; return disegnaEditor(); }
      e.nota = 'Invio...'; disegnaEditor();
      const corpo = { azione: 'invia', profilo: e.p, colori: e.scelte.colori, mobili: e.scelte.mobili, cartellone: e.scelte.cartellone };
      if (e.p.logo.tipo === 'immagine') corpo.logoImg = e.img || '';
      const r = await chiama(corpo);
      e.nota = r.ok ? '📨 Inviata! Un moderatore la controlla presto: intanto resta in vista la versione approvata prima (se c\'è).' : (r.motivo || 'Non riuscito.');
      if (r.ok) { e.r = Object.assign(e.r, r); if (A().aggiorna) A().aggiorna(); }
      disegnaEditor();
    });
  }

  /* ---------- il pannello dei moderatori ---------- */
  async function controllaModeratore() {
    if (!mioNick()) return;
    const r = await chiama({ azione: 'moderatore' }).catch(() => null); if (!r || !r.ok) return;
    S.sonoMod = !!r.moderatore;
    if (!S.sonoMod) { if (S.modBtn) { S.modBtn.remove(); S.modBtn = null; } return; }
    if (!S.modBtn) {
      const b = document.createElement('button'); b.id = 'sp-mod-btn';
      b.style.cssText = 'position:absolute;right:12px;top:calc(176px + env(safe-area-inset-top));z-index:55;padding:6px 10px;border-radius:12px;border:2px solid #f2c21c;background:#1d1f2b;color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:sans-serif';
      b.addEventListener('click', moderazione); ['pointerdown', 'touchstart'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
      (document.getElementById('app') || document.body).appendChild(b); S.modBtn = b;
    }
    S.modBtn.textContent = '🛡️ Moderazione' + (r.attesa ? ' (' + r.attesa + ')' : '');
  }
  async function moderazione() {
    const el = pannello('sp-mod', '<div class="sp-corpo">Un attimo...</div>', 520);
    const r = await chiama({ azione: 'coda' });
    if (!r.ok) { el.querySelector('.sp-corpo').textContent = r.motivo || 'Non si può.'; return; }
    let h = `<div style="font-size:19px;font-weight:800">🛡️ Moderazione delle vetrine</div><div style="font-size:12px;opacity:.85">Testi, link e logo delle aziende si vedono solo dopo il tuo sì. Controlla soprattutto il sito: aprilo tu prima di approvare.</div>`;
    if (!r.coda.length) h += `<div style="margin-top:10px">Niente da controllare. 👍</div>`;
    r.coda.forEach((q, i) => {
      const p = q.profilo;
      h += `<div style="background:#2a2d3d;border-radius:12px;padding:10px;margin-top:10px"><div style="display:flex;gap:10px;align-items:center">${q.logo ? `<img alt="" src="${esc(q.logo)}" style="width:64px;height:64px;border-radius:8px;background:#fff">` : `<div style="font-size:40px">${esc(p.logo.icona)}</div>`}<div><b style="font-size:16px">${esc(p.azienda)}</b><br><span style="font-size:12px">${esc(p.slogan)}</span><br><span style="font-size:11px;opacity:.8">di ${esc(q.chi)} · ${esc(q.lotto)} · ${new Date(q.inviata).toLocaleString('it-IT')}</span></div></div>
        ${p.sito ? `<div style="margin-top:6px">🌐 <b style="color:#f2c21c">${esc(q.dominio)}</b> <span style="font-size:12px;word-break:break-all;opacity:.85">${esc(p.sito)}</span></div>` : '<div style="margin-top:6px;opacity:.8">Nessun sito</div>'}
        ${p.descrizione ? `<div style="margin-top:4px;font-size:13px">${esc(p.descrizione)}</div>` : ''}${p.orari ? `<div style="font-size:12px">🕘 ${esc(p.orari)}</div>` : ''}${p.codice && p.codice.testo ? `<div style="font-size:12px">🏷️ ${esc(p.codice.testo)} ${esc(p.codice.sconto)}</div>` : ''}
        ${(p.prodotti || []).map(x => `<div style="font-size:12px">${esc(x.icona)} ${esc(x.nome)} ${esc(x.prezzo)} · ${esc(x.descr)} ${x.link ? '<span style="opacity:.8;word-break:break-all">' + esc(x.link) + '</span>' : ''}</div>`).join('')}
        ${q.prima ? `<div style="font-size:11px;opacity:.75;margin-top:4px">Prima era: ${esc(q.prima.azienda)} · ${esc(q.prima.slogan)} · ${esc(q.prima.sito)}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:8px"><button class="sp-ok" data-l="${esc(q.lotto)}" style="flex:1;padding:8px;border-radius:9px;border:0;background:#3fbf6a;color:#fff;font-weight:700;cursor:pointer">✓ Approva</button><button class="sp-no" data-l="${esc(q.lotto)}" style="flex:1;padding:8px;border-radius:9px;border:0;background:#d9534f;color:#fff;font-weight:700;cursor:pointer">✕ Rifiuta</button></div>
        <input class="sp-mot" data-l="${esc(q.lotto)}" maxlength="160" placeholder="Motivo del rifiuto (lo legge il proprietario)" style="width:100%;box-sizing:border-box;margin-top:6px;padding:7px;border-radius:8px;border:0;color:#111;background:#fff"></div>`;
    });
    if (r.approvati.length) h += `<div style="margin-top:12px;font-weight:700">In vista adesso</div>` + r.approvati.map(q => `<div style="background:#2a2d3d;border-radius:10px;padding:8px;margin-top:6px"><b>${esc(q.azienda)}</b> · <span style="font-size:12px">${esc(q.sito)}</span><br><span style="font-size:11px;opacity:.8">approvata da ${esc(q.da)} il ${new Date(q.quando).toLocaleDateString('it-IT')}</span>${q.segnalazioni.length ? `<div style="font-size:12px;color:#ff9a8a;margin-top:4px">🚩 ${q.segnalazioni.length} segnalazioni: ${q.segnalazioni.map(s => esc(s.nick) + ': ' + esc(s.motivo)).join(' · ')}</div><button class="sp-ignora" data-l="${esc(q.lotto)}" style="margin-top:4px;padding:5px 8px;border-radius:8px;border:1px solid #fff;background:none;color:#fff;cursor:pointer;font-size:12px">Va bene così, ignora</button>` : ''} <button class="sp-togli" data-l="${esc(q.lotto)}" style="margin-top:4px;padding:5px 8px;border-radius:8px;border:0;background:#d9534f;color:#fff;cursor:pointer;font-size:12px">Togli dalla vista</button></div>`).join('');
    h += '<div class="sp-nota" style="font-size:13px;margin-top:8px;color:#ffd98a"></div>';
    el.innerHTML = '<button aria-label="Chiudi" class="sp-x" style="position:absolute;right:8px;top:4px;background:none;border:0;color:#fff;font-size:24px;cursor:pointer">×</button>' + h;
    el.querySelector('.sp-x').addEventListener('click', () => el.remove());
    const fatto = async corpo => { const q = await chiama(corpo); if (!q.ok) { el.querySelector('.sp-nota').textContent = q.motivo || 'Non riuscito.'; return; } if (A().aggiorna) A().aggiorna(); controllaModeratore(); moderazione(); };
    el.querySelectorAll('.sp-ok').forEach(b => b.addEventListener('click', () => fatto({ azione: 'approva', lotto: b.dataset.l })));
    el.querySelectorAll('.sp-no').forEach(b => b.addEventListener('click', () => { const m = el.querySelector(`.sp-mot[data-l="${b.dataset.l}"]`); if (!m.value.trim()) { m.focus(); m.placeholder = 'Scrivi il motivo, poi Rifiuta'; return; } fatto({ azione: 'rifiuta', lotto: b.dataset.l, motivo: m.value }); }));
    el.querySelectorAll('.sp-togli').forEach(b => b.addEventListener('click', () => { if (b.dataset.sicuro) fatto({ azione: 'togli', lotto: b.dataset.l, motivo: 'tolta dai moderatori' }); else { b.dataset.sicuro = '1'; b.textContent = 'Sicuro? Tocca ancora'; } }));
    el.querySelectorAll('.sp-ignora').forEach(b => b.addEventListener('click', () => fatto({ azione: 'togli', solo: 'segnalazioni', lotto: b.dataset.l })));
  }

  /* ---------- il giro ---------- */
  let ultimaFirma = '';
  function frame() {
    const a = B.app; if (!a || !a.piazza) return;
    cartellone(a); controllaInterni();
    const f = JSON.stringify(Object.keys(vetrine()).map(firma));
    if (f !== ultimaFirma) { ultimaFirma = f; disegnaCartellone(); }
  }
  setInterval(frame, 2000);
  setInterval(() => { if (S.cart && S.cart.g) { S.cart.i++; disegnaCartellone(); } }, 9000);
  setTimeout(controllaModeratore, 4000); setInterval(controllaModeratore, 60000);
  B.Sponsor = { facciata, firma, bandiera, defInterno, creato, arreda, editor, scheda, moderazione, controllaModeratore, stato: S, vetrine };
})();
