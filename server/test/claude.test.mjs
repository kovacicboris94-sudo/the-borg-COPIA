// Prova di "Claude nel borgo": un giocatore crea il codice, un Claude si collega
// con il protocollo MCP, entra nella stanza amici, segue, parla e ascolta.
//   cd server && docker compose up -d && node test/claude.test.mjs [host:porta]
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SERVER = process.argv[2] || '127.0.0.1:7350';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => { } };
new Function(readFileSync(new URL('../client/nakama-stanza.js', import.meta.url), 'utf8'))();
const { avviaServizio } = await import('../claude-mcp/servizio.mjs');

const aspetta = (cond, ms = 8000) => new Promise((ok, ko) => {
  const t0 = Date.now(), i = setInterval(() => { if (cond()) { clearInterval(i); ok(); } else if (Date.now() - t0 > ms) { clearInterval(i); ko(new Error('tempo scaduto')); } }, 50);
});
const pausa = ms => new Promise(r => setTimeout(r, ms));
function giocatore(nick, codice) {
  const visti = new Map(), usciti = [];
  const r = window.B3.stanzaNakama(codice, SERVER, { dispositivo: 'test-' + nick + '-' + Date.now() + Math.random() });
  r.onPeers(ch => { ch.joined.concat(ch.updated).forEach(p => visti.set(p.peer, p.presence)); ch.left.forEach(p => { visti.delete(p.peer); usciti.push(p.peer); }); });
  r.presence({ v: 1, nick, s: 'piazza', x: 0, z: 30, y: 0, r: 0, q: 1, t: 1 });
  return { r, visti, usciti, nick, claude: () => [...visti.values()].find(p => p.ai === 1) };
}

const srv = await avviaServizio({ nakama: 'http://' + SERVER, porta: 0, silenzioso: true });
const URL_MCP = 'http://127.0.0.1:' + srv.porta + '/mcp';
let nId = 0;
async function rpc(method, params) {
  const r = await fetch(URL_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++nId, method, params }) });
  assert.equal(r.status, 200); return r.json();
}
const usa = async (name, args) => { const r = await rpc('tools/call', { name, arguments: args }); assert.ok(r.result, JSON.stringify(r)); return { testo: r.result.content[0].text, errore: !!r.result.isError }; };

