/* =====================================================================
   THE BORG: MODULO DEL SERVER NAKAMA
   Le "stanze amici": chi entra con lo stesso codice (?amici=CODICE) finisce
   nella stessa partita autoritativa. Il server tiene la presenza di ognuno
   (posizione, look, chat, emote, stato dei minigiochi: lo stesso oggetto che
   prima girava su PeerJS) e la manda agli altri della stanza.
   Al posto del "padrone di casa" PeerJS: la stanza vive sul server e non cade
   quando il primo telefono esce.

   Protocollo (dati JSON, op code):
     client -> server  1  presenza completa del giocatore (oggetto, max 8 KB)
     server -> client  1  { l: [[id, presenza], ...] }  presenze cambiate in questo tick
     server -> client  2  { io: id, l: [[id, presenza], ...] }  tutti, appena entri
     server -> client  3  { id }  un giocatore e' uscito
     server -> client  4  { motivo }  solo al compagno Claude: e' stato scollegato, non deve rientrare
   L'id di un giocatore e' il suo user id Nakama.

   CLAUDE NEL BORGO (vedi server/claude-mcp/):
     RPC claude_codice  (dal gioco)      { stanza, nick } -> { codice, scade }
     RPC claude_usa     (solo http_key)  { codice } -> { token, stanza, nick, di }
     RPC claude_revoca  (dal gioco)      {} -> {}   il compagno esce dalla stanza
   Il compagno e' un utente Nakama a parte (dispositivo "claude-<id del giocatore>")
   che solo il server puo' creare. Nella stanza il server mette nella sua presenza
   ai: 1 e di: <nick del giocatore>, e li toglie a tutti gli altri: nessuno puo'
   fingersi un Claude, e il Claude non puo' fingersi una persona.

   Runtime JavaScript di Nakama: le funzioni del match devono stare al livello
   piu' alto del file (niente arrow function o closure registrate).
   ===================================================================== */

var OP_PRESENZA = 1, OP_TUTTI = 2, OP_VIA = 3, OP_FINE = 4;
var TICK = 15;                 // aggiornamenti al secondo verso i telefoni
var MAX_GIOCATORI = 40;        // per stanza
var MAX_BYTE = 8192;           // presenza massima di un giocatore
var MAX_MSG_SECONDO = 40;      // oltre, i messaggi di quel giocatore si scartano
var VUOTA_SECONDI = 60;        // una stanza vuota si chiude dopo un minuto
var SISTEMA = '00000000-0000-0000-0000-000000000000';
var COLLEZIONE = 'stanze';
var CLAUDE_CODICI = 'claude_codici';     // codice -> { di, stanza, nick, scade }
var CLAUDE_DI = 'claude_di';             // id del giocatore -> { codice, compagno }
var CLAUDE_COMPAGNI = 'claude_compagni'; // id del compagno -> { di, stanza, nick }
var CLAUDE_ORE = 12;                     // un codice vale tanto
var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // niente 0/O e 1/I: si legge dal telefono

function codicePulito(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

/* ---------- RPC stanza_entra: { codice } -> { match_id } ----------
   Una sola partita per codice: il puntatore codice -> match sta nello storage
   e si scrive con controllo di versione, cosi' due telefoni che entrano nello
   stesso istante non creano due stanze diverse. */
function rpcStanzaEntra(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve una sessione');
  var dati = {};
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('payload non valido'); }
  var codice = codicePulito(dati.codice);
  if (!codice) throw Error('codice mancante');

  for (var giro = 0; giro < 3; giro++) {
    var letti = nk.storageRead([{ collection: COLLEZIONE, key: codice, userId: SISTEMA }]);
    var vecchio = letti.length ? letti[0] : null;
    if (vecchio && vecchio.value && vecchio.value.match_id && nk.matchGet(vecchio.value.match_id)) {
      return JSON.stringify({ match_id: vecchio.value.match_id });
    }
    var id = nk.matchCreate('stanza', { codice: codice });
    try {
      nk.storageWrite([{ collection: COLLEZIONE, key: codice, userId: SISTEMA, value: { match_id: id },
        version: vecchio ? vecchio.version : '*', permissionRead: 0, permissionWrite: 0 }]);
      return JSON.stringify({ match_id: id });
    } catch (e) {
      // qualcuno l'ha creata un attimo prima: si rilegge e si usa la sua (la nostra, vuota, si chiude da sola)
      logger.debug('stanza %s: creata in contemporanea, riprovo', codice);
    }
  }
  throw Error('stanza non disponibile, riprova');
}

/* ---------- la partita "stanza" ---------- */
function matchInit(ctx, logger, nk, params) {
  var codice = codicePulito(params && params.codice);
  return { state: { codice: codice, g: {}, vuota: 0 }, tickRate: TICK, label: JSON.stringify({ stanza: codice, n: 0 }) };
}

