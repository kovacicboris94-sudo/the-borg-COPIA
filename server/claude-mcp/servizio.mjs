/* =====================================================================
   THE BORG: SERVIZIO "CLAUDE NEL BORGO" (server MCP)
   Ognuno collega il SUO Claude (claude.ai, app, Claude Code) come connettore
   personalizzato con l'indirizzo https://<server>/mcp: niente API a pagamento,
   Claude lavora dentro l'abbonamento di chi lo usa.

     node server/claude-mcp/servizio.mjs

   Variabili d'ambiente:
     NAKAMA            indirizzo di Nakama visto da qui (predefinito http://127.0.0.1:7350)
     RUNTIME_HTTP_KEY  chiave server-to-server di Nakama (in locale: defaulthttpkey)
     PORTA             porta HTTP (predefinita 7352)
   Indirizzi:
     POST /mcp      protocollo MCP (vedi mcp.mjs)
     GET  /salute   { ok, compagni }
   ===================================================================== */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Compagno, Filtro } from './compagno.mjs';
import { creaMcp } from './mcp.mjs';

export function avviaServizio(opz = {}) {
  const NAKAMA = (opz.nakama || process.env.NAKAMA || 'http://127.0.0.1:7350').replace(/\/+$/, '');
  const CHIAVE = opz.chiave || process.env.RUNTIME_HTTP_KEY || 'defaulthttpkey';
  const PORTA = opz.porta != null ? opz.porta : +(process.env.PORTA || 7352);
  const MAX_COMPAGNI = 200, MAX_BODY = 64 * 1024;
  const log = opz.silenzioso ? () => { } : (...a) => console.log(new Date().toISOString(), ...a);
  if (!Filtro) throw new Error('manca il filtro della chat (src/chat/filtro.js)');

  // il codice del giocatore diventa la sessione del suo compagno (RPC claude_usa, solo con la http_key)
  async function riscatta(codice) {
    const r = await fetch(NAKAMA + '/v2/rpc/claude_usa?unwrap&http_key=' + encodeURIComponent(CHIAVE), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codice })
    });
    const t = await r.text();
    if (!r.ok) {
      let m = ''; try { m = JSON.parse(t).message || ''; } catch (e) { }
      if (/sbagliato/.test(m)) throw new Error('Codice sbagliato: controlla il codice nel gioco (Profilo → Claude nel borgo).');
      if (/scaduto/.test(m)) throw new Error('Codice scaduto: creane uno nuovo nel gioco (Profilo → Claude nel borgo).');
      throw new Error('Il server di The Borg non risponde (' + r.status + '), riprova tra poco.');
    }
    return JSON.parse(t);
  }

  // un compagno per codice; i tentativi con codici sbagliati sono limitati per indirizzo
  const compagni = new Map(), inArrivo = new Map(), sbagli = new Map();
  const chiave = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const registro = {
    trova: c => compagni.get(chiave(c)) || null,
    togli: c => compagni.delete(chiave(c)),
    async prendi(codice, ip) {
      const k = chiave(codice);
      const vivo = compagni.get(k); if (vivo && vivo.vivo) return vivo;
      if (inArrivo.has(k)) return inArrivo.get(k);
      const s = sbagli.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - s.t > 10 * 60 * 1000) { s.n = 0; s.t = Date.now(); }
      if (s.n >= 10) throw new Error('Troppi codici sbagliati: riprova tra qualche minuto.');
      if (k.length !== 8) { s.n++; sbagli.set(ip, s); throw new Error('Il codice ha 8 lettere e numeri, del tipo ABCD-EFGH.'); }
      for (const [kk, c] of compagni) if (!c.vivo) compagni.delete(kk);
      if (compagni.size >= MAX_COMPAGNI) throw new Error('Ci sono troppi Claude nel borgo in questo momento: riprova più tardi.');
      const p = new Compagno({ server: NAKAMA, codice: k, riscatta, log }).avvia()
        .then(c => { compagni.set(k, c); log('compagno di ' + c.nickGiocatore + ' entrato nella stanza ' + c.dati.stanza); return c; })
        .catch(e => { if (/sbagliato|scaduto|8 lettere/.test(e.message)) { s.n++; sbagli.set(ip, s); } throw e; })
        .finally(() => inArrivo.delete(k));
      inArrivo.set(k, p);
      return p;
    }
  };
  const mcp = creaMcp({ compagni: registro, versione: '1.0.0' });

  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID', 'Access-Control-Expose-Headers': 'Mcp-Session-Id' };
  const manda = (res, stato, corpo, h) => { res.writeHead(stato, Object.assign({}, CORS, corpo != null ? { 'Content-Type': 'application/json' } : {}, h || {})); res.end(corpo != null ? JSON.stringify(corpo) : undefined); };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), percorso = url.pathname.replace(/\/+$/, '') || '/';
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (req.method === 'OPTIONS') return manda(res, 204);
    if (percorso === '/salute' && req.method === 'GET') return manda(res, 200, { ok: true, compagni: [...compagni.values()].filter(c => c.vivo).length });
    if (percorso !== '/mcp') return manda(res, 404, { errore: 'non trovato' });
    // niente flusso SSE dal server: ogni risposta arriva nella risposta alla POST
    if (req.method === 'GET') return manda(res, 405, null, { Allow: 'POST, DELETE' });
    if (req.method === 'DELETE') return manda(res, 200);
    if (req.method !== 'POST') return manda(res, 405, null, { Allow: 'POST, DELETE' });
    let corpo = '', troppo = false;
    req.setEncoding('utf8');
    req.on('data', d => { corpo += d; if (corpo.length > MAX_BODY) { troppo = true; req.destroy(); } });
    req.on('end', async () => {
      if (troppo) return;
      let msg;
      try { msg = JSON.parse(corpo); } catch (e) { return manda(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON non valido' } }); }
      const lista = Array.isArray(msg) ? msg.slice(0, 20) : [msg];
      const risposte = (await Promise.all(lista.map(m => mcp.gestisci(m, ip)))).filter(Boolean);
      const h = lista.some(m => m && m.method === 'initialize') ? { 'Mcp-Session-Id': randomUUID() } : {};
      if (!risposte.length) return manda(res, 202, null, h);
      manda(res, 200, Array.isArray(msg) ? risposte : risposte[0], h);
    });
  });
  server.requestTimeout = 120000;
  return new Promise(ok => server.listen(PORTA, () => {
    log('The Borg: Claude nel borgo su http://localhost:' + server.address().port + '/mcp (Nakama ' + NAKAMA + ')');
    ok({ server, porta: server.address().port, compagni, chiudi: () => { compagni.forEach(c => c.fine('servizio chiuso')); server.close(); } });
  }));
}

if (import.meta.url === 'file://' + process.argv[1]) {
  avviaServizio().catch(e => { console.error(e); process.exit(1); });
  process.on('SIGTERM', () => process.exit(0));
}