// --- protocollo MCP ---
const ini = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prova', version: '1' } });
assert.equal(ini.result.protocolVersion, '2025-06-18');
assert.equal(ini.result.serverInfo.name, 'the-borg');
assert.ok(ini.result.capabilities.tools);
const notif = await fetch(URL_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
assert.equal(notif.status, 202);
const lista = await rpc('tools/list', {});
assert.deepEqual(lista.result.tools.map(t => t.name), ['collega', 'guarda', 'dici', 'emote', 'muoviti', 'aspetta_messaggi', 'scollega']);
assert.equal((await fetch(URL_MCP)).status, 405);
console.log('ok  protocollo MCP: initialize, notifiche, elenco strumenti');

// --- codici ---
let r = await usa('collega', { codice: 'ABCD-EFGH' });
assert.ok(r.errore && /sbagliato/i.test(r.testo), r.testo);
console.log('ok  codice sbagliato rifiutato');

const stanza = 'claude' + Math.floor(Math.random() * 1e6);
const ugo = giocatore('Ugo', stanza), bea = giocatore('Bea', stanza);
await aspetta(() => ugo.r.stato().aperto && bea.visti.size === 1);
await assert.rejects(ugo.r.rpc('claude_codice', { stanza: '', nick: 'Ugo' }));
const { codice } = await ugo.r.rpc('claude_codice', { stanza, nick: 'Ugo' });
assert.match(codice, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
console.log('ok  il gioco crea il codice', codice);

// un telefono non puo' entrare come dispositivo "claude-..."
const finto = await fetch('http://' + SERVER + '/v2/account/authenticate/device?create=true', { method: 'POST', headers: { Authorization: 'Basic ' + btoa('defaultkey:'), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'claude-' + ugo.r.stato().mioId }) });
assert.notEqual(finto.status, 200);
// e nessuno puo' riscattare un codice senza la chiave del server
const senzaChiave = await fetch('http://' + SERVER + '/v2/rpc/claude_usa?unwrap&http_key=sbagliata', { method: 'POST', body: JSON.stringify({ codice }) });
assert.notEqual(senzaChiave.status, 200);
console.log('ok  dispositivi "claude-" e riscatto senza chiave bloccati');

// --- il compagno entra ---
r = await usa('collega', { codice: codice.toLowerCase().replace('-', ' ') });
assert.ok(!r.errore, r.testo);
assert.match(r.testo, /Ugo \(Claude\)/);
assert.match(r.testo, /Piazza del Borgo/);
assert.match(r.testo, /Bea/);
await aspetta(() => ugo.claude() && bea.claude());
const c = ugo.claude();
assert.equal(c.nick, 'Ugo (Claude)');
assert.equal(c.di, 'Ugo');
assert.equal(c.s, 'piazza');
assert.ok(Math.hypot(c.x - 0, c.z - 30) < 3, 'compare accanto a Ugo');
console.log('ok  il compagno compare accanto a Ugo, con il segno del server (ai, di)');

// un giocatore non puo' fingersi un Claude
bea.r.presence({ ai: 1, di: 'Ugo', q: 2 });
await pausa(500);
assert.equal(ugo.visti.get(bea.r.stato().mioId).ai, undefined);
console.log('ok  il segno "Claude" lo mette solo il server');

// --- segue Ugo ---
ugo.r.presence({ x: 6, z: 26, vel: 4, q: 3, t: 2 });
await aspetta(() => { const p = ugo.claude(); return p && Math.hypot(p.x - 6, p.z - 26) < 2.4 && p.vel === 0; });
ugo.r.presence({ s: 'biblioteca', x: 0, z: 6, q: 4, t: 3 });
await aspetta(() => { const p = ugo.claude(); return p && p.s === 'biblioteca'; });
console.log('ok  segue Ugo, anche quando cambia stanza');

// --- chat: Ugo scrive, Claude legge ---
ugo.r.presence({ msg: { n: 1, t: 'Ciao Claude, mi senti?' }, q: 5, t: 4 });
bea.r.presence({ msg: { n: 1, t: 'Io sono in piazza' }, q: 3, t: 5 });   // in un altro luogo: non si sente
await pausa(400);
r = await usa('guarda', { codice });
assert.match(r.testo, /Ugo \(il tuo giocatore\): Ciao Claude, mi senti\?/);
assert.doesNotMatch(r.testo, /Io sono in piazza/);
assert.match(r.testo, /Biblioteca/);
r = await usa('guarda', { codice });
assert.match(r.testo, /Nessun messaggio nuovo/);
console.log('ok  "guarda": luogo, persone, messaggi nuovi una volta sola');

// --- Claude risponde ---
r = await usa('dici', { codice, testo: 'Sì, ti sento! Che bella biblioteca.' });
assert.ok(!r.errore, r.testo);
await aspetta(() => { const p = ugo.claude(); return p && p.msg && p.msg.t === 'Sì, ti sento! Che bella biblioteca.'; });
r = await usa('dici', { codice, testo: 'scrivimi a mario.rossi@gmail.com' });
assert.ok(r.errore && /filtro/i.test(r.testo), r.testo);
r = await usa('dici', { codice, testo: 'Ugo, ' + 'questa frase è lunga '.repeat(9) + 'fine.' });
assert.match(r.testo, /in \d messaggi/);
await aspetta(() => /fine\.$/.test(ugo.claude().msg.t), 10000);
console.log('ok  "dici": chat, filtro (dati personali bloccati), testi lunghi divisi');

// sussurro e messaggio privato
r = await usa('dici', { codice, testo: 'Psst', a: 'Bea' });
assert.ok(r.errore && /stesso luogo/.test(r.testo), r.testo);
r = await usa('dici', { codice, testo: 'Ciao Bea, sono il Claude di Ugo', a: 'bea', privato: true });
assert.ok(!r.errore, r.testo);
await aspetta(() => { const p = bea.claude(); return p && p.dm && p.dm.l.some(e => e.a === 'Bea' && /Claude di Ugo/.test(e.t)); });
console.log('ok  sussurri solo vicino, messaggi privati ovunque');

// --- ascolta: aspetta_messaggi si sveglia quando qualcuno scrive ---
const t0 = Date.now();
const ascolto = usa('aspetta_messaggi', { codice, secondi: 20 });
await pausa(700);
bea.r.presence({ dm: { l: [{ n: 7, a: 'Ugo (Claude)', t: 'Ciao! Sei un robot?' }] }, q: 4, t: 6 });
r = await ascolto;
assert.ok(Date.now() - t0 < 6000, 'risponde appena arriva il messaggio');
assert.match(r.testo, /Bea ti scrive in privato: Ciao! Sei un robot\?/);
r = await usa('aspetta_messaggi', { codice, secondi: 5 });
assert.match(r.testo, /Nessuno ha scritto in 5 secondi/);
console.log('ok  "aspetta_messaggi" si sveglia al primo messaggio, o dopo il tempo massimo');

// --- emote e movimento ---
r = await usa('emote', { codice, tipo: 'saluta' });
await aspetta(() => ugo.claude().em && ugo.claude().em.t === 'saluta');
r = await usa('muoviti', { codice, azione: 'raggiungi', nick: 'Bea' });
assert.ok(!r.errore, r.testo);
await aspetta(() => { const p = ugo.claude(); return p.s === 'piazza' && Math.hypot(p.x, p.z - 30) < 2.4; });
r = await usa('muoviti', { codice, azione: 'segui' });
await aspetta(() => ugo.claude().s === 'biblioteca');
console.log('ok  emote, "raggiungi" un\'altra persona, torna a seguire');

// --- il giocatore lo scollega dal gioco: esce subito e non rientra ---
await ugo.r.rpc('claude_revoca', {});
await aspetta(() => !ugo.claude());
await pausa(1500);
assert.ok(!ugo.claude(), 'non rientra con il vecchio token');
r = await usa('guarda', { codice });
assert.ok(r.errore || /non è più nel borgo|sbagliato/i.test(r.testo), r.testo);
console.log('ok  "Scollega Claude" dal gioco: il compagno esce e il codice non vale più');

// --- nuovo codice, poi scollega da Claude ---
const { codice: codice2 } = await ugo.r.rpc('claude_codice', { stanza, nick: 'Ugo' });
r = await usa('collega', { codice: codice2 });
assert.ok(!r.errore, r.testo);
await aspetta(() => !!ugo.claude());
r = await usa('scollega', { codice: codice2 });
await aspetta(() => !ugo.claude());
console.log('ok  nuovo codice e "scollega" da Claude');

[ugo, bea].forEach(g => g.r.chiudi());
srv.chiudi();
console.log('tutto ok');
setTimeout(() => process.exit(0), 200);
