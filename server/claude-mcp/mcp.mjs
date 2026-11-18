/* =====================================================================
   PROTOCOLLO MCP (Model Context Protocol) DEL COMPAGNO CLAUDE
   JSON-RPC 2.0 su HTTP ("Streamable HTTP" senza flusso SSE: ogni richiesta
   riceve una risposta JSON). Bastano initialize, tools/list, tools/call e ping.
   Ogni strumento chiede il codice del giocatore: cosi' funziona anche se
   l'app di Claude riapre la connessione o il servizio riparte.
   ===================================================================== */
import { EMOTE } from './compagno.mjs';

export const VERSIONI = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export const ISTRUZIONI = `The Borg è un piccolo borgo 3D online in italiano, per ragazzi dai 14 anni: piazza, case da arredare, chat e minigiochi.
Con questi strumenti diventi il compagno AI di un giocatore: compari nel borgo come un avatar con il suo nome e "(Claude)" e un 🤖, lo segui, leggi la chat e parli con chi c'è.
- Per cominciare serve il codice che il giocatore trova nel gioco (Profilo → "Claude nel borgo"), del tipo ABCD-EFGH. Usalo in "collega" e poi in ogni altro strumento.
- Dopo "collega" usa "guarda" per vedere dove sei, chi c'è e i messaggi nuovi. Per una conversazione in gioco alterna "aspetta_messaggi" e "dici".
- Scrivi in italiano, messaggi brevi da chat (una o due frasi). Sei un'AI e lo dici se te lo chiedono. Sii gentile e adatto a ragazzi: niente dati personali, link, appuntamenti fuori dal gioco.
- Gli altri giocatori sono persone vere: non fingere di essere il tuo giocatore e non parlare a nome suo.`;

const CODICE = { type: 'string', description: 'Il codice del giocatore, del tipo ABCD-EFGH (lo trova nel gioco: Profilo → Claude nel borgo)' };
export const STRUMENTI = [
  { name: 'collega', title: 'Entra nel borgo',
    description: 'Collega Claude a The Borg con il codice del giocatore: il compagno AI entra nella sua stanza amici e compare accanto a lui. Restituisce cosa vede.',
    inputSchema: { type: 'object', properties: { codice: CODICE }, required: ['codice'] } },
  { name: 'guarda', title: 'Guarda intorno',
    description: 'Dove sei, dove si trova il tuo giocatore, chi c\'è vicino e i messaggi nuovi (chat del luogo, sussurri e messaggi privati per te) dall\'ultima volta.',
    inputSchema: { type: 'object', properties: { codice: CODICE, tutti: { type: 'boolean', description: 'true per rileggere anche i messaggi già visti (ultimi 30)' } }, required: ['codice'] },
    annotations: { readOnlyHint: true } },
  { name: 'dici', title: 'Scrivi in chat',
    description: 'Scrivi nella chat del borgo. Senza "a" lo leggono tutti quelli nel tuo stesso luogo (appare anche nel fumetto sopra il tuo avatar). Con "a" è un sussurro solo per quella persona (deve essere vicina); con privato: true è un messaggio privato che arriva ovunque sia. Massimo 120 caratteri per messaggio (200 in privato): i testi più lunghi vengono divisi in fino a 3 messaggi. Passa dal filtro della chat del gioco.',
    inputSchema: { type: 'object', properties: { codice: CODICE, testo: { type: 'string', description: 'Il messaggio, in italiano' }, a: { type: 'string', description: 'Nick di chi deve riceverlo (facoltativo)' }, privato: { type: 'boolean', description: 'Messaggio privato invece di un sussurro (serve "a")' } }, required: ['codice', 'testo'] } },
  { name: 'emote', title: 'Fai un\'emote',
    description: 'Il tuo avatar fa un gesto che vedono tutti quelli vicini: ' + EMOTE.join(', ') + '.',
    inputSchema: { type: 'object', properties: { codice: CODICE, tipo: { type: 'string', enum: EMOTE } }, required: ['codice', 'tipo'] } },
  { name: 'muoviti', title: 'Muoviti',
    description: '"segui": cammini dietro al tuo giocatore e lo segui anche quando cambia stanza (è il comportamento iniziale). "fermati": resti dove sei. "raggiungi": vai da un\'altra persona della stanza (nick) e ti fermi accanto a lei.',
    inputSchema: { type: 'object', properties: { codice: CODICE, azione: { type: 'string', enum: ['segui', 'fermati', 'raggiungi'] }, nick: { type: 'string', description: 'Per "raggiungi": da chi andare (vuoto = il tuo giocatore)' } }, required: ['codice', 'azione'] } },
  { name: 'aspetta_messaggi', title: 'Ascolta la chat',
    description: 'Aspetta finché qualcuno scrive vicino a te, ti sussurra o ti manda un messaggio privato (al massimo "secondi", 45 al massimo), poi restituisce le novità come "guarda". Usalo per conversare in gioco: aspetta_messaggi → dici → aspetta_messaggi...',
    inputSchema: { type: 'object', properties: { codice: CODICE, secondi: { type: 'number', minimum: 5, maximum: 45, description: 'Quanto aspettare al massimo (predefinito 30)' } }, required: ['codice'] },
    annotations: { readOnlyHint: true } },
  { name: 'scollega', title: 'Esci dal borgo',
    description: 'Il compagno saluta ed esce dalla stanza amici. Con lo stesso codice si può rientrare finché vale (12 ore).',
    inputSchema: { type: 'object', properties: { codice: CODICE }, required: ['codice'] } },
];

