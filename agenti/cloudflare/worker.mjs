// =====================================================================
//  IL BORGO DEGLI AGENTI su Cloudflare (piano Free, 0 euro)
//  - un "Durable Object" tiene lo stato del borgo e lo salva da solo;
//  - una sveglia (alarm) ogni 30 secondi fa scorrere il tempo e pensare gli agenti;
//  - AGENTI_PAUSA = 1 (variabile nel pannello di Cloudflare) li mette in pausa: niente pensieri, niente spese;
//  - la chiave di Anthropic sta nei segreti di Cloudflare (ANTHROPIC_API_KEY),
//    il gioco non la vede mai: riceve solo /stato e manda /parla, /regala, /turno, /vendi, /terreno e /banca;
//  - /registro e' l'archivio dell'esperimento: tutto quello che dicono, pensano e fanno, per sempre
//    (tabella SQLite del Durable Object, nessun costo di modello).
// =====================================================================
import { DurableObject } from 'cloudflare:workers';
import { nuovoStato, passo, vistaPubblica, giocatoreParla, giocatoreRegala, giocatoreTurno, giocatoreVende, giocatoreTerreno, cronaca, proposte } from '../motore.mjs';
import { cervelloClaude, cervelloFinto } from '../cervello.mjs';
import { osserva } from '../registro.mjs';

const PASSO_MS = 30 * 1000;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (v, stato = 200) => new Response(JSON.stringify(v), { status: stato, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) });

