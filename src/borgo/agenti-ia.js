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
  const CHIAVE = 'borg_agenti_url', VISTA = 20, VEL = 1.3;

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
  const inPiazza = () => app && app.gioco() && app.stanza().gruppo === app.gP;

  /* ---------- chiedere lo stato al servizio ---------- */
  let timer = null;
  async function chiedi() {
    clearTimeout(timer);
    let attesa = inPiazza() ? 4000 : app && app.gioco() ? 20000 : 3000;
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
    if (!gruppo) { gruppo = new T.Group(); app.gP.add(gruppo); }
    const visti = new Set();
    d.agenti.forEach(s => { visti.add(s.id); aggiornaAgente(s); });
    A.agenti.forEach((e, id) => { if (!visti.has(id)) { app.gP.remove(e.av.root); B.liberaAvatar(e.av); A.agenti.delete(id); } });
    aggiornaOggetti(d.oggetti || []);
    if (A.scheda) disegnaScheda();
  }

  /* ---------- gli abitanti ---------- */
  function aggiornaAgente(s) {
    let e = A.agenti.get(s.id);
    if (!e) {
      const av = B.unisciAvatar(B.creaAvatar(s.look || {}));
      av.root.traverse(q => { if (q.isMesh) q.receiveShadow = false; });
      const lab = B.etichetta(s.nome + ' 🤖', { sfondo: '#1f3a78', colore: '#e8f0ff', altezza: 0.36 }); lab.position.y = 2.5; av.root.add(lab);
      const q = libera(s.x, s.z);
      e = { id: s.id, av, x: q.x, z: q.z, vx: 0, vz: 0, yaw: 0, st: app.stanze.piazza, bolla: null, visto: s.detto ? s.detto.t : 0, fermo: 0, lavoroVisto: null };
      av.root.position.set(e.x, 0, e.z); app.gP.add(av.root);
      A.agenti.set(s.id, e);
    }
    e.s = s;
    // si parla: fumetto e riga in chat (solo le frasi nuove, non quelle vecchie ritrovate all'apertura)
    if (s.detto && s.detto.t > e.visto) {
      e.visto = s.detto.t;
      if (ora() - s.detto.t < 90000) {
        app.mostraBolla(e, s.detto.testo, 7);
        if (inPiazza() && G.aggiungiVoce) {
          const lontano = Math.hypot(e.x - app.io.x, e.z - app.io.z) > 14;
          G.aggiungiVoce({ id: 'agente:' + s.id, nick: s.nome + ' 🤖', testo: s.detto.testo, ora: new Date().toTimeString().slice(0, 5), io: false, stanza: 'piazza', lontano });
        }
      }
    }
    const lk = s.lavoro ? s.lavoro.tipo + s.lavoro.id : null;
    if (lk && lk !== e.lavoroVisto && inPiazza()) app.mostraBolla(e, s.lavoro.tipo === 'costruisci' ? '🔨' : '🧰', 3);
    e.lavoroVisto = lk;
  }

  // il servizio non conosce aiuole e panchine: se il punto e' occupato si cerca il posto libero piu' vicino
  function libera(x, z) {
    const st = app.stanze.piazza, r = B.CFG.raggio;
    if (app.libero(st, x, z, r)) return { x, z };
    for (let d = 0.5; d <= 6; d += 0.5) for (let k = 0; k < 12; k++) {
      const a = k * PI / 6, qx = x + Math.sin(a) * d, qz = z + Math.cos(a) * d;
      if (app.libero(st, qx, qz, r)) return { x: qx, z: qz };
    }
    return { x, z };
  }
  function frame(dt, t) {
    if (!app) return;
    A.agenti.forEach(e => {
      const s = e.s; if (!s) return;
      // il servizio sa dove sono davvero: qui li si fa camminare fino a li', con le stesse collisioni del giocatore
      const camm = Math.hypot(s.tx - s.x, s.tz - s.z) > 0.2, mx = camm ? s.tx : s.x, mz = camm ? s.tz : s.z, km = mx + ',' + mz;
      if (e.km !== km) { e.km = km; e.meta = libera(mx, mz); }
      const gx = e.meta.x, gz = e.meta.z;
      if (Math.hypot(s.x - e.x, s.z - e.z) > 12 || e.fermo > 3) { const q = libera(s.x, s.z); e.x = q.x; e.z = q.z; e.fermo = 0; }
      const dx = gx - e.x, dz = gz - e.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const k = 1 - Math.exp(-dt * 5);
        e.vx += (dx / d * VEL - e.vx) * k; e.vz += (dz / d * VEL - e.vz) * k;
        if (!app.muovi(e, e.vx * dt, e.vz * dt)) e.fermo += dt; else e.fermo = 0;
      } else { e.vx *= 0.8; e.vz *= 0.8; e.fermo = 0; }
      const vel = Math.hypot(e.vx, e.vz);
      if (vel > 0.2) e.yaw = Math.atan2(e.vx, e.vz);
      else if (s.lavoro) { const o = A.oggetti.get(s.lavoro.id); if (o) e.yaw = Math.atan2(o.d.x - e.x, o.d.z - e.z); }
      e.av.root.position.set(e.x, 0, e.z); e.av.root.rotation.y = e.yaw;
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

  /* ---------- le cose costruite ---------- */
  function geometria(f) {
    if (f === 'cilindro') return new T.CylinderGeometry(0.5, 0.5, 1, 18);
    if (f === 'sfera') return new T.SphereGeometry(0.5, 18, 12);
    if (f === 'cono') return new T.ConeGeometry(0.5, 1, 18);
    if (f === 'piramide') { const g = new T.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(PI / 4); return g; }
    return new T.BoxGeometry(1, 1, 1);
  }
  const firma = o => [o.forma, o.x, o.z, o.y, o.l, o.h, o.p, o.rot, o.colore, o.pronto, o.scritta, o.nome].join('|');
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
      const g = new T.Group(), mat = new T.MeshToonMaterial({ color: d.colore, transparent: !d.pronto, opacity: d.pronto ? 1 : 0.5 });
      const mesh = new T.Mesh(geometria(d.forma), mat);
      mesh.scale.set(d.l, d.h, d.p); mesh.position.y = d.y + d.h / 2; mesh.castShadow = d.pronto; mesh.receiveShadow = true;
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
      const d = o.d; if (!d.pronto || d.y > 1.2 || Math.max(d.l, d.p) < 0.3) return;
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
    if (!v.io || v.sussurro || !inPiazza()) return;
    const vicino = [...A.agenti.values()].some(e => Math.hypot(e.x - app.io.x, e.z - app.io.z) <= VISTA);
    if (!vicino) return;
    fetch(A.url + '/parla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick: v.nick, testo: v.testo, x: app.io.x, z: app.io.z }) }).catch(() => { });
  });

  /* ---------- scheda dell'agente (tocco sull'avatar) ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euro = v => v.toFixed(v < 0.1 ? 4 : 2).replace('.', ',') + ' $';
  function cosaFa(s) {
    if (A.dati && A.dati.pausa) return 'In pausa: è fermo, non pensa e non spende nulla';
    if (s.modo === 'automatico') return s.motivo === 'budget-finito' ? 'Ha finito il budget del mese: vive in automatico fino al mese prossimo' : 'Vive in automatico (il cervello non è collegato)';
    if (s.lavoro) { const o = A.oggetti.get(s.lavoro.id); return (s.lavoro.tipo === 'costruisci' ? 'Sta costruendo ' : 'Sta smontando ') + (o ? '"' + o.d.nome + '"' : ''); }
    if (Math.hypot(s.tx - s.x, s.tz - s.z) > 0.5) return 'Sta camminando';
    const m = Math.max(0, Math.round((s.prossimo - ora()) / 60000));
    return m < 1 ? 'Sta per pensare' : 'Ripenserà tra ' + (m < 60 ? m + ' min' : Math.round(m / 60) + ' h');
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
       <div style="margin:8px 0 4px"><b>Budget del mese:</b> ${euro(b.spesi)} su ${euro(b.tetto)} · ${b.pensieri} pensieri · restano ${b.giorni} giorni</div>
       <div style="height:10px;border-radius:5px;background:#3d3355;overflow:hidden"><div style="height:100%;width:${pc.toFixed(1)}%;background:${pc > 85 ? '#e0675c' : '#7ec8e3'}"></div></div>
       ${s.pensiero ? `<div style="margin-top:10px"><b>Ultimo pensiero:</b> <i>${esc(s.pensiero)}</i></div>` : ''}
       <details style="margin-top:8px"${aperta ? ' open' : ''}><summary style="cursor:pointer"><b>La sua memoria</b></summary><div style="white-space:pre-wrap;font-size:13px;opacity:.9;margin-top:4px">${esc(s.memoria)}</div></details>`;
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
      const chi = `<b>${esc(v.chi)}</b>${v.vero ? '' : ' 🤖'}`;
      const cosa = v.tipo === 'parla' ? `: “${esc(v.testo)}”` : v.tipo === 'costruisce' ? ` inizia a costruire <i>${esc(v.testo)}</i>` : v.tipo === 'finito' ? ` ha finito <i>${esc(v.testo)}</i>` : v.tipo === 'rimosso' ? ` ha smontato <i>${esc(v.testo)}</i>` : ` ha spostato <i>${esc(v.testo)}</i>`;
      return testa + `<div style="margin:3px 0"><span style="opacity:.6;font-size:12px">${h} · ${esc(v.luogo)}</span><br>${chi}${cosa}</div>`;
    }).join('') + '</div>';
  }
  function apriScheda(id) {
    chiudiScheda();
    const el = document.createElement('div'); el.dataset.id = id; el.id = 'agente-scheda';
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,420px);max-height:60vh;overflow:auto;z-index:60;background:#2a1f36;color:#ffe9c4;border:2px solid #f2c76e;border-radius:16px;padding:14px 16px;font-family:sans-serif;font-size:14px;line-height:1.35;box-shadow:0 8px 30px rgba(0,0,0,.45)';
    el.innerHTML = '<button aria-label="Chiudi" style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ffe9c4;font-size:22px;cursor:pointer">×</button><div class="ag-info"></div>' +
      '<button class="ag-cronaca" style="margin-top:10px;width:100%;padding:9px;border-radius:10px;border:0;background:#f2c76e;color:#2a1a2e;font-weight:700;font-size:14px;cursor:pointer">📜 Cronaca del borgo: cosa si sono detti e fatti</button>' +
      '<div class="ag-voci"></div><div style="margin-top:10px;font-size:12px;opacity:.75">Per parlargli scrivi in chat quando sei vicino a lui: ti sente entro ' + VISTA + ' metri. Ogni risposta gli costa un po\' di budget.</div>';
    el.querySelector('.ag-cronaca').addEventListener('click', mostraCronaca);
    el.querySelector('button').addEventListener('click', chiudiScheda);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    (document.getElementById('app') || document.body).appendChild(el);
    A.scheda = el; disegnaScheda();
  }
  function chiudiScheda() { if (A.scheda) { A.scheda.remove(); A.scheda = null; } A.voci = null; }
  G.su('stanza', d => { chiudiScheda(); if (d && d.id === 'piazza' && app) setTimeout(chiedi, 50); });
  B.agentiToccabili = () => [...A.agenti.values()].filter(e => e.av.root.visible).map(e => ({ obj: e.av.proxy, fn: () => apriScheda(e.id) }));

  A.frame = frame; A.apriScheda = apriScheda; A.applica = applica;
  function aspettaApp() { if (B.app && B.app.gP) { app = B.app; chiedi(); } else setTimeout(aspettaApp, 300); }
  aspettaApp();
})();
