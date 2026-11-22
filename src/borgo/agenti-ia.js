/* =====================================================================
   AGENTI IA NEL BORGO
   Due abitanti con un cervello vero (Claude Haiku 5.5) che vivono nella
   piazza anche quando il gioco e' chiuso. Il loro mondo gira su un piccolo
   servizio a parte (cartella agenti/ del progetto) che custodisce la chiave
   di Anthropic: il gioco non la vede mai, chiede solo /stato e manda /parla.

   Dove si trova il servizio:
   - URL_PREDEFINITO qui sotto (quando il servizio Cloudflare e' acceso);
   - oppure il link del gioco con ?agenti=https://... (resta salvato);
     ?agenti=off lo spegne su questo telefono.
   Se non c'e' nessun indirizzo gli agenti semplicemente non compaiono.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, G = window.Gioco, PI = Math.PI;
  const URL_PREDEFINITO = 'https://borgo-agenti.kovacic-boris-94.workers.dev';
  const CHIAVE = 'borg_agenti_url', VISTA = 20, VEL = 1.3, VEL_BICI = 3.9;

  function indirizzo() {
    let u = '';
    try {
      const q = new URLSearchParams(location.search).get('agenti');
      if (q === 'off') { localStorage.setItem(CHIAVE, 'off'); return ''; }
      if (q && /^https?:\/\/[^\s]+$/.test(q)) localStorage.setItem(CHIAVE, q.replace(/\/+$/, ''));
      u = localStorage.getItem(CHIAVE) || '';
    } catch (e) { /* storage non disponibile */ }
    if (u === 'off') return '';
    return u || URL_PREDEFINITO;
  }
  const URL = indirizzo();
  const A = { url: URL, agenti: new Map(), oggetti: new Map(), dati: null, scarto: 0, errori: 0, scheda: null };
  B.AgentiIA = A;
  if (!URL) { A.frame = () => { }; return; }

  let app = null, gruppo = null;
  const ora = () => Date.now() + A.scarto;   // orologio del servizio
  // gli agenti entrano anche negli edifici: ognuno si vede solo se e' nello stesso posto del giocatore
  const stanzaIo = () => { const st = app && app.stanza(); return st ? st.luogo || st.id : ''; };
  // il tetto della torre fa parte della piazza (lo si vede da giu'): chi e' lassu' si vede da tutta la piazza
  const qui = s => app && app.gioco() && ((app.stanze[s.stanza] || {}).luogo || s.stanza || 'piazza') === stanzaIo();
  const doveIo = () => { const id = app.stanza().id; return id === 'piazza' ? null : id; };
  const stanzaDi = id => (app.stanze[id || 'piazza'] || app.stanze.piazza);

  /* ---------- chiedere lo stato al servizio ---------- */
  let timer = null;
  async function chiedi() {
    clearTimeout(timer);
    let attesa = app && app.gioco() ? 4000 : 3000;
    if (app && app.gioco() && !document.hidden) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(A.url + '/stato', { cache: 'no-store', signal: ctl.signal });
        clearTimeout(to);
        if (!r.ok) throw new Error('stato ' + r.status);
        applica(await r.json()); A.errori = 0;
      } catch (e) { A.errori++; attesa = Math.min(60000, 4000 * Math.pow(2, A.errori)); }
    }
    timer = setTimeout(chiedi, attesa);
  }

  function applica(d) {
    if (!d || !Array.isArray(d.agenti)) return;
    A.dati = d; A.scarto = d.ora - Date.now();
    B.vitaCasa = (d.vita && d.vita.case) || null;   // le casette: fornello acceso, temperatura (src/borgo/casette-agenti.js)
    if (!gruppo) { gruppo = new T.Group(); app.gP.add(gruppo); }
    const visti = new Set();
    d.agenti.forEach(s => { visti.add(s.id); aggiornaAgente(s); });
    A.agenti.forEach((e, id) => { if (!visti.has(id)) { app.gP.remove(e.av.root); B.liberaAvatar(e.av); A.agenti.delete(id); } });
    aggiornaOggetti(d.oggetti || []);
    aggiornaNegozi(d.negozi || []);
    if (B.Terreni) B.Terreni.applica(d.terreni || [], d.listinoTerreni || null, app, d);
    messaggiPerMe(d.messaggi || []);
    if (A.scheda) disegnaScheda();
  }

  /* ---------- gli abitanti ---------- */
  function aggiornaAgente(s) {
    let e = A.agenti.get(s.id);
    if (!e) {
      const av = B.unisciAvatar(B.creaAvatar(s.look || {}));
      av.root.traverse(q => { if (q.isMesh) q.receiveShadow = false; });
      const lab = B.etichetta(s.nome + ' 🤖', { sfondo: '#1f3a78', colore: '#e8f0ff', altezza: 0.36 }); lab.position.y = 2.5; av.root.add(lab);
      e = { id: s.id, av, x: 0, z: 0, vx: 0, vz: 0, yaw: 0, st: null, bolla: null, visto: s.detto ? s.detto.t : 0, fermo: 0, lavoroVisto: null };
      A.agenti.set(s.id, e);
    }
    // cambio di posto (entra o esce da un edificio): si sposta nel gruppo di quella stanza e compare li'
    const st = stanzaDi(s.stanza);
    if (e.st !== st) {
      if (e.av.root.parent) e.av.root.parent.remove(e.av.root);
      e.st = st; const q = libera(s.x, s.z, st); e.x = q.x; e.z = q.z; e.y = null; e.vx = e.vz = 0; e.via = null; e.km = null;
      st.gruppo.add(e.av.root); e.av.root.position.set(e.x, 0, e.z); e.av.root.updateMatrixWorld(true);
    }
    e.s = s;
    // si parla: fumetto e riga in chat (solo le frasi nuove, non quelle vecchie ritrovate all'apertura)
    if (s.detto && s.detto.t > e.visto) {
      e.visto = s.detto.t;
      if (ora() - s.detto.t < 90000) {
        app.mostraBolla(e, s.detto.testo, 7);
        if (qui(s) && G.aggiungiVoce) {
          const lontano = Math.hypot(e.x - app.io.x, e.z - app.io.z) > 14;
          G.aggiungiVoce({ id: 'agente:' + s.id, nick: s.nome + ' 🤖', testo: s.detto.testo, ora: new Date().toTimeString().slice(0, 5), io: false, lontano });
        }
      }
    }
    // un gesto deciso pensando (saluta, salta, balla...): il corpo lo fa
    if (s.gesto && s.gesto.t > (e.gestoVisto || 0)) {
      e.gestoVisto = s.gesto.t;
      if (ora() - s.gesto.t < 40000 && qui(s)) fai(e, s.gesto.tipo);
    }
    const lk = s.lavoro ? s.lavoro.tipo + s.lavoro.id : null;
    if (lk && lk !== e.lavoroVisto && qui(s)) app.mostraBolla(e, s.lavoro.icona || (s.lavoro.tipo === 'costruisci' ? '🔨' : '🧰'), 3);
    e.lavoroVisto = lk;
    // la bici: la stessa dei giocatori, montata sotto l'avatar (solo in piazza)
    const bk = !!s.bici && !s.stanza;
    if (bk !== !!e.bk) { if (e.bk) { e.av.root.remove(e.bk); e.bk = null; } else if (app.creaBici) { e.bk = app.creaBici(); e.av.root.add(e.bk); } }
  }

  // il servizio non conosce aiuole e panchine: se il punto e' occupato si cerca il posto libero piu' vicino
  function libera(x, z, st) {
    const r = B.CFG.raggio; st = st || app.stanze.piazza;
    if (app.libero(st, x, z, r)) return { x, z };
    for (let d = 0.5; d <= 6; d += 0.5) for (let k = 0; k < 12; k++) {
      const a = k * PI / 6, qx = x + Math.sin(a) * d, qz = z + Math.cos(a) * d;
      if (app.libero(st, qx, qz, r)) return { x: qx, z: qz };
    }
    return { x, z };
  }
  const EMOTE = { saluta: ['saluta', 3], salta: ['evviva', 2.4], balla: ['balla', 5], ridi: ['ridi', 3], applaudi: ['applaudi', 3.5] };
  const vel0 = e => Math.hypot(e.vx || 0, e.vz || 0);
  function fai(e, g) { const m = EMOTE[g]; if (m && e.av.faiEmote) { e.av.faiEmote(m[0], m[1]); e.gestoFino = ora() + m[1] * 1000; } }
  const SPAZIO = 0.8;   // distanza minima tra due persone
  // strada a piedi su una griglia di mezzo metro (A*), poi si tolgono le tappe inutili
  function percorso(st, x0, z0, x1, z1) {
    const r = B.CFG.raggio + 0.05, R = 0.5, M = 12;
    const ax = Math.min(x0, x1) - M, az = Math.min(z0, z1) - M, W = Math.ceil((Math.abs(x1 - x0) + 2 * M) / R) + 1, H = Math.ceil((Math.abs(z1 - z0) + 2 * M) / R) + 1;
    if (W * H > 90000) return [{ x: x1, z: z1 }];
    const lib = new Int8Array(W * H).fill(-1), ok = i => { if (lib[i] < 0) lib[i] = app.libero(st, ax + (i % W) * R, az + Math.floor(i / W) * R, r) ? 1 : 0; return lib[i] === 1; };
    const cella = (x, z) => Math.max(0, Math.min(H - 1, Math.round((z - az) / R))) * W + Math.max(0, Math.min(W - 1, Math.round((x - ax) / R)));
    const s0 = cella(x0, z0), s1 = cella(x1, z1), g = new Float32Array(W * H).fill(1e9), da = new Int32Array(W * H).fill(-1), chiuso = new Uint8Array(W * H);
    const h = i => Math.hypot((i % W) - (s1 % W), Math.floor(i / W) - Math.floor(s1 / W));
    const aperti = [s0]; g[s0] = 0; let giri = 0, trovato = false;
    while (aperti.length && giri++ < 20000) {
      let bi = 0; for (let j = 1; j < aperti.length; j++) if (g[aperti[j]] + h(aperti[j]) < g[aperti[bi]] + h(aperti[bi])) bi = j;
      const c = aperti[bi]; aperti[bi] = aperti[aperti.length - 1]; aperti.pop();
      if (c === s1) { trovato = true; break; }
      if (chiuso[c]) continue; chiuso[c] = 1;
      const cx = c % W, cz = Math.floor(c / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const n = nz * W + nx; if (chiuso[n] || (n !== s1 && !ok(n))) continue;
        if (dx && dz && (!ok(cz * W + nx) || !ok(nz * W + cx))) continue;   // niente angoli tagliati
        const ng = g[c] + (dx && dz ? 1.414 : 1); if (ng < g[n]) { g[n] = ng; da[n] = c; aperti.push(n); }
      }
    }
    if (!trovato) return [{ x: x1, z: z1 }];
    const pt = []; for (let c = s1; c !== s0 && c >= 0; c = da[c]) pt.push({ x: ax + (c % W) * R, z: az + Math.floor(c / W) * R });
    pt.reverse(); pt[pt.length - 1] = { x: x1, z: z1 };
    // si tengono solo le tappe necessarie: se si vede la tappa dopo in linea retta, quella di mezzo non serve
    const vede = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 0.25); for (let i = 1; i < n; i++) if (!app.libero(st, a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, r)) return false; return true; };
    const out = []; let da0 = { x: x0, z: z0 }, i = 0;
    while (i < pt.length) { let j = pt.length - 1; while (j > i && !vede(da0, pt[j])) j--; out.push(pt[j]); da0 = pt[j]; i = j + 1; }
    return out;
  }
  function corpi(e) {
    const l = [];
    if (e.st === app.stanze.piazza) (app.npc || []).forEach(n => { if (n.av && n.av.root.visible) l.push(n); });
    if (app.io && app.gioco() && e.s && qui(e.s)) l.push(app.io);
    A.agenti.forEach(o => { if (o !== e && o.st === e.st) l.push(o); });
    return l;
  }
  function frame(dt, t) {
    if (!app) return;
    clientiFrame(dt);
    A.agenti.forEach(e => {
      const s = e.s; if (!s) return;
      // il servizio sa dove sono davvero: qui li si fa camminare fino a li', con le stesse collisioni del giocatore
      const camm = Math.hypot(s.tx - s.x, s.tz - s.z) > 0.2, mx = camm ? s.tx : s.x, mz = camm ? s.tz : s.z, km = mx + ',' + mz;
      if (e.km !== km) { e.km = km; e.meta = libera(mx, mz, e.st); }
      const gx = e.meta.x, gz = e.meta.z;
      const dx = gx - e.x, dz = gz - e.z, d = Math.hypot(dx, dz);
      // il servizio avanza a scatti (ogni 30 s): non si riporta MAI indietro chi cammina.
      // Solo se si e' rimasti indietro di moltissimo si salta in avanti dove il servizio dice che e'.
      if (d - Math.hypot(gx - s.x, gz - s.z) > 45) { const q = libera(s.x, s.z, e.st); e.x = q.x; e.z = q.z; }   // (es. tornando nel gioco dopo tanto: il servizio e' piu' avanti)
      // le altre persone (abitanti, giocatore, l'altro agente): se il posto e' occupato ci si ferma accanto
      const altri = corpi(e), occupato = altri.some(o => Math.hypot(o.x - gx, o.z - gz) < SPAZIO);
      if (d > (occupato ? SPAZIO + 0.2 : 0.3)) {
        // la strada: si calcola una volta per meta (aggirando fontana, aiuole, panchine) e si seguono le tappe
        if (!e.via || e.viaPer !== e.km) { e.via = percorso(e.st, e.x, e.z, gx, gz); e.viaPer = e.km; }
        while (e.via.length > 1 && Math.hypot(e.via[0].x - e.x, e.via[0].z - e.z) < 0.45) e.via.shift();
        const w = e.via[0] || { x: gx, z: gz }, wx = w.x - e.x, wz = w.z - e.z, wd = Math.hypot(wx, wz) || 1;
        const k = 1 - Math.exp(-dt * 5);
        const V = s.bici && !s.stanza ? VEL_BICI : VEL;
        e.vx += (wx / wd * V - e.vx) * k; e.vz += (wz / wd * V - e.vz) * k;
        const px = e.x, pz = e.z;
        app.muovi(e, e.vx * dt, e.vz * dt);
        if (Math.hypot(e.x - px, e.z - pz) < VEL * dt * 0.2) e.fermo += dt; else e.fermo = 0;
        if (e.fermo > 0.8) { e.fermo = 0; e.via = null; e.blocchi = (e.blocchi || 0) + 1; }   // qualcosa in mezzo: si ricalcola la strada
        if (e.blocchi > 6) { const q = libera(e.x + dx / d * 2, e.z + dz / d * 2, e.st); e.x = q.x; e.z = q.z; e.blocchi = 0; }
      } else { e.vx *= 0.8; e.vz *= 0.8; e.fermo = 0; e.blocchi = 0; }
      // nessuno si compenetra: chi e' troppo vicino viene scansato piano
      altri.forEach(o => {
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
        if (od >= SPAZIO) return;
        const k = Math.min(1, dt * 4) * (SPAZIO - od), ux = od > 1e-3 ? ox / od : Math.sin(e.id.length + t), uz = od > 1e-3 ? oz / od : Math.cos(e.id.length + t);
        app.muovi(e, ux * k, uz * k);
      });
      const vel = Math.hypot(e.vx, e.vz);
      // al bancone si guarda il cliente
      const bn = A.dati && (A.dati.negozi || []).find(n => n.chi && n.chi.id === e.id);
      if (bn && Math.hypot(e.x - bn.venditore.x, e.z - bn.venditore.z) < 1.5 && vel < 0.3) { e.yawT = null; e.yaw = Math.atan2(bn.cliente.x - e.x, bn.cliente.z - e.z); }
      // quando arrivi vicino ti salutano con la mano (gratis, lo fa il gioco), al massimo una volta ogni 2 minuti
      if (qui(s) && app.io) {
        const vicino = Math.hypot(app.io.x - e.x, app.io.z - e.z) < 4;
        if (vicino && !e.ioVicino && ora() - (e.salutato || 0) > 120000 && vel0(e) < 0.3) { e.salutato = ora(); e.yawT = Math.atan2(app.io.x - e.x, app.io.z - e.z); fai(e, 'saluta'); }
        e.ioVicino = vicino;
      }
      // fermi non vuol dire statue: ogni tanto si guardano intorno
      if (vel <= 0.2 && !s.lavoro && !(ora() < (e.gestoFino || 0))) { e.guarda = (e.guarda || 0) - dt; if (e.guarda <= 0) { e.guarda = 2.5 + Math.random() * 4; e.yawT = e.yaw + (Math.random() - 0.5) * 2.2; } if (e.yawT != null) e.yaw += (e.yawT - e.yaw) * Math.min(1, dt * 3); }
      if (vel > 0.2) { e.yaw = Math.atan2(e.vx, e.vz); e.yawT = null; }
      else if (s.lavoro) { const o = A.oggetti.get(s.lavoro.id); if (o) e.yaw = Math.atan2(o.d.x - e.x, o.d.z - e.z); }
      // il pavimento non e' tutto alla stessa altezza (palco, gradini): si sta sopra, come il giocatore
      const st = e.st, ty = st.alt ? st.alt(e.x, e.z) : 0; e.y = e.y == null ? ty : e.y + (ty - e.y) * Math.min(1, dt * 14);
      // seduto su un mobile della piazza (una poltrona regalata, un divano...): si mette sul cuscino, rivolto in avanti
      const sd = sedile(s, e);
      if (sd) { e.x = sd.x; e.z = sd.z; e.y = sd.y; e.yaw = sd.yaw; e.vx = e.vz = 0; e.seduto = sd; }
      else if (e.seduto) { const q = libera(e.seduto.fx, e.seduto.fz, e.st); e.x = q.x; e.z = q.z; e.seduto = null; e.via = null; }   // alzandosi si scende davanti al mobile
      e.av.sedT = sd ? 1 : 0;
      e.av.root.position.set(e.x, e.y, e.z); e.av.root.rotation.y = e.yaw;
      // i piani della torre senza negozio condividono lo stesso gruppo: si vede solo chi e' al tuo piano
      e.av.root.visible = !app.gioco() || qui(s) || e.st.gruppo !== app.stanza().gruppo;
      e.av.aggiorna(dt, vel, t); B.Bolle.aggiorna(e, dt);
    });
    // i cantieri crescono
    A.oggetti.forEach(o => {
      if (o.d.pronto) return;
      const L = A.dati && A.dati.agenti.map(a => a.lavoro).find(l => l && l.id === o.d.id);
      const k = L ? Math.max(0.08, Math.min(1, (ora() - L.inizio) / Math.max(1, L.fine - L.inizio))) : 0.1;
      o.mesh.scale.y = k * o.sy; o.mesh.position.y = o.d.y + (o.d.forma === 'sfera' ? o.d.h * k / 2 : o.d.h * k / 2);
    });
  }

  function sedile(s, e) {
    const L = s.lavoro; if (!L || L.tipo !== 'usa' || !L.oggetto) return null;
    const o = A.oggetti.get(L.id), a = o && o.d.modello && B.ARREDI && B.ARREDI.find(q => q.id === o.d.modello);
    if (!a || !a.sedute) return null;
    const q = a.sedute[Math.min(L.posto || 0, a.sedute.length - 1)], r = (o.d.rot || 0) * PI / 180, c = Math.cos(r), sn = Math.sin(r);
    const x = o.d.x + q.x * c + q.z * sn, z = o.d.z - q.x * sn + q.z * c;
    if (!e.seduto && Math.hypot(e.x - x, e.z - z) > 4) return null;   // e' ancora per strada: ci arriva camminando
    return { x, z, y: (o.d.y || 0) + q.y, yaw: r, fx: o.d.x + Math.sin(r) * (o.d.p / 2 + 0.6), fz: o.d.z + Math.cos(r) * (o.d.p / 2 + 0.6) };
  }

  /* ---------- regalare un mobile a un abitante: lo posi in piazza davanti a te ed e' suo ---------- */
  const REGALABILI = ['poltrona', 'divano', 'sedia', 'pouf', 'cassapanca', 'tavolino', 'tavolo', 'libreria', 'acquario', 'arcade', 'vaso', 'pianta', 'lampada', 'tappeto', 'fontana'];
  function mobiliDaRegalare() { return B.Eco && B.ARREDI ? B.ARREDI.filter(a => REGALABILI.includes(a.id) && B.Eco.liberi(a.id) > 0) : []; }
  function mostraRegali() {
    const box = A.scheda && A.scheda.querySelector('.ag-voci'); if (!box) return;
    A.voci = null;
    const nome = (A.dati.agenti.find(a => a.id === A.scheda.dataset.id) || {}).nome || '';
    if (doveIo()) { box.innerHTML = '<div style="margin-top:8px">I mobili si regalano in piazza: esci e riprova.</div>'; return; }
    const l = mobiliDaRegalare();
    if (!l.length) { box.innerHTML = '<div style="margin-top:8px">Non hai mobili liberi da regalare: comprali da “Arredamenti” in piazza (quelli posati in casa non contano).</div>'; return; }
    box.innerHTML = `<div style="margin-top:8px;background:#1f1729;border-radius:10px;padding:8px 10px"><div style="margin-bottom:6px">Mettiti dove vuoi il mobile e scegli: lo poso <b>davanti a te</b>, girato verso di te. Diventa di ${esc(nome)} (esce dal tuo zaino). Al massimo 3 tuoi regali in piazza.</div>` +
      l.map(a => `<button data-m="${a.id}" style="margin:3px 4px 3px 0;padding:7px 10px;border-radius:10px;border:0;background:#3d3355;color:#ffe9c4;font-size:14px;cursor:pointer">${esc(a.nome)} <small style="opacity:.7">x${B.Eco.liberi(a.id)}</small></button>`).join('') +
      '<div class="ag-reg-nota" style="font-size:12px;margin-top:6px;opacity:.9"></div></div>';
    box.querySelectorAll('button[data-m]').forEach(b => b.addEventListener('click', () => regala(b.dataset.m)));
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* vecchi browser */ }
  }
  async function regala(id) {
    const el = A.scheda; if (!el) return;
    const nota = el.querySelector('.ag-reg-nota'), a = B.ARREDI.find(q => q.id === id), ag = el.dataset.id;
    const dire = t => { if (nota) nota.textContent = t; };
    if (!mioNick()) return dire('Prima scegli il tuo nome nel gioco.');
    if (doveIo()) return dire('Devi essere in piazza.');
    if (!a || B.Eco.liberi(id) <= 0) return dire('Non ce l\'hai più nello zaino.');
    // davanti a te, a qualche passo, girato verso di te
    const yaw = app.io.yaw || 0, k = Math.max(a.w, a.d) / 2 + 1.2, x = app.io.x + Math.sin(yaw) * k, z = app.io.z + Math.cos(yaw) * k, rot = (yaw + PI) * 180 / PI;
    // non sopra edifici, panchine, alberi o altri oggetti: si prova il posto (centro e angoli) con gli stessi ostacoli del giocatore
    const r = (yaw + PI), c = Math.cos(r), sn = Math.sin(r), pz = app.stanze.piazza;
    const punti = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(p => [x + p[0] * a.w * 0.45 * c + p[1] * a.d * 0.45 * sn, z - p[0] * a.w * 0.45 * sn + p[1] * a.d * 0.45 * c]);
    if (!punti.every(p => app.libero(pz, p[0], p[1], 0.05))) return dire('Davanti a te non c\'è abbastanza spazio libero: girati o spostati un po\'.');
    dire('Lo poso...');
    try {
      const rr = await fetch(A.url + '/regala', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: mioNick(), a: ag, mobile: id, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, rot: Math.round(rot) }) });
      const j = await rr.json().catch(() => ({}));
      if (!j.ok) return dire(j.motivo || 'Non sono riuscito, riprova.');
      B.Eco.togli(id);
      const nome = (A.dati.agenti.find(q => q.id === ag) || {}).nome || '';
      G.emetti('toast', '🎁 Hai regalato ' + a.nome + ' a ' + nome + '!');
      dire('Fatto! ' + nome + ' lo scoprirà al prossimo pensiero.');
      setTimeout(chiedi, 300);
      setTimeout(() => { if (A.scheda && A.scheda.dataset.id === ag) mostraRegali(); }, 1500);
    } catch (e) { dire('Il borgo degli agenti non risponde, riprova tra poco.'); }
  }

  /* ---------- negozi: banconi, clienti demo, il tuo turno da venditore ---------- */
  const banconi = new Map(), ICONA = { caffetteria: '☕', forno: '🥖', fioraio: '💐' };
  let mioTurno = null, pannello = null, scelta = null, pingTimer = null, risposta = '';
  // dal 22/11/2026 il bancone e' dentro il negozio (src/borgo/interni.js): n.stanza = l'interno; i negozi sui terreni portano anche n.interno
  const stanzaBancone = n => { if (n.stanza && !app.stanze[n.stanza] && n.interno && app.aggiungiInterno) { const def = { nome: n.interno.nome, tipo: B.tipoInterno ? B.tipoInterno(n.interno.tipo) : 'bottega', arredo: n.interno.arredo, fuori: { x: n.interno.fuori.x, z: n.interno.fuori.z, yaw: PI } }; if (app.aggiungiInterno(n.stanza, B.Sponsor ? B.Sponsor.defInterno(n.stanza, def) : def) && B.Sponsor) B.Sponsor.creato(n.stanza); } return (n.stanza && app.stanze[n.stanza]) || app.stanze.piazza; };
  function aggiornaNegozi(l) {
    l.forEach(n => {
      if (banconi.has(n.id)) return;
      const st = stanzaBancone(n);
      const g = new T.Group(), r = (n.bancone.rot || 0) * PI / 180, legno = new T.MeshToonMaterial({ color: '#8a5a36' }), piano = new T.MeshToonMaterial({ color: '#e9d3a8' });
      const base = new T.Mesh(new T.BoxGeometry(2.4, 0.95, 0.7), legno); base.position.y = 0.475; base.castShadow = true; g.add(base);
      const top = new T.Mesh(new T.BoxGeometry(2.6, 0.08, 0.85), piano); top.position.y = 0.99; g.add(top);
      const lab = B.etichetta((n.icona || ICONA[n.id] || '🛒') + ' ' + n.nome, { sfondo: '#fbf3dc', colore: '#3a2216', altezza: 0.34 }); lab.position.y = 1.55; g.add(lab);
      const tocco = new T.Mesh(new T.BoxGeometry(2.6, 1.6, 1.2), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.y = 0.8; g.add(tocco);
      g.position.set(n.bancone.x, 0, n.bancone.z); g.rotation.y = r; st.gruppo.add(g); g.updateMatrixWorld(true);
      const c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), hx = (2.6 * c + 0.85 * sn) / 2, hz = (2.6 * sn + 0.85 * c) / 2;
      st.ostacoli.push({ t: 'b', x0: n.bancone.x - hx, x1: n.bancone.x + hx, z0: n.bancone.z - hz, z1: n.bancone.z + hz, bancone: true });
      banconi.set(n.id, { id: n.id, g, tocco, stanza: st.id });
    });
    // il mio turno: il servizio dice se sono ancora al bancone
    const io = mioNick();
    const mio = io && l.find(n => n.chi && n.chi.vero && String(n.chi.nome).toLowerCase() === io.toLowerCase());
    if (mioTurno && !mio) { mioTurno = null; G.emetti('toast', 'Il tuo turno al bancone è finito'); }
    if (pannello) disegnaBancone();
  }
  // i clienti sono gli abitanti demo della piazza: camminano fino al bancone e restano li' finche' non hanno deciso
  const ospiti = new Map(), dentro = new Map();
  // dentro un negozio il cliente e' una persona del borgo che entra e si mette al bancone (la sua copia in piazza resta fuori)
  function clienteDentro(n, o) {
    const k = n.id, c = dentro.get(k);
    if (c && (!o || c.demo !== o.demo || o.servito)) { if (c.av.root.parent) c.av.root.parent.remove(c.av.root); B.liberaAvatar && B.liberaAvatar(c.av); dentro.delete(k); }
    if (!o || o.servito || dentro.has(k)) return dentro.get(k);
    const u = ((window.CONFIG || {}).utentiDemo || []).find(q => q.id === o.demo), st = app.stanze[n.stanza]; if (!u || !st) return null;
    const av = B.unisciAvatar(B.creaAvatar(u.look || {})); av.root.position.set(n.cliente.x, 0, n.cliente.z); av.root.rotation.y = Math.atan2(n.bancone.x - n.cliente.x, n.bancone.z - n.cliente.z);
    st.gruppo.add(av.root); av.root.updateMatrixWorld(true);
    const e = { demo: o.demo, av, x: n.cliente.x, z: n.cliente.z, y: 0, nick: u.nick }; dentro.set(k, e); return e;
  }
  function clientiFrame(dt) {
    const l = (A.dati && A.dati.negozi) || [], vivi = new Set();
    l.forEach(n => {
      const o = n.ospite;
      if (n.stanza) {
        const e = clienteDentro(n, o); if (!o) return; vivi.add(o.demo);
        if (e) { e.av.aggiorna(dt, 0, performance.now() / 1000); B.Bolle.aggiorna(e, dt); }
        const k = o.detto && o.detto.t;
        if (e && k && ospiti.get(o.demo) !== k && stanzaIo() === n.stanza) { ospiti.set(o.demo, k); app.mostraBolla(e, o.detto.testo, 5); }
        return;
      }
      if (!o) return;
      vivi.add(o.demo);
      const p = (app.npc || []).find(q => q.id === o.demo); if (!p) return;
      const sp = n.cliente, d = Math.hypot(p.x - sp.x, p.z - sp.z);
      if (o.servito) return;   // ha deciso: torna a passeggiare
      if (d > 0.4) { p.tx = sp.x; p.tz = sp.z; if (p.att > 0.2) p.att = 0; if (d > 30) { p.x = sp.x + 4; p.z = sp.z + 2; } }
      else { p.x = sp.x; p.z = sp.z; p.vx = p.vz = 0; p.att = 1; p.yaw = Math.atan2(n.bancone.x - sp.x, n.bancone.z - sp.z); }
      const k = o.detto && o.detto.t;
      if (k && ospiti.get(o.demo) !== k && stanzaIo() === 'piazza') { ospiti.set(o.demo, k); app.mostraBolla(p, o.detto.testo, 5); }
    });
    ospiti.forEach((v, k) => { if (!vivi.has(k)) ospiti.delete(k); });
  }
  function chiudiBancone() { if (pannello) { pannello.remove(); pannello = null; } }
  function apriBancone(id) {
    if (A.scheda) { A.scheda.remove(); A.scheda = null; }
    chiudiBancone();
    const el = document.createElement('div'); el.id = 'bancone-scheda'; el.dataset.id = id;
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,420px);max-height:62vh;overflow:auto;z-index:60;background:#2a1f36;color:#ffe9c4;border:2px solid #f2c76e;border-radius:16px;padding:14px 16px;font-family:sans-serif;font-size:14px;line-height:1.35;box-shadow:0 8px 30px rgba(0,0,0,.45)';
    el.innerHTML = '<button aria-label="Chiudi" class="bn-x" style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ffe9c4;font-size:22px;cursor:pointer">×</button><div class="bn-corpo"></div>';
    el.querySelector('.bn-x').addEventListener('click', chiudiBancone);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    ['keydown', 'keyup', 'keypress'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
    (document.getElementById('app') || document.body).appendChild(el);
    pannello = el; scelta = null; disegnaBancone();
  }
  const btn = (cls, txt, pieno) => `<button class="${cls}" style="margin-top:8px;width:100%;padding:9px;border-radius:10px;border:${pieno ? '0' : '2px solid #f2c76e'};background:${pieno ? '#f2c76e' : 'none'};color:${pieno ? '#2a1a2e' : '#ffe9c4'};font-weight:700;font-size:14px;cursor:pointer">${txt}</button>`;
  function disegnaBancone() {
    const el = pannello; if (!el || !A.dati) return;
    const n = (A.dati.negozi || []).find(q => q.id === el.dataset.id); if (!n) return;
    const corpo = el.querySelector('.bn-corpo'), mio = mioTurno === n.id, o = n.ospite;
    // mentre scrivi la proposta non si ridisegna (si perderebbe il testo): si aggiorna solo il cliente
    if (mio && corpo.querySelector('.bn-testo') && corpo.dataset.cl === (o && !o.servito ? o.id : '')) { const c = corpo.querySelector('.bn-cliente'); if (c) c.innerHTML = clienteHtml(o); return; }
    corpo.dataset.cl = o && !o.servito ? o.id : '';
    let h = `<div style="font-size:20px;font-weight:700">${n.icona || ICONA[n.id] || '🛒'} ${esc(n.nome)}</div>
      <div style="opacity:.8;font-size:12px;margin:2px 0 8px">Listino: ${n.prodotti.map(p => esc(p[0]) + ' ' + p[1] + (n.scorte && n.scorte[p[0]] != null ? ` <span style="opacity:.75">(${n.scorte[p[0]] > 0 ? n.scorte[p[0]] + ' sullo scaffale' : 'finito'})</span>` : '')).join(' · ')}</div>`;
    if (!mio) {
      h += n.chi ? `<div>Al bancone c'è <b>${esc(n.chi.nome)}</b>${n.chi.vero ? '' : ' 🤖'} fino alle ${new Date(n.chi.fine).toTimeString().slice(0, 5)}.</div>` + (o ? `<div style="margin-top:6px">Sta servendo <b>${esc(o.nome)}</b>.</div>` : '')
        : n.proprietario && !(n.proprietario.vero && mioNick() && n.proprietario.nome.toLowerCase() === mioNick().toLowerCase()) ? `<div>È il negozio di <b>${esc(n.proprietario.nome)}</b>${n.proprietario.vero ? '' : ' 🤖'}: al bancone lavora solo chi ne è proprietario. Ora è chiuso.</div>`
        : n.proprietario ? `<div>È il <b>tuo negozio</b>. Fai un turno al bancone (20 minuti): arrivano i clienti del borgo, li convinci tu, e tieni l'80% del prezzo.</div>` + btn('bn-lavora', '🧑‍🍳 Apri il negozio', true)
        : `<div>Il bancone è libero. Fai un turno da venditore (20 minuti): arrivano i clienti del borgo, ognuno con il suo carattere. Non comprano da soli: li devi convincere tu, con il prodotto giusto, il prezzo e le parole giuste. A te va metà del prezzo.</div>` + btn('bn-lavora', '🧑‍🍳 Lavora qui', true);
      corpo.innerHTML = h + '<div class="bn-nota" style="font-size:12px;opacity:.85;margin-top:6px"></div>';
      const b = corpo.querySelector('.bn-lavora'); if (b) b.addEventListener('click', () => iniziaTurno(n));
      return;
    }
    h += `<div class="bn-cliente" style="background:#1f1729;border-radius:10px;padding:8px 10px">${clienteHtml(o)}</div>`;
    if (o && !o.servito) {
      h += `<div style="margin-top:8px;font-weight:700">Cosa gli proponi?</div><div class="bn-prod">${n.prodotti.filter(p => !(n.scorte && n.scorte[p[0]] === 0)).map(p => `<button data-p="${esc(p[0])}" data-l="${p[1]}" style="margin:3px 4px 3px 0;padding:6px 9px;border-radius:10px;border:0;background:${scelta === p[0] ? '#f2c76e' : '#3d3355'};color:${scelta === p[0] ? '#2a1a2e' : '#ffe9c4'};font-size:13px;cursor:pointer">${esc(p[0])}</button>`).join('')}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px">Prezzo <input class="bn-prezzo" type="number" inputmode="numeric" min="1" style="width:70px;padding:6px;border-radius:8px;border:0;font-size:16px"> Starlight</div>
        <textarea class="bn-testo" maxlength="300" rows="2" placeholder="Cosa gli dici per convincerlo?" style="width:100%;box-sizing:border-box;margin-top:6px;padding:8px 10px;border-radius:10px;border:0;font-size:16px;font-family:inherit"></textarea>` + btn('bn-proponi', '🗣️ Proponi', true);
    }
    h += `<div class="bn-nota" style="font-size:13px;margin-top:6px">${esc(risposta)}</div>` + btn('bn-smetti', 'Smetti di lavorare', false);
    corpo.innerHTML = h;
    corpo.querySelectorAll('.bn-prod button').forEach(b => b.addEventListener('click', () => { scelta = b.dataset.p; corpo.querySelectorAll('.bn-prod button').forEach(x => { const s = x === b; x.style.background = s ? '#f2c76e' : '#3d3355'; x.style.color = s ? '#2a1a2e' : '#ffe9c4'; }); corpo.querySelector('.bn-prezzo').value = b.dataset.l; }));
    const pr = corpo.querySelector('.bn-proponi'); if (pr) pr.addEventListener('click', () => proponiIo(n));
    corpo.querySelector('.bn-smetti').addEventListener('click', () => smettiTurno(n.id));
  }
  function clienteHtml(o) {
    if (!o) return '<i>Nessun cliente per ora: arriverà qualcuno tra poco.</i>';
    if (o.servito) return `<b>${esc(o.nome)}</b> ha deciso e se ne va. Aspetta il prossimo cliente.`;
    return `<b>${esc(o.nome)}</b>: sembra ${esc(o.vede || '')}.<br><span style="opacity:.8;font-size:12px">In tasca circa ${Math.round(o.soldi / 5) * 5} Starlight · ti ascolta ancora ${Math.max(0, 2 - o.tentativi)} ${2 - o.tentativi === 1 ? 'volta' : 'volte'} · aspetta fino alle ${new Date(o.via).toTimeString().slice(0, 5)}</span>`;
  }
  const nota = t => { const x = pannello && pannello.querySelector('.bn-nota'); if (x) x.textContent = t; };
  // la chiave segreta di questo giocatore sul borgo (nessun altro puo' fare debiti o comprare a suo nome)
  function chiave() {
    try { let k = localStorage.getItem('borg_chiave_borgo'); if (!k) { k = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('borg_chiave_borgo', k); } return k; } catch (e) { return ''; }
  }
  async function chiama(via, corpo) {
    const r = await fetch(A.url + via, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ nick: mioNick(), chiave: chiave() }, corpo)) });
    return r.json().catch(() => ({ ok: false, motivo: 'Risposta strana dal borgo.' }));
  }
  async function iniziaTurno(n) {
    if (!mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    if (stanzaIo() !== (n.stanza || 'piazza')) return nota('Devi essere dentro ' + n.nome + '.');
    nota('Vado al bancone...');
    try {
      const r = await chiama('/turno', { negozio: n.id, on: true });
      if (!r.ok) return nota(r.motivo || 'Non si può, riprova.');
      mioTurno = n.id;
      // ti metti dietro il bancone, rivolto verso il cliente
      app.io.x = n.venditore.x; app.io.z = n.venditore.z; app.io.yaw = Math.atan2(n.cliente.x - n.venditore.x, n.cliente.z - n.venditore.z);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (!mioTurno) { clearInterval(pingTimer); return; }
        const q = (A.dati.negozi || []).find(x => x.id === mioTurno);
        // se te ne vai dal bancone il turno finisce
        if (!q || stanzaIo() !== (q.stanza || 'piazza') || Math.hypot(app.io.x - q.venditore.x, app.io.z - q.venditore.z) > 4) { smettiTurno(mioTurno, 'Ti sei allontanato dal bancone: turno finito'); return; }
        chiama('/turno', { negozio: mioTurno, on: true }).catch(() => { });
      }, 90000);
      G.emetti('toast', (n.icona || ICONA[n.id] || '🛒') + ' Sei al bancone di ' + n.nome + ': aspetta i clienti!');
      setTimeout(chiedi, 200); disegnaBancone();
    } catch (e) { nota('Il borgo degli agenti non risponde, riprova tra poco.'); }
  }
  async function smettiTurno(id, msg) {
    mioTurno = null; clearInterval(pingTimer);
    try { await chiama('/turno', { negozio: id, on: false }); } catch (e) { /* pazienza */ }
    G.emetti('toast', msg || 'Hai smesso di lavorare'); setTimeout(chiedi, 200); disegnaBancone();
  }
  async function proponiIo(n) {
    const c = pannello.querySelector('.bn-corpo'), testo = c.querySelector('.bn-testo').value.trim(), prezzo = +c.querySelector('.bn-prezzo').value;
    if (!scelta) return nota('Scegli prima cosa proporgli.');
    nota('...');
    try {
      const r = await chiama('/vendi', { prodotto: scelta, prezzo: prezzo || null, testo });
      if (!r.ok) return nota(r.motivo || 'Non è andata, riprova.');
      if (r.compra) { if (B.Eco) B.Eco.add(r.guadagno, 'piazza'); G.emetti('toast', `🎉 ${r.cliente} ha comprato ${r.prodotto}! +${r.guadagno} ${B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight'}`); }
      scelta = null; c.dataset.cl = 'x';   // si ridisegna tutto al prossimo stato
      risposta = `${r.cliente}: “${r.frase}”` + (r.compra ? ` · +${r.guadagno}` : r.resta ? ' · puoi riprovare una volta' : ' · se ne va');
      nota(risposta); setTimeout(chiedi, 100);
    } catch (e) { nota('Il borgo degli agenti non risponde, riprova tra poco.'); }
  }
  G.su('stanza', () => { if (mioTurno) smettiTurno(mioTurno, 'Sei uscito dal negozio: turno finito'); });

  /* ---------- le cose costruite ---------- */
  function geometria(f) {
    if (f === 'cilindro') return new T.CylinderGeometry(0.5, 0.5, 1, 18);
    if (f === 'sfera') return new T.SphereGeometry(0.5, 18, 12);
    if (f === 'cono') return new T.ConeGeometry(0.5, 1, 18);
    if (f === 'piramide') { const g = new T.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(PI / 4); return g; }
    return new T.BoxGeometry(1, 1, 1);
  }
  const firma = o => [o.forma, o.x, o.z, o.y, o.l, o.h, o.p, o.rot, o.colore, o.pronto, o.scritta, o.nome, o.modello].join('|');
  // i mobili del Mercatino e i regali dei giocatori: si disegnano con il modello vero, come in casa
  const modello = d => d.modello && B.creaMobile && B.ARREDI && B.ARREDI.find(a => a.id === d.modello) ? B.creaMobile(d.modello) : null;
  function togli(o) {
    gruppo.remove(o.g);
    o.g.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) { if (q.material.map) q.material.map.dispose(); q.material.dispose(); } });
  }
  function aggiornaOggetti(lista) {
    const visti = new Set(); let cambiato = false;
    lista.forEach(d => {
      visti.add(d.id);
      const vecchio = A.oggetti.get(d.id), f = firma(d);
      if (vecchio && vecchio.f === f) { vecchio.d = d; return; }
      if (vecchio) togli(vecchio);
      const g = new T.Group(), vero = d.pronto && modello(d);
      let mesh;
      if (vero) { mesh = vero; mesh.position.y = d.y; }
      else {
        const mat = new T.MeshToonMaterial({ color: d.colore, transparent: !d.pronto, opacity: d.pronto ? 1 : 0.5 });
        mesh = new T.Mesh(geometria(d.forma), mat);
        mesh.scale.set(d.l, d.h, d.p); mesh.position.y = d.y + d.h / 2; mesh.castShadow = d.pronto; mesh.receiveShadow = true;
      }
      g.add(mesh); g.position.set(d.x, 0, d.z); g.rotation.y = (d.rot || 0) * PI / 180;
      if (d.scritta) { const e = B.etichetta(d.scritta, { sfondo: '#fbf3dc', colore: '#3a2216', altezza: 0.32 }); e.position.y = d.y + d.h + 0.35; g.add(e); }
      gruppo.add(g);
      A.oggetti.set(d.id, { d, f, g, mesh, sy: d.h });
      cambiato = true;
    });
    A.oggetti.forEach((o, id) => { if (!visti.has(id)) { togli(o); A.oggetti.delete(id); cambiato = true; } });
    if (cambiato) ostacoli();
  }
  // le cose finite a terra bloccano il passaggio, come i muri veri
  function ostacoli() {
    const l = app.piazza.ostacoli;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].agenteIA) l.splice(i, 1);
    A.oggetti.forEach(o => {
      const d = o.d; if (!d.pronto || d.y > 1.2 || Math.max(d.l, d.p) < 0.3 || d.h < 0.3) return;   // i tappeti si calpestano
      const a = (d.rot || 0) * PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const hx = (d.l * c + d.p * s) / 2, hz = (d.l * s + d.p * c) / 2;
      const ob = { t: 'b', x0: d.x - hx, x1: d.x + hx, z0: d.z - hz, z1: d.z + hz, agenteIA: true };
      // mai chiudere dentro qualcuno: se il giocatore e' li' sopra, quel pezzo non blocca
      const r = B.CFG.raggio + 0.05, px = Math.max(ob.x0, Math.min(ob.x1, app.io.x)), pz = Math.max(ob.z0, Math.min(ob.z1, app.io.z));
      if (Math.hypot(app.io.x - px, app.io.z - pz) < r) return;
      l.push(ob);
    });
  }

  /* ---------- parlare agli agenti: basta scrivere in chat vicino a loro ---------- */
  G.su('chat', v => {
    if (!v.io || v.sussurro || !app || !app.gioco()) return;
    const vicino = [...A.agenti.values()].some(e => e.s && qui(e.s) && Math.hypot(e.x - app.io.x, e.z - app.io.z) <= VISTA);
    if (!vicino) return;
    fetch(A.url + '/parla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: v.nick, testo: v.testo, x: app.io.x, z: app.io.z, stanza: doveIo() }) }).catch(() => { });
  });

  /* ---------- messaggi da lontano: gli scrivi dalla sua scheda, ti risponde ovunque tu sia ---------- */
  const mioNick = () => (G.stato && G.stato.giocatore && G.stato.giocatore.nick) || '';
  function messaggiPerMe(l) {
    const io = mioNick().toLowerCase(); if (!io) return;
    let visto = A.msgVisto;
    if (visto == null) { try { visto = +localStorage.getItem('borg_agenti_msg') || 0; } catch (e) { visto = 0; } visto = Math.max(visto, ora() - 10 * 60000); }
    l.forEach(m => {
      if (m.t <= visto || String(m.a).toLowerCase() !== io || !A.agenti.has(m.agente)) return;
      visto = m.t;
      // arriva nei messaggi privati, come quelli di un amico
      const id = 'agente:' + m.agente, c = G.conversazione(id);
      c.msgs.push({ da: id, testo: m.testo, ora: new Date().toTimeString().slice(0, 5), quando: Date.now() });
      if (G.stato.dmAperto !== id) { c.nonLetti++; G.emetti('toast', '✉️ ' + m.da + ' ti ha scritto'); }
      G.emetti('dm', { id });
    });
    A.msgVisto = visto; try { localStorage.setItem('borg_agenti_msg', String(visto)); } catch (e) { /* niente */ }
  }
  // Ada e Teo tra gli amici: scheda, posizione e messaggi privati (che arrivano davvero, ovunque siano)
  const nomeDove = s => !s ? 'Nel borgo' : s.stanza === 'tetto' ? 'Sul tetto della Torre' : s.stanza ? 'In ' + (({ negozio: 'Negozio TCG', tcg: 'Sala TCG' })[s.stanza] || (app && app.stanze[s.stanza] || {}).nome || s.stanza) : 'In piazza';
  B.amiciAgenti = () => (A.dati ? A.dati.agenti : []).map(s => G.utente('agente:' + s.id));
  const utenteOrig = G.utente;
  G.utente = function (id) {
    if (typeof id !== 'string' || id.indexOf('agente:') !== 0) return utenteOrig(id);
    const s = A.dati && A.dati.agenti.find(a => a.id === id.slice(7)), nick = s ? s.nome : id.slice(7);
    return { id, nick, look: (s && s.look) || {}, online: true, amico: true, agente: true, dove: nomeDove(s),
      bio: 'Agente IA che vive nel borgo. Scrivigli: legge i messaggi ovunque sia e ti risponde qui (ogni risposta gli costa un po\' di budget).' };
  };
  const inviaOrig = G.inviaDM;
  G.inviaDM = function (id, t) {
    if (typeof id !== 'string' || id.indexOf('agente:') !== 0) return inviaOrig(id, t);
    if (!mioNick()) { G.emetti('toast', 'Prima scegli il tuo nome'); return false; }
    t = G.controllaMessaggio(t, 'dm', 300); if (!t) return false;
    const c = G.conversazione(id), m = { da: 'io', testo: t, ora: new Date().toTimeString().slice(0, 5), quando: Date.now(), stato: 'inviato' };
    c.msgs.push(m); G.emetti('dm', { id });
    fetch(A.url + '/parla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: mioNick(), testo: t, a: id.slice(7), x: app ? app.io.x : 0, z: app ? app.io.z : 0, stanza: app ? doveIo() : null }) })
      .then(r => { if (r.status === 429) throw new Error('piano'); return r.json(); })
      .then(j => { if (!j.ok) throw new Error('no'); m.stato = 'letto'; G.emetti('dm', { id }); })
      .catch(e => { m.testo += e.message === 'piano' ? '  ⚠️ non inviato: aspetta qualche secondo' : '  ⚠️ non inviato, riprova'; delete m.stato; G.emetti('dm', { id }); });
    return true;
  };

  async function scriviDaLontano() {
    const el = A.scheda; if (!el) return;
    const inp = el.querySelector('.ag-testo'), nota = el.querySelector('.ag-nota'), testo = inp.value.trim().slice(0, 300), id = el.dataset.id;
    if (!testo) return;
    if (!mioNick()) { nota.textContent = 'Prima scegli il tuo nome nel gioco.'; return; }
    nota.textContent = 'Invio...';
    try {
      const r = await fetch(A.url + '/parla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: mioNick(), testo, a: id, x: app.io.x, z: app.io.z, stanza: doveIo() }) });
      if (r.status === 429) { nota.textContent = 'Aspetta qualche secondo tra un messaggio e l\'altro.'; return; }
      const j = await r.json(); if (!j.ok) throw new Error('no');
      inp.value = ''; nota.textContent = 'Consegnato: lo leggerà al prossimo pensiero (di solito entro pochi minuti).';
      if (A.dati) { (A.dati.messaggi || (A.dati.messaggi = [])).push({ t: ora(), da: mioNick(), a: (A.dati.agenti.find(a => a.id === id) || {}).nome, agente: id, testo }); disegnaScheda(); }
    } catch (e) { nota.textContent = 'Non sono riuscito a mandarlo, riprova.'; }
  }

  /* ---------- scheda dell'agente (tocco sull'avatar) ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => v.toFixed(v < 0.1 ? 4 : 2).replace('.', ',') + ' $';
  const FA = { dormi: 'Dorme 😴', svenuto: 'È svenuto', riposa: 'Si riposa', pesca: 'Pesca al Laghetto 🎣', lavora: 'Fa un turno di lavoro', mangia: 'Mangia', svago: 'Si svaga', chiacchiera: 'Chiacchiera', lavati: 'Si lava', raccogli: 'Raccoglie', modella: 'Modella l\'argilla', semina: 'Semina' };
  function cosaFa(s) {
    if (s.morto) return 'È morto' + (s.morto.causa ? ' (' + s.morto.causa + ')' : '') + '. La morte nel borgo è vera.';
    if (A.dati && A.dati.pausa) return 'In pausa: è fermo, non pensa e non spende nulla';
    const v = A.dati && A.dati.vita && A.dati.vita.corpi[s.id];
    if (v && v.fa && v.fa !== 'morto') return FA[v.fa] || v.fa;
    if (s.modo === 'automatico') return s.motivo === 'budget-finito' ? 'Ha finito il budget del mese: vive in automatico fino al mese prossimo' : 'Vive in automatico (il cervello non è collegato)';
    if (s.lavoro && s.lavoro.tipo === 'usa') return (s.lavoro.partita ? 'Sta giocando a ' : 'Sta usando: ') + s.lavoro.nome + ' ' + (s.lavoro.icona || '');
    if (s.lavoro) { const o = A.oggetti.get(s.lavoro.id); return (s.lavoro.tipo === 'costruisci' ? 'Sta costruendo ' : 'Sta smontando ') + (o ? '"' + o.d.nome + '"' : ''); }
    if (Math.hypot(s.tx - s.x, s.tz - s.z) > 0.5) return 'Sta camminando';
    const m = Math.max(0, Math.round((s.prossimo - ora()) / 60000));
    return m < 1 ? 'Sta per pensare' : 'Ripenserà tra ' + (m < 60 ? m + ' min' : Math.round(m / 60) + ' h');
  }
  // il corpo (vita vera): salute, fame, sete, sonno, e la casa
  const barra = (n, v, col) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0"><span style="width:52px">${n}</span><div style="flex:1;height:7px;border-radius:4px;background:#3d3355;overflow:hidden"><div style="height:100%;width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${col}"></div></div></div>`;
  function corpo(s) {
    const vv = A.dati && A.dati.vita, v = vv && vv.corpi[s.id]; if (!v || s.morto) return '';
    const casa = vv.case && vv.case['casa_' + s.id];
    return `<div style="margin:8px 0 4px"><b>Corpo:</b> salute ${v.salute}/100 · ${v.peso} kg · ${v.temperatura} °C${v.malato && v.malato.length ? ' · malato' : ''}</div>` +
      barra('Fame', v.fame, '#e8873a') + barra('Sete', v.sete, '#7ec8e3') + barra('Sonno', v.sonno, '#7a4fb8') +
      (casa ? `<div style="font-size:12px;opacity:.85;margin-top:3px">Casa: ${casa.T} °C${casa.fornello ? ' · fornello acceso 🔥' : ''}${casa.bolletta != null ? ' · ultima bolletta ' + casa.bolletta + ' Starlight' : ''}${casa.staccato ? ' · gas e luce staccati!' : ''}</div>` : '');
  }
  // la partita a un minigioco: chi contro chi, a che punto e' (con la scacchiera per gli scacchi), le ultime mosse e cosa pensa
  const PZ = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  function scacchiera(fen, nero) {
    const righe = fen.split(' ')[0].split('/').map(r => r.replace(/\d/g, d => '.'.repeat(+d)).split(''));
    if (nero) { righe.reverse(); righe.forEach(r => r.reverse()); }
    return '<div style="display:inline-grid;grid-template-columns:repeat(8,22px);border:1px solid #6b5a8a;margin:4px 0">' + righe.map((r, y) => r.map((c, x) => `<span style="width:22px;height:22px;line-height:22px;text-align:center;font-size:17px;color:#111;background:${(x + y) % 2 ? '#b58863' : '#f0d9b5'}">${PZ[c] || ''}</span>`).join('')).join('') + '</div>';
  }
  function partita(s) {
    const tutte = (A.dati.partite || {}), p = (tutte.inCorso || []).find(q => q.g.includes(s.id));
    const ultime = (tutte.finite || []).filter(q => q.g.includes(s.id)).slice(-3).reverse();
    const giochi = Object.entries(s.giochi || {}).filter(([, v]) => v.g).map(([k, v]) => `${k} ${v.v}/${v.g}${v.elo ? ' (Elo ' + v.elo + ')' : ''}`).join(' · ');
    let h = '';
    if (p) {
      const i = p.g.indexOf(s.id), altro = p.g.length > 1 ? p.nomi[1 - i] : null;
      h += `<div style="margin:8px 0 4px;padding:8px;border-radius:10px;background:#2a2340"><b>${p.icona || '🎮'} Sta giocando a ${esc(p.nome)}${altro ? ' contro ' + esc(altro) : ''}</b><div style="font-size:12px;opacity:.85">${esc(p.stato)}</div>` +
        (p.tavola && p.tavola.fen ? scacchiera(p.tavola.fen, p.tavola.bianco !== i) : '') +
        (p.pensieri && p.pensieri[s.id] ? `<div style="margin-top:4px;font-size:13px"><i>"${esc(p.pensieri[s.id])}"</i></div>` : '') +
        `<div style="font-size:12px;opacity:.8;margin-top:4px">${(p.log || []).slice(-5).map(l => esc(l.s)).join('<br>')}</div></div>`;
    }
    if (ultime.length) h += `<details style="margin-top:6px"><summary style="cursor:pointer"><b>Ultime partite</b></summary><div style="font-size:12px;opacity:.9;margin-top:4px">${ultime.map(q => `${q.icona || ''} ${esc(q.nome)}${q.g.length > 1 ? ' contro ' + esc(q.nomi[1 - q.g.indexOf(s.id)] || '') : ''}: <b>${esc((q.esiti || [])[q.g.indexOf(s.id)] || '')}</b> (${q.mosse} mosse)`).join('<br>')}</div></details>`;
    if (giochi) h += `<div style="font-size:12px;opacity:.75;margin-top:4px">Vinte/giocate: ${esc(giochi)}</div>`;
    return h;
  }
  function disegnaScheda() {
    const el = A.scheda; if (!el) return;
    const s = A.dati && A.dati.agenti.find(a => a.id === el.dataset.id); if (!s) { chiudiScheda(); return; }
    const b = s.budget, pc = Math.min(100, b.spesi / b.tetto * 100);
    const aperta = !!el.querySelector('.ag-info details[open]');
    el.querySelector('.ag-info').innerHTML =
      `<div style="font-size:20px;font-weight:700">${esc(s.nome)} 🤖</div>
       <div style="opacity:.75;font-size:12px;margin-bottom:8px">Agente IA libero · ${esc(A.dati.modello || '')}</div>
       <div style="margin:6px 0"><b>Adesso:</b> ${esc(cosaFa(s))}</div>
       <div style="margin:6px 0"><b>Dove:</b> ${esc(s.stanza === 'tetto' ? 'sul tetto della Torre della Cometa' : s.stanza ? 'dentro ' + ({ negozio: 'Negozio TCG', tcg: 'Sala TCG' }[s.stanza] || (app.stanze[s.stanza] || {}).nome || s.stanza) : 'in piazza')}</div>
       ${corpo(s)}
       ${partita(s)}
       ${s.starlight != null ? `<div style="margin:8px 0 4px"><b>Starlight:</b> ${s.starlight}${Object.keys(s.zaino || {}).length ? ' · zaino: ' + esc(Object.keys(s.zaino).join(', ')) : ''}</div>` : ''}
       <div style="margin:8px 0 4px"><b>Budget del mese:</b> ${euro(b.spesi)} su ${euro(b.tetto)} · ${b.pensieri} pensieri · restano ${b.giorni} giorni</div>
       <div style="height:10px;border-radius:5px;background:#3d3355;overflow:hidden"><div style="height:100%;width:${pc.toFixed(1)}%;background:${pc > 85 ? '#e0675c' : '#7ec8e3'}"></div></div>
       ${s.pensiero ? `<div style="margin-top:10px"><b>Ultimo pensiero:</b> <i>${esc(s.pensiero)}</i></div>` : ''}
       <details style="margin-top:8px"${aperta ? ' open' : ''}><summary style="cursor:pointer"><b>La sua memoria</b></summary><div style="white-space:pre-wrap;font-size:13px;opacity:.9;margin-top:4px">${esc(s.memoria)}</div></details>`;
    const io = mioNick().toLowerCase(), conv = (A.dati.messaggi || []).filter(m => m.agente === s.id && (String(m.a).toLowerCase() === io || String(m.da).toLowerCase() === io)).slice(-6);
    el.querySelector('.ag-conv').innerHTML = conv.map(m => `<div style="margin:3px 0;${String(m.da).toLowerCase() === io ? 'text-align:right' : ''}"><span style="display:inline-block;max-width:85%;text-align:left;padding:5px 9px;border-radius:10px;background:${String(m.da).toLowerCase() === io ? '#3b6fc8' : '#3d3355'}">${esc(m.testo)}</span></div>`).join('');
  }
  // la cronaca: frasi e lavori salvati dal servizio, anche quando nessuno guardava
  async function mostraCronaca() {
    const box = A.scheda && A.scheda.querySelector('.ag-voci'); if (!box) return;
    box.innerHTML = '<div style="margin-top:8px;opacity:.7">Carico la cronaca...</div>';
    try { const r = await fetch(A.url + '/cronaca', { cache: 'no-store' }); A.voci = (await r.json()).voci || []; }
    catch (e) { A.voci = null; box.innerHTML = '<div style="margin-top:8px">Cronaca non raggiungibile, riprova tra poco.</div>'; return; }
    disegnaCronaca();
  }
  function disegnaCronaca() {
    const box = A.scheda && A.scheda.querySelector('.ag-voci'); if (!box || !A.voci) return;
    if (!A.voci.length) { box.innerHTML = '<div style="margin-top:8px;opacity:.8">Ancora niente da raccontare.</div>'; return; }
    const giorno = t => new Date(t).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    let ultimo = '';
    box.innerHTML = '<div style="margin-top:8px;max-height:38vh;overflow:auto;background:#1f1729;border-radius:10px;padding:6px 10px">' + A.voci.slice().reverse().map(v => {
      const g = giorno(v.t), h = new Date(v.t).toTimeString().slice(0, 5), testa = g !== ultimo ? `<div style="margin:8px 0 2px;font-size:11px;opacity:.6;text-transform:uppercase">${esc(g)}</div>` : ''; ultimo = g;
      const chi = `<b>${esc(v.chi)}</b>${v.vero || v.demo ? '' : ' 🤖'}`;
      const cosa = v.tipo === 'regalo' ? ` regala <i>${esc(v.testo)}</i> a <b>${esc(v.a)}</b> 🎁` : v.tipo === 'parla' ? `: “${esc(v.testo)}”` : v.tipo === 'costruisce' ? ` inizia a costruire <i>${esc(v.testo)}</i>` : v.tipo === 'finito' ? ` ha finito <i>${esc(v.testo)}</i>` : v.tipo === 'rimosso' ? ` ha smontato <i>${esc(v.testo)}</i>` : v.tipo === 'proposta' ? ` propone per il gioco 💡 “${esc(v.testo)}”` : v.tipo === 'entra' ? ` entra in <i>${esc(v.testo)}</i>` : v.tipo === 'esce' ? ` esce da <i>${esc(v.testo)}</i>` : v.tipo === 'scrivi' ? ` scrive da lontano a <b>${esc(v.a)}</b> ✉️ “${esc(v.testo)}”` : v.tipo === 'usa' ? ` usa <i>${esc(v.testo)}</i>` : v.tipo === 'usato' ? `: ${esc(v.testo)}` : ` ha spostato <i>${esc(v.testo)}</i>`;
      return testa + `<div style="margin:3px 0"><span style="opacity:.6;font-size:12px">${h} · ${esc(v.luogo)}</span><br>${chi}${cosa}</div>`;
    }).join('') + '</div>';
  }
  // le idee degli agenti per chi crea il gioco: le legge Boris e decide lui
  async function mostraProposte() {
    const box = A.scheda && A.scheda.querySelector('.ag-voci'); if (!box) return;
    A.voci = null; box.innerHTML = '<div style="margin-top:8px;opacity:.7">Carico le proposte...</div>';
    let l;
    try { const r = await fetch(A.url + '/proposte', { cache: 'no-store' }); l = (await r.json()).proposte || []; }
    catch (e) { box.innerHTML = '<div style="margin-top:8px">Proposte non raggiungibili, riprova tra poco.</div>'; return; }
    if (!l.length) { box.innerHTML = '<div style="margin-top:8px;opacity:.8">Nessuna proposta, per ora.</div>'; return; }
    box.innerHTML = '<div style="margin-top:8px;max-height:38vh;overflow:auto;background:#1f1729;border-radius:10px;padding:6px 10px">' + l.map(p =>
      `<div style="margin:6px 0"><span style="opacity:.6;font-size:12px">${esc(new Date(p.t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span><br><b>${esc(p.chi)} 🤖</b>: ${esc(p.testo)}</div>`).join('') + '</div>';
  }
  function apriScheda(id) {
    chiudiScheda();
    const el = document.createElement('div'); el.dataset.id = id; el.id = 'agente-scheda';
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,420px);max-height:60vh;overflow:auto;z-index:60;background:#2a1f36;color:#ffe9c4;border:2px solid #f2c76e;border-radius:16px;padding:14px 16px;font-family:sans-serif;font-size:14px;line-height:1.35;box-shadow:0 8px 30px rgba(0,0,0,.45)';
    el.innerHTML = '<button aria-label="Chiudi" style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ffe9c4;font-size:22px;cursor:pointer">×</button><div class="ag-info"></div>' +
      '<button class="ag-cronaca" style="margin-top:10px;width:100%;padding:9px;border-radius:10px;border:0;background:#f2c76e;color:#2a1a2e;font-weight:700;font-size:14px;cursor:pointer">📜 Cronaca del borgo: cosa si sono detti e fatti</button>' +
      '<button class="ag-regala" style="margin-top:8px;width:100%;padding:9px;border-radius:10px;border:2px solid #f2c76e;background:none;color:#ffe9c4;font-weight:700;font-size:14px;cursor:pointer">🎁 Regalagli un mobile</button>' +
      '<button class="ag-proposte" style="margin-top:8px;width:100%;padding:9px;border-radius:10px;border:2px solid #f2c76e;background:none;color:#ffe9c4;font-weight:700;font-size:14px;cursor:pointer">💡 Proposte per migliorare il gioco</button>' +
      '<div style="margin-top:10px;font-weight:700">✉️ Scrivigli da lontano</div><div class="ag-conv" style="max-height:22vh;overflow:auto"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px"><input class="ag-testo" maxlength="300" placeholder="Ti legge ovunque sia..." style="flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:0;font-size:16px"><button class="ag-invia" style="padding:8px 12px;border-radius:10px;border:0;background:#f2c76e;color:#2a1a2e;font-weight:700">Invia</button></div>' +
      '<div class="ag-nota" style="font-size:12px;opacity:.8;margin-top:4px"></div>' +
      '<div class="ag-voci"></div><div style="margin-top:10px;font-size:12px;opacity:.75">Puoi anche parlargli in chat quando sei vicino a lui (ti sente entro ' + VISTA + ' metri, nello stesso posto). Ogni risposta gli costa un po\' di budget.</div>';
    el.querySelector('.ag-cronaca').addEventListener('click', mostraCronaca);
    el.querySelector('.ag-proposte').addEventListener('click', mostraProposte);
    el.querySelector('.ag-regala').addEventListener('click', mostraRegali);
    el.querySelector('.ag-invia').addEventListener('click', scriviDaLontano);
    const inp = el.querySelector('.ag-testo');
    ['keydown', 'keyup', 'keypress'].forEach(ev => inp.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') scriviDaLontano(); }));
    el.querySelector('button').addEventListener('click', chiudiScheda);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    (document.getElementById('app') || document.body).appendChild(el);
    A.scheda = el; disegnaScheda();
  }
  function chiudiScheda() { if (A.scheda) { A.scheda.remove(); A.scheda = null; } A.voci = null; chiudiBancone(); }
  G.su('stanza', () => { chiudiScheda(); if (app) setTimeout(chiedi, 50); });
  B.agentiToccabili = () => [...A.agenti.values()].filter(e => e.av.root.visible && e.s && qui(e.s)).map(e => ({ obj: e.av.proxy, fn: () => apriScheda(e.id) }))
    .concat(app && app.gioco() ? [...banconi.values()].filter(b => b.stanza === stanzaIo()).map(b => ({ obj: b.tocco, fn: () => apriBancone(b.id) })) : [])
    .concat(app && app.gioco() && stanzaIo() === 'piazza' && B.Terreni ? B.Terreni.toccabili() : []);

  A.frame = frame; A.apriScheda = apriScheda; A.applica = applica; A.apriBancone = apriBancone; A.mioNick = mioNick; A.chiama = chiama; A.aggiorna = () => setTimeout(chiedi, 200);
  function aspettaApp() { if (B.app && B.app.gP) { app = B.app; chiedi(); } else setTimeout(aspettaApp, 300); }
  aspettaApp();
})();