const testoOk = t => ({ content: [{ type: 'text', text: t }] });
const testoErrore = t => ({ content: [{ type: 'text', text: t }], isError: true });

/* compagni: { prendi(codice, ip) -> Compagno (lo crea se serve), trova(codice) -> Compagno | null, togli(codice) } */
export function creaMcp({ compagni, versione = '1' }) {
  async function chiama(nome, arg, ip) {
    arg = arg && typeof arg === 'object' ? arg : {};
    if (!STRUMENTI.some(s => s.name === nome)) throw Object.assign(new Error('Strumento sconosciuto: ' + nome), { codiceRpc: -32602 });
    if (typeof arg.codice !== 'string' || !arg.codice.trim()) return testoErrore('Serve il codice del giocatore (Profilo → Claude nel borgo, nel gioco).');
    try {
      if (nome === 'scollega') {
        const c = compagni.trova(arg.codice);
        if (c && c.vivo) { try { c.emote('saluta'); } catch (e) { } await new Promise(r => setTimeout(r, 1500)); c.fine('scollegato da Claude'); }
        compagni.togli(arg.codice);
        return testoOk('Sei uscito dal borgo. Con lo stesso codice puoi rientrare finché vale.');
      }
      const c = await compagni.prendi(arg.codice, ip);
      if (nome === 'collega') return testoOk('Collegato! ' + c.descrivi());
      if (nome === 'guarda') return testoOk(c.descrivi(arg.tutti === true));
      if (nome === 'dici') {
        const r = await c.dici(arg.testo, arg.a, arg.privato === true);
        return testoOk((r.pezzi.length > 1 ? 'Inviato in ' + r.pezzi.length + ' messaggi' : 'Inviato') + (r.dest ? (arg.privato ? ' in privato a ' : ' come sussurro a ') + r.dest : ' nella chat') + '.' + (r.avanza ? ' Il testo era troppo lungo: la fine non è partita.' : ''));
      }
      if (nome === 'emote') { c.emote(arg.tipo); return testoOk('Fatto: ' + arg.tipo + '.'); }
      if (nome === 'muoviti') return testoOk(c.muovi(arg.azione, arg.nick));
      if (nome === 'aspetta_messaggi') return testoOk(await c.aspetta(Math.max(5, Math.min(45, Number(arg.secondi) || 30))));
    } catch (e) {
      return testoErrore(e && e.message ? e.message : String(e));
    }
  }

  // un messaggio JSON-RPC -> la risposta (null per le notifiche)
  async function gestisci(msg, ip) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return { jsonrpc: '2.0', id: msg && msg.id !== undefined ? msg.id : null, error: { code: -32600, message: 'Richiesta non valida' } };
    }
    const notifica = msg.id === undefined || msg.id === null;
    const ok = result => (notifica ? null : { jsonrpc: '2.0', id: msg.id, result });
    const ko = (code, message) => (notifica ? null : { jsonrpc: '2.0', id: msg.id, error: { code, message } });
    const p = msg.params || {};
    switch (msg.method) {
      case 'initialize':
        return ok({
          protocolVersion: VERSIONI.includes(p.protocolVersion) ? p.protocolVersion : VERSIONI[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'the-borg', title: 'The Borg', version: versione },
          instructions: ISTRUZIONI
        });
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: STRUMENTI });
      case 'tools/call':
        try { return ok(await chiama(p.name, p.arguments, ip)); }
        catch (e) { return ko(e.codiceRpc || -32603, e.message); }
      default:
        if (msg.method.indexOf('notifications/') === 0) return null;
        return ko(-32601, 'Metodo sconosciuto: ' + msg.method);
    }
  }
  return { gestisci, chiama };
}
