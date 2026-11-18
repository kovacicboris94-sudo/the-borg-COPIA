/* =====================================================================
   IL COMPAGNO CLAUDE
   Un Claude collegato con il codice del giocatore entra nella sua stanza amici
   come un giocatore in piu': stessa presenza degli altri telefoni (posizione,
   look, chat, emote, messaggi privati), quindi il gioco lo disegna senza
   bisogno di niente di nuovo. Il server gli mette ai: 1 nella presenza e il
   gioco gli scrive accanto 🤖.
   Il compagno segue il suo giocatore (o va da qualcun altro), legge la chat
   del luogo dove si trova, i sussurri e i messaggi privati per lui, e parla
   quando Claude usa gli strumenti MCP (vedi mcp.mjs).
   Esce da solo se per 30 minuti nessuno lo usa o se il suo giocatore non e'
   nella stanza da 3 minuti.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// il client del gioco e il filtro della chat sono script per il browser: li carichiamo cosi' come sono
globalThis.window = globalThis;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => { } };
if (!globalThis.B3 || !globalThis.B3.stanzaNakama) new Function(readFileSync(new URL('../client/nakama-stanza.js', import.meta.url), 'utf8'))();
function caricaFiltro() {
  for (const p of ['../../src/chat/filtro.js', '../filtro.js']) {
    try { const ctx = {}; vm.runInNewContext(readFileSync(new URL(p, import.meta.url), 'utf8'), ctx); return ctx.FiltroChat; } catch (e) { }
  }
  return null;
}
export const Filtro = caricaFiltro();

export const LOOK_CLAUDE = { pelle: 2, stile: 4, capelli: 11, occhi: 2, giacca: 5, dettagli: 3, abito: 2, pantaloni: 3, stivali: 1, accessorio: 0 };
export const EMOTE = ['saluta', 'balla', 'ridi', 'applaudi', 'evviva'];
const GIOCHI = { kart: 'sui go-kart', paintball: 'a paintball', raid: 'nella Cripta', carte: 'a Belinverse', bubble: 'a Borg Bubble', nascondino: 'a nascondino', scacchi: 'a scacchi', fronte: 'al Fronte della Cometa' };
const LUOGHI = { piazza: 'Piazza del Borgo', negozio: 'Negozio', biblioteca: 'Biblioteca', scacchi: 'Casa degli Scacchi', collectibles: 'Laugh Tale Collectibles', tcg: 'Sala giochi TCG', sala: 'Sala Giochi' };
const MAX_CHAT = 120, MAX_DM = 200, PASSO = 0.1, LENTO = 4.2, VICINO = 1.6;
const INATTIVO_MS = 30 * 60 * 1000, SENZA_GIOCATORE_MS = 3 * 60 * 1000, MAX_LOG = 80;

const testo = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, ' ').trim().slice(0, n);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const uguali = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const maxN = x => (x && Array.isArray(x.l) ? x.l.reduce((m, e) => Math.max(m, num(e && e.n, 0)), 0) : 0);
const ora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const metri = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function nomeLuogo(s) {
  s = String(s || '');
  if (s.indexOf('casa:') === 0) return 'a casa di ' + s.slice(5);
  if (GIOCHI[s]) return 'sta giocando ' + GIOCHI[s];
  if (LUOGHI[s]) return LUOGHI[s];
  return s ? s : 'da qualche parte';
}

// spezza un testo lungo in pezzi da massimo n caratteri, tra una parola e l'altra
export function spezza(t, n, max) {
  const out = []; let s = t.trim();
  while (s && out.length < max) {
    if (s.length <= n) { out.push(s); break; }
    let i = s.lastIndexOf(' ', n); if (i < n * 0.5) i = n;
    out.push(s.slice(0, i).trim()); s = s.slice(i).trim();
  }
  return { pezzi: out, avanza: s.length > 0 && out.length >= max && out.join(' ').length < t.trim().length };
}

export class Compagno {
  /* opz: { server, riscatta(codice) -> dati di claude_usa, codice, log } */
  constructor(opz) {
    this.opz = opz; this.codice = opz.codice;
    this.vivo = true; this.motivo = null; this.dati = null; this.stanza = null;
    this.persone = new Map();            // id -> { nick, p, ai }
    this.registro = []; this.nReg = 0; this.letti = 0; this.attese = [];
    this.io = null;                       // { x, z, y, r, s, vel, vx, vz }
    this.obiettivo = { tipo: 'segui' };   // segui (il giocatore) | raggiungi (id) | fermo
    const base = Math.floor(Date.now() / 1000);
    this.nMsg = base; this.nEm = base; this.nDm = base; this.mieiDm = []; this.q = 0;
    this.ultimoInvio = ''; this.usato = Date.now(); this.giocatoreVisto = Date.now();
    this.limite = Filtro ? Filtro.creaLimitatore({ minimo: 1000, finestra: 15000, massimo: 6, pausa: 8000 }) : null;
    this.coda = Promise.resolve();
  }

  async avvia() {
    this.dati = await this.opz.riscatta(this.codice);
    let primo = this.dati.token;
    this.stanza = globalThis.B3.stanzaNakama(this.dati.stanza, this.opz.server, {
      dispositivo: 'claude', fine: m => this.fine(m),
      accedi: async () => {
        if (primo) { const t = primo; primo = null; return { token: t }; }
        try { const d = await this.opz.riscatta(this.codice); this.dati = d; return { token: d.token }; }
        catch (e) { if (/sbagliato|scaduto/.test(e.message)) { const f = new Error(e.message); f.fine = true; throw f; } throw e; }
      }
    });
    this.stanza.onPeers(ch => this.cambi(ch));
    this.tic = setInterval(() => this.passo(), PASSO * 1000);
    // aspetta di essere davvero nella stanza
    const t0 = Date.now();
    while (this.vivo && !(this.stanza.stato().aperto) && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 100));
    if (!this.vivo) throw new Error(this.motivo || 'collegamento non riuscito');
    if (!this.stanza.stato().aperto) { this.fine('il server non risponde'); throw new Error('il server di The Borg non risponde, riprova tra poco'); }
    await new Promise(r => setTimeout(r, 400));   // arriva l'elenco di chi c'e'
    return this;
  }

  get nickClaude() { return this.dati ? this.dati.nickClaude : 'Claude'; }
  get nickGiocatore() { return this.dati ? this.dati.nick : ''; }
  get giocatore() { return this.dati ? this.persone.get(this.dati.di) : null; }
  tocca() { this.usato = Date.now(); }

  fine(motivo) {
    if (!this.vivo) return;
    this.vivo = false; this.motivo = motivo || 'scollegato';
    clearInterval(this.tic);
    if (this.stanza) try { this.stanza.chiudi(); } catch (e) { }
    this.attese.forEach(f => f()); this.attese = [];
    if (this.opz.log) this.opz.log('compagno di ' + this.nickGiocatore + ' uscito: ' + this.motivo);
  }

  /* ---------- quello che arriva dagli altri ---------- */
  scrivi(voce) {
    voce.n = ++this.nReg; voce.ora = ora();
    this.registro.push(voce); if (this.registro.length > MAX_LOG) this.registro.shift();
    if (voce.tipo !== 'evento') { const a = this.attese; this.attese = []; a.forEach(f => f()); }
  }
  cambi(ch) {
    ch.left.forEach(v => { const p = this.persone.get(v.peer); if (p) { this.persone.delete(v.peer); this.scrivi({ tipo: 'evento', testo: p.nick + ' è uscito dalla stanza' }); } });
    ch.joined.concat(ch.updated).forEach(v => {
      const pr = v.presence; if (!pr || pr.v !== 1) return;
      let p = this.persone.get(v.peer);
      const nick = testo(pr.nick, 20) || 'Amico';
      if (!p) {
        // chi c'e' gia': i suoi messaggi vecchi non sono nuovi
        p = { id: v.peer, nick, p: pr, ai: pr.ai === 1, nMsg: pr.msg ? pr.msg.n : 0, nDm: maxN(pr.dm), nEm: pr.em ? pr.em.n : 0 };
        this.persone.set(v.peer, p);
        if (ch.joined.length && this.io) this.scrivi({ tipo: 'evento', testo: nick + (p.ai ? ' (un altro Claude)' : '') + ' è entrato nella stanza' });
        return;
      }
      p.nick = nick; p.p = pr; p.ai = pr.ai === 1;
      const mio = this.io && this.io.s;
      if (pr.msg && pr.msg.n !== p.nMsg) {
        p.nMsg = pr.msg.n;
        const t = this.filtra(testo(pr.msg.t, MAX_CHAT)), dest = testo(pr.msg.a, 20);
        if (t && mio && uguali(pr.s, mio) && (!dest || uguali(dest, this.nickClaude)))
          this.scrivi({ tipo: dest ? 'sussurro' : 'chat', da: nick, giocatore: v.peer === this.dati.di, testo: t, lontano: !dest && this.io && metri(this.io, { x: num(pr.x, 0), z: num(pr.z, 0) }) > 14 });
      }
      if (pr.dm && Array.isArray(pr.dm.l)) pr.dm.l.slice(-3).forEach(e => {
        if (!e || num(e.n, 0) <= p.nDm) return;
        p.nDm = num(e.n, 0);
        const t = this.filtra(testo(e.t, MAX_DM));
        if (t && uguali(testo(e.a, 20), this.nickClaude)) this.scrivi({ tipo: 'privato', da: nick, giocatore: v.peer === this.dati.di, testo: t });
      });
      if (pr.em && pr.em.n !== p.nEm) {
        p.nEm = pr.em.n;
        if (EMOTE.includes(pr.em.t) && mio && uguali(pr.s, mio) && this.io && metri(this.io, { x: num(pr.x, 0), z: num(pr.z, 0) }) < 14) this.scrivi({ tipo: 'evento', testo: nick + ' fa l\'emote "' + pr.em.t + '"' });
      }
    });
  }
  filtra(t) { return t && Filtro ? Filtro.ricevuto(t) : t; }

  /* ---------- movimento: 10 volte al secondo ---------- */
  passo() {
    if (!this.vivo) return;
    const adesso = Date.now();
    if (adesso - this.usato > INATTIVO_MS) return this.fine('nessuno lo usa da 30 minuti');
    const g = this.giocatore;
    if (g) this.giocatoreVisto = adesso;
    else if (adesso - this.giocatoreVisto > SENZA_GIOCATORE_MS) return this.fine(this.nickGiocatore + ' non è nella stanza amici da 3 minuti');

    const ob = this.obiettivo, chi = ob.tipo === 'segui' ? g : ob.tipo === 'raggiungi' ? this.persone.get(ob.id) : null;
    if (!this.io) {
      if (!g || GIOCHI[g.p.s]) return;   // prima di comparire aspetta il suo giocatore, fuori dai minigiochi
      this.io = this.vicinoA(g.p);
    }
    const io = this.io;
    io.vel = 0; io.vx = 0; io.vz = 0;
    if (chi && !GIOCHI[chi.p.s] && chi.p.s !== 'casa') {
      const t = { x: num(chi.p.x, 0), z: num(chi.p.z, 0), y: num(chi.p.y, 0) }, d = metri(io, t);
      if (!uguali(io.s, chi.p.s) || d > 15) {
        Object.assign(io, this.vicinoA(chi.p));   // porta, altra stanza o troppo lontano: ricompare accanto a lui
        if (ob.tipo === 'raggiungi') this.obiettivo = { tipo: 'fermo' };
      } else if (d > VICINO + 0.6) {
        const vel = Math.max(LENTO, Math.min(9, num(chi.p.vel, 0) * 1.15)), passo = Math.min(d - VICINO, vel * PASSO);
        const ux = (t.x - io.x) / d, uz = (t.z - io.z) / d;
        io.x += ux * passo; io.z += uz * passo; io.y += (t.y - io.y) * 0.3;
        io.r = Math.atan2(ux, uz); io.vel = passo / PASSO; io.vx = ux * io.vel; io.vz = uz * io.vel;
      } else {
        io.r = Math.atan2(t.x - io.x, t.z - io.z);
        if (ob.tipo === 'raggiungi') this.obiettivo = { tipo: 'fermo' };
      }
    }
    this.invia();
  }
  vicinoA(p) {
    const r = num(p.r, 0), x = num(p.x, 0), z = num(p.z, 0);
    // un passo dietro e di lato (avanti = sin r, cos r)
    return { x: x - Math.sin(r) * 1.2 + Math.cos(r) * 0.9, z: z - Math.cos(r) * 1.2 - Math.sin(r) * 0.9, y: num(p.y, 0), r, s: String(p.s || 'piazza'), vel: 0, vx: 0, vz: 0 };
  }
  invia(extra) {
    if (!this.io || !this.stanza) return;
    const io = this.io, f = v => +v.toFixed(2);
    const p = { v: 1, nick: this.nickClaude, look: LOOK_CLAUDE, s: io.s, x: f(io.x), z: f(io.z), y: f(io.y), r: f(io.r), vel: f(io.vel), sed: 0, bk: 0,
      msg: this.ultimoMsg, em: this.ultimaEm, dm: this.mieiDm.length ? { l: this.mieiDm } : undefined };
    const k = JSON.stringify(p);
    if (k === this.ultimoInvio && !extra) return;
    this.ultimoInvio = k;
    Object.assign(p, { vx: f(io.vx), vz: f(io.vz), q: ++this.q, t: Math.round(performance.now()) });
    this.stanza.presence(p).catch(() => { });
  }

  /* ---------- quello che fa Claude (strumenti MCP) ---------- */
  pronto() {
    if (!this.vivo) throw new Error('Il compagno non è più nel borgo (' + this.motivo + '). Usa di nuovo "collega" con il codice.');
    if (!this.io) throw new Error(this.nickGiocatore + ' non è ancora nel borgo (o sta giocando a un minigioco): il compagno comparirà accanto a lui appena entra in piazza o in una stanza.');
  }
  controlla(t, n) {
    t = testo(t, 2000);
    if (!t) throw new Error('Il messaggio è vuoto');
    const r = Filtro ? Filtro.controlla(t) : { ok: true, testo: t };
    if (!r.ok) throw new Error('Il filtro della chat ha bloccato il messaggio: ' + r.avviso + ' (The Borg è per ragazzi dai 14 anni: niente dati personali, link o contenuti offensivi).');
    return r.testo;
  }
  async aspettaLimite(t) {
    if (!this.limite) return;
    for (let i = 0; i < 20; i++) {
      const no = this.limite.prova(t); if (!no) { this.limite.registra(t); return; }
      if (/già scritto/.test(no)) throw new Error('Hai appena scritto lo stesso messaggio');
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Troppi messaggi di fila: aspetta qualche secondo');
  }
  // chat del luogo, sussurro (a) o messaggio privato (privato)
  dici(t, a, privato) {
    this.tocca(); this.pronto();
    const pulito = this.controlla(t), dest = a ? this.persona(a) : null;
    if (a && !dest) throw new Error(testo(a, 20) + ' non è nella stanza amici. Usa "guarda" per vedere chi c\'è.');
    if (dest && !privato && !uguali(dest.p.s, this.io.s)) throw new Error(dest.nick + ' non è nel tuo stesso luogo: per un sussurro dovete essere vicini. Puoi mandargli un messaggio privato (privato: true).');
    const { pezzi, avanza } = spezza(pulito, privato ? MAX_DM : MAX_CHAT, 3);
    const lavoro = this.coda.then(async () => {
      for (const pz of pezzi) {
        await this.aspettaLimite(pz);
        if (!this.vivo) return;
        if (privato) { this.nDm++; this.mieiDm = this.mieiDm.concat({ n: this.nDm, a: dest.nick, t: pz }).slice(-3); }
        else { this.nMsg++; this.ultimoMsg = { n: this.nMsg, t: pz, a: dest ? dest.nick : undefined }; }
        this.invia(true);
      }
    });
    this.coda = lavoro.catch(() => { });
    return lavoro.then(() => ({ pezzi, avanza, dest: dest && dest.nick }));
  }
  emote(tipo) {
    this.tocca(); this.pronto();
    if (!EMOTE.includes(tipo)) throw new Error('Emote sconosciuta. Puoi usare: ' + EMOTE.join(', '));
    this.nEm++; this.ultimaEm = { n: this.nEm, t: tipo }; this.invia(true);
  }
  muovi(azione, nick) {
    this.tocca();
    if (!this.vivo) this.pronto();
    if (azione === 'segui') { this.obiettivo = { tipo: 'segui' }; return 'Ora segui ' + this.nickGiocatore + '.'; }
    if (azione === 'fermati') { this.obiettivo = { tipo: 'fermo' }; return 'Ti sei fermato qui.'; }
    if (azione === 'raggiungi') {
      const p = nick ? this.persona(nick) : this.giocatore;
      if (!p) throw new Error((nick ? testo(nick, 20) : this.nickGiocatore) + ' non è nella stanza amici.');
      if (GIOCHI[p.p.s]) throw new Error(p.nick + ' sta giocando ' + GIOCHI[p.p.s] + ': lì non puoi entrare.');
      if (String(p.p.s).indexOf('casa:') === 0 && !uguali(p.p.s, 'casa:' + this.nickGiocatore)) throw new Error(p.nick + ' è in una casa privata: puoi entrare solo in quella di ' + this.nickGiocatore + '.');
      this.obiettivo = { tipo: 'raggiungi', id: p.id };
      return 'Stai andando da ' + p.nick + ' (' + nomeLuogo(p.p.s) + '). Poi ti fermi lì: usa "segui" per tornare a seguire ' + this.nickGiocatore + '.';
    }
    throw new Error('Azione sconosciuta: usa segui, fermati o raggiungi');
  }
  persona(nick) { const k = testo(nick, 20).replace(/^@/, ''); for (const p of this.persone.values()) if (uguali(p.nick, k)) return p; return null; }

  // descrizione per Claude: dove sei, chi c'e', i messaggi nuovi
  descrivi(tuttiIMessaggi) {
    this.tocca();
    const r = [], io = this.io, g = this.giocatore;
    if (!this.vivo) return 'Il compagno non è più nel borgo (' + this.motivo + '). Usa di nuovo "collega" con il codice.';
    r.push('Sei "' + this.nickClaude + '", il compagno AI di ' + this.nickGiocatore + ' nella stanza amici "' + this.dati.stanza + '" di The Borg.');
    if (!io) r.push('Non sei ancora comparso: aspetti che ' + this.nickGiocatore + ' entri in piazza o in una stanza (fuori dai minigiochi).');
    else r.push('Ti trovi: ' + nomeLuogo(io.s) + '.');
    if (!g) r.push(this.nickGiocatore + ' in questo momento non è nella stanza.');
    else {
      const d = io && uguali(g.p.s, io.s) ? ', a ' + Math.round(metri(io, { x: num(g.p.x, 0), z: num(g.p.z, 0) })) + ' m da te' : '';
      r.push(this.nickGiocatore + ': ' + nomeLuogo(g.p.s) + d + (g.p.sed ? (g.p.sed === 2 ? ', sdraiato' : ', seduto') : num(g.p.vel, 0) > 0.5 ? ', in movimento' : '') + '.');
    }
    const altri = [...this.persone.values()].filter(p => !g || p.id !== g.id);
    if (altri.length) {
      const qui = io ? altri.filter(p => uguali(p.p.s, io.s)) : [], via = altri.filter(p => !qui.includes(p));
      if (qui.length) r.push('Qui con te: ' + qui.map(p => p.nick + (p.ai ? ' 🤖' : '') + ' (' + Math.round(metri(io, { x: num(p.p.x, 0), z: num(p.p.z, 0) })) + ' m)').join(', ') + '.');
      if (via.length) r.push('Altrove nella stanza: ' + via.map(p => p.nick + (p.ai ? ' 🤖' : '') + ' (' + nomeLuogo(p.p.s) + ')').join(', ') + '.');
    } else r.push('Non c\'è nessun altro nella stanza amici.');
    const ob = this.obiettivo;
    r.push(ob.tipo === 'segui' ? 'Stai seguendo ' + this.nickGiocatore + '.' : ob.tipo === 'fermo' ? 'Sei fermo.' : 'Stai andando da ' + ((this.persone.get(ob.id) || {}).nick || '?') + '.');
    const nuovi = this.registro.filter(v => tuttiIMessaggi || v.n > this.letti);
    this.letti = this.nReg;
    r.push('');
    r.push(nuovi.length ? (tuttiIMessaggi ? 'Ultimi messaggi:' : 'Novità dall\'ultima volta:') : 'Nessun messaggio nuovo.');
    nuovi.slice(-30).forEach(v => r.push(riga(v)));
    return r.join('\n');
  }
  // aspetta che qualcuno scriva (chat del luogo, sussurro o privato), al massimo "secondi"
  async aspetta(secondi) {
    this.tocca();
    if (!this.vivo) return this.descrivi();
    const c = v => v.n > this.letti && v.tipo !== 'evento';
    if (!this.registro.some(c)) await new Promise(ok => { const f = () => { clearTimeout(t); ok(); }, t = setTimeout(() => { this.attese = this.attese.filter(x => x !== f); ok(); }, secondi * 1000); this.attese.push(f); });
    this.tocca();
    return this.registro.some(c) ? this.descrivi() : 'Nessuno ha scritto in ' + secondi + ' secondi.\n\n' + this.descrivi();
  }
}

function riga(v) {
  if (v.tipo === 'evento') return '[' + v.ora + '] · ' + v.testo;
  const chi = v.da + (v.giocatore ? ' (il tuo giocatore)' : '');
  if (v.tipo === 'sussurro') return '[' + v.ora + '] ' + chi + ' ti sussurra: ' + v.testo;
  if (v.tipo === 'privato') return '[' + v.ora + '] ' + chi + ' ti scrive in privato: ' + v.testo;
  return '[' + v.ora + '] ' + chi + (v.lontano ? ' (lontano)' : '') + ': ' + v.testo;
}