function contaGiocatori(state) { var n = 0; for (var k in state.g) n++; return n; }

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var gia = state.g[presence.userId];
  if (!gia && contaGiocatori(state) >= MAX_GIOCATORI) return { state: state, accept: false, rejectMessage: 'stanza piena' };
  var ai = compagnoDi(nk, presence.userId);
  if (ai && (ai.revocato || ai.stanza !== state.codice)) return { state: state, accept: false, rejectMessage: 'il Claude entra solo nella stanza del suo giocatore' };
  return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var pr = presences[i], gia = state.g[pr.userId];
    // stesso account da un'altra scheda o dopo una riconnessione: vale l'ultima
    if (gia && gia.presence.sessionId !== pr.sessionId) dispatcher.matchKick([gia.presence]);
    state.g[pr.userId] = { presence: pr, p: gia ? gia.p : null, cambiata: false, msg: 0, ai: gia ? gia.ai : compagnoDi(nk, pr.userId) };
    var l = [];
    for (var k in state.g) if (k !== pr.userId && state.g[k].p) l.push([k, state.g[k].p]);
    dispatcher.broadcastMessage(OP_TUTTI, JSON.stringify({ io: pr.userId, l: l }), [pr], null, true);
  }
  state.vuota = 0;
  dispatcher.matchLabelUpdate(JSON.stringify({ stanza: state.codice, n: contaGiocatori(state) }));
  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var pr = presences[i], g = state.g[pr.userId];
    if (!g || g.presence.sessionId !== pr.sessionId) continue;   // e' uscita la vecchia sessione, non quella attuale
    delete state.g[pr.userId];
    dispatcher.broadcastMessage(OP_VIA, JSON.stringify({ id: pr.userId }), null, null, true);
  }
  dispatcher.matchLabelUpdate(JSON.stringify({ stanza: state.codice, n: contaGiocatori(state) }));
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  if (tick % TICK === 0) for (var k in state.g) state.g[k].msg = 0;   // contatore anti-spam per secondo

  for (var i = 0; i < messages.length; i++) {
    var m = messages[i], g = state.g[m.sender.userId];
    if (!g || g.presence.sessionId !== m.sender.sessionId || m.opCode !== OP_PRESENZA) continue;
    if (++g.msg > MAX_MSG_SECONDO || !m.data || m.data.byteLength > MAX_BYTE) continue;
    var p = null;
    try { p = JSON.parse(nk.binaryToString(m.data)); } catch (e) { continue; }
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    // il segno "Claude" lo mette solo il server
    if (g.ai) { p.ai = 1; p.di = g.ai.nick; } else { delete p.ai; delete p.di; }
    g.p = p; g.cambiata = true;
  }

  // una sola spedizione per tick con tutte le presenze cambiate
  var l = [];
  for (var id in state.g) { var x = state.g[id]; if (x.cambiata) { x.cambiata = false; l.push([id, x.p]); } }
  if (l.length) dispatcher.broadcastMessage(OP_PRESENZA, JSON.stringify({ l: l }), null, null, true);

  if (contaGiocatori(state) === 0) { if (++state.vuota > VUOTA_SECONDI * TICK) return null; }
  else state.vuota = 0;
  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return { state: state }; }
// segnale { via: id }: il giocatore ha scollegato il suo Claude, il compagno esce subito
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  var d = {};
  try { d = JSON.parse(data || '{}'); } catch (e) { }
  var g = d.via && state.g[d.via];
  if (g && g.ai) {
    dispatcher.broadcastMessage(OP_FINE, JSON.stringify({ motivo: 'scollegato dal giocatore nel gioco' }), [g.presence], null, true);
    dispatcher.matchKick([g.presence]);
  }
  return { state: state, data: '' };
}

/* ---------- Claude nel borgo ---------- */
function leggi(nk, collezione, chiave) {
  var r = nk.storageRead([{ collection: collezione, key: chiave, userId: SISTEMA }]);
  return r.length ? r[0].value : null;
}
function scrivi(nk, collezione, chiave, valore) {
  nk.storageWrite([{ collection: collezione, key: chiave, userId: SISTEMA, value: valore, permissionRead: 0, permissionWrite: 0 }]);
}
function cancella(nk, collezione, chiave) {
  nk.storageDelete([{ collection: collezione, key: chiave, userId: SISTEMA }]);
}
function compagnoDi(nk, userId) {
  try { return leggi(nk, CLAUDE_COMPAGNI, userId); } catch (e) { return null; }
}
function nuovoCodice() {
  var c = '';
  for (var i = 0; i < 8; i++) c += ALFABETO.charAt(Math.floor(Math.random() * ALFABETO.length));
  return c.slice(0, 4) + '-' + c.slice(4);
}
function codiceClaude(s) {
  var c = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : '';
}
function nickPulito(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 20);
}
// fa uscire il compagno attuale del giocatore (se c'e') dalla sua stanza
function mandaViaCompagno(nk, logger, vecchio) {
  if (!vecchio || !vecchio.compagno) return;
  var c = compagnoDi(nk, vecchio.compagno);
  // il segno resta (revocato): con un vecchio token il compagno non puo' rientrare, nemmeno come persona
  scrivi(nk, CLAUDE_COMPAGNI, vecchio.compagno, { di: c ? c.di : '', stanza: c ? c.stanza : '', nick: c ? c.nick : '', revocato: true });
  var stanza = c && leggi(nk, COLLEZIONE, c.stanza);
  if (stanza && stanza.match_id && nk.matchGet(stanza.match_id)) {
    try { nk.matchSignal(stanza.match_id, JSON.stringify({ via: vecchio.compagno })); } catch (e) { logger.warn('claude: segnale non riuscito %s', e && e.message); }
  }
}

