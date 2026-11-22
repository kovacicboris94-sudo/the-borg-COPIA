/* =====================================================================
   THE BORG 3D - IL LAVORO DA DIPENDENTE (anche per le persone vere)
   Chiesto da Boris il 22/11/2026: "metti piu' mestieri, ogni casa e
   mestiere deve funzionare". I mestieri e i loro effetti stanno nel servizio
   degli agenti (agenti/vita/mestieri.mjs e agenti/lavori.mjs): fornaio,
   pasticcere, barista, fioraio, facchino, bibliotecario, spazzino,
   giardiniere, muratore, segretario dell'Ambulatorio. Valgono uguali per
   Ada, Teo e chi gioca: il pane che sforni finisce davvero sugli scaffali
   del Forno, la piazza che pulisci torna pulita per tutti.
   - La bacheca "Cerchiamo personale" dentro Caffetteria, Forno, Fioraio e
     Ambulatorio (src/borgo/interni.js) e quella in piazza, accanto alla
     Porta del Borgo, aprono questa scheda.
   - Un turno dura 20 minuti veri; si resta nel posto di lavoro. Paga
     4 Starlight al minuto (80 a turno), il tempo davvero lavorato.
   - In piazza compaiono le cartacce quando nessuno la pulisce.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, G = window.Gioco, PI = Math.PI;
  const S = { el: null, dove: null, mio: null, ping: null, timer: null, cartacce: null, nCart: -1, bacheca: false, nota: '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SL = () => (B.ECONOMIA ? B.ECONOMIA.moneta.nome : 'Starlight');
  const A = () => B.AgentiIA || {};
  const app = () => B.app;
  const dati = () => (A().dati && A().dati.lavori) || null;
  const stanzaIo = () => { const st = app() && app().stanza(); return st ? st.luogo || st.id : ''; };
  const ICONE = { fornaio: '🥖', pasticcere: '🥐', barista: '☕', fioraio: '💐', facchino: '📦', bibliotecario: '📚', spazzino: '🧹', giardiniere: '🌱', muratore: '🧱', segretario: '🗂️' };
  const ora = () => +new Date().toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }) % 24;

  /* ---------- la scheda ---------- */
  function chiudi() { if (S.el) { S.el.remove(); S.el = null; } }
  function apri(dove) {
    chiudi(); S.dove = dove || null;
    const el = document.createElement('div'); el.id = 'lavoro-scheda';
    el.style.cssText = 'position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,440px);max-height:66vh;overflow:auto;z-index:60;background:#2a1f36;color:#ffe9c4;border:2px solid #f2c76e;border-radius:16px;padding:14px 16px;font-family:sans-serif;font-size:14px;line-height:1.35;box-shadow:0 8px 30px rgba(0,0,0,.45)';
    el.innerHTML = '<button aria-label="Chiudi" class="lv-x" style="position:absolute;right:8px;top:6px;background:none;border:0;color:#ffe9c4;font-size:22px;cursor:pointer">×</button><div class="lv-corpo"></div>';
    el.querySelector('.lv-x').addEventListener('click', chiudi);
    ['pointerdown', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    (document.getElementById('app') || document.body).appendChild(el);
    S.el = el; disegna();
  }
  const btn = (cls, txt, pieno, extra) => `<button class="${cls}" ${extra || ''} style="margin-top:6px;width:100%;padding:8px;border-radius:10px;border:${pieno ? '0' : '2px solid #f2c76e'};background:${pieno ? '#f2c76e' : 'none'};color:${pieno ? '#2a1a2e' : '#ffe9c4'};font-weight:700;font-size:14px;cursor:pointer">${txt}</button>`;
  function disegna() {
    const el = S.el; if (!el) return;
    const d = dati(), corpo = el.querySelector('.lv-corpo');
    if (!d) { corpo.innerHTML = '<div style="font-size:18px;font-weight:700">📋 Cerchiamo personale</div><p>Il borgo degli agenti non risponde: riprova tra poco.</p>'; return; }
    const tutti = Object.entries(d.mestieri), qui = S.dove === 'impresa' ? tutti.filter(([k]) => k === 'muratore') : S.dove ? tutti.filter(([, m]) => m.stanza === S.dove) : tutti;
    const h = ora();
    let s = (S.dove === 'impresa' && B.Impresa ? B.Impresa.intestazione() : '') + `<div style="font-size:19px;font-weight:700">📋 Cerchiamo personale${S.dove === 'impresa' ? ' · Edilborgo' : S.dove && app().stanze[S.dove] ? ' · ' + esc(app().stanze[S.dove].nome) : ''}</div>
      <div style="opacity:.85;font-size:12px;margin:2px 0 8px">Turno di ${d.turnoGiocatoreMin} minuti, paga ${d.pagaGiocatoreMin} ${SL()} al minuto (${d.turnoGiocatoreMin * d.pagaGiocatoreMin} a turno). Quello che fai resta nel borgo, per tutti: lo vedono anche Ada e Teo. Orari di Roma.</div>`;
    if (S.mio) {
      const m = d.mestieri[S.mio.mestiere], resta = Math.max(0, Math.ceil((S.mio.fine - Date.now()) / 60000));
      s += `<div style="background:#1f1729;border-radius:10px;padding:8px 10px;margin-bottom:6px">${ICONE[S.mio.mestiere] || '🧰'} Stai lavorando da <b>${esc(m ? m.nome : S.mio.mestiere)}</b>: mancano ${resta} minuti. Non allontanarti.</div>` + btn('lv-smetti', 'Smetti (ti pagano il tempo lavorato)', false);
    }
    qui.forEach(([k, m]) => {
      const oggi = !m.giorni || m.giorni.includes(new Date().getDay());
      const aperto = m.aperto && oggi && h >= m.dalle && h < m.alle, pieno = m.occupati >= m.posti;
      const stato = !m.aperto ? 'nessun cantiere aperto' : !oggi ? 'oggi è chiuso' : !aperto ? `si lavora dalle ${m.dalle} alle ${m.alle}` : pieno ? 'posto occupato' : `${m.posti - m.occupati} post${m.posti - m.occupati > 1 ? 'i liberi' : 'o libero'}`;
      s += `<div style="border-top:1px solid #4a3d5e;margin-top:8px;padding-top:8px"><b>${ICONE[k] || '🧰'} ${esc(m.nome)}</b> <span style="opacity:.75;font-size:12px">· ${esc(m.luogo)} · ${m.dalle}-${m.alle}${m.giorni ? ' lun-sab' : ''}</span>
        <div style="font-size:13px;opacity:.9">${esc(m.descrizione)}</div><div style="font-size:12px;opacity:.75">${esc(stato)}</div>` +
        (!S.mio && aperto && !pieno ? btn('lv-inizia', '🧑‍🔧 Fai un turno da ' + esc(m.nome), true, `data-m="${k}"`) : '') + '</div>';
    });
    if (!S.dove) s += `<div style="margin-top:10px;font-size:12px;opacity:.8">${d.sporcizia >= 45 ? '🧹 La piazza è sporca (' + d.sporcizia + '/100): serve uno spazzino.' : '✨ La piazza è pulita (' + d.sporcizia + '/100).'}</div>`;
    s += `<div class="lv-nota" style="font-size:13px;margin-top:8px">${esc(S.nota)}</div>`;
    corpo.innerHTML = s;
    corpo.querySelectorAll('.lv-inizia').forEach(b => b.addEventListener('click', () => inizia(b.dataset.m)));
    const sm = corpo.querySelector('.lv-smetti'); if (sm) sm.addEventListener('click', () => finisci(false, 'Hai smesso di lavorare'));
  }
  const nota = t => { S.nota = t; const x = S.el && S.el.querySelector('.lv-nota'); if (x) x.textContent = t; };

  /* ---------- il turno ---------- */
  // dove si lavora: dentro l'edificio giusto, oppure in piazza per i mestieri all'aperto
  const postoGiusto = m => (m.stanza ? stanzaIo() === m.stanza : stanzaIo() === 'piazza');
  async function inizia(k) {
    const d = dati(), m = d && d.mestieri[k]; if (!m) return;
    if (!A().mioNick || !A().mioNick()) return nota('Prima scegli il tuo nome nel gioco.');
    if (!postoGiusto(m)) return nota(m.stanza ? `Per fare il ${m.nome} devi essere dentro: ${m.luogo}.` : `Il ${m.nome} lavora in piazza: esci prima.`);
    nota('...');
    let r; try { r = await A().chiama('/dipendente', { mestiere: k, on: true }); } catch (e) { return nota('Il borgo degli agenti non risponde, riprova tra poco.'); }
    if (!r || !r.ok) return nota((r && r.motivo) || 'Non si può, riprova.');
    S.mio = { mestiere: k, fine: r.fine, stanza: stanzaIo() };
    G.emetti('toast', `${ICONE[k] || '🧰'} Turno da ${m.nome} iniziato: ${d.turnoGiocatoreMin} minuti`);
    clearInterval(S.ping); clearTimeout(S.timer);
    S.ping = setInterval(() => {
      if (!S.mio) return clearInterval(S.ping);
      if (stanzaIo() !== S.mio.stanza) return finisci(false, 'Ti sei allontanato dal lavoro: turno finito');
      A().chiama('/dipendente', { mestiere: S.mio.mestiere, on: true }).catch(() => { });
      disegna();
    }, 90000);
    S.timer = setTimeout(() => finisci(true, 'Turno finito!'), Math.max(1000, r.fine - (Date.now() + (A().scarto || 0))));
    nota(''); disegna();
    if (A().aggiorna) A().aggiorna();
  }
  async function finisci(completo, msg) {
    if (!S.mio) return;
    const k = S.mio.mestiere; S.mio = null; clearInterval(S.ping); clearTimeout(S.timer);
    let r = null; try { r = await A().chiama('/dipendente', completo ? { mestiere: k, fine: true } : { mestiere: k, on: false }); } catch (e) { /* pazienza */ }
    if (r && r.ok && r.paga > 0 && B.Eco) B.Eco.add(r.paga, 'piazza');
    G.emetti('toast', `${ICONE[k] || '🧰'} ${msg}` + (r && r.paga ? ` +${r.paga} ${SL()}` : '') + (r && r.effetto ? ' · ' + r.effetto : ''));
    nota(r && r.effetto ? r.effetto : ''); disegna();
    if (A().aggiorna) A().aggiorna();
  }
  G.su && G.su('stanza', () => { if (S.mio && stanzaIo() !== S.mio.stanza) finisci(false, 'Sei uscito dal posto di lavoro: turno finito'); if (S.el) chiudi(); });

  /* ---------- in piazza: la bacheca accanto alla Porta del Borgo e le cartacce ---------- */
  function bacheca(a) {
    if (S.bacheca || !a || !a.piazza) return; S.bacheca = true;
    let x = 4.6, z = 37.2; for (const p of [[4.6, 37.2], [-4.6, 37.2], [5.5, 35.5], [-5.5, 35.5]]) if (a.libero(a.stanze.piazza, p[0], p[1], 0.8)) { x = p[0]; z = p[1]; break; }
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = x > 0 ? -0.5 : 0.5; a.gP.add(g);
    [-0.55, 0.55].forEach(dx => g.add(B.mesh(new T.BoxGeometry(0.1, 1.8, 0.1), M('#6b4326'), { x: dx, y: 0.9, z: 0, l: 0.01 })));
    g.add(B.mesh(new T.BoxGeometry(1.4, 1.0, 0.08), M('#a07a4a'), { y: 1.45, z: 0, lb: 0.012 }));
    const [cv, c] = B.tela(256, 180); c.fillStyle = '#f4ead6'; c.fillRect(0, 0, 256, 180); c.fillStyle = '#5a3a22'; c.textAlign = 'center'; c.font = 'bold 30px sans-serif'; c.fillText('LAVORO', 128, 58); c.font = 'bold 22px sans-serif'; c.fillText('Cerchiamo personale', 128, 100); c.font = '20px sans-serif'; c.fillText('fornaio · spazzino · muratore…', 128, 140);
    const f = new T.Mesh(new T.PlaneGeometry(1.26, 0.88), new T.MeshBasicMaterial({ map: B.tex(cv) })); f.position.set(0, 1.45, 0.05); g.add(f);
    const tocco = new T.Mesh(new T.BoxGeometry(1.5, 2, 0.6), new T.MeshBasicMaterial()); tocco.visible = false; tocco.position.y = 1; g.add(tocco);
    g.updateMatrixWorld(true);
    a.piazza.ostacoli.push({ t: 'c', x, z, r: 0.6 });
    a.piazza.toccabili.push({ obj: tocco, fn: () => apri(null) });
    a.piazza.porte.push({ id: 'porta-bacheca-lavoro', nome: 'Bacheca del lavoro', x: x + (x > 0 ? -0.4 : 0.4), z: z + 0.9, r: 1.0, testo: '📋 Cerchiamo personale', fn: () => apri(null) });
  }
  function cartacce(a, n) {
    n = Math.max(0, Math.min(40, Math.round(n)));
    if (n === S.nCart) return; S.nCart = n;
    if (!S.cartacce) {
      S.cartacce = new T.Group(); a.gP.add(S.cartacce);
      // sempre negli stessi posti (seme fisso), solo dove si cammina
      let k = 7; const rnd = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
      const colori = ['#f4f1ea', '#e8d8a0', '#c8d8e8', '#e0b0a0', '#a8c890'];
      for (let i = 0, prove = 0; i < 40 && prove < 600; prove++) {
        const x = -40 + rnd() * 80, z = 2 + rnd() * 62; if (!a.libero(a.stanze.piazza, x, z, 0.3)) continue;
        const m = new T.Mesh(i % 3 ? new T.PlaneGeometry(0.22, 0.16) : new T.CircleGeometry(0.1, 6), new T.MeshBasicMaterial({ color: colori[i % colori.length], side: T.DoubleSide }));
        m.rotation.x = -PI / 2 + (rnd() - 0.5) * 0.4; m.rotation.z = rnd() * PI * 2; m.position.set(x, 0.03, z); m.visible = false; S.cartacce.add(m); i++;
      }
    }
    S.cartacce.children.forEach((m, i) => { m.visible = i < n; });
    S.cartacce.updateMatrixWorld(true);
  }
  function frame() {
    const a = app(); if (!a || !a.gP) return;
    bacheca(a);
    const d = dati(); if (d) cartacce(a, d.sporcizia >= 30 ? (d.sporcizia - 25) / 75 * 40 : 0);
    if (S.el && !S.mio) disegna();
  }
  setInterval(frame, 5000);
  setTimeout(frame, 1500);
  B.Lavoro = { apri, chiudi, stato: S };
})();
