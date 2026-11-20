// =====================================================================
//  IL BORGO DEGLI AGENTI su Cloudflare (piano Free, 0 euro)
//  - un "Durable Object" tiene lo stato del borgo e lo salva da solo;
//  - una sveglia (alarm) ogni 30 secondi fa scorrere il tempo e pensare gli agenti;
//  - AGENTI_PAUSA = 1 (variabile nel pannello di Cloudflare) li mette in pausa: niente pensieri, niente spese;
//  - la chiave di Anthropic sta nei segreti di Cloudflare (ANTHROPIC_API_KEY),
//    il gioco non la vede mai: riceve solo /stato e manda /parla.
// =====================================================================
import { DurableObject } from 'cloudflare:workers';
import { nuovoStato, passo, vistaPubblica, giocatoreParla, cronaca, proposte } from '../motore.mjs';
import { cervelloClaude, cervelloFinto } from '../cervello.mjs';

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
  async alarm() {
    const s = await this.carica();
    try { await passo(s, Date.now(), this.cervello, { pausa: this.env.AGENTI_PAUSA === '1' }); }
    finally {
      await this.ctx.storage.put('stato', s);
      await this.ctx.storage.setAlarm(Date.now() + PASSO_MS);
    }
  }
  async fetch(req) {
    const url = new URL(req.url), s = await this.carica();
    if (url.pathname === '/stato') return json(vistaPubblica(s, Date.now()));
    if (url.pathname === '/cronaca') return json({ ora: Date.now(), voci: cronaca(s, +url.searchParams.get('da') || 0) });
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