// dal gioco: un codice nuovo per collegare il proprio Claude (quello vecchio non vale piu')
function rpcClaudeCodice(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve una sessione');
  var dati = {};
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('payload non valido'); }
  var stanza = codicePulito(dati.stanza), nick = nickPulito(dati.nick);
  if (!stanza) throw Error('serve una stanza amici');
  if (!nick) throw Error('serve un nickname');
  var vecchio = leggi(nk, CLAUDE_DI, ctx.userId);
  if (vecchio && vecchio.codice) cancella(nk, CLAUDE_CODICI, vecchio.codice);
  mandaViaCompagno(nk, logger, vecchio);
  var codice = nuovoCodice(), scade = Date.now() + CLAUDE_ORE * 3600 * 1000;
  scrivi(nk, CLAUDE_CODICI, codice, { di: ctx.userId, stanza: stanza, nick: nick, scade: scade });
  scrivi(nk, CLAUDE_DI, ctx.userId, { codice: codice, compagno: null });
  return JSON.stringify({ codice: codice, scade: scade });
}

// dal servizio MCP (solo con la http_key del server): il codice diventa la sessione del compagno
function rpcClaudeUsa(ctx, logger, nk, payload) {
  if (ctx.userId) throw Error('non permesso');
  var dati = {};
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('payload non valido'); }
  var codice = codiceClaude(dati.codice);
  var c = codice && leggi(nk, CLAUDE_CODICI, codice);
  if (!c) throw Error('codice sbagliato');
  if (c.scade < Date.now()) { cancella(nk, CLAUDE_CODICI, codice); throw Error('codice scaduto'); }
  var nickClaude = (c.nick.slice(0, 11) + ' (Claude)');
  var acc = nk.authenticateDevice('claude-' + c.di, 'claude-' + c.di, true);
  scrivi(nk, CLAUDE_COMPAGNI, acc.userId, { di: c.di, stanza: c.stanza, nick: c.nick });
  scrivi(nk, CLAUDE_DI, c.di, { codice: codice, compagno: acc.userId });
  var t = nk.authenticateTokenGenerate(acc.userId, acc.username, Math.floor(Math.min(c.scade, Date.now() + 2 * 3600 * 1000) / 1000));
  return JSON.stringify({ token: t.token, stanza: c.stanza, nick: c.nick, nickClaude: nickClaude, di: c.di, scade: c.scade });
}

// dal gioco: "Scollega Claude"
function rpcClaudeRevoca(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve una sessione');
  var vecchio = leggi(nk, CLAUDE_DI, ctx.userId);
  if (vecchio && vecchio.codice) cancella(nk, CLAUDE_CODICI, vecchio.codice);
  mandaViaCompagno(nk, logger, vecchio);
  cancella(nk, CLAUDE_DI, ctx.userId);
  return '{}';
}

// i dispositivi "claude-..." li crea solo il server: un telefono non puo' entrare come il Claude di un altro
function primaDiAccedere(ctx, logger, nk, data) {
  var id = data && data.account && data.account.id;
  if (typeof id === 'string' && id.toLowerCase().indexOf('claude-') === 0) throw Error('dispositivo non valido');
  return data;
}

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('stanza_entra', rpcStanzaEntra);
  initializer.registerRpc('claude_codice', rpcClaudeCodice);
  initializer.registerRpc('claude_usa', rpcClaudeUsa);
  initializer.registerRpc('claude_revoca', rpcClaudeRevoca);
  initializer.registerBeforeAuthenticateDevice(primaDiAccedere);
  initializer.registerMatch('stanza', {
    matchInit: matchInit, matchJoinAttempt: matchJoinAttempt, matchJoin: matchJoin, matchLeave: matchLeave,
    matchLoop: matchLoop, matchTerminate: matchTerminate, matchSignal: matchSignal
  });
  logger.info('The Borg: modulo caricato (stanze amici, Claude nel borgo)');
}