export class Borgo extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env; this.stato = null; this.voci = new Map();
    this.cervello = env.AGENTI_FINTI === '1' ? cervelloFinto(7) : cervelloClaude(env.ANTHROPIC_API_KEY);
  }
  async carica() {
    if (!this.stato) {
      this.stato = (await this.ctx.storage.get('stato')) || nuovoStato(Date.now());
      // la chiave e' appena arrivata: chi era fermo "senza chiave" riprova subito
      if (this.cervello) for (const ag of Object.values(this.stato.agenti)) if (ag.motivo === 'senza-chiave') ag.prossimoPensiero = Date.now();
    }
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + PASSO_MS);
    return this.stato;
  }
  // l'archivio: righe che non si cancellano mai. Se qualcosa va storto, gli agenti vanno avanti lo stesso.
  sql() {
    if (!this.tabella) {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS registro (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, tipo TEXT NOT NULL, chi TEXT, dati TEXT NOT NULL)');
      this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS registro_t ON registro (t)');
      this.tabella = true;
    }
    return this.ctx.storage.sql;
  }
  async archivia(s, ora) {
    try {
      const { righe, memo } = osserva(s, await this.ctx.storage.get('registroMemo'), ora);
      const sql = this.sql();
      for (const r of righe) sql.exec('INSERT INTO registro (t, tipo, chi, dati) VALUES (?, ?, ?, ?)', r.t, r.tipo, r.chi, JSON.stringify(r.dati));
      await this.ctx.storage.put('registroMemo', memo);
    } catch (e) { console.log('registro: ' + (e && e.message)); }
  }
  leggiRegistro(url) {
    const da = Math.max(0, +url.searchParams.get('da') || 0), max = Math.min(5000, Math.max(1, +url.searchParams.get('max') || 2000));
    const sql = this.sql();
    const righe = sql.exec('SELECT id, t, tipo, chi, dati FROM registro WHERE id > ? ORDER BY id LIMIT ?', da, max).toArray().map(r => ({ id: r.id, t: r.t, tipo: r.tipo, chi: r.chi, dati: JSON.parse(r.dati) }));
    const tot = sql.exec('SELECT COUNT(*) AS n, MAX(id) AS ultimo FROM registro').one();
    return { ora: Date.now(), totale: tot.n, ultimo: tot.ultimo || 0, righe };
  }
  async alarm() {
    const s = await this.carica();
    try { await passo(s, Date.now(), this.cervello, { pausa: this.env.AGENTI_PAUSA === '1' }); }
    finally {
      await this.ctx.storage.put('stato', s);
      await this.archivia(s, Date.now());
      await this.ctx.storage.setAlarm(Date.now() + PASSO_MS);
    }
  }
  async fetch(req) {
    const url = new URL(req.url), s = await this.carica();
    if (url.pathname === '/stato') return json(vistaPubblica(s, Date.now()));
    if (url.pathname === '/cronaca') return json({ ora: Date.now(), voci: cronaca(s, +url.searchParams.get('da') || 0) });
    if (url.pathname === '/registro') return json(this.leggiRegistro(url));
    if (url.pathname === '/proposte') return json({ ora: Date.now(), proposte: proposte(s) });
    if (url.pathname === '/parla' && req.method === 'POST') {
      // al massimo un messaggio ogni 8 secondi per chi scrive (cosi' nessuno svuota il budget degli agenti)
      const chi = req.headers.get('CF-Connecting-IP') || 'x', ora = Date.now();
      if (ora - (this.voci.get(chi) || 0) < 8000) return json({ ok: false, motivo: 'piano' }, 429);
      this.voci.set(chi, ora); if (this.voci.size > 500) this.voci.clear();
      let d = {}; try { d = await req.json(); } catch (e) { /* vuoto */ }
      const ok = giocatoreParla(s, d.nick, d.testo, d.x, d.z, ora, { stanza: d.stanza, a: d.a });
      if (ok) await this.ctx.storage.put('stato', s);
      return json({ ok });
    }
    if (url.pathname === '/regala' && req.method === 'POST') {
      // un mobile regalato a un abitante, posato in piazza: al massimo uno ogni 20 secondi per chi lo manda
      const chi = 'r' + (req.headers.get('CF-Connecting-IP') || 'x'), ora = Date.now();
      if (ora - (this.voci.get(chi) || 0) < 20000) return json({ ok: false, motivo: 'Aspetta qualche secondo prima di un altro regalo.' }, 429);
      this.voci.set(chi, ora); if (this.voci.size > 500) this.voci.clear();
      let d = {}; try { d = await req.json(); } catch (e) { /* vuoto */ }
      const r = giocatoreRegala(s, d.nick, d, ora);
      if (r.ok) await this.ctx.storage.put('stato', s);
      return json(r);
    }
    if ((url.pathname === '/turno' || url.pathname === '/vendi') && req.method === 'POST') {
      // il turno al bancone di una persona vera e le sue proposte ai clienti (al massimo una richiesta ogni 3 secondi)
      const chi = 't' + (req.headers.get('CF-Connecting-IP') || 'x'), ora = Date.now();
      if (ora - (this.voci.get(chi) || 0) < 3000) return json({ ok: false, motivo: 'Piano, un attimo.' }, 429);
      this.voci.set(chi, ora); if (this.voci.size > 500) this.voci.clear();
      let d = {}; try { d = await req.json(); } catch (e) { /* vuoto */ }
      const r = url.pathname === '/turno' ? giocatoreTurno(s, d.nick, d.negozio, d.on !== false, ora) : giocatoreVende(s, d.nick, d, ora);
      if (r.ok) await this.ctx.storage.put('stato', s);
      return json(r);
    }
    if ((url.pathname === '/terreno' || url.pathname === '/banca') && req.method === 'POST') {
      // comprare un terreno, aprire un cantiere, la banca (al massimo una richiesta ogni 2 secondi)
      const chi = 'l' + (req.headers.get('CF-Connecting-IP') || 'x'), ora = Date.now();
      if (ora - (this.voci.get(chi) || 0) < 2000) return json({ ok: false, motivo: 'Piano, un attimo.' }, 429);
      this.voci.set(chi, ora); if (this.voci.size > 500) this.voci.clear();
      let d = {}; try { d = await req.json(); } catch (e) { /* vuoto */ }
      const r = giocatoreTerreno(s, d.nick, d, ora);
      if (r.ok) await this.ctx.storage.put('stato', s);
      return json(r);
    }
    return json({ ok: true, borgo: 'Il Borgo degli Agenti', chiave: !!this.cervello, pausa: this.env.AGENTI_PAUSA === '1', agenti: Object.keys(s.agenti) });
  }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    return env.BORGO.get(env.BORGO.idFromName('borgo')).fetch(req);
  },
  // ogni 5 minuti: si controlla che la sveglia del borgo sia accesa
  async scheduled(evento, env) { await env.BORGO.get(env.BORGO.idFromName('borgo')).fetch('https://borgo/'); }
};
